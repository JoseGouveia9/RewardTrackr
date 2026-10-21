import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { wasCacheMigrated } from "@/lib/reward-cache";
import { buildOccurrenceIds } from "@/lib/row-ids";
import type { CacheEntry, RewardKey } from "@/types/rewards";
import type { DifficultyEntry } from "@/features/minerwars/api/difficulty-adjustments";
import type { Currency, DateRange } from "../../types";
import { formatCurrencyValue, getRecordField, matchesDateRange } from "../../utils";
import { MiningCurrencyIcon } from "@/components/icons/currency-icons";
import { useCacheEntry } from "../../hooks/use-cache-entry";
import { useCycleTracker } from "./hooks/use-cycle-tracker";
import { usePagedRows } from "../../hooks/use-paged-rows";
import { useRowExclusions } from "../../hooks/use-row-exclusions";
import { useSyncTableColumns } from "../../hooks/use-sync-table-columns";
import { getSelectableRowProps } from "../../stores/row-selection-context";
import { useRegisterRowSelectionControls } from "../../stores/row-selection-controls-context";
import { CycleTrackerLayout } from "./components/cycle-tracker-layout/cycle-tracker-layout";
import { buildFormulas } from "./components/mining-formulas/mining-formulas";
import {
  PoolRewardSubLabels,
  type MiningRow,
} from "./components/mining-sub-labels/mining-sub-labels";
import { RecordsTable } from "../records-table/records-table";
import {
  DateCell,
  DateHeaderCell,
  IconValue,
  InfoTooltip,
  TableEmptyState,
  TotalCell,
} from "../table-cell-utils/table-cell-utils";

const COLUMN_CLASSES = [
  "dv-column-date",
  "dv-column-value",
  "dv-column-value",
  "dv-column-value",
  "dv-column-value",
  "dv-column-value",
];

const formatDecimal = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);

const optionalNumber = (value: unknown) => (value != null ? Number(value) : undefined);

function fiatPricePerBtc(record: Record<string, unknown>) {
  const pool = Number(record.poolReward ?? 0);
  const poolFiat = Number(record.poolRewardFiat ?? 0);
  return pool > 0 && poolFiat > 0 ? poolFiat / pool : undefined;
}

