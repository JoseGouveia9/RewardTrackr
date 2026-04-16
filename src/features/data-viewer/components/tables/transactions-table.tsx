import { useEffect, useMemo, useRef, useState } from "react";
import { loadCacheEntry } from "@/features/export/utils/cache";
import type { CacheEntry, RewardKey } from "@/features/export/types";
import type { TxView, DateRange } from "../../types";
import { PAGE_SIZE } from "../../utils/constants";
import {
  formatCurrencyValue,
  getDateBounds,
  matchesDateRange,
  fmtDate,
  fmtDateTime,
} from "../../utils";
import { GmtIcon, UsdIcon, FiatIcon } from "../icons/currency-icons";
import { DateRangeFilter } from "../date-range-filter";
import { TypeCheckFilter } from "../type-check-filter";
import { Pagination } from "../pagination";
import { useSyncTableColumns } from "../../hooks/use-sync-table-columns";
import { AnimatedLoadingRow } from "./animated-loading-row";

// Renders a paged GMT wallet-transactions table with type filter, date filter and optional group-by-day.
export function TransactionsTable({
  rewardKey,
  fiatCode,
  txView,
  isFetching = false,
  cacheVersion = 0,
  groupByDay,
  dateRange,
  setDateRange,
}: {
  rewardKey: RewardKey;
  fiatCode: string;
  txView: TxView;
  isFetching?: boolean;
  cacheVersion?: number;
  cacheEntry?: CacheEntry | null;
  groupByDay: boolean;
  dateRange: DateRange;
  setDateRange: (v: DateRange) => void;
}) {
  const [page, setPage] = useState(0);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const totalsRef = useRef<HTMLTableElement>(null);
  const dataRef = useRef<HTMLTableElement>(null);
  useSyncTableColumns(totalsRef, dataRef);
  const entry = useMemo(() => {
    void cacheVersion;
    return cacheEntry !== undefined ? cacheEntry : loadCacheEntry(rewardKey);
  }, [rewardKey, cacheVersion, cacheEntry]);

  const allRows = useMemo(() => {
    if (!entry?.records?.length) return [];
    return entry.records.map((r) => {
      const rec = r as Record<string, unknown>;
      const reward = Number(rec.reward ?? 0);
      const rewardInUSD = Number(rec.rewardInUSD ?? rec.rewardInUsd ?? 0);
      const rewardInFiat = Number(rec.rewardInFiat ?? 0);
      return {
        date: String(rec.createdAt ?? ""),
        txType: String(rec.txType ?? rec.fromType ?? ""),
        reward: Number.isFinite(reward) ? reward : 0,
        rewardInUSD: Number.isFinite(rewardInUSD) ? rewardInUSD : 0,
        rewardInFiat: Number.isFinite(rewardInFiat) ? rewardInFiat : 0,
      };
    });
  }, [entry]);

  const dateBounds = useMemo(() => getDateBounds(allRows), [allRows]);
  const rowDates = useMemo(() => allRows.map((r) => r.date.slice(0, 10)), [allRows]);

  const types = useMemo(
    () => [...new Set(allRows.map((r) => r.txType))].filter(Boolean).sort(),
    [allRows],
  );

  const filteredRows = useMemo(
    () =>
      allRows.filter(
        (r) =>
          matchesDateRange(r.date, dateRange) &&
          (selectedTypes.length === 0 || selectedTypes.includes(r.txType)),
      ),
    [allRows, dateRange, selectedTypes],
  );

  useEffect(() => setPage(0), [dateRange, selectedTypes, groupByDay]);

  const finalRows = useMemo(() => {
    if (!groupByDay) return filteredRows;
    const map = new Map<string, (typeof filteredRows)[0]>();
    for (const row of filteredRows) {
      const key = row.date.slice(0, 10) + "|" + row.txType;
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
  }, [filteredRows, groupByDay]);

  const pageRows = useMemo(
    () => finalRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [finalRows, page],
  );

  const rewardIcon =
    txView === "GMT" ? <GmtIcon /> : txView === "USD" ? <UsdIcon /> : <FiatIcon code={fiatCode} />;

  // Returns the display value and currency label for a row based on the active txView.
  function rowValue(row: { reward: number; rewardInUSD: number; rewardInFiat: number }) {
    if (txView === "USD") return { v: row.rewardInUSD, c: "USD" };
    if (txView === "FIAT") return { v: row.rewardInFiat, c: "FIAT" };
    return { v: row.reward, c: "GMT" };
  }

  const totalValues = useMemo(
    () =>
      filteredRows.reduce(
        (acc, r) => ({
          reward: acc.reward + r.reward,
          rewardInUSD: acc.rewardInUSD + r.rewardInUSD,
          rewardInFiat: acc.rewardInFiat + r.rewardInFiat,
        }),
        { reward: 0, rewardInUSD: 0, rewardInFiat: 0 },
      ),
    [filteredRows],
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

  const { v: totalV, c: totalC } = rowValue(totalValues);

  return (
    <>
      <div className="dv-tables-wrap">
        {/* Totals */}
        <table ref={totalsRef} className="dv-table dv-table-totals">
          <colgroup>
            <col className="dv-column-date" />
            <col className="dv-column-type" />
            <col className="dv-column-value" />
          </colgroup>
          <tbody>
            <tr>
              <td className="dv-totals-label">Total</td>
              <td />
              <td>
                <span className="dv-total-cell-label">Reward</span>
                <span className="dv-total-cell-value dv-total-cell-value--accent dv-cell-with-icon">
                  {formatCurrencyValue(totalV, totalC)}
                  {rewardIcon}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Data table */}
        <table ref={dataRef} className="dv-table dv-table-data">
          <colgroup>
            <col className="dv-column-date" />
            <col className="dv-column-type" />
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
                <TypeCheckFilter
                  label="Type"
                  types={types}
                  selected={selectedTypes}
                  onChange={setSelectedTypes}
                />
              </th>
              <th>
                <span className="dv-cell-with-icon">Reward {rewardIcon}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatedLoadingRow show={isFetching && finalRows.length > 0} colSpan={3} />
            {pageRows.map((row, i) => {
              const { v, c } = rowValue(row);
              return (
                <tr key={`${row.date}-${row.txType}-${i}`}>
                  <td className="dv-cell-date">
                    {groupByDay ? fmtDate(row.date) : fmtDateTime(row.date)}
                  </td>
                  <td className="dv-cell-type">{row.txType}</td>
                  <td className="dv-cell-accent">
                    <span className="dv-cell-with-icon">
                      {formatCurrencyValue(v, c)}
                      {rewardIcon}
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
export default TransactionsTable;
