// Cron target, invoked two ways:
//  1. .github/workflows/scheduled-reports-trigger.yml — the primary trigger,
//     every 15 minutes, so a schedule's configured time is actually honored
//     close to that time.
//  2. The `crons` entry in ../vercel.json — once a day (Vercel Hobby plan's
//     max frequency), kept as a failsafe in case the GitHub Actions workflow
//     is ever delayed or disabled (GitHub auto-disables scheduled workflows
//     after 60 days with no commits to the repo).
// Both call this same URL with the same CRON_SECRET, and that's safe:
// runDueSchedules claims each due schedule with an optimistic next_run_at
// update before doing any real work, so overlapping invocations can't
// double-send the same report.
//
// On every invocation it processes every `report_schedules` row whose
// `next_run_at` has passed: re-runs the same filtered query the Overview page
// would run, builds the report, emails it via Gmail SMTP, and records the run
// so the app can show it in-page without a browser needing to be open.
//
// Serves a single Supabase project — this deployment's own. It used to also
// loop over `report_connections`, a registry any visitor could add themselves
// to so this shared cron would deliver for THEIR project using THEIR
// credentials. That registry was removed: the endpoint that fed it accepted
// third-party service role keys with no authentication at all, and a single
// shared CONNECTIONS_ENCRYPTION_KEY decrypted every tenant's secrets at once.
// It had zero rows in practice. Visitors wanting automatic delivery for their
// own project deploy their own instance instead.
//
// Required env vars (Vercel Project Settings > Environment Variables):
// SUPABASE_SERVICE_ROLE_KEY, GMAIL_USER, GMAIL_APP_PASSWORD, CRON_SECRET.
// Reuses whichever Supabase URL the frontend already has configured
// (VITE_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL).
//
// Only relative imports are used below because Vercel's Node.js function
// bundler does not resolve the `@/` tsconfig path alias Vite uses for the
// browser build.
//
// report-runner is imported statically (like the other local api/* imports)
// — see the matching comment in run-schedule-now.ts for why a dynamic
// `await import(...)` was tried and reverted, and for why the `.js`
// extension below (required by Node's ESM loader, since @vercel/node ships
// each file separately rather than bundling them into one) is required even
// though the real source file is .ts.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  GMAIL_USER,
  GMAIL_APP_PASSWORD,
  GMAIL_FROM_NAME,
  readEnv,
  runDueSchedules,
} from "../src/lib/scheduled-reports/report-runner.js";
import { isBearerTokenValid } from "../src/lib/server/request-auth.js";

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    if (!isBearerTokenValid(request.headers.authorization, readEnv("CRON_SECRET"))) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      response.status(500).json({ error: "Supabase não configurado (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY)." });
      return;
    }

    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      response.status(500).json({ error: "GMAIL_USER/GMAIL_APP_PASSWORD não configuradas." });
      return;
    }

    const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const results = await runDueSchedules(client, {
      gmailUser: GMAIL_USER,
      gmailAppPassword: GMAIL_APP_PASSWORD,
      gmailFromName: GMAIL_FROM_NAME,
    });

    response.status(200).json({ processed: results.length, results });
  } catch (unexpectedError) {
    console.error("send-scheduled-reports: unexpected failure", unexpectedError);
    const message = unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError);
    if (!response.headersSent) {
      response.status(500).json({ error: message });
    }
  }
}
