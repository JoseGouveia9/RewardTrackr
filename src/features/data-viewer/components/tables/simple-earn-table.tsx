import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { loadCacheEntry } from "@/features/export/utils/cache";
import type { CacheEntry, RewardKey } from "@/features/export/types";
import type { EarnView, DateRange } from "../../types";
import { PAGE_SIZE } from "../../utils/constants";
import {
  formatCurrencyValue,
  getDateBounds,
  matchesDateRange,
  fmtDate,
  fmtDateTime,
} from "../../utils";
import { AnyCurrencyIcon, UsdIcon, FiatIcon } from "../icons/currency-icons";
import { DateRangeFilter } from "../date-range-filter/date-range-filter";
import { Pagination } from "../pagination/pagination";
import { useSyncTableColumns } from "../../hooks/use-sync-table-columns";
import { AnimatedLoadingRow } from "./animated-loading-row";
import { useRowSelection } from "../../stores/row-selection-context";
import { TableEmptyState, AnimatedTotalsWrapper, TableNoResultsRow } from "./table-cell-utils";

function earnRowValue(
  row: { reward: number; rewardInUSD: number; rewardInFiat: number; currency: string },
  earnView: EarnView,
) {
  if (earnView === "USD") return { v: row.rewardInUSD, c: "USD" };
  if (earnView === "FIAT") return { v: row.rewardInFiat, c: "FIAT" };
  return { v: row.reward, c: row.currency };
}

