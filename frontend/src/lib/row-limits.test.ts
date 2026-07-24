import { describe, expect, it } from "vitest";
import { DEFAULT_ROW_LIMIT, parseRowLimit } from "@/lib/row-limits";

describe("row limits", () => {
  it.each([
    ["100", 100],
    ["500", 500],
    ["1000", 1000],
  ])("accepts the supported value %s", (value, expected) => {
    expect(parseRowLimit(value)).toBe(expected);
  });

  it.each([null, undefined, "", "0", "250", "5000", "invalid"])(
    "falls back to the safe default for %s",
    (value) => {
      expect(parseRowLimit(value)).toBe(DEFAULT_ROW_LIMIT);
    },
  );
});
