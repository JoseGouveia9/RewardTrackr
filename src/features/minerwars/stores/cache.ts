import {
  LOCAL_STORAGE_KEY_MINERWARS_CLAN_PERFORMANCE,
  LOCAL_STORAGE_KEY_MINERWARS_COMPARISON,
  LOCAL_STORAGE_KEY_MINERWARS_CYCLES,
  LOCAL_STORAGE_KEY_MINERWARS_HISTORICAL_PRICES,
  LOCAL_STORAGE_KEY_MINERWARS_ROUND_PARTICIPANTS,
  LOCAL_STORAGE_KEY_REWARD_PREFIX,
} from "@/lib/storage-keys";
import type { CycleInfo, CycleStatus, MinerWarsComparison } from "../types";
import type { ClanPerformance } from "../types/clan-types";
import { addUtcDays } from "../utils/date-range";

type CyclesStoreEntry = { data: CycleInfo[]; ts: number };

/** Parses a persisted JSON object, returning `{}` for missing, invalid or non-object data. */
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

/** Fallback after a failed write (typically quota): replaces the store with just this entry. */
function persistSingleEntryStore(key: string, entryKey: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify({ [entryKey]: value }));
    // eslint-disable-next-line no-empty
  } catch {}
}

export function loadPersistedCycles(): CyclesStoreEntry | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_MINERWARS_CYCLES);
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
    localStorage.setItem(
      LOCAL_STORAGE_KEY_MINERWARS_CYCLES,
      JSON.stringify({ data, ts: Date.now() }),
    );
    // eslint-disable-next-line no-empty
  } catch {}
}

export type HistoricalPriceEntry = { btcUsd: number; gmtUsd: number };

/** Returns the stored BTC/GMT USD snapshots for the requested dates, skipping malformed entries. */
export function loadHistoricalPrices(dates: string[]): Map<string, HistoricalPriceEntry> {
  const result = new Map<string, HistoricalPriceEntry>();
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_MINERWARS_HISTORICAL_PRICES);
    if (!raw) return result;
    const store = JSON.parse(raw) as Record<string, HistoricalPriceEntry>;
    for (const date of dates) {
      const entry = store[date];
      if (entry && typeof entry.btcUsd === "number" && typeof entry.gmtUsd === "number") {
        result.set(date, entry);
      }
    }
    // eslint-disable-next-line no-empty
  } catch {}
  return result;
}

export function persistHistoricalPrices(prices: Map<string, HistoricalPriceEntry>): void {
  if (prices.size === 0) return;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_MINERWARS_HISTORICAL_PRICES);
    const store = raw ? (JSON.parse(raw) as Record<string, HistoricalPriceEntry>) : {};
    for (const [date, price] of prices) {
      store[date] = price;
    }
    localStorage.setItem(LOCAL_STORAGE_KEY_MINERWARS_HISTORICAL_PRICES, JSON.stringify(store));
    // eslint-disable-next-line no-empty
  } catch {}
}

/** Also migrates legacy entries stored without the `{ data, ts }` wrapper. */
export function loadPersistedComparison(
  cycleId: number,
): { data: MinerWarsComparison; ts: number } | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_MINERWARS_COMPARISON);
    if (!raw) return null;
    const store = JSON.parse(raw) as Record<string, unknown>;
    const entry = store[String(cycleId)] as
      | { data?: unknown; ts?: unknown }
      | MinerWarsComparison
      | undefined;
    if (!entry || typeof entry !== "object") return null;

    if ("data" in entry && "ts" in entry && typeof (entry as { ts?: unknown }).ts === "number") {
      return {
        data: (entry as { data: MinerWarsComparison }).data,
        ts: (entry as { ts: number }).ts,
      };
    }

    const legacy = entry as MinerWarsComparison;
    if (typeof legacy.cycleId === "number" && typeof legacy.cycleStart === "string") {
      const migrated = { data: legacy, ts: Date.now() };
      store[String(cycleId)] = migrated;
      localStorage.setItem(LOCAL_STORAGE_KEY_MINERWARS_COMPARISON, JSON.stringify(store));
      return migrated;
    }

    return null;
  } catch {
    return null;
  }
}

/** On a failed write (e.g. quota) keeps only this cycle's entry instead of the whole store. */
export function persistComparison(data: MinerWarsComparison): void {
  const cycleKey = String(data.cycleId);
  const entry = { data, ts: Date.now() };
  try {
    const store = parseObjectStore(localStorage.getItem(LOCAL_STORAGE_KEY_MINERWARS_COMPARISON));
    store[cycleKey] = entry;
    localStorage.setItem(LOCAL_STORAGE_KEY_MINERWARS_COMPARISON, JSON.stringify(store));
  } catch {
    persistSingleEntryStore(LOCAL_STORAGE_KEY_MINERWARS_COMPARISON, cycleKey, entry);
  }
}

