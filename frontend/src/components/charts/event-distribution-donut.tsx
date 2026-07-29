import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { formatCount, formatPercent } from "@/lib/formatters/numbers";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { OverviewEventDistribution } from "@/lib/overview/analytics";

const TONE_COLOR: Record<"success" | "danger" | "warning" | "muted", string> = {
  success: "var(--success)",
  danger: "var(--danger)",
  warning: "var(--warning)",
  muted: "#CBD5E1",
};

function toneForType(type: OverviewEventDistribution["type"]): keyof typeof TONE_COLOR {
  if (type === "delivered") {
    return "success";
  }
  if (type === "bounced" || type === "rendering_failure") {
    return "danger";
  }
  if (type === "complained" || type === "rejected") {
    return "warning";
  }
  return "muted";
}

export function EventDistributionDonut({ items }: { items: OverviewEventDistribution[] }) {
  const t = useI18n();
  const visible = items.filter((item) => item.count > 0);
  const total = items.reduce((sum, item) => sum + item.count, 0);

  if (visible.length === 0) {
    return <p className="text-sm text-ink-muted">{t.overview.analytics.noData}</p>;
  }

  const chartData = visible.map((item) => ({
    name: item.label,
    value: item.count,
    fill: TONE_COLOR[toneForType(item.type)],
  }));

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      <div className="relative mx-auto h-48 w-48 shrink-0 sm:mx-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={chartData.length > 1 ? 2 : 0}
              stroke="none"
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold tabular-nums text-ink">{formatCount(total)}</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
            {t.overview.analytics.total}
          </span>
        </div>
      </div>

      <ul className="flex-1 space-y-2.5">
        {visible.map((item) => {
          const percent = total > 0 ? (item.count / total) * 100 : 0;
          return (
            <li key={item.type} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 font-medium text-ink">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TONE_COLOR[toneForType(item.type)] }} />
                {item.label}
              </span>
              <span className="shrink-0 tabular-nums text-ink-muted">
                {formatCount(item.count)} <span className="text-slate-400 dark:text-slate-500">({formatPercent(percent)})</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
