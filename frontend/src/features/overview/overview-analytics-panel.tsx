import { BarList, type BarListItem } from "@/components/charts/bar-list";
import { ChartCard } from "@/components/charts/chart-card";
import { EventDistributionDonut } from "@/components/charts/event-distribution-donut";
import { EventsAreaChart } from "@/components/charts/events-area-chart";
import { SectionHeader } from "@/components/metrics/section-header";
import { formatCount, formatPercent } from "@/lib/formatters/numbers";
import { useI18n } from "@/lib/i18n/use-i18n";
import { SecondaryMetrics } from "@/features/overview/secondary-metrics";
import type { EventTimeSeriesPoint, TimeSeriesGranularity } from "@/lib/overview/timeseries";
import type { OverviewAnalytics } from "@/lib/overview/analytics";

// Recebe só o analytics, não o OverviewResult inteiro: era o único campo
// usado, e depender do objeto completo obrigava quem chama a montar uma
// estrutura de 15 campos para desenhar um painel que lê um.
export function OverviewAnalyticsPanel({
  analytics,
  uniqueMessagesCount,
  timeSeries,
}: {
  analytics: OverviewAnalytics;
  uniqueMessagesCount: number;
  timeSeries: { points: EventTimeSeriesPoint[]; granularity: TimeSeriesGranularity };
}) {
  const t = useI18n();

  const providerItems: BarListItem[] = analytics.topProviders.map((provider) => ({
    key: provider.domain,
    label: provider.domain,
    value: provider.totalCount,
    displayValue: formatCount(provider.totalCount),
    secondary: `${formatPercent((provider.totalCount / Math.max(analytics.totalEventCount, 1)) * 100)} · ${formatPercent(provider.bounceRate)} bounce`,
    tone: provider.bounceRate > 5 ? "danger" : provider.bounceRate >= 2 ? "warning" : "brand",
  }));

  const bounceReasonItems: BarListItem[] = analytics.topBounceReasons.map((reason) => ({
    key: reason.label,
    label: reason.detail,
    value: reason.count,
    displayValue: formatCount(reason.count),
    secondary: formatPercent(reason.percentage),
    tone: "danger",
  }));

  const originItems: BarListItem[] = analytics.originApplications.map((application) => ({
    key: application.name,
    label: application.name,
    value: application.count,
    displayValue: formatCount(application.count),
    tone: "brand",
  }));

  return (
    <div className="space-y-6">
      <SectionHeader title={t.overview.analytics.title} description={t.overview.analytics.description} />

      <ChartCard title={t.overview.analytics.eventsOverTimeTitle} description={t.overview.analytics.eventsOverTimeDescription}>
        <EventsAreaChart
          points={timeSeries.points}
          series={[
            { key: "sent", label: t.overview.analytics.sent, color: "var(--brand)", strokeWidth: 1.5 },
            { key: "delivered", label: t.overview.analytics.delivered, color: "var(--success)", strokeWidth: 2 },
            { key: "bounced", label: t.overview.analytics.bounced, color: "var(--danger)", strokeWidth: 1.5 },
          ]}
        />
      </ChartCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title={t.overview.analytics.eventDistributionTitle}
          description={t.overview.analytics.eventDistributionDescription}
        >
          <EventDistributionDonut items={analytics.eventDistribution} />
        </ChartCard>

        <ChartCard title={t.overview.analytics.summaryTitle} description={t.overview.analytics.summaryDescription}>
          <SecondaryMetrics analytics={analytics} uniqueMessagesCount={uniqueMessagesCount} />
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title={t.overview.analytics.topProvidersTitle} description={t.overview.analytics.topProvidersDescription}>
          <BarList items={providerItems} emptyLabel={t.overview.analytics.noData} total={analytics.totalEventCount} />
        </ChartCard>

        <ChartCard
          title={t.overview.analytics.topBounceReasonsTitle}
          description={t.overview.analytics.topBounceReasonsDescription}
        >
          <BarList items={bounceReasonItems} emptyLabel={t.overview.analytics.noData} total={analytics.bouncedCount} />
        </ChartCard>
      </div>

      <ChartCard
        title={t.overview.analytics.originApplicationsTitle}
        description={t.overview.analytics.originApplicationsDescription}
      >
        <BarList items={originItems} emptyLabel={t.overview.analytics.noData} />
      </ChartCard>
    </div>
  );
}
