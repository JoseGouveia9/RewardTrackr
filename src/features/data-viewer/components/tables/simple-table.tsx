import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { DateRangeFilter } from "../date-range-filter/date-range-filter";
import { Pagination } from "../pagination/pagination";
import { useSyncTableColumns } from "../../hooks/use-sync-table-columns";
import { AnimatedLoadingRow } from "./animated-loading-row";
import { useRowSelection } from "../../stores/row-selection-context";
import { TableEmptyState, AnimatedTotalsWrapper, TableNoResultsRow } from "./table-cell-utils";

function rowValue(
  row: { reward: number; rewardInUSD: number; rewardInFiat: number; currency: string },
  simpleView: SimpleView,
) {
  if (simpleView === "USD") return { v: row.rewardInUSD, c: "USD" };
  if (simpleView === "FIAT") return { v: row.rewardInFiat, c: "FIAT" };
  return { v: row.reward, c: row.currency };
}

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
  pageSize,
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
  pageSize?: number;
}) {
  const { t } = useTranslation();
  const rowSel = useRowSelection();
  const excluded = useMemo(() => new Set(rowSel?.exclusions[rewardKey] ?? []), [rowSel, rewardKey]);
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
    return entry.records.map((r, i) => {
      const rec = r as Record<string, unknown>;
      const reward = Number(rec.reward ?? 0);
      const rewardInUSD = Number(rec.rewardInUSD ?? rec.rewardInUsd ?? 0);
      const rewardInFiat = Number(rec.rewardInFiat ?? 0);
      return {
        date: String(rec.createdAt ?? ""),
        rowId: `${rewardKey}::${String(rec.createdAt ?? "")}::${i}`,
        currency: String(rec.currency ?? ""),
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

  useEffect(() => setPage(0), [dateRange, hiddenCurrencies, groupByDay]);

  const displayRows = useMemo(
    () => filteredRows.filter((r) => !hiddenCurrencies.has(r.currency)),
    [filteredRows, hiddenCurrencies],
  );

  const finalRows = useMemo(() => {
    type FinalRow = (typeof displayRows)[0] & { groupIds: string[] };
    if (!groupByDay) return displayRows.map((r): FinalRow => ({ ...r, groupIds: [r.rowId] }));
    const map = new Map<string, FinalRow>();
    for (const row of displayRows) {
      const key = row.date.slice(0, 10) + "|" + row.currency;
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

  // Stable currency order derived from all filtered rows so the bar never reorders
  // when individual entries are excluded.
  const currencyOrder = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const row of filteredRows) {
      if (!seen.has(row.currency)) {
        seen.add(row.currency);
        order.push(row.currency);
      }
    }
    return order;
  }, [filteredRows]);

  const currencyTotals = useMemo(() => {
    const map = new Map<string, { reward: number; rewardInUSD: number; rewardInFiat: number }>();
    for (const row of selectedRows) {
      const cur = map.get(row.currency) ?? { reward: 0, rewardInUSD: 0, rewardInFiat: 0 };
      map.set(row.currency, {
        reward: cur.reward + row.reward,
        rewardInUSD: cur.rewardInUSD + row.rewardInUSD,
        rewardInFiat: cur.rewardInFiat + row.rewardInFiat,
      });
    }
    return currencyOrder.filter((c) => map.has(c)).map((c) => [c, map.get(c)!] as const);
  }, [selectedRows, currencyOrder]);

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
    return <TableEmptyState isFetching={isFetching} />;
  }

  const isNative = simpleView === "NATIVE";
  const rewardIcon = isNative ? null : simpleView === "USD" ? (
    <UsdIcon />
  ) : (
    <FiatIcon code={fiatCode} />
  );
  const isSingleCurrency = currencyTotals.length === 1;
  const valueLabel =
    rewardKey === "deposits"
      ? t("dataViewer.deposited")
      : rewardKey === "withdrawals"
        ? t("dataViewer.withdrawn")
        : t("dataViewer.reward");

  return (
    <>
      <div className="dv-tables-wrap">
        <AnimatedTotalsWrapper show={selectedRows.length > 0}>
          <table ref={totalsRef} className="dv-table dv-table-totals">
            <colgroup>
              <col className="dv-column-date" />
              <col className="dv-column-value" />
            </colgroup>
            <tbody>
              {currencyTotals.map(([currency, totals]) => {
                const { v, c } = rowValue({ ...totals, currency }, simpleView);
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
                        <span className="dv-totals-label">{t("common.total")}</span>
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
                <tr className="dv-totals-row--summary">
                  <td className="dv-totals-label">{t("common.total")}</td>
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
        </AnimatedTotalsWrapper>

        <table
          ref={dataRef}
          className={`dv-table dv-table-data${rowSel ? " dv-selection-mode" : ""}`}
        >
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
            {filteredRows.length === 0 && <TableNoResultsRow colSpan={2} />}
            {pageRows.map((row, i) => {
              const { v, c } = rowValue(row, simpleView);
              const ids = row.groupIds;
              const isExcluded = rowSel ? ids.every((id) => excluded.has(id)) : false;
              return (
                <tr
                  key={`${row.date}-${row.currency}-${i}`}
                  className={rowSel ? (isExcluded ? "dv-row--excluded" : "dv-row--selected") : ""}
                  onClick={rowSel ? () => rowSel.onToggle(rewardKey, ids) : undefined}
                >
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
      <Pagination
        page={page}
        total={finalRows.length}
        onChange={setPage}
        pageSize={effectivePageSize}
      />
    </>
  );
}
export default SimpleTable;
