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

// Embedded as a base64 data URI (not an external <img src> URL) so the
// email is fully self-contained: no dependency on the production domain
// being reachable or the built asset hash matching, and no image-blocking by
// default in most email clients (data URIs render immediately, unlike
// remote images which Gmail/Outlook often hide behind a click-to-load
// prompt on first contact from a sender). Sized down from the app's
// 404x497 source (src/assets/overview-logo.png, the light/white variant
// used on dark surfaces) to 130x160 to keep the email small.
const LOGO_DATA_URI =
  'data:image/png;base64,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';

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
          <td style="vertical-align:middle;padding-right:10px;"><img src="${LOGO_DATA_URI}" width="26" height="32" alt="" style="display:block;width:26px;height:32px;border:0;" /></td>
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
