import { buildApiHeaders, postJson } from "@/lib/http";
import { cycleEndFromStart } from "../types";
import {
  resolveCycleStatus,
  loadPersistedCycles,
  persistCycles,
  loadPersistedComparison,
  persistComparison,
  deletePersistedComparison,
} from "../stores/cache";
import { fetchAllCyclesFromApi, getCycleRounds } from "../api/cycles";
import { clearPowerChartCache } from "../api/nft";
import {
  clearMaintenanceInputsCache,
  deletePersistedMaintenanceInputs,
} from "../stores/comparison-maintenance-store";
import { prefetchCompletedCycleComparisons } from "./comparison-completed-prefetch";
import { fetchCompletedComparison } from "./comparison-completed";
import { computeLiveComparison } from "./comparison-live";

import type { CycleInfo, MinerWarsComparison } from "../types";
import type { RewardRecord } from "@/types/rewards";

export type { CycleInfo, MinerWarsComparison } from "../types";

const comparisonCache = new Map<number, { data: MinerWarsComparison; ts: number }>();
const inFlightRequests = new Map<number, Promise<MinerWarsComparison>>();
let cyclesCache: { data: CycleInfo[]; ts: number } | null = null;

function withResolvedStatuses(cycles: CycleInfo[]): CycleInfo[] {
  const today = new Date().toISOString().slice(0, 10);
  return cycles.map((cycle) => ({
    ...cycle,
    status: resolveCycleStatus(cycle.cycleEnd, today),
  }));
}

export function invalidateMinerWarsCache() {
  comparisonCache.clear();
  inFlightRequests.clear();
  clearMaintenanceInputsCache();
  cyclesCache = null;
  clearPowerChartCache();
}

export function invalidateCycleCache(cycleId: number): void {
  comparisonCache.delete(cycleId);
  inFlightRequests.delete(cycleId);
  clearMaintenanceInputsCache(cycleId);
  deletePersistedMaintenanceInputs(cycleId);
  deletePersistedComparison(cycleId);
}

/** Memory first, then localStorage (promoted into memory); never hits the network. */
export function getCachedMinerWarsComparison(cycleId: number): MinerWarsComparison | null {
  const member = comparisonCache.get(cycleId);
  if (member) return member.data;

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

/** Warms persisted comparisons of completed cycles, fetching the cycle list when not given. */
export async function prefetchAllCompletedCycles(
  token: string,
  prefetchedCycles?: CycleInfo[],
  onProgress?: (done: number, total: number) => void,
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
    onProgress,
  });
}

/**
 * Reuses the persisted result and dedupes in-flight requests per cycle unless `forceRefresh`.
 * A cycle persisted before its payout landed is recomputed once it is completed.
 */
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

  const promise = computeMinerWarsComparison(token, targetCycleId, TODAY);

  if (targetCycleId !== null) {
    inFlightRequests.set(targetCycleId, promise);
    promise.finally(() => inFlightRequests.delete(targetCycleId));
  }

  return promise;
}

/** Ended cycles try the build-cache fast path first and fall back to the live computation. */
async function computeMinerWarsComparison(
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

  const cycleStart = cycleStartDate.slice(0, 10);
  const cycleEnd = cycleEndFromStart(cycleStart);
  const cached = comparisonCache.get(cycleId);
  if (cached) return cached.data;

  const completed =
    cycleEnd < TODAY
      ? await fetchCompletedComparison(
          headers,
          cycleId,
          cycleStartDate,
          cycleStart,
          cycleEnd,
          TODAY,
        )
      : null;
  const result =
    completed ??
    (await computeLiveComparison({
      headers,
      cycleId,
      cycleStartDate,
      cycleStart,
      cycleEnd,
      userRounds,
      today: TODAY,
    }));

  comparisonCache.set(cycleId, { data: result, ts: Date.now() });
  persistComparison(result);
  return result;
}

/** Re-pages the MinerWars reward history and saves it only when it has more rows than cached. */
export async function syncMinerWarsSheet(token: string): Promise<{ newEntries: number }> {
  try {
    const { REWARD_CONFIG_MAP } = await import("@/config/reward-configs");
    const { loadCacheEntry, saveCacheEntry } = await import("@/lib/reward-cache");

    const config = REWARD_CONFIG_MAP["minerwars"];
    if (!config) return { newEntries: 0 };

    const previousEntry = loadCacheEntry("minerwars");
    const previousCount = previousEntry?.records.length ?? 0;
    const headers = buildApiHeaders(token);

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

    const newEntriesCount = Math.max(0, allRecords.length - previousCount);

    if (newEntriesCount > 0) {
      saveCacheEntry(
        "minerwars",
        config.sheetName,
        allRecords as unknown as RewardRecord[],
        allRecords.length,
        {
          extraFiatCurrency: previousEntry?.extraFiatCurrency,
          pricingMode: previousEntry?.pricingMode ?? "fiat-off",
          newEntriesCount,
        },
      );
    }

    return { newEntries: newEntriesCount };
  } catch {
    return { newEntries: 0 };
  }
}
