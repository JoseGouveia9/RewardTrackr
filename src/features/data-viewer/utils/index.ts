import { LS_KEY_EXPORT_CONFIG } from "@/lib/storage-keys";
import type { Currency, DateRange } from "../types";

export function formatMiningValue(value: number, currency: Currency): string {
  if (!Number.isFinite(value)) return "-";
  if (currency === "BTC") {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 8,
      maximumFractionDigits: 8,
    }).format(value);
  }

  // Expand decimal places until the first non-zero digit appears (handles near-zero crypto amounts)
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
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function toIsoOffset(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function zeroPad(n: number): string {
  return String(n).padStart(2, "0");
}

export function buildIsoDate(year: number, month: number, day: number): string {
  return `${year}-${zeroPad(month + 1)}-${zeroPad(day)}`;
}

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

export function matchesDateRange(isoDate: string, range: DateRange): boolean {
  if (!range.from && !range.to) return true;
  const d = isoDate.slice(0, 10);
  if (range.from && d < range.from) return false;
  if (range.to && d > range.to) return false;
  return true;
}

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

export function isDateRangeActive(r: DateRange): boolean {
  return !!(r.from || r.to);
}

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
