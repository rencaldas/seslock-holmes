import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

const TONE_COLOR: Record<"brand" | "success" | "warning" | "danger", string> = {
  brand: "var(--brand)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

export function Sparkline({
  data,
  tone = "brand",
  height = 40,
}: {
  data: number[];
  tone?: "brand" | "success" | "warning" | "danger";
  height?: number;
}) {
  const gradientId = useId();

  if (data.length < 2) {
    return null;
  }

  const points = data.map((value, index) => ({ index, value }));
  const color = TONE_COLOR[tone];

  return (
    <div style={{ width: "100%", height }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 1, bottom: 1, left: 1 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.75}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
