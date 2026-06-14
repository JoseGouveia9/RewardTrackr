import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { loadCacheEntry, wasCacheMigrated } from "@/features/export/utils/cache";
import type { CacheEntry, RewardKey } from "@/features/export/types";
import type { DifficultyEntry } from "@/features/export/api/difficulty-adjustments";
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
import { useRowSelection } from "../../stores/row-selection-context";
import { MinerWarsComparisonPanel } from "../minerwars-comparison-panel/minerwars-comparison-panel";
import {
  TrendArrow,
  Frac,
  InfoTooltip,
  AnimatedTotalsWrapper,
  TableNoResultsRow,
} from "./table-cell-utils";

type MiningRow = {
  date: string;
  rowId: string;
  poolReward: number;
  maintenance: number;
  reward: number;
  totalPower: number;
  efficiency?: number;
  discount: number;
  satsPerTh?: number;
  btcPriceAtTime?: number;
  btcPriceGmt?: number;
  btcPriceFiat?: number;
};

function PoolRewardSubLabels({
  currency,
  fiatCode,
  row,
  prevRow,
  isDiffDay,
  showTrends,
}: {
  currency: Currency;
  fiatCode: string;
  row: MiningRow;
  prevRow?: MiningRow;
  isDiffDay: boolean;
  showTrends: boolean;
}) {
  const { t } = useTranslation();
  if (!showTrends) return null;

  const fmtSats = (v: number) =>
    (Math.floor(v * 100) / 100).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const priceValue =
    currency === "GMT"
      ? row.btcPriceGmt
      : currency === "USD"
        ? row.btcPriceAtTime
        : currency === "FIAT"
          ? row.btcPriceFiat
          : undefined;

  const prevPriceValue =
    currency === "GMT"
      ? prevRow?.btcPriceGmt
      : currency === "USD"
        ? prevRow?.btcPriceAtTime
        : currency === "FIAT"
          ? prevRow?.btcPriceFiat
          : undefined;

  const priceUnit =
    currency === "GMT" ? "GMT" : currency === "USD" ? "USD" : currency === "FIAT" ? fiatCode : null;

  return (
    <>
      {priceValue != null && priceUnit && (
        <div className="dv-cell-sub">
          {t("dataViewer.btcPrice")}:{" "}
          {priceValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} {priceUnit}
          <TrendArrow current={priceValue} prev={prevPriceValue} />
        </div>
      )}
      {row.satsPerTh != null && (
        <div className="dv-cell-sub">
          Sats/TH: {fmtSats(row.satsPerTh)} Sats
          {isDiffDay && <TrendArrow current={row.satsPerTh} prev={prevRow?.satsPerTh} />}
        </div>
      )}
    </>
  );
}

