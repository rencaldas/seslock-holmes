import { describe, expect, it } from "vitest";
import { computeDelta } from "./comparison";

describe("computeDelta", () => {
  it("returns flat with zero percent when both periods are zero", () => {
    expect(computeDelta(0, 0)).toEqual({ percent: 0, direction: "flat" });
  });

  it("returns up with a null percent when growing from zero", () => {
    expect(computeDelta(10, 0)).toEqual({ percent: null, direction: "up" });
  });

  it("returns flat when the value is unchanged", () => {
    expect(computeDelta(50, 50)).toEqual({ percent: 0, direction: "flat" });
  });

  it("returns up with the correct percentage on growth", () => {
    expect(computeDelta(150, 100)).toEqual({ percent: 50, direction: "up" });
  });

  it("returns down with a negative percentage on decline", () => {
    expect(computeDelta(75, 100)).toEqual({ percent: -25, direction: "down" });
  });
});
