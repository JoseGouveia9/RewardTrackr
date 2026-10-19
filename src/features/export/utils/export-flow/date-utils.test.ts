import { describe, expect, it } from "vitest";
import type { RewardRecord } from "@/types/rewards";
import { latestRecordEpoch, toEpoch } from "./date-utils";

describe("toEpoch", () => {
  it("parses ISO dates", () => {
    expect(toEpoch("2024-05-01T12:00:00Z")).toBe(Date.UTC(2024, 4, 1, 12));
  });

  it("parses GoMining's space-separated, sub-millisecond, +00 format", () => {
    expect(toEpoch("2024-05-01 12:00:00.123456+00")).toBe(Date.UTC(2024, 4, 1, 12, 0, 0, 123));
  });

  it("returns NaN for empty or invalid input", () => {
    expect(toEpoch(null)).toBeNaN();
    expect(toEpoch("")).toBeNaN();
    expect(toEpoch("not a date")).toBeNaN();
  });
});

describe("latestRecordEpoch", () => {
  it("picks the newest valid date and ignores broken ones", () => {
    const records = [
      { createdAt: "2024-05-01T00:00:00Z" },
      { createdAt: "garbage" },
      { createdAt: "2024-05-03 00:00:00+00" },
    ] as unknown as RewardRecord[];
    expect(latestRecordEpoch(records)).toBe(Date.UTC(2024, 4, 3));
  });

  it("returns NaN when there are no valid dates", () => {
    expect(latestRecordEpoch([])).toBeNaN();
  });
});
