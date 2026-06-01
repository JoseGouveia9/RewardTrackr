import { buildApiHeaders } from "@/lib/http";
import { fetchDifficultyEpochs } from "@/features/export/api/difficulty-adjustments";
import { cycleEndFromStart, toDateStr } from "../types/minerwars";
import {
  resolveCycleStatus,
  loadPersistedCycles,
  persistCycles,
  loadPersistedComparison,
  persistComparison,
  getPaymentDataFromBuildCache,
  getSoloDaysFromBuildCache,
  deletePersistedComparison,
} from "../utils/minerwars-cache";
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
  getMinerWarsActualIncome,
  getMyNftAvgEE,
  getSoloMiningDates,
  getUserPowerChart,
} from "./minerwars-api";

// Re-export types so existing import paths keep working
export type { CycleStatus, CycleInfo, MinerWarsComparison } from "../types/minerwars";

import type { CycleInfo, MinerWarsComparison } from "../types/minerwars";

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
  cyclesCache = null;
  clearPowerChartCache();
}

export function invalidateCycleCache(cycleId: number): void {
  comparisonCache.delete(cycleId);
  inFlightRequests.delete(cycleId);
  deletePersistedComparison(cycleId);
}

// Returns null when no in-memory or localStorage entry exists.
export function getCachedMinerWarsComparison(cycleId: number): MinerWarsComparison | null {
  const mem = comparisonCache.get(cycleId);
  if (mem) return mem.data;

  const persisted = loadPersistedComparison(cycleId);
  if (!persisted) return null;

  comparisonCache.set(cycleId, { data: persisted.data, ts: persisted.ts });
  return persisted.data;
}

// Returns null when no cache exists (does not fetch from the API).
export function getCachedCycles(): CycleInfo[] | null {
  if (cyclesCache) return withResolvedStatuses(cyclesCache.data);
  const persisted = loadPersistedCycles();
  if (persisted) {
    cyclesCache = persisted;
    return withResolvedStatuses(persisted.data);
  }
  return null;
}

// Falls back to the API when cache is empty; requires a valid token.
export async function fetchAvailableCycles(token: string): Promise<CycleInfo[]> {
  if (cyclesCache) return withResolvedStatuses(cyclesCache.data);

  const persisted = loadPersistedCycles();
  if (persisted) {
    cyclesCache = persisted;
    return withResolvedStatuses(persisted.data);
  }

  const data = await fetchAllCyclesFromApi(buildApiHeaders(token));
  cyclesCache = { data, ts: Date.now() };
  persistCycles(data);
  return withResolvedStatuses(data);
}

