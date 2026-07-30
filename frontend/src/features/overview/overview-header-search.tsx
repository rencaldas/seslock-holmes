import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OverviewFilters } from "@/features/overview/overview-filters";
import { normalizeEmail } from "@/lib/formatters/email";
import { useI18n } from "@/lib/i18n/use-i18n";
import {
  DEFAULT_OVERVIEW_FILTERS,
  buildSearchParams,
  countActiveOverviewFilters,
  overviewFiltersToSearchParams,
  parseOverviewFilters,
} from "@/lib/overview/overview-search-params";

export function OverviewHeaderSearch() {
  const t = useI18n();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const appliedFilters = parseOverviewFilters(searchParams);
  const [recipientEmail, setRecipientEmail] = useState(searchParams.get("recipient") ?? "");
  const [filters, setFilters] = useState(() => appliedFilters);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const activeFilterCount = countActiveOverviewFilters(appliedFilters);

  useEffect(() => {
    setRecipientEmail(searchParams.get("recipient") ?? "");
    setFilters(parseOverviewFilters(searchParams));
  }, [searchParams]);

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
    const normalized = normalizeEmail(recipientEmail);
    if (!normalized) {
      return;
    }
    const nextParams = buildSearchParams(
      searchParams,
      {
        recipient: normalized,
        query: normalized,
        mode: "recipient",
        ...overviewFiltersToSearchParams(appliedFilters),
      },
      true,
    );
    setSearchParams(nextParams);
    navigate(`/investigate?${nextParams.toString()}`);
  }

  return (
    <div className="relative flex w-full min-w-0 items-center gap-2">
      <form onSubmit={handleInvestigate} className="min-w-0 flex-1">
        <div className="flex h-11 items-center gap-1 rounded-panel border border-slate-200 bg-white pl-1 pr-1 shadow-card transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10 dark:border-slate-800 dark:bg-slate-900">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              value={recipientEmail}
              onChange={(event) => setRecipientEmail(event.target.value)}
              placeholder={t.overview.searchPlaceholder}
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
        <div className="fixed left-1/2 top-20 z-30 max-h-[80vh] w-[min(520px,94vw)] -translate-x-1/2 overflow-y-auto sm:w-[min(600px,92vw)] md:w-[min(720px,90vw)] lg:w-[700px] xl:w-[900px]">
          <OverviewFilters
            value={filters}
            onChange={(next) => setFilters((current) => ({ ...current, ...next }))}
            onClear={() => {
              setFilters({ ...DEFAULT_OVERVIEW_FILTERS });
              setSearchParams(
                buildSearchParams(
                  searchParams,
                  {
                    timeMode: null,
                    windowDays: null,
                    startAt: null,
                    endAt: null,
                    recentActivitySort: null,
                    status: null,
                    origin: null,
                    subject: null,
                    provider: null,
                    rows: null,
                  },
                  true,
                ),
              );
              detailsRef.current?.removeAttribute("open");
            }}
            onApply={() => {
              setSearchParams(buildSearchParams(searchParams, overviewFiltersToSearchParams(filters), true));
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
