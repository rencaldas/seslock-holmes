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
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2",
        variant === "default" && "bg-slate-950 text-white hover:bg-slate-800",
        variant === "secondary" && "bg-slate-200 text-slate-900 hover:bg-slate-300",
        variant === "ghost" && "bg-transparent text-slate-700 hover:bg-slate-100",
        variant === "destructive" && "bg-rose-600 text-white hover:bg-rose-700",
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
