import { useDisclosure } from "@/lib/hooks/use-disclosure";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { OverviewFilters } from "@/features/overview/overview-filters";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { EmailEventType, RecentActivitySort, RecipientSearchMode, TimeFilterMode } from "@/lib/supabase/types";

export interface RecipientSearchFilters {
  searchText: string;
  searchMode: RecipientSearchMode;
  timeMode: TimeFilterMode;
  windowDays: number;
  startAt: string;
  endAt: string;
  recentActivitySort: RecentActivitySort;
  status: "all" | EmailEventType;
  origin: string;
}

function getSearchPlaceholder(value: RecipientSearchFilters, t: ReturnType<typeof useI18n>) {
  switch (value.searchMode) {
    case "origin":
      return t.investigation.searchPlaceholderOrigin;
    case "sender":
      return t.investigation.searchPlaceholderSender;
    case "diagnostic":
      return t.investigation.searchPlaceholderDiagnostic;
    case "recipient":
    default:
      return t.investigation.searchPlaceholderRecipient;
  }
}

export function RecipientSearchForm({
  value,
  onChange,
  onSubmit,
}: {
  value: RecipientSearchFilters;
  onChange: (next: RecipientSearchFilters) => void;
  onSubmit: () => void;
}) {
  const t = useI18n();
  const { isOpen: filtersOpen, toggle: toggleFilters } = useDisclosure(false);

  return (
    <form
      className="overflow-hidden rounded-3xl border border-slate-700 bg-slate-950/95 shadow-soft"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-2 p-4 lg:grid-cols-[14rem_1fr_auto]">
        <div className="space-y-2">
          <Label htmlFor="search-mode" className="sr-only">{t.investigation.searchModeLabel}</Label>
          <Select
            id="search-mode"
            value={value.searchMode}
            onChange={(event) => onChange({ ...value, searchMode: event.target.value as RecipientSearchMode })}
            className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 text-sm text-slate-100 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20"
            options={[
              { label: t.investigation.searchModes.recipient, value: "recipient" },
              { label: t.investigation.searchModes.sender, value: "sender" },
              { label: t.investigation.searchModes.origin, value: "origin" },
              { label: t.investigation.searchModes.diagnostic, value: "diagnostic" },
            ]}
          />
        </div>
        <Label htmlFor="search-text" className="sr-only">{t.investigation.searchLabel}</Label>
        <Input
          id="search-text"
          placeholder={getSearchPlaceholder(value, t)}
          value={value.searchText}
          onChange={(event) => onChange({ ...value, searchText: event.target.value })}
          className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20"
        />
        <div className="flex items-center gap-2">
          <Button
            type="submit"
            className="w-full border border-slate-500/60 bg-slate-950 text-white hover:bg-slate-900 lg:w-auto"
          >
            {t.investigation.searchButton}
          </Button>
          <Button type="button" variant="secondary" onClick={toggleFilters}>
            {filtersOpen ? t.investigation.hideFilters : t.investigation.showFilters}
          </Button>
        </div>
      </div>

      <div className={`overflow-hidden transition-all duration-200 ease-out ${filtersOpen ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0"}`}>
        <OverviewFilters
          value={value}
          onChange={(next) => onChange({ ...value, ...next })}
          onApply={onSubmit}
          showRecentActivitySort={false}
          className="bg-slate-950/95 border-slate-700"
          inputClassName="border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:ring-slate-500/20"
          selectClassName="border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:ring-slate-500/20"
          labelClassName="text-slate-300"
        />
      </div>
    </form>
  );
}
