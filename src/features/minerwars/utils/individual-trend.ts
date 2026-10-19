import { getCachedMinerWarsComparison } from "./comparison";
import type { CycleInfo, MinerWarsComparison } from "../types";

export type IndividualTrendPoint = {
  cycleId: number;
  differencePercent: number | null;
  progressPercent: number | null;
};

/** Derives the "vs solo" and "vs personal target" percentages of one cycle's comparison. */
function computePoint(
  cycleId: number,
  comparison: MinerWarsComparison | null,
): IndividualTrendPoint | null {
  if (!comparison) return null;
  const effectiveMinerWars = comparison.actualMinerWarsBtc ?? comparison.minerWarsSats / 1e8;
  const soloBtc = comparison.soloEquivSats / 1e8;
  const differenceBtc = effectiveMinerWars - soloBtc;
  const differencePercent = soloBtc > 0 ? (differenceBtc / soloBtc) * 100 : null;
  const progressPercent =
    comparison.targetSoloSats > 0
      ? (effectiveMinerWars / (comparison.targetSoloSats / 1e8)) * 100
      : null;
  return { cycleId, differencePercent, progressPercent };
}

/**
 * Builds the trend from cached comparisons only (no network), using `liveCmp` for its own cycle.
 */
export function readIndividualTrendPoints(
  cycles: CycleInfo[],
  endCycleId: number,
  liveComparison: MinerWarsComparison | null,
): IndividualTrendPoint[] {
  const targetCycles = cycles.filter((cycle) => cycle.cycleId <= endCycleId).reverse();
  const points: IndividualTrendPoint[] = [];

  for (const cycle of targetCycles) {
    const comparison =
      liveComparison?.cycleId === cycle.cycleId
        ? liveComparison
        : getCachedMinerWarsComparison(cycle.cycleId);
    const point = computePoint(cycle.cycleId, comparison);
    if (point) points.push(point);
  }

  return points;
}
