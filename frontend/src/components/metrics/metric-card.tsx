import type { ReactNode } from "react";
import { Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { Sparkline } from "@/components/charts/sparkline";
import { Tooltip } from "@/components/ui/tooltip";
import { useCountUp } from "@/lib/hooks/use-count-up";
import { cn } from "@/lib/utils";

type Tone = "brand" | "success" | "warning" | "danger" | "neutral";

const ICON_TONE_CLASS: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-slate-100 text-ink-muted dark:bg-slate-800",
};

const TREND_TONE_CLASS: Record<"success" | "danger" | "neutral", string> = {
  success: "text-success",
  danger: "text-danger",
  neutral: "text-ink-muted",
};

const TREND_ICON = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

export function MetricCard({
  icon: Icon,
  label,
  value,
  formatValue,
  suffix = "",
  helpText,
  tone = "neutral",
  trend,
  sparklineData,
  highlighted = false,
  tooltip,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  formatValue?: (value: number) => string;
  suffix?: string;
  helpText?: string;
  tone?: Tone;
  trend?: { direction: "up" | "down" | "flat"; label: string; tone: "success" | "danger" | "neutral" };
  sparklineData?: number[];
  highlighted?: boolean;
  tooltip?: ReactNode;
}) {
  const animatedValue = useCountUp(Number.isFinite(value) ? value : 0);
  const display = formatValue ? formatValue(animatedValue) : new Intl.NumberFormat().format(Math.round(animatedValue));
  const TrendIcon = trend ? TREND_ICON[trend.direction] : null;

  return (
    <div
      className={cn(
        "group flex h-full flex-col justify-between gap-4 rounded-card border border-slate-200 bg-white p-5 shadow-card transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-slate-800 dark:bg-slate-900",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full", ICON_TONE_CLASS[tone])}>
            <Icon className="h-4 w-4" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">{label}</span>
        </div>
        {tooltip ? (
          <Tooltip label={tooltip} side="top">
            <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-ink-muted ring-1 ring-inset ring-slate-200 dark:ring-slate-700">
              i
            </span>
          </Tooltip>
        ) : null}
      </div>

      <div>
        <p
          className={cn(
            "font-extrabold tracking-tight text-ink tabular-nums",
            highlighted ? "text-[2rem] leading-none" : "text-2xl leading-none",
          )}
        >
          {display}
          {suffix}
        </p>
        {helpText ? <p className="mt-2 text-xs leading-5 text-ink-muted">{helpText}</p> : null}
      </div>

      {sparklineData && sparklineData.length > 1 ? (
        <Sparkline data={sparklineData} tone={tone === "neutral" ? "brand" : tone} height={32} />
      ) : null}

      {trend ? (
        <div className={cn("flex items-center gap-1.5 text-xs font-semibold", TREND_TONE_CLASS[trend.tone])}>
          {TrendIcon ? <TrendIcon className="h-3.5 w-3.5" /> : null}
          <span>{trend.label}</span>
        </div>
      ) : null}
    </div>
  );
}
