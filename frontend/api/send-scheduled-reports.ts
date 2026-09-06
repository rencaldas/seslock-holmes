// Cron target: GitHub Actions (every 15 min, primary) + Vercel `crons` in
// vercel.json (once a day, failsafe). Both hit this same URL with
// CRON_SECRET — safe because runDueSchedules claims each schedule
// optimistically before doing real work. Serves only this deployment's own
// Supabase project. See docs/ARCHITECTURE.md#relatórios-agendados and
// docs/ARCHITECTURE.md#convenções-de-infraestrutura-vercel (relative
// imports + required `.js` extension below).
//
// Required env vars (Vercel Project Settings > Environment Variables):
// SUPABASE_SERVICE_ROLE_KEY, GMAIL_USER, GMAIL_APP_PASSWORD, CRON_SECRET.

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
