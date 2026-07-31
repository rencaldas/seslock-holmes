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
import type { EmailEventType } from "../supabase/types.js";

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

let cachedTransporter: Transporter | null = null;

// Reused across invocations of the same warm serverless instance instead of
// reconnecting to Gmail's SMTP server on every send.
function getGmailTransporter(): Transporter {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error("GMAIL_USER/GMAIL_APP_PASSWORD não configuradas nas variáveis de ambiente do Vercel.");
  }
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });
  }
  return cachedTransporter;
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

  const rows = await fetchEventRowsWithTimeFallback(client, schedule.events_table, startIso, {
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

export async function sendReportEmail(schedule: ReportScheduleRow, report: EmailReport, options: { forced?: boolean } = {}) {
  const transporter = getGmailTransporter();
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
    from: `"${GMAIL_FROM_NAME}" <${GMAIL_USER}>`,
    to: schedule.recipients,
    subject: `Relatório agendado: ${schedule.name}${forced ? " (forçado)" : ""}`,
    text: buildEmailText(schedule, report, forced),
    html: buildEmailHtml(schedule, report, forced),
    headers: {
      "List-Unsubscribe": `<mailto:${GMAIL_USER}?subject=${unsubscribeSubject}>`,
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
  report?: EmailReport,
  errorMessage?: string,
) {
  await client.from("report_schedule_runs").insert({
    schedule_id: schedule.id,
    status,
    report: report ?? null,
    error_message: errorMessage ?? null,
    recipients_sent: status === "success" ? schedule.recipients : null,
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
