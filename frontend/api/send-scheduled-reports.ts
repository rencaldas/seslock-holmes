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
// On every invocation it processes every `report_schedules` row (across
// every registered project, not just this deployment's own) whose
// `next_run_at` has passed: re-runs the same filtered query the Overview
// page would run, builds the report, emails it via Gmail SMTP, and records
// the run so each project's own app can show it in-page without a browser
// needing to be open.
//
// Multi-tenant: this always processes THIS deployment's own default project
// (env vars below — unchanged from before, so nothing breaks for the owner),
// PLUS every active row in `report_connections` — the registry any visitor
// can add themselves to from the "Scheduled reports" page, pointing at their
// OWN Supabase project and Gmail account (see api/connections.ts). Each
// project's schedules are only ever fetched/updated using that project's own
// service role key, so no two tenants can see or affect each other's data.
//
// Required env vars (Vercel Project Settings > Environment Variables):
// SUPABASE_SERVICE_ROLE_KEY, GMAIL_USER, GMAIL_APP_PASSWORD, CRON_SECRET,
// CONNECTIONS_ENCRYPTION_KEY (needed to decrypt other tenants' credentials).
// Reuses whichever Supabase URL the frontend already has configured
// (VITE_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL) as both its own default
// project AND the hub that stores report_connections.
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
import { decryptSecret } from "../src/lib/scheduled-reports/crypto.js";
import { isBearerTokenValid } from "../src/lib/server/request-auth.js";

interface ConnectionRow {
  id: string;
  supabase_url: string;
  supabase_service_role_key_encrypted: string;
  gmail_user: string;
  gmail_app_password_encrypted: string;
  gmail_from_name: string | null;
}

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

    const hubClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const projects: Array<{ label: string; results: Awaited<ReturnType<typeof runDueSchedules>> | null; error?: string }> = [];

    if (GMAIL_USER && GMAIL_APP_PASSWORD) {
      try {
        const results = await runDueSchedules(hubClient, {
          gmailUser: GMAIL_USER,
          gmailAppPassword: GMAIL_APP_PASSWORD,
          gmailFromName: GMAIL_FROM_NAME,
        });
        projects.push({ label: "default", results });
      } catch (defaultError) {
        const message = defaultError instanceof Error ? defaultError.message : String(defaultError);
        console.error("send-scheduled-reports: default project failed", defaultError);
        projects.push({ label: "default", results: null, error: message });
      }
    }

    const { data: connections, error: connectionsError } = await hubClient
      .from("report_connections")
      .select("*")
      .eq("is_active", true);

    if (connectionsError) {
      console.error("send-scheduled-reports: failed to load report_connections", connectionsError);
    }

    for (const connection of (connections ?? []) as ConnectionRow[]) {
      try {
        const serviceRoleKey = decryptSecret(connection.supabase_service_role_key_encrypted);
        const gmailAppPassword = decryptSecret(connection.gmail_app_password_encrypted);
        const tenantClient = createClient(connection.supabase_url, serviceRoleKey);

        const results = await runDueSchedules(tenantClient, {
          gmailUser: connection.gmail_user,
          gmailAppPassword,
          gmailFromName: connection.gmail_from_name ?? undefined,
        });

        projects.push({ label: connection.id, results });
        await hubClient
          .from("report_connections")
          .update({ last_checked_at: new Date().toISOString(), last_error: null })
          .eq("id", connection.id);
      } catch (connectionError) {
        // A single bad/revoked tenant connection must not stop the loop for
        // everyone else's schedules.
        const message = connectionError instanceof Error ? connectionError.message : String(connectionError);
        console.error(`send-scheduled-reports: connection ${connection.id} failed`, connectionError);
        projects.push({ label: connection.id, results: null, error: message });
        await hubClient
          .from("report_connections")
          .update({ last_checked_at: new Date().toISOString(), last_error: message })
          .eq("id", connection.id);
      }
    }

    const processed = projects.reduce((total, project) => total + (project.results?.length ?? 0), 0);
    response.status(200).json({ processed, projects });
  } catch (unexpectedError) {
    console.error("send-scheduled-reports: unexpected failure", unexpectedError);
    const message = unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError);
    if (!response.headersSent) {
      response.status(500).json({ error: message });
    }
  }
}
