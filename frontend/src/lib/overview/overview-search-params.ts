import { parseTimeFilterState } from "@/lib/time-filters";
import { DEFAULT_ROW_LIMIT, parseRowLimit } from "@/lib/row-limits";
import type { RecentActivitySort } from "@/lib/supabase/types";
import type { OverviewFilterValues } from "@/features/overview/overview-filters";

type OverviewSearchFilters = OverviewFilterValues & { provider: string };

export const DEFAULT_OVERVIEW_FILTERS: OverviewSearchFilters = {
  timeMode: "window",
  windowDays: 1,
  startAt: "",
  endAt: "",
  recentActivitySort: "time-desc",
  status: "all",
  origin: "",
  subject: "",
  provider: "",
  rowLimit: DEFAULT_ROW_LIMIT,
};

export function parseRecentActivitySort(value: string | null): RecentActivitySort {
  return value === "time-asc" || value === "recipient-asc" || value === "recipient-desc" ? value : "time-desc";
}

export function parseOverviewFilters(searchParams: URLSearchParams): OverviewSearchFilters {
  return {
    ...DEFAULT_OVERVIEW_FILTERS,
    ...parseTimeFilterState(searchParams),
    recentActivitySort: parseRecentActivitySort(searchParams.get("recentActivitySort")),
    status: (searchParams.get("status") ?? "all") as OverviewFilterValues["status"],
    origin: searchParams.get("origin") ?? "",
    subject: searchParams.get("subject") ?? "",
    provider: searchParams.get("provider") ?? "",
    rowLimit: parseRowLimit(searchParams.get("rows")),
  };
}

export function buildSearchParams(
  current: URLSearchParams,
  next: Record<string, string | null | undefined>,
  resetPage = false,
) {
  const params = new URLSearchParams(current);
  for (const [key, value] of Object.entries(next)) {
    if (value === null || value === undefined || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }
  if (resetPage) {
    params.set("page", "1");
  }
  return params;
}

export function overviewFiltersToSearchParams(filters: OverviewFilterValues): Record<string, string> {
  return {
    timeMode: filters.timeMode,
    windowDays: String(filters.windowDays),
    startAt: filters.timeMode === "custom" ? filters.startAt : "",
    endAt: filters.timeMode === "custom" ? filters.endAt : "",
    recentActivitySort: filters.recentActivitySort,
    status: filters.status,
    origin: filters.origin,
    subject: filters.subject ?? "",
    provider: filters.provider ?? "",
    rows: String(filters.rowLimit),
  };
}

export function countActiveOverviewFilters(filters: OverviewFilterValues): number {
  let count = 0;
  if (filters.timeMode !== DEFAULT_OVERVIEW_FILTERS.timeMode || filters.windowDays !== DEFAULT_OVERVIEW_FILTERS.windowDays) {
    count += 1;
  }
  if (filters.status !== DEFAULT_OVERVIEW_FILTERS.status) count += 1;
  if (filters.origin) count += 1;
  if (filters.subject) count += 1;
  if (filters.provider) count += 1;
  if (filters.rowLimit !== DEFAULT_OVERVIEW_FILTERS.rowLimit) count += 1;
  if (filters.recentActivitySort !== DEFAULT_OVERVIEW_FILTERS.recentActivitySort) count += 1;
  return count;
}
