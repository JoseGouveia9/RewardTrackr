import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildOccurrenceIds } from "@/lib/row-ids";
import type { CacheEntry, RewardKey } from "@/types/rewards";
import type { EarnView, DateRange } from "../../types";
import {
  formatCurrencyValue,
  groupRowsByDay,
  matchesDateRange,
  parseRewardAmounts,
  pickViewValue,
  sumRewardAmounts,
  toFiniteNumber,
} from "../../utils";
import { AnyCurrencyIcon } from "@/components/icons/currency-icons";
import { useCacheEntry } from "../../hooks/use-cache-entry";
import { usePagedRows } from "../../hooks/use-paged-rows";
import { useRowExclusions } from "../../hooks/use-row-exclusions";
import { useSyncTableColumns } from "../../hooks/use-sync-table-columns";
import { getSelectableRowProps } from "../../stores/row-selection-context";
import { useRegisterRowSelectionControls } from "../../stores/row-selection-controls-context";
import { RecordsTable } from "../records-table/records-table";
import {
  DateCell,
  DateHeaderCell,
  IconValue,
  TableEmptyState,
  TotalCell,
  ViewIcon,
} from "../table-cell-utils/table-cell-utils";

const COLUMN_CLASSES = ["dv-column-date", "dv-column-value", "dv-column-rate", "dv-column-value"];

interface AssetTotal {
  currency: string;
  reward: number;
  rewardInUSD: number;
  rewardInFiat: number;
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
  setDateRange: (range: DateRange) => void;
  pageSize?: number;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
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
        asset: String(record.asset ?? record.currency ?? ""),
        currency: String(record.currency ?? ""),
        apr: toFiniteNumber(record.apr),
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

  useEffect(() => setPage(0), [dateRange, groupByDay]);

  const finalRows = useMemo(
    () => groupRowsByDay(filteredRows, groupByDay, (row) => row.asset, sumRewardAmounts),
    [filteredRows, groupByDay],
  );
  const { pageRows, effectivePageSize } = usePagedRows(finalRows, page, pageSize);

  const { grandTotal, nativeCurrency } = useMemo(() => {
    const byAsset = new Map<string, AssetTotal>();
    for (const row of selectedRows) {
      const current = byAsset.get(row.asset);
      byAsset.set(row.asset, {
        currency: row.currency,
        reward: (current?.reward ?? 0) + row.reward,
        rewardInUSD: (current?.rewardInUSD ?? 0) + row.rewardInUSD,
        rewardInFiat: (current?.rewardInFiat ?? 0) + row.rewardInFiat,
      });
    }
    const assets = [...byAsset.values()];
    return {
      grandTotal: assets.reduce(
        (total, asset) => ({
          reward: total.reward + asset.reward,
          rewardInUSD: total.rewardInUSD + asset.rewardInUSD,
          rewardInFiat: total.rewardInFiat + asset.rewardInFiat,
        }),
        { reward: 0, rewardInUSD: 0, rewardInFiat: 0 },
      ),
      nativeCurrency: assets[0]?.currency ?? "",
    };
  }, [selectedRows]);

  if (!entry) {
    return <TableEmptyState isFetching={isFetching} />;
  }

  const { value: totalValue, currency: totalCurrency } = pickViewValue(
    grandTotal,
    earnView,
    nativeCurrency,
  );

  return (
    <RecordsTable
      columnClasses={COLUMN_CLASSES}
      wrapClassName="dv-tables-wrap--scroll"
      totalsRef={totalsRef}
      dataRef={dataRef}
      showTotals={selectedRows.length > 0}
      totals={
        <tr>
          <td className="dv-totals-label">{t("common.total")}</td>
          <td />
          <td />
          <td>
            <TotalCell
              label={t("dataViewer.reward")}
              text={formatCurrencyValue(totalValue, totalCurrency)}
              icon={
                <ViewIcon
                  view={earnView}
                  fiatCode={fiatCode}
                  native={<AnyCurrencyIcon currency={nativeCurrency} />}
                />
              }
              accent
            />
          </td>
        </tr>
      }
      head={
        <>
          <DateHeaderCell rows={rows} value={dateRange} onChange={setDateRange} />
          <th>{t("dataViewer.asset")}</th>
          <th>APR</th>
          <th>{t("dataViewer.reward")}</th>
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
        const { value, currency } = pickViewValue(row, earnView, row.currency);
        return (
          <tr
            key={`${row.date}-${row.asset}-${index}`}
            {...getSelectableRowProps(rowSelection, excluded, rewardKey, row.groupIds)}
          >
            <DateCell date={row.date} groupByDay={groupByDay} />
            <td>
              <span className="dv-cell-with-icon">
                <AnyCurrencyIcon currency={row.asset} />
                {row.asset}
              </span>
            </td>
            <td>{(row.apr * 100).toFixed(2)}%</td>
            <td className="dv-cell-accent">
              <IconValue
                text={formatCurrencyValue(value, currency)}
                icon={
                  <ViewIcon
                    view={earnView}
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