// Pre-computes comparisons for completed cycles not yet persisted.
// Runs 1x getUserPowerChart + 1x fetchDifficultyEpochs (both cached) and 0 API calls per
// cycle when solo-mining data is already in the build cache. Call after export completes.
export async function prefetchAllCompletedCycles(token: string): Promise<void> {
  const TODAY = new Date().toISOString().slice(0, 10);
  const headers = buildApiHeaders(token);

  let cycles: CycleInfo[];
  try {
    cycles = await fetchAvailableCycles(token);
  } catch {
    return;
  }

  const todo = cycles.filter(
    (c) => c.cycleEnd < TODAY && loadPersistedComparison(c.cycleId) == null,
  );
  if (todo.length === 0) return;

  const toProcess = todo.filter((c) => {
    const payDay = new Date(c.cycleEnd + "T00:00:00Z");
    payDay.setUTCDate(payDay.getUTCDate() + 1);
    return getPaymentDataFromBuildCache(payDay.toISOString().slice(0, 10)) !== null;
  });
  if (toProcess.length === 0) return;

  const earliestStart = toProcess.reduce(
    (min, c) => (c.cycleStart < min ? c.cycleStart : min),
    toProcess[0].cycleStart,
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

  for (const cycle of toProcess) {
    try {
      const { cycleId, cycleStart: CYCLE_START, cycleEnd: CYCLE_END } = cycle;

      const payDay = new Date(CYCLE_END + "T00:00:00Z");
      payDay.setUTCDate(payDay.getUTCDate() + 1);
      const payData = getPaymentDataFromBuildCache(payDay.toISOString().slice(0, 10));
      if (payData === null) continue;
      const {
        actualBtc: actualMinerWarsBtc,
        btcPrice: histBtcPrice,
        gmtPrice: histGmtPrice,
      } = payData;

      const cycleDates: string[] = [];
      for (let d = new Date(CYCLE_START + "T00:00:00Z"); ; d.setUTCDate(d.getUTCDate() + 1)) {
        const s = d.toISOString().slice(0, 10);
        cycleDates.push(s);
        if (s === CYCLE_END) break;
      }
      const cycleDateSet = new Set(cycleDates);

      const satsPerThByDate = new Map<string, number>();
      for (const dateStr of cycleDates) {
        let applicable: (typeof epochs)[0] | null = null;
        for (const ep of epochs) {
          if (ep.date <= dateStr) applicable = ep;
        }
        if (applicable) satsPerThByDate.set(dateStr, applicable.satsPerTH);
      }
      const latestSatsPerTH = epochs[epochs.length - 1]?.satsPerTH ?? null;

      const solodayCandidates =
        getSoloDaysFromBuildCache(CYCLE_START, CYCLE_END) ??
        (await getSoloMiningDates(headers, CYCLE_START, CYCLE_END));

      let soloEquivSats = 0;
      let targetSoloSats = 0;
      let targetActualDays = 0;
      for (const dateStr of cycleDates) {
        if (solodayCandidates.has(dateStr)) continue;
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
      const soloDaysSorted = [...solodayCandidates].filter((d) => cycleDateSet.has(d)).sort();
      const windowLabel =
        soloDaysSorted.length === 0
          ? "full cycle"
          : `excl. solo day(s): ${soloDaysSorted.join(", ")}`;

      const result: MinerWarsComparison = {
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
        hasClanAnalytics: true,
        btcFundIsZero: false,
        actualMinerWarsBtc,
        clanTargetSoloSats: null,
        btcPerBlockSats: null,
        cycleLength: cycleDates.length,
        maintenanceBtc: null,
        maintenanceGmt: null,
        rewardGmt: null,
        netBtc: null,
        netGmt: null,
        btcPrice: histBtcPrice,
        gmtPrice: histGmtPrice,
      };

      persistComparison(result);
      comparisonCache.set(cycleId, { data: result, ts: Date.now() });
    } catch {
      // continue with next cycle on any per-cycle error
    }
  }
}

export function fetchMinerWarsComparison(
  token: string,
  targetCycleId: number | null = null,
): Promise<MinerWarsComparison> {
  const TODAY = new Date().toISOString().slice(0, 10);

  // Fast path: read from localStorage when available; use the refresh button to force a live re-fetch.
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

  // Fast path for ended cycles: gate on date only, do NOT rely on build cache to classify as "completed".
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
    const [
      { byDate: satsPerThByDate, latestSatsPerTH },
      solodays,
      actualMinerWarsBtc,
      userPowerByDate,
    ] = await Promise.all([
      getMempoolEpochs(cycleDates),
      cachedSoloDays != null
        ? Promise.resolve(cachedSoloDays)
        : getSoloMiningDates(headers, CYCLE_START, CYCLE_END),
      getMinerWarsActualIncome(headers, CYCLE_END),
      getUserPowerChart(headers, cycleStartDate),
    ]);

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

    const minerWarsSats = actualMinerWarsBtc != null ? actualMinerWarsBtc * 1e8 : 0;
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
      maintenanceBtc: null,
      maintenanceGmt: null,
      rewardGmt: null,
      netBtc: null,
      netGmt: null,
      btcPrice: payData?.btcPrice ?? null,
      gmtPrice: payData?.gmtPrice ?? null,
    };

    comparisonCache.set(cycleId, { data: completedResult, ts: Date.now() });
    persistComparison(completedResult);
    return completedResult;
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

  const { btcFund, totalMinedBlocks, clanNftPower, leagueWeightedEE } = await getCycleClanData(
    headers,
    cycleStartDate,
    leagueId,
    clanId,
  );
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

  // Live cycles have a one-day funding lag: day 1 is funded on day 2.
  // For elapsed solo-equivalent comparisons, exclude cycle day 1 while live.
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
    // Clan reward: new validated formula - btcFund / totalMinedBlocks * multiplier
    const clanReward = btcPerBlock * round.multiplier;
    // User reward: validated estimation - power-weighted share of old formula base
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
    maintDiscountFactor,
    maintPrices,
    maintUserEE,
  ] = await Promise.all([
    getMempoolEpochs(cycleDates),
    getSoloMiningDates(headers, CYCLE_START, CYCLE_END),
    Promise.resolve(null),
    getDiscountFactor(headers).catch(() => 1),
    getLivePrices().catch(() => ({ btcPrice: 0, gmtPrice: 0 })),
    getMyNftAvgEE(headers).catch(() => null),
  ]);

  let minerWarsSats = 0;
  let clanMinerWarsSats = 0;
  for (const { userBtc, clanBtc, date } of roundRewards.values()) {
    if (!solodays.has(date)) {
      minerWarsSats += userBtc * 1e8;
      clanMinerWarsSats += clanBtc * 1e8;
    }
  }

  let soloEquivSats = 0;
  for (const dateStr of elapsedComparisonDates) {
    if (solodays.has(dateStr)) continue;
    const userPow = userPowerByDate.has(dateStr)
      ? userPowerByDate.get(dateStr)!
      : (lastUserPower ?? 0);
    const satsPerTH = satsPerThByDate.get(dateStr) ?? latestSatsPerTH;
    if (satsPerTH != null && userPow) soloEquivSats += satsPerTH * userPow;
  }

  const diffSats = minerWarsSats - soloEquivSats;
  const diffPct = soloEquivSats > 0 ? (diffSats / soloEquivSats) * 100 : null;

  // Maintenance estimation (per-round official formula)
  const KWH = 0.05; // $/kWh - GoMining platform constant
  const SVC = 0.0089; // $/TH/day - GoMining platform constant
  const userEE = maintUserEE ?? 15;
  const leagueEE = leagueWeightedEE ?? userEE;
  const elapsedMWDays = elapsedComparisonDates.filter((d) => !solodays.has(d)).length;
  const { btcPrice: maintBtcPrice, gmtPrice: maintGmtPrice } = maintPrices;

  let maintenanceBtc: number | null = null;
  let maintenanceGmt: number | null = null;
  let rewardGmt: number | null = null;
  let netBtc: number | null = null;
  let netGmt: number | null = null;

  if (maintBtcPrice > 0 && elapsedMWDays > 0) {
    let totalMaintUSD = 0;
    let cumulativeMWSats = 0;
    const sortedForMaint = [...userRounds].sort((a, b) => a.roundId - b.roundId);
    for (const round of sortedForMaint) {
      const roundDate = toDateStr(round.endedAt);
      if (solodays.has(roundDate)) continue;
      const entry = completedRoundsMap.get(round.roundId);
      const roundPower = entry?.power ?? 0;
      const userTH = userPowerByDate.has(roundDate)
        ? userPowerByDate.get(roundDate)!
        : (lastUserPower ?? 0);
      const isToday = roundDate >= TODAY;
      const clanTH = clanPowerByDate.has(roundDate)
        ? clanPowerByDate.get(roundDate)!
        : isToday
          ? (currentClanPower ?? clanNftPower ?? 1)
          : (clanNftPower ?? 1);
      const EE = cumulativeMWSats < soloEquivSats ? userEE : leagueEE;
      const roundElecUSD = (KWH * 24 * elapsedMWDays * roundPower * EE) / 1000;
      const roundSvcUSD = SVC * elapsedMWDays * roundPower;
      const share =
        clanTH > 0 && sumAllMultipliers > 0
          ? (round.multiplier / sumAllMultipliers) * (userTH / clanTH)
          : 0;
      totalMaintUSD += (roundElecUSD + roundSvcUSD) * share * maintDiscountFactor;
      cumulativeMWSats += btcPerBlock * round.multiplier * (clanTH > 0 ? userTH / clanTH : 0) * 1e8;
    }
    maintenanceBtc = totalMaintUSD / maintBtcPrice;
    maintenanceGmt = maintGmtPrice > 0 ? totalMaintUSD / maintGmtPrice : null;
    const effectiveMwBtc = actualMinerWarsBtc ?? minerWarsSats / 1e8;
    rewardGmt = maintGmtPrice > 0 ? (effectiveMwBtc * maintBtcPrice) / maintGmtPrice : null;
    netBtc = effectiveMwBtc - maintenanceBtc;
    netGmt = rewardGmt != null && maintenanceGmt != null ? rewardGmt - maintenanceGmt : null;
  }

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
        targetSoloSats += satsPerTH * userPow;
        if (isPast) targetActualDays++;
        else targetProjectedDays++;
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
    rewardGmt,
    netBtc,
    netGmt,
    btcPrice: maintBtcPrice > 0 ? maintBtcPrice : null,
    gmtPrice: maintGmtPrice > 0 ? maintGmtPrice : null,
  };

  comparisonCache.set(cycleId, { data: result, ts: Date.now() });
  persistComparison(result);
  return result;
}