function buildFormulas(
  t: (key: string, options?: Record<string, unknown>) => string,
  currency: Currency,
  fiatCode: string,
) {
  const r = (pair: string) => {
    const [from, to] = pair.split("/");
    return t("dataViewer.rateLabel", { from, to });
  };
  const disc = `${t("dataViewer.discount")}%`;

  const btcLabel =
    currency === "GMT" ? r("GMT/USD") : currency === "FIAT" ? r(`${fiatCode}/BTC`) : r("USD/BTC");

  const poolRewardLabel = currency === "GMT" ? r("GMT/BTC") : btcLabel;

  const poolReward =
    currency === "BTC" ? (
      <div className="dv-math-line">
        <span>{t("dataViewer.poolReward")} =</span>
        <Frac num="Sats/TH × TH" den="100,000,000" />
      </div>
    ) : (
      <div className="dv-math-line">
        <span>{t("dataViewer.poolReward")} =</span>
        <Frac num="Sats/TH × TH" den="100,000,000" />
        <span>× {poolRewardLabel}</span>
      </div>
    );

  const elecLine =
    currency === "USD" ? (
      <div className="dv-math-line">
        <span className="dv-math-var">{t("dataViewer.electricity")}</span>=
        <Frac num={`${t("dataViewer.kwhCost")} × 24`} den="1,000" />
        <span>
          × {t("dataViewer.efficiency")} × TH − {disc}
        </span>
      </div>
    ) : currency === "FIAT" ? (
      <div className="dv-math-line">
        <span className="dv-math-var">{t("dataViewer.electricity")}</span>=
        <Frac num={`${t("dataViewer.kwhCost")} × 24`} den={`1,000 x ${r(`USD/${fiatCode}`)}`} />
        <span>
          × {t("dataViewer.efficiency")} × TH − {disc}
        </span>
      </div>
    ) : currency === "GMT" ? (
      <div className="dv-math-line">
        <span className="dv-math-var">{t("dataViewer.electricity")}</span>=
        <Frac num={`${t("dataViewer.kwhCost")} × 24`} den={`1,000 x ${r("USD/GMT")}`} />
        <span>
          × {t("dataViewer.efficiency")} × TH − {disc}
        </span>
      </div>
    ) : (
      <div className="dv-math-line">
        <span className="dv-math-var">{t("dataViewer.electricity")}</span>=
        <Frac num={`${t("dataViewer.kwhCost")} × 24`} den={`1,000 x ${r("USD/BTC")}`} />
        <span>
          × {t("dataViewer.efficiency")} × TH − {disc}
        </span>
      </div>
    );

  const svcLine =
    currency === "USD" ? (
      <div className="dv-math-line">
        <span className="dv-math-var">{t("dataViewer.service")}</span>= $0.0089 × TH − {disc}
      </div>
    ) : currency === "FIAT" ? (
      <div className="dv-math-line">
        <span className="dv-math-var">{t("dataViewer.service")}</span>=
        <Frac num={`$0.0089`} den={`${r(`USD/${fiatCode}`)}`} /> × TH − {disc}
      </div>
    ) : currency === "GMT" ? (
      <div className="dv-math-line">
        <span className="dv-math-var">{t("dataViewer.service")}</span>=
        <Frac num={`$0.0089`} den={`${r(`USD/GMT`)}`} /> × TH − {disc}
      </div>
    ) : (
      <div className="dv-math-line">
        <span className="dv-math-var">{t("dataViewer.service")}</span>=
        <Frac num={`$0.0089`} den={`${r(`USD/BTC`)}`} /> × TH − {disc}
      </div>
    );

  const maintenance = (
    <>
      <div className="dv-math-label">{`${t("dataViewer.maintenance")} = ${t("dataViewer.electricity")} + ${t("dataViewer.service")}`}</div>
      <div className="dv-math-sep" />
      {elecLine}
      {svcLine}
      <div className="dv-math-sep" />
      <div className="dv-math-note">{t("dataViewer.kwhCostNote")}</div>
      {currency !== "USD" && (
        <div className="dv-math-note">{t("dataViewer.maintenanceUsdNote")}</div>
      )}
    </>
  );

  const reward = (
    <div className="dv-math-line">{`${t("dataViewer.reward")} = ${t("dataViewer.poolReward")} − ${t("dataViewer.maintenance")}`}</div>
  );

  return { poolReward, maintenance, reward };
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
}: {
  rewardKey: RewardKey;
  currency: Currency;
  fiatCode: string;
  isFetching?: boolean;
  cacheVersion?: number;
  minerWarsPrefetching?: boolean;
  onRefreshKeys?: (keys: RewardKey[]) => Promise<void>;
  cacheEntry?: CacheEntry | null;
  dateRange: DateRange;
  setDateRange: (v: DateRange) => void;
  page: number;
  setPage: (p: number) => void;
  showTrends: boolean;
  trendsAnimating: boolean;
  trendsExiting: boolean;
  difficultyMap?: Map<string, DifficultyEntry>;
  pageSize?: number;
  isShared?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === "rtl";
  const rowSel = useRowSelection();
  const excluded = useMemo(() => new Set(rowSel?.exclusions[rewardKey] ?? []), [rowSel, rewardKey]);
  const formulas = useMemo(() => buildFormulas(t, currency, fiatCode), [t, currency, fiatCode]);
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
      return {
        date: String(rec.createdAt ?? ""),
        rowId: `${rewardKey}::${String(rec.createdAt ?? "")}::${i}`,
        poolReward: getRecordField(rec, currency, "poolReward"),
        maintenance: getRecordField(rec, currency, "maintenance"),
        reward: getRecordField(rec, currency, "reward"),
        totalPower: Number(rec.totalPower ?? 0),
        efficiency: rec.energyEfficiency != null ? Number(rec.energyEfficiency) : undefined,
        discount: Number(rec.discount ?? 0),
        satsPerTh: rec.satsPerTh != null ? Number(rec.satsPerTh) : undefined,
        btcPriceAtTime: rec.btcPriceAtTime != null ? Number(rec.btcPriceAtTime) : undefined,
        btcPriceGmt: rec.btcPriceGmt != null ? Number(rec.btcPriceGmt) : undefined,
        btcPriceFiat: (() => {
          const pr = Number(rec.poolReward ?? 0);
          const pf = Number(rec.poolRewardFiat ?? 0);
          return pr > 0 && pf > 0 ? pf / pr : undefined;
        })(),
      };
    });
  }, [entry, currency, rewardKey]);

  const dateBounds = useMemo(() => getDateBounds(rows), [rows]);
  const rowDates = useMemo(() => rows.map((r) => r.date.slice(0, 10)), [rows]);

  const filteredRows = useMemo(
    () => rows.filter((r) => matchesDateRange(r.date, dateRange)),
    [rows, dateRange],
  );

  const effectivePageSize = pageSize ?? PAGE_SIZE;
  const pageRows = useMemo(
    () => filteredRows.slice(page * effectivePageSize, (page + 1) * effectivePageSize),
    [filteredRows, page, effectivePageSize],
  );

  const hasSubLabel = useMemo(() => {
    if (!rows.length) return false;
    if (currency === "BTC") return rows.some((r) => r.satsPerTh != null);
    if (currency === "GMT") return rows.some((r) => r.btcPriceGmt != null);
    if (currency === "USD") return rows.some((r) => r.btcPriceAtTime != null);
    if (currency === "FIAT") return rows.some((r) => r.btcPriceFiat != null);
    return false;
  }, [currency, rows]);

  const hasSatsLabel = useMemo(
    () => rewardKey !== "minerwars" && rows.some((r) => r.satsPerTh != null),
    [rewardKey, rows],
  );

  const selectedRows = useMemo(
    () => (rowSel ? filteredRows.filter((r) => !excluded.has(r.rowId)) : filteredRows),
    [filteredRows, rowSel, excluded],
  );

  const totals = useMemo(
    () =>
      selectedRows.reduce(
        (acc, r) => ({
          poolReward: acc.poolReward + r.poolReward,
          maintenance: acc.maintenance + r.maintenance,
          reward: acc.reward + r.reward,
        }),
        { poolReward: 0, maintenance: 0, reward: 0 },
      ),
    [selectedRows],
  );

  if (!entry) {
    return (
      <div className="dv-empty">
        {isFetching ? (
          <span className="dv-loading-inline">
            <span className="dv-spinner" aria-hidden="true" />
            <span>{t("dataViewer.fetchingData")}</span>
          </span>
        ) : wasCacheMigrated(rewardKey) ? (
          t("dataViewer.newStructure")
        ) : (
          t("dataViewer.noData")
        )}
      </div>
    );
  }

  return (
    <>
      {rewardKey === "minerwars" && !isShared && (
        <MinerWarsComparisonPanel
          cacheVersion={cacheVersion}
          currency={currency}
          isPrefetching={minerWarsPrefetching}
        />
      )}
      <div
        className={`dv-tables-wrap dv-tables-wrap--wide${trendsExiting ? " dv-trends-exiting" : trendsAnimating ? " dv-trends-active" : showTrends ? " dv-trends-visible" : ""}`}
      >
        <AnimatedTotalsWrapper show={selectedRows.length > 0}>
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
                <td className="dv-totals-label">{t("common.total")}</td>
                <td />
                <td>
                  <span className="dv-total-cell-label">{t("dataViewer.poolReward")}</span>
                  <span className="dv-total-cell-value dv-cell-with-icon">
                    {formatMiningValue(totals.poolReward, currency)}
                    <MiningCurrencyIcon currency={currency} fiatCode={fiatCode} />
                  </span>
                </td>
                <td>
                  <span className="dv-total-cell-label">{t("dataViewer.maintenance")}</span>
                  <span className="dv-total-cell-value dv-cell-with-icon">
                    {formatMiningValue(totals.maintenance, currency)}
                    <MiningCurrencyIcon currency={currency} fiatCode={fiatCode} />
                  </span>
                </td>
                <td />
                <td>
                  <span className="dv-total-cell-label">{t("dataViewer.reward")}</span>
                  <span className="dv-total-cell-value dv-total-cell-value--accent dv-cell-with-icon">
                    {formatMiningValue(totals.reward, currency)}
                    <MiningCurrencyIcon currency={currency} fiatCode={fiatCode} />
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
            </tr>
          </thead>
          <tbody>
            <AnimatedLoadingRow show={isFetching && filteredRows.length > 0} colSpan={6} />
            {filteredRows.length === 0 && <TableNoResultsRow colSpan={6} />}
            {pageRows.map((row, i) => {
              const prevRow = filteredRows[page * effectivePageSize + i + 1];
              const diffEntry = difficultyMap.get(row.date.slice(0, 10));
              const isDiffDay = diffEntry != null;
              return (
                <tr
                  key={`${row.date}-${i}`}
                  className={
                    rowSel
                      ? excluded.has(row.rowId)
                        ? "dv-row--excluded"
                        : "dv-row--selected"
                      : ""
                  }
                  onClick={rowSel ? () => rowSel.onToggle(rewardKey, [row.rowId]) : undefined}
                >
                  <td className="dv-cell-date">{fmtDate(row.date)}</td>
                  <td>
                    {row.totalPower > 0
                      ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
                          row.totalPower,
                        ) + " TH"
                      : "-"}
                    {row.efficiency != null && (
                      <div className="dv-cell-sub dv-cell-sub--static">
                        {new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
                          row.efficiency,
                        )}{" "}
                        W/TH
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="dv-cell-with-icon">
                      {formatMiningValue(row.poolReward, currency)}
                      <MiningCurrencyIcon currency={currency} fiatCode={fiatCode} />
                    </span>
                    <PoolRewardSubLabels
                      currency={currency}
                      fiatCode={fiatCode}
                      row={row}
                      prevRow={prevRow}
                      isDiffDay={isDiffDay}
                      showTrends={showTrends}
                    />
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
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        total={filteredRows.length}
        onChange={setPage}
        pageSize={effectivePageSize}
      />
    </>
  );
}
export default MiningTable;
