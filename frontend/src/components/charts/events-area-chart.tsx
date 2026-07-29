import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import type { EventTimeSeriesPoint } from "@/lib/overview/timeseries";

const TICK_STYLE = { fontSize: 11, fill: "var(--ink-muted)" };

export function EventsAreaChart({
  points,
  series,
}: {
  points: EventTimeSeriesPoint[];
  series: Array<{ key: "sent" | "delivered" | "bounced"; label: string; color: string; strokeWidth?: number }>;
}) {
  if (points.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              {series.map((item) => (
                <linearGradient key={item.key} id={`events-area-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={item.color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={item.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={28} />
            <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} width={34} allowDecimals={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--chart-cursor)", strokeWidth: 1 }} />
            {series.map((item) => (
              <Area
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                stroke={item.color}
                strokeWidth={item.strokeWidth ?? 2}
                fill={`url(#events-area-${item.key})`}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "white" }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {series.map((item) => (
          <span key={item.key} className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
