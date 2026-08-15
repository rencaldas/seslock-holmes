export const AUDIT_LOG_TABLE = "audit_log";

export type AuditActorType = "user" | "admin_token" | "cron";

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorLabel: string;
  actorType: AuditActorType;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
