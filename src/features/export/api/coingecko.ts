import { LS_KEY_PRICE_CACHE } from "@/lib/storage-keys";
import type {
  CoinGeckoMarketRangeResponse,
  CoinGeckoPriceCacheValue,
  CoinGeckoPriceResult,
  CoinGeckoPriceTuple,
} from "../types";

export { LS_KEY_PRICE_CACHE };

const COINGECKO_MAX_RETRIES = 10;
const COINGECKO_RETRY_WAIT_MS = 60_000;
const COINGECKO_FETCH_TIMEOUT_MS = 15_000;

const SHARED_PRICE_CACHE = new Map<string, CoinGeckoPriceCacheValue>();
let priceCacheSeeded = false;

function seedPriceCache(): void {
  if (priceCacheSeeded) return;
  priceCacheSeeded = true;
  try {
    const raw = localStorage.getItem(LS_KEY_PRICE_CACHE);
    if (!raw) return;
    const store = JSON.parse(raw) as Record<string, CoinGeckoPriceCacheValue>;
    for (const [k, v] of Object.entries(store)) {
      if (v != null) SHARED_PRICE_CACHE.set(k, v);
    }
    // eslint-disable-next-line no-empty
  } catch {}
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function sleepWithCountdown(ms: number, onTick: (seconds: number) => void) {
  const end = Date.now() + ms;
  while (true) {
    const remaining = end - Date.now();
    if (remaining <= 0) break;
    onTick(Math.ceil(remaining / 1000));
    await sleep(Math.min(1000, remaining));
  }
}

function findNearestPrice(prices: CoinGeckoPriceTuple[], targetMs: number) {
  if (!prices.length) return null;

  let best = prices[0];
  let minDiff = Math.abs(prices[0][0] - targetMs);
  for (const pt of prices) {
    const diff = Math.abs(pt[0] - targetMs);
    if (diff < minDiff) {
      minDiff = diff;
      best = pt;
    }
  }

  const price = best[1] ?? null;
  const timestampMs = best[0] ?? null;
  if (!Number.isFinite(price) || !Number.isFinite(timestampMs)) return null;
  return { price, timestampMs };
}

export async function fetchCoinGeckoPrice(
  coingeckoId: string,
  createdAtIso: string,
  priceCache: Map<string, CoinGeckoPriceCacheValue>,
  onWait?: (msg: string) => void,
  entryProgress?: string,
): Promise<CoinGeckoPriceResult | null> {
  if (coingeckoId === "tether" || coingeckoId === "usd-coin") {
    return { price: 1, priceTimestamp: createdAtIso };
  }

  const d = new Date(createdAtIso);
  const cacheKey = `${coingeckoId}_${d.toISOString().slice(0, 16)}`;

  if (priceCache.has(cacheKey)) {
    const cached = priceCache.get(cacheKey);
    if (cached == null) return null;
    if (typeof cached === "number") return { price: cached, priceTimestamp: createdAtIso };
    return cached;
  }

  const targetMs = d.getTime();
  // ±3h window: CoinGecko's hourly granularity means an exact timestamp may fall between data points
  const fromSec = Math.floor((targetMs - 3 * 60 * 60 * 1000) / 1000);
  const toSec = Math.floor((targetMs + 3 * 60 * 60 * 1000) / 1000);
  const url =
    `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart/range` +
    `?vs_currency=usd&from=${fromSec}&to=${toSec}`;

  for (let attempt = 1; attempt <= COINGECKO_MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), COINGECKO_FETCH_TIMEOUT_MS);
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

      const isRateLimited = data?.status?.error_code === 429 || response.status === 429;
      if (!response.ok || isRateLimited) {
        if (attempt < COINGECKO_MAX_RETRIES) {
          await sleepWithCountdown(COINGECKO_RETRY_WAIT_MS, (s) => {
            const entrySuffix = entryProgress ? `, entry ${entryProgress}` : "";
            onWait?.(
              `CoinGecko rate limit hit. Retrying in ${s}s (attempt ${attempt}/${COINGECKO_MAX_RETRIES}${entrySuffix})...`,
            );
          });
          continue;
        }
        break;
      }

      if (!data?.prices?.length) {
        priceCache.set(cacheKey, null);
        return null;
      }

      const nearest = findNearestPrice(data.prices, targetMs);
      if (!nearest) {
        priceCache.set(cacheKey, null);
        return null;
      }

      const result: CoinGeckoPriceResult = {
        price: nearest.price,
        priceTimestamp: new Date(nearest.timestampMs).toISOString(),
      };

      priceCache.set(cacheKey, result);
      return result;
    } catch {
      if (attempt < COINGECKO_MAX_RETRIES) {
        await sleepWithCountdown(COINGECKO_RETRY_WAIT_MS, (s) => {
          const entrySuffix = entryProgress ? `, entry ${entryProgress}` : "";
          onWait?.(
            `CoinGecko rate limit hit. Retrying in ${s}s (attempt ${attempt}/${COINGECKO_MAX_RETRIES}${entrySuffix})...`,
          );
        });
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
