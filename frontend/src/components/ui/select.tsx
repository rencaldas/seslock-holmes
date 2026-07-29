import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  label: string;
  value: string;
}

export function Select({
  className,
  options,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { options: SelectOption[] }) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-control border border-slate-200 bg-white px-4 pr-8 text-sm text-ink outline-none transition dark:border-slate-700 dark:bg-slate-900",
        "focus:border-brand focus:ring-2 focus:ring-brand/10",
        className,
      )}
      {...props}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
