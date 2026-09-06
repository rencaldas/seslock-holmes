// Manual "force run" trigger for a single report schedule ("Forçar
// agendamento de relatório" button). Builds and sends immediately,
// independent of Vercel Cron and WITHOUT touching next_run_at — the
// schedule's real cadence is left untouched. See
// docs/ARCHITECTURE.md#relatórios-agendados and
// docs/ARCHITECTURE.md#convenções-de-infraestrutura-vercel (why every
// relative import below needs an explicit `.js` extension, and why a
// dynamic `await import(...)` here was tried and reverted).

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  GMAIL_USER,
  GMAIL_APP_PASSWORD,
  GMAIL_FROM_NAME,
  buildReportForSchedule,
  readEnv,
  recordLastRunOnly,
  recordScheduleRun,
  sendReportEmail,
  type GmailCredentials,
  type ReportScheduleRow,
} from "../src/lib/scheduled-reports/report-runner.js";
import { isBearerTokenValid } from "../src/lib/server/request-auth.js";

function resolveTarget():
  | { client: SupabaseClient; credentials: GmailCredentials }
  | { error: string; status: number } {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "Supabase não configurado (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY).", status: 500 };
  }
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return { error: "GMAIL_USER/GMAIL_APP_PASSWORD não configuradas.", status: 500 };
  }

  return {
    client: createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY),
    credentials: { gmailUser: GMAIL_USER, gmailAppPassword: GMAIL_APP_PASSWORD, gmailFromName: GMAIL_FROM_NAME },
  };
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    // Same ADMIN_API_TOKEN that gates schedules.ts — this endpoint forces an
    // immediate send for one of that same project's schedules, so it needs
    // the same owner-only guard.
    if (!isBearerTokenValid(request.headers.authorization, readEnv("ADMIN_API_TOKEN"))) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (request.method !== "POST") {
      response.status(405).json({ error: "Method not allowed" });
      return;
    }

    const scheduleId = typeof request.body?.scheduleId === "string" ? request.body.scheduleId.trim() : "";
    if (!scheduleId) {
      response.status(400).json({ error: "scheduleId é obrigatório." });
      return;
    }

    const target = resolveTarget();
    if ("error" in target) {
      response.status(target.status).json({ error: target.error });
      return;
    }

    const { client, credentials } = target;

    const { data: schedule, error: fetchError } = await client
      .from("report_schedules")
      .select("*")
      .eq("id", scheduleId)
      .maybeSingle();

    if (fetchError) {
      response.status(500).json({ error: fetchError.message });
      return;
    }
    if (!schedule) {
      response.status(404).json({ error: "Agendamento não encontrado." });
      return;
    }

    const row = schedule as ReportScheduleRow;

    async function recordRunSafely(status: "success" | "error", report: Awaited<ReturnType<typeof buildReportForSchedule>> | undefined, errorMessage: string | undefined) {
      try {
        await recordScheduleRun(client, row, status, report, errorMessage, { type: "admin_token", label: "Admin Token" });
        await recordLastRunOnly(client, row.id, status, errorMessage);
      } catch (recordError) {
        console.error("run-schedule-now: failed to record run history", recordError);
      }
    }

    try {
      const report = await buildReportForSchedule(client, row);
      await sendReportEmail(row, report, credentials, { forced: true });
      await recordRunSafely("success", report, undefined);
      response.status(200).json({ status: "success" });
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : String(runError);
      await recordRunSafely("error", undefined, message);
      response.status(500).json({ status: "error", error: message });
    }
  } catch (unexpectedError) {
    // Last-resort guard: whatever broke above always answers with JSON so
    // the browser can show the real reason instead of a bare platform 500.
    console.error("run-schedule-now: unexpected failure", unexpectedError);
    const message = unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError);
    if (!response.headersSent) {
      response.status(500).json({ status: "error", error: message });
    }
  }
}
