import { parsePositiveNumber } from "@/lib/utils";
import type { TimeFilterMode } from "@/lib/supabase/types";

export interface TimeFilterState {
  timeMode: TimeFilterMode;
  windowDays: number;
  startAt: string;
  endAt: string;
}

function parseIsoDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export function buildDefaultCustomRange(windowDays: number) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - windowDays);

  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}

export function parseTimeFilterState(searchParams: URLSearchParams): TimeFilterState {
  const windowDays = parsePositiveNumber(searchParams.get("windowDays"));
  const timeMode = searchParams.get("timeMode") === "custom" ? "custom" : "window";
  const startAt = searchParams.get("startAt") ?? "";
  const endAt = searchParams.get("endAt") ?? "";

  if (timeMode === "custom" && (!startAt || !endAt)) {
    return {
      timeMode,
      windowDays,
      ...buildDefaultCustomRange(windowDays),
    };
  }

  return {
    timeMode,
    windowDays,
    startAt,
    endAt,
  };
}

export function resolveTimeRange(filters: TimeFilterState) {
  if (filters.timeMode === "custom") {
    const startIso = parseIsoDateTime(filters.startAt);
    const endIso = parseIsoDateTime(filters.endAt);
    if (startIso && endIso && endIso >= startIso) {
      return { startIso, endIso };
    }
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - filters.windowDays);
  return { startIso: cutoff.toISOString() };
}
