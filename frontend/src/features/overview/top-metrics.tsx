import { AlertTriangle, CheckCircle2, Gauge, MailWarning } from "lucide-react";
import { MetricCard } from "@/components/metrics/metric-card";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { OverviewAnalytics } from "@/lib/overview/analytics";
import { computeDelta, type MetricDelta } from "@/lib/overview/comparison";
import { extractSeries, pickTrendDirection, type EventTimeSeriesPoint } from "@/lib/overview/timeseries";

function trendTone(direction: "up" | "down" | "flat", goodDirection: "up" | "down") {
  if (direction === "flat") {
    return "neutral" as const;
  }
  return direction === goodDirection ? ("success" as const) : ("danger" as const);
}

function deliveryRateForPoint(point: EventTimeSeriesPoint) {
  if (point.sent > 0) {
    return (point.delivered / point.sent) * 100;
  }
  return point.total > 0 ? (point.delivered / point.total) * 100 : 0;
}

function formatDeltaLabel(delta: MetricDelta, comparisonLabel: string): string {
  if (delta.percent === null) {
    return comparisonLabel;
  }
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(delta.percent);
  return `${formatted}% ${comparisonLabel}`;
}

// Um card usa a comparação real (delta) quando o toggle está ligado e os
// dados já chegaram; caso contrário cai de volta na heurística de metade da
// janela atual (pickTrendDirection) — mesmo formato de retorno nos dois
// casos, só a fonte do direction/label muda.
function buildTrend(
  delta: MetricDelta | null,
  fallbackDirection: "up" | "down" | "flat",
  goodDirection: "up" | "down",
  priorPeriodLabel: string,
  currentWindowLabel: string,
) {
  if (delta) {
    return {
      direction: delta.direction,
      tone: trendTone(delta.direction, goodDirection),
      label: formatDeltaLabel(delta, priorPeriodLabel),
    };
  }
  return {
    direction: fallbackDirection,
    tone: trendTone(fallbackDirection, goodDirection),
    label: currentWindowLabel,
  };
}

export function TopMetrics({
  analytics,
  timeSeries,
  comparison,
}: {
  analytics: OverviewAnalytics;
  timeSeries: EventTimeSeriesPoint[];
  // Quando presente (toggle "Comparar com período anterior" ligado), o
  // rótulo/direção de tendência de cada card passa a refletir uma
  // comparação real com o período anterior, em vez de só a metade final vs.
  // inicial da própria janela atual (pickTrendDirection).
  comparison?: OverviewAnalytics | null;
}) {
  const t = useI18n();

  const deliveredTrendDirection = pickTrendDirection(timeSeries, (point) => point.delivered);
  const deliveryRateTrendDirection = pickTrendDirection(timeSeries, deliveryRateForPoint);
  const bounceTrendDirection = pickTrendDirection(timeSeries, (point) => point.bounced);
  const complaintTrendDirection = pickTrendDirection(timeSeries, (point) => point.complained);

  const deliveredDelta = comparison ? computeDelta(analytics.deliveredCount, comparison.deliveredCount) : null;
  const deliveryRateDelta = comparison
    ? computeDelta(analytics.deliveryRate ?? 0, comparison.deliveryRate ?? 0)
    : null;
  const bounceDelta = comparison ? computeDelta(analytics.bouncedCount, comparison.bouncedCount) : null;
  const complaintDelta = comparison ? computeDelta(analytics.complaintCount, comparison.complaintCount) : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        icon={CheckCircle2}
        label={t.overview.analytics.delivered}
        value={analytics.deliveredCount}
        tone="success"
        highlighted
        sparklineData={extractSeries(timeSeries, (point) => point.delivered)}
        trend={buildTrend(
          deliveredDelta,
          deliveredTrendDirection,
          "up",
          t.overview.analytics.trendVsPriorPeriod,
          t.overview.analytics.trendVsPrevious,
        )}
      />
      <MetricCard
        icon={Gauge}
        label={t.overview.analytics.deliveryRate}
        value={analytics.deliveryRate ?? 0}
        formatValue={(value) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)}
        suffix="%"
        tone="brand"
        highlighted
        sparklineData={extractSeries(timeSeries, deliveryRateForPoint)}
        trend={buildTrend(
          deliveryRateDelta,
          deliveryRateTrendDirection,
          "up",
          t.overview.analytics.trendVsPriorPeriod,
          t.overview.analytics.trendVsPrevious,
        )}
      />
      <MetricCard
        icon={AlertTriangle}
        label={t.overview.analytics.bounced}
        value={analytics.bouncedCount}
        tone={analytics.bouncedCount > 0 ? "danger" : "neutral"}
        highlighted
        sparklineData={extractSeries(timeSeries, (point) => point.bounced)}
        trend={buildTrend(
          bounceDelta,
          bounceTrendDirection,
          "down",
          t.overview.analytics.trendVsPriorPeriod,
          t.overview.analytics.trendVsPrevious,
        )}
      />
      <MetricCard
        icon={MailWarning}
        label={t.overview.analytics.complaint}
        value={analytics.complaintCount}
        tone={analytics.complaintCount > 0 ? "warning" : "neutral"}
        highlighted
        sparklineData={extractSeries(timeSeries, (point) => point.complained)}
        trend={buildTrend(
          complaintDelta,
          complaintTrendDirection,
          "down",
          t.overview.analytics.trendVsPriorPeriod,
          t.overview.analytics.trendVsPrevious,
        )}
      />
    </div>
  );
}
