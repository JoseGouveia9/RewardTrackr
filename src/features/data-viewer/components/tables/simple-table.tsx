import { useEffect, useMemo, useRef, useState } from "react";
import { loadCacheEntry } from "@/features/export/utils/cache";
import type { CacheEntry, RewardKey } from "@/features/export/types";
import type { SimpleView, DateRange } from "../../types";
import { PAGE_SIZE } from "../../utils/constants";
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
import { useSyncTableColumns } from "../../hooks/use-sync-table-columns";
import { AnimatedLoadingRow } from "./animated-loading-row";

// Renders a paged reward table for non-mining sheets with per-currency totals and optional group-by-day.
export function SimpleTable({
  rewardKey,
  fiatCode,
  simpleView,
  isFetching = false,
  cacheVersion = 0,
  cacheEntry,
  groupByDay,
  dateRange,
  setDateRange,
}: {
  rewardKey: RewardKey;
  fiatCode: string;
  simpleView: SimpleView;
  isFetching?: boolean;
  cacheVersion?: number;
  cacheEntry?: CacheEntry | null;
  groupByDay: boolean;
  dateRange: DateRange;
  setDateRange: (v: DateRange) => void;
}) {
  const [page, setPage] = useState(0);
  const [hiddenCurrencies, setHiddenCurrencies] = useState<Set<string>>(new Set());
  const totalsRef = useRef<HTMLTableElement>(null);
  const dataRef = useRef<HTMLTableElement>(null);
  useSyncTableColumns(totalsRef, dataRef);
  const entry = useMemo(() => {
    void cacheVersion;
    return cacheEntry !== undefined ? cacheEntry : loadCacheEntry(rewardKey);
  }, [rewardKey, cacheVersion, cacheEntry]);

  const rows = useMemo(() => {
    if (!entry?.records?.length) return [];
    return entry.records.map((r) => {
      const rec = r as Record<string, unknown>;
      const reward = Number(rec.reward ?? 0);
      const rewardInUSD = Number(rec.rewardInUSD ?? rec.rewardInUsd ?? 0);
      const rewardInFiat = Number(rec.rewardInFiat ?? 0);
      return {
        date: String(rec.createdAt ?? ""),
        currency: String(rec.currency ?? ""),
        reward: Number.isFinite(reward) ? reward : 0,
        rewardInUSD: Number.isFinite(rewardInUSD) ? rewardInUSD : 0,
        rewardInFiat: Number.isFinite(rewardInFiat) ? rewardInFiat : 0,
      };
    });
  }, [entry]);

  const dateBounds = useMemo(() => getDateBounds(rows), [rows]);
  const rowDates = useMemo(() => rows.map((r) => r.date.slice(0, 10)), [rows]);

  const filteredRows = useMemo(
    () => rows.filter((r) => matchesDateRange(r.date, dateRange)),
    [rows, dateRange],
  );

  useEffect(() => setPage(0), [dateRange, hiddenCurrencies, groupByDay]);

  const displayRows = useMemo(
    () => filteredRows.filter((r) => !hiddenCurrencies.has(r.currency)),
    [filteredRows, hiddenCurrencies],
  );

  const finalRows = useMemo(() => {
    if (!groupByDay) return displayRows;
    const map = new Map<string, (typeof displayRows)[0]>();
    for (const row of displayRows) {
      const key = row.date.slice(0, 10) + "|" + row.currency;
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

  // One totals row per distinct currency
  const currencyTotals = useMemo(() => {
    const map = new Map<string, { reward: number; rewardInUSD: number; rewardInFiat: number }>();
    for (const row of filteredRows) {
      const cur = map.get(row.currency) ?? { reward: 0, rewardInUSD: 0, rewardInFiat: 0 };
      map.set(row.currency, {
        reward: cur.reward + row.reward,
        rewardInUSD: cur.rewardInUSD + row.rewardInUSD,
        rewardInFiat: cur.rewardInFiat + row.rewardInFiat,
      });
    }
    return [...map.entries()];
  }, [filteredRows]);

  const grandTotal = useMemo(
    () =>
      currencyTotals
        .filter(([currency]) => !hiddenCurrencies.has(currency))
        .reduce(
          (acc, [, t]) => ({
            rewardInUSD: acc.rewardInUSD + t.rewardInUSD,
            rewardInFiat: acc.rewardInFiat + t.rewardInFiat,
          }),
          { rewardInUSD: 0, rewardInFiat: 0 },
        ),
    [currencyTotals, hiddenCurrencies],
  );

  if (!entry) {
    return (
      <div className="dv-empty">
        {isFetching ? (
          <span className="dv-loading-inline">
            <span className="dv-spinner" aria-hidden="true" />
            <span>Fetching data...</span>
          </span>
        ) : (
          "No cached data for this sheet. Export it first from the main panel."
        )}
      </div>
    );
  }

  const isNative = simpleView === "NATIVE";
  const rewardIcon = isNative ? null : simpleView === "USD" ? (
    <UsdIcon />
  ) : (
    <FiatIcon code={fiatCode} />
  );
  const isSingleCurrency = currencyTotals.length === 1;
  const valueLabel =
    rewardKey === "deposits" ? "Deposited" : rewardKey === "withdrawals" ? "Withdrawn" : "Reward";

  // Returns the display value and currency label for a row based on the active simpleView.
  function rowValue(row: {
    reward: number;
    rewardInUSD: number;
    rewardInFiat: number;
    currency: string;
  }) {
    if (simpleView === "USD") return { v: row.rewardInUSD, c: "USD" };
    if (simpleView === "FIAT") return { v: row.rewardInFiat, c: "FIAT" };
    return { v: row.reward, c: row.currency };
  }

  return (
    <>
      <div className="dv-tables-wrap">
        {/* Totals - one row per currency */}
        <table ref={totalsRef} className="dv-table dv-table-totals">
          <colgroup>
            <col className="dv-column-date" />
            <col className="dv-column-value" />
          </colgroup>
          <tbody>
            {currencyTotals.map(([currency, totals]) => {
              const { v, c } = rowValue({ ...totals, currency });
              const hidden = hiddenCurrencies.has(currency);
              const toggle = isSingleCurrency
                ? undefined
                : () =>
                    setHiddenCurrencies((prev) => {
                      const next = new Set(prev);
                      if (next.has(currency)) next.delete(currency);
                      else next.add(currency);
                      return next;
                    });
              return (
                <tr
                  key={currency}
                  className={`${!isSingleCurrency ? "dv-totals-row--clickable" : ""}${hidden ? " dv-totals-row--hidden" : ""}`}
                  onClick={toggle}
                >
                  <td>
                    {isSingleCurrency ? (
                      <span className="dv-totals-label">Total</span>
                    ) : (
                      <span className="dv-totals-currency-cell">
                        <AnyCurrencyIcon currency={currency} />
                        <span className="dv-totals-currency-label">{currency}</span>
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="dv-total-cell-label">{valueLabel}</span>
                    <span className="dv-total-cell-value dv-cell-with-icon">
                      {formatCurrencyValue(v, c)}
                      {isNative ? <AnyCurrencyIcon currency={currency} /> : rewardIcon}
                    </span>
                  </td>
                </tr>
              );
            })}
            {!isSingleCurrency && !isNative && (
              <tr>
                <td className="dv-totals-label">Total</td>
                <td>
                  <span className="dv-total-cell-value dv-total-cell-value--accent dv-cell-with-icon">
                    {formatCurrencyValue(
                      simpleView === "USD" ? grandTotal.rewardInUSD : grandTotal.rewardInFiat,
                      simpleView,
                    )}
                    {rewardIcon}
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Data table */}
        <table ref={dataRef} className="dv-table dv-table-data">
          <colgroup>
            <col className="dv-column-date" />
            <col className="dv-column-value" />
          </colgroup>
          <thead>
            <tr>
              <th>
                <DateRangeFilter
                  value={dateRange}
                  onChange={setDateRange}
                  {...dateBounds}
                  dates={rowDates}
                />
              </th>
              <th>
                <span className="dv-cell-with-icon">
                  {valueLabel} {rewardIcon}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatedLoadingRow show={isFetching && finalRows.length > 0} colSpan={2} />
            {pageRows.map((row, i) => {
              const { v, c } = rowValue(row);
              return (
                <tr key={`${row.date}-${row.currency}-${i}`}>
                  <td className="dv-cell-date">
                    {groupByDay ? fmtDate(row.date) : fmtDateTime(row.date)}
                  </td>
                  <td>
                    <span className="dv-cell-with-icon">
                      {formatCurrencyValue(v, c)}
                      {isNative ? <AnyCurrencyIcon currency={row.currency} /> : rewardIcon}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={finalRows.length} onChange={setPage} />
    </>
  );
}
export default SimpleTable;
