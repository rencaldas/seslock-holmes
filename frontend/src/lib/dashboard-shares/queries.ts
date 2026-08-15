// CRUD de dashboard_shares — sempre via supabase-js direto com o client
// autenticado do navegador, no projeto padrão OU num projeto próprio
// (Configurações). Ao contrário de report_schedules, essa tabela nunca
// permitiu escrita do papel anon em nenhum dos dois casos (ver a migration
// 20260802120000), então não existe o desvio via /api com ADMIN_API_TOKEN
// que scheduled-reports precisa para o projeto padrão.

import type { SupabaseClient } from "@supabase/supabase-js";
import { DASHBOARD_SHARES_TABLE, type CreateDashboardShareInput, type DashboardShare } from "@/lib/dashboard-shares/types";
import { hashShareToken } from "@/lib/dashboard-shares/token";
import { recordAuditEvent } from "@/lib/audit-log/queries";

const SHARE_COLUMNS =
  "id, label, events_table, filters, include_recent_activity, created_at, expires_at, revoked_at, last_accessed_at";

interface ShareRow {
  id: string;
  label: string | null;
  events_table: string;
  filters: DashboardShare["filters"];
  include_recent_activity: boolean;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_accessed_at: string | null;
}

function rowToShare(row: ShareRow): DashboardShare {
  return {
    id: row.id,
    label: row.label,
    eventsTable: row.events_table,
    filters: row.filters,
    includeRecentActivity: row.include_recent_activity,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    lastAccessedAt: row.last_accessed_at,
  };
}

// Código do PostgREST para "relação não existe" — a migration
// 20260802120000 ainda não foi aplicada no projeto em uso.
const UNDEFINED_TABLE_ERROR_CODE = "42P01";

export async function checkDashboardSharesConfigured(client: SupabaseClient): Promise<boolean> {
  const { error } = await client.from(DASHBOARD_SHARES_TABLE).select("id").limit(1);
  if (error) {
    if (error.code === UNDEFINED_TABLE_ERROR_CODE) {
      return false;
    }
    throw error;
  }
  return true;
}

export async function listDashboardShares(client: SupabaseClient): Promise<DashboardShare[]> {
  const { data, error } = await client
    .from(DASHBOARD_SHARES_TABLE)
    .select(SHARE_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as ShareRow[]).map(rowToShare);
}

export async function createDashboardShare(
  client: SupabaseClient,
  input: CreateDashboardShareInput,
): Promise<DashboardShare> {
  const tokenHash = await hashShareToken(input.token);

  const { data, error } = await client
    .from(DASHBOARD_SHARES_TABLE)
    .insert({
      token_hash: tokenHash,
      label: input.label || null,
      events_table: input.eventsTable,
      filters: input.filters,
      include_recent_activity: input.includeRecentActivity,
      expires_at: input.expiresAt,
    })
    .select(SHARE_COLUMNS)
    .single();

  if (error) throw error;
  const share = rowToShare(data as ShareRow);
  // Não aguardado de propósito — mesmo motivo do comentário equivalente em
  // scheduled-reports/queries.ts: chamado do navegador, sem risco de a
  // função congelar antes da escrita terminar, e recordAuditEvent já trata
  // os próprios erros internamente.
  void recordAuditEvent(client, {
    action: "share.created",
    resourceType: "dashboard_share",
    resourceId: share.id,
    metadata: { label: share.label, includeRecentActivity: share.includeRecentActivity },
  });
  return share;
}

export async function revokeDashboardShare(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client
    .from(DASHBOARD_SHARES_TABLE)
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
  void recordAuditEvent(client, { action: "share.revoked", resourceType: "dashboard_share", resourceId: id });
}

// Não existe forma de recuperar o texto puro de um link já criado — só o
// hash é armazenado (ver token.ts). "Perdi o link" na prática só tem uma
// saída: gerar um token novo para a mesma linha (mesmo label/filtros), o que
// invalida o link antigo de propósito — quem ainda tiver a URL perdida
// também perde o acesso, exatamente como um "esqueci minha senha".
export async function regenerateDashboardShareToken(client: SupabaseClient, id: string, token: string): Promise<void> {
  const tokenHash = await hashShareToken(token);

  const { error } = await client.from(DASHBOARD_SHARES_TABLE).update({ token_hash: tokenHash }).eq("id", id);

  if (error) throw error;
  void recordAuditEvent(client, { action: "share.link_regenerated", resourceType: "dashboard_share", resourceId: id });
}
