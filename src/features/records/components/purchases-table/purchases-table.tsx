import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildOccurrenceIds } from "@/lib/row-ids";
import type { CacheEntry } from "@/types/rewards";
import type { PurchaseView, DateRange } from "../../types";
import { formatCurrencyValue, groupRowsByDay, matchesDateRange, toFiniteNumber } from "../../utils";
import { AnyCurrencyIcon } from "@/components/icons/currency-icons";
import { TypeCheckFilter } from "../type-check-filter/type-check-filter";
import { useCacheEntry } from "../../hooks/use-cache-entry";
import { useHiddenCurrencies } from "../../hooks/use-hidden-currencies";
import { usePagedRows } from "../../hooks/use-paged-rows";
import { useRowExclusions } from "../../hooks/use-row-exclusions";
import { useSyncTableColumns } from "../../hooks/use-sync-table-columns";
import { getSelectableRowProps } from "../../stores/row-selection-context";
import { useRegisterRowSelectionControls } from "../../stores/row-selection-controls-context";
import { CurrencyTotalsRows } from "../currency-totals-rows/currency-totals-rows";
import { RecordsTable } from "../records-table/records-table";
import {
  DateCell,
  DateHeaderCell,
  IconValue,
  TableEmptyState,
  ViewIcon,
} from "../table-cell-utils/table-cell-utils";

const COLUMN_CLASSES = ["dv-column-date", "dv-column-type", "dv-column-value"];

interface PurchaseRow {
  date: string;
  rowId: string;
  type: string;
  currency: string;
  reward: number | undefined;
  valueUsd: number;
  valueFiat: number;
}

/**
 * Normalizes cache records to rows; non-finite rewards become undefined so merging can ignore
 * them.
 */
function parseEntry(entry: CacheEntry | null, keyPrefix: string): PurchaseRow[] {
  if (!entry?.records?.length) return [];
  const ids = buildOccurrenceIds(entry.records, keyPrefix);
  return entry.records.map((entryRecord, index) => {
    const record = entryRecord as Record<string, unknown>;
    const reward = record.reward != null ? Number(record.reward) : undefined;
    return {
      date: String(record.createdAt ?? ""),
      rowId: ids[index],
      type: String(record.type ?? ""),
      currency: String(record.currency ?? ""),
      reward: reward != null && Number.isFinite(reward) ? reward : undefined,
      valueUsd: toFiniteNumber(record.valueUsd),
      valueFiat: toFiniteNumber(record.valueFiat),
    };
  });
}

/**
 * Sums reward and USD/fiat values of two rows, keeping the other row's reward when one is
 * missing.
 */
function mergePurchaseRows(accumulator: PurchaseRow, row: PurchaseRow): PurchaseRow {
  return {
    ...accumulator,
    reward:
      accumulator.reward != null && row.reward != null
        ? accumulator.reward + row.reward
        : (accumulator.reward ?? row.reward),
    valueUsd: accumulator.valueUsd + row.valueUsd,
    valueFiat: accumulator.valueFiat + row.valueFiat,
  };
}

