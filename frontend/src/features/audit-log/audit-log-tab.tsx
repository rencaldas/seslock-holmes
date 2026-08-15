import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n/use-i18n";
import { useSupabase } from "@/lib/supabase/context";
import { checkAuditLogConfigured, listAuditLog } from "@/lib/audit-log/queries";
import type { AuditActorType, AuditLogEntry } from "@/lib/audit-log/types";

function actionLabel(action: string, actions: Record<string, string>): string {
  const key = action.replace(/[._]([a-z])/g, (_match, letter: string) => letter.toUpperCase());
  return actions[key] ?? action;
}

function actorTypeLabel(actorType: AuditActorType, labels: { user: string; adminToken: string; cron: string }): string {
  if (actorType === "admin_token") return labels.adminToken;
  if (actorType === "cron") return labels.cron;
  return labels.user;
}

function actorTypeTone(actorType: AuditActorType): "default" | "warning" | "muted" {
  if (actorType === "admin_token") return "warning";
  if (actorType === "cron") return "muted";
  return "default";
}

export function AuditLogTab() {
  const t = useI18n();
  const s = t.auditLog;
  const supabase = useSupabase();

  const configuredQuery = useQuery({
    queryKey: ["audit-log-configured", supabase.eventsTable],
    enabled: Boolean(supabase.client),
    queryFn: () => checkAuditLogConfigured(supabase.client!),
  });

  const entriesQuery = useQuery({
    queryKey: ["audit-log", supabase.eventsTable],
    enabled: Boolean(supabase.client) && configuredQuery.data === true,
    queryFn: () => listAuditLog(supabase.client!, { limit: 100 }),
  });

  if (!supabase.client || configuredQuery.isLoading) {
    return <LoadingState />;
  }

  if (configuredQuery.data === false) {
    return <EmptyState title={s.notConfiguredTitle} description={s.notConfiguredDescription} />;
  }

  if (configuredQuery.isError) {
    return (
      <ErrorState
        description={configuredQuery.error instanceof Error ? configuredQuery.error.message : t.common.noAvailableData}
        onRetry={() => configuredQuery.refetch()}
      />
    );
  }

  const entries: AuditLogEntry[] = entriesQuery.data ?? [];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-ink">{s.title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-muted">{s.description}</p>
      </div>

      {entriesQuery.isLoading ? <LoadingState /> : null}

      {entriesQuery.isError ? (
        <ErrorState
          description={entriesQuery.error instanceof Error ? entriesQuery.error.message : t.common.noAvailableData}
          onRetry={() => entriesQuery.refetch()}
        />
      ) : null}

      {!entriesQuery.isLoading && !entriesQuery.isError && !entries.length ? (
        <EmptyState title={s.emptyTitle} description={s.emptyDescription} />
      ) : null}

      {entries.length ? (
        <div className="overflow-x-auto rounded-panel border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{s.timeHeader}</TableHead>
                <TableHead>{s.actorHeader}</TableHead>
                <TableHead>{s.actionHeader}</TableHead>
                <TableHead>{s.resourceHeader}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap text-xs">{new Date(entry.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge tone={actorTypeTone(entry.actorType)}>
                        {actorTypeLabel(entry.actorType, {
                          user: s.actorTypeUser,
                          adminToken: s.actorTypeAdminToken,
                          cron: s.actorTypeCron,
                        })}
                      </Badge>
                      {entry.actorType === "user" ? (
                        <span className="text-xs text-ink-muted">{entry.actorLabel}</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{actionLabel(entry.action, s.actions)}</TableCell>
                  <TableCell className="text-xs text-ink-muted">{entry.resourceType}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </section>
  );
}
