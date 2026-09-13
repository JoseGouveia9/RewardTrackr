import { getCachedMinerWarsComparison } from "./comparison";
import type { CycleInfo, MinerWarsComparison } from "./types";

export type IndividualTrendPoint = {
  cycleId: number;
  diffPct: number | null; // reward vs solo-equivalent, %
  progressPct: number | null; // reward vs personal solo target, %
};

function computePoint(
  cycleId: number,
  cmp: MinerWarsComparison | null,
): IndividualTrendPoint | null {
  if (!cmp) return null;
  const effectiveMw = cmp.actualMinerWarsBtc ?? cmp.minerWarsSats / 1e8;
  const soloBtc = cmp.soloEquivSats / 1e8;
  const diffBtc = effectiveMw - soloBtc;
  const diffPct = soloBtc > 0 ? (diffBtc / soloBtc) * 100 : null;
  const progressPct =
    cmp.targetSoloSats > 0 ? (effectiveMw / (cmp.targetSoloSats / 1e8)) * 100 : null;
  return { cycleId, diffPct, progressPct };
}

// Reads already-cached per-cycle comparisons (no network calls) to build a historical
// trend of the individual "vs solo" and "vs personal target" percentages, ending at the
// newest cycle available (regardless of which cycle is currently selected in the panel).
// `liveCmp` is used in place of the cache for whichever cycle it belongs to, since that
// cycle may still be in progress / not yet persisted.
export function readIndividualTrendPoints(
  cycles: CycleInfo[],
  endCycleId: number,
  liveCmp: MinerWarsComparison | null,
): IndividualTrendPoint[] {
  const targetCycles = cycles.filter((cycle) => cycle.cycleId <= endCycleId).reverse();
  const points: IndividualTrendPoint[] = [];

  for (const cycle of targetCycles) {
    const cmp =
      liveCmp?.cycleId === cycle.cycleId ? liveCmp : getCachedMinerWarsComparison(cycle.cycleId);
    const point = computePoint(cycle.cycleId, cmp);
    if (point) points.push(point);
  }

  return points;
}
