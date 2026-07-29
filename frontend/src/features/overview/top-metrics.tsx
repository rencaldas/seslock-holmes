import { AlertTriangle, CheckCircle2, Gauge, MailWarning } from "lucide-react";
import { MetricCard } from "@/components/metrics/metric-card";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { OverviewAnalytics } from "@/lib/overview/analytics";
import { extractSeries, pickTrendDirection, type EventTimeSeriesPoint } from "@/lib/overview/timeseries";

function trendTone(direction: "up" | "down" | "flat", goodDirection: "up" | "down") {
  if (direction === "flat") {
    return "neutral" as const;
  }
  return direction === goodDirection ? ("success" as const) : ("danger" as const);
}

export function TopMetrics({
  analytics,
  timeSeries,
}: {
  analytics: OverviewAnalytics;
  timeSeries: EventTimeSeriesPoint[];
}) {
  const t = useI18n();

  const deliveredTrendDirection = pickTrendDirection(timeSeries, (point) => point.delivered);
  const bounceTrendDirection = pickTrendDirection(timeSeries, (point) => point.bounced);
  const complaintTrendDirection = pickTrendDirection(timeSeries, (point) => point.complained);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        icon={CheckCircle2}
        label={t.overview.analytics.delivered}
        value={analytics.deliveredCount}
        tone="success"
        highlighted
        sparklineData={extractSeries(timeSeries, (point) => point.delivered)}
        trend={{
          direction: deliveredTrendDirection,
          tone: trendTone(deliveredTrendDirection, "up"),
          label: t.overview.analytics.trendVsPrevious,
        }}
      />
      <MetricCard
        icon={Gauge}
        label={t.overview.analytics.deliveryRate}
        value={analytics.deliveryRate ?? 0}
        formatValue={(value) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)}
        suffix="%"
        tone="brand"
        highlighted
      />
      <MetricCard
        icon={AlertTriangle}
        label={t.overview.analytics.bounced}
        value={analytics.bouncedCount}
        tone={analytics.bouncedCount > 0 ? "danger" : "neutral"}
        highlighted
        sparklineData={extractSeries(timeSeries, (point) => point.bounced)}
        trend={{
          direction: bounceTrendDirection,
          tone: trendTone(bounceTrendDirection, "down"),
          label: t.overview.analytics.trendVsPrevious,
        }}
      />
      <MetricCard
        icon={MailWarning}
        label={t.overview.analytics.complaint}
        value={analytics.complaintCount}
        tone={analytics.complaintCount > 0 ? "warning" : "neutral"}
        highlighted
        sparklineData={extractSeries(timeSeries, (point) => point.complained)}
        trend={{
          direction: complaintTrendDirection,
          tone: trendTone(complaintTrendDirection, "down"),
          label: t.overview.analytics.trendVsPrevious,
        }}
      />
    </div>
  );
}
