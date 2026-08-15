// Escrita de audit_log para os dois caminhos que já rodam com o client de
// service role (portanto já ignoram RLS): frontend/api/schedules.ts,
// frontend/api/run-schedule-now.ts e report-runner.ts (cron). Insert direto
// na tabela em vez de passar pela RPC record_audit_event — esta não é a
// sessão de um usuário logado, então auth.uid() não resolveria nada útil
// aqui; o ator já é conhecido de antemão (admin_token ou cron).
//
// Sempre non-fatal: uma falha ao gravar auditoria (ex.: projeto self-hosted
// que ainda não rodou a migration 20260814100000) nunca pode derrubar a ação
// real (criar um agendamento, enviar um relatório) que já foi bem-sucedida.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ServerAuditEvent {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  actorType: "admin_token" | "cron";
  actorLabel: string;
  metadata?: Record<string, unknown>;
}

export async function recordAuditEventFromServer(client: SupabaseClient, event: ServerAuditEvent): Promise<void> {
  try {
    const { error } = await client.from("audit_log").insert({
      actor_id: null,
      actor_label: event.actorLabel,
      actor_type: event.actorType,
      action: event.action,
      resource_type: event.resourceType,
      resource_id: event.resourceId ?? null,
      metadata: event.metadata ?? {},
    });
    if (error) throw error;
  } catch (recordError) {
    console.error("recordAuditEventFromServer: failed to write audit log", recordError);
  }
}
