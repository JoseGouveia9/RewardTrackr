import { buildApiHeaders } from "@/lib/http";
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
  getCurrentClanPower,
  getCycleRounds,
  getCycleClanData,
  getDiscountFactor,
  getLivePrices,
  getMempoolEpochs,
  getMyNftAvgEE,
  getSoloMiningDates,
  getUserPowerChart,
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
): Promise<MinerWarsComparison> {
  const TODAY = new Date().toISOString().slice(0, 10);

  if (targetCycleId !== null) {
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

  if (targetCycleId !== null) {
    const existing = inFlightRequests.get(targetCycleId);
    if (existing) return existing;
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

  const allCycleRounds = await getAllRoundsInCycle(headers, cycleId, leagueId);
  const completedRounds = allCycleRounds.filter((r) => !r.active && r.power > 0);
  const sumAllMultipliers = completedRounds.reduce((s, r) => s + r.multiplier, 0);
  const totalPowerSum = completedRounds.reduce((s, r) => s + r.power, 0);
  const avgRoundNftPower = completedRounds.length > 0 ? totalPowerSum / completedRounds.length : 1;
  const completedRoundsMap = new Map(completedRounds.map((r) => [r.id, r]));

  const { btcFund, totalMinedBlocks, clanNftPower, leagueWeightedEE, leagueWeightedAvgDiscount } =
    await getCycleClanData(headers, cycleStartDate, leagueId, clanId);
  const btcPerBlock = totalMinedBlocks > 0 ? btcFund / totalMinedBlocks : 0;

  const [userPowerByDate, clanPowerByDate, currentClanPower] = await Promise.all([
    getUserPowerChart(headers, cycleStartDate),
    getClanPowerAnalytics(headers, clanId),
    getCurrentClanPower(headers, clanId),
  ]);

  const lastUserPower =
    userPowerByDate.size > 0 ? ([...userPowerByDate.values()].slice(-1)[0] ?? null) : null;

  const CYCLE_END = CYCLE_END_CHECK;
  const CYCLE_START = cycleStartDate.slice(0, 10);
  const isCycleLive = TODAY >= CYCLE_START && TODAY <= CYCLE_END;

  const cycleCutoff = CYCLE_END < TODAY ? CYCLE_END : TODAY;
  const cycleDates: string[] = [];
  for (
    let d = new Date(cycleStartDate);
    d.toISOString().slice(0, 10) <= cycleCutoff;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    cycleDates.push(d.toISOString().slice(0, 10));
  }

  const elapsedComparisonDates = isCycleLive ? cycleDates.slice(1) : cycleDates;

  const roundRewards = new Map<number, { userBtc: number; clanBtc: number; date: string }>();
  for (const round of userRounds) {
    const entry = completedRoundsMap.get(round.roundId);
    if (!entry) continue;

    const roundDate = toDateStr(round.endedAt);
    const isToday = roundDate >= TODAY;
    const effectiveUserPower = userPowerByDate.has(roundDate)
      ? userPowerByDate.get(roundDate)!
      : (lastUserPower ?? 0);
    const effectiveClanPower = clanPowerByDate.has(roundDate)
      ? clanPowerByDate.get(roundDate)!
      : isToday
        ? (currentClanPower ?? clanNftPower ?? 1)
        : (clanNftPower ?? 1);

    const powerRatio = entry.power / avgRoundNftPower;
    const clanReward = btcPerBlock * round.multiplier;
    const userReward =
      effectiveClanPower > 0
        ? ((round.multiplier / sumAllMultipliers) * btcFund * powerRatio * effectiveUserPower) /
          effectiveClanPower
        : 0;

    roundRewards.set(round.roundId, { userBtc: userReward, clanBtc: clanReward, date: roundDate });
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
  let clanMinerWarsSats = 0;
  for (const { userBtc, clanBtc, date } of roundRewards.values()) {
    if (!solodays.has(date)) {
      minerWarsSatsBase += userBtc * 1e8;
      clanMinerWarsSats += clanBtc * 1e8;
    }
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
  let targetSoloGmtHist = 0;
  let hasTargetSoloGmt = false;
  const lastClanPower = currentClanPower ?? clanNftPower ?? 0;

  for (const dateStr of fullCycleDates) {
    const isPast = elapsedComparisonDates.includes(dateStr);
    const satsPerTH = isPast ? (satsPerThByDate.get(dateStr) ?? latestSatsPerTH) : latestSatsPerTH;

    if (!solodays.has(dateStr)) {
      const userPow = isPast
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

    const clanPow = isPast
      ? clanPowerByDate.has(dateStr)
        ? clanPowerByDate.get(dateStr)!
        : lastClanPower
      : lastClanPower;
    if (satsPerTH != null && clanPow) clanTargetSoloSats += satsPerTH * clanPow;
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
    const { loadCacheEntry, saveCacheEntry, MINERWARS_SCHEMA_VERSION } =
      await import("@/lib/reward-cache");
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
          schemaVersion: MINERWARS_SCHEMA_VERSION,
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
