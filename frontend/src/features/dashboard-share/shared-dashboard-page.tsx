import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { DomainHealthHero } from "@/features/overview/domain-health-hero";
import { TopMetrics } from "@/features/overview/top-metrics";
import { OverviewAnalyticsPanel } from "@/features/overview/overview-analytics-panel";
import { formatDateTime } from "@/lib/formatters/dates";
import { formatEventType, toneForEventType } from "@/lib/formatters/email";
import { getOriginLabel } from "@/lib/formatters/event";
import { useAppLanguage, useI18n } from "@/lib/i18n/use-i18n";
import { parseShareLinkParams } from "@/lib/dashboard-shares/link";
import { fetchSharedDashboard, SharedDashboardError } from "@/lib/supabase/queries/shared-dashboard";

export function SharedDashboardPage() {
  const t = useI18n();
  const s = t.dashboardShare.publicPage;
  const language = useAppLanguage();
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const linkParams = parseShareLinkParams(searchParams);

  const query = useQuery({
    queryKey: ["shared-dashboard", token, linkParams?.supabaseUrl, linkParams?.eventsTable, language],
    enabled: Boolean(token && linkParams),
    queryFn: () => fetchSharedDashboard(linkParams!.supabaseUrl, linkParams!.supabaseAnonKey, token!, language),
    retry: false,
  });

  if (!token || !linkParams) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <ErrorState title={s.invalidLinkTitle} description={s.invalidLinkDescription} />
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <LoadingState title={s.loadingTitle} />
      </div>
    );
  }

  if (query.isError) {
    const reason = query.error instanceof SharedDashboardError ? query.error.reason : "not_found";
    const copy =
      reason === "revoked"
        ? { title: s.revokedTitle, description: s.revokedDescription }
        : reason === "expired"
          ? { title: s.expiredTitle, description: s.expiredDescription }
          : { title: s.notFoundTitle, description: s.notFoundDescription };

    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <ErrorState title={copy.title} description={copy.description} />
      </div>
    );
  }

  const data = query.data!;

  return (
    <div className="min-h-screen bg-paper">
      <div className="sticky top-0 z-20 flex items-center justify-center gap-2 bg-ink px-4 py-2.5 text-center text-xs font-semibold text-white">
        <Lock className="h-3.5 w-3.5" />
        {s.banner}
        {data.label ? <span className="font-normal text-white/70">· {data.label}</span> : null}
      </div>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-10">
        <DomainHealthHero analytics={data.analytics} />
        <TopMetrics analytics={data.analytics} timeSeries={data.timeSeries.points} />
        <OverviewAnalyticsPanel
          analytics={data.analytics}
          uniqueMessagesCount={data.uniqueMessagesCount}
          timeSeries={data.timeSeries}
        />

        {data.recentEvents ? (
          <Card>
            <CardHeader>
              <CardTitle>{s.recentActivityTitle}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.overview.tableHour}</TableHead>
                      <TableHead>{t.overview.tableResult}</TableHead>
                      <TableHead>{t.overview.tableSubject}</TableHead>
                      <TableHead>{t.overview.tableRecipient}</TableHead>
                      <TableHead>{t.overview.tableOrigin}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentEvents.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="whitespace-nowrap">{formatDateTime(event.occurredAt)}</TableCell>
                        <TableCell>
                          <Badge tone={toneForEventType(event.eventType)}>{formatEventType(event.eventType)}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {event.subject || t.common.noAvailableData}
                        </TableCell>
                        <TableCell className="break-all">{event.recipientEmail}</TableCell>
                        <TableCell>{getOriginLabel(event)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
