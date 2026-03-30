import { useEffect, useMemo, useState } from "react";
import { loadCacheEntry } from "@/features/export/utils/cache";
import type { RewardKey } from "@/features/export/types";
import type { EarnView, DateRange } from "../../types";
import { EMPTY_DATE_RANGE, PAGE_SIZE } from "../../utils/constants";
import {
  formatCurrencyValue,
  getDateBounds,
  matchesDateRange,
  fmtDate,
  fmtDateTime,
} from "../../utils";
import { AnyCurrencyIcon, UsdIcon, FiatIcon } from "../icons/currency-icons";
import { DateRangeFilter } from "../date-range-filter";
import { Pagination } from "../pagination";

/** Renders a paged Simple Earn table with asset, APR, reward and optional group-by-day aggregation. */
export function SimpleEarnTable({
  rewardKey,
  fiatCode,
  earnView,
  groupByDay,
}: {
  rewardKey: RewardKey;
  fiatCode: string;
  earnView: EarnView;
  groupByDay: boolean;
}) {
  const [page, setPage] = useState(0);
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_DATE_RANGE);
  const entry = useMemo(() => loadCacheEntry(rewardKey), [rewardKey]);

  const rows = useMemo(() => {
    if (!entry?.records?.length) return [];
    return entry.records.map((r) => {
      const rec = r as Record<string, unknown>;
      const reward = Number(rec.reward ?? 0);
      const rewardInUSD = Number(rec.rewardInUSD ?? rec.rewardInUsd ?? 0);
      const rewardInFiat = Number(rec.rewardInFiat ?? 0);
      const apr = Number(rec.apr ?? 0);
      return {
        date: String(rec.createdAt ?? ""),
        asset: String(rec.asset ?? rec.currency ?? ""),
        currency: String(rec.currency ?? ""),
        apr: Number.isFinite(apr) ? apr : 0,
        reward: Number.isFinite(reward) ? reward : 0,
        rewardInUSD: Number.isFinite(rewardInUSD) ? rewardInUSD : 0,
        rewardInFiat: Number.isFinite(rewardInFiat) ? rewardInFiat : 0,
      };
    });
  }, [entry]);

  const dateBounds = useMemo(() => getDateBounds(rows), [rows]);

  const filteredRows = useMemo(
    () => rows.filter((r) => matchesDateRange(r.date, dateRange)),
    [rows, dateRange],
  );

  useEffect(() => setPage(0), [dateRange, groupByDay]);

  const displayRows = filteredRows;

  const finalRows = useMemo(() => {
    if (!groupByDay) return displayRows;
    const map = new Map<string, (typeof displayRows)[0]>();
    for (const row of displayRows) {
      const key = row.date.slice(0, 10) + "|" + row.asset;
      const ex = map.get(key);
      if (ex) {
        map.set(key, {
          ...ex,
          reward: ex.reward + row.reward,
          rewardInUSD: ex.rewardInUSD + row.rewardInUSD,
          rewardInFiat: ex.rewardInFiat + row.rewardInFiat,
        });
      } else {
        map.set(key, { ...row, date: row.date.slice(0, 10) });
      }
    }
    return [...map.values()];
  }, [displayRows, groupByDay]);

  const pageRows = useMemo(
    () => finalRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [finalRows, page],
  );

  const assetTotals = useMemo(() => {
    const map = new Map<
      string,
      { currency: string; reward: number; rewardInUSD: number; rewardInFiat: number }
    >();
    for (const row of filteredRows) {
      const cur = map.get(row.asset) ?? {
        currency: row.currency,
        reward: 0,
        rewardInUSD: 0,
        rewardInFiat: 0,
      };
      map.set(row.asset, {
        currency: row.currency,
        reward: cur.reward + row.reward,
        rewardInUSD: cur.rewardInUSD + row.rewardInUSD,
        rewardInFiat: cur.rewardInFiat + row.rewardInFiat,
      });
    }
    return [...map.entries()];
  }, [filteredRows]);

  const earnGrandTotal = useMemo(
    () =>
      assetTotals.reduce(
        (acc, [, t]) => ({
          reward: acc.reward + t.reward,
          rewardInUSD: acc.rewardInUSD + t.rewardInUSD,
          rewardInFiat: acc.rewardInFiat + t.rewardInFiat,
        }),
        { reward: 0, rewardInUSD: 0, rewardInFiat: 0 },
      ),
    [assetTotals],
  );

  const isEarnNative = earnView === "NATIVE";
  const isEarnUsd = earnView === "USD";
  const nativeCurrency = assetTotals[0]?.[1]?.currency ?? "";
  const earnTotalIcon = isEarnNative ? (
    <AnyCurrencyIcon currency={nativeCurrency} />
  ) : isEarnUsd ? (
    <UsdIcon />
  ) : (
    <FiatIcon code={fiatCode} />
  );

  /** Returns the display value and currency label for a row based on the active earnView. */
  function earnRowValue(row: {
    reward: number;
    rewardInUSD: number;
    rewardInFiat: number;
    currency: string;
  }) {
    if (earnView === "USD") return { v: row.rewardInUSD, c: "USD" };
    if (earnView === "FIAT") return { v: row.rewardInFiat, c: "FIAT" };
    return { v: row.reward, c: row.currency };
  }

  if (!entry) {
    return (
      <div className="dv-empty">
        No cached data for this sheet. Export it first from the main panel.
      </div>
    );
  }

  return (
    <div className="dv-tables-wrap">
      {/* Grand total */}
      <table className="dv-table dv-table-totals">
        <colgroup>
          <col className="dv-col-date" />
          <col className="dv-col-value" />
          <col className="dv-col-rate" />
          <col className="dv-col-value" />
        </colgroup>
        <tbody>
          <tr>
            <td className="dv-totals-label">Total</td>
            <td />
            <td />
            <td>
              <span className="dv-total-cell-label">Reward</span>
              <span className="dv-total-cell-value dv-total-cell-value--accent dv-cell-with-icon">
                {isEarnNative
                  ? formatCurrencyValue(earnGrandTotal.reward, nativeCurrency)
                  : formatCurrencyValue(
                      isEarnUsd ? earnGrandTotal.rewardInUSD : earnGrandTotal.rewardInFiat,
                      isEarnUsd ? "USD" : "FIAT",
                    )}
                {earnTotalIcon}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Data table */}
      <table className="dv-table dv-table-data">
        <colgroup>
          <col className="dv-col-date" />
          <col className="dv-col-value" />
          <col className="dv-col-rate" />
          <col className="dv-col-value" />
        </colgroup>
        <thead>
          <tr>
            <th>
              <DateRangeFilter value={dateRange} onChange={setDateRange} {...dateBounds} />
            </th>
            <th>Asset</th>
            <th>APR</th>
            <th>Reward</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row, i) => {
            const { v, c } = earnRowValue(row);
            const icon = isEarnNative ? (
              <AnyCurrencyIcon currency={row.currency} />
            ) : isEarnUsd ? (
              <UsdIcon />
            ) : (
              <FiatIcon code={fiatCode} />
            );
            return (
              <tr key={`${row.date}-${row.asset}-${i}`}>
                <td className="dv-td-date">
                  {groupByDay ? fmtDate(row.date) : fmtDateTime(row.date)}
                </td>
                <td>
                  <span className="dv-cell-with-icon">
                    <AnyCurrencyIcon currency={row.asset} />
                    {row.asset}
                  </span>
                </td>
                <td>{(row.apr * 100).toFixed(2)}%</td>
                <td className="dv-td-accent">
                  <span className="dv-cell-with-icon">
                    {formatCurrencyValue(v, c)}
                    {icon}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pagination page={page} total={finalRows.length} onChange={setPage} />
    </div>
  );
}
export default SimpleEarnTable;
