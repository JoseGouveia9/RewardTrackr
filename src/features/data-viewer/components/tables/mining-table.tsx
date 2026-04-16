import { useEffect, useMemo, useRef, useState } from "react";
import { loadCacheEntry } from "@/features/export/utils/cache";
import type { CacheEntry, RewardKey } from "@/features/export/types";
import type { Currency, DateRange } from "../../types";
import { PAGE_SIZE } from "../../utils/constants";
import {
  formatMiningValue,
  getRecordField,
  getDateBounds,
  matchesDateRange,
  fmtDate,
} from "../../utils";
import { MiningCurrencyIcon } from "../icons/currency-icons";
import { DateRangeFilter } from "../date-range-filter/date-range-filter";
import { Pagination } from "../pagination/pagination";
import { useSyncTableColumns } from "../../hooks/use-sync-table-columns";
import { AnimatedLoadingRow } from "./animated-loading-row";

// Renders a paged mining-rewards data table with date-range filter and running totals.
export function MiningTable({
  rewardKey,
  currency,
  fiatCode,
  isFetching = false,
  cacheVersion = 0,
  cacheEntry,
  dateRange,
  setDateRange,
}: {
  rewardKey: RewardKey;
  currency: Currency;
  fiatCode: string;
  isFetching?: boolean;
  cacheVersion?: number;
  cacheEntry?: CacheEntry | null;
  dateRange: DateRange;
  setDateRange: (v: DateRange) => void;
}) {
  const [page, setPage] = useState(0);
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
      return {
        date: String(rec.createdAt ?? ""),
        poolReward: getRecordField(rec, currency, "poolReward"),
        maintenance: getRecordField(rec, currency, "maintenance"),
        reward: getRecordField(rec, currency, "reward"),
        totalPower: Number(rec.totalPower ?? 0),
        discount: Number(rec.discount ?? 0),
      };
    });
  }, [entry, currency]);

  const dateBounds = useMemo(() => getDateBounds(rows), [rows]);
  const rowDates = useMemo(() => rows.map((r) => r.date.slice(0, 10)), [rows]);

  const filteredRows = useMemo(
    () => rows.filter((r) => matchesDateRange(r.date, dateRange)),
    [rows, dateRange],
  );

  useEffect(() => setPage(0), [dateRange]);

  const pageRows = useMemo(
    () => filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredRows, page],
  );

  const totals = useMemo(
    () =>
      filteredRows.reduce(
        (acc, r) => ({
          poolReward: acc.poolReward + r.poolReward,
          maintenance: acc.maintenance + r.maintenance,
          reward: acc.reward + r.reward,
        }),
        { poolReward: 0, maintenance: 0, reward: 0 },
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

  return (
    <>
      <div className="dv-tables-wrap dv-tables-wrap--wide">
        <table ref={totalsRef} className="dv-table dv-table-totals">
          <colgroup>
            <col className="dv-column-date" />
            <col className="dv-column-value" />
            <col className="dv-column-value" />
            <col className="dv-column-value" />
            <col className="dv-column-value" />
            <col className="dv-column-value" />
          </colgroup>
          <tbody>
            <tr>
              <td className="dv-totals-label">Total</td>
              <td />
              <td>
                <span className="dv-total-cell-label">Pool Reward</span>
                <span className="dv-total-cell-value dv-cell-with-icon">
                  {formatMiningValue(totals.poolReward, currency)}
                  <MiningCurrencyIcon currency={currency} fiatCode={fiatCode} />
                </span>
              </td>
              <td>
                <span className="dv-total-cell-label">Maintenance</span>
                <span className="dv-total-cell-value dv-cell-with-icon">
                  {formatMiningValue(totals.maintenance, currency)}
                  <MiningCurrencyIcon currency={currency} fiatCode={fiatCode} />
                </span>
              </td>
              <td />
              <td>
                <span className="dv-total-cell-label">Reward</span>
                <span className="dv-total-cell-value dv-total-cell-value--accent dv-cell-with-icon">
                  {formatMiningValue(totals.reward, currency)}
                  <MiningCurrencyIcon currency={currency} fiatCode={fiatCode} />
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        <table ref={dataRef} className="dv-table dv-table-data">
          <colgroup>
            <col className="dv-column-date" />
            <col className="dv-column-value" />
            <col className="dv-column-value" />
            <col className="dv-column-value" />
            <col className="dv-column-value" />
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
              <th>Power</th>
              <th>Pool Reward</th>
              <th>Maintenance</th>
              <th>Discount</th>
              <th>Reward</th>
            </tr>
          </thead>
          <tbody>
            <AnimatedLoadingRow show={isFetching && filteredRows.length > 0} colSpan={6} />
            {pageRows.map((row, i) => (
              <tr key={`${row.date}-${i}`}>
                <td className="dv-cell-date">{fmtDate(row.date)}</td>
                <td>
                  {row.totalPower > 0
                    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
                        row.totalPower,
                      ) + " TH"
                    : "-"}
                </td>
                <td>
                  <span className="dv-cell-with-icon">
                    {formatMiningValue(row.poolReward, currency)}
                    <MiningCurrencyIcon currency={currency} fiatCode={fiatCode} />
                  </span>
                </td>
                <td>
                  <span className="dv-cell-with-icon">
                    {formatMiningValue(row.maintenance, currency)}
                    <MiningCurrencyIcon currency={currency} fiatCode={fiatCode} />
                  </span>
                </td>
                <td>{row.discount > 0 ? (row.discount * 100).toFixed(2) + "%" : "-"}</td>
                <td className="dv-cell-accent">
                  <span className="dv-cell-with-icon">
                    {formatMiningValue(row.reward, currency)}
                    <MiningCurrencyIcon currency={currency} fiatCode={fiatCode} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={filteredRows.length} onChange={setPage} />
    </>
  );
}
export default MiningTable;
