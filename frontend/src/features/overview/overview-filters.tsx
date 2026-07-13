import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatDateTimeLocalInputValue } from "@/lib/formatters/dates";
import { cn } from "@/lib/utils";
import { buildDefaultCustomRange } from "@/lib/time-filters";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { EmailEventType, RecentActivitySort, TimeFilterMode } from "@/lib/supabase/types";

export interface OverviewFilterValues {
  timeMode: TimeFilterMode;
  windowDays: number;
  startAt: string;
  endAt: string;
  recentActivitySort: RecentActivitySort;
  status: "all" | EmailEventType;
  origin: string;
  subject: string;
  provider?: string;
}

export function OverviewFilters({
  value,
  onChange,
  onApply,
  onClear,
  showProviderFilter = false,
  showRecentActivitySort = true,
  className,
  inputClassName,
  selectClassName,
  labelClassName,
}: {
  value: OverviewFilterValues;
  onChange: (next: OverviewFilterValues) => void;
  onApply: () => void;
  onClear?: () => void;
  showProviderFilter?: boolean;
  showRecentActivitySort?: boolean;
  className?: string;
  inputClassName?: string;
  selectClassName?: string;
  labelClassName?: string;
}) {
  const t = useI18n();
  const gridColumns = showRecentActivitySort
    ? showProviderFilter
      ? "md:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]"
      : "md:grid-cols-[1fr_1fr_1fr_1fr_auto]"
    : showProviderFilter
      ? "md:grid-cols-[1fr_1fr_1fr_1fr_auto]"
      : "md:grid-cols-[1fr_1fr_1fr_auto]";
  const isCustomRange = value.timeMode === "custom";

  return (
    <div className={cn(
      "grid gap-4 rounded-3xl border border-slate-700 bg-slate-950/95 p-5 shadow-soft",
      gridColumns,
      className,
    )}>
      <div className="space-y-2">
        <Label htmlFor="overview-time-mode" className={cn("text-slate-300", labelClassName)}>{t.overview.filters.time}</Label>
        <Select
          id="overview-time-mode"
          value={value.timeMode}
          onChange={(event) => {
            const nextMode = event.target.value as TimeFilterMode;
            if (nextMode === "custom" && (!value.startAt || !value.endAt)) {
              const defaults = buildDefaultCustomRange(value.windowDays);
              onChange({ ...value, timeMode: nextMode, ...defaults });
              return;
            }

            onChange({ ...value, timeMode: nextMode });
          }}
          className={cn(
            "h-11 w-full rounded-xl border border-slate-700 bg-slate-950 text-slate-100 px-4 text-sm outline-none",
            "focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20",
            selectClassName,
          )}
          options={[
            { label: t.overview.filters.timeModeOptions.window, value: "window" },
            { label: t.overview.filters.timeModeOptions.custom, value: "custom" },
          ]}
        />

        {isCustomRange ? (
          <div className="grid gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3">
            <div className="space-y-2">
              <Label htmlFor="overview-start-at" className={cn("text-slate-300", labelClassName)}>
                {t.overview.filters.startDateTime}
              </Label>
              <Input
                id="overview-start-at"
                type="datetime-local"
                value={formatDateTimeLocalInputValue(value.startAt)}
                onChange={(event) => {
                  const nextValue = event.target.value ? new Date(event.target.value).toISOString() : "";
                  onChange({ ...value, startAt: nextValue });
                }}
                className={cn(
                  "h-11 w-full rounded-xl border border-slate-700 bg-slate-950 text-slate-100 px-4 text-sm outline-none",
                  "placeholder:text-slate-500 focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20",
                  inputClassName,
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="overview-end-at" className={cn("text-slate-300", labelClassName)}>
                {t.overview.filters.endDateTime}
              </Label>
              <Input
                id="overview-end-at"
                type="datetime-local"
                value={formatDateTimeLocalInputValue(value.endAt)}
                onChange={(event) => {
                  const nextValue = event.target.value ? new Date(event.target.value).toISOString() : "";
                  onChange({ ...value, endAt: nextValue });
                }}
                className={cn(
                  "h-11 w-full rounded-xl border border-slate-700 bg-slate-950 text-slate-100 px-4 text-sm outline-none",
                  "placeholder:text-slate-500 focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20",
                  inputClassName,
                )}
              />
            </div>
          </div>
        ) : (
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
        )}
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

        {/* Assunto empilhado embaixo do Status, alinhado com "Últimas 24 horas" */}
        <Label htmlFor="overview-subject" className={cn("text-slate-300", labelClassName)}>{t.overview.filters.subject}</Label>
        <Input
          id="overview-subject"
          placeholder={t.overview.filters.subjectPlaceholder}
          value={value.subject}
          onChange={(event) => onChange({ ...value, subject: event.target.value })}
          className={cn(
            "h-11 w-full rounded-xl border border-slate-700 bg-slate-950 text-slate-100 px-4 text-sm outline-none",
            "placeholder:text-slate-500 focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20",
            inputClassName,
          )}
        />
      </div>

      {showRecentActivitySort ? (
        <div className="space-y-2">
          <Label htmlFor="overview-recent-sort" className={cn("text-slate-300", labelClassName)}>
            {t.overview.filters.recentActivitySort}
          </Label>
          <Select
            id="overview-recent-sort"
            value={value.recentActivitySort}
            onChange={(event) => onChange({ ...value, recentActivitySort: event.target.value as RecentActivitySort })}
            className={cn(
              "h-11 w-full rounded-xl border border-slate-700 bg-slate-950 text-slate-100 px-4 text-sm outline-none",
              "focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20",
              selectClassName,
            )}
            options={[
              { label: t.overview.filters.recentActivitySortOptions.timeDesc, value: "time-desc" },
              { label: t.overview.filters.recentActivitySortOptions.timeAsc, value: "time-asc" },
              { label: t.overview.filters.recentActivitySortOptions.recipientAsc, value: "recipient-asc" },
              { label: t.overview.filters.recentActivitySortOptions.recipientDesc, value: "recipient-desc" },
            ]}
          />
        </div>
      ) : null}

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

      {showProviderFilter ? (
        <div className="space-y-2">
          <Label htmlFor="overview-provider" className={cn("text-slate-300", labelClassName)}>{t.overview.filters.provider}</Label>
          <Input
            id="overview-provider"
            placeholder={t.overview.filters.providerPlaceholder}
            value={value.provider ?? ""}
            onChange={(event) => onChange({ ...value, provider: event.target.value })}
            className={cn(
              "h-11 w-full rounded-xl border border-slate-700 bg-slate-950 text-slate-100 px-4 text-sm outline-none",
              "placeholder:text-slate-500 focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20",
              inputClassName,
            )}
          />
        </div>
      ) : null}

      <div className="flex flex-col items-stretch justify-end gap-2">
        {onClear ? (
          <Button
            type="button"
            variant="secondary"
            className="w-full md:w-auto"
            onClick={onClear}
          >
            {t.overview.filters.clear}
          </Button>
        ) : null}
        <Button
            onClick={() => {
                onApply();
            }}
        >
          {t.overview.filters.apply}
        </Button>
      </div>
    </div>
  );
}