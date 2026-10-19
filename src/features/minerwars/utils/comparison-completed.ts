import { addUtcDays, buildDateRange } from "./date-range";
import {
  getActualIncomeFromBuildCache,
  getPaymentDataFromBuildCache,
  getSoloDaysFromBuildCache,
  type BuildPaymentData,
} from "../stores/cache";
import { fetchSatsPerTerahashForDates } from "../api/difficulty-adjustments";
import {
  getBoostCostGmtForCycle,
  getPersonalMinerWarsRewardTransactionSum,
  getSoloMiningDates,
} from "../api/rewards";
import { getUserPowerChart } from "../api/nft";
import { lastPowerOf, powerOnDate } from "./comparison-solo";
import type { MinerWarsComparison } from "../types";

type CompletedComparisonInput = {
  cycleId: number;
  cycleStart: string;
  cycleEnd: string;
  today: string;
  cycleDates: string[];
  soloDays: Set<string>;
  userPowerByDate: Map<string, number>;
  satsPerTerahashByDate: Map<string, number>;
  latestSatsPerTerahash: number | null;
  actualBtc: number;
  payData: BuildPaymentData | null;
  hasClanAnalytics: boolean;
  personalGmtRewards: number | null;
  personalBoostCostGmt: number | null;
};

/** Completed cycles are priced from the settled build-report payout rather than estimated. */
export function buildCompletedComparison(input: CompletedComparisonInput): MinerWarsComparison {
  const {
    cycleId,
    cycleStart,
    cycleEnd,
    today,
    cycleDates,
    soloDays,
    userPowerByDate,
    satsPerTerahashByDate,
    latestSatsPerTerahash,
    actualBtc,
    payData,
    hasClanAnalytics,
    personalGmtRewards,
    personalBoostCostGmt,
  } = input;
  const lastUserPower = lastPowerOf(userPowerByDate);

  let soloEquivSats = 0;
  let targetActualDays = 0;
  for (const dateString of cycleDates) {
    if (soloDays.has(dateString)) continue;
    const userPower = powerOnDate(userPowerByDate, lastUserPower, dateString);
    const satsPerTerahash = satsPerTerahashByDate.get(dateString) ?? latestSatsPerTerahash;
    if (satsPerTerahash != null && userPower) {
      soloEquivSats += satsPerTerahash * userPower;
      targetActualDays++;
    }
  }

  const minerWarsSats = actualBtc * 1e8;
  const differenceSats = minerWarsSats - soloEquivSats;
  const differencePercent = soloEquivSats > 0 ? (differenceSats / soloEquivSats) * 100 : null;
  const progressPercent = soloEquivSats > 0 ? (minerWarsSats / soloEquivSats) * 100 : null;

  const cycleDateSet = new Set(cycleDates);
  const soloDaysSorted = [...soloDays].filter((date) => cycleDateSet.has(date)).sort();
  const windowLabel =
    soloDaysSorted.length === 0 ? "full cycle" : `excl. solo day(s): ${soloDaysSorted.join(", ")}`;

  return {
    cycleId,
    cycleStart,
    cycleEnd,
    today,
    minerWarsSats,
    clanMinerWarsSats: null,
    btcFundBtc: null,
    soloEquivSats,
    diffSats: differenceSats,
    diffPct: differencePercent,
    targetSoloSats: soloEquivSats,
    progressPct: progressPercent,
    targetActualDays,
    targetProjectedDays: 0,
    latestSatsPerTH: latestSatsPerTerahash,
    windowLabel,
    soloDays: soloDaysSorted,
    hasClanAnalytics,
    btcFundIsZero: false,
    actualMinerWarsBtc: actualBtc,
    clanTargetSoloSats: null,
    clanTargetActualDays: 0,
    clanTargetProjectedDays: 0,
    btcPerBlockSats: null,
    cycleLength: cycleDates.length,
    maintenanceBtc: payData?.maintenanceBtc ?? null,
    maintenanceGmt: payData?.maintenanceGmt ?? null,
    maintenanceUsd: payData?.maintenanceUsd ?? null,
    rewardGmt: payData?.btcPrice ?? null,
    netBtc: payData != null ? actualBtc - payData.maintenanceBtc : null,
    netGmt: payData?.netGmt ?? null,
    netUsd: payData?.netUsd ?? null,
    minerWarsGmt: null,
    minerWarsUsd: payData?.usdTotal ?? null,
    soloEquivGmt: null,
    targetSoloGmt: null,
    soloMaintenanceBtc: null,
    soloMaintenanceGmt: null,
    soloMaintenanceUsd: null,
    soloNetBtc: null,
    soloNetGmt: null,
    soloNetUsd: null,
    btcPrice: payData?.btcPrice ?? null,
    gmtPrice: payData?.gmtPrice ?? null,
    zeroedRounds: null,
    zeroedRoundsHint: null,
    leagueDiscountPct: null,
    personalDiscountPct: null,
    rewardDistributionDiscountPct: null,
    personalGmtRewards,
    personalBlocksMined: null,
    personalBoostCostGmt,
  };
}

/**
 * Null when the payout isn't in the build-report cache yet, so the caller falls back to the live path.
 */
export async function fetchCompletedComparison(
  headers: Record<string, string>,
  cycleId: number,
  cycleStartDate: string,
  cycleStart: string,
  cycleEnd: string,
  today: string,
): Promise<MinerWarsComparison | null> {
  const cycleDates = buildDateRange(cycleStart, cycleEnd);
  const cachedSoloDays = getSoloDaysFromBuildCache(cycleStart, cycleEnd);
  const payDayString = addUtcDays(cycleEnd, 1);
  const actualBtc = getActualIncomeFromBuildCache(payDayString);

  const [{ byDate: satsPerTerahashByDate, latestSatsPerTerahash }, soloDays, userPowerByDate] =
    await Promise.all([
      fetchSatsPerTerahashForDates(cycleDates),
      cachedSoloDays != null
        ? Promise.resolve(cachedSoloDays)
        : getSoloMiningDates(headers, cycleStart, cycleEnd),
      getUserPowerChart(headers, cycleStartDate),
    ]);

  if (actualBtc == null) return null;

  const payData = getPaymentDataFromBuildCache(payDayString);

  const [personalGmtRewards, personalBoostCostGmt] = await Promise.all([
    getPersonalMinerWarsRewardTransactionSum(
      headers,
      payDayString,
      addUtcDays(payDayString, cycleDates.length),
    ).catch(() => null),
    getBoostCostGmtForCycle(headers, cycleId).catch(() => null),
  ]);

  return buildCompletedComparison({
    cycleId,
    cycleStart,
    cycleEnd,
    today,
    cycleDates,
    soloDays,
    userPowerByDate,
    satsPerTerahashByDate,
    latestSatsPerTerahash,
    actualBtc,
    payData,
    hasClanAnalytics: false,
    personalGmtRewards,
    personalBoostCostGmt,
  });
}
