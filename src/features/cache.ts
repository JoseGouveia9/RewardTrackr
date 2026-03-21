import { CURRENCY_TO_COINGECKO } from "@/core/currencies";
import { WALLET_TX_KEYS } from "@/core/wallet-types";
import { ALL_REWARD_KEYS } from "@/core/reward-configs";
import { LS_KEY_PRICE_CACHE } from "@/core/coingecko";
import type { CacheEntry, CacheState, RewardKey, RewardRecord } from "@/core/types";

const CACHE_PREFIX = "gomining_reward_";

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

function parseJsonSafe<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Reads a single sheet's cache entry from localStorage. Returns null if missing or corrupt.
export function loadCacheEntry(key: RewardKey): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
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
    };
  } catch {
    return null;
  }
}

// Writes a sheet's enriched records and metadata to localStorage.
export function saveCacheEntry(
  key: RewardKey,
  sheetName: string,
  records: RewardRecord[],
  totalCount: number,
  extras: Partial<CacheEntry> = {},
): void {
  try {
    localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ sheetName, records, totalCount, fetchedAt: Date.now(), ...extras }),
    );
  } catch {
    /* QuotaExceededError, skip silently */
  }
}

// Loads cache entries for all reward keys and returns them as a keyed map.
export function loadAllCacheEntries(): CacheState {
  const state = {} as CacheState;
  ALL_REWARD_KEYS.forEach((key) => {
    state[key] = loadCacheEntry(key);
  });
  return state;
}

// Removes all cached sheet data from localStorage.
export function clearAllCacheEntries(): void {
  ALL_REWARD_KEYS.forEach((key) => localStorage.removeItem(CACHE_PREFIX + key));
}

// Saves CoinGecko price data from enriched wallet-tx records to localStorage for future reuse.
export function persistPriceCache(key: RewardKey, records: RewardRecord[]): void {
  if (!WALLET_TX_KEYS.has(key) || !records.length) return;
  try {
    const store = parseJsonSafe<Record<string, PriceCacheValue>>(
      localStorage.getItem(LS_KEY_PRICE_CACHE),
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

    localStorage.setItem(LS_KEY_PRICE_CACHE, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

// Returns true if any wallet-tx records in the cache entry are missing their fiat price.
export function hasMissingPrices(
  cacheEntry: CacheEntry | null,
  key: RewardKey,
  includeWalletFiat: boolean,
): boolean {
  if (!cacheEntry || !Array.isArray(cacheEntry.records)) return false;
  if (!WALLET_TX_KEYS.has(key) || !includeWalletFiat) return false;
  return cacheEntry.records.some((r) => {
    if (!r || typeof r !== "object") return false;
    if (r.currency === "USDT" || r.currency === "USDC") return false;
    return asNumber(r.reward) > 0 && asNumber(r.priceAtTime) <= 0;
  });
}

// Removes records with "created" reinvestment status (pending entries not yet finalised).
// Returns the filtered records, adjusted count, and how many were removed.
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
    (r) => String(r?.reinvestmentStatus || "").toLowerCase() !== "created",
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

// Formats a timestamp as a human-readable age string (e.g. "5m ago").
export function formatAge(fetchedAt: number): string {
  const seconds = Math.floor((Date.now() - fetchedAt) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}
