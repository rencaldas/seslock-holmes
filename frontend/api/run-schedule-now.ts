// Manual "force run" trigger for a single report schedule, called from the
// "Forçar agendamento de relatório" button on the Scheduled reports page.
// Builds and sends the report immediately, independent of Vercel Cron and
// WITHOUT touching next_run_at — the schedule's real cadence (see
// send-scheduled-reports.ts) is left untouched, this is purely an
// out-of-band send for testing or urgent situations.
//
// Reuses the same SUPABASE_SERVICE_ROLE_KEY / RESEND_API_KEY env vars as the
// cron endpoint — no extra secret to configure. Note this endpoint shares the
// rest of the app's trust model (see supabase/migrations/*report_schedules*):
// there's no user login, the Supabase anon key embedded in the browser
// bundle is already the access boundary, and schedule ids are unguessable
// UUIDs an anonymous caller has no way to obtain without that same access.
//
// Only relative imports are used below because Vercel's Node.js function
// bundler does not resolve the `@/` tsconfig path alias Vite uses for the
// browser build.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  buildReportForSchedule,
  recordLastRunOnly,
  recordScheduleRun,
  sendReportEmail,
  type ReportScheduleRow,
} from "./_lib/scheduled-report-runner";

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    response.status(500).json({ error: "Supabase não configurado (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY)." });
    return;
  }

  const scheduleId = typeof request.body?.scheduleId === "string" ? request.body.scheduleId.trim() : "";
  if (!scheduleId) {
    response.status(400).json({ error: "scheduleId é obrigatório." });
    return;
  }

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

  try {
    const report = await buildReportForSchedule(client, row);
    await sendReportEmail(row, report, { forced: true });
    await recordScheduleRun(client, row, "success", report);
    await recordLastRunOnly(client, row.id, "success");
    response.status(200).json({ status: "success" });
  } catch (runError) {
    const message = runError instanceof Error ? runError.message : String(runError);
    await recordScheduleRun(client, row, "error", undefined, message);
    await recordLastRunOnly(client, row.id, "error", message);
    response.status(500).json({ status: "error", error: message });
  }
}
