import { describe, expect, it } from "vitest";
import { cycleEndFromStart, getCycleStartTuesdayUTC, toDateString } from "./index";

describe("MinerWars cycle dates", () => {
  it("snaps any day of the week to the Tuesday that starts its cycle", () => {
    expect(getCycleStartTuesdayUTC("2024-01-02T00:00:00Z")).toBe("2024-01-02T00:00:00.000Z");
    expect(getCycleStartTuesdayUTC("2024-01-05T10:30:00Z")).toBe("2024-01-02T00:00:00.000Z");
    expect(getCycleStartTuesdayUTC("2024-01-08T23:59:59Z")).toBe("2024-01-02T00:00:00.000Z");
    expect(getCycleStartTuesdayUTC("2024-01-09T00:00:00Z")).toBe("2024-01-09T00:00:00.000Z");
  });

  it("ends a cycle six days after its start", () => {
    expect(cycleEndFromStart("2024-01-02")).toBe("2024-01-08");
  });

  it("extracts the date part of an ISO string", () => {
    expect(toDateString("2024-01-02T00:00:00.000Z")).toBe("2024-01-02");
  });
});
