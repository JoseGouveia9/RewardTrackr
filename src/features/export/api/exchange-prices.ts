import { resolveMexcApiBase } from "@/lib/http";
import type { CoinGeckoPriceResult } from "@/types/rewards";

const FETCH_TIMEOUT_MILLISECONDS = 15_000;
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MILLISECONDS = 2_000;
const RETRYABLE_STATUSES = new Set([418, 429, 500, 502, 503, 504]);

const MINUTE_MILLISECONDS = 60_000;
const HOUR_MILLISECONDS = 3_600_000;
const FOUR_HOURS_MILLISECONDS = 4 * HOUR_MILLISECONDS;

const SYMBOL_BY_COINGECKO_ID: Record<string, string> = {
  "gmt-token": "GOMINING",
  bitcoin: "BTC",
  ethereum: "ETH",
  binancecoin: "BNB",
  solana: "SOL",
  "the-open-network": "TON",
};

type SourceName = "binance" | "coinbase" | "bitget" | "mexc" | "gate";

interface Coverage {
  from?: number;
  to?: number;
}

const day = (isoDate: string) => Date.parse(`${isoDate}T00:00:00Z`);

const COVERAGE: Record<SourceName, Record<string, Coverage>> = {
  binance: {
    bitcoin: { from: day("2017-08-18") },
    ethereum: { from: day("2017-08-18") },
    binancecoin: { from: day("2017-11-07") },
    solana: { from: day("2020-08-12") },
    "the-open-network": { from: day("2024-08-08"), to: day("2026-06-30") + 86_400_000 },
  },
  coinbase: {
    bitcoin: {},
    ethereum: {},
    binancecoin: { from: day("2025-10-23") },
    solana: { from: day("2021-06-18") },
    "the-open-network": { from: day("2025-11-19") },
  },
  bitget: {
    bitcoin: { from: day("2018-07-25") },
    ethereum: { from: day("2018-07-25") },
    binancecoin: { from: day("2021-06-02") },
    solana: { from: day("2021-06-23") },
    "gmt-token": { from: day("2023-08-31") },
  },
  mexc: {
    bitcoin: { from: day("2018-06-01") },
    ethereum: { from: day("2018-06-01") },
    binancecoin: { from: day("2019-03-07") },
    solana: { from: day("2020-07-08") },
    "gmt-token": { from: day("2021-12-10") },
  },
  gate: {
    bitcoin: { from: day("2022-04-01") },
    ethereum: { from: day("2022-04-01") },
    binancecoin: { from: day("2022-04-01") },
    solana: { from: day("2022-04-01") },
    "gmt-token": { from: day("2023-04-28") },
  },
};

/**
 * Skips sources whose measured pair availability excludes the coin or timestamp: pairs get delisted
 * (TON left Binance on 2026-06-30) and Binance's and Coinbase's GMT is STEPN's, not GoMining's.
 */
function isCovered(source: SourceName, coingeckoId: string, targetMilliseconds: number): boolean {
  const coverage = COVERAGE[source][coingeckoId];
  if (!coverage) return false;
  if (coverage.from !== undefined && targetMilliseconds < coverage.from) return false;
  if (coverage.to !== undefined && targetMilliseconds > coverage.to) return false;
  return true;
}

const GATE_HOURLY_WINDOW_MILLISECONDS = (10_000 - 48) * HOUR_MILLISECONDS;

export interface Candle {
  openMilliseconds: number;
  durationMilliseconds: number;
  open: number;
  close: number;
}

function buildCandle(
  openMilliseconds: number,
  durationMilliseconds: number,
  open: unknown,
  close: unknown,
): Candle | null {
  const openPrice = Number(open);
  const closePrice = Number(close);
  if (!Number.isFinite(openMilliseconds)) return null;
  if (!(openPrice > 0) || !(closePrice > 0)) return null;
  return { openMilliseconds, durationMilliseconds, open: openPrice, close: closePrice };
}

