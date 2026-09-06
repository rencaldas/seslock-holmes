// Admin-gated CRUD for `report_schedules` on THIS deployment's own default
// Supabase project only — visitors with their own Supabase talk to it
// directly via supabase-js (see scheduled-reports/queries.ts). Every request
// must carry `Authorization: Bearer <ADMIN_API_TOKEN>`, never shipped in the
// public bundle. See docs/ARCHITECTURE.md#fluxo-de-dados-postgres-como-fonte-da-verdade
// and docs/SECURITY.md#tokens-de-administração-e-cron.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, readEnv } from "../src/lib/scheduled-reports/report-runner.js";
import { isBearerTokenValid } from "../src/lib/server/request-auth.js";
import { recordAuditEventFromServer } from "../src/lib/audit-log/record-server.js";
import { scheduleAuditMetadata } from "../src/lib/scheduled-reports/audit-metadata.js";

const AUDIT_ACTOR = { actorType: "admin_token" as const, actorLabel: "Admin Token" };

const REPORT_SCHEDULES_TABLE = "report_schedules";
const REPORT_SCHEDULE_RUNS_TABLE = "report_schedule_runs";

function isAuthorized(request: VercelRequest): boolean {
  return isBearerTokenValid(request.headers.authorization, readEnv("ADMIN_API_TOKEN"));
}

function defaultProjectClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase não configurado (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY).");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function singleQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

function scheduleInputToRow(input: Record<string, unknown>) {
  return {
    name: input.name,
    events_table: input.eventsTable,
    filters: input.filters,
    recipients: input.recipients,
    frequency: input.frequency,
    timezone: input.timezone,
    is_active: input.isActive,
  };
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    if (!isAuthorized(request)) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    const client = defaultProjectClient();
    const scheduleId = singleQueryValue(request.query.id);
    const historyOf = singleQueryValue(request.query.historyOf);

    if (request.method === "GET" && historyOf) {
      const { data, error } = await client
        .from(REPORT_SCHEDULE_RUNS_TABLE)
        .select("*")
        .eq("schedule_id", historyOf)
        .order("generated_at", { ascending: false })
        .limit(20);

      if (error) {
        response.status(500).json({ error: error.message, code: error.code });
        return;
      }
      response.status(200).json({ runs: data ?? [] });
      return;
    }

    if (request.method === "GET") {
      const { data, error } = await client
        .from(REPORT_SCHEDULES_TABLE)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        response.status(500).json({ error: error.message, code: error.code });
        return;
      }
      response.status(200).json({ schedules: data ?? [] });
      return;
    }

    if (request.method === "POST") {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const { data, error } = await client
        .from(REPORT_SCHEDULES_TABLE)
        .insert(scheduleInputToRow(body))
        .select("*")
        .single();

      if (error) {
        response.status(500).json({ error: error.message });
        return;
      }
      // Aguardado de propósito, ao contrário do equivalente em
      // scheduled-reports/queries.ts (chamado do navegador): esta é uma
      // função serverless — a Vercel pode congelar/reciclar o processo assim
      // que a resposta é enviada, então uma escrita não aguardada iniciada
      // antes de response.json() correria risco real de nunca terminar.
      await recordAuditEventFromServer(client, {
        action: "schedule.created",
        resourceType: "report_schedule",
        resourceId: (data as { id: string }).id,
        ...AUDIT_ACTOR,
        metadata: scheduleAuditMetadata(body),
      });
      response.status(201).json({ schedule: data });
      return;
    }

    if (request.method === "PATCH") {
      if (!scheduleId) {
        response.status(400).json({ error: "id é obrigatório." });
        return;
      }

      const body = (request.body ?? {}) as Record<string, unknown>;
      const isToggleOnly = typeof body.isActive === "boolean" && Object.keys(body).length === 1;
      const patch = isToggleOnly ? { is_active: body.isActive } : scheduleInputToRow(body);

      const { data, error } = await client
        .from(REPORT_SCHEDULES_TABLE)
        .update(patch)
        .eq("id", scheduleId)
        .select("*")
        .single();

      if (error) {
        response.status(500).json({ error: error.message });
        return;
      }
      await recordAuditEventFromServer(client, {
        action: isToggleOnly ? (body.isActive ? "schedule.resumed" : "schedule.paused") : "schedule.updated",
        resourceType: "report_schedule",
        resourceId: scheduleId,
        ...AUDIT_ACTOR,
        metadata: isToggleOnly ? {} : scheduleAuditMetadata(body),
      });
      response.status(200).json({ schedule: data });
      return;
    }

    if (request.method === "DELETE") {
      if (!scheduleId) {
        response.status(400).json({ error: "id é obrigatório." });
        return;
      }

      const { error } = await client.from(REPORT_SCHEDULES_TABLE).delete().eq("id", scheduleId);
      if (error) {
        response.status(500).json({ error: error.message });
        return;
      }
      await recordAuditEventFromServer(client, {
        action: "schedule.deleted",
        resourceType: "report_schedule",
        resourceId: scheduleId,
        ...AUDIT_ACTOR,
      });
      response.status(200).json({ status: "deleted" });
      return;
    }

    response.status(405).json({ error: "Method not allowed" });
  } catch (unexpectedError) {
    console.error("schedules: unexpected failure", unexpectedError);
    const message = unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError);
    if (!response.headersSent) {
      response.status(500).json({ error: message });
    }
  }
}
