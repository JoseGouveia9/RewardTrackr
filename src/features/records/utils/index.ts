import { LOCAL_STORAGE_KEY_EXPORT_CONFIG } from "@/lib/storage-keys";
import type { Currency, DateRange } from "../types";

/**
 * BTC uses 8 fixed decimals; others are truncated (not rounded) and expand decimals until a
 * non-zero digit shows.
 */
export function formatCurrencyValue(value: number, currency: string): string {
  if (!Number.isFinite(value)) return "-";
  if (currency === "BTC") {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 8,
      maximumFractionDigits: 8,
    }).format(value);
  }

  let decimals = 2;
  while (
    decimals < 18 &&
    value !== 0 &&
    Math.floor(Math.abs(value) * Math.pow(10, decimals)) === 0
  ) {
    decimals++;
  }
  const factor = Math.pow(10, decimals);
  const truncated =
    value >= 0 ? Math.floor(value * factor) / factor : Math.ceil(value * factor) / factor;
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(truncated);
}

export function toIsoOffset(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function zeroPad(value: number): string {
  return String(value).padStart(2, "0");
}

export function buildIsoDate(year: number, month: number, day: number): string {
  return `${year}-${zeroPad(month + 1)}-${zeroPad(day)}`;
}

/** Min and max ISO dates (day precision) among the rows, or an empty object when there are none. */
export function getDateBounds(rows: Array<{ date: string }>): {
  minDate?: string;
  maxDate?: string;
} {
  if (!rows.length) return {};
  let min = rows[0].date.slice(0, 10);
  let max = min;
  for (const row of rows) {
    const date = row.date.slice(0, 10);
    if (date < min) min = date;
    if (date > max) max = date;
  }
  return { minDate: min, maxDate: max };
}

export function matchesDateRange(isoDate: string, range: DateRange): boolean {
  if (!range.from && !range.to) return true;
  const day = isoDate.slice(0, 10);
  if (range.from && day < range.from) return false;
  if (range.to && day > range.to) return false;
  return true;
}

/** Reads the fiat currency chosen in the export config, defaulting to EUR. */
export function loadFiatCode(): string {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_EXPORT_CONFIG);
    if (!raw) return "EUR";
    const parsed = JSON.parse(raw) as { excelFiatCurrency?: string };
    return typeof parsed.excelFiatCurrency === "string" ? parsed.excelFiatCurrency : "EUR";
  } catch {
    return "EUR";
  }
}

export function isDateRangeActive(range: DateRange): boolean {
  return !!(range.from || range.to);
}

/**
 * Reads the numeric field for a currency view; USD/fiat use different suffixes, and "reward" has
 * special names.
 */
export function getRecordField(
  record: Record<string, unknown>,
  currency: Currency,
  base: string,
): number {
  const map: Record<Currency, string> = {
    BTC: base,
    GMT: `${base}GMT`,
    USD: base === "reward" ? "rewardInUSD" : `${base}USD`,
    FIAT: base === "reward" ? "rewardInFiat" : `${base}Fiat`,
  };
  return toFiniteNumber(record[map[currency]]);
}

export function toFiniteNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseRewardAmounts(record: Record<string, unknown>) {
  return {
    reward: toFiniteNumber(record.reward),
    rewardInUSD: toFiniteNumber(record.rewardInUSD ?? record.rewardInUsd),
    rewardInFiat: toFiniteNumber(record.rewardInFiat),
  };
}

export function pickViewValue(
  row: { reward: number; rewardInUSD: number; rewardInFiat: number },
  view: string,
  nativeCurrency: string,
) {
  if (view === "USD") return { value: row.rewardInUSD, currency: "USD" };
  if (view === "FIAT") return { value: row.rewardInFiat, currency: "FIAT" };
  return { value: row.reward, currency: nativeCurrency };
}

export type GroupedRow<T> = T & { groupIds: string[] };

/**
 * Collapses rows sharing the same day and key into one via `merge`, tracking the merged row ids in groupIds.
 * Returns rows untouched (one id each) when grouping is off.
 */
export function groupRowsByDay<T extends { rowId: string; date: string }>(
  rows: T[],
  groupByDay: boolean,
  keyOf: (row: T) => string,
  merge: (accumulator: T, row: T) => T,
): GroupedRow<T>[] {
  if (!groupByDay) return rows.map((row) => ({ ...row, groupIds: [row.rowId] }));
  const map = new Map<string, GroupedRow<T>>();
  for (const row of rows) {
    const day = row.date.slice(0, 10);
    const key = `${day}|${keyOf(row)}`;
    const existing = map.get(key);
    map.set(
      key,
      existing
        ? { ...merge(existing, row), groupIds: [...existing.groupIds, row.rowId] }
        : { ...row, date: day, groupIds: [row.rowId] },
    );
  }
  return [...map.values()];
}

export function sumRewardAmounts<
  T extends { reward: number; rewardInUSD: number; rewardInFiat: number },
>(accumulator: T, row: T): T {
  return {
    ...accumulator,
    reward: accumulator.reward + row.reward,
    rewardInUSD: accumulator.rewardInUSD + row.rewardInUSD,
    rewardInFiat: accumulator.rewardInFiat + row.rewardInFiat,
  };
}

/** Locale date such as "Jan 6, 2025"; returns the input unchanged if formatting throws. */
export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Locale date and time (hour:minute); returns the input unchanged if formatting throws. */
export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
