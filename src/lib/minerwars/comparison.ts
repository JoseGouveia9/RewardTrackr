import { buildApiHeaders } from "@/lib/http";
import { mapWithConcurrency } from "@/lib/concurrency";
import { FORCE_FETCH_FAIL } from "@/lib/dev-flags";
import { cycleEndFromStart, toDateStr } from "./types";
import {
  resolveCycleStatus,
  loadPersistedCycles,
  persistCycles,
  loadPersistedComparison,
  persistComparison,
  getPaymentDataFromBuildCache,
  getActualIncomeFromBuildCache,
  getSoloDaysFromBuildCache,
  deletePersistedComparison,
  type HistoricalPriceEntry,
} from "./cache";
import { buildDateRange, addUtcDays } from "./date-range";
import {
  clearPowerChartCache,
  fetchAllCyclesFromApi,
  getAllRoundsInCycle,
  getClanPowerAnalytics,
  getClanThByDate,
  getCurrentClanPower,
  getCycleRounds,
  getCycleClanData,
  getDiscountFactor,
  getLivePrices,
  getMempoolEpochs,
  getMyNftAvgEE,
  getSoloMiningDates,
  getUserPowerChart,
  type RoundRow,
} from "./api";
import { computeMaintenanceAndNet } from "./comparison-maintenance";
import {
  cacheMaintInputs,
  clearMaintInputsCache,
  deletePersistedMaintInputs,
  getHistoricalPricesCached,
  historicalGmtPerBtc,
  type MaintenanceRecomputeInputs,
} from "./comparison-maintenance-store";
import { prefetchCompletedCycleComparisons } from "./comparison-completed-prefetch";

export type { CycleStatus, CycleInfo, MinerWarsComparison } from "./types";
export { getSimulationDefaults, simulateMaintenanceAndNet } from "./comparison-maintenance";
export type { SimulationDefaults, SimulationInputs } from "./comparison-maintenance";

import type { CycleInfo, MinerWarsComparison } from "./types";
import type { RewardRecord } from "@/types/rewards";

const comparisonCache = new Map<number, { data: MinerWarsComparison; ts: number }>();
const inFlightRequests = new Map<number, Promise<MinerWarsComparison>>();
let cyclesCache: { data: CycleInfo[]; ts: number } | null = null;

function withResolvedStatuses(cycles: CycleInfo[]): CycleInfo[] {
  const today = new Date().toISOString().slice(0, 10);
  return cycles.map((c) => ({
    ...c,
    status: resolveCycleStatus(c.cycleEnd, today),
  }));
}

export function invalidateMinerWarsCache() {
  comparisonCache.clear();
  inFlightRequests.clear();
  clearMaintInputsCache();
  cyclesCache = null;
  clearPowerChartCache();
}

export function invalidateCycleCache(cycleId: number): void {
  comparisonCache.delete(cycleId);
  inFlightRequests.delete(cycleId);
  clearMaintInputsCache(cycleId);
  deletePersistedMaintInputs(cycleId);
  deletePersistedComparison(cycleId);
}

export function getCachedMinerWarsComparison(cycleId: number): MinerWarsComparison | null {
  const mem = comparisonCache.get(cycleId);
  if (mem) return mem.data;

  const persisted = loadPersistedComparison(cycleId);
  if (!persisted) return null;

  comparisonCache.set(cycleId, { data: persisted.data, ts: persisted.ts });
  return persisted.data;
}

export function userHasMinerWarsHistory(): boolean {
  const cycles = getCachedCycles();
  return cycles === null || cycles.length > 0;
}

export function getCachedCycles(): CycleInfo[] | null {
  if (cyclesCache) return cyclesCache.data;
  const persisted = loadPersistedCycles();
  if (persisted) {
    cyclesCache = persisted;
    return persisted.data;
  }
  return null;
}

export async function fetchAvailableCycles(token: string): Promise<CycleInfo[]> {
  const data = await fetchAllCyclesFromApi(buildApiHeaders(token));
  cyclesCache = { data, ts: Date.now() };

  const resolved = withResolvedStatuses(data);
  cyclesCache = { data: resolved, ts: cyclesCache.ts };
  persistCycles(resolved);
  return resolved;
}

