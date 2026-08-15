// Server-only module (Node.js, not for the browser bundle) shared by both
// /api/send-scheduled-reports.ts (Vercel Cron) and /api/run-schedule-now.ts
// (manual "force run" trigger from the app): builds the report for a
// schedule, emails it via Gmail SMTP, and records the run.
//
// Lives under src/lib instead of api/ on purpose: Vercel's Serverless
// Functions build excludes any file or directory whose name starts with `_`
// from the deployed bundle entirely — not just from routing — so an earlier
// api/_lib/scheduled-report-runner.ts here made both endpoints fail with
// "Cannot find module" at runtime. src/lib is already known-good: it's where
// email-report.ts and the other modules this file reuses already live, and
// they're traced and included correctly by Vercel's Node builder via
// relative imports from api/*.ts.
//
// Sends through a real Gmail account (SMTP + App Password) instead of a
// transactional email API, since those all require verifying a domain the
// sender owns — not an option here. Gmail's daily sending limit (~500/day
// for a regular account) comfortably covers a handful of scheduled reports.
//
// Only relative imports are used below (including inside the reused
// src/lib/* modules) because Vercel's Node.js function bundler does not
// resolve the `@/` tsconfig path alias Vite uses for the browser build.

import nodemailer, { type Transporter } from "nodemailer";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAwsSnsEventTypeFilterValues,
  rowMatchesOrigin,
  rowMatchesRecipientDomain,
  rowMatchesStatus,
  rowMatchesSubject,
  rowToEmailEvent,
} from "../supabase/aws-sns.js";
import { EMAIL_EVENT_LIST_COLUMNS, fetchEventRowsWithTimeFallback } from "../supabase/queries/fetch-event-rows.js";
import {
  buildEmailReport,
  createEmailReportFilename,
  emailReportToCsv,
  emailReportToPdf,
  type EmailReport,
  type EmailReportSortBy,
} from "../email-report.js";
import { PROBLEM_EVENT_TYPES, type EmailEventType } from "../supabase/types.js";
import { recordAuditEventFromServer } from "../audit-log/record-server.js";

// Hosted as a real static asset (public/email-logo.png -> served at the
// site root, no build hash) rather than embedded as a base64 data URI.
// Data URIs looked appealing (self-contained, no dependency on the domain
// being reachable) but Gmail's own renderer -- the exact client this whole
// deliverability pass targets -- doesn't reliably display inline
// data:image sources: the header showed as an empty broken-image box in
// production even though the same HTML rendered the image fine in a
// browser iframe preview. Sized down from the app's 404x497 source
// (src/assets/overview-logo.png, the light/white variant used on dark
// surfaces) to 130x160 to keep the file small.
const LOGO_URL = "https://seslock-holmes.vercel.app/email-logo.png";

export interface ScheduleFilters {
  windowDays: number;
  status: "all" | EmailEventType;
  origin?: string;
  subject?: string;
  provider?: string;
  rowLimit: number | "all";
  sortBy?: EmailReportSortBy;
}

export interface ScheduleFrequency {
  type: "daily" | "weekly" | "monthly";
  time: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
}

export interface ReportScheduleRow {
  id: string;
  name: string;
  is_active: boolean;
  events_table: string;
  filters: ScheduleFilters;
  recipients: string[];
  frequency: ScheduleFrequency;
  timezone: string;
  next_run_at: string;
}

export function readEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

export const SUPABASE_URL = readEnv("SUPABASE_URL", "VITE_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
export const SUPABASE_SERVICE_ROLE_KEY = readEnv("SUPABASE_SERVICE_ROLE_KEY");
export const GMAIL_USER = readEnv("GMAIL_USER");
export const GMAIL_APP_PASSWORD = readEnv("GMAIL_APP_PASSWORD");
export const GMAIL_FROM_NAME = readEnv("GMAIL_FROM_NAME") || "Seslock Holmes";

export interface GmailCredentials {
  gmailUser: string;
  gmailAppPassword: string;
  gmailFromName?: string;
}

// One transporter per set of credentials (not a single module-level cache) —
// this now runs once per tenant in a multi-tenant cron loop
// (send-scheduled-reports.ts), each with their own registered Gmail account.
function getGmailTransporter(credentials: GmailCredentials): Transporter {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: credentials.gmailUser, pass: credentials.gmailAppPassword },
  });
}