export function SimpleEarnTable({
  rewardKey,
  fiatCode,
  earnView,
  isFetching = false,
  cacheVersion = 0,
  cacheEntry,
  groupByDay,
  dateRange,
  setDateRange,
  pageSize,
}: {
  rewardKey: RewardKey;
  fiatCode: string;
  earnView: EarnView;
  isFetching?: boolean;
  cacheVersion?: number;
  cacheEntry?: CacheEntry | null;
  groupByDay: boolean;
  dateRange: DateRange;
  setDateRange: (v: DateRange) => void;
  pageSize?: number;
}) {
  const { t } = useTranslation();
  const rowSel = useRowSelection();
  const excluded = useMemo(() => new Set(rowSel?.exclusions[rewardKey] ?? []), [rowSel, rewardKey]);
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
    return entry.records.map((r, i) => {
      const rec = r as Record<string, unknown>;
      const reward = Number(rec.reward ?? 0);
      const rewardInUSD = Number(rec.rewardInUSD ?? rec.rewardInUsd ?? 0);
      const rewardInFiat = Number(rec.rewardInFiat ?? 0);
      const apr = Number(rec.apr ?? 0);
      return {
        date: String(rec.createdAt ?? ""),
        rowId: `${rewardKey}::${String(rec.createdAt ?? "")}::${i}`,
        asset: String(rec.asset ?? rec.currency ?? ""),
        currency: String(rec.currency ?? ""),
        apr: Number.isFinite(apr) ? apr : 0,
        reward: Number.isFinite(reward) ? reward : 0,
        rewardInUSD: Number.isFinite(rewardInUSD) ? rewardInUSD : 0,
        rewardInFiat: Number.isFinite(rewardInFiat) ? rewardInFiat : 0,
      };
    });
  }, [entry, rewardKey]);

  const dateBounds = useMemo(() => getDateBounds(rows), [rows]);
  const rowDates = useMemo(() => rows.map((r) => r.date.slice(0, 10)), [rows]);

  const filteredRows = useMemo(
    () => rows.filter((r) => matchesDateRange(r.date, dateRange)),
    [rows, dateRange],
  );

  useEffect(() => setPage(0), [dateRange, groupByDay]);

  const displayRows = filteredRows;

  const finalRows = useMemo(() => {
    type FinalRow = (typeof displayRows)[0] & { groupIds: string[] };
    if (!groupByDay) return displayRows.map((r): FinalRow => ({ ...r, groupIds: [r.rowId] }));
    const map = new Map<string, FinalRow>();
    for (const row of displayRows) {
      const key = row.date.slice(0, 10) + "|" + row.asset;
      const ex = map.get(key);
      if (ex) {
        map.set(key, {
          ...ex,
          reward: ex.reward + row.reward,
          rewardInUSD: ex.rewardInUSD + row.rewardInUSD,
          rewardInFiat: ex.rewardInFiat + row.rewardInFiat,
          groupIds: [...ex.groupIds, row.rowId],
        });
      } else {
        map.set(key, { ...row, date: row.date.slice(0, 10), groupIds: [row.rowId] });
      }
    }
    return [...map.values()];
  }, [displayRows, groupByDay]);

  const effectivePageSize = pageSize ?? PAGE_SIZE;
  const pageRows = useMemo(
    () => finalRows.slice(page * effectivePageSize, (page + 1) * effectivePageSize),
    [finalRows, page, effectivePageSize],
  );

  const selectedRows = useMemo(
    () => (rowSel ? filteredRows.filter((r) => !excluded.has(r.rowId)) : filteredRows),
    [filteredRows, rowSel, excluded],
  );

  const assetTotals = useMemo(() => {
    const map = new Map<
      string,
      { currency: string; reward: number; rewardInUSD: number; rewardInFiat: number }
    >();
    for (const row of selectedRows) {
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
  }, [selectedRows]);

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

  if (!entry) {
    return <TableEmptyState isFetching={isFetching} />;
  }

  return (
    <>
      <div className="dv-tables-wrap dv-tables-wrap--scroll">
        <AnimatedTotalsWrapper show={selectedRows.length > 0}>
          <table ref={totalsRef} className="dv-table dv-table-totals">
            <colgroup>
              <col className="dv-column-date" />
              <col className="dv-column-value" />
              <col className="dv-column-rate" />
              <col className="dv-column-value" />
            </colgroup>
            <tbody>
              <tr>
                <td className="dv-totals-label">{t("common.total")}</td>
                <td />
                <td />
                <td>
                  <span className="dv-total-cell-label">{t("dataViewer.reward")}</span>
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
        </AnimatedTotalsWrapper>

        <table
          ref={dataRef}
          className={`dv-table dv-table-data${rowSel ? " dv-selection-mode" : ""}`}
        >
          <colgroup>
            <col className="dv-column-date" />
            <col className="dv-column-value" />
            <col className="dv-column-rate" />
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
              <th>{t("dataViewer.asset")}</th>
              <th>APR</th>
              <th>{t("dataViewer.reward")}</th>
            </tr>
          </thead>
          <tbody>
            <AnimatedLoadingRow show={isFetching && finalRows.length > 0} colSpan={4} />
            {filteredRows.length === 0 && <TableNoResultsRow colSpan={4} />}
            {pageRows.map((row, i) => {
              const { v, c } = earnRowValue(row, earnView);
              const icon = isEarnNative ? (
                <AnyCurrencyIcon currency={row.currency} />
              ) : isEarnUsd ? (
                <UsdIcon />
              ) : (
                <FiatIcon code={fiatCode} />
              );
              const ids = row.groupIds;
              const isExcluded = rowSel ? ids.every((id) => excluded.has(id)) : false;
              return (
                <tr
                  key={`${row.date}-${row.asset}-${i}`}
                  className={rowSel ? (isExcluded ? "dv-row--excluded" : "dv-row--selected") : ""}
                  onClick={rowSel ? () => rowSel.onToggle(rewardKey, ids) : undefined}
                >
                  <td className="dv-cell-date">
                    {groupByDay ? fmtDate(row.date) : fmtDateTime(row.date)}
                  </td>
                  <td>
                    <span className="dv-cell-with-icon">
                      <AnyCurrencyIcon currency={row.asset} />
                      {row.asset}
                    </span>
                  </td>
                  <td>{(row.apr * 100).toFixed(2)}%</td>
                  <td className="dv-cell-accent">
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
      </div>
      <Pagination
        page={page}
        total={finalRows.length}
        onChange={setPage}
        pageSize={effectivePageSize}
      />
    </>
  );
}
export default SimpleEarnTable;
