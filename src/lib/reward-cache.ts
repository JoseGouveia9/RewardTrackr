import i18n from "@/i18n";
import { CURRENCY_TO_COINGECKO } from "@/config/currencies";
import { WALLET_TRANSACTION_KEYS } from "@/config/wallet-types";
import { ALL_REWARD_KEYS } from "@/config/reward-configs";
import {
  LOCAL_STORAGE_KEY_MIGRATED_PREFIX,
  LOCAL_STORAGE_KEY_MINERWARS_CLAN_PERFORMANCE,
  LOCAL_STORAGE_KEY_MINERWARS_COMPARISON,
  LOCAL_STORAGE_KEY_MINERWARS_CYCLES,
  LOCAL_STORAGE_KEY_MINERWARS_ROUND_PARTICIPANTS,
  LOCAL_STORAGE_KEY_MINERWARS_SIMULATION_INPUTS,
  LOCAL_STORAGE_KEY_PRICE_CACHE,
  LOCAL_STORAGE_KEY_REWARD_PREFIX,
} from "@/lib/storage-keys";
import { parseJsonSafe } from "@/lib/parse-json-safe";
import type { CacheEntry, CacheState, RewardKey, RewardRecord } from "@/types/rewards";

type PriceCacheValue = {
  price: number;
  currency?: string;
  source: "coingecko";
  priceTimestamp: string | null;
};

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Reads and validates a cached sheet from localStorage; null when absent or malformed. */
export function loadCacheEntry(key: RewardKey): CacheEntry | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_REWARD_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CacheEntry>;
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.records) || typeof parsed.sheetName !== "string") return null;
    return {
      sheetName: parsed.sheetName,
      records: parsed.records,
      totalCount: asNumber(parsed.totalCount),
      fetchedAt: asNumber(parsed.fetchedAt),
      ...(parsed.pricingMode ? { pricingMode: parsed.pricingMode } : {}),
      ...(parsed.extraFiatCurrency ? { extraFiatCurrency: parsed.extraFiatCurrency } : {}),
      ...(parsed.newEntriesCount != null
        ? { newEntriesCount: asNumber(parsed.newEntriesCount) }
        : {}),
    };
  } catch {
    return null;
  }
}

export function wasCacheMigrated(key: RewardKey): boolean {
  return localStorage.getItem(LOCAL_STORAGE_KEY_MIGRATED_PREFIX + key) === "1";
}

/**
 * Writes a sheet to localStorage and clears its migrated flag; storage errors (e.g. quota) are
 * swallowed.
 */
export function saveCacheEntry(
  key: RewardKey,
  sheetName: string,
  records: RewardRecord[],
  totalCount: number,
  extras: Partial<CacheEntry> = {},
): void {
  try {
    localStorage.setItem(
      LOCAL_STORAGE_KEY_REWARD_PREFIX + key,
      JSON.stringify({ sheetName, records, totalCount, fetchedAt: Date.now(), ...extras }),
    );
    localStorage.removeItem(LOCAL_STORAGE_KEY_MIGRATED_PREFIX + key);
    // eslint-disable-next-line no-empty
  } catch {}
}

export function loadAllCacheEntries(): CacheState {
  const state = {} as CacheState;
  ALL_REWARD_KEYS.forEach((key) => {
    state[key] = loadCacheEntry(key);
  });
  return state;
}

export function clearRecordsCacheEntries(): void {
  ALL_REWARD_KEYS.filter((key) => key !== "minerwars").forEach((key) =>
    localStorage.removeItem(LOCAL_STORAGE_KEY_REWARD_PREFIX + key),
  );
}

/** Removes MinerWars sheet and caches, including legacy pre-rename keys. */
export function clearMinerWarsCacheEntries(): void {
  localStorage.removeItem(LOCAL_STORAGE_KEY_REWARD_PREFIX + "minerwars");
  localStorage.removeItem(LOCAL_STORAGE_KEY_MINERWARS_COMPARISON);
  localStorage.removeItem(LOCAL_STORAGE_KEY_MINERWARS_CYCLES);
  localStorage.removeItem(LOCAL_STORAGE_KEY_MINERWARS_SIMULATION_INPUTS);
  localStorage.removeItem(LOCAL_STORAGE_KEY_MINERWARS_CLAN_PERFORMANCE);
  localStorage.removeItem("rt_mw_comparison_v1");
  localStorage.removeItem("rt_mw_cycles_v1");
  localStorage.removeItem("rt_mw_day_gate_v1");
}

