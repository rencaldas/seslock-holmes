import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-control border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition dark:border-slate-700 dark:bg-slate-900",
        "placeholder:text-ink-muted focus:border-brand focus:ring-2 focus:ring-brand/10",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
