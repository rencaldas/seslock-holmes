import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/formatters/dates";
import { useAppLanguage, useI18n } from "@/lib/i18n/use-i18n";
import { formatRelativeTime, type OverviewAnalytics } from "@/lib/overview/analytics";
import type { OverviewResult } from "@/lib/supabase/types";

function formatCount(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }

  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)}%`;
}

function formatDuration(ms: number | null) {
  if (ms === null || !Number.isFinite(ms) || ms < 0) {
    return "—";
  }

  if (ms < 1000) {
    return `${Math.round(ms)} ms`;
  }

  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes < 60) {
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return `${hours}h ${remainingMinutes}m`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}

function statusTone(status: OverviewAnalytics["reputation"]["status"]) {
  if (status === "healthy") {
    return "success";
  }

  if (status === "attention") {
    return "warning";
  }

  return "destructive";
}

function statusLabel(t: ReturnType<typeof useI18n>, status: OverviewAnalytics["reputation"]["status"]) {
  switch (status) {
    case "healthy":
      return t.overview.analytics.reputationHealthy;
    case "attention":
      return t.overview.analytics.reputationAttention;
    case "critical":
      return t.overview.analytics.reputationCritical;
    default:
      return t.overview.analytics.reputationHealthy;
  }
}

function statusDescription(t: ReturnType<typeof useI18n>, status: OverviewAnalytics["reputation"]["status"]) {
  switch (status) {
    case "healthy":
      return t.overview.analytics.reputationHealthyDescription;
    case "attention":
      return t.overview.analytics.reputationAttentionDescription;
    case "critical":
      return t.overview.analytics.reputationCriticalDescription;
    default:
      return t.overview.analytics.reputationHealthyDescription;
  }
}

function MetricCard({
  title,
  value,
  note,
  tone = "default",
  compact = false,
}: {
  title: string;
  value: string;
  note?: string;
  tone?: "default" | "success" | "warning" | "destructive" | "muted";
  compact?: boolean;
}) {
  const toneClasses =
    tone === "success"
      ? "from-emerald-50 to-white border-emerald-100"
      : tone === "warning"
        ? "from-amber-50 to-white border-amber-100"
        : tone === "destructive"
          ? "from-rose-50 to-white border-rose-100"
          : tone === "muted"
            ? "from-slate-50 to-white border-slate-200"
            : "from-white to-slate-50 border-slate-200";

  return (
    <Card className={`flex h-full flex-col justify-between bg-gradient-to-br ${toneClasses} ${compact ? "min-h-[170px]" : "min-h-[220px]"}`}>
      <CardHeader className={`flex flex-col items-center space-y-2 px-4 py-3 text-center ${compact ? "justify-center" : ""}`}>
        <CardDescription className="text-sm font-medium text-slate-500">{title}</CardDescription>
        <CardTitle className="text-3xl tracking-tight text-slate-950">{value}</CardTitle>
      </CardHeader>
      {note ? (
        <CardContent className="px-4 pb-3 pt-0 text-center text-sm leading-6 text-slate-600">{note}</CardContent>
      ) : null}
    </Card>
  );
}

function SectionCard({
  title,
  description,
  children,
  compact = false,
  centeredContent = false,
  contentClassName = "",
}: {
  title: string;
  description: string;
  children: ReactNode;
  compact?: boolean;
  centeredContent?: boolean;
  contentClassName?: string;
}) {
  return (
    <Card className={`flex h-full flex-col overflow-hidden ${compact ? "min-h-[170px]" : ""}`}>
      <CardHeader className={`flex w-full flex-col px-4 pb-2 pt-4 ${compact ? "items-start justify-start text-left" : "items-start"}`}>
        <CardTitle className={compact ? "text-base font-semibold tracking-tight text-slate-950" : ""}>{title}</CardTitle>
        <CardDescription className={compact ? "text-sm text-slate-500" : ""}>{description}</CardDescription>
      </CardHeader>
      <CardContent
        className={`flex h-full w-full min-w-0 flex-1 flex-col px-4 pb-4 pt-0 ${centeredContent ? "items-center justify-center text-center" : "items-start justify-start text-left"} ${contentClassName}`}
      >
        {children}
      </CardContent>
    </Card>
  );
}

function DistributionBar({
  label,
  count,
  percent,
  tone = "muted",
}: {
  label: string;
  count: number;
  percent: number;
  tone?: "success" | "warning" | "destructive" | "muted";
}) {
  const width = percent > 0 ? Math.max(percent, count > 0 ? 4 : 0) : 0;
  const toneClasses =
    tone === "success"
      ? { fill: "bg-emerald-600", label: "text-emerald-700" }
      : tone === "warning"
        ? { fill: "bg-amber-500", label: "text-amber-700" }
        : tone === "destructive"
          ? { fill: "bg-rose-600", label: "text-rose-700" }
          : { fill: "bg-slate-700", label: "text-slate-700" };

  return (
    <div className={`w-full ${count > 0 ? "pt-1" : "pt-0"}`}>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className={`font-medium ${toneClasses.label}`}>{label}</span>
        <span className="text-slate-500">
          {formatCount(count)} <span className="text-slate-400">({formatPercent(percent)})</span>
        </span>
      </div>
      <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full border border-slate-200 bg-white">
        <div className={`h-full rounded-full transition-all duration-300 ${toneClasses.fill}`} style={{ width: `${width}%` }} />
        <div className="h-full flex-1 bg-white" />
      </div>
    </div>
  );
}

function OverviewDistributionChart({
  analytics,
  t,
}: {
  analytics: OverviewAnalytics;
  t: ReturnType<typeof useI18n>;
}) {
  const total = analytics.eventDistribution.reduce((sum, item) => sum + item.count, 0);

  return (
    <SectionCard
      title={t.overview.analytics.eventDistributionTitle}
      description={t.overview.analytics.eventDistributionDescription}
      centeredContent={false}
    >
      <div className="w-full space-y-4">
        {analytics.eventDistribution.map((item, index) => {
          const percent = total > 0 ? (item.count / total) * 100 : 0;
          const tone =
            item.type === "delivered"
              ? "success"
              : item.type === "bounced" || item.type === "rendering_failure"
                ? "destructive"
                : item.type === "complained" || item.type === "rejected"
                  ? "warning"
                  : "muted";

          return (
            <div key={item.type} className={index === 0 ? "pt-1" : ""}>
              <DistributionBar label={item.label} count={item.count} percent={percent} tone={tone} />
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

export function OverviewAnalyticsPanel({ data }: { data: OverviewResult }) {
  const t = useI18n();
  const language = useAppLanguage();
  const analytics = data.analytics;
  const hasTopProviders = analytics.topProviders.length > 0;
  const hasBounceReasons = analytics.topBounceReasons.length > 0;
  const hasOriginApplications = analytics.originApplications.length > 0;
  const lastEventRelative = formatRelativeTime(analytics.lastEventAt, language);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
          {t.overview.analytics.title}
        </p>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">{t.overview.analytics.description}</p>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr_1.1fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard title={t.overview.analytics.delivered} value={formatCount(analytics.deliveredCount)} tone="success" compact />
          <MetricCard title={t.overview.analytics.deliveryRate} value={formatPercent(analytics.deliveryRate)} tone="success" compact />
          <MetricCard title={t.overview.analytics.bounced} value={formatCount(analytics.bouncedCount)} tone="destructive" compact />
          <MetricCard title={t.overview.analytics.complaint} value={formatCount(analytics.complaintCount)} tone="warning" compact />
          <MetricCard title={t.overview.analytics.rejected} value={formatCount(analytics.rejectedCount)} tone="warning" compact />
          <MetricCard title={t.overview.analytics.delayed} value={formatCount(analytics.delayedCount)} tone="muted" compact />
          <MetricCard
            title={t.overview.analytics.renderingFailure}
            value={formatCount(analytics.renderingFailureCount)}
            tone="destructive"
            compact
          />
          <MetricCard title={t.overview.analytics.sent} value={formatCount(analytics.sentCount)} tone="muted" compact />
        </div>

        <div className="flex flex-col gap-4">
          <MetricCard
            title={t.overview.analytics.totalEvents}
            value={formatCount(data.recentEventsCount)}
            note={t.overview.summary.totalEventsDescription}
          />
          <MetricCard
            title={t.overview.analytics.uniqueMessages}
            value={formatCount(data.uniqueMessagesCount)}
            note={t.overview.summary.uniqueMessagesDescription}
          />
          <MetricCard
            title={t.overview.analytics.uniqueRecipients}
            value={formatCount(data.uniqueRecipientsCount)}
            note={t.overview.analytics.uniqueRecipientsDescription}
          />
        </div>

        <div className="grid gap-4">
          <SectionCard
            title={t.overview.analytics.reputationTitle}
            description={statusDescription(t, analytics.reputation.status)}
            compact
          >
            <div className="flex w-full flex-1 flex-col space-y-4">
              <div className="flex items-center justify-between gap-4">
                <Badge tone={statusTone(analytics.reputation.status)}>{statusLabel(t, analytics.reputation.status)}</Badge>
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">{t.overview.analytics.rate}</span>
              </div>
              <div className="grid w-full gap-3 sm:grid-cols-2">
                <div className="w-full rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{t.overview.analytics.bounced}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {formatPercent(analytics.reputation.bounceRate)}
                  </p>
                </div>
                <div className="w-full rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{t.overview.analytics.complaint}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {formatPercent(analytics.reputation.complaintRate)}
                  </p>
                </div>
              </div>
              <p className="text-sm leading-6 text-slate-600">{analytics.reputation.reason}</p>
            </div>
          </SectionCard>

          <SectionCard
            title={t.overview.analytics.averageDeliveryTime}
            description={t.overview.analytics.averageDeliveryTimeDescription}
            compact
          >
            <div className="flex w-full flex-1 flex-col justify-between space-y-3">
              <p className="text-4xl font-semibold tracking-tight text-slate-950">
                {formatDuration(analytics.averageDeliveryTimeMs)}
              </p>
              <p className="text-sm leading-6 text-slate-600">
                {analytics.averageDeliveryTimeMs === null
                  ? t.overview.analytics.notAvailable
                  : t.overview.analytics.averageDeliveryTimeDescription}
              </p>
            </div>
          </SectionCard>

          <SectionCard
            title={t.overview.analytics.lastEventReceived}
            description={t.overview.analytics.lastEventReceivedDescription}
            compact
          >
            <div className="flex w-full flex-1 flex-col justify-between space-y-3">
              <p className="text-2xl font-semibold tracking-tight text-slate-950">
                {analytics.lastEventAt ? formatDateTime(analytics.lastEventAt) : t.overview.analytics.notAvailable}
              </p>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{t.overview.analytics.relativeTime}</p>
                <p className="text-sm leading-6 text-slate-600">
                  {lastEventRelative ?? t.overview.analytics.notAvailable}
                </p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <OverviewDistributionChart analytics={analytics} t={t} />

        <SectionCard
          title={t.overview.analytics.topProvidersTitle}
          description={t.overview.analytics.topProvidersDescription}
          centeredContent={false}
          contentClassName="px-0"
        >
          {hasTopProviders ? (
            <div className="w-full flex-1 min-w-0 overflow-x-auto">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.overview.analytics.domain}</TableHead>
                    <TableHead className="text-right">{t.overview.analytics.count}</TableHead>
                    <TableHead className="text-right">{t.overview.analytics.rate}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.topProviders.map((provider) => (
                    <TableRow key={provider.domain}>
                      <TableCell className="font-medium text-slate-950">{provider.domain}</TableCell>
                      <TableCell className="text-right">{formatCount(provider.totalCount)}</TableCell>
                      <TableCell className="text-right">
                        <div className="space-y-1">
                          <p className="font-medium text-slate-950">{formatPercent(provider.bounceRate)}</p>
                          <p className="text-xs text-slate-500">
                            {formatCount(provider.deliveredCount)} delivered / {formatCount(provider.bouncedCount)} bounced
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">{t.overview.analytics.noData}</p>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title={t.overview.analytics.topBounceReasonsTitle}
          description={t.overview.analytics.topBounceReasonsDescription}
          contentClassName="px-0"
        >
          {hasBounceReasons ? (
            <div className="w-full min-w-0 overflow-x-auto">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.overview.analytics.count}</TableHead>
                    <TableHead>{t.overview.analytics.share}</TableHead>
                    <TableHead>{t.overview.analytics.reason}</TableHead>
                    <TableHead>{t.overview.analytics.detail}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.topBounceReasons.map((reason) => (
                    <TableRow key={reason.label}>
                      <TableCell className="w-24 font-medium text-slate-950">{formatCount(reason.count)}</TableCell>
                      <TableCell className="w-32">{formatPercent(reason.percentage)}</TableCell>
                      <TableCell className="font-medium text-slate-950">{reason.label}</TableCell>
                      <TableCell className="text-slate-500">{reason.detail}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">{t.overview.analytics.noData}</p>
          )}
        </SectionCard>

        <SectionCard
          title={t.overview.analytics.originApplicationsTitle}
          description={t.overview.analytics.originApplicationsDescription}
          contentClassName="px-0"
        >
          {hasOriginApplications ? (
            <div className="w-full min-w-0 overflow-x-auto">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.overview.analytics.domain}</TableHead>
                    <TableHead className="text-right">{t.overview.analytics.count}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.originApplications.map((application) => (
                    <TableRow key={application.name}>
                      <TableCell className="font-medium text-slate-950">{application.name}</TableCell>
                      <TableCell className="text-right">{formatCount(application.count)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">{t.overview.analytics.noData}</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
