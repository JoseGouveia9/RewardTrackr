import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildOccurrenceIds } from "@/lib/row-ids";
import type { CacheEntry, RewardKey } from "@/types/rewards";
import type { SimpleView, DateRange } from "../../types";
import {
  formatCurrencyValue,
  groupRowsByDay,
  matchesDateRange,
  parseRewardAmounts,
  pickViewValue,
  sumRewardAmounts,
} from "../../utils";
import { AnyCurrencyIcon } from "@/components/icons/currency-icons";
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

const COLUMN_CLASSES = ["dv-column-date", "dv-column-value"];

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
  setDateRange: (range: DateRange) => void;
  pageSize?: number;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [hiddenCurrencies, toggleCurrency] = useHiddenCurrencies();
  const { totalsRef, dataRef } = useSyncTableColumns();
  const entry = useCacheEntry(rewardKey, cacheEntry, cacheVersion);

  const rows = useMemo(() => {
    if (!entry?.records?.length) return [];
    const ids = buildOccurrenceIds(entry.records, rewardKey);
    return entry.records.map((entryRecord, index) => {
      const record = entryRecord as Record<string, unknown>;
      return {
        date: String(record.createdAt ?? ""),
        rowId: ids[index],
        currency: String(record.currency ?? ""),
        ...parseRewardAmounts(record),
      };
    });
  }, [entry, rewardKey]);

  const filteredRows = useMemo(
    () => rows.filter((row) => matchesDateRange(row.date, dateRange)),
    [rows, dateRange],
  );
  const { rowSelection, excluded, selectedRows, selectAll, selectNone } = useRowExclusions(
    rewardKey,
    filteredRows,
  );
  useRegisterRowSelectionControls(Boolean(rowSelection), selectAll, selectNone);

  useEffect(() => setPage(0), [dateRange, hiddenCurrencies, groupByDay]);

  const finalRows = useMemo(
    () =>
      groupRowsByDay(
        filteredRows.filter((row) => !hiddenCurrencies.has(row.currency)),
        groupByDay,
        (row) => row.currency,
        sumRewardAmounts,
      ),
    [filteredRows, hiddenCurrencies, groupByDay],
  );
  const { pageRows, effectivePageSize } = usePagedRows(finalRows, page, pageSize);

  const currencyTotals = useMemo(() => {
    const order = [...new Set(filteredRows.map((row) => row.currency))];
    const map = new Map<string, { reward: number; rewardInUSD: number; rewardInFiat: number }>();
    for (const row of selectedRows) {
      const current = map.get(row.currency) ?? { reward: 0, rewardInUSD: 0, rewardInFiat: 0 };
      map.set(row.currency, {
        reward: current.reward + row.reward,
        rewardInUSD: current.rewardInUSD + row.rewardInUSD,
        rewardInFiat: current.rewardInFiat + row.rewardInFiat,
      });
    }
    return order
      .filter((currency) => map.has(currency))
      .map((currency) => [currency, map.get(currency)!] as const);
  }, [filteredRows, selectedRows]);

  const grandTotal = useMemo(
    () =>
      currencyTotals
        .filter(([currency]) => !hiddenCurrencies.has(currency))
        .reduce(
          (sum, [, totals]) =>
            sum + (simpleView === "USD" ? totals.rewardInUSD : totals.rewardInFiat),
          0,
        ),
    [currencyTotals, hiddenCurrencies, simpleView],
  );

  if (!entry) {
    return <TableEmptyState isFetching={isFetching} />;
  }

  const valueLabel =
    rewardKey === "deposits"
      ? t("dataViewer.deposited")
      : rewardKey === "withdrawals"
        ? t("dataViewer.withdrawn")
        : t("dataViewer.reward");

  return (
    <RecordsTable
      columnClasses={COLUMN_CLASSES}
      totalsRef={totalsRef}
      dataRef={dataRef}
      showTotals={selectedRows.length > 0}
      totals={
        <CurrencyTotalsRows
          totals={currencyTotals.map(([currency, totals]) => {
            const { value, currency: unit } = pickViewValue(totals, simpleView, currency);
            return { currency, value, unit };
          })}
          hiddenCurrencies={hiddenCurrencies}
          onToggle={toggleCurrency}
          cellLabel={valueLabel}
          hasMiddleCell={false}
          view={simpleView}
          fiatCode={fiatCode}
          grandTotal={grandTotal}
        />
      }
      head={
        <>
          <DateHeaderCell rows={rows} value={dateRange} onChange={setDateRange} />
          <th>
            <span className="dv-cell-with-icon">
              {valueLabel} <ViewIcon view={simpleView} fiatCode={fiatCode} />
            </span>
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
        const { value, currency } = pickViewValue(row, simpleView, row.currency);
        return (
          <tr
            key={`${row.date}-${row.currency}-${index}`}
            {...getSelectableRowProps(rowSelection, excluded, rewardKey, row.groupIds)}
          >
            <DateCell date={row.date} groupByDay={groupByDay} />
            <td>
              <IconValue
                text={formatCurrencyValue(value, currency)}
                icon={
                  <ViewIcon
                    view={simpleView}
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
