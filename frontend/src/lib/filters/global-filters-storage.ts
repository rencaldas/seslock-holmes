import { DEFAULT_OVERVIEW_FILTERS, type OverviewSearchFilters } from "@/lib/overview/overview-search-params";
import { DEFAULT_SEARCH_MODE, parseSearchMode } from "@/lib/recipient-search/search-mode";
import type { RecipientSearchMode } from "@/lib/supabase/types";

export interface GlobalFilters {
  recipientEmail: string;
  searchMode: RecipientSearchMode;
  filters: OverviewSearchFilters;
}

const STORAGE_KEY = "seslock-holmes.global-filters";

function isBrowser() {
  return typeof window !== "undefined";
}

export function loadGlobalFilters(): GlobalFilters | null {
  if (!isBrowser()) {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<GlobalFilters>;
    return {
      recipientEmail: typeof parsed.recipientEmail === "string" ? parsed.recipientEmail : "",
      searchMode: parseSearchMode(parsed.searchMode ?? DEFAULT_SEARCH_MODE),
      filters: { ...DEFAULT_OVERVIEW_FILTERS, ...(parsed.filters ?? {}) },
    };
  } catch {
    return null;
  }
}

export function saveGlobalFilters(value: GlobalFilters) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}