/**
 * Picks the candle containing the target (or the nearest one) and returns whichever of its
 * open/close prices is closest in time to the target.
 */
export function pickCandlePrice(
  candles: Candle[],
  targetMilliseconds: number,
): CoinGeckoPriceResult | null {
  let best: { candle: Candle; distance: number } | null = null;
  for (const candle of candles) {
    const end = candle.openMilliseconds + candle.durationMilliseconds;
    const distance =
      targetMilliseconds < candle.openMilliseconds
        ? candle.openMilliseconds - targetMilliseconds
        : targetMilliseconds >= end
          ? targetMilliseconds - end
          : 0;
    if (!best || distance < best.distance) best = { candle, distance };
  }
  if (!best) return null;

  const { candle } = best;
  const closeMilliseconds = candle.openMilliseconds + candle.durationMilliseconds;
  const useOpen =
    Math.abs(targetMilliseconds - candle.openMilliseconds) <=
    Math.abs(targetMilliseconds - closeMilliseconds);
  return {
    price: useOpen ? candle.open : candle.close,
    priceTimestamp: new Date(useOpen ? candle.openMilliseconds : closeMilliseconds).toISOString(),
  };
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function attemptRequest(url: string): Promise<{ finished: boolean; body: unknown | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MILLISECONDS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (response.ok) return { finished: true, body: (await response.json()) as unknown };
    return { finished: !RETRYABLE_STATUSES.has(response.status), body: null };
  } catch {
    return { finished: false, body: null };
  } finally {
    clearTimeout(timeout);
  }
}

/** GET JSON with a timeout, backing off a few seconds on rate limits; any failure yields null. */
async function requestJson(url: string): Promise<unknown | null> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { finished, body } = await attemptRequest(url);
    if (finished) return body;
    if (attempt < MAX_ATTEMPTS) await sleep(RETRY_BACKOFF_MILLISECONDS * attempt);
  }
  return null;
}

/** Rows are [openTime ms, open, high, low, close, ...], shared by Binance and MEXC. */
function parseKlineRows(rows: unknown, durationMilliseconds: number): Candle[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) =>
      Array.isArray(row) ? buildCandle(Number(row[0]), durationMilliseconds, row[1], row[4]) : null,
    )
    .filter((candle): candle is Candle => candle !== null);
}

async function fetchBinanceCandles(symbol: string, targetMilliseconds: number): Promise<Candle[]> {
  const url =
    `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=1m` +
    `&startTime=${targetMilliseconds - 5 * MINUTE_MILLISECONDS}` +
    `&endTime=${targetMilliseconds + 5 * MINUTE_MILLISECONDS}&limit=11`;
  return parseKlineRows(await requestJson(url), MINUTE_MILLISECONDS);
}

/** Rows are [time s, low, high, open, close, volume]; minutes without trades are missing. */
async function fetchCoinbaseCandles(symbol: string, targetMilliseconds: number): Promise<Candle[]> {
  const toIso = (milliseconds: number) =>
    new Date(milliseconds).toISOString().replace(/\.\d{3}Z$/, "Z");
  const url =
    `https://api.exchange.coinbase.com/products/${symbol}-USD/candles?granularity=60` +
    `&start=${toIso(targetMilliseconds - 5 * MINUTE_MILLISECONDS)}` +
    `&end=${toIso(targetMilliseconds + 5 * MINUTE_MILLISECONDS)}`;
  const rows = await requestJson(url);
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) =>
      Array.isArray(row)
        ? buildCandle(Number(row[0]) * 1000, MINUTE_MILLISECONDS, row[3], row[4])
        : null,
    )
    .filter((candle): candle is Candle => candle !== null);
}

