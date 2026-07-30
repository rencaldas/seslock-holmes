// Manual "force run" trigger for a single report schedule, called from the
// "Forçar agendamento de relatório" button on the Scheduled reports page.
// Builds and sends the report immediately, independent of Vercel Cron and
// WITHOUT touching next_run_at — the schedule's real cadence (see
// send-scheduled-reports.ts) is left untouched, this is purely an
// out-of-band send for testing or urgent situations.
//
// Reuses the same SUPABASE_SERVICE_ROLE_KEY / GMAIL_USER / GMAIL_APP_PASSWORD
// env vars as the cron endpoint — no extra secret to configure. Note this
// endpoint shares the rest of the app's trust model (see
// supabase/migrations/*report_schedules*): there's no user login, the
// Supabase anon key embedded in the browser bundle is already the access
// boundary, and schedule ids are unguessable UUIDs an anonymous caller has
// no way to obtain without that same access.
//
// Only relative imports are used below because Vercel's Node.js function
// bundler does not resolve the `@/` tsconfig path alias Vite uses for the
// browser build.
//
// report-runner is imported statically (like the other local api/* imports)
// so Vercel's build bundles it into the compiled function output. It was
// briefly imported via a dynamic `await import(...)` instead, on the theory
// that deferring it into the try/catch below would turn a module-load crash
// into a catchable error — but a *local*, non-node_modules file reached only
// through a dynamic import() is resolved by Node against the deployed
// filesystem at runtime, not inlined at build time like a static import, and
// Vercel's function bundler doesn't ship a standalone compiled twin of it.
// That produced "Cannot find module" in production regardless of which
// directory the file lived in. Nothing at report-runner's module top level
// actually throws (readEnv returns null instead of throwing), so the static
// import is safe here.

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
} from "../src/lib/scheduled-reports/report-runner";

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
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

    async function recordRunSafely(status: "success" | "error", report: Awaited<ReturnType<typeof buildReportForSchedule>> | undefined, errorMessage: string | undefined) {
      try {
        await recordScheduleRun(client, row, status, report, errorMessage);
        await recordLastRunOnly(client, row.id, status, errorMessage);
      } catch (recordError) {
        console.error("run-schedule-now: failed to record run history", recordError);
      }
    }

    try {
      const report = await buildReportForSchedule(client, row);
      await sendReportEmail(row, report, { forced: true });
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
