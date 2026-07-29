import { Badge } from "@/components/ui/badge";
import { RadialGauge } from "@/components/ui/radial-gauge";
import { Tooltip } from "@/components/ui/tooltip";
import { formatPercent } from "@/lib/formatters/numbers";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { OverviewAnalytics } from "@/lib/overview/analytics";
import { reputationDescription, reputationLabel, reputationTone } from "@/features/overview/reputation";

export function DomainHealthHero({ analytics }: { analytics: OverviewAnalytics }) {
  const t = useI18n();
  const badgeTone = reputationTone(analytics.reputation.status);
  const gaugeTone = badgeTone === "destructive" ? "danger" : badgeTone;
  const gaugeValue = analytics.deliveryRate ?? 0;

  return (
    <section className="rounded-panel border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <RadialGauge value={gaugeValue} tone={gaugeTone} size={108}>
            <span className="text-2xl font-extrabold tabular-nums text-ink">{formatPercent(analytics.deliveryRate)}</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
              {t.overview.analytics.deliveryRate}
            </span>
          </RadialGauge>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
              {t.overview.analytics.reputationTitle}
            </p>
            <div className="mt-2">
              <Badge tone={badgeTone}>{reputationLabel(t, analytics.reputation.status)}</Badge>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-6 text-ink-muted">
              {reputationDescription(t, analytics.reputation.status)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:w-72">
          <div className="rounded-control bg-slate-50 p-4 dark:bg-slate-800/60">
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
                {t.overview.analytics.bounced}
              </p>
              <Tooltip label={t.overview.analytics.bounceHealthyHint}>
                <span className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-ink-muted ring-1 ring-inset ring-slate-300 dark:ring-slate-600">
                  i
                </span>
              </Tooltip>
            </div>
            <p className="mt-1.5 text-xl font-bold tabular-nums text-ink">{formatPercent(analytics.reputation.bounceRate)}</p>
          </div>
          <div className="rounded-control bg-slate-50 p-4 dark:bg-slate-800/60">
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
                {t.overview.analytics.complaint}
              </p>
              <Tooltip label={t.overview.analytics.complaintHealthyHint}>
                <span className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-ink-muted ring-1 ring-inset ring-slate-300 dark:ring-slate-600">
                  i
                </span>
              </Tooltip>
            </div>
            <p className="mt-1.5 text-xl font-bold tabular-nums text-ink">{formatPercent(analytics.reputation.complaintRate)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