export async function prefetchAllCompletedCycles(
  token: string,
  prefetchedCycles?: CycleInfo[],
): Promise<void> {
  const TODAY = new Date().toISOString().slice(0, 10);
  const cycles = prefetchedCycles ?? (await fetchAvailableCycles(token).catch(() => null));
  if (!cycles) return;

  await prefetchCompletedCycleComparisons({
    token,
    cycles,
    today: TODAY,
    onCyclePrepared: (cycleId, result) => {
      comparisonCache.delete(cycleId);
      comparisonCache.set(cycleId, { data: result, ts: Date.now() });
    },
  });
}

export function fetchMinerWarsComparison(
  token: string,
  targetCycleId: number | null = null,
  options?: { forceRefresh?: boolean },
): Promise<MinerWarsComparison> {
  const TODAY = new Date().toISOString().slice(0, 10);
  const forceRefresh = options?.forceRefresh === true;

  if (targetCycleId !== null && !forceRefresh) {
    const persisted = loadPersistedComparison(targetCycleId);
    if (persisted) {
      const statusNow = resolveCycleStatus(persisted.data.cycleEnd, TODAY);
      const hasActual = persisted.data.actualMinerWarsBtc != null;
      const shouldRecompute = statusNow === "completed" && !hasActual;
      if (!shouldRecompute) {
        comparisonCache.set(targetCycleId, { data: persisted.data, ts: persisted.ts });
        return Promise.resolve(persisted.data);
      }
    }
  }

  if (targetCycleId !== null && !forceRefresh) {
    const existing = inFlightRequests.get(targetCycleId);
    if (existing) return existing;
  }

  if (targetCycleId !== null && forceRefresh) {
    comparisonCache.delete(targetCycleId);
  }

  const promise = _doFetchMinerWarsComparison(token, targetCycleId, TODAY);

  if (targetCycleId !== null) {
    inFlightRequests.set(targetCycleId, promise);
    promise.finally(() => inFlightRequests.delete(targetCycleId));
  }

  return promise;
}