function loadRewardCacheRecords(key: string): Array<Record<string, unknown>> | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_REWARD_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { records?: Array<Record<string, unknown>> };
    return Array.isArray(parsed.records) ? parsed.records : null;
  } catch {
    return null;
  }
}

/** Reward-cache MinerWars records created on the payout day; null when there are none. */
function loadMinerWarsPaymentRecords(
  paymentDayString: string,
): Array<Record<string, unknown>> | null {
  const records = loadRewardCacheRecords("minerwars");
  if (!records) return null;
  const matches = records.filter(
    (record) =>
      typeof record.createdAt === "string" &&
      (record.createdAt as string).slice(0, 10) === paymentDayString,
  );
  return matches.length === 0 ? null : matches;
}

/** Total BTC pool reward paid on the payout day; null when the payout isn't cached yet. */
export function getActualIncomeFromBuildCache(paymentDayString: string): number | null {
  const matches = loadMinerWarsPaymentRecords(paymentDayString);
  if (!matches) return null;
  let total = 0;
  for (const record of matches) total += Number(record.poolReward ?? 0);
  return total;
}

export type BuildPaymentData = {
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
};

/**
 * Sums the payout day's MinerWars records from the build-report cache; null when none exist.
 * GMT figures are null when the records carry no GMT amounts.
 */
export function getPaymentDataFromBuildCache(paymentDayString: string): BuildPaymentData | null {
  const matches = loadMinerWarsPaymentRecords(paymentDayString);
  if (!matches) return null;

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

/** Solo income is posted the day after mining, so each row is shifted back one day. */
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

/** An ended cycle is `completed` only once its payout (the day after the end) is cached. */
export function resolveCycleStatus(cycleEnd: string, today: string): CycleStatus {
  if (cycleEnd >= today) return "in-progress";
  return getActualIncomeFromBuildCache(addUtcDays(cycleEnd, 1)) !== null ? "completed" : "pending";
}

export function deletePersistedComparison(cycleId: number): void {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_MINERWARS_COMPARISON);
    if (!raw) return;
    const store = parseObjectStore(raw);
    delete store[String(cycleId)];
    localStorage.setItem(LOCAL_STORAGE_KEY_MINERWARS_COMPARISON, JSON.stringify(store));
    // eslint-disable-next-line no-empty
  } catch {}
}

export function loadPersistedClanPerformance(cycleId: number): ClanPerformance | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_MINERWARS_CLAN_PERFORMANCE);
    if (!raw) return null;
    const store = JSON.parse(raw) as Record<string, { data?: ClanPerformance }>;
    const entry = store[String(cycleId)];
    if (!entry || !entry.data) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export function persistClanPerformance(cycleId: number, data: ClanPerformance): void {
  const cycleKey = String(cycleId);
  const entry = { data };
  try {
    const store = parseObjectStore(
      localStorage.getItem(LOCAL_STORAGE_KEY_MINERWARS_CLAN_PERFORMANCE),
    );
    store[cycleKey] = entry;
    localStorage.setItem(LOCAL_STORAGE_KEY_MINERWARS_CLAN_PERFORMANCE, JSON.stringify(store));
  } catch {
    persistSingleEntryStore(LOCAL_STORAGE_KEY_MINERWARS_CLAN_PERFORMANCE, cycleKey, entry);
  }
}

/** Drops persisted entries belonging to any clan other than the current one. */
export function clearStalePersistedClanPerformance(currentClanId: number): void {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_MINERWARS_CLAN_PERFORMANCE);
    if (!raw) return;
    const store = JSON.parse(raw) as Record<string, { data?: ClanPerformance }>;
    let changed = false;
    for (const key of Object.keys(store)) {
      if (store[key]?.data?.header?.clanId !== currentClanId) {
        delete store[key];
        changed = true;
      }
    }
    if (changed)
      localStorage.setItem(LOCAL_STORAGE_KEY_MINERWARS_CLAN_PERFORMANCE, JSON.stringify(store));
    // eslint-disable-next-line no-empty
  } catch {}
}

/** A resolved round never changes, so its participants are cached indefinitely. */
export function loadRoundParticipants(roundId: number): number[] | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_MINERWARS_ROUND_PARTICIPANTS);
    if (!raw) return null;
    const store = JSON.parse(raw) as Record<string, number[]>;
    return store[String(roundId)] ?? null;
  } catch {
    return null;
  }
}

export function persistRoundParticipants(roundId: number, userIds: number[]): void {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_MINERWARS_ROUND_PARTICIPANTS);
    const store: Record<string, number[]> = raw ? JSON.parse(raw) : {};
    store[String(roundId)] = userIds;
    localStorage.setItem(LOCAL_STORAGE_KEY_MINERWARS_ROUND_PARTICIPANTS, JSON.stringify(store));
    // eslint-disable-next-line no-empty
  } catch {}
}
