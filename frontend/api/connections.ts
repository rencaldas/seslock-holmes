// Manages rows in `report_connections` — the hub table (in THIS deployment's
// own Supabase project) that lets any visitor register their OWN external
// Supabase project + Gmail account so the shared Vercel Cron
// (send-scheduled-reports.ts) also delivers automatically for them, without
// this project's owner ever seeing that project's data or credentials in
// plaintext (see supabase/migrations/20260730130000_report_connections.sql
// and src/lib/scheduled-reports/crypto.ts).
//
// POST creates a connection and returns { connectionId, token } — the token
// is the only credential a caller has to prove they own this connection
// later (there's no login), and it is NEVER retrievable again: only its
// SHA-256 hash is stored. The browser must save it (localStorage) itself.
//
// GET/DELETE require ?connectionId=&token= and only succeed if the token's
// hash matches what was stored at creation time.
//
// Only relative imports (with explicit .js extensions) are used below —
// see the matching comment in report-runner.ts for why.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { encryptSecret, generateToken, hashToken, tokensMatch } from "../src/lib/scheduled-reports/crypto.js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../src/lib/scheduled-reports/report-runner.js";

function hubClient(): SupabaseClient {
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

function validateHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:") return null;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

async function findConnectionByToken(client: SupabaseClient, connectionId: string, token: string) {
  const { data, error } = await client
    .from("report_connections")
    .select("id, label, token_hash, is_active, last_checked_at, last_error")
    .eq("id", connectionId)
    .maybeSingle();

  if (error) throw error;
  if (!data || !tokensMatch(data.token_hash, hashToken(token))) {
    return null;
  }
  return data;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    if (request.method === "POST") {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const supabaseUrl = validateHttpsUrl(body.supabaseUrl);
      const supabaseServiceRoleKey = typeof body.supabaseServiceRoleKey === "string" ? body.supabaseServiceRoleKey.trim() : "";
      const gmailUser = typeof body.gmailUser === "string" ? body.gmailUser.trim() : "";
      const gmailAppPassword = typeof body.gmailAppPassword === "string" ? body.gmailAppPassword.trim() : "";
      const gmailFromName = typeof body.gmailFromName === "string" ? body.gmailFromName.trim() : "";
      const label = typeof body.label === "string" ? body.label.trim() : "";

      if (!supabaseUrl) {
        response.status(400).json({ error: "supabaseUrl inválida (precisa ser uma URL https)." });
        return;
      }
      if (!supabaseServiceRoleKey || !gmailUser || !gmailAppPassword) {
        response.status(400).json({ error: "supabaseServiceRoleKey, gmailUser e gmailAppPassword são obrigatórios." });
        return;
      }

      const token = generateToken();
      const client = hubClient();
      const { data, error } = await client
        .from("report_connections")
        .insert({
          label: label || null,
          token_hash: hashToken(token),
          supabase_url: supabaseUrl,
          supabase_service_role_key_encrypted: encryptSecret(supabaseServiceRoleKey),
          gmail_user: gmailUser,
          gmail_app_password_encrypted: encryptSecret(gmailAppPassword),
          gmail_from_name: gmailFromName || null,
        })
        .select("id")
        .single();

      if (error) {
        response.status(500).json({ error: error.message });
        return;
      }

      response.status(201).json({ connectionId: (data as { id: string }).id, token });
      return;
    }

    if (request.method === "GET" || request.method === "DELETE") {
      const connectionId = singleQueryValue(request.query.connectionId);
      const token = singleQueryValue(request.query.token);

      if (!connectionId || !token) {
        response.status(400).json({ error: "connectionId e token são obrigatórios." });
        return;
      }

      const client = hubClient();
      const connection = await findConnectionByToken(client, connectionId, token);

      if (!connection) {
        response.status(404).json({ error: "Conexão não encontrada." });
        return;
      }

      if (request.method === "DELETE") {
        const { error: deleteError } = await client.from("report_connections").delete().eq("id", connectionId);
        if (deleteError) {
          response.status(500).json({ error: deleteError.message });
          return;
        }
        response.status(200).json({ status: "deleted" });
        return;
      }

      response.status(200).json({
        connectionId: connection.id,
        label: connection.label,
        isActive: connection.is_active,
        lastCheckedAt: connection.last_checked_at,
        lastError: connection.last_error,
      });
      return;
    }

    response.status(405).json({ error: "Method not allowed" });
  } catch (unexpectedError) {
    console.error("connections: unexpected failure", unexpectedError);
    const message = unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError);
    if (!response.headersSent) {
      response.status(500).json({ error: message });
    }
  }
}
