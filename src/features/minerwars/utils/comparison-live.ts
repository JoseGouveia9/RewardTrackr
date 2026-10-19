import { buildDateRange, addUtcDays } from "./date-range";
import { toDateString, type MinerWarsComparison } from "../types";
import type { HistoricalPriceEntry } from "../stores/cache";
import { fetchSatsPerTerahashForDates } from "../api/difficulty-adjustments";
import type { RoundRow } from "../api/cycles";
import { getBoostCostGmtForCycle, getDiscountFactor, getSoloMiningDates } from "../api/rewards";
import { getLivePrices } from "../api/prices";
import { getMyNftAverageEnergyEfficiency, getUserPowerChart } from "../api/nft";
import { computeMaintenanceAndNet } from "./comparison-maintenance";
import {
  cacheMaintenanceInputs,
  getHistoricalPricesCached,
  type MaintenanceRecomputeInputs,
} from "../stores/comparison-maintenance-store";
import { computeRoundRewards, fetchLeagueGroups, groupKey } from "./comparison-groups";
import { computeSoloSide, computeTargets, lastPowerOf } from "./comparison-solo";

type LiveComparisonInput = {
  headers: Record<string, string>;
  cycleId: number;
  cycleStartDate: string;
  cycleStart: string;
  cycleEnd: string;
  userRounds: RoundRow[];
  today: string;
};

/**
 * Comparison for in-progress/pending cycles from live API data; a live cycle's unsettled day 1
 * is excluded from the elapsed count (dropping this was tried against mobile and was wrong).
 * Display fields and clan rewards use only the CURRENT clan, so a mid-cycle switch isn't double-counted.
 */
