import { LS_KEY_EXPORT_CONFIG } from "@/lib/storage-keys";
import type { Currency, DateRange } from "../types";

// ── Number formatting ─────────────────────────────────────────────

/** Formats a numeric value for mining tabs, adapting decimal places to the selected currency. */
export function formatMiningValue(value: number, currency: Currency): string {
  if (!Number.isFinite(value)) return "—";
  if (currency === "BTC") {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 8,
      maximumFractionDigits: 8,
    }).format(value);
  }
  // GMT, USD, FIAT: adaptive like formatCurrencyValue
  let decimals = 2;
  while (
    decimals < 18 &&
    value !== 0 &&
    Math.floor(Math.abs(value) * Math.pow(10, decimals)) === 0
  ) {
    decimals++;
  }
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Formats a numeric value for simple tabs, adapting decimal places to avoid truncation to zero. */
export function formatCurrencyValue(value: number, currency: string): string {
  if (!Number.isFinite(value)) return "—";
  if (currency === "BTC") {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 8,
      maximumFractionDigits: 8,
    }).format(value);
  }
  // All other currencies: 2 decimals, unless that truncates to 0.00 — then find the first significant decimal
  // Uses floor (truncation) so e.g. 0.005 stays "0.005" instead of rounding up to "0.01"
  let decimals = 2;
  while (
    decimals < 18 &&
    value !== 0 &&
    Math.floor(Math.abs(value) * Math.pow(10, decimals)) === 0
  ) {
    decimals++;
  }
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// ── Date helpers ──────────────────────────────────────────────────

/** Returns today's ISO date string offset by the given number of days. */
export function toIsoOffset(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function zeroPad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Builds an ISO date string (YYYY-MM-DD) from year, 0-based month, and day. */
export function buildIsoDate(year: number, month: number, day: number): string {
  return `${year}-${zeroPad(month + 1)}-${zeroPad(day)}`;
}

/** Returns the min and max ISO date strings from an array of dated rows. */
export function getDateBounds(rows: Array<{ date: string }>): {
  minDate?: string;
  maxDate?: string;
} {
  if (!rows.length) return {};
  let min = rows[0].date.slice(0, 10);
  let max = min;
  for (const r of rows) {
    const d = r.date.slice(0, 10);
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return { minDate: min, maxDate: max };
}

/** Returns true if the ISO date falls within the given DateRange (inclusive, open-ended if blank). */
export function matchesDateRange(isoDate: string, range: DateRange): boolean {
  if (!range.from && !range.to) return true;
  const d = isoDate.slice(0, 10);
  if (range.from && d < range.from) return false;
  if (range.to && d > range.to) return false;
  return true;
}

// ── Storage ───────────────────────────────────────────────────────

/** Reads the saved fiat currency code from the export config in localStorage, defaulting to "EUR". */
export function loadFiatCode(): string {
  try {
    const raw = localStorage.getItem(LS_KEY_EXPORT_CONFIG);
    if (!raw) return "EUR";
    const parsed = JSON.parse(raw) as { excelFiatCurrency?: string };
    return typeof parsed.excelFiatCurrency === "string" ? parsed.excelFiatCurrency : "EUR";
  } catch {
    return "EUR";
  }
}

/** Returns true if the DateRange has at least one bound set. */
export function isDateRangeActive(r: DateRange): boolean {
  return !!(r.from || r.to);
}

// ── Record accessors ──────────────────────────────────────────────

/** Returns the numeric field value for the given currency view (BTC/GMT/USD/FIAT) from a record. */
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
  const val = record[map[currency]];
  const n = Number(val ?? 0);
  return Number.isFinite(n) ? n : 0;
}

// ── Display formatting ────────────────────────────────────────────

/** Formats an ISO date string as a short locale date (e.g. "Mar 30, 2026"). */
export function fmtDate(iso: string): string {
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

/** Formats an ISO datetime string as a short locale date+time (e.g. "Mar 30, 2026, 14:05"). */
export function fmtDateTime(iso: string): string {
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