export function MiningTable({
  rewardKey,
  currency,
  fiatCode,
  isFetching = false,
  cacheVersion = 0,
  minerWarsPrefetching = false,
  cacheEntry,
  dateRange,
  setDateRange,
  page,
  setPage,
  showTrends,
  trendsAnimating,
  trendsExiting,
  difficultyMap = new Map(),
  pageSize,
  isShared = false,
  onCycleTrackerOpenChange,
  minerWarsShareDisabled = false,
}: {
  rewardKey: RewardKey;
  currency: Currency;
  fiatCode: string;
  isFetching?: boolean;
  cacheVersion?: number;
  minerWarsPrefetching?: boolean;
  cacheEntry?: CacheEntry | null;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  page: number;
  setPage: (page: number) => void;
  showTrends: boolean;
  trendsAnimating: boolean;
  trendsExiting: boolean;
  difficultyMap?: Map<string, DifficultyEntry>;
  pageSize?: number;
  isShared?: boolean;
  onCycleTrackerOpenChange?: (open: boolean) => void;
  minerWarsShareDisabled?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === "rtl";
  const tracker = useCycleTracker({
    enabled: rewardKey === "minerwars" && !isShared,
    cacheVersion,
    currency,
    onOpenChange: onCycleTrackerOpenChange,
  });
  const formulas = useMemo(() => buildFormulas(t, currency, fiatCode), [t, currency, fiatCode]);
  const { totalsRef, dataRef } = useSyncTableColumns();
  const entry = useCacheEntry(rewardKey, cacheEntry, cacheVersion);

  const rows = useMemo<MiningRow[]>(() => {
    if (!entry?.records?.length) return [];
    const ids = buildOccurrenceIds(entry.records, rewardKey);
    return entry.records.map((entryRecord, index) => {
      const record = entryRecord as Record<string, unknown>;
      return {
        date: String(record.createdAt ?? ""),
        rowId: ids[index],
        poolReward: getRecordField(record, currency, "poolReward"),
        maintenance: getRecordField(record, currency, "maintenance"),
        reward: getRecordField(record, currency, "reward"),
        totalPower: Number(record.totalPower ?? 0),
        efficiency: optionalNumber(record.energyEfficiency),
        discount: Number(record.discount ?? 0),
        satsPerTerahash: optionalNumber(record.satsPerTh),
        btcPriceAtTime: optionalNumber(record.btcPriceAtTime),
        btcPriceGmt: optionalNumber(record.btcPriceGmt),
        btcPriceFiat: fiatPricePerBtc(record),
      };
    });
  }, [entry, currency, rewardKey]);

  const filteredRows = useMemo(
    () => rows.filter((row) => matchesDateRange(row.date, dateRange)),
    [rows, dateRange],
  );
  const { rowSelection, excluded, selectedRows, selectAll, selectNone } = useRowExclusions(
    rewardKey,
    filteredRows,
  );
  useRegisterRowSelectionControls(Boolean(rowSelection), selectAll, selectNone);
  const { pageRows, effectivePageSize } = usePagedRows(filteredRows, page, pageSize);

  const hasSubLabel = useMemo(() => {
    if (!rows.length) return false;
    if (currency === "BTC") return rows.some((row) => row.satsPerTerahash != null);
    if (currency === "GMT") return rows.some((row) => row.btcPriceGmt != null);
    if (currency === "USD") return rows.some((row) => row.btcPriceAtTime != null);
    if (currency === "FIAT") return rows.some((row) => row.btcPriceFiat != null);
    return false;
  }, [currency, rows]);

  const hasSatsLabel = useMemo(
    () => rewardKey !== "minerwars" && rows.some((row) => row.satsPerTerahash != null),
    [rewardKey, rows],
  );

  const totals = useMemo(
    () =>
      selectedRows.reduce(
        (total, row) => ({
          poolReward: total.poolReward + row.poolReward,
          maintenance: total.maintenance + row.maintenance,
          reward: total.reward + row.reward,
        }),
        { poolReward: 0, maintenance: 0, reward: 0 },
      ),
    [selectedRows],
  );

  if (!entry) {
    return (
      <TableEmptyState
        isFetching={isFetching}
        emptyMessage={
          !isFetching && wasCacheMigrated(rewardKey) ? t("dataViewer.newStructure") : undefined
        }
      />
    );
  }

  const icon = <MiningCurrencyIcon currency={currency} fiatCode={fiatCode} />;
  const trendClass = trendsExiting
    ? "dv-trends-exiting"
    : trendsAnimating
      ? "dv-trends-active"
      : showTrends
        ? "dv-trends-visible"
        : "";

  return (
    <CycleTrackerLayout
      tracker={tracker}
      cacheVersion={cacheVersion}
      isPrefetching={minerWarsPrefetching}
      extraFiatCode={entry.extraFiatCurrency ?? null}
      shareDisabled={minerWarsShareDisabled}
    >
      <RecordsTable
        columnClasses={COLUMN_CLASSES}
        wrapClassName={`dv-tables-wrap--wide${trendClass ? ` ${trendClass}` : ""}`}
        totalsRef={totalsRef}
        dataRef={dataRef}
        showTotals={selectedRows.length > 0}
        totals={
          <tr>
            <td className="dv-totals-label">{t("common.total")}</td>
            <td />
            <td>
              <TotalCell
                label={t("dataViewer.poolReward")}
                text={formatCurrencyValue(totals.poolReward, currency)}
                icon={icon}
              />
            </td>
            <td>
              <TotalCell
                label={t("dataViewer.maintenance")}
                text={formatCurrencyValue(totals.maintenance, currency)}
                icon={icon}
              />
            </td>
            <td />
            <td>
              <TotalCell
                label={t("dataViewer.reward")}
                text={formatCurrencyValue(totals.reward, currency)}
                icon={icon}
                accent
              />
            </td>
          </tr>
        }
        head={
          <>
            <DateHeaderCell rows={rows} value={dateRange} onChange={setDateRange} />
            <th>
              {rewardKey === "solo-mining" || rewardKey === "minerwars"
                ? t("dataViewer.farm")
                : t("common.power")}
            </th>
            <th>
              {t("dataViewer.poolReward")}
              {rewardKey !== "minerwars" && <InfoTooltip>{formulas.poolReward}</InfoTooltip>}
              {showTrends && hasSubLabel && currency === "BTC" && (
                <span className="dv-th-sub">SATS/TH</span>
              )}
              {showTrends && currency !== "BTC" && (hasSubLabel || hasSatsLabel) && (
                <span className="dv-th-sub">
                  {hasSubLabel ? t("dataViewer.btcPrice").toUpperCase() : ""}
                  {hasSubLabel && hasSatsLabel ? " · " : ""}
                  {hasSatsLabel ? "SATS/TH" : ""}
                </span>
              )}
            </th>
            <th>
              {t("dataViewer.maintenance")}
              {rewardKey !== "minerwars" && <InfoTooltip>{formulas.maintenance}</InfoTooltip>}
            </th>
            <th>{t("dataViewer.discount")}</th>
            <th>
              {t("dataViewer.reward")}
              {rewardKey !== "minerwars" && (
                <InfoTooltip align={isRtl ? "left" : "right"}>{formulas.reward}</InfoTooltip>
              )}
            </th>
          </>
        }
        rowState={{
          selectionMode: Boolean(rowSelection),
          showLoadingRow: isFetching && filteredRows.length > 0,
          showNoResults: filteredRows.length === 0,
        }}
        pagination={{
          page: page,
          total: filteredRows.length,
          pageSize: effectivePageSize,
          onChange: setPage,
        }}
      >
        {pageRows.map((row, index) => (
          <tr
            key={`${row.date}-${index}`}
            {...getSelectableRowProps(rowSelection, excluded, rewardKey, [row.rowId])}
          >
            <DateCell date={row.date} groupByDay />
            <td>
              {row.totalPower > 0 ? formatDecimal(row.totalPower) + " TH" : "-"}
              {row.efficiency != null && (
                <div className="dv-cell-sub dv-cell-sub--static">
                  {formatDecimal(row.efficiency)} W/TH
                </div>
              )}
            </td>
            <td>
              <IconValue text={formatCurrencyValue(row.poolReward, currency)} icon={icon} />
              <PoolRewardSubLabels
                currency={currency}
                fiatCode={fiatCode}
                row={row}
                previousRow={filteredRows[page * effectivePageSize + index + 1]}
                isDiffDay={difficultyMap.has(row.date.slice(0, 10))}
                showTrends={showTrends}
              />
            </td>
            <td>
              <IconValue text={formatCurrencyValue(row.maintenance, currency)} icon={icon} />
            </td>
            <td>{row.discount > 0 ? (row.discount * 100).toFixed(2) + "%" : "-"}</td>
            <td className="dv-cell-accent">
              <IconValue text={formatCurrencyValue(row.reward, currency)} icon={icon} />
            </td>
          </tr>
        ))}
      </RecordsTable>
    </CycleTrackerLayout>
  );
}
