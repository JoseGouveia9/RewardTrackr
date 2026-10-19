import { buildApiHeaders } from "@/lib/http";
import { addUtcDays, buildDateRange } from "./date-range";
import { fetchDifficultyEpochs, satsPerTerahashForDates } from "../api/difficulty-adjustments";
import {
  getPaymentDataFromBuildCache,
  getSoloDaysFromBuildCache,
  loadPersistedComparison,
  persistComparison,
} from "../stores/cache";
import {
  getBoostCostGmtForCycles,
  getPersonalMinerWarsRewardTransactionSumsForWindows,
  getSoloMiningDates,
} from "../api/rewards";
import { getUserPowerChart } from "../api/nft";
import { buildCompletedComparison } from "./comparison-completed";
import type { CycleInfo, MinerWarsComparison } from "../types";

interface PrefetchCompletedCyclesArguments {
  token: string;
  cycles: CycleInfo[];
  today: string;
  onCyclePrepared?: (cycleId: number, result: MinerWarsComparison) => void;
  onProgress?: (done: number, total: number) => void;
}

/**
 * Persists comparisons for completed cycles whose payout is in the build cache, walking the tx
 * history once for all cycles (e.g. after a cache-version wipe). Per-cycle errors are swallowed.
 */
export async function prefetchCompletedCycleComparisons({
  token,
  cycles,
  today,
  onCyclePrepared,
  onProgress,
}: PrefetchCompletedCyclesArguments): Promise<void> {
  const headers = buildApiHeaders(token);
  const todo = cycles.filter((cycle) => {
    if (cycle.cycleEnd >= today) return false;
    if (getPaymentDataFromBuildCache(addUtcDays(cycle.cycleEnd, 1)) === null) return false;
    const persisted = loadPersistedComparison(cycle.cycleId);
    return persisted === null || persisted.data.actualMinerWarsBtc === null;
  });
  if (todo.length === 0) return;

  const earliestStart = todo.reduce(
    (min, cycle) => (cycle.cycleStart < min ? cycle.cycleStart : min),
    todo[0].cycleStart,
  );

  let userPowerByDate: Map<string, number>;
  try {
    userPowerByDate = await getUserPowerChart(headers, earliestStart + "T00:00:00.000Z");
  } catch {
    return;
  }

  const epochs = await fetchDifficultyEpochs();

  const transactionWindows = todo.map((cycle) => {
    const payDayString = addUtcDays(cycle.cycleEnd, 1);
    const cycleLength = buildDateRange(cycle.cycleStart, cycle.cycleEnd).length;
    return {
      key: cycle.cycleId,
      fromDateString: payDayString,
      toDateString: addUtcDays(payDayString, cycleLength),
    };
  });
  const personalGmtRewardsByCycle = await getPersonalMinerWarsRewardTransactionSumsForWindows(
    headers,
    transactionWindows,
  ).catch(() => new Map<number, number | null>());
  const boostCostByCycle = await getBoostCostGmtForCycles(
    headers,
    todo.map((cycle) => cycle.cycleId),
  ).catch(() => new Map<number, number>());

  let cyclesDone = 0;
  for (const cycle of todo) {
    try {
      const { cycleId, cycleStart, cycleEnd } = cycle;
      const payData = getPaymentDataFromBuildCache(addUtcDays(cycleEnd, 1));
      if (payData === null) continue;

      const cycleDates = buildDateRange(cycleStart, cycleEnd);
      const { byDate: satsPerTerahashByDate, latestSatsPerTerahash } = satsPerTerahashForDates(
        epochs,
        cycleDates,
      );

      const soloDays =
        getSoloDaysFromBuildCache(cycleStart, cycleEnd) ??
        (await getSoloMiningDates(headers, cycleStart, cycleEnd));

      const result = buildCompletedComparison({
        cycleId,
        cycleStart,
        cycleEnd,
        today,
        cycleDates,
        soloDays,
        userPowerByDate,
        satsPerTerahashByDate,
        latestSatsPerTerahash,
        actualBtc: payData.actualBtc,
        payData,
        hasClanAnalytics: true,
        personalGmtRewards: personalGmtRewardsByCycle.get(cycleId) ?? null,
        personalBoostCostGmt: boostCostByCycle.get(cycleId) ?? null,
      });

      persistComparison(result);
      onCyclePrepared?.(cycleId, result);
      // eslint-disable-next-line no-empty
    } catch {
    } finally {
      cyclesDone++;
      onProgress?.(cyclesDone, todo.length);
    }
  }
}