async function _doFetchMinerWarsComparison(
  token: string,
  targetCycleId: number | null,
  TODAY: string,
): Promise<MinerWarsComparison> {
  if (FORCE_FETCH_FAIL) throw new Error("Forced MinerWars fetch failure (test)");
  const headers = buildApiHeaders(token);

  const {
    cycleId,
    cycleStartDate,
    rounds: userRounds,
  } = await getCycleRounds(headers, targetCycleId);
  if (!cycleId || !cycleStartDate || userRounds.length === 0) {
    throw new Error("No rounds found for selected cycle");
  }

  const CYCLE_END_CHECK = cycleEndFromStart(cycleStartDate.slice(0, 10));
  const cached = comparisonCache.get(cycleId);
  if (cached) return cached.data;

  if (CYCLE_END_CHECK < TODAY) {
    const CYCLE_START = cycleStartDate.slice(0, 10);
    const CYCLE_END = CYCLE_END_CHECK;

    const cycleDates: string[] = [];
    for (let d = new Date(CYCLE_START + "T00:00:00Z"); ; d.setUTCDate(d.getUTCDate() + 1)) {
      const s = d.toISOString().slice(0, 10);
      cycleDates.push(s);
      if (s === CYCLE_END) break;
    }

    const cachedSoloDays = getSoloDaysFromBuildCache(CYCLE_START, CYCLE_END);

    const payDay = new Date(CYCLE_END + "T00:00:00Z");
    payDay.setUTCDate(payDay.getUTCDate() + 1);
    const actualMinerWarsBtc = getActualIncomeFromBuildCache(payDay.toISOString().slice(0, 10));

    const [{ byDate: satsPerThByDate, latestSatsPerTH }, solodays, userPowerByDate] =
      await Promise.all([
        getMempoolEpochs(cycleDates),
        cachedSoloDays != null
          ? Promise.resolve(cachedSoloDays)
          : getSoloMiningDates(headers, CYCLE_START, CYCLE_END),
        getUserPowerChart(headers, cycleStartDate),
      ]);

    if (actualMinerWarsBtc != null) {
      const lastUserPower =
        userPowerByDate.size > 0 ? ([...userPowerByDate.values()].slice(-1)[0] ?? null) : null;

      let soloEquivSats = 0;
      let targetSoloSats = 0;
      let targetActualDays = 0;
      for (const dateStr of cycleDates) {
        if (solodays.has(dateStr)) continue;
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

      const minerWarsSats = actualMinerWarsBtc * 1e8;
      const diffSats = minerWarsSats - soloEquivSats;
      const diffPct = soloEquivSats > 0 ? (diffSats / soloEquivSats) * 100 : null;
      const progressPct = targetSoloSats > 0 ? (minerWarsSats / targetSoloSats) * 100 : null;

      const cycleDateSet = new Set(cycleDates);
      const soloDaysSorted = [...solodays].filter((d) => cycleDateSet.has(d)).sort();
      const windowLabel =
        soloDaysSorted.length === 0
          ? "full cycle"
          : `excl. solo day(s): ${soloDaysSorted.join(", ")}`;

      const payDay = new Date(CYCLE_END + "T00:00:00Z");
      payDay.setUTCDate(payDay.getUTCDate() + 1);
      const payData = getPaymentDataFromBuildCache(payDay.toISOString().slice(0, 10));

      const completedResult: MinerWarsComparison = {
        cycleId,
        cycleStart: CYCLE_START,
        cycleEnd: CYCLE_END,
        today: TODAY,
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
        hasClanAnalytics: false,
        btcFundIsZero: false,
        actualMinerWarsBtc,
        clanTargetSoloSats: null,
        clanTargetActualDays: 0,
        clanTargetProjectedDays: 0,
        btcPerBlockSats: null,
        cycleLength: cycleDates.length,
        maintenanceBtc: payData?.maintenanceBtc ?? null,
        maintenanceGmt: payData?.maintenanceGmt ?? null,
        maintenanceUsd: payData?.maintenanceUsd ?? null,
        rewardGmt: payData?.btcPrice ?? null,
        netBtc: payData != null ? actualMinerWarsBtc - payData.maintenanceBtc : null,
        netGmt: payData?.netGmt ?? null,
        netUsd: payData?.netUsd ?? null,
        minerWarsGmt: null,
        minerWarsUsd: payData?.usdTotal ?? null,
        soloEquivGmt: null,
        targetSoloGmt: null,
        btcPrice: payData?.btcPrice ?? null,
        gmtPrice: payData?.gmtPrice ?? null,
        zeroedRounds: null,
        zeroedRoundsHint: null,
        leagueDiscountPct: null,
        personalDiscountPct: null,
      };

      comparisonCache.set(cycleId, { data: completedResult, ts: Date.now() });
      persistComparison(completedResult);
      return completedResult;
    }
  }

  userRounds.sort((a, b) => b.roundId - a.roundId);
  const refRound = userRounds[0];
  const leagueId = refRound.leagueId;
  const clanId = refRound.clanId;

  // Group rounds by (leagueId, clanId): each already-won round carries its own accurate
  // historical leagueId/clanId, so a user who switches leagues/clans mid-cycle still has
  // every group's rounds fetched/valued using THAT group's own league/clan context —
  // instead of only the most-recently-seen one (which used to silently drop every round
  // won under a previous league/clan entirely).
  type LeagueGroup = { leagueId: number; clanId: number; rounds: RoundRow[] };
  const groupsByKey = new Map<string, LeagueGroup>();
  for (const round of userRounds) {
    const key = `${round.leagueId}:${round.clanId}`;
    let group = groupsByKey.get(key);
    if (!group) {
      group = { leagueId: round.leagueId, clanId: round.clanId, rounds: [] };
      groupsByKey.set(key, group);
    }
    group.rounds.push(round);
  }
  const groups = [...groupsByKey.values()];

  const userPowerByDate = await getUserPowerChart(headers, cycleStartDate);
  const lastUserPower =
    userPowerByDate.size > 0 ? ([...userPowerByDate.values()].slice(-1)[0] ?? null) : null;

  const CYCLE_END = CYCLE_END_CHECK;
  const CYCLE_START = cycleStartDate.slice(0, 10);
  const isCycleLive = TODAY >= CYCLE_START && TODAY <= CYCLE_END;

  type CycleRound = Awaited<ReturnType<typeof getAllRoundsInCycle>>[number];

  type GroupData = {
    leagueId: number;
    clanId: number;
    completedRounds: CycleRound[];
    completedRoundsMap: Map<number, { power: number }>;
    sumAllMultipliers: number;
    avgRoundNftPower: number;
    btcFund: number;
    totalMinedBlocks: number;
    btcPerBlock: number;
    clanNftPower: number | null;
    leagueWeightedEE: number | null;
    leagueWeightedAvgDiscount: number | null;
    clanPowerByDate: Map<string, number>;
    currentClanPower: number | null;
    myClanJoinDate: string | null;
    clanThByDate: Map<string, number>;
  };

  const groupData = await mapWithConcurrency(groups, 2, async (group): Promise<GroupData> => {
    const allCycleRounds = await getAllRoundsInCycle(headers, cycleId, group.leagueId);
    const completedRounds = allCycleRounds.filter((r) => !r.active && r.power > 0);
    const sumAllMultipliers = completedRounds.reduce((s, r) => s + r.multiplier, 0);
    const totalPowerSum = completedRounds.reduce((s, r) => s + r.power, 0);
    const avgRoundNftPower =
      completedRounds.length > 0 ? totalPowerSum / completedRounds.length : 1;
    const completedRoundsMap = new Map(completedRounds.map((r) => [r.id, r]));

    const { btcFund, totalMinedBlocks, clanNftPower, leagueWeightedEE, leagueWeightedAvgDiscount } =
      await getCycleClanData(headers, cycleStartDate, group.leagueId, group.clanId);
    const btcPerBlock = totalMinedBlocks > 0 ? btcFund / totalMinedBlocks : 0;

    const [clanPowerByDate, currentClanPowerInfo, clanThByDate] = await Promise.all([
      getClanPowerAnalytics(headers, group.clanId),
      getCurrentClanPower(headers, group.clanId),
      getClanThByDate(headers, completedRounds, group.leagueId, group.clanId, cycleStartDate).catch(
        () => new Map<string, number>(),
      ),
    ]);

    return {
      leagueId: group.leagueId,
      clanId: group.clanId,
      completedRounds,
      completedRoundsMap,
      sumAllMultipliers,
      avgRoundNftPower,
      btcFund,
      totalMinedBlocks,
      btcPerBlock,
      clanNftPower,
      leagueWeightedEE,
      leagueWeightedAvgDiscount,
      clanPowerByDate,
      currentClanPower: currentClanPowerInfo.power,
      myClanJoinDate: currentClanPowerInfo.myJoinDate ?? currentClanPowerInfo.createdAt,
      clanThByDate,
    };
  });

  const groupDataByKey = new Map(groupData.map((g) => [`${g.leagueId}:${g.clanId}`, g]));
  const currentGroup = groupDataByKey.get(`${leagueId}:${clanId}`)!;

  // Merged lookup across every league/clan group the user passed through this cycle
  // (round ids are globally unique, so this is a safe flat merge).
  const completedRoundsMap = new Map<number, { power: number }>();
  for (const g of groupData) {
    for (const [id, entry] of g.completedRoundsMap) completedRoundsMap.set(id, entry);
  }

  // "Current" league/clan values — kept for the handful of display/back-compat fields
  // that only make sense for a single league (e.g. the top-level btcFundBtc shown to
  // the user, which reflects their CURRENT clan's fund).
  const {
    completedRounds,
    btcFund,
    totalMinedBlocks,
    btcPerBlock,
    clanNftPower,
    leagueWeightedEE,
    leagueWeightedAvgDiscount,
    clanPowerByDate,
    currentClanPower,
    myClanJoinDate,
    clanThByDate,
    sumAllMultipliers,
  } = currentGroup;

  // First day the user has actually been a member of the CURRENT clan this cycle — a
  // mid-cycle clan switch means this can be later than CYCLE_START, so the clan's own
  // 7-day target must be scoped to this range, not the whole cycle.
  const clanTenureStart = myClanJoinDate != null ? toDateStr(myClanJoinDate) : null;
  const clanTenureStartDate =
    clanTenureStart != null && clanTenureStart > CYCLE_START ? clanTenureStart : CYCLE_START;

  const cycleCutoff = CYCLE_END < TODAY ? CYCLE_END : TODAY;
  const cycleDates: string[] = [];
  for (
    let d = new Date(cycleStartDate);
    d.toISOString().slice(0, 10) <= cycleCutoff;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    cycleDates.push(d.toISOString().slice(0, 10));
  }

  // A live cycle's day-1 fund/reward figures aren't settled yet (the round schedule
  // takes a day to populate), so day 1 is excluded from the elapsed-day count while the
  // cycle is still in progress. Once the cycle completes, its historical data is fully
  // settled, so no day is excluded then. (Confirmed against mobile: an earlier attempt to
  // drop this exclusion, believing it was a bug, was itself wrong — the diagnostic script
  // that "confirmed" it was misleading.)
  const elapsedComparisonDates = isCycleLive ? cycleDates.slice(1) : cycleDates;

  const roundRewards = new Map<number, { userBtc: number; clanBtc: number; date: string }>();
  const roundContextById = new Map<
    number,
    {
      clanTH: number;
      leagueEE: number | null;
      leagueDiscountFactor: number | null;
      btcPerBlock: number;
      sumAllMultipliers: number;
    }
  >();
  for (const round of userRounds) {
    const g = groupDataByKey.get(`${round.leagueId}:${round.clanId}`);
    if (!g) continue;
    const entry = g.completedRoundsMap.get(round.roundId);
    if (!entry) continue;

    const roundDate = toDateStr(round.endedAt);
    const isToday = roundDate >= TODAY;
    const effectiveUserPower = userPowerByDate.has(roundDate)
      ? userPowerByDate.get(roundDate)!
      : (lastUserPower ?? 0);
    const effectiveClanPower = g.clanThByDate.has(roundDate)
      ? g.clanThByDate.get(roundDate)!
      : g.clanPowerByDate.has(roundDate)
        ? g.clanPowerByDate.get(roundDate)!
        : isToday
          ? (g.currentClanPower ?? g.clanNftPower ?? 1)
          : (g.clanNftPower ?? 1);

    const powerRatio = entry.power / g.avgRoundNftPower;
    const clanReward = g.btcPerBlock * round.multiplier;
    const userReward =
      effectiveClanPower > 0
        ? ((round.multiplier / g.sumAllMultipliers) * g.btcFund * powerRatio * effectiveUserPower) /
          effectiveClanPower
        : 0;

    roundRewards.set(round.roundId, { userBtc: userReward, clanBtc: clanReward, date: roundDate });
    roundContextById.set(round.roundId, {
      clanTH: effectiveClanPower,
      leagueEE: g.leagueWeightedEE,
      leagueDiscountFactor:
        g.leagueWeightedAvgDiscount != null ? 1 - g.leagueWeightedAvgDiscount : null,
      btcPerBlock: g.btcPerBlock,
      sumAllMultipliers: g.sumAllMultipliers,
    });
  }

  const [
    { byDate: satsPerThByDate, latestSatsPerTH },
    solodays,
    actualMinerWarsBtc,
    maintDiscountData,
    maintPrices,
    maintUserEE,
    historicalPrices,
  ] = await Promise.all([
    getMempoolEpochs(cycleDates),
    getSoloMiningDates(headers, CYCLE_START, CYCLE_END),
    Promise.resolve(null),
    getDiscountFactor(headers).catch(() => ({ factor: 1, gmtDiscount: 0 })),
    getLivePrices().catch(() => ({ btcPrice: 0, gmtPrice: 0 })),
    getMyNftAvgEE(headers).catch(() => null),
    getHistoricalPricesCached(
      buildDateRange(CYCLE_START, CYCLE_END).map((d) => addUtcDays(d, 1)),
    ).catch(() => new Map<string, HistoricalPriceEntry>()),
  ]);
  const maintDiscountFactor = maintDiscountData.factor;
  const maintGmtDiscount = maintDiscountData.gmtDiscount;
  const leagueDiscountPct = leagueWeightedAvgDiscount;

  let minerWarsSatsBase = 0;
  for (const { userBtc, date } of roundRewards.values()) {
    if (!solodays.has(date)) minerWarsSatsBase += userBtc * 1e8;
  }

  // Only the CURRENT clan's own won rounds — not every clan the user passed through
  // this cycle (a mid-cycle clan switch must not combine old + new clan block rewards).
  const clanWonRounds = completedRounds.filter((r) => r.winnerClanId === clanId);
  let clanMinerWarsSats = 0;
  for (const round of clanWonRounds) {
    clanMinerWarsSats += btcPerBlock * round.multiplier * 1e8;
  }

  const { btcPrice: maintBtcPrice, gmtPrice: maintGmtPrice } = maintPrices;

  let soloEquivSats = 0;
  let soloEquivGmtHist = 0;
  let hasSoloEquivGmt = false;
  for (const dateStr of elapsedComparisonDates) {
    if (solodays.has(dateStr)) continue;
    const userPow = userPowerByDate.has(dateStr)
      ? userPowerByDate.get(dateStr)!
      : (lastUserPower ?? 0);
    const satsPerTH = satsPerThByDate.get(dateStr) ?? latestSatsPerTH;
    if (satsPerTH != null && userPow) {
      const daySats = satsPerTH * userPow;
      soloEquivSats += daySats;
      const rate = historicalGmtPerBtc(dateStr, historicalPrices, maintBtcPrice, maintGmtPrice);
      if (rate != null) {
        soloEquivGmtHist += (daySats / 1e8) * rate;
        hasSoloEquivGmt = true;
      }
    }
  }

  const userEE = maintUserEE ?? 15;
  const leagueEE = leagueWeightedEE ?? userEE;
  const elapsedMWDays = elapsedComparisonDates.filter((d) => !solodays.has(d)).length;

  const maintInputs: MaintenanceRecomputeInputs = {
    userRounds,
    completedRoundsMap,
    userPowerByDate,
    clanPowerByDate,
    clanThByDate,
    currentClanPower,
    clanNftPower,
    lastUserPower,
    roundRewards,
    solodays,
    sumAllMultipliers,
    soloEquivSats,
    elapsedMWDays,
    userEE,
    leagueEE,
    maintBtcPrice,
    maintGmtPrice,
    historicalPrices,
    maintDiscountFactor,
    maintGmtDiscount,
    actualMinerWarsBtc,
    minerWarsSatsBase,
    btcPerBlock,
    roundContextById,
    today: TODAY,
  };
  cacheMaintInputs(cycleId, maintInputs);

  const {
    minerWarsSats,
    diffSats,
    diffPct,
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
  } = computeMaintenanceAndNet(maintInputs, leagueDiscountPct);

  const fullCycleDates: string[] = [];
  for (let d = new Date(CYCLE_START + "T00:00:00Z"); ; d.setUTCDate(d.getUTCDate() + 1)) {
    const s = d.toISOString().slice(0, 10);
    fullCycleDates.push(s);
    if (s === CYCLE_END) break;
  }

  const cycleDateSet = new Set(cycleDates);
  let targetSoloSats = 0;
  let targetActualDays = 0;
  let targetProjectedDays = 0;
  let clanTargetSoloSats = 0;
  let clanTargetActualDays = 0;
  let clanTargetProjectedDays = 0;
  let targetSoloGmtHist = 0;
  let hasTargetSoloGmt = false;
  const lastClanPower = currentClanPower ?? clanNftPower ?? 0;
  // Dates the user has actually been a member of the CURRENT clan and that have already
  // occurred, mirroring elapsedComparisonDates but re-scoped to clan tenure: its first day
  // is excluded while the cycle is live (that day's clan-power data isn't settled yet
  // either), same as the whole-cycle day-1 exclusion above.
  const clanTenureDatesSoFar = cycleDates.filter((d) => d >= clanTenureStartDate);
  const clanElapsedDates = isCycleLive ? clanTenureDatesSoFar.slice(1) : clanTenureDatesSoFar;

  for (const dateStr of fullCycleDates) {
    // isPast (day-1-excluded while live) only counts "actual vs projected" reward days for
    // display — it does NOT gate which power/difficulty data to use. Day 1's TH power and
    // difficulty are already known even though its reward isn't settled yet, so use real
    // per-date data whenever the date has actually occurred.
    const isPast = elapsedComparisonDates.includes(dateStr);
    const dateOccurred = dateStr <= TODAY;
    const satsPerTH = dateOccurred
      ? (satsPerThByDate.get(dateStr) ?? latestSatsPerTH)
      : latestSatsPerTH;

    if (!solodays.has(dateStr)) {
      const userPow = dateOccurred
        ? userPowerByDate.has(dateStr)
          ? userPowerByDate.get(dateStr)!
          : (lastUserPower ?? 0)
        : (lastUserPower ?? 0);
      if (satsPerTH != null && userPow) {
        const daySats = satsPerTH * userPow;
        targetSoloSats += daySats;
        if (isPast) targetActualDays++;
        else targetProjectedDays++;
        const rate = historicalGmtPerBtc(dateStr, historicalPrices, maintBtcPrice, maintGmtPrice);
        if (rate != null) {
          targetSoloGmtHist += (daySats / 1e8) * rate;
          hasTargetSoloGmt = true;
        }
      }
    }

    // Days before the user joined the CURRENT clan don't count towards its target at all
    // (a mid-cycle switch must not inflate the clan's target with days spent elsewhere).
    if (dateStr < clanTenureStartDate) continue;

    const clanPow = dateOccurred
      ? clanThByDate.has(dateStr)
        ? clanThByDate.get(dateStr)!
        : clanPowerByDate.has(dateStr)
          ? clanPowerByDate.get(dateStr)!
          : lastClanPower
      : lastClanPower;
    if (satsPerTH != null && clanPow) clanTargetSoloSats += satsPerTH * clanPow;
    if (clanElapsedDates.includes(dateStr)) clanTargetActualDays++;
    else clanTargetProjectedDays++;
  }

  const progressPct = targetSoloSats > 0 ? (minerWarsSats / targetSoloSats) * 100 : null;
  const soloDaysSorted = [...solodays].filter((d) => cycleDateSet.has(d)).sort();
  const windowLabel =
    soloDaysSorted.length === 0 ? "full cycle" : `excl. solo day(s): ${soloDaysSorted.join(", ")}`;

  const result: MinerWarsComparison = {
    cycleId,
    cycleStart: CYCLE_START,
    cycleEnd: CYCLE_END,
    today: TODAY,
    minerWarsSats,
    clanMinerWarsSats,
    btcFundBtc: btcFund,
    soloEquivSats,
    diffSats,
    diffPct,
    targetSoloSats,
    progressPct,
    targetActualDays,
    targetProjectedDays,
    latestSatsPerTH,
    windowLabel,
    soloDays: soloDaysSorted,
    hasClanAnalytics: clanPowerByDate.size > 0,
    btcFundIsZero: btcFund === 0,
    actualMinerWarsBtc,
    clanTargetSoloSats: lastClanPower > 0 ? clanTargetSoloSats : null,
    clanTargetActualDays,
    clanTargetProjectedDays,
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
    soloEquivGmt: hasSoloEquivGmt ? soloEquivGmtHist : null,
    targetSoloGmt: hasTargetSoloGmt ? targetSoloGmtHist : null,
    btcPrice: maintBtcPrice > 0 ? maintBtcPrice : null,
    gmtPrice: maintGmtPrice > 0 ? maintGmtPrice : null,
    zeroedRounds,
    zeroedRoundsHint,
    leagueDiscountPct,
    personalDiscountPct: 1 - maintDiscountFactor,
  };

  comparisonCache.set(cycleId, { data: result, ts: Date.now() });
  persistComparison(result);
  return result;
}

export async function syncMinerWarsSheet(token: string): Promise<{ newEntries: number }> {
  try {
    const { REWARD_CONFIG_MAP } = await import("@/config/reward-configs");
    const { loadCacheEntry, saveCacheEntry } = await import("@/lib/reward-cache");
    const { postJson } = await import("@/lib/http");

    const config = REWARD_CONFIG_MAP["minerwars"];
    if (!config) return { newEntries: 0 };

    const prev = loadCacheEntry("minerwars");
    const prevCount = prev?.records.length ?? 0;
    const headers = buildApiHeaders(token);

    // Fetch minerwars records via direct API call (simplified approach)
    // Use same pagination as export-flow would use
    let allRecords: Record<string, unknown>[] = [];
    let skip = 0;
    const limit = 100;

    while (true) {
      const body = config.buildBody
        ? (config.buildBody as (skip: number) => Record<string, unknown>)(skip)
        : { skip, limit };
      try {
        const response = (await postJson(config.apiUrl, headers, body)) as Record<string, unknown>;
        const records = Array.isArray((response?.data as Record<string, unknown>)?.array)
          ? ((response.data as Record<string, unknown>).array as Record<string, unknown>[])
          : [];
        if (records.length === 0) break;
        allRecords = allRecords.concat(records);
        if (records.length < limit) break;
        skip += limit;
      } catch {
        break;
      }
    }

    if (allRecords.length === 0) return { newEntries: 0 };

    const newEntriesCount = Math.max(0, allRecords.length - prevCount);

    if (newEntriesCount > 0) {
      saveCacheEntry(
        "minerwars",
        config.sheetName,
        allRecords as unknown as RewardRecord[],
        allRecords.length,
        {
          extraFiatCurrency: prev?.extraFiatCurrency,
          pricingMode: prev?.pricingMode ?? "fiat-off",
          newEntriesCount,
        },
      );
    }

    return { newEntries: newEntriesCount };
  } catch {
    return { newEntries: 0 };
  }
}
