import type { SupabaseClient } from "@supabase/supabase-js";
import { AUDIT_LOG_TABLE, type AuditActorType, type AuditLogEntry } from "@/lib/audit-log/types";

const AUDIT_LOG_COLUMNS = "id, actor_id, actor_label, actor_type, action, resource_type, resource_id, metadata, created_at";

interface AuditLogRow {
  id: string;
  actor_id: string | null;
  actor_label: string;
  actor_type: AuditActorType;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

function rowToEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorLabel: row.actor_label,
    actorType: row.actor_type,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

// 42P01 = undefined_table — ver docs/ARCHITECTURE.md#referência-códigos-de-erro-do-postgrestpostgresql.
const UNDEFINED_TABLE_ERROR_CODE = "42P01";

export async function checkAuditLogConfigured(client: SupabaseClient): Promise<boolean> {
  const { error } = await client.from(AUDIT_LOG_TABLE).select("id").limit(1);
  if (error) {
    if (error.code === UNDEFINED_TABLE_ERROR_CODE) {
      return false;
    }
    throw error;
  }
  return true;
}

// Non-fatal de propósito — ver docs/SECURITY.md#log-de-auditoria-e-origem-do-ator.
export async function recordAuditEvent(
  client: SupabaseClient,
  event: { action: string; resourceType: string; resourceId?: string; metadata?: Record<string, unknown> },
): Promise<void> {
  try {
    const { error } = await client.rpc("record_audit_event", {
      p_action: event.action,
      p_resource_type: event.resourceType,
      p_resource_id: event.resourceId ?? null,
      p_metadata: event.metadata ?? {},
    });
    if (error) throw error;
  } catch (recordError) {
    console.error("recordAuditEvent: failed to write audit log", recordError);
  }
}

export async function listAuditLog(client: SupabaseClient, options: { limit?: number } = {}): Promise<AuditLogEntry[]> {
  const { data, error } = await client
    .from(AUDIT_LOG_TABLE)
    .select(AUDIT_LOG_COLUMNS)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(options.limit ?? 100);

  if (error) throw error;
  return ((data ?? []) as AuditLogRow[]).map(rowToEntry);
}
