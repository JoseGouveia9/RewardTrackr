import { useEffect, useMemo, useRef, useState } from "react";
import { loadCacheEntry } from "@/features/export/utils/cache";
import type { PurchaseView, DateRange } from "../../types";
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
import { TypeCheckFilter } from "../type-check-filter";
import { Pagination } from "../pagination";
import { useSyncTableColumns } from "../../hooks/use-sync-table-columns";
import { AnimatedLoadingRow } from "./animated-loading-row";

// Renders a paged purchases and upgrades table combining both sheets, with type/date filters.
export function PurchasesTable({
  fiatCode,
  purchaseView,
  isFetching = false,
  cacheVersion = 0,
  groupByDay,
  dateRange,
  setDateRange,
}: {
  fiatCode: string;
  purchaseView: PurchaseView;
  isFetching?: boolean;
  cacheVersion?: number;
  groupByDay: boolean;
  dateRange: DateRange;
  setDateRange: (v: DateRange) => void;
}) {
  const [page, setPage] = useState(0);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [hiddenCurrencies, setHiddenCurrencies] = useState<Set<string>>(new Set());
  const totalsRef = useRef<HTMLTableElement>(null);
  const dataRef = useRef<HTMLTableElement>(null);
  useSyncTableColumns(totalsRef, dataRef);
  const purchasesEntry = useMemo(() => {
    void cacheVersion;
    return loadCacheEntry("purchases");
  }, [cacheVersion]);
  const upgradesEntry = useMemo(() => {
    void cacheVersion;
    return loadCacheEntry("upgrades");
  }, [cacheVersion]);

  // Normalises a cache entry's records into the shape expected by this table.
  function parseEntry(entry: ReturnType<typeof loadCacheEntry>) {
    if (!entry?.records?.length) return [];
    return entry.records.map((r) => {
      const rec = r as Record<string, unknown>;
      const valueUsd = Number(rec.valueUsd ?? 0);
      const valueFiat = Number(rec.valueFiat ?? 0);
      const reward = rec.reward != null ? Number(rec.reward) : undefined;
      return {
        date: String(rec.createdAt ?? ""),
        type: String(rec.type ?? ""),
        currency: String(rec.currency ?? ""),
        reward: reward != null && Number.isFinite(reward) ? reward : undefined,
        valueUsd: Number.isFinite(valueUsd) ? valueUsd : 0,
        valueFiat: Number.isFinite(valueFiat) ? valueFiat : 0,
      };
    });
  }

  const rows = useMemo(
    () =>
      [...parseEntry(purchasesEntry), ...parseEntry(upgradesEntry)].sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    [purchasesEntry, upgradesEntry],
  );

  const dateBounds = useMemo(() => getDateBounds(rows), [rows]);
  const rowDates = useMemo(() => rows.map((r) => r.date.slice(0, 10)), [rows]);

  const types = useMemo(() => [...new Set(rows.map((r) => r.type))].filter(Boolean).sort(), [rows]);

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          matchesDateRange(r.date, dateRange) &&
          (selectedTypes.length === 0 || selectedTypes.includes(r.type)),
      ),
    [rows, dateRange, selectedTypes],
  );

  useEffect(() => setPage(0), [dateRange, selectedTypes, hiddenCurrencies, groupByDay]);

  const displayRows = useMemo(
    () => filteredRows.filter((r) => !hiddenCurrencies.has(r.currency)),
    [filteredRows, hiddenCurrencies],
  );

  const finalRows = useMemo(() => {
    if (!groupByDay) return displayRows;
    const map = new Map<string, (typeof displayRows)[0]>();
    for (const row of displayRows) {
      const key = `${row.date.slice(0, 10)}|${row.currency}|${row.type}`;
      const existing = map.get(key);
      if (existing) {
        map.set(key, {
          ...existing,
          reward:
            existing.reward != null && row.reward != null
              ? existing.reward + row.reward
              : (existing.reward ?? row.reward),
          valueUsd: existing.valueUsd + row.valueUsd,
          valueFiat: existing.valueFiat + row.valueFiat,
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

  const currencyTotals = useMemo(() => {
    const map = new Map<string, { nativeAmount: number; valueUsd: number; valueFiat: number }>();
    for (const row of filteredRows) {
      const cur = map.get(row.currency) ?? { nativeAmount: 0, valueUsd: 0, valueFiat: 0 };
      map.set(row.currency, {
        nativeAmount: cur.nativeAmount + (row.reward ?? row.valueUsd),
        valueUsd: cur.valueUsd + row.valueUsd,
        valueFiat: cur.valueFiat + row.valueFiat,
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
            valueUsd: acc.valueUsd + t.valueUsd,
            valueFiat: acc.valueFiat + t.valueFiat,
          }),
          { valueUsd: 0, valueFiat: 0 },
        ),
    [currencyTotals, hiddenCurrencies],
  );

  const isSingleCurrency = currencyTotals.length === 1;
  const isNative = purchaseView === "NATIVE";
  const boughtIcon = isNative ? null : purchaseView === "USD" ? (
    <UsdIcon />
  ) : (
    <FiatIcon code={fiatCode} />
  );

  // Returns the display value and currency label for a totals row based on the active purchaseView.
  function totalValue(
    t: { nativeAmount: number; valueUsd: number; valueFiat: number },
    currency: string,
  ) {
    if (purchaseView === "USD") return { v: t.valueUsd, c: "USD" as string };
    if (purchaseView === "FIAT") return { v: t.valueFiat, c: "FIAT" as string };
    return { v: t.nativeAmount, c: currency };
  }

  if (!purchasesEntry && !upgradesEntry) {
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
      <div className="dv-tables-wrap">
        {/* Totals per currency */}
        <table ref={totalsRef} className="dv-table dv-table-totals">
          <colgroup>
            <col className="dv-column-date" />
            <col className="dv-column-type" />
            <col className="dv-column-value" />
          </colgroup>
          <tbody>
            {currencyTotals.map(([currency, t]) => {
              const { v, c } = totalValue(t, currency);
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
                  <td />
                  <td>
                    <span className="dv-total-cell-label">Bought</span>
                    <span className="dv-total-cell-value dv-cell-with-icon">
                      {formatCurrencyValue(v, c)}
                      {isNative ? <AnyCurrencyIcon currency={currency} /> : boughtIcon}
                    </span>
                  </td>
                </tr>
              );
            })}
            {!isSingleCurrency && !isNative && (
              <tr>
                <td className="dv-totals-label">Total</td>
                <td />
                <td>
                  <span className="dv-total-cell-value dv-total-cell-value--accent dv-cell-with-icon">
                    {formatCurrencyValue(
                      purchaseView === "USD" ? grandTotal.valueUsd : grandTotal.valueFiat,
                      purchaseView,
                    )}
                    {boughtIcon}
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
                {purchaseView === "NATIVE" && "Bought"}
                {purchaseView === "USD" && (
                  <span className="dv-cell-with-icon">
                    Bought <UsdIcon />
                  </span>
                )}
                {purchaseView === "FIAT" && (
                  <span className="dv-cell-with-icon">
                    Bought <FiatIcon code={fiatCode} />
                  </span>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatedLoadingRow show={isFetching && finalRows.length > 0} colSpan={3} />
            {pageRows.map((row, i) => {
              const boughtVal =
                purchaseView === "NATIVE"
                  ? (row.reward ?? row.valueUsd)
                  : purchaseView === "USD"
                    ? row.valueUsd
                    : row.valueFiat;
              const boughtCur = purchaseView === "NATIVE" ? row.currency : purchaseView;
              return (
                <tr key={`${row.date}-${row.currency}-${row.type}-${i}`}>
                  <td className="dv-cell-date">
                    {groupByDay ? fmtDate(row.date) : fmtDateTime(row.date)}
                  </td>
                  <td className="dv-cell-type">{row.type}</td>
                  <td className="dv-cell-accent">
                    <span className="dv-cell-with-icon">
                      {formatCurrencyValue(boughtVal, boughtCur)}
                      {purchaseView === "NATIVE" ? (
                        <AnyCurrencyIcon currency={row.currency} />
                      ) : purchaseView === "USD" ? (
                        <UsdIcon />
                      ) : (
                        <FiatIcon code={fiatCode} />
                      )}
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
export default PurchasesTable;
