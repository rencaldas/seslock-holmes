interface ChartTooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
}

export function ChartTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: ChartTooltipEntry[];
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-control border border-slate-200 bg-white px-3 py-2 text-xs shadow-hover dark:border-slate-700 dark:bg-slate-900">
      {label ? <p className="mb-1.5 font-semibold text-ink">{label}</p> : null}
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: entry.color }} />
            <span className="text-ink-muted">{entry.name}</span>
            <span className="ml-auto font-semibold tabular-nums text-ink">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
