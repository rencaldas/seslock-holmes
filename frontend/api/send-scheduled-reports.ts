// Vercel Cron Job target — see the `crons` entry in ../vercel.json. On every
// invocation it processes every `report_schedules` row whose `next_run_at`
// has passed: re-runs the same filtered query the Overview page would run,
// builds the report, emails it via Gmail SMTP, and records the run so the
// app can show it in-page without the browser needing to be open.
//
// Required env vars (Vercel Project Settings > Environment Variables):
// SUPABASE_SERVICE_ROLE_KEY, GMAIL_USER, GMAIL_APP_PASSWORD, CRON_SECRET.
// Reuses whichever Supabase URL the frontend already has configured
// (VITE_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL).
//
// Only relative imports are used below because Vercel's Node.js function
// bundler does not resolve the `@/` tsconfig path alias Vite uses for the
// browser build.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  advanceNextRun,
  buildReportForSchedule,
  readEnv,
  recordScheduleRun,
  sendReportEmail,
  type ReportScheduleRow,
} from "./_lib/scheduled-report-runner";

const CRON_SECRET = readEnv("CRON_SECRET");

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

// Recording the run + advancing next_run_at is bookkeeping around the actual
// send — a write failure here must not crash the loop and skip every
// remaining schedule, so it's logged and swallowed rather than left to throw.
async function finishRunSafely(
  client: SupabaseClient,
  schedule: ReportScheduleRow,
  status: "success" | "error",
  report: Awaited<ReturnType<typeof buildReportForSchedule>> | undefined,
  errorMessage: string | undefined,
) {
  try {
    await recordScheduleRun(client, schedule, status, report, errorMessage);
    await advanceNextRun(client, schedule, status, errorMessage);
  } catch (recordError) {
    console.error(`send-scheduled-reports: failed to record run for schedule ${schedule.id}`, recordError);
  }
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
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
        await finishRunSafely(client, schedule, "success", report, undefined);
        results.push({ id: schedule.id, status: "success" });
      } catch (runError) {
        const message = runError instanceof Error ? runError.message : String(runError);
        await finishRunSafely(client, schedule, "error", undefined, message);
        results.push({ id: schedule.id, status: "error", error: message });
      }
    }

    response.status(200).json({ processed: results.length, results });
  } catch (unexpectedError) {
    console.error("send-scheduled-reports: unexpected failure", unexpectedError);
    const message = unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError);
    if (!response.headersSent) {
      response.status(500).json({ error: message });
    }
  }
}
