import type { ReactNode } from "react";
import { ArrowUpDown, AtSign, Clock, Globe, ListFilter, RotateCcw, Rows3, SlidersHorizontal, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatDateTimeLocalInputValue } from "@/lib/formatters/dates";
import { cn } from "@/lib/utils";
import { buildDefaultCustomRange } from "@/lib/time-filters";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { BounceSubType, EmailEventType, RecentActivitySort, TimeFilterMode } from "@/lib/supabase/types";
import { parseRowLimit, ROW_LIMIT_OPTIONS, UNLIMITED_ROW_LIMIT, type RowLimit } from "@/lib/row-limits";

export interface OverviewFilterValues {
  timeMode: TimeFilterMode;
  windowDays: number;
  startAt: string;
  endAt: string;
  recentActivitySort: RecentActivitySort;
  status: "all" | EmailEventType;
  bounceSubType: "all" | BounceSubType;
  origin: string;
  subject: string;
  provider?: string;
  rowLimit: RowLimit;
}

function FilterField({
  htmlFor,
  icon,
  label,
  labelClassName,
  className,
  children,
}: {
  htmlFor: string;
  icon: ReactNode;
  label: string;
  labelClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-[160px] flex-1 basis-[160px] flex-col gap-2", className)}>
      <Label
        htmlFor={htmlFor}
        className={cn(
          "flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-400",
          labelClassName,
        )}
      >
        <span className="text-slate-500">{icon}</span>
        {label}
      </Label>
      {children}
    </div>
  );
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
  const isCustomRange = value.timeMode === "custom";

  const fieldClassName = cn(
    "h-11 w-full rounded-xl border border-slate-700 bg-slate-950 text-slate-100 px-4 text-sm outline-none transition",
    "focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20",
  );

  return (
    <div
      className={cn(
        "rounded-3xl border border-slate-700 bg-slate-950/95 p-5 shadow-soft",
        className,
      )}
    >
      <div className="mb-4 flex items-center gap-2 text-slate-300">
        <SlidersHorizontal className="h-4 w-4 text-slate-500" />
        <span className="text-sm font-semibold">{t.overview.filters.title}</span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-5">
        <FilterField
          htmlFor="overview-time-mode"
          icon={<Clock className="h-3.5 w-3.5" />}
          label={t.overview.filters.time}
          labelClassName={labelClassName}
          className="basis-[220px]"
        >
          <div className="flex flex-col gap-2">
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
              className={cn(fieldClassName, selectClassName)}
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
                className={cn(fieldClassName, selectClassName)}
                options={[
                  { label: t.overview.filters.timeOptions.d1, value: "1" },
                  { label: t.overview.filters.timeOptions.d7, value: "7" },
                  { label: t.overview.filters.timeOptions.d30, value: "30" },
                  { label: t.overview.filters.timeOptions.d90, value: "90" },
                ]}
              />
            )}
          </div>
        </FilterField>

        <FilterField
          htmlFor="overview-status"
          icon={<ListFilter className="h-3.5 w-3.5" />}
          label={t.overview.filters.status}
          labelClassName={labelClassName}
        >
          <div className="flex flex-col gap-2">
            <Select
              id="overview-status"
              value={value.status}
              onChange={(event) => onChange({ ...value, status: event.target.value as OverviewFilterValues["status"] })}
              className={cn(fieldClassName, selectClassName)}
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

            {value.status === "bounced" ? (
              <div className="space-y-2">
                <Label htmlFor="overview-bounce-subtype" className={cn("text-slate-300", labelClassName)}>
                  {t.overview.filters.bounceSubtype}
                </Label>
                <Select
                  id="overview-bounce-subtype"
                  value={value.bounceSubType}
                  onChange={(event) =>
                    onChange({ ...value, bounceSubType: event.target.value as OverviewFilterValues["bounceSubType"] })
                  }
                  className={cn(fieldClassName, selectClassName)}
                  options={[
                    { label: t.overview.filters.bounceSubtypeOptions.all, value: "all" },
                    { label: t.overview.filters.bounceSubtypeOptions.suppressed, value: "Suppressed" },
                    { label: t.overview.filters.bounceSubtypeOptions.general, value: "General" },
                    { label: t.overview.filters.bounceSubtypeOptions.mailboxFull, value: "MailboxFull" },
                    { label: t.overview.filters.bounceSubtypeOptions.contentRejected, value: "ContentRejected" },
                    { label: t.overview.filters.bounceSubtypeOptions.undetermined, value: "Undetermined" },
                  ]}
                />
              </div>
            ) : null}
          </div>
        </FilterField>

        {showRecentActivitySort ? (
          <FilterField
            htmlFor="overview-recent-sort"
            icon={<ArrowUpDown className="h-3.5 w-3.5" />}
            label={t.overview.filters.recentActivitySort}
            labelClassName={labelClassName}
          >
            <Select
              id="overview-recent-sort"
              value={value.recentActivitySort}
              onChange={(event) => onChange({ ...value, recentActivitySort: event.target.value as RecentActivitySort })}
              className={cn(fieldClassName, selectClassName)}
              options={[
                { label: t.overview.filters.recentActivitySortOptions.timeDesc, value: "time-desc" },
                { label: t.overview.filters.recentActivitySortOptions.timeAsc, value: "time-asc" },
                { label: t.overview.filters.recentActivitySortOptions.recipientAsc, value: "recipient-asc" },
                { label: t.overview.filters.recentActivitySortOptions.recipientDesc, value: "recipient-desc" },
              ]}
            />
          </FilterField>
        ) : null}

        <FilterField
          htmlFor="overview-origin"
          icon={<Globe className="h-3.5 w-3.5" />}
          label={t.overview.filters.origin}
          labelClassName={labelClassName}
        >
          <Input
            id="overview-origin"
            placeholder={t.overview.originPlaceholder}
            value={value.origin}
            onChange={(event) => onChange({ ...value, origin: event.target.value })}
            className={cn(fieldClassName, "placeholder:text-slate-500", inputClassName)}
          />
        </FilterField>

        <FilterField
          htmlFor="overview-subject"
          icon={<Type className="h-3.5 w-3.5" />}
          label={t.overview.filters.subject}
          labelClassName={labelClassName}
        >
          <Input
            id="overview-subject"
            placeholder={t.overview.filters.subjectPlaceholder}
            value={value.subject}
            onChange={(event) => onChange({ ...value, subject: event.target.value })}
            className={cn(fieldClassName, "placeholder:text-slate-500", inputClassName)}
          />
        </FilterField>

        {showProviderFilter ? (
          <FilterField
            htmlFor="overview-provider"
            icon={<AtSign className="h-3.5 w-3.5" />}
            label={t.overview.filters.provider}
            labelClassName={labelClassName}
          >
            <Input
              id="overview-provider"
              placeholder={t.overview.filters.providerPlaceholder}
              value={value.provider ?? ""}
              onChange={(event) => onChange({ ...value, provider: event.target.value })}
              className={cn(fieldClassName, "placeholder:text-slate-500", inputClassName)}
            />
          </FilterField>
        ) : null}

        <FilterField
          htmlFor="overview-row-limit"
          icon={<Rows3 className="h-3.5 w-3.5" />}
          label={t.overview.filters.rows}
          labelClassName={labelClassName}
        >
          <Select
            id="overview-row-limit"
            value={String(value.rowLimit)}
            onChange={(event) => onChange({ ...value, rowLimit: parseRowLimit(event.target.value) })}
            className={cn(fieldClassName, selectClassName)}
            options={[
              ...ROW_LIMIT_OPTIONS.map((rowLimit) => ({
                label: rowLimit.toLocaleString(),
                value: String(rowLimit),
              })),
              {
                label: t.overview.filters.noRowLimit,
                value: UNLIMITED_ROW_LIMIT,
              },
            ]}
          />
        </FilterField>
      </div>

      <div className="mt-5 flex flex-col-reverse items-stretch justify-end gap-2 border-t border-slate-800/70 pt-4 sm:flex-row sm:items-center">
        {onClear ? (
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={onClear}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {t.overview.filters.clear}
          </Button>
        ) : null}
        <Button
          type="button"
          className="w-full sm:w-auto"
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