/** Drops the shared price cache so the next pricing pass looks every price up again. */
export function clearPriceCache(): void {
  localStorage.removeItem(LOCAL_STORAGE_KEY_PRICE_CACHE);
}

/** Removes the cached wallet-transaction sheets, whose rows carry the prices to look up again. */
export function clearWalletTransactionCacheEntries(): void {
  WALLET_TRANSACTION_KEYS.forEach((key) =>
    localStorage.removeItem(LOCAL_STORAGE_KEY_REWARD_PREFIX + key),
  );
}

export function clearAllCacheEntries(): void {
  clearRecordsCacheEntries();
  clearMinerWarsCacheEntries();
  localStorage.removeItem(LOCAL_STORAGE_KEY_MINERWARS_ROUND_PARTICIPANTS);
}

/**
 * Stores each priced wallet-tx record's price in the shared price cache so later exports skip
 * the lookup.
 */
export function persistPriceCache(key: RewardKey, records: RewardRecord[]): void {
  if (!WALLET_TRANSACTION_KEYS.has(key) || !records.length) return;
  try {
    const store = parseJsonSafe<Record<string, PriceCacheValue>>(
      localStorage.getItem(LOCAL_STORAGE_KEY_PRICE_CACHE),
      {},
    );

    for (const item of records) {
      if (!item?.createdAt) continue;
      const currency = String(item.currency || "");
      const coingeckoId = CURRENCY_TO_COINGECKO[currency];
      if (!coingeckoId || currency === "USDT" || currency === "USDC") continue;

      const entryDate = new Date(item.createdAt);
      if (Number.isNaN(entryDate.getTime())) continue;

      const cacheKey = `${coingeckoId}_${entryDate.toISOString().slice(0, 16)}`;
      const usd = asNumber(item.rewardInUSD ?? item.rewardInUsd ?? item.valueUsd);
      const reward = asNumber(item.reward);
      const price =
        item.priceAtTime != null
          ? asNumber(item.priceAtTime)
          : reward > 0 && usd > 0
            ? usd / reward
            : null;

      if (price && Number.isFinite(price) && price > 0) {
        store[cacheKey] = {
          price,
          currency,
          source: "coingecko",
          priceTimestamp: typeof item.priceTimestamp === "string" ? item.priceTimestamp : null,
        };
      }
    }

    localStorage.setItem(LOCAL_STORAGE_KEY_PRICE_CACHE, JSON.stringify(store));
    // eslint-disable-next-line no-empty
  } catch {}
}

/**
 * True when a wallet-tx sheet has non-stablecoin rewards without a price, so it must be refetched
 * with fiat.
 */
export function hasMissingPrices(
  cacheEntry: CacheEntry | null,
  key: RewardKey,
  includeWalletFiat: boolean,
): boolean {
  if (!cacheEntry || !Array.isArray(cacheEntry.records)) return false;
  if (!WALLET_TRANSACTION_KEYS.has(key) || !includeWalletFiat) return false;
  return cacheEntry.records.some((record) => {
    if (!record || typeof record !== "object") return false;
    if (record.currency === "USDT" || record.currency === "USDC") return false;
    return asNumber(record.reward) > 0 && asNumber(record.priceAtTime) <= 0;
  });
}

/**
 * For solo-mining and MinerWars, drops records whose reinvestment is still "created" (not yet executed)
 * to avoid double-counting, and reports how many were removed.
 */
export function filterCacheableRecords(
  key: RewardKey,
  records: RewardRecord[],
  totalCount: number,
): { records: RewardRecord[]; totalCount: number; removedCreated: number } {
  if (!Array.isArray(records))
    return { records: [], totalCount: asNumber(totalCount), removedCreated: 0 };

  if (!["solo-mining", "minerwars"].includes(key)) {
    return {
      records,
      totalCount: typeof totalCount === "number" ? totalCount : records.length,
      removedCreated: 0,
    };
  }

  const filtered = records.filter(
    (record) => String(record?.reinvestmentStatus || "").toLowerCase() !== "created",
  );
  const removedCreated = records.length - filtered.length;
  const cachedTotalCount =
    removedCreated > 0
      ? filtered.length
      : typeof totalCount === "number"
        ? totalCount
        : filtered.length;

  return { records: filtered, totalCount: cachedTotalCount, removedCreated };
}

export function formatAge(fetchedAt: number): string {
  const t = i18n.t.bind(i18n);
  const seconds = Math.floor((Date.now() - fetchedAt) / 1000);
  if (seconds < 60) return t("common.lessThanAMinuteAgo");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("common.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("common.hoursAgo", { count: hours });
  return t("common.daysAgo", { count: Math.floor(hours / 24) });
}
