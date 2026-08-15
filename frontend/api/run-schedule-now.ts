// Manual "force run" trigger for a single report schedule, called from the
// "Forçar agendamento de relatório" button on the Scheduled reports page.
// Builds and sends the report immediately, independent of Vercel Cron and
// WITHOUT touching next_run_at — the schedule's real cadence (see
// send-scheduled-reports.ts) is left untouched, this is purely an
// out-of-band send for testing or urgent situations.
//
// Takes { scheduleId } and runs it against this deployment's own project,
// using the same SUPABASE_SERVICE_ROLE_KEY / GMAIL_USER / GMAIL_APP_PASSWORD
// env vars as the cron endpoint.
//
// It also accepted { connectionId, token } to force-run a schedule on a
// visitor's own project registered in `report_connections`. That registry was
// removed along with the unauthenticated endpoint that populated it — see the
// matching note in send-scheduled-reports.ts.
//
// Only relative imports are used below because Vercel's Node.js function
// bundler does not resolve the `@/` tsconfig path alias Vite uses for the
// browser build.
//
// report-runner is imported statically (like the other local api/* imports)
// rather than via a dynamic `await import(...)` — a dynamic import was tried
// first, on the theory that deferring it into the try/catch below would turn
// a module-load crash into a catchable error, but that wasn't the actual
// problem. Confirmed via Vercel's function logs: @vercel/node transpiles
// each file individually and ships them as separate compiled .js files (it
// does not bundle everything into one file), so relative imports are
// resolved by Node's own ESM loader at runtime — and that loader, unlike a
// bundler, requires an explicit file extension. The `.js` extension below
// (on this and every other relative import reachable from this file, e.g. in
// report-runner.ts / aws-sns.ts) is required for that reason, even though
// the real source files are .ts — this is Node ESM's own convention for
// TypeScript projects, not a typo. Omitting it produces
// "Error [ERR_MODULE_NOT_FOUND]: Cannot find module ... imported from
// .../run-schedule-now.js" in production. Nothing at report-runner's module
// top level actually throws (readEnv returns null instead of throwing), so
// there's no crash-on-load risk to defer against with a dynamic import here.

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
