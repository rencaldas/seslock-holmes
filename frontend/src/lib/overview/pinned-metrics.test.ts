import { describe, expect, it } from "vitest";
import { reorderPinnedMetrics, togglePinnedMetric } from "./pinned-metrics";

describe("pinned metrics helpers", () => {
  it("pins and unpins metrics without duplicating ids", () => {
    expect(togglePinnedMetric([], "total-events")).toEqual(["total-events"]);
    expect(togglePinnedMetric(["total-events"], "total-events")).toEqual([]);
  });

  it("reorders pinned metrics by moving one item before another", () => {
    expect(reorderPinnedMetrics(["total-events", "unique-messages", "delivered"], "delivered", "unique-messages")).toEqual([
      "total-events",
      "delivered",
      "unique-messages",
    ]);
  });
});
