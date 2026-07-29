import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "ghost" | "destructive";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-control px-4 py-2 text-sm font-semibold transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
        variant === "default" && "bg-brand text-white hover:bg-brand-hover",
        variant === "secondary" && "bg-slate-100 text-ink hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700",
        variant === "ghost" && "bg-transparent text-ink-muted hover:bg-slate-100 dark:hover:bg-slate-800",
        variant === "destructive" && "bg-danger text-white hover:bg-danger/90",
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
