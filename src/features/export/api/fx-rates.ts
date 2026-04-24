import { getJson, getJsonTolerant } from "@/lib/http";
import { LS_KEY_FX_CACHE } from "@/lib/storage-keys";
import type { ExtraFiatCurrency, FxLatestResponse, FxTimeseriesResponse } from "../types";

const FX_TIMESERIES_API = "https://api.fxratesapi.com/timeseries";
const FX_LATEST_API = "https://api.exchangerate-api.com/v4/latest/USD";

const rateCache = new Map<string, number>();
let cacheSeeded = false;

export function seedFxCache(): void {
  if (cacheSeeded) return;
  cacheSeeded = true;
  try {
    const raw = localStorage.getItem(LS_KEY_FX_CACHE);
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, number>;
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "number" && Number.isFinite(v) && v > 0) rateCache.set(k, v);
    }
    // eslint-disable-next-line no-empty
  } catch {}
}

export function persistFxCache(): void {
  try {
    const obj: Record<string, number> = {};
    for (const [k, v] of rateCache.entries()) obj[k] = v;
    localStorage.setItem(LS_KEY_FX_CACHE, JSON.stringify(obj));
    // eslint-disable-next-line no-empty
  } catch {}
}

async function fetchRatesForRange(
  startDate: string,
  endDate: string,
  currency: string,
): Promise<Record<string, number>> {
  const url = `${FX_TIMESERIES_API}?start_date=${startDate}&end_date=${endDate}&base=USD&currencies=${currency}`;
  const data = await getJsonTolerant<FxTimeseriesResponse>(url);

  if (!data || data.success === false || !data.rates) {
    throw new Error(data?.description || "Invalid FX timeseries response");
  }

  const rates: Record<string, number> = {};
  for (const [rawKey, value] of Object.entries(data.rates)) {
    const dateKey = String(rawKey).substring(0, 10);
    const rate = (value as Record<string, unknown>)?.[currency] as number | undefined;
    if (Number.isFinite(rate) && (rate ?? 0) > 0) rates[dateKey] = rate!;
  }
  return rates;
}

export async function prefetchAdditionalRates(
  rawDates: unknown[],
  currency: string,
): Promise<void> {
  seedFxCache();

  const dates = [
    ...new Set(
      rawDates
        .filter(Boolean)
        .map((d) => String(d).substring(0, 10))
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
    ),
  ].sort();

  if (dates.length === 0) return;

  const missing = dates.filter((d) => !rateCache.has(`${d}_${currency}`));
  if (missing.length === 0) return;

  const rangeStart = new Date(`${missing[0]}T00:00:00Z`);
  // Fetch 7 days before oldest missing date to cover weekends/holidays with no rate data
  rangeStart.setUTCDate(rangeStart.getUTCDate() - 7);
  const todayKey = new Date().toISOString().split("T")[0];
  const needsToday = dates.some((d) => d >= todayKey) && !rateCache.has(`${todayKey}_${currency}`);

  const [rates, todayRate] = await Promise.all([
    fetchRatesForRange(
      rangeStart.toISOString().split("T")[0],
      missing[missing.length - 1],
      currency,
    ),
    needsToday ? fetchLatestRate(currency as ExtraFiatCurrency) : Promise.resolve(null),
  ]);

  for (const [k, v] of Object.entries(rates)) rateCache.set(`${k}_${currency}`, v);
  if (needsToday && todayRate !== null && !rateCache.has(`${todayKey}_${currency}`)) {
    rateCache.set(`${todayKey}_${currency}`, todayRate);
  }

  persistFxCache();
}

export async function prefetchExchangeRates(rawDates: unknown[], currency: string): Promise<void> {
  seedFxCache();

  // Only one fiat currency is active at a time; evict stale keys to keep cache size bounded
  let deletedAny = false;
  for (const k of [...rateCache.keys()]) {
    if (!k.endsWith(`_${currency}`)) {
      rateCache.delete(k);
      deletedAny = true;
    }
  }
  if (deletedAny) persistFxCache();

  const dates = [
    ...new Set(
      rawDates
        .filter(Boolean)
        .map((d) => String(d).substring(0, 10))
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
    ),
  ].sort();

  if (dates.length === 0) return;

  const missing = dates.filter((d) => !rateCache.has(`${d}_${currency}`));
  if (missing.length === 0) return;

  const rangeStart = new Date(`${missing[0]}T00:00:00Z`);
  // Fetch 7 days before oldest missing date to cover weekends/holidays with no rate data
  rangeStart.setUTCDate(rangeStart.getUTCDate() - 7);
  const todayKey = new Date().toISOString().split("T")[0];
  const needsToday = dates.some((d) => d >= todayKey) && !rateCache.has(`${todayKey}_${currency}`);

  const [rates, todayRate] = await Promise.all([
    fetchRatesForRange(
      rangeStart.toISOString().split("T")[0],
      missing[missing.length - 1],
      currency,
    ),
    needsToday ? fetchLatestRate(currency as ExtraFiatCurrency) : Promise.resolve(null),
  ]);

  for (const [k, v] of Object.entries(rates)) rateCache.set(`${k}_${currency}`, v);
  if (needsToday && todayRate !== null && !rateCache.has(`${todayKey}_${currency}`)) {
    rateCache.set(`${todayKey}_${currency}`, todayRate);
  }

  persistFxCache();
}

export async function getRate(createdAtIso: string, currency: string): Promise<number> {
  const dateKey = String(createdAtIso || "").split("T")[0];
  if (!dateKey || dateKey.length !== 10) throw new Error(`Invalid date: ${createdAtIso}`);

  const key = `${dateKey}_${currency}`;
  const exact = rateCache.get(key);
  if (Number.isFinite(exact) && (exact ?? 0) > 0) return exact!;

  // Fall back to the most recent earlier date — FX APIs don't publish rates for weekends
  const candidates = [...rateCache.keys()]
    .filter((k) => k.endsWith(`_${currency}`) && k.slice(0, 10) <= dateKey)
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