export function PurchasesTable({
  fiatCode,
  purchaseView,
  isFetching = false,
  cacheVersion = 0,
  purchasesCacheEntry,
  upgradesCacheEntry,
  groupByDay,
  dateRange,
  setDateRange,
  pageSize,
}: {
  fiatCode: string;
  purchaseView: PurchaseView;
  isFetching?: boolean;
  cacheVersion?: number;
  purchasesCacheEntry?: CacheEntry | null;
  upgradesCacheEntry?: CacheEntry | null;
  groupByDay: boolean;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  pageSize?: number;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [hiddenCurrencies, toggleCurrency] = useHiddenCurrencies();
  const { totalsRef, dataRef } = useSyncTableColumns();
  const purchasesEntry = useCacheEntry("purchases", purchasesCacheEntry, cacheVersion);
  const upgradesEntry = useCacheEntry("upgrades", upgradesCacheEntry, cacheVersion);

  const rows = useMemo(
    () =>
      [...parseEntry(purchasesEntry, "purchases"), ...parseEntry(upgradesEntry, "upgrades")].sort(
        (left, right) => right.date.localeCompare(left.date),
      ),
    [purchasesEntry, upgradesEntry],
  );

  const types = useMemo(
    () => [...new Set(rows.map((row) => row.type))].filter(Boolean).sort(),
    [rows],
  );

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          matchesDateRange(row.date, dateRange) &&
          (selectedTypes.length === 0 || selectedTypes.includes(row.type)),
      ),
    [rows, dateRange, selectedTypes],
  );
  const { rowSelection, excluded, selectedRows, selectAll, selectNone } = useRowExclusions(
    "purchases",
    filteredRows,
  );
  useRegisterRowSelectionControls(Boolean(rowSelection), selectAll, selectNone);

  useEffect(() => setPage(0), [dateRange, selectedTypes, hiddenCurrencies, groupByDay]);

  const finalRows = useMemo(
    () =>
      groupRowsByDay(
        filteredRows.filter((row) => !hiddenCurrencies.has(row.currency)),
        groupByDay,
        (row) => `${row.currency}|${row.type}`,
        mergePurchaseRows,
      ),
    [filteredRows, hiddenCurrencies, groupByDay],
  );
  const { pageRows, effectivePageSize } = usePagedRows(finalRows, page, pageSize);

  const currencyTotals = useMemo(() => {
    const map = new Map<string, { nativeAmount: number; valueUsd: number; valueFiat: number }>();
    for (const row of selectedRows) {
      const current = map.get(row.currency) ?? { nativeAmount: 0, valueUsd: 0, valueFiat: 0 };
      map.set(row.currency, {
        nativeAmount: current.nativeAmount + (row.reward ?? row.valueUsd),
        valueUsd: current.valueUsd + row.valueUsd,
        valueFiat: current.valueFiat + row.valueFiat,
      });
    }
    return [...map.entries()];
  }, [selectedRows]);

  const grandTotal = useMemo(
    () =>
      currencyTotals
        .filter(([currency]) => !hiddenCurrencies.has(currency))
        .reduce(
          (sum, [, totals]) => sum + (purchaseView === "USD" ? totals.valueUsd : totals.valueFiat),
          0,
        ),
    [currencyTotals, hiddenCurrencies, purchaseView],
  );

  if (!purchasesEntry && !upgradesEntry) {
    return <TableEmptyState isFetching={isFetching} />;
  }

  const typeLabel = (type: string) => {
    if (type === "Purchase") return t("purchaseType.purchase");
    if (type === "Upgrade - Energy Efficiency") return t("purchaseType.upgradeEnergyEfficiency");
    if (type === "Upgrade - Power") return t("purchaseType.upgradePower");
    return type;
  };

  return (
    <RecordsTable
      columnClasses={COLUMN_CLASSES}
      totalsRef={totalsRef}
      dataRef={dataRef}
      showTotals={selectedRows.length > 0}
      totals={
        <CurrencyTotalsRows
          totals={currencyTotals.map(([currency, totals]) => {
            if (purchaseView === "USD") return { currency, value: totals.valueUsd, unit: "USD" };
            if (purchaseView === "FIAT") return { currency, value: totals.valueFiat, unit: "FIAT" };
            return { currency, value: totals.nativeAmount, unit: currency };
          })}
          hiddenCurrencies={hiddenCurrencies}
          onToggle={toggleCurrency}
          cellLabel="Bought"
          hasMiddleCell
          view={purchaseView}
          fiatCode={fiatCode}
          grandTotal={grandTotal}
        />
      }
      head={
        <>
          <DateHeaderCell rows={rows} value={dateRange} onChange={setDateRange} />
          <th>
            <TypeCheckFilter
              label={t("dataViewer.type")}
              types={types}
              selected={selectedTypes}
              onChange={setSelectedTypes}
              renderOption={typeLabel}
            />
          </th>
          <th>
            {purchaseView === "NATIVE" ? (
              t("dataViewer.bought")
            ) : (
              <span className="dv-cell-with-icon">
                {t("dataViewer.bought")} <ViewIcon view={purchaseView} fiatCode={fiatCode} />
              </span>
            )}
          </th>
        </>
      }
      rowState={{
        selectionMode: Boolean(rowSelection),
        showLoadingRow: isFetching && finalRows.length > 0,
        showNoResults: filteredRows.length === 0,
      }}
      pagination={{
        page: page,
        total: finalRows.length,
        pageSize: effectivePageSize,
        onChange: setPage,
      }}
    >
      {pageRows.map((row, index) => {
        const boughtValue =
          purchaseView === "NATIVE"
            ? (row.reward ?? row.valueUsd)
            : purchaseView === "USD"
              ? row.valueUsd
              : row.valueFiat;
        const boughtCurrency = purchaseView === "NATIVE" ? row.currency : purchaseView;
        return (
          <tr
            key={`${row.date}-${row.currency}-${row.type}-${index}`}
            {...getSelectableRowProps(rowSelection, excluded, "purchases", row.groupIds)}
          >
            <DateCell date={row.date} groupByDay={groupByDay} />
            <td className="dv-cell-type">{typeLabel(row.type)}</td>
            <td className="dv-cell-accent">
              <IconValue
                text={formatCurrencyValue(boughtValue, boughtCurrency)}
                icon={
                  <ViewIcon
                    view={purchaseView}
                    fiatCode={fiatCode}
                    native={<AnyCurrencyIcon currency={row.currency} />}
                  />
                }
              />
            </td>
          </tr>
        );
      })}
    </RecordsTable>
  );
}
