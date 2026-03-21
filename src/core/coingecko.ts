import type { CoinGeckoMarketRangeResponse, CoinGeckoPriceCacheValue, CoinGeckoPriceResult, CoinGeckoPriceTuple } from "./types";

const COINGECKO_MAX_RETRIES = 10;
const COINGECKO_RETRY_WAIT_MS = 60_000;
const COINGECKO_MIN_INTERVAL_MS = 1_500;
const COINGECKO_POST_RECOVERY_COOLDOWN_MS = 5_000;

const SHARED_PRICE_CACHE = new Map<string, CoinGeckoPriceCacheValue>();
let nextRequestAt = 0;
let priceCacheSeeded = false;

export const LS_KEY_PRICE_CACHE = "gomining_pricecache";

// Loads previously saved CoinGecko prices from localStorage into the session cache (runs once per session).
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
  } catch {
    /* ignore corrupt storage */
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// Waits for `ms` milliseconds, calling onTick every second with the remaining seconds.
async function sleepWithCountdown(ms: number, onTick: (seconds: number) => void) {
  const end = Date.now() + ms;
  while (true) {
    const remaining = end - Date.now();
    if (remaining <= 0) break;
    onTick(Math.ceil(remaining / 1000));
    await sleep(Math.min(1000, remaining));
  }
}

// Waits until the CoinGecko rate-limit window has passed, ticking a countdown each second.
async function enforceRateLimit(onTick?: (seconds: number) => void) {
  const wait = nextRequestAt - Date.now();
  if (wait > 0) await sleepWithCountdown(wait, (s) => { if (s > 0) onTick?.(s); });
}

// Returns the price tuple from `prices` whose timestamp is closest to `targetMs`.
function findNearestPrice(prices: CoinGeckoPriceTuple[], targetMs: number) {
  if (!prices.length) return null;

  let best = prices[0];
  let minDiff = Math.abs(prices[0][0] - targetMs);
  for (const pt of prices) {
    const diff = Math.abs(pt[0] - targetMs);
    if (diff < minDiff) { minDiff = diff; best = pt; }
  }

  const price = best[1] ?? null;
  const timestampMs = best[0] ?? null;
  if (!Number.isFinite(price) || !Number.isFinite(timestampMs)) return null;
  return { price, timestampMs };
}

// Fetches the USD price for a coin at a specific point in time from CoinGecko.
// Returns null if the price cannot be determined; retries on rate-limit (up to 10×60s).
export async function fetchCoinGeckoPrice(
  coingeckoId: string,
  createdAtIso: string,
  priceCache: Map<string, CoinGeckoPriceCacheValue>,
  onWait?: (msg: string) => void,
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
  const fromSec = Math.floor((targetMs - 3 * 60 * 60 * 1000) / 1000);
  const toSec = Math.floor((targetMs + 3 * 60 * 60 * 1000) / 1000);
  const url =
    `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart/range` +
    `?vs_currency=usd&from=${fromSec}&to=${toSec}`;

  for (let attempt = 1; attempt <= COINGECKO_MAX_RETRIES; attempt++) {
    try {
      await enforceRateLimit((seconds) => {
        onWait?.(`CoinGecko rate limit reached, waiting ${seconds}s...`);
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
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
      } catch {
        /* unparseable response */
      }

      const isRateLimited = data?.status?.error_code === 429 || response.status === 429;
      if (!response.ok || isRateLimited) {
        nextRequestAt = Date.now() + COINGECKO_RETRY_WAIT_MS;
        if (attempt < COINGECKO_MAX_RETRIES) {
          await sleepWithCountdown(COINGECKO_RETRY_WAIT_MS, (s) => {
            onWait?.(`CoinGecko rate limit hit. Retrying in ${s}s (attempt ${attempt} of ${COINGECKO_MAX_RETRIES})...`);
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
      nextRequestAt = Date.now() + (attempt > 1 ? COINGECKO_POST_RECOVERY_COOLDOWN_MS : COINGECKO_MIN_INTERVAL_MS);
      return result;
    } catch (err) {
      if (attempt < COINGECKO_MAX_RETRIES) {
        nextRequestAt = Date.now() + COINGECKO_RETRY_WAIT_MS;
        await sleepWithCountdown(COINGECKO_RETRY_WAIT_MS, (s) => {
          onWait?.(`CoinGecko rate limit hit. Retrying in ${s}s (attempt ${attempt} of ${COINGECKO_MAX_RETRIES})...`);
        });
        continue;
      }
      break;
    }
  }

  priceCache.set(cacheKey, null);
  return null;
}

// Returns the module-level price cache shared across the entire session, seeding from localStorage on first call.
export function getSessionPriceCache() {
  seedPriceCache();
  return SHARED_PRICE_CACHE;
}