function humanFrequency(frequency: ScheduleFrequency) {
  const dayNames = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  if (frequency.type === "daily") return `Diariamente às ${frequency.time}`;
  if (frequency.type === "weekly") return `Toda ${dayNames[frequency.dayOfWeek ?? 0]} às ${frequency.time}`;
  return `Todo dia ${frequency.dayOfMonth ?? 1} do mês às ${frequency.time}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function capitalize(value: string) {
  return value.length ? value[0]!.toUpperCase() + value.slice(1) : value;
}

// Only the "problem" statuses (or "all", which mixes them in) warrant the
// plain-language action guidance below — a schedule filtered down to just
// "sent" or "delivered" is a clean-bill-of-health report with nothing for an
// admin to chase, and showing an alert box there would just be noise.
function reportNeedsActionGuidance(status: ReportScheduleRow["filters"]["status"]) {
  return status === "all" || PROBLEM_EVENT_TYPES.includes(status as EmailEventType);
}

// Threshold for the "recurring problem" badge below: a client who bounced
// once yesterday isn't urgent, but one whose problem events span 30+ days
// (with more than one occurrence, so a single message's retry storm doesn't
// count) has been silently missing emails for a month — that's who an admin
// with limited time should contact first.
const RECURRING_PROBLEM_DAYS = 30;
const RECURRING_PROBLEM_LIST_LIMIT = 5;

function findRecurringProblemRecipients(report: EmailReport) {
  return report.recipients
    .map((recipient) => {
      const problemCount = PROBLEM_EVENT_TYPES.reduce(
        (sum, type) => sum + recipient.eventCounts[type],
        0,
      );
      const spanDays =
        (new Date(recipient.lastEventAt).getTime() - new Date(recipient.firstEventAt).getTime()) /
        (24 * 60 * 60 * 1000);
      return { email: recipient.email, problemCount, spanDays };
    })
    .filter((entry) => entry.problemCount >= 2 && entry.spanDays >= RECURRING_PROBLEM_DAYS)
    .sort((a, b) => b.spanDays - a.spanDays);
}

function formatRecurringProblemList(recurring: ReturnType<typeof findRecurringProblemRecipients>) {
  const shown = recurring.slice(0, RECURRING_PROBLEM_LIST_LIMIT).map((entry) => entry.email);
  const remaining = recurring.length - shown.length;
  return remaining > 0 ? `${shown.join(", ")} e mais ${remaining}` : shown.join(", ");
}

// Written for the non-technical admin who receives this report and isn't
// familiar with terms like "bounce" or "SNS event" — spells out in plain
// Portuguese what a problem event usually means, what to do about it, and
// what happens if nobody does. Requested directly by the business side after
// admins receiving these reports didn't know what action, if any, they were
// expected to take with the numbers.
function renderActionGuidanceHtml(schedule: ReportScheduleRow, report: EmailReport) {
  if (!reportNeedsActionGuidance(schedule.filters.status)) return "";

  const recurring = findRecurringProblemRecipients(report);
  const recurringBadgeHtml = recurring.length
    ? `<div style="margin-bottom:10px;">
                <span style="display:inline-block;background-color:#fee2e2;color:#991b1b;font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px;">⚠ ${recurring.length} cliente${recurring.length > 1 ? "s" : ""} com problema recorrente há mais de ${RECURRING_PROBLEM_DAYS} dias</span>
                <p style="margin:8px 0 0;color:#7c2d12;font-size:12px;line-height:1.6;">Priorize o contato com: ${escapeHtml(formatRecurringProblemList(recurring))}.</p>
              </div>`
    : "";

  return `<tr>
      <td style="padding:20px 32px 4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff7ed;border:1px solid #fed7aa;border-radius:10px;">
          <tr><td style="padding:16px 18px;">
            <div style="font-size:13px;font-weight:700;color:#9a3412;margin-bottom:8px;">O que fazer com este relatório</div>
            ${recurringBadgeHtml}
            <p style="margin:0 0 8px;color:#7c2d12;font-size:13px;line-height:1.6;">
              Quando um email aparece como <strong>devolvido (bounce)</strong>, <strong>rejeitado</strong> ou com <strong>reclamação</strong>, geralmente é porque o endereço de email do cliente está incorreto, desatualizado, ou a caixa de entrada dele está cheia ou bloqueando esse remetente.
            </p>
            <p style="margin:0 0 8px;color:#7c2d12;font-size:13px;line-height:1.6;">
              <strong>Ação recomendada:</strong> entre em contato com esses clientes por outro canal (telefone, WhatsApp, etc.) para confirmar e corrigir o email cadastrado.
            </p>
            <p style="margin:0;color:#7c2d12;font-size:13px;line-height:1.6;">
              Se isso não for corrigido, o cliente pode continuar sem receber notas fiscais, documentos e notificações importantes. O motivo específico e uma recomendação para cada destinatário estão nos anexos CSV/PDF deste email.
            </p>
          </td></tr>
        </table>
      </td>
    </tr>`;
}

function renderActionGuidanceText(schedule: ReportScheduleRow, report: EmailReport) {
  if (!reportNeedsActionGuidance(schedule.filters.status)) return [];

  const recurring = findRecurringProblemRecipients(report);
  const lines: string[] = ["", "O QUE FAZER COM ESTE RELATÓRIO"];

  if (recurring.length) {
    lines.push(
      `⚠ ${recurring.length} cliente(s) com problema recorrente há mais de ${RECURRING_PROBLEM_DAYS} dias.`,
      `Priorize o contato com: ${formatRecurringProblemList(recurring)}.`,
    );
  }

  lines.push(
    "Quando um email aparece como devolvido (bounce), rejeitado ou com reclamação, geralmente é porque o endereço de email do cliente está incorreto, desatualizado, ou a caixa de entrada dele está cheia ou bloqueando esse remetente.",
    "Ação recomendada: entre em contato com esses clientes por outro canal (telefone, WhatsApp, etc.) para confirmar e corrigir o email cadastrado.",
    "Se isso não for corrigido, o cliente pode continuar sem receber notas fiscais, documentos e notificações importantes. O motivo específico e uma recomendação para cada destinatário estão nos anexos CSV/PDF deste email.",
  );

  return lines;
}

function reportSubtitle(schedule: ReportScheduleRow, report: EmailReport, forced: boolean) {
  const generatedAtLabel = new Date(report.generatedAt).toLocaleString("pt-BR", { timeZone: schedule.timezone });
  return forced
    ? `Envio forçado manualmente · gerado em ${generatedAtLabel}`
    : `${humanFrequency(schedule.frequency)} · gerado em ${generatedAtLabel}`;
}

export async function buildReportForSchedule(client: SupabaseClient, schedule: ReportScheduleRow) {
  const filters = schedule.filters;
  const startIso = new Date(Date.now() - filters.windowDays * 24 * 60 * 60 * 1000).toISOString();
  const eventTypeFilterValues = getAwsSnsEventTypeFilterValues(filters.status);
  const maxRows = filters.rowLimit === "all" ? undefined : Number(filters.rowLimit);

  const { rows, truncated } = await fetchEventRowsWithTimeFallback(client, schedule.events_table, startIso, {
    maxRows,
    columns: EMAIL_EVENT_LIST_COLUMNS,
    inValues: eventTypeFilterValues.length ? [{ column: "eventType", values: eventTypeFilterValues }] : undefined,
  });

  const origin = (filters.origin ?? "").trim();
  const subject = (filters.subject ?? "").trim();
  const provider = (filters.provider ?? "").trim();

  const events = rows
    .filter((row) => rowMatchesStatus(row, filters.status))
    .filter((row) => rowMatchesOrigin(row, origin))
    .filter((row) => rowMatchesSubject(row, subject))
    .filter((row) => rowMatchesRecipientDomain(row, provider))
    .map((row) => rowToEmailEvent(row));

  const queryLabels: Record<string, string> = {
    janela: `últimos ${filters.windowDays} dia(s)`,
    status: filters.status,
    ...(origin ? { origem: origin } : {}),
    ...(subject ? { assunto: subject } : {}),
    ...(provider ? { provedor: provider } : {}),
    limite: String(filters.rowLimit),
    // O destinatário do e-mail não tem como inspecionar a consulta, então a
    // truncagem tem que vir escrita no relatório — senão os números chegam
    // como se fossem o total do período.
    ...(truncated ? { aviso: "resultado incompleto — teto de segurança de linhas atingido" } : {}),
  };

  return buildEmailReport(events, {
    language: "pt-BR",
    query: queryLabels,
    sortBy: filters.sortBy ?? "email",
  });
}

function renderStatCardHtml(value: number, label: string) {
  return `<td style="width:33.33%;padding:0 6px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 8px;text-align:center;">
                  <div style="font-size:22px;line-height:1.2;font-weight:700;color:#0f172a;">${value.toLocaleString("pt-BR")}</div>
                  <div style="margin-top:4px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">${escapeHtml(label)}</div>
                </td></tr>
              </table>
            </td>`;
}

function renderFiltersHtml(query: Record<string, string>) {
  const entries = Object.entries(query);
  if (!entries.length) return "";

  const chips = entries
    .map(
      ([key, value]) =>
        `<span style="display:inline-block;background-color:#eef2ff;color:#2554e0;font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;margin:0 6px 6px 0;">${escapeHtml(capitalize(key))}: ${escapeHtml(value)}</span>`,
    )
    .join("");

  return `<tr><td style="padding:4px 32px 4px;">
              <div style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px;">Filtros aplicados</div>
              <div>${chips}</div>
            </td></tr>`;
}

function renderCategoryRowsHtml(categories: EmailReport["categories"]) {
  return categories
    .slice(0, 15)
    .map((category, index) => {
      const background = index % 2 === 0 ? "#ffffff" : "#f8fafc";
      return `<tr style="background-color:${background};">
                <td style="padding:10px 12px;border-bottom:1px solid #eef2f7;color:#1e293b;font-size:13px;">${escapeHtml(category.category)}</td>
                <td style="padding:10px 12px;border-bottom:1px solid #eef2f7;color:#1e293b;font-size:13px;text-align:right;">${category.subjectCount.toLocaleString("pt-BR")}</td>
                <td style="padding:10px 12px;border-bottom:1px solid #eef2f7;color:#1e293b;font-size:13px;text-align:right;">${category.uniqueRecipients.toLocaleString("pt-BR")}</td>
              </tr>`;
    })
    .join("");
}

function buildEmailHtml(schedule: ReportScheduleRow, report: EmailReport, forced: boolean) {
  const subtitle = reportSubtitle(schedule, report, forced);
  const preheader = `${report.summary.totalEvents.toLocaleString("pt-BR")} eventos · ${report.summary.uniqueRecipients.toLocaleString("pt-BR")} destinatários · ${humanFrequency(schedule.frequency)}`;
  const statCards = [
    renderStatCardHtml(report.summary.totalEvents, "Eventos"),
    renderStatCardHtml(report.summary.uniqueMessages, "Mensagens únicas"),
    renderStatCardHtml(report.summary.uniqueRecipients, "Destinatários"),
  ].join("");

  // Table-based layout (not flex/grid) on purpose: this has to render
  // consistently across Gmail, Outlook and Apple Mail's varying levels of
  // CSS support, not just modern browsers.
  return `<div style="background-color:#f1f5f9;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background-color:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
    <tr>
      <td style="background-color:#2554e0;padding:14px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;padding-right:10px;"><img src="${LOGO_URL}" width="26" height="32" alt="" style="display:block;width:26px;height:32px;border:0;" /></td>
          <td style="vertical-align:middle;"><span style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Seslock Holmes</span></td>
        </tr></table>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 32px 4px;">
        <h1 style="margin:0 0 6px;font-size:19px;line-height:1.3;color:#0f172a;">Relatório agendado: ${escapeHtml(schedule.name)}${forced ? ' <span style="font-weight:500;color:#2554e0;">(forçado)</span>' : ""}</h1>
        <p style="margin:0;color:#64748b;font-size:13px;">${escapeHtml(subtitle)}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 26px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${statCards}</tr></table>
      </td>
    </tr>
    ${renderActionGuidanceHtml(schedule, report)}
    ${renderFiltersHtml(report.query)}
    <tr>
      <td style="padding:20px 32px 4px;">
        <div style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:10px;">Categorias de assunto</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #eef2f7;border-radius:8px;">
          <thead>
            <tr style="background-color:#f8fafc;">
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.03em;">Categoria</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.03em;">Assuntos</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.03em;">Destinatários</th>
            </tr>
          </thead>
          <tbody>${renderCategoryRowsHtml(report.categories)}</tbody>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 32px 28px;">
        <div style="border-top:1px solid #e2e8f0;padding-top:16px;">
          <p style="margin:0 0 4px;color:#64748b;font-size:12px;">CSV e PDF completos em anexo.</p>
          <p style="margin:0;color:#94a3b8;font-size:12px;">Este agendamento também fica disponível na página "Relatórios agendados" do dashboard.</p>
        </div>
      </td>
    </tr>
  </table>
  <p style="text-align:center;color:#94a3b8;font-size:11px;margin:16px auto 0;max-width:640px;">Enviado automaticamente pelo Seslock Holmes · não é necessário responder este email.</p>
</div>`;
}

// Plain-text counterpart to buildEmailHtml, sent alongside it as a MIME
// multipart/alternative. An HTML-only body is one of the more common signals
// spam filters (Gmail's own included) score against — this isn't optional
// polish, it measurably affects whether these reports land in the inbox.
function buildEmailText(schedule: ReportScheduleRow, report: EmailReport, forced: boolean) {
  const lines: string[] = [
    "SESLOCK HOLMES",
    `Relatório agendado: ${schedule.name}${forced ? " (forçado)" : ""}`,
    reportSubtitle(schedule, report, forced),
    "",
    "RESUMO",
    `Eventos: ${report.summary.totalEvents.toLocaleString("pt-BR")}`,
    `Mensagens únicas: ${report.summary.uniqueMessages.toLocaleString("pt-BR")}`,
    `Destinatários: ${report.summary.uniqueRecipients.toLocaleString("pt-BR")}`,
    ...renderActionGuidanceText(schedule, report),
  ];

  const filterEntries = Object.entries(report.query);
  if (filterEntries.length) {
    lines.push("", "FILTROS APLICADOS");
    for (const [key, value] of filterEntries) {
      lines.push(`${capitalize(key)}: ${value}`);
    }
  }

  if (report.categories.length) {
    lines.push("", "CATEGORIAS DE ASSUNTO");
    for (const category of report.categories.slice(0, 15)) {
      lines.push(`- ${category.category}: ${category.subjectCount} assunto(s), ${category.uniqueRecipients} destinatário(s)`);
    }
  }

  lines.push(
    "",
    "CSV e PDF completos em anexo.",
    'Este agendamento também fica disponível na página "Relatórios agendados" do dashboard.',
    "",
    "Enviado automaticamente pelo Seslock Holmes — não é necessário responder este email.",
  );

  return lines.join("\n");
}

export async function sendReportEmail(
  schedule: ReportScheduleRow,
  report: EmailReport,
  credentials: GmailCredentials,
  options: { forced?: boolean } = {},
) {
  const transporter = getGmailTransporter(credentials);
  const fromName = credentials.gmailFromName || GMAIL_FROM_NAME;
  const forced = options.forced ?? false;

  const csv = emailReportToCsv(report);
  const pdfBlob = emailReportToPdf(report);
  const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());
  const csvFilename = createEmailReportFilename("csv", report.generatedAt);
  const pdfFilename = createEmailReportFilename("pdf", report.generatedAt);

  // A mailto: List-Unsubscribe (RFC 2369) doesn't require any endpoint of
  // our own — it's a one-line signal to spam filters that this is a
  // legitimate recurring send with an opt-out path, not a hijacked account
  // blasting mail. A true one-click List-Unsubscribe (RFC 8058) would need a
  // public HTTP endpoint plus a per-recipient opt-out flag in
  // report_schedules; out of scope until this needs to scale past a
  // handful of recipients per schedule.
  const unsubscribeSubject = encodeURIComponent(`Remover do agendamento: ${schedule.name}`);

  await transporter.sendMail({
    from: `"${fromName}" <${credentials.gmailUser}>`,
    to: schedule.recipients,
    subject: `Relatório agendado: ${schedule.name}${forced ? " (forçado)" : ""}`,
    text: buildEmailText(schedule, report, forced),
    html: buildEmailHtml(schedule, report, forced),
    headers: {
      "List-Unsubscribe": `<mailto:${credentials.gmailUser}?subject=${unsubscribeSubject}>`,
    },
    attachments: [
      { filename: csvFilename, content: Buffer.from(csv, "utf-8") },
      { filename: pdfFilename, content: pdfBuffer },
    ],
  });
}

export async function recordScheduleRun(
  client: SupabaseClient,
  schedule: ReportScheduleRow,
  status: "success" | "error",
  report: EmailReport | undefined,
  errorMessage: string | undefined,
  actor: { type: "cron" | "admin_token"; label: string },
) {
  await client.from("report_schedule_runs").insert({
    schedule_id: schedule.id,
    status,
    report: report ?? null,
    error_message: errorMessage ?? null,
    recipients_sent: status === "success" ? schedule.recipients : null,
  });

  // Non-fatal: audit_log pode não existir ainda num projeto self-hosted que
  // não rodou a migration 20260814100000 — isso nunca pode transformar um
  // envio real (ou uma execução do cron) em falha.
  const action =
    actor.type === "cron"
      ? status === "success"
        ? "schedule.run_completed"
        : "schedule.run_failed"
      : status === "success"
        ? "schedule.run_now_succeeded"
        : "schedule.run_now_failed";

  await recordAuditEventFromServer(client, {
    action,
    resourceType: "report_schedule",
    resourceId: schedule.id,
    actorType: actor.type,
    actorLabel: actor.label,
    metadata: { scheduleName: schedule.name, errorMessage: errorMessage ?? null },
  });
}

// Advances next_run_at to the next real occurrence — used only by the cron
// path. The manual "force run" path deliberately never calls this: forcing a
// send must not disturb the schedule the user configured.
export async function advanceNextRun(client: SupabaseClient, schedule: ReportScheduleRow, status: "success" | "error", errorMessage?: string) {
  const { data: nextRunAt, error: rpcError } = await client.rpc("compute_next_run_at", {
    frequency: schedule.frequency,
    tz: schedule.timezone,
    from_ts: new Date().toISOString(),
  });
  if (rpcError) throw rpcError;

  await client
    .from("report_schedules")
    .update({
      last_run_at: new Date().toISOString(),
      last_run_status: status,
      last_run_error: errorMessage ?? null,
      next_run_at: nextRunAt,
    })
    .eq("id", schedule.id);
}

// Records the outcome of a manual "force run" on the schedule row (so the
// list/history UI reflects it) without touching next_run_at.
export async function recordLastRunOnly(client: SupabaseClient, scheduleId: string, status: "success" | "error", errorMessage?: string) {
  await client
    .from("report_schedules")
    .update({
      last_run_at: new Date().toISOString(),
      last_run_status: status,
      last_run_error: errorMessage ?? null,
    })
    .eq("id", scheduleId);
}

// Processes every due schedule for one project (client + credentials pair).
// Called once per cron tick by send-scheduled-reports.ts. Still takes the
// client and credentials as arguments rather than reading the module-level
// env vars directly: that kept a multi-tenant loop possible when one existed,
// and it remains the reason this is straightforward to unit test.
export async function runDueSchedules(client: SupabaseClient, credentials: GmailCredentials) {
  const { data: dueSchedules, error } = await client
    .from("report_schedules")
    .select("*")
    .eq("is_active", true)
    .lte("next_run_at", new Date().toISOString());

  if (error) throw error;

  async function claimSchedule(schedule: ReportScheduleRow) {
    // Simple guard against overlapping cron ticks processing the same
    // schedule twice: push next_run_at forward before doing the (slower)
    // real work, then overwrite it with the real computed value once the
    // run finishes.
    const { data, error: claimError } = await client
      .from("report_schedules")
      .update({ next_run_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() })
      .eq("id", schedule.id)
      .lte("next_run_at", new Date().toISOString())
      .select("id")
      .maybeSingle();

    if (claimError) throw claimError;
    return Boolean(data);
  }

  async function finishRunSafely(
    schedule: ReportScheduleRow,
    status: "success" | "error",
    report: EmailReport | undefined,
    errorMessage: string | undefined,
  ) {
    try {
      await recordScheduleRun(client, schedule, status, report, errorMessage, { type: "cron", label: "Cron" });
      await advanceNextRun(client, schedule, status, errorMessage);
    } catch (recordError) {
      console.error(`runDueSchedules: failed to record run for schedule ${schedule.id}`, recordError);
    }
  }

  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const schedule of (dueSchedules ?? []) as ReportScheduleRow[]) {
    const claimed = await claimSchedule(schedule);
    if (!claimed) continue;

    try {
      const report = await buildReportForSchedule(client, schedule);
      await sendReportEmail(schedule, report, credentials);
      await finishRunSafely(schedule, "success", report, undefined);
      results.push({ id: schedule.id, status: "success" });
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : String(runError);
      await finishRunSafely(schedule, "error", undefined, message);
      results.push({ id: schedule.id, status: "error", error: message });
    }
  }

  return results;
}
