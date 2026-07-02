import { describe, expect, it, vi } from "vitest";
import { buildDefaultCustomRange, parseTimeFilterState, resolveTimeRange } from "./time-filters";

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
});
