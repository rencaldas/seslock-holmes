import * as React from "react";
import { ChevronDown } from "lucide-react";
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
    <div className="relative">
      <select
        className={cn(
          "select-modern h-11 w-full appearance-none rounded-control border border-slate-200 bg-white px-4 pr-9 text-sm text-ink outline-none transition dark:border-slate-700 dark:bg-slate-900",
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
      {/* Always our own arrow, never the browser's: in supporting browsers
          the native ::picker-icon is hidden via globals.css (its glyph isn't
          symmetric, so rotating it on open makes it drift sideways) and this
          one rotates in place instead. slate-400 (not the ink-muted theme
          token) so it stays legible on the always-dark filter selects
          regardless of the site's light/dark theme. */}
      <ChevronDown className="select-chevron pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}
