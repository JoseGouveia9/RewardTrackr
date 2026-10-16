import { buildApiHeaders } from "@/lib/http";
import { fetchDifficultyEpochs } from "./difficulty-adjustments";
import {
  getPaymentDataFromBuildCache,
  getSoloDaysFromBuildCache,
  loadPersistedComparison,
  persistComparison,
} from "./cache";
import {
  getBoostCostGmtForCycles,
  getPersonalMinerWarsRewardTxSumsForWindows,
  getSoloMiningDates,
  getUserPowerChart,
} from "./api";
import type { CycleInfo, MinerWarsComparison } from "./types";

interface PrefetchCompletedCyclesArgs {
  token: string;
  cycles: CycleInfo[];
  today: string;
  onCyclePrepared?: (cycleId: number, result: MinerWarsComparison) => void;
  onProgress?: (done: number, total: number) => void;
}

export async function prefetchCompletedCycleComparisons({
  token,
  cycles,
  today,
  onCyclePrepared,
  onProgress,
}: PrefetchCompletedCyclesArgs): Promise<void> {
  const headers = buildApiHeaders(token);
  const todo = cycles.filter((cycle) => {
    if (cycle.cycleEnd >= today) return false;
    const payDay = new Date(cycle.cycleEnd + "T00:00:00Z");
    payDay.setUTCDate(payDay.getUTCDate() + 1);
    const payDayStr = payDay.toISOString().slice(0, 10);
    if (getPaymentDataFromBuildCache(payDayStr) === null) return false;
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

  const lastUserPower =
    userPowerByDate.size > 0 ? ([...userPowerByDate.values()].slice(-1)[0] ?? null) : null;
  const epochs = await fetchDifficultyEpochs();

  // Batch the personal-GMT-reward-tx and boost-cost lookups across ALL cycles being reprocessed
  // into a single history walk each, instead of one independent walk per cycle — avoids
  // O(cycles × history-depth) duplicated paging when reprocessing many completed cycles at once
  // (e.g. right after a MinerWars cache-version wipe forces a full history rebuild).
  const txWindows = todo.map((cycle) => {
    const payDay = new Date(cycle.cycleEnd + "T00:00:00Z");
    payDay.setUTCDate(payDay.getUTCDate() + 1);
    const cycleDates: string[] = [];
    for (
      let day = new Date(cycle.cycleStart + "T00:00:00Z");
      ;
      day.setUTCDate(day.getUTCDate() + 1)
    ) {
      const value = day.toISOString().slice(0, 10);
      cycleDates.push(value);
      if (value === cycle.cycleEnd) break;
    }
    const txWindowEnd = new Date(payDay);
    txWindowEnd.setUTCDate(txWindowEnd.getUTCDate() + cycleDates.length);
    return {
      key: cycle.cycleId,
      fromDateStr: payDay.toISOString().slice(0, 10),
      toDateStr: txWindowEnd.toISOString().slice(0, 10),
    };
  });
  const personalGmtRewardsByCycle = await getPersonalMinerWarsRewardTxSumsForWindows(
    headers,
    txWindows,
  ).catch(() => new Map<number, number | null>());
  const boostCostByCycle = await getBoostCostGmtForCycles(
    headers,
    todo.map((c) => c.cycleId),
  ).catch(() => new Map<number, number>());

  let cyclesDone = 0;
  for (const cycle of todo) {
    try {
      const { cycleId, cycleStart: cycleStartDate, cycleEnd: cycleEndDate } = cycle;
      const payDay = new Date(cycleEndDate + "T00:00:00Z");
      payDay.setUTCDate(payDay.getUTCDate() + 1);
      const payData = getPaymentDataFromBuildCache(payDay.toISOString().slice(0, 10));
      if (payData === null) continue;

      const cycleDates: string[] = [];
      for (
        let day = new Date(cycleStartDate + "T00:00:00Z");
        ;
        day.setUTCDate(day.getUTCDate() + 1)
      ) {
        const value = day.toISOString().slice(0, 10);
        cycleDates.push(value);
        if (value === cycleEndDate) break;
      }
      const cycleDateSet = new Set(cycleDates);

      const satsPerThByDate = new Map<string, number>();
      for (const dateStr of cycleDates) {
        let applicable: (typeof epochs)[0] | null = null;
        for (const epoch of epochs) {
          if (epoch.date < dateStr) applicable = epoch;
        }
        if (applicable) satsPerThByDate.set(dateStr, applicable.satsPerTH);
      }
      const latestSatsPerTH = epochs[epochs.length - 1]?.satsPerTH ?? null;

      const soloDayCandidates =
        getSoloDaysFromBuildCache(cycleStartDate, cycleEndDate) ??
        (await getSoloMiningDates(headers, cycleStartDate, cycleEndDate));

      let soloEquivSats = 0;
      let targetSoloSats = 0;
      let targetActualDays = 0;
      for (const dateStr of cycleDates) {
        if (soloDayCandidates.has(dateStr)) continue;
        const userPow = userPowerByDate.has(dateStr)
          ? userPowerByDate.get(dateStr)!
          : (lastUserPower ?? 0);
        const satsPerTH = satsPerThByDate.get(dateStr) ?? latestSatsPerTH;
        if (satsPerTH != null && userPow) {
          soloEquivSats += satsPerTH * userPow;
          targetSoloSats += satsPerTH * userPow;
          targetActualDays++;
        }
      }

      const minerWarsSats = payData.actualBtc * 1e8;
      const diffSats = minerWarsSats - soloEquivSats;
      const diffPct = soloEquivSats > 0 ? (diffSats / soloEquivSats) * 100 : null;
      const progressPct = targetSoloSats > 0 ? (minerWarsSats / targetSoloSats) * 100 : null;
      const soloDaysSorted = [...soloDayCandidates].filter((day) => cycleDateSet.has(day)).sort();
      const windowLabel =
        soloDaysSorted.length === 0
          ? "full cycle"
          : `excl. solo day(s): ${soloDaysSorted.join(", ")}`;

      const personalGmtRewardsFromTx = personalGmtRewardsByCycle.get(cycleId) ?? null;
      const personalBoostCostGmt = boostCostByCycle.get(cycleId) ?? null;

      const result: MinerWarsComparison = {
        cycleId,
        cycleStart: cycleStartDate,
        cycleEnd: cycleEndDate,
        today,
        minerWarsSats,
        clanMinerWarsSats: null,
        btcFundBtc: null,
        soloEquivSats,
        diffSats,
        diffPct,
        targetSoloSats,
        progressPct,
        targetActualDays,
        targetProjectedDays: 0,
        latestSatsPerTH,
        windowLabel,
        soloDays: soloDaysSorted,
        hasClanAnalytics: true,
        btcFundIsZero: false,
        actualMinerWarsBtc: payData.actualBtc,
        clanTargetSoloSats: null,
        clanTargetActualDays: 0,
        clanTargetProjectedDays: 0,
        btcPerBlockSats: null,
        cycleLength: cycleDates.length,
        maintenanceBtc: payData.maintenanceBtc,
        maintenanceGmt: payData.maintenanceGmt,
        maintenanceUsd: payData.maintenanceUsd,
        rewardGmt: payData.btcPrice,
        netBtc: payData.actualBtc - payData.maintenanceBtc,
        netGmt: payData.netGmt,
        netUsd: payData.netUsd,
        minerWarsGmt: null,
        minerWarsUsd: payData.usdTotal,
        soloEquivGmt: null,
        targetSoloGmt: null,
        soloMaintenanceBtc: null,
        soloMaintenanceGmt: null,
        soloMaintenanceUsd: null,
        soloNetBtc: null,
        soloNetGmt: null,
        soloNetUsd: null,
        btcPrice: payData.btcPrice,
        gmtPrice: payData.gmtPrice,
        zeroedRounds: null,
        zeroedRoundsHint: null,
        leagueDiscountPct: null,
        personalDiscountPct: null,
        rewardDistributionDiscountPct: null,
        personalGmtRewards: personalGmtRewardsFromTx,
        personalBlocksMined: null,
        personalBoostCostGmt,
      };

      persistComparison(result);
      onCyclePrepared?.(cycleId, result);
    } catch {
      // ignore per-cycle prefetch errors
    } finally {
      cyclesDone++;
      onProgress?.(cyclesDone, todo.length);
    }
  }
}
