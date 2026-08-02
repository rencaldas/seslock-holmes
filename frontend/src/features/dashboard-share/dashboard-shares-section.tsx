import { Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { useI18n } from "@/lib/i18n/use-i18n";
import { useSupabase } from "@/lib/supabase/context";
import { listDashboardShares, revokeDashboardShare } from "@/lib/dashboard-shares/queries";
import type { DashboardShare } from "@/lib/dashboard-shares/types";

function describeFilters(share: DashboardShare, allLabel: string) {
  const parts = [`${share.filters.windowDays}d`, share.filters.status === "all" ? allLabel : share.filters.status];
  if (share.filters.subject) parts.push(`"${share.filters.subject}"`);
  if (share.filters.origin) parts.push(share.filters.origin);
  if (share.filters.provider) parts.push(`@${share.filters.provider}`);
  return parts.join(" · ");
}

function shareStatus(share: DashboardShare): "active" | "revoked" | "expired" {
  if (share.revokedAt) return "revoked";
  if (share.expiresAt && new Date(share.expiresAt).getTime() <= Date.now()) return "expired";
  return "active";
}

export function DashboardSharesSection() {
  const t = useI18n();
  const s = t.dashboardShare;
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  const sharesQuery = useQuery({
    queryKey: ["dashboard-shares", supabase.eventsTable],
    enabled: Boolean(supabase.client && supabase.session),
    queryFn: () => listDashboardShares(supabase.client!),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeDashboardShare(supabase.client!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard-shares"] }),
  });

  if (!supabase.client || !supabase.session) {
    return null;
  }

  const tableUnavailable = sharesQuery.isError && (sharesQuery.error as { code?: string })?.code === "42P01";
  const shares = sharesQuery.data ?? [];

  return (
    <Card className="border-slate-200/80 bg-white/90 dark:border-slate-800/80 dark:bg-slate-900/90">
      <CardHeader>
        <CardTitle>{s.managementSectionTitle}</CardTitle>
        <CardDescription>{s.managementSectionDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        {tableUnavailable ? (
          <EmptyState title={s.notConfiguredTitle} description={s.notConfiguredDescription} />
        ) : sharesQuery.isLoading ? (
          <LoadingState />
        ) : sharesQuery.isError ? (
          <ErrorState
            description={sharesQuery.error instanceof Error ? sharesQuery.error.message : t.common.noAvailableData}
            onRetry={() => sharesQuery.refetch()}
          />
        ) : !shares.length ? (
          <EmptyState title={s.emptyTitle} description={s.emptyDescription} />
        ) : (
          <div className="overflow-x-auto rounded-control border border-slate-200 dark:border-slate-800">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{s.labelHeader}</TableHead>
                  <TableHead>{s.filtersHeader}</TableHead>
                  <TableHead>{s.piiHeader}</TableHead>
                  <TableHead>{s.expiresHeader}</TableHead>
                  <TableHead>{s.statusHeader}</TableHead>
                  <TableHead>{s.lastAccessedHeader}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {shares.map((share) => {
                  const status = shareStatus(share);
                  return (
                    <TableRow key={share.id}>
                      <TableCell className="font-semibold">{share.label || "—"}</TableCell>
                      <TableCell className="max-w-xs text-xs text-ink-muted">
                        {describeFilters(share, t.overview.filters.options.all)}
                      </TableCell>
                      <TableCell>
                        <Badge tone={share.includeRecentActivity ? "warning" : "muted"}>
                          {share.includeRecentActivity ? s.piiOn : s.piiOff}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {share.expiresAt ? new Date(share.expiresAt).toLocaleDateString() : s.expiresNever}
                      </TableCell>
                      <TableCell>
                        <Badge tone={status === "active" ? "success" : status === "expired" ? "muted" : "destructive"}>
                          {status === "active" ? s.statusActive : status === "expired" ? s.statusExpired : s.statusRevoked}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {share.lastAccessedAt ? new Date(share.lastAccessedAt).toLocaleString() : s.lastAccessedNever}
                      </TableCell>
                      <TableCell>
                        {status === "active" ? (
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            aria-label={s.revokeButton}
                            title={s.revokeButton}
                            onClick={() => {
                              if (window.confirm(s.confirmRevoke)) {
                                revokeMutation.mutate(share.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-danger" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
