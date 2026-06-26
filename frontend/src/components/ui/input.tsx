import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none",
        "placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
