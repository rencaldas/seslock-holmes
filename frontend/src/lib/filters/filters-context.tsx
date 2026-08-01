import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  DEFAULT_OVERVIEW_FILTERS,
  parseOverviewFilters,
  type OverviewSearchFilters,
} from "@/lib/overview/overview-search-params";
import { loadGlobalFilters, saveGlobalFilters, type GlobalFilters } from "@/lib/filters/global-filters-storage";
import { DEFAULT_SEARCH_MODE, parseSearchMode } from "@/lib/recipient-search/search-mode";
import type { RecipientSearchMode } from "@/lib/supabase/types";

const URL_FILTER_KEYS = [
  "timeMode",
  "windowDays",
  "startAt",
  "endAt",
  "status",
  "bounceSubType",
  "origin",
  "subject",
  "provider",
  "rows",
  "recentActivitySort",
];

function readInitialState(): GlobalFilters {
  if (typeof window === "undefined") {
    return { recipientEmail: "", searchMode: DEFAULT_SEARCH_MODE, filters: DEFAULT_OVERVIEW_FILTERS };
  }

  const stored = loadGlobalFilters();
  const urlParams = new URLSearchParams(window.location.search);
  const hasUrlFilters = URL_FILTER_KEYS.some((key) => urlParams.has(key)) || urlParams.has("mode");

  if (hasUrlFilters) {
    return {
      recipientEmail: urlParams.get("recipient") ?? urlParams.get("query") ?? stored?.recipientEmail ?? "",
      searchMode: urlParams.has("mode") ? parseSearchMode(urlParams.get("mode")) : stored?.searchMode ?? DEFAULT_SEARCH_MODE,
      filters: parseOverviewFilters(urlParams),
    };
  }

  return stored ?? { recipientEmail: "", searchMode: DEFAULT_SEARCH_MODE, filters: DEFAULT_OVERVIEW_FILTERS };
}

interface FiltersContextValue {
  recipientEmail: string;
  searchMode: RecipientSearchMode;
  filters: OverviewSearchFilters;
  setRecipientEmail: (value: string) => void;
  setSearchMode: (value: RecipientSearchMode) => void;
  applyFilters: (next: OverviewSearchFilters) => void;
  clearFilters: () => void;
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GlobalFilters>(readInitialState);

  useEffect(() => {
    saveGlobalFilters(state);
  }, [state]);

  function setRecipientEmail(value: string) {
    setState((current) => ({ ...current, recipientEmail: value }));
  }

  function setSearchMode(value: RecipientSearchMode) {
    setState((current) => ({ ...current, searchMode: value }));
  }

  function applyFilters(next: OverviewSearchFilters) {
    setState((current) => ({ ...current, filters: next }));
  }

  function clearFilters() {
    setState((current) => ({ ...current, filters: { ...DEFAULT_OVERVIEW_FILTERS } }));
  }

  return (
    <FiltersContext.Provider
      value={{
        recipientEmail: state.recipientEmail,
        searchMode: state.searchMode,
        filters: state.filters,
        setRecipientEmail,
        setSearchMode,
        applyFilters,
        clearFilters,
      }}
    >
      {children}
    </FiltersContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FiltersContext);
  if (!context) {
    throw new Error("useFilters must be used within a FiltersProvider");
  }
  return context;
}
