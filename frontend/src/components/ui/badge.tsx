import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "default" | "success" | "warning" | "destructive" | "muted";
}

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "warning"
        ? "bg-amber-100 text-amber-900"
        : tone === "destructive"
          ? "bg-rose-100 text-rose-800"
          : tone === "muted"
            ? "bg-slate-100 text-slate-600"
            : "bg-slate-900 text-white";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        toneClass,
        className,
      )}
      {...props}
    />
  );
}
