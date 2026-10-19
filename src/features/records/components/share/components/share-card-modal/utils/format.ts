import { MONTH_NAMES } from "./constants";
import type { Period } from "../types";

export function getPeriodLabel(period: Period, month: number, year: number): string {
  if (period === "7d") return "Last 7 days";
  if (period === "month") return `${MONTH_NAMES[month]} ${year}`;
  if (period === "year") return String(year);
  return "All time";
}

export function formatAmount(value: number, currency: string): string {
  if (currency === "BTC") return value.toFixed(8);
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Formats a fiat value in en-US currency style, falling back to a plain code suffix for unknown
 * currency codes.
 */
export function formatFiat(value: number, currency: string): string {
  try {
    return value.toLocaleString("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

/** Hashpower in TH: values >= 1000 shown as K, values below 1 TH converted to GH. */
export function formatTerahash(terahash: number): string {
  if (terahash >= 1000) return `${(terahash / 1000).toFixed(1)}K`;
  if (terahash < 1) return `${(terahash * 1000).toFixed(1)} GH`;
  return terahash.toFixed(2);
}
