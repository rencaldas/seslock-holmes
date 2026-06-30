import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { EmailEventType } from "@/lib/supabase/types";

export interface OverviewFilterValues {
  windowDays: number;
  status: "all" | EmailEventType;
  origin: string;
}

export function OverviewFilters({
  value,
  onChange,
  onApply,
  className,
  inputClassName,
  selectClassName,
  labelClassName,
}: {
  value: OverviewFilterValues;
  onChange: (next: OverviewFilterValues) => void;
  onApply: () => void;
  className?: string;
  inputClassName?: string;
  selectClassName?: string;
  labelClassName?: string;
}) {
  const t = useI18n();

  return (
    <div className={cn(
      "grid gap-4 rounded-3xl border border-slate-700 bg-slate-950/95 p-5 shadow-soft md:grid-cols-[1fr_1fr_1fr_auto]",
      className,
    )}>
      <div className="space-y-2">
        <Label htmlFor="overview-window" className={cn("text-slate-300", labelClassName)}>{t.overview.filters.time}</Label>
        <Select
          id="overview-window"
          value={String(value.windowDays)}
          onChange={(event) => onChange({ ...value, windowDays: Number(event.target.value) })}
          className={cn(
            "h-11 w-full rounded-xl border border-slate-700 bg-slate-950 text-slate-100 px-4 text-sm outline-none",
            "focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20",
            selectClassName,
          )}
          options={[
          { label: t.overview.filters.timeOptions.d1, value: "1" },
          { label: t.overview.filters.timeOptions.d7, value: "7" },
          { label: t.overview.filters.timeOptions.d30, value: "30" },
          { label: t.overview.filters.timeOptions.d90, value: "90" },
          ]}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="overview-status" className={cn("text-slate-300", labelClassName)}>{t.overview.filters.status}</Label>
        <Select
          id="overview-status"
          value={value.status}
          onChange={(event) => onChange({ ...value, status: event.target.value as OverviewFilterValues["status"] })}
          className={cn(
            "h-11 w-full rounded-xl border border-slate-700 bg-slate-950 text-slate-100 px-4 text-sm outline-none",
            "focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20",
            selectClassName,
          )}
          options={[
            { label: t.overview.filters.options.all, value: "all" },
            { label: t.overview.filters.options.sent, value: "sent" },
            { label: t.overview.filters.options.delivered, value: "delivered" },
            { label: t.overview.filters.options.bounced, value: "bounced" },
            { label: t.overview.filters.options.complained, value: "complained" },
            { label: t.overview.filters.options.delayed, value: "delayed" },
            { label: t.overview.filters.options.rejected, value: "rejected" },
            { label: t.overview.filters.options.rendering_failure, value: "rendering_failure" },
          ]}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="overview-origin" className={cn("text-slate-300", labelClassName)}>{t.overview.filters.origin}</Label>
        <Input
          id="overview-origin"
          placeholder={t.overview.originPlaceholder}
          value={value.origin}
          onChange={(event) => onChange({ ...value, origin: event.target.value })}
          className={cn(
            "h-11 w-full rounded-xl border border-slate-700 bg-slate-950 text-slate-100 px-4 text-sm outline-none",
            "placeholder:text-slate-500 focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20",
            inputClassName,
          )}
        />
      </div>
      <div className="flex items-end">
        <Button
          type="button"
          className="w-full md:w-auto border border-slate-500/60 bg-slate-950 text-white hover:bg-slate-900"
          onClick={onApply}
        >
          {t.overview.filters.apply}
        </Button>
      </div>
    </div>
  );
}
