import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONE_STROKE: Record<"brand" | "success" | "warning" | "danger", string> = {
  brand: "stroke-brand",
  success: "stroke-success",
  warning: "stroke-warning",
  danger: "stroke-danger",
};

export function RadialGauge({
  value,
  size = 104,
  strokeWidth = 10,
  tone = "brand",
  children,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  tone?: "brand" | "success" | "warning" | "danger";
  children?: ReactNode;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} className="fill-none stroke-slate-100 dark:stroke-slate-800" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("fill-none transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none", TONE_STROKE[tone])}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
