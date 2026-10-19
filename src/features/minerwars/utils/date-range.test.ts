import { describe, expect, it } from "vitest";
import { addUtcDays, buildDateRange } from "./date-range";

describe("buildDateRange", () => {
  it("is inclusive on both ends", () => {
    expect(buildDateRange("2024-01-01", "2024-01-03")).toEqual([
      "2024-01-01",
      "2024-01-02",
      "2024-01-03",
    ]);
  });

  it("handles month and leap-year boundaries", () => {
    expect(buildDateRange("2024-02-28", "2024-03-01")).toEqual([
      "2024-02-28",
      "2024-02-29",
      "2024-03-01",
    ]);
  });

  it("returns a single day when start equals end", () => {
    expect(buildDateRange("2024-01-01", "2024-01-01")).toEqual(["2024-01-01"]);
  });

  it("terminates when end is before start", () => {
    expect(buildDateRange("2024-01-05", "2024-01-01")).toEqual(["2024-01-05"]);
  });
});

describe("addUtcDays", () => {
  it("moves forward and backward", () => {
    expect(addUtcDays("2024-01-01", 1)).toBe("2024-01-02");
    expect(addUtcDays("2024-01-01", -1)).toBe("2023-12-31");
  });
});
