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

function buildEmailHtml(schedule: ReportScheduleRow, report: EmailReport, forced: boolean) {
  const categoryRows = report.categories
    .slice(0, 15)
    .map(
      (category) =>
        `<tr><td style="padding:4px 10px;border-bottom:1px solid #e2e8f0;">${category.category}</td><td style="padding:4px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">${category.subjectCount}</td><td style="padding:4px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">${category.uniqueRecipients}</td></tr>`,
    )
    .join("");

  const subtitle = forced
    ? `Envio forçado manualmente · gerado em ${new Date(report.generatedAt).toLocaleString("pt-BR", { timeZone: schedule.timezone })}`
    : `${humanFrequency(schedule.frequency)} · gerado em ${new Date(report.generatedAt).toLocaleString("pt-BR", { timeZone: schedule.timezone })}`;

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:640px;margin:0 auto;">
    <h2 style="margin-bottom:4px;">Relatório agendado: ${schedule.name}</h2>
    <p style="color:#475569;margin-top:0;">${subtitle}</p>
    <div style="display:flex;gap:16px;margin:16px 0;">
      <div><strong>${report.summary.totalEvents}</strong><br/><span style="color:#64748b;font-size:12px;">eventos</span></div>
      <div><strong>${report.summary.uniqueMessages}</strong><br/><span style="color:#64748b;font-size:12px;">mensagens únicas</span></div>
      <div><strong>${report.summary.uniqueRecipients}</strong><br/><span style="color:#64748b;font-size:12px;">destinatários</span></div>
    </div>
    <h3 style="margin-bottom:6px;">Categorias de assunto</h3>
    <table style="border-collapse:collapse;width:100%;font-size:13px;">
      <thead><tr style="text-align:left;color:#64748b;"><th style="padding:4px 10px;">Categoria</th><th style="padding:4px 10px;text-align:right;">Assuntos</th><th style="padding:4px 10px;text-align:right;">Destinatários</th></tr></thead>
      <tbody>${categoryRows}</tbody>
    </table>
    <p style="color:#64748b;font-size:12px;margin-top:20px;">CSV e PDF completos em anexo. Este agendamento também fica disponível na página "Relatórios agendados" do dashboard.</p>
  </div>`;
}

export async function sendReportEmail(schedule: ReportScheduleRow, report: EmailReport, options: { forced?: boolean } = {}) {
  const transporter = getGmailTransporter();

  const csv = emailReportToCsv(report);
  const pdfBlob = emailReportToPdf(report);
  const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());
  const csvFilename = createEmailReportFilename("csv", report.generatedAt);
  const pdfFilename = createEmailReportFilename("pdf", report.generatedAt);

  await transporter.sendMail({
    from: `"${GMAIL_FROM_NAME}" <${GMAIL_USER}>`,
    to: schedule.recipients,
    subject: `Relatório agendado: ${schedule.name}${options.forced ? " (forçado)" : ""}`,
    html: buildEmailHtml(schedule, report, options.forced ?? false),
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
