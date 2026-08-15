import { describe, expect, it, vi } from "vitest";
import { buildDefaultCustomRange, parseTimeFilterState, resolvePriorTimeRange, resolveTimeRange } from "./time-filters";

describe("time filters", () => {
  it("creates a default custom range based on the selected window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-21T12:00:00.000Z"));

    try {
      const range = buildDefaultCustomRange(7);

      expect(range.startAt).toBe("2025-01-14T12:00:00.000Z");
      expect(range.endAt).toBe("2025-01-21T12:00:00.000Z");
    } finally {
      vi.useRealTimers();
    }
  });

  it("parses and resolves custom ranges when they are valid", () => {
    const params = new URLSearchParams({
      timeMode: "custom",
      startAt: "2025-01-01T00:00:00.000Z",
      endAt: "2025-01-02T00:00:00.000Z",
      windowDays: "30",
    });

    const filters = parseTimeFilterState(params);
    const range = resolveTimeRange(filters);

    expect(filters.timeMode).toBe("custom");
    expect(range).toEqual({
      startIso: "2025-01-01T00:00:00.000Z",
      endIso: "2025-01-02T00:00:00.000Z",
    });
  });

  it("falls back to the preset window when the custom range is invalid", () => {
    const filters = {
      timeMode: "custom" as const,
      windowDays: 2,
      startAt: "",
      endAt: "",
    };
    const range = resolveTimeRange(filters);

    expect(range.startIso).toBeDefined();
    expect(range.endIso).toBeUndefined();
  });

  it("resolves the prior window of equal length in window mode", () => {
    const asOf = new Date("2025-01-21T12:00:00.000Z");
    const filters = { timeMode: "window" as const, windowDays: 7, startAt: "", endAt: "" };

    const prior = resolvePriorTimeRange(filters, asOf);

    // Current window is 2025-01-14T12:00Z..2025-01-21T12:00Z (7 days), so the
    // prior window is the 7 days immediately before that.
    expect(prior).toEqual({
      startIso: "2025-01-07T12:00:00.000Z",
      endIso: "2025-01-14T12:00:00.000Z",
    });
  });

  it("resolves the prior window of equal length in custom mode", () => {
    const filters = {
      timeMode: "custom" as const,
      windowDays: 30,
      startAt: "2025-01-10T00:00:00.000Z",
      endAt: "2025-01-12T00:00:00.000Z",
    };

    const prior = resolvePriorTimeRange(filters);

    expect(prior).toEqual({
      startIso: "2025-01-08T00:00:00.000Z",
      endIso: "2025-01-10T00:00:00.000Z",
    });
  });

  it("falls back to window-based math when the custom range is invalid", () => {
    const asOf = new Date("2025-01-21T12:00:00.000Z");
    const filters = { timeMode: "custom" as const, windowDays: 2, startAt: "", endAt: "" };

    const prior = resolvePriorTimeRange(filters, asOf);

    expect(prior).toEqual({
      startIso: "2025-01-17T12:00:00.000Z",
      endIso: "2025-01-19T12:00:00.000Z",
    });
  });
});
