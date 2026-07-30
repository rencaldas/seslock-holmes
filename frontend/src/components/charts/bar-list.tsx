import { cn } from "@/lib/utils";

export interface BarListItem {
  key: string;
  label: string;
  value: number;
  displayValue: string;
  secondary?: string;
  tone?: "brand" | "success" | "warning" | "danger";
}

const TONE_BAR: Record<"brand" | "success" | "warning" | "danger", string> = {
  brand: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export function BarList({
  items,
  emptyLabel,
  total,
}: {
  items: BarListItem[];
  emptyLabel: string;
  /** When provided, bar widths are scaled as a true percentage of this total instead of relative to the largest item. */
  total?: number;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-muted">{emptyLabel}</p>;
  }

  const denominator = total && total > 0 ? total : Math.max(...items.map((item) => item.value), 1);

  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-semibold text-ink">{item.label}</span>
            <span className="shrink-0 tabular-nums text-ink-muted">
              {item.displayValue}
              {item.secondary ? <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">{item.secondary}</span> : null}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={cn("h-full rounded-full transition-all duration-500 ease-out motion-reduce:transition-none", TONE_BAR[item.tone ?? "brand"])}
              style={{ width: `${Math.max(4, (item.value / denominator) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
