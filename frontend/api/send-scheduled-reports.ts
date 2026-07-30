// Vercel Cron Job target — see the `crons` entry in ../vercel.json. On every
// invocation it processes every `report_schedules` row whose `next_run_at`
// has passed: re-runs the same filtered query the Overview page would run,
// builds the report, emails it via Resend, and records the run so the app
// can show it in-page without the browser needing to be open.
//
// Required env vars (Vercel Project Settings > Environment Variables):
// SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, CRON_SECRET. Reuses whichever
// Supabase URL the frontend already has configured (VITE_SUPABASE_URL /
// NEXT_PUBLIC_SUPABASE_URL).
//
// Only relative imports are used below (including inside the reused
// src/lib/* modules) because Vercel's Node.js function bundler does not
// resolve the `@/` tsconfig path alias Vite uses for the browser build.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getAwsSnsEventTypeFilterValues,
  rowMatchesOrigin,
  rowMatchesRecipientDomain,
  rowMatchesStatus,
  rowMatchesSubject,
  rowToEmailEvent,
} from "../src/lib/supabase/aws-sns";
import { EMAIL_EVENT_LIST_COLUMNS, fetchEventRowsWithTimeFallback } from "../src/lib/supabase/queries/fetch-event-rows";
import {
  buildEmailReport,
  createEmailReportFilename,
  emailReportToCsv,
  emailReportToPdf,
  type EmailReport,
  type EmailReportSortBy,
} from "../src/lib/email-report";
import type { EmailEventType } from "../src/lib/supabase/types";

interface ScheduleFilters {
  windowDays: number;
  status: "all" | EmailEventType;
  origin?: string;
  subject?: string;
  provider?: string;
  rowLimit: number | "all";
  sortBy?: EmailReportSortBy;
}

interface ScheduleFrequency {
  type: "daily" | "weekly" | "monthly";
  time: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
}

interface ReportScheduleRow {
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

function readEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

const SUPABASE_URL = readEnv("SUPABASE_URL", "VITE_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = readEnv("SUPABASE_SERVICE_ROLE_KEY");
const RESEND_API_KEY = readEnv("RESEND_API_KEY");
const RESEND_FROM = readEnv("RESEND_FROM") || "Seslock Holmes <reports@resend.dev>";
const CRON_SECRET = readEnv("CRON_SECRET");

function humanFrequency(frequency: ScheduleFrequency) {
  const dayNames = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  if (frequency.type === "daily") return `Diariamente às ${frequency.time}`;
  if (frequency.type === "weekly") return `Toda ${dayNames[frequency.dayOfWeek ?? 0]} às ${frequency.time}`;
  return `Todo dia ${frequency.dayOfMonth ?? 1} do mês às ${frequency.time}`;
}

async function buildReportForSchedule(client: SupabaseClient, schedule: ReportScheduleRow) {
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

function buildEmailHtml(schedule: ReportScheduleRow, report: EmailReport) {
  const categoryRows = report.categories
    .slice(0, 15)
    .map(
      (category) =>
        `<tr><td style="padding:4px 10px;border-bottom:1px solid #e2e8f0;">${category.category}</td><td style="padding:4px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">${category.subjectCount}</td><td style="padding:4px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">${category.uniqueRecipients}</td></tr>`,
    )
    .join("");

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:640px;margin:0 auto;">
    <h2 style="margin-bottom:4px;">Relatório agendado: ${schedule.name}</h2>
    <p style="color:#475569;margin-top:0;">${humanFrequency(schedule.frequency)} · gerado em ${new Date(report.generatedAt).toLocaleString("pt-BR", { timeZone: schedule.timezone })}</p>
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

async function sendReportEmail(schedule: ReportScheduleRow, report: EmailReport) {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY não configurada nas variáveis de ambiente do Vercel.");
  }

  const csv = emailReportToCsv(report);
  const pdfBlob = emailReportToPdf(report);
  const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());
  const csvFilename = createEmailReportFilename("csv", report.generatedAt);
  const pdfFilename = createEmailReportFilename("pdf", report.generatedAt);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: schedule.recipients,
      subject: `Relatório agendado: ${schedule.name}`,
      html: buildEmailHtml(schedule, report),
      attachments: [
        { filename: csvFilename, content: Buffer.from(csv, "utf-8").toString("base64") },
        { filename: pdfFilename, content: pdfBuffer.toString("base64") },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend respondeu ${response.status}: ${text}`);
  }
}

async function claimSchedule(client: SupabaseClient, schedule: ReportScheduleRow) {
  // Simple guard against overlapping cron ticks processing the same schedule
  // twice: push next_run_at forward before doing the (slower) real work, then
  // overwrite it with the real computed value once the run finishes.
  const { data, error } = await client
    .from("report_schedules")
    .update({ next_run_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() })
    .eq("id", schedule.id)
    .lte("next_run_at", new Date().toISOString())
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

async function finishSchedule(client: SupabaseClient, schedule: ReportScheduleRow, status: "success" | "error", errorMessage?: string) {
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

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!CRON_SECRET || request.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    response.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    response.status(500).json({ error: "Supabase não configurado (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY)." });
    return;
  }

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: dueSchedules, error } = await client
    .from("report_schedules")
    .select("*")
    .eq("is_active", true)
    .lte("next_run_at", new Date().toISOString());

  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }

  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const schedule of (dueSchedules ?? []) as ReportScheduleRow[]) {
    const claimed = await claimSchedule(client, schedule);
    if (!claimed) continue;

    try {
      const report = await buildReportForSchedule(client, schedule);
      await sendReportEmail(schedule, report);

      await client.from("report_schedule_runs").insert({
        schedule_id: schedule.id,
        status: "success",
        report,
        recipients_sent: schedule.recipients,
      });

      await finishSchedule(client, schedule, "success");
      results.push({ id: schedule.id, status: "success" });
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : String(runError);

      await client.from("report_schedule_runs").insert({
        schedule_id: schedule.id,
        status: "error",
        error_message: message,
      });

      await finishSchedule(client, schedule, "error", message);
      results.push({ id: schedule.id, status: "error", error: message });
    }
  }

  response.status(200).json({ processed: results.length, results });
}
