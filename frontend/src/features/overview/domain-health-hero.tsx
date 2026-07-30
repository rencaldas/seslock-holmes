import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RadialGauge } from "@/components/ui/radial-gauge";
import { Tooltip } from "@/components/ui/tooltip";
import { formatPercent } from "@/lib/formatters/numbers";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { OverviewAnalytics } from "@/lib/overview/analytics";
import {
  bounceRateTone,
  complaintRateTone,
  reputationDescription,
  reputationLabel,
  reputationTone,
} from "@/features/overview/reputation";
import { cn } from "@/lib/utils";

const STAT_BOX_TONE_CLASS: Record<"success" | "warning" | "destructive", string> = {
  success: "bg-slate-50 dark:bg-slate-800/60",
  warning: "bg-warning-soft ring-1 ring-inset ring-warning/25",
  destructive: "bg-danger-soft ring-1 ring-inset ring-danger/30",
};

const STAT_VALUE_TONE_CLASS: Record<"success" | "warning" | "destructive", string> = {
  success: "text-ink",
  warning: "text-warning",
  destructive: "text-danger",
};

const STAT_ICON_TONE_CLASS: Record<"warning" | "destructive", string> = {
  warning: "text-warning",
  destructive: "text-danger",
};

export function DomainHealthHero({ analytics }: { analytics: OverviewAnalytics }) {
  const t = useI18n();
  const badgeTone = reputationTone(analytics.reputation.status);
  const gaugeTone = badgeTone === "destructive" ? "danger" : badgeTone;
  const gaugeValue = analytics.deliveryRate ?? 0;
  const bounceTone = bounceRateTone(analytics.reputation.bounceRate);
  const complaintTone = complaintRateTone(analytics.reputation.complaintRate);

  return (
    <section className="rounded-panel border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <div className="flex flex-col items-center gap-2">
            <RadialGauge value={gaugeValue} tone={gaugeTone} size={108}>
              <span className="text-2xl font-extrabold leading-none tabular-nums text-ink">{formatPercent(analytics.deliveryRate)}</span>
            </RadialGauge>
            <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
              {t.overview.analytics.deliveryRate}
            </span>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-muted">
                {t.overview.analytics.reputationTitle}
              </p>
              <Badge tone={badgeTone} className="px-4 py-1.5 text-sm">
                {reputationLabel(t, analytics.reputation.status)}
              </Badge>
            </div>
            <p className="mt-3 max-w-md text-base leading-7 text-ink-muted">
              {reputationDescription(t, analytics.reputation.status)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:w-80">
          <div className={cn("rounded-control p-5 transition-colors duration-200", STAT_BOX_TONE_CLASS[bounceTone])}>
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
                  {t.overview.analytics.bounced}
                </p>
                <Tooltip label={t.overview.analytics.bounceHealthyHint}>
                  <span className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-ink-muted ring-1 ring-inset ring-slate-300 dark:ring-slate-600">
                    i
                  </span>
                </Tooltip>
              </div>
              {bounceTone !== "success" ? (
                <AlertTriangle aria-hidden="true" className={cn("h-4 w-4", STAT_ICON_TONE_CLASS[bounceTone])} />
              ) : null}
            </div>
            <p className={cn("mt-2 text-3xl font-bold tabular-nums", STAT_VALUE_TONE_CLASS[bounceTone])}>
              {formatPercent(analytics.reputation.bounceRate)}
            </p>
          </div>
          <div className={cn("rounded-control p-5 transition-colors duration-200", STAT_BOX_TONE_CLASS[complaintTone])}>
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
                  {t.overview.analytics.complaint}
                </p>
                <Tooltip label={t.overview.analytics.complaintHealthyHint}>
                  <span className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-ink-muted ring-1 ring-inset ring-slate-300 dark:ring-slate-600">
                    i
                  </span>
                </Tooltip>
              </div>
              {complaintTone !== "success" ? (
                <AlertTriangle aria-hidden="true" className={cn("h-4 w-4", STAT_ICON_TONE_CLASS[complaintTone])} />
              ) : null}
            </div>
            <p className={cn("mt-2 text-3xl font-bold tabular-nums", STAT_VALUE_TONE_CLASS[complaintTone])}>
              {formatPercent(analytics.reputation.complaintRate)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
