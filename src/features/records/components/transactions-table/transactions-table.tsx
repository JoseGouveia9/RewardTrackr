import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildOccurrenceIds } from "@/lib/row-ids";
import { TRANSACTION_LABEL_TO_KEY } from "@/config/wallet-types";
import type { CacheEntry, RewardKey } from "@/types/rewards";
import type { TransactionView, DateRange } from "../../types";
import {
  formatCurrencyValue,
  groupRowsByDay,
  matchesDateRange,
  parseRewardAmounts,
  pickViewValue,
  sumRewardAmounts,
} from "../../utils";
import { GmtIcon } from "@/components/icons/currency-icons";
import { TypeCheckFilter } from "../type-check-filter/type-check-filter";
import { useCacheEntry } from "../../hooks/use-cache-entry";
import { usePagedRows } from "../../hooks/use-paged-rows";
import { useRowExclusions } from "../../hooks/use-row-exclusions";
import { useSyncTableColumns } from "../../hooks/use-sync-table-columns";
import { getSelectableRowProps } from "../../stores/row-selection-context";
import { RecordsTable } from "../records-table/records-table";
import {
  DateCell,
  DateHeaderCell,
  IconValue,
  TableEmptyState,
  TotalCell,
  ViewIcon,
} from "../table-cell-utils/table-cell-utils";

const COLUMN_CLASSES = ["dv-column-date", "dv-column-type", "dv-column-value"];

export function TransactionsTable({
  rewardKey,
  fiatCode,
  transactionView,
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
  transactionView: TransactionView;
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
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const { totalsRef, dataRef } = useSyncTableColumns();
  const entry = useCacheEntry(rewardKey, cacheEntry, cacheVersion);

  const allRows = useMemo(() => {
    if (!entry?.records?.length) return [];
    const ids = buildOccurrenceIds(entry.records, rewardKey);
    return entry.records.map((entryRecord, index) => {
      const record = entryRecord as Record<string, unknown>;
      return {
        date: String(record.createdAt ?? ""),
        rowId: ids[index],
        transactionType: String(record.txType ?? record.fromType ?? ""),
        ...parseRewardAmounts(record),
      };
    });
  }, [entry, rewardKey]);

  const types = useMemo(
    () => [...new Set(allRows.map((row) => row.transactionType))].filter(Boolean).sort(),
    [allRows],
  );

  const filteredRows = useMemo(
    () =>
      allRows.filter(
        (row) =>
          matchesDateRange(row.date, dateRange) &&
          (selectedTypes.length === 0 || selectedTypes.includes(row.transactionType)),
      ),
    [allRows, dateRange, selectedTypes],
  );
  const { rowSelection, excluded, selectedRows } = useRowExclusions(rewardKey, filteredRows);

  useEffect(() => setPage(0), [dateRange, selectedTypes, groupByDay]);

  const finalRows = useMemo(
    () => groupRowsByDay(filteredRows, groupByDay, (row) => row.transactionType, sumRewardAmounts),
    [filteredRows, groupByDay],
  );
  const { pageRows, effectivePageSize } = usePagedRows(finalRows, page, pageSize);

  const totalValues = useMemo(
    () =>
      selectedRows.reduce(
        (total, row) => ({
          reward: total.reward + row.reward,
          rewardInUSD: total.rewardInUSD + row.rewardInUSD,
          rewardInFiat: total.rewardInFiat + row.rewardInFiat,
        }),
        { reward: 0, rewardInUSD: 0, rewardInFiat: 0 },
      ),
    [selectedRows],
  );

  if (!entry) {
    return <TableEmptyState isFetching={isFetching} />;
  }

  const rewardIcon = <ViewIcon view={transactionView} fiatCode={fiatCode} native={<GmtIcon />} />;
  const transactionLabel = (type: string) =>
    t(TRANSACTION_LABEL_TO_KEY[type] ?? type, { defaultValue: type });
  const { value: totalValue, currency: totalCurrency } = pickViewValue(
    totalValues,
    transactionView,
    "GMT",
  );

  return (
    <RecordsTable
      columnClasses={COLUMN_CLASSES}
      totalsRef={totalsRef}
      dataRef={dataRef}
      showTotals={selectedRows.length > 0}
      totals={
        <tr>
          <td className="dv-totals-label">{t("common.total")}</td>
          <td />
          <td>
            <TotalCell
              label={t("dataViewer.reward")}
              text={formatCurrencyValue(totalValue, totalCurrency)}
              icon={rewardIcon}
              accent
            />
          </td>
        </tr>
      }
      head={
        <>
          <DateHeaderCell rows={allRows} value={dateRange} onChange={setDateRange} />
          <th>
            <TypeCheckFilter
              label={t("dataViewer.type")}
              types={types}
              selected={selectedTypes}
              onChange={setSelectedTypes}
              renderOption={transactionLabel}
            />
          </th>
          <th>
            <span className="dv-cell-with-icon">
              {t("dataViewer.reward")} {rewardIcon}
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
        const { value, currency } = pickViewValue(row, transactionView, "GMT");
        return (
          <tr
            key={`${row.date}-${row.transactionType}-${index}`}
            {...getSelectableRowProps(rowSelection, excluded, rewardKey, row.groupIds)}
          >
            <DateCell date={row.date} groupByDay={groupByDay} />
            <td className="dv-cell-type">{transactionLabel(row.transactionType)}</td>
            <td className="dv-cell-accent">
              <IconValue text={formatCurrencyValue(value, currency)} icon={rewardIcon} />
            </td>
          </tr>
        );
      })}
    </RecordsTable>
  );
}
