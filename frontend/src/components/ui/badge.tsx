import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "default" | "success" | "warning" | "destructive" | "muted";
}

export function Badge({ className, tone = "default", children, ...props }: BadgeProps) {
  const toneClass =
    tone === "success"
      ? "bg-success-soft text-success"
      : tone === "warning"
        ? "bg-warning-soft text-warning"
        : tone === "destructive"
          ? "bg-danger-soft text-danger"
          : tone === "muted"
            ? "bg-slate-100 text-ink-muted dark:bg-slate-800"
            : "bg-ink text-white dark:bg-slate-100 dark:text-slate-900";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        toneClass,
        className,
      )}
      {...props}
    >
      {tone === "success" || tone === "warning" || tone === "destructive" ? (
        <span
          aria-hidden="true"
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone === "success" && "bg-success",
            tone === "warning" && "bg-warning",
            tone === "destructive" && "bg-danger",
          )}
        />
      ) : null}
      {children}
    </span>
  );
}