/** Response is { data: [[openTime ms, open, high, low, close, ...]] }, newest data first up to endTime. */
async function fetchBitgetCandles(symbol: string, targetMilliseconds: number): Promise<Candle[]> {
  const url =
    `https://api.bitget.com/api/v2/spot/market/history-candles?symbol=${symbol}USDT` +
    `&granularity=1min&endTime=${targetMilliseconds + 2 * MINUTE_MILLISECONDS}&limit=5`;
  const body = (await requestJson(url)) as { data?: unknown } | null;
  return parseKlineRows(body?.data, MINUTE_MILLISECONDS);
}

const SPARSE_WINDOW_MILLISECONDS = 6 * HOUR_MILLISECONDS;

async function fetchMexcCandles(symbol: string, targetMilliseconds: number): Promise<Candle[]> {
  const url =
    `${resolveMexcApiBase()}/api/v3/klines?symbol=${symbol}USDT&interval=60m` +
    `&startTime=${targetMilliseconds - SPARSE_WINDOW_MILLISECONDS}` +
    `&endTime=${targetMilliseconds + SPARSE_WINDOW_MILLISECONDS}&limit=14`;
  return parseKlineRows(await requestJson(url), HOUR_MILLISECONDS);
}

/** Rows are [time s, quote volume, close, high, low, open, ...]. */
async function fetchGateCandlesAt(
  symbol: string,
  targetMilliseconds: number,
  interval: "1h" | "4h",
  durationMilliseconds: number,
): Promise<Candle[]> {
  const url =
    `https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=${symbol}_USDT` +
    `&interval=${interval}&from=${Math.floor((targetMilliseconds - SPARSE_WINDOW_MILLISECONDS) / 1000)}` +
    `&to=${Math.floor((targetMilliseconds + SPARSE_WINDOW_MILLISECONDS) / 1000)}`;
  const rows = await requestJson(url);
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) =>
      Array.isArray(row)
        ? buildCandle(Number(row[0]) * 1000, durationMilliseconds, row[5], row[2])
        : null,
    )
    .filter((candle): candle is Candle => candle !== null);
}

/** Gate only serves the latest 10,000 candles, so older timestamps need the coarser 4h candle. */
async function fetchGateCandles(symbol: string, targetMilliseconds: number): Promise<Candle[]> {
  if (Date.now() - targetMilliseconds < GATE_HOURLY_WINDOW_MILLISECONDS) {
    const hourly = await fetchGateCandlesAt(symbol, targetMilliseconds, "1h", HOUR_MILLISECONDS);
    if (hourly.length) return hourly;
  }
  return fetchGateCandlesAt(symbol, targetMilliseconds, "4h", FOUR_HOURS_MILLISECONDS);
}

/**
 * Historical USD price from public exchange candles when CoinGecko can't serve it (older than a year
 * or rate limited). Sources are tried finest candle first, skipping any whose coverage excludes the
 * coin or timestamp.
 */
export async function fetchExchangePrice(
  coingeckoId: string,
  createdAtIso: string,
): Promise<CoinGeckoPriceResult | null> {
  const symbol = SYMBOL_BY_COINGECKO_ID[coingeckoId];
  if (!symbol) {
    console.warn(`[ExchangePrice] No symbol mapping for coingeckoId "${coingeckoId}"`);
    return null;
  }
  const targetMilliseconds = new Date(createdAtIso).getTime();
  if (!Number.isFinite(targetMilliseconds)) return null;

  const sources: Array<[SourceName, (symbol: string, target: number) => Promise<Candle[]>]> = [
    ["binance", fetchBinanceCandles],
    ["coinbase", fetchCoinbaseCandles],
    ["bitget", fetchBitgetCandles],
    ["mexc", fetchMexcCandles],
    ["gate", fetchGateCandles],
  ];

  for (const [name, fetchCandles] of sources) {
    if (!isCovered(name, coingeckoId, targetMilliseconds)) continue;
    const result = pickCandlePrice(
      await fetchCandles(symbol, targetMilliseconds),
      targetMilliseconds,
    );
    if (result) return result;
  }
  return null;
}