export async function computeLiveComparison({
  headers,
  cycleId,
  cycleStartDate,
  cycleStart: CYCLE_START,
  cycleEnd: CYCLE_END,
  userRounds,
  today: TODAY,
}: LiveComparisonInput): Promise<MinerWarsComparison> {
  userRounds.sort((left, right) => right.roundId - left.roundId);
  const refRound = userRounds[0];
  const leagueId = refRound.leagueId;
  const clanId = refRound.clanId;

  const userPowerByDate = await getUserPowerChart(headers, cycleStartDate);
  const lastUserPower = lastPowerOf(userPowerByDate);

  const isCycleLive = TODAY >= CYCLE_START && TODAY <= CYCLE_END;
  const personalRewardCalculatedAt = CYCLE_END < TODAY ? CYCLE_END : TODAY;

  const [groupData, personalBoostCostGmt] = await Promise.all([
    fetchLeagueGroups(headers, cycleId, cycleStartDate, personalRewardCalculatedAt, userRounds),
    getBoostCostGmtForCycle(headers, cycleId).catch(() => null),
  ]);

  const personalBlocksMined = groupData.reduce(
    (total, group) => total + group.personalBlocksMined,
    0,
  );
  const personalGmtRewards = groupData.reduce(
    (total, group) => total + group.personalGmtRewards,
    0,
  );

  const groupDataByKey = new Map(
    groupData.map((group) => [groupKey(group.leagueId, group.clanId), group]),
  );
  const currentGroup = groupDataByKey.get(groupKey(leagueId, clanId))!;

  const completedRoundsMap = new Map<number, { power: number }>();
  for (const group of groupData) {
    for (const [id, entry] of group.completedRoundsMap) completedRoundsMap.set(id, entry);
  }

  const {
    completedRounds,
    btcFund,
    totalMinedBlocks,
    btcPerBlock,
    clanNftPower,
    leagueWeightedEnergyEfficiency,
    leagueWeightedAverageDiscount,
    clanPowerByDate,
    currentClanPower,
    clanCreatedAt,
    clanTerahashByDate,
    sumAllMultipliers,
  } = currentGroup;

  const clanTenureStart = clanCreatedAt != null ? toDateString(clanCreatedAt) : null;
  const clanTenureStartDate =
    clanTenureStart != null && clanTenureStart > CYCLE_START ? clanTenureStart : CYCLE_START;

  const cycleCutoff = CYCLE_END < TODAY ? CYCLE_END : TODAY;
  const cycleDates: string[] = [];
  for (
    let cursorDate = new Date(cycleStartDate);
    cursorDate.toISOString().slice(0, 10) <= cycleCutoff;
    cursorDate.setUTCDate(cursorDate.getUTCDate() + 1)
  ) {
    cycleDates.push(cursorDate.toISOString().slice(0, 10));
  }

  const elapsedComparisonDates = isCycleLive ? cycleDates.slice(1) : cycleDates;

  const { roundRewards, roundContextById } = computeRoundRewards(
    userRounds,
    groupDataByKey,
    userPowerByDate,
    lastUserPower,
    TODAY,
  );

  const actualMinerWarsBtc: number | null = null;
  const [
    { byDate: satsPerTerahashByDate, latestSatsPerTerahash },
    solodays,
    maintenanceDiscountData,
    maintenancePrices,
    maintenanceUserEnergyEfficiency,
    historicalPrices,
  ] = await Promise.all([
    fetchSatsPerTerahashForDates(cycleDates),
    getSoloMiningDates(headers, CYCLE_START, CYCLE_END),
    getDiscountFactor(headers).catch(() => ({
      factor: 1,
      gmtDiscount: 0,
      rewardDistributionDiscount: 0,
    })),
    getLivePrices().catch(() => ({ btcPrice: 0, gmtPrice: 0 })),
    getMyNftAverageEnergyEfficiency(headers).catch(() => null),
    getHistoricalPricesCached(
      buildDateRange(CYCLE_START, CYCLE_END).map((date) => addUtcDays(date, 1)),
    ).catch(() => new Map<string, HistoricalPriceEntry>()),
  ]);
  const maintenanceDiscountFactor = maintenanceDiscountData.factor;
  const maintenanceGmtDiscount = maintenanceDiscountData.gmtDiscount;
  const rewardDistributionDiscount = maintenanceDiscountData.rewardDistributionDiscount;
  const leagueDiscountPercent = leagueWeightedAverageDiscount;

  let minerWarsSatsBase = 0;
  for (const { userBtc, date } of roundRewards.values()) {
    if (!solodays.has(date)) minerWarsSatsBase += userBtc * 1e8;
  }

  const clanWonRounds = completedRounds.filter((round) => round.winnerClanId === clanId);
  let clanMinerWarsSats = 0;
  for (const round of clanWonRounds) {
    clanMinerWarsSats += btcPerBlock * round.multiplier * 1e8;
  }

  const { btcPrice: maintenanceBtcPrice, gmtPrice: maintenanceGmtPrice } = maintenancePrices;
  const userEnergyEfficiency = maintenanceUserEnergyEfficiency ?? 15;

  const solo = computeSoloSide({
    dates: elapsedComparisonDates,
    soloDays: solodays,
    userPowerByDate,
    lastUserPower,
    satsPerTerahashByDate,
    latestSatsPerTerahash,
    historicalPrices,
    maintenanceBtcPrice,
    maintenanceGmtPrice,
    userEnergyEfficiency,
    soloMaintenanceDiscountFactor: maintenanceDiscountFactor - rewardDistributionDiscount,
  });
  const soloEquivSats = solo.soloEquivSats;

  const leagueEnergyEfficiency = leagueWeightedEnergyEfficiency ?? userEnergyEfficiency;
  const elapsedMinerWarsDays = elapsedComparisonDates.filter((date) => !solodays.has(date)).length;

  const clanNamesByGroup = new Map<string, string | null>(
    groupData.map((group) => [groupKey(group.leagueId, group.clanId), group.clanName]),
  );

  const maintenanceInputs: MaintenanceRecomputeInputs = {
    userRounds,
    completedRoundsMap,
    userPowerByDate,
    clanPowerByDate,
    clanTerahashByDate,
    currentClanPower,
    clanNftPower,
    lastUserPower,
    roundRewards,
    solodays,
    sumAllMultipliers,
    soloEquivSats,
    elapsedMinerWarsDays,
    userEnergyEfficiency,
    leagueEnergyEfficiency,
    maintenanceBtcPrice,
    maintenanceGmtPrice,
    historicalPrices,
    maintenanceDiscountFactor,
    maintenanceGmtDiscount,
    actualMinerWarsBtc,
    minerWarsSatsBase,
    btcPerBlock,
    roundContextById,
    today: TODAY,
    currentLeagueId: leagueId,
    currentClanId: clanId,
    clanNamesByGroup,
  };
  cacheMaintenanceInputs(cycleId, maintenanceInputs);

  const {
    minerWarsSats,
    diffSats: differenceSats,
    differencePercent,
    maintenanceBtc,
    maintenanceGmt,
    maintenanceUsd,
    rewardGmt,
    netBtc,
    netGmt,
    netUsd,
    minerWarsGmt,
    zeroedRounds,
    zeroedRoundsHint,
  } = computeMaintenanceAndNet(maintenanceInputs, leagueDiscountPercent);

  const targets = computeTargets({
    cycleDates,
    fullCycleDates: buildDateRange(CYCLE_START, CYCLE_END),
    elapsedComparisonDates,
    isCycleLive,
    today: TODAY,
    soloDays: solodays,
    satsPerTerahashByDate,
    latestSatsPerTerahash,
    userPowerByDate,
    lastUserPower,
    clanTerahashByDate,
    clanPowerByDate,
    lastClanPower: currentClanPower ?? clanNftPower ?? 0,
    clanTenureStartDate,
    historicalPrices,
    maintenanceBtcPrice,
    maintenanceGmtPrice,
  });

  const progressPercent =
    targets.targetSoloSats > 0 ? (minerWarsSats / targets.targetSoloSats) * 100 : null;
  const cycleDateSet = new Set(cycleDates);
  const soloDaysSorted = [...solodays].filter((date) => cycleDateSet.has(date)).sort();
  const windowLabel =
    soloDaysSorted.length === 0 ? "full cycle" : `excl. solo day(s): ${soloDaysSorted.join(", ")}`;

  return {
    cycleId,
    cycleStart: CYCLE_START,
    cycleEnd: CYCLE_END,
    today: TODAY,
    minerWarsSats,
    clanMinerWarsSats,
    btcFundBtc: btcFund,
    soloEquivSats,
    diffSats: differenceSats,
    diffPct: differencePercent,
    targetSoloSats: targets.targetSoloSats,
    progressPct: progressPercent,
    targetActualDays: targets.targetActualDays,
    targetProjectedDays: targets.targetProjectedDays,
    latestSatsPerTH: latestSatsPerTerahash,
    windowLabel,
    soloDays: soloDaysSorted,
    hasClanAnalytics: clanPowerByDate.size > 0,
    btcFundIsZero: btcFund === 0,
    actualMinerWarsBtc,
    clanTargetSoloSats: targets.clanTargetSoloSats,
    clanTargetActualDays: targets.clanTargetActualDays,
    clanTargetProjectedDays: targets.clanTargetProjectedDays,
    btcPerBlockSats: totalMinedBlocks > 0 ? (btcFund / totalMinedBlocks) * 1e8 : null,
    cycleLength: cycleDates.length,
    maintenanceBtc,
    maintenanceGmt,
    maintenanceUsd,
    rewardGmt,
    netBtc,
    netGmt,
    netUsd,
    minerWarsGmt,
    minerWarsUsd: null,
    soloEquivGmt: solo.soloEquivGmt,
    targetSoloGmt: targets.targetSoloGmt,
    soloMaintenanceBtc: solo.soloMaintenanceBtc,
    soloMaintenanceGmt: solo.soloMaintenanceGmt,
    soloMaintenanceUsd: solo.soloMaintenanceUsd,
    soloNetBtc: solo.soloNetBtc,
    soloNetGmt: solo.soloNetGmt,
    soloNetUsd: solo.soloNetUsd,
    btcPrice: maintenanceBtcPrice > 0 ? maintenanceBtcPrice : null,
    gmtPrice: maintenanceGmtPrice > 0 ? maintenanceGmtPrice : null,
    zeroedRounds,
    zeroedRoundsHint,
    leagueDiscountPct: leagueDiscountPercent,
    personalDiscountPct: 1 - maintenanceDiscountFactor,
    rewardDistributionDiscountPct: rewardDistributionDiscount,
    personalGmtRewards,
    personalBlocksMined,
    personalBoostCostGmt,
  };
}
