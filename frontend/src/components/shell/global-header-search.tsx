import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { OverviewFilters } from "@/features/overview/overview-filters";
import { useFilters } from "@/lib/filters/filters-context";
import { normalizeEmail } from "@/lib/formatters/email";
import { useI18n } from "@/lib/i18n/use-i18n";
import { DEFAULT_OVERVIEW_FILTERS, countActiveOverviewFilters } from "@/lib/overview/overview-search-params";
import type { RecipientSearchMode } from "@/lib/supabase/types";

function getSearchPlaceholder(mode: RecipientSearchMode, t: ReturnType<typeof useI18n>) {
  switch (mode) {
    case "sender":
      return t.investigation.searchPlaceholderSender;
    case "provider":
      return t.investigation.searchPlaceholderProvider;
    case "all":
      return t.investigation.searchPlaceholderAll;
    case "recipient":
    default:
      return t.investigation.searchPlaceholderRecipient;
  }
}

export function GlobalHeaderSearch() {
  const t = useI18n();
  const navigate = useNavigate();
  const {
    recipientEmail,
    searchMode,
    filters: appliedFilters,
    setRecipientEmail,
    setSearchMode,
    applyFilters,
    clearFilters,
  } = useFilters();
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const [draftFilters, setDraftFilters] = useState(appliedFilters);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const activeFilterCount = countActiveOverviewFilters(appliedFilters);

  useEffect(() => {
    setDraftFilters(appliedFilters);
  }, [appliedFilters]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const menu = detailsRef.current;
      if (!menu?.open) return;
      if (menu.contains(event.target as Node)) return;
      menu.removeAttribute("open");
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleInvestigate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = searchMode === "provider" ? recipientEmail.trim() : normalizeEmail(recipientEmail);
    if (!normalized) {
      return;
    }
    setRecipientEmail(normalized);
    navigate(`/investigate?query=${encodeURIComponent(normalized)}&mode=${searchMode}&page=1`);
  }

  return (
    <div className="relative flex w-full min-w-0 items-center gap-2">
      <form onSubmit={handleInvestigate} className="min-w-0 flex-1">
        <div className="flex h-11 items-center gap-1 rounded-panel border border-slate-200 bg-white pl-1 pr-1 shadow-card transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10 dark:border-slate-800 dark:bg-slate-900">
          <Select
            value={searchMode}
            onChange={(event) => setSearchMode(event.target.value as RecipientSearchMode)}
            aria-label={t.investigation.searchModeLabel}
            className="h-9 w-[7.5rem] shrink-0 rounded-control border-0 bg-transparent pl-2 pr-6 text-sm text-ink outline-none focus:ring-0 sm:w-36"
            options={[
              { label: t.investigation.searchModes.all, value: "all" },
              { label: t.investigation.searchModes.recipient, value: "recipient" },
              { label: t.investigation.searchModes.sender, value: "sender" },
              { label: t.investigation.searchModes.provider, value: "provider" },
            ]}
          />
          <div className="h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              value={recipientEmail}
              onChange={(event) => setRecipientEmail(event.target.value)}
              placeholder={getSearchPlaceholder(searchMode, t)}
              aria-label={t.overview.investigateRecipient}
              className="h-9 w-full min-w-0 border-0 bg-transparent pl-9 pr-2 text-sm text-ink outline-none placeholder:text-ink-muted"
            />
          </div>
          <Button type="submit" className="hidden shrink-0 sm:inline-flex">
            <Search className="mr-2 h-4 w-4" />
            {t.overview.investigateRecipient}
          </Button>
          <Button type="submit" className="shrink-0 px-2.5 sm:hidden" aria-label={t.overview.investigateRecipient}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </form>

      <details
        ref={detailsRef}
        className="shrink-0"
        onToggle={(event) => setIsFiltersOpen(event.currentTarget.open)}
      >
        <summary className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-panel border border-slate-200 bg-white px-3 text-sm font-semibold text-ink shadow-card transition hover:border-brand/40 dark:border-slate-800 dark:bg-slate-900">
          <SlidersHorizontal className="h-4 w-4 text-ink-muted" />
          <span className="hidden sm:inline">{isFiltersOpen ? t.overview.hideFilters : t.overview.showFilters}</span>
          {activeFilterCount > 0 ? (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          ) : null}
        </summary>
        <div className="fixed left-1/2 top-20 z-30 max-h-[80vh] w-[min(520px,94vw)] -translate-x-1/2 overflow-y-auto sm:w-[min(680px,96vw)] md:w-[min(960px,96vw)] lg:w-[min(1050px,98vw)] xl:w-[1100px]">
          <OverviewFilters
            value={draftFilters}
            onChange={(next) => setDraftFilters((current) => ({ ...current, ...next }))}
            onClear={() => {
              setDraftFilters({ ...DEFAULT_OVERVIEW_FILTERS });
              clearFilters();
              detailsRef.current?.removeAttribute("open");
            }}
            onApply={() => {
              applyFilters(draftFilters);
              detailsRef.current?.removeAttribute("open");
            }}
            showProviderFilter
            className="border-slate-200 bg-white shadow-hover dark:border-slate-800 dark:bg-slate-900"
            inputClassName="border-slate-200 bg-slate-50 text-ink placeholder:text-ink-muted focus:border-brand focus:ring-2 focus:ring-brand/10 dark:border-slate-700 dark:bg-slate-800"
            selectClassName="border-slate-200 bg-slate-50 text-ink focus:border-brand focus:ring-2 focus:ring-brand/10 dark:border-slate-700 dark:bg-slate-800"
            labelClassName="text-ink-muted"
          />
        </div>
      </details>
    </div>
  );
}
