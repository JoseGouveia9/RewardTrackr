import { LOCAL_STORAGE_KEY_PRICE_CACHE } from "@/lib/storage-keys";
import type { CoinGeckoPriceCacheValue, CoinGeckoPriceResult } from "@/types/rewards";
import { fetchExchangePrice } from "./exchange-prices";

const SHARED_PRICE_CACHE = new Map<string, CoinGeckoPriceCacheValue>();
let priceCacheSeeded = false;

/** Loads persisted prices into the shared in-memory cache once per session. */
function seedPriceCache(): void {
  if (priceCacheSeeded) return;
  priceCacheSeeded = true;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_PRICE_CACHE);
    if (!raw) return;
    const store = JSON.parse(raw) as Record<string, CoinGeckoPriceCacheValue>;
    for (const [key, value] of Object.entries(store)) {
      if (value != null) SHARED_PRICE_CACHE.set(key, value);
    }
    // eslint-disable-next-line no-empty
  } catch {}
}

export function persistPriceCache(cache: Map<string, CoinGeckoPriceCacheValue>): void {
  try {
    const serialized: Record<string, CoinGeckoPriceCacheValue> = {};
    for (const [key, value] of cache.entries()) serialized[key] = value;
    localStorage.setItem(LOCAL_STORAGE_KEY_PRICE_CACHE, JSON.stringify(serialized));
    // eslint-disable-next-line no-empty
  } catch {}
}

/**
 * Historical USD price near a timestamp from exchange candles, memoized in priceCache (null = known
 * miss); stablecoins are fixed at 1. The coin is identified by its CoinGecko id, used only as a key.
 */
export async function fetchHistoricalPrice(
  coingeckoId: string,
  createdAtIso: string,
  priceCache: Map<string, CoinGeckoPriceCacheValue>,
): Promise<CoinGeckoPriceResult | null> {
  if (coingeckoId === "tether" || coingeckoId === "usd-coin") {
    return { price: 1, priceTimestamp: createdAtIso };
  }

  const createdAt = new Date(createdAtIso);
  if (isNaN(createdAt.getTime())) return null;
  const cacheKey = `${coingeckoId}_${createdAt.toISOString().slice(0, 16)}`;

  if (priceCache.has(cacheKey)) {
    const cached = priceCache.get(cacheKey);
    if (cached == null) return null;
    if (typeof cached === "number") return { price: cached, priceTimestamp: createdAtIso };
    return cached;
  }

  const result = await fetchExchangePrice(coingeckoId, createdAtIso);
  priceCache.set(cacheKey, result);
  return result;
}

export function getSessionPriceCache() {
  seedPriceCache();
  return SHARED_PRICE_CACHE;
}
