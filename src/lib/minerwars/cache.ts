import {
  LS_KEY_MW_CLAN_PERF,
  LS_KEY_MW_COMPARISON,
  LS_KEY_MW_CYCLES,
  LS_KEY_MW_HISTORICAL_PRICES,
  LS_KEY_MW_ROUND_PARTICIPANTS,
  LS_KEY_REWARD_PREFIX,
} from "@/lib/storage-keys";
import { type CycleInfo, type MinerWarsComparison } from "./types";
import type { ClanPerformance } from "./clan-types";

export const MW_COMPARISON_SCHEMA_VERSION = 4;
export const MW_CLAN_PERF_SCHEMA_VERSION = 1;

export type CyclesStoreEntry = { data: CycleInfo[]; ts: number };

function parseObjectStore(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function persistSingleEntryStore(key: string, entryKey: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify({ [entryKey]: value }));
  } catch {
    // ignore quota errors
  }
}

export function loadPersistedCycles(): CyclesStoreEntry | null {
  try {
    const raw = localStorage.getItem(LS_KEY_MW_CYCLES);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data?: unknown; ts?: unknown };
    if (!Array.isArray(parsed.data) || typeof parsed.ts !== "number") return null;
    return { data: parsed.data as CycleInfo[], ts: parsed.ts };
  } catch {
    return null;
  }
}

