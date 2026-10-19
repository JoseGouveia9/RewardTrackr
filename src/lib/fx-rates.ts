import { getJson, getJsonTolerant } from "@/lib/http";
import { LOCAL_STORAGE_KEY_FX_CACHE } from "@/lib/storage-keys";
import type { ExtraFiatCurrency, FxLatestResponse, FxTimeseriesResponse } from "@/types/rewards";

const FX_TIMESERIES_API = "https://api.fxratesapi.com/timeseries";
const FX_LATEST_API = "https://api.exchangerate-api.com/v4/latest/USD";
const FRANKFURTER_API = "https://api.frankfurter.dev/v1";

const rateCache = new Map<string, number>();
let cacheSeeded = false;

/** Loads persisted FX rates into the in-memory cache once per session, ignoring invalid entries. */
function seedFxCache(): void {
  if (cacheSeeded) return;
  cacheSeeded = true;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_FX_CACHE);
    if (!raw) return;
    const storedRates = JSON.parse(raw) as Record<string, number>;
    for (const [cacheKey, rate] of Object.entries(storedRates)) {
      if (typeof rate === "number" && Number.isFinite(rate) && rate > 0)
        rateCache.set(cacheKey, rate);
    }
    // eslint-disable-next-line no-empty
  } catch {}
}

function persistFxCache(): void {
  try {
    const serializedRates: Record<string, number> = {};
    for (const [cacheKey, rate] of rateCache.entries()) serializedRates[cacheKey] = rate;
    localStorage.setItem(LOCAL_STORAGE_KEY_FX_CACHE, JSON.stringify(serializedRates));
    // eslint-disable-next-line no-empty
  } catch {}
}

function parseRatesObject(raw: Record<string, unknown>, currency: string): Record<string, number> {
  const rates: Record<string, number> = {};
  for (const [rawKey, value] of Object.entries(raw)) {
    const dateKey = String(rawKey).substring(0, 10);
    const rate = (value as Record<string, unknown>)?.[currency] as number | undefined;
    if (Number.isFinite(rate) && (rate ?? 0) > 0) rates[dateKey] = rate!;
  }
  return rates;
}

async function fetchFxRatesApiRange(
  startDate: string,
  endDate: string,
  currency: string,
): Promise<Record<string, number>> {
  const url = `${FX_TIMESERIES_API}?start_date=${startDate}&end_date=${endDate}&base=USD&currencies=${currency}`;
  const data = await getJsonTolerant<FxTimeseriesResponse>(url);
  if (!data || data.success === false || !data.rates) {
    throw new Error(data?.description || "Invalid FX timeseries response");
  }
  return parseRatesObject(data.rates as Record<string, unknown>, currency);
}

async function fetchFrankfurterRange(
  startDate: string,
  endDate: string,
  currency: string,
): Promise<Record<string, number>> {
  const url = `${FRANKFURTER_API}/${startDate}..${endDate}?from=USD&to=${currency}`;
  const data = await getJsonTolerant<{ rates?: Record<string, unknown>; message?: string }>(url);
  if (!data || data.message || !data.rates) return {};
  return parseRatesObject(data.rates, currency);
}

/**
 * Daily USD-to-currency rates for a range: Frankfurter (ECB, unlimited history) for dates older than a year,
 * fxratesapi (free plan covers only the last 365 days) for the rest.
 */
async function fetchRatesForRange(
  startDate: string,
  endDate: string,
  currency: string,
): Promise<Record<string, number>> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 365);
  const cutoffDate = cutoff.toISOString().split("T")[0];

  const results: Record<string, number> = {};

  if (startDate < cutoffDate) {
    const oldEnd = endDate < cutoffDate ? endDate : cutoffDate;
    const oldRates = await fetchFrankfurterRange(startDate, oldEnd, currency);
    Object.assign(results, oldRates);
  }

  const recentStart = startDate < cutoffDate ? cutoffDate : startDate;
  if (recentStart <= endDate) {
    const recentRates = await fetchFxRatesApiRange(recentStart, endDate, currency);
    Object.assign(results, recentRates);
  }

  return results;
}

/**
 * Fills the rate cache for the missing dates, fetching from 7 days earlier to cover weekends and holidays.
 * Today's rate comes from the latest-rates API because history endpoints lag.
 */
export async function prefetchAdditionalRates(
  rawDates: unknown[],
  currency: string,
): Promise<void> {
  seedFxCache();

  const dates = [
    ...new Set(
      rawDates
        .filter(Boolean)
        .map((date) => String(date).substring(0, 10))
        .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)),
    ),
  ].sort();

  if (dates.length === 0) return;

  const missing = dates.filter((date) => !rateCache.has(`${date}_${currency}`));
  if (missing.length === 0) return;

  const rangeStart = new Date(`${missing[0]}T00:00:00Z`);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - 7);
  const todayKey = new Date().toISOString().split("T")[0];
  const needsToday =
    dates.some((date) => date >= todayKey) && !rateCache.has(`${todayKey}_${currency}`);

  const [rates, todayRate] = await Promise.all([
    fetchRatesForRange(
      rangeStart.toISOString().split("T")[0],
      missing[missing.length - 1],
      currency,
    ),
    needsToday ? fetchLatestRate(currency as ExtraFiatCurrency) : Promise.resolve(null),
  ]);

  for (const [rateDate, rate] of Object.entries(rates))
    rateCache.set(`${rateDate}_${currency}`, rate);
  if (needsToday && todayRate !== null && !rateCache.has(`${todayKey}_${currency}`)) {
    rateCache.set(`${todayKey}_${currency}`, todayRate);
  }

  persistFxCache();
}

/**
 * Prefetches rates for the active currency, first evicting other currencies to keep the persisted
 * cache small.
 */
export async function prefetchExchangeRates(rawDates: unknown[], currency: string): Promise<void> {
  seedFxCache();

  let deletedAny = false;
  for (const cacheKey of [...rateCache.keys()]) {
    if (!cacheKey.endsWith(`_${currency}`)) {
      rateCache.delete(cacheKey);
      deletedAny = true;
    }
  }
  if (deletedAny) persistFxCache();

  return prefetchAdditionalRates(rawDates, currency);
}

/**
 * Cached rate for the record's date, falling back to the latest earlier date (no rates on
 * weekends); throws if none.
 */
export async function getRate(createdAtIso: string, currency: string): Promise<number> {
  const dateKey = String(createdAtIso || "").split("T")[0];
  if (!dateKey || dateKey.length !== 10) throw new Error(`Invalid date: ${createdAtIso}`);

  const key = `${dateKey}_${currency}`;
  const exact = rateCache.get(key);
  if (Number.isFinite(exact) && (exact ?? 0) > 0) return exact!;

  const candidates = [...rateCache.keys()]
    .filter((cacheKey) => cacheKey.endsWith(`_${currency}`) && cacheKey.slice(0, 10) <= dateKey)
    .sort();
  const nearest = candidates[candidates.length - 1];
  if (nearest) {
    const rate = rateCache.get(nearest);
    if (Number.isFinite(rate) && (rate ?? 0) > 0) return rate!;
  }

  throw new Error(`No exchange rate available for ${dateKey} (${currency})`);
}

export async function fetchLatestRate(currency: ExtraFiatCurrency | "EUR"): Promise<number> {
  const data = await getJson<FxLatestResponse>(FX_LATEST_API);
  const rate = data?.rates?.[currency];
  return Number.isFinite(rate) && (rate ?? 0) > 0 ? rate! : 1;
}
