import { LOCAL_STORAGE_KEY_PRICE_CACHE } from "@/lib/storage-keys";
import { resolveCryptoCompareApiBase } from "@/lib/http";
import type {
  CoinGeckoMarketRangeResponse,
  CoinGeckoPriceCacheValue,
  CoinGeckoPriceResult,
  CoinGeckoPriceTuple,
} from "@/types/rewards";
import { sleepWithCountdown } from "../utils/sleep-with-countdown";

const COINGECKO_MAX_RETRIES = 10;
const COINGECKO_RETRY_WAIT_MILLISECONDS = 65_000;
const COINGECKO_FETCH_TIMEOUT_MILLISECONDS = 15_000;

const COINGECKO_TO_CRYPTOCOMPARE: Record<string, string> = {
  "gmt-token": "GMTT",
  bitcoin: "BTC",
  ethereum: "ETH",
  binancecoin: "BNB",
  solana: "SOL",
  "the-open-network": "TON",
};

/**
 * Fallback price source used when CoinGecko answers 401; picks the hourly candle closest to the
 * timestamp.
 */
async function fetchCryptoComparePrice(
  coingeckoId: string,
  createdAtIso: string,
): Promise<CoinGeckoPriceResult | null> {
  const symbol = COINGECKO_TO_CRYPTOCOMPARE[coingeckoId];
  if (!symbol) {
    console.warn(`[CryptoCompare] No symbol mapping for coingeckoId "${coingeckoId}"`);
    return null;
  }
  const toTimestamp = Math.floor(new Date(createdAtIso).getTime() / 1000);
  const url = `${resolveCryptoCompareApiBase()}/data/v2/histohour?fsym=${symbol}&tsym=USD&limit=2&toTs=${toTimestamp}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), COINGECKO_FETCH_TIMEOUT_MILLISECONDS);
    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    const text = await response.text();
    if (!response.ok) return null;
    const data = JSON.parse(text) as {
      Response?: string;
      Data?: { Data?: Array<{ time: number; close: number }> };
    };
    if (data.Response !== "Success" || !data.Data?.Data?.length) return null;
    const points = data.Data.Data.filter((point) => point.time > 0 && point.close > 0);
    if (!points.length) return null;
    const best = points.reduce((left, right) =>
      Math.abs(left.time - toTimestamp) <= Math.abs(right.time - toTimestamp) ? left : right,
    );
    return {
      price: best.close,
      priceTimestamp: new Date(best.time * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

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

/** Returns the [timestamp, price] point closest to targetMilliseconds, or null when none is finite. */
function findNearestPrice(prices: CoinGeckoPriceTuple[], targetMilliseconds: number) {
  if (!prices.length) return null;

  let best = prices[0];
  let minDifference = Math.abs(prices[0][0] - targetMilliseconds);
  for (const priceTuple of prices) {
    const diff = Math.abs(priceTuple[0] - targetMilliseconds);
    if (diff < minDifference) {
      minDifference = diff;
      best = priceTuple;
    }
  }

  const price = best[1] ?? null;
  const timestampMilliseconds = best[0] ?? null;
  if (!Number.isFinite(price) || !Number.isFinite(timestampMilliseconds)) return null;
  return { price, timestampMilliseconds };
}

export function persistCoinGeckoPriceCache(cache: Map<string, CoinGeckoPriceCacheValue>): void {
  try {
    const serialized: Record<string, CoinGeckoPriceCacheValue> = {};
    for (const [key, value] of cache.entries()) serialized[key] = value;
    localStorage.setItem(LOCAL_STORAGE_KEY_PRICE_CACHE, JSON.stringify(serialized));
    // eslint-disable-next-line no-empty
  } catch {}
}

/**
 * Historical USD price near a timestamp, memoized in priceCache (null = known miss); stablecoins are fixed at 1.
 * Queries a ±3h range (hourly granularity), retries 429s with a countdown and falls back to CryptoCompare on 401.
 */
export async function fetchCoinGeckoPrice(
  coingeckoId: string,
  createdAtIso: string,
  priceCache: Map<string, CoinGeckoPriceCacheValue>,
  onWait?: (message: string) => void,
  entryProgress?: string,
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

  const targetMilliseconds = createdAt.getTime();
  const fromSeconds = Math.floor((targetMilliseconds - 3 * 60 * 60 * 1000) / 1000);
  const toSeconds = Math.floor((targetMilliseconds + 3 * 60 * 60 * 1000) / 1000);
  const url =
    `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart/range` +
    `?vs_currency=usd&from=${fromSeconds}&to=${toSeconds}`;

  const waitBeforeRetry = (attempt: number) =>
    sleepWithCountdown(COINGECKO_RETRY_WAIT_MILLISECONDS, (secondsLeft) => {
      const entrySuffix = entryProgress ? `, entry ${entryProgress}` : "";
      onWait?.(
        `CoinGecko rate limit hit. Retrying in ${secondsLeft}s (attempt ${attempt}/${COINGECKO_MAX_RETRIES}${entrySuffix})...`,
      );
    });

  for (let attempt = 1; attempt <= COINGECKO_MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), COINGECKO_FETCH_TIMEOUT_MILLISECONDS);
      let response: Response;
      try {
        response = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }

      const text = await response.text();
      let data: CoinGeckoMarketRangeResponse | null = null;
      try {
        data = text ? (JSON.parse(text) as CoinGeckoMarketRangeResponse) : null;
        // eslint-disable-next-line no-empty
      } catch {}

      if (response.status === 401) {
        const fallback = await fetchCryptoComparePrice(coingeckoId, createdAtIso);
        if (fallback) priceCache.set(cacheKey, fallback);
        else priceCache.set(cacheKey, null);
        return fallback;
      }

      const isRateLimited = data?.status?.error_code === 429 || response.status === 429;
      if (!response.ok || isRateLimited) {
        if (attempt < COINGECKO_MAX_RETRIES) {
          await waitBeforeRetry(attempt);
          continue;
        }
        break;
      }

      if (!data?.prices?.length) {
        priceCache.set(cacheKey, null);
        return null;
      }

      const nearest = findNearestPrice(data.prices, targetMilliseconds);
      if (!nearest) {
        priceCache.set(cacheKey, null);
        return null;
      }

      const result: CoinGeckoPriceResult = {
        price: nearest.price,
        priceTimestamp: new Date(nearest.timestampMilliseconds).toISOString(),
      };

      priceCache.set(cacheKey, result);
      return result;
    } catch {
      if (attempt < COINGECKO_MAX_RETRIES) {
        await waitBeforeRetry(attempt);
        continue;
      }
      break;
    }
  }

  priceCache.set(cacheKey, null);
  return null;
}

export function getSessionPriceCache() {
  seedPriceCache();
  return SHARED_PRICE_CACHE;
}
