import type { CurrencyReward, DateRange, MiningBreakdown, Period } from "../types";

/** Resolves the period to an inclusive ISO date range, or null for "all". */
export function getDateRangeFilter(period: Period, month: number, year: number): DateRange | null {
  if (period === "all") return null;
  if (period === "7d") {
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from: from.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };
  }
  if (period === "month") {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
  }
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export function filterByDate(records: unknown[], range: DateRange | null): unknown[] {
  if (!range) return records;
  return records.filter((record) => {
    const day =
      ((record as Record<string, unknown>).createdAt as string | undefined)?.slice(0, 10) ?? "";
    return day >= range.from && day <= range.to;
  });
}

/**
 * Sums mining totals; pool-reward fiat values are prorated from reward values (same BTC price per record).
 */
export function computeMiningBreakdown(records: unknown[]): MiningBreakdown {
  let poolReward = 0,
    maintenance = 0,
    reward = 0,
    poolRewardInUSD = 0,
    poolRewardInFiat = 0;
  for (const record of records) {
    const recordFields = record as Record<string, unknown>;
    const poolRewardAmount = Number(recordFields.poolReward ?? 0);
    const rewardAmount = Number(recordFields.reward ?? 0);
    poolReward += poolRewardAmount;
    maintenance += Number(recordFields.maintenance ?? 0);
    reward += rewardAmount;
    const ratio = rewardAmount !== 0 ? poolRewardAmount / rewardAmount : 0;
    poolRewardInUSD +=
      Number(recordFields.rewardInUSD ?? recordFields.rewardInUsd ?? recordFields.valueUsd ?? 0) *
      ratio;
    poolRewardInFiat += Number(recordFields.rewardInFiat ?? recordFields.valueFiat ?? 0) * ratio;
  }
  return { poolReward, maintenance, reward, poolRewardInUSD, poolRewardInFiat };
}

/** Totals reward, USD and fiat values per currency, defaulting missing currencies to BTC. */
export function computeRewardsByCurrency(records: unknown[]): CurrencyReward[] {
  const map = new Map<string, { total: number; totalUSD: number; totalFiat: number }>();
  for (const record of records) {
    const recordFields = record as Record<string, unknown>;
    const currencyCode = typeof recordFields.currency === "string" ? recordFields.currency : "BTC";
    const existingTotals = map.get(currencyCode) ?? { total: 0, totalUSD: 0, totalFiat: 0 };
    map.set(currencyCode, {
      total: existingTotals.total + Number(recordFields.reward ?? 0),
      totalUSD:
        existingTotals.totalUSD +
        Number(recordFields.rewardInUSD ?? recordFields.rewardInUsd ?? recordFields.valueUsd ?? 0),
      totalFiat:
        existingTotals.totalFiat + Number(recordFields.rewardInFiat ?? recordFields.valueFiat ?? 0),
    });
  }
  return [...map.entries()].map(([currency, totals]) => ({ currency, ...totals }));
}