export function persistCycles(data: CycleInfo[]): void {
  try {
    localStorage.setItem(LS_KEY_MW_CYCLES, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // ignore quota errors
  }
}

export type HistoricalPriceEntry = { btcUsd: number; gmtUsd: number };

export function loadHistoricalPrices(dates: string[]): Map<string, HistoricalPriceEntry> {
  const result = new Map<string, HistoricalPriceEntry>();
  try {
    const raw = localStorage.getItem(LS_KEY_MW_HISTORICAL_PRICES);
    if (!raw) return result;
    const store = JSON.parse(raw) as Record<string, HistoricalPriceEntry>;
    for (const date of dates) {
      const entry = store[date];
      if (entry && typeof entry.btcUsd === "number" && typeof entry.gmtUsd === "number") {
        result.set(date, entry);
      }
    }
  } catch {
    /* ignore */
  }
  return result;
}

export function persistHistoricalPrices(prices: Map<string, HistoricalPriceEntry>): void {
  if (prices.size === 0) return;
  try {
    const raw = localStorage.getItem(LS_KEY_MW_HISTORICAL_PRICES);
    const store = raw ? (JSON.parse(raw) as Record<string, HistoricalPriceEntry>) : {};
    for (const [date, price] of prices) {
      store[date] = price;
    }
    localStorage.setItem(LS_KEY_MW_HISTORICAL_PRICES, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export function loadPersistedComparison(
  cycleId: number,
): { data: MinerWarsComparison; ts: number } | null {
  try {
    const raw = localStorage.getItem(LS_KEY_MW_COMPARISON);
    if (!raw) return null;
    const store = JSON.parse(raw) as Record<string, unknown>;
    const entry = store[String(cycleId)] as
      | { data?: unknown; ts?: unknown }
      | MinerWarsComparison
      | undefined;
    if (!entry || typeof entry !== "object") return null;

    if ("data" in entry && "ts" in entry && typeof (entry as { ts?: unknown }).ts === "number") {
      const v = (entry as { v?: unknown }).v;
      if ((v as number | undefined) !== MW_COMPARISON_SCHEMA_VERSION) return null;
      return {
        data: (entry as { data: MinerWarsComparison }).data,
        ts: (entry as { ts: number }).ts,
      };
    }

    const legacy = entry as MinerWarsComparison;
    if (typeof legacy.cycleId === "number" && typeof legacy.cycleStart === "string") {
      const migrated = { data: legacy, ts: Date.now() };
      store[String(cycleId)] = migrated;
      localStorage.setItem(LS_KEY_MW_COMPARISON, JSON.stringify(store));
      return migrated;
    }

    return null;
  } catch {
    return null;
  }
}

export function persistComparison(data: MinerWarsComparison): void {
  const cycleKey = String(data.cycleId);
  const entry = { data, ts: Date.now(), v: MW_COMPARISON_SCHEMA_VERSION };
  try {
    const store = parseObjectStore(localStorage.getItem(LS_KEY_MW_COMPARISON));
    store[cycleKey] = entry;
    localStorage.setItem(LS_KEY_MW_COMPARISON, JSON.stringify(store));
  } catch {
    persistSingleEntryStore(LS_KEY_MW_COMPARISON, cycleKey, entry);
  }
}

function loadRewardCacheRecords(key: string): Array<Record<string, unknown>> | null {
  try {
    const raw = localStorage.getItem(LS_KEY_REWARD_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { records?: Array<Record<string, unknown>> };
    return Array.isArray(parsed.records) ? parsed.records : null;
  } catch {
    return null;
  }
}

export function getActualIncomeFromBuildCache(paymentDayStr: string): number | null {
  const records = loadRewardCacheRecords("minerwars");
  if (!records) return null;
  const matches = records.filter(
    (record) =>
      typeof record.createdAt === "string" &&
      (record.createdAt as string).slice(0, 10) === paymentDayStr,
  );
  if (matches.length === 0) return null;
  let total = 0;
  for (const record of matches) total += Number(record.poolReward ?? 0);
  return total;
}

export function getPaymentDataFromBuildCache(paymentDayStr: string): {
  actualBtc: number;
  btcPrice: number | null;
  gmtPrice: number | null;
  maintenanceBtc: number;
  maintenanceGmt: number | null;
  netBtc: number;
  netGmt: number | null;
  usdTotal: number | null;
  maintenanceUsd: number | null;
  netUsd: number | null;
} | null {
  const records = loadRewardCacheRecords("minerwars");
  if (!records) return null;
  const matches = records.filter(
    (record) =>
      typeof record.createdAt === "string" &&
      (record.createdAt as string).slice(0, 10) === paymentDayStr,
  );
  if (matches.length === 0) return null;

  let totalBtc = 0;
  let totalGmt = 0;
  let hasGmt = false;
  let btcPrice: number | null = null;
  let maintenanceBtc = 0;
  let maintenanceGmt = 0;
  let netBtc = 0;
  let netGmt = 0;

  let totalUsd = 0;
  let maintenanceUsd = 0;
  let netUsd = 0;
  let hasUsd = false;

  for (const record of matches) {
    totalBtc += Number(record.poolReward ?? 0);
    maintenanceBtc += Number(record.maintenance ?? 0);
    netBtc += Number(record.reward ?? 0);
    if (record.poolRewardGMT != null) {
      totalGmt += Number(record.poolRewardGMT);
      hasGmt = true;
    }
    if (record.maintenanceGMT != null) maintenanceGmt += Number(record.maintenanceGMT);
    if (record.rewardGMT != null) netGmt += Number(record.rewardGMT);
    if (btcPrice === null && record.btcPriceAtTime != null) {
      btcPrice = Number(record.btcPriceAtTime);
    }
    if (record.poolRewardUSD != null) {
      totalUsd += Number(record.poolRewardUSD);
      hasUsd = true;
    }
    if (record.maintenanceUSD != null) maintenanceUsd += Number(record.maintenanceUSD);
    if (record.rewardInUSD != null) netUsd += Number(record.rewardInUSD);
  }

  if (!hasGmt || totalBtc === 0) {
    return {
      actualBtc: totalBtc,
      btcPrice: null,
      gmtPrice: null,
      maintenanceBtc,
      maintenanceGmt: null,
      netBtc,
      netGmt: null,
      usdTotal: hasUsd ? totalUsd : null,
      maintenanceUsd: hasUsd ? maintenanceUsd : null,
      netUsd: hasUsd ? netUsd : null,
    };
  }

  return {
    actualBtc: totalBtc,
    btcPrice: totalGmt,
    gmtPrice: totalBtc,
    maintenanceBtc,
    maintenanceGmt,
    netBtc,
    netGmt,
    usdTotal: hasUsd ? totalUsd : null,
    maintenanceUsd: hasUsd ? maintenanceUsd : null,
    netUsd: hasUsd ? netUsd : null,
  };
}

export function getSoloDaysFromBuildCache(
  cycleStart: string,
  cycleEnd: string,
): Set<string> | null {
  const records = loadRewardCacheRecords("solo-mining");
  if (!records) return null;
  const dates = new Set<string>();
  for (const record of records) {
    if (typeof record.createdAt !== "string") continue;
    const dayBefore = new Date(record.createdAt as string);
    dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
    const miningDate = dayBefore.toISOString().slice(0, 10);
    if (miningDate >= cycleStart && miningDate <= cycleEnd) dates.add(miningDate);
  }
  return dates;
}

export function resolveCycleStatus(cycleEnd: string, today: string): import("./types").CycleStatus {
  if (cycleEnd >= today) return "in-progress";
  const paymentDay = new Date(cycleEnd + "T00:00:00Z");
  paymentDay.setUTCDate(paymentDay.getUTCDate() + 1);
  const paymentDayStr = paymentDay.toISOString().slice(0, 10);
  return getActualIncomeFromBuildCache(paymentDayStr) !== null ? "completed" : "pending";
}

export function deletePersistedComparison(cycleId: number): void {
  try {
    const raw = localStorage.getItem(LS_KEY_MW_COMPARISON);
    if (!raw) return;
    const store = parseObjectStore(raw);
    delete store[String(cycleId)];
    localStorage.setItem(LS_KEY_MW_COMPARISON, JSON.stringify(store));
  } catch {
    // ignore
  }
}

export function loadPersistedClanPerformance(cycleId: number): ClanPerformance | null {
  try {
    const raw = localStorage.getItem(LS_KEY_MW_CLAN_PERF);
    if (!raw) return null;
    const store = JSON.parse(raw) as Record<string, { data?: ClanPerformance; v?: number }>;
    const entry = store[String(cycleId)];
    if (!entry || entry.v !== MW_CLAN_PERF_SCHEMA_VERSION || !entry.data) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export function persistClanPerformance(cycleId: number, data: ClanPerformance): void {
  const cycleKey = String(cycleId);
  const entry = { data, v: MW_CLAN_PERF_SCHEMA_VERSION };
  try {
    const store = parseObjectStore(localStorage.getItem(LS_KEY_MW_CLAN_PERF));
    store[cycleKey] = entry;
    localStorage.setItem(LS_KEY_MW_CLAN_PERF, JSON.stringify(store));
  } catch {
    // Fall back to just the actively-viewed cycle when storage is tight.
    persistSingleEntryStore(LS_KEY_MW_CLAN_PERF, cycleKey, entry);
  }
}

// A resolved round (has a winner) never changes, so which clan members were present in it
// is cached forever once fetched — a later refresh only needs to fetch rounds that weren't
// resolved yet last time (still active, or new since).
export function loadRoundParticipants(roundId: number): number[] | null {
  try {
    const raw = localStorage.getItem(LS_KEY_MW_ROUND_PARTICIPANTS);
    if (!raw) return null;
    const store = JSON.parse(raw) as Record<string, number[]>;
    return store[String(roundId)] ?? null;
  } catch {
    return null;
  }
}

export function persistRoundParticipants(roundId: number, userIds: number[]): void {
  try {
    const raw = localStorage.getItem(LS_KEY_MW_ROUND_PARTICIPANTS);
    const store: Record<string, number[]> = raw ? JSON.parse(raw) : {};
    store[String(roundId)] = userIds;
    localStorage.setItem(LS_KEY_MW_ROUND_PARTICIPANTS, JSON.stringify(store));
  } catch {
    // ignore quota errors
  }
}
