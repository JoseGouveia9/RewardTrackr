import { useMemo, useRef, type ReactNode } from "react";
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

const INFO_ICON = (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="dv-info-icon"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);

function TrendArrow({
  current,
  prev,
  integer,
}: {
  current: number | undefined;
  prev: number | undefined;
  integer?: boolean;
}) {
  if (current == null || prev == null) return null;
  const a = integer ? Math.round(current) : current;
  const b = integer ? Math.round(prev) : prev;
  const delta = a - b;
  if (delta === 0) return null;
  const up = delta > 0;
  return (
    <svg
      className={`dv-trend${up ? " dv-trend--up" : " dv-trend--down"}`}
      width="8"
      height="8"
      viewBox="0 0 10 10"
      fill="currentColor"
      aria-hidden="true"
    >
      {up ? <polygon points="5,1 9,9 1,9" /> : <polygon points="1,1 9,1 5,9" />}
    </svg>
  );
}

function Frac({ num, den }: { num: ReactNode; den: ReactNode }) {
  return (
    <span className="dv-math-frac">
      <span className="dv-math-num">{num}</span>
      <span className="dv-math-den">{den}</span>
    </span>
  );
}

function InfoTooltip({
  children,
  align = "center",
}: {
  children: ReactNode;
  align?: "center" | "right";
}) {
  return (
    <span className="dv-info-wrap">
      {INFO_ICON}
      <span
        className={`dv-formula-tooltip${align === "right" ? " dv-formula-tooltip--right" : ""}`}
      >
        {children}
      </span>
    </span>
  );
}

function buildFormulas(currency: Currency, fiatCode: string) {
  const btcLabel =
    currency === "GMT"
      ? "GMT/USD RATE"
      : currency === "FIAT"
        ? `BTC/${fiatCode} RATE`
        : "BTC/USD RATE";

  const poolRewardLabel = currency === "GMT" ? "BTC/GMT RATE" : btcLabel;

  const poolReward =
    currency === "BTC" ? (
      <div className="dv-math-line">
        <span>Pool Reward =</span>
        <Frac num="Sats/TH × TH" den="100,000,000" />
      </div>
    ) : (
      <div className="dv-math-line">
        <span>Pool Reward =</span>
        <Frac num="Sats/TH × TH" den="100,000,000" />
        <span>× {poolRewardLabel}</span>
      </div>
    );

  const elecLine =
    currency === "USD" ? (
      <div className="dv-math-line">
        <span className="dv-math-var">Electricity</span>=
        <Frac num="kWh cost × 24" den="1,000" />
        <span>× efficiency × TH − discount%</span>
      </div>
    ) : currency === "FIAT" ? (
      <div className="dv-math-line">
        <span className="dv-math-var">Electricity</span>=
        <Frac num="kWh cost × 24" den="1,000" />
        <span>× efficiency × TH × USD/{fiatCode} RATE − discount%</span>
      </div>
    ) : currency === "GMT" ? (
      <div className="dv-math-line">
        <span className="dv-math-var">Electricity</span>=
        <Frac num="kWh cost × 24" den="1,000" />
        <span>× efficiency × TH × USD/GMT RATE − discount%</span>
      </div>
    ) : (
      <div className="dv-math-line">
        <span className="dv-math-var">Electricity</span>=
        <Frac num="kWh cost × 24" den="1,000" />
        <span>× efficiency × TH × {btcLabel} − discount%</span>
      </div>
    );

  const svcLine =
    currency === "USD" ? (
      <div className="dv-math-line">
        <span className="dv-math-var">Service</span>= 0.0089 × TH − discount%
      </div>
    ) : currency === "FIAT" ? (
      <div className="dv-math-line">
        <span className="dv-math-var">Service</span>= 0.0089 × TH × USD/{fiatCode} RATE − discount%
      </div>
    ) : currency === "GMT" ? (
      <div className="dv-math-line">
        <span className="dv-math-var">Service</span>= 0.0089 × TH × USD/GMT RATE − discount%
      </div>
    ) : (
      <div className="dv-math-line">
        <span className="dv-math-var">Service</span>= 0.0089 × TH × {btcLabel} − discount%
      </div>
    );

  const maintenance = (
    <>
      <div className="dv-math-label">Maintenance = Electricity + Service</div>
      <div className="dv-math-sep" />
      {elecLine}
      {svcLine}
    </>
  );

  const reward = <div className="dv-math-line">Reward = Pool Reward − Maintenance</div>;

  return { poolReward, maintenance, reward };
}

export function MiningTable({
  rewardKey,
  currency,
  fiatCode,
  isFetching = false,
  cacheVersion = 0,
  cacheEntry,
  dateRange,
  setDateRange,
  page,
  setPage,
  showTrends,
  trendsAnimating,
  trendsExiting,
  difficultyMap = new Map(),
}: {
  rewardKey: RewardKey;
  currency: Currency;
  fiatCode: string;
  isFetching?: boolean;
  cacheVersion?: number;
  cacheEntry?: CacheEntry | null;
  dateRange: DateRange;
  setDateRange: (v: DateRange) => void;
  page: number;
  setPage: (p: number) => void;
  showTrends: boolean;
  trendsAnimating: boolean;
  trendsExiting: boolean;
  difficultyMap?: Map<string, DifficultyEntry>;
}) {
  const { t } = useTranslation();
  const formulas = useMemo(() => buildFormulas(currency, fiatCode), [currency, fiatCode]);
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
  }, [entry, currency]);

  const dateBounds = useMemo(() => getDateBounds(rows), [rows]);
  const rowDates = useMemo(() => rows.map((r) => r.date.slice(0, 10)), [rows]);

  const filteredRows = useMemo(
    () => rows.filter((r) => matchesDateRange(r.date, dateRange)),
    [rows, dateRange],
  );

  const pageRows = useMemo(
    () => filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredRows, page],
  );

  const hasSubLabel = useMemo(() => {
    if (rewardKey === "minerwars" || !rows.length) return false;
    if (currency === "BTC") return rows.some((r) => r.satsPerTh != null);
    if (currency === "GMT") return rows.some((r) => r.btcPriceGmt != null);
    if (currency === "USD") return rows.some((r) => r.btcPriceAtTime != null);
    if (currency === "FIAT") return rows.some((r) => r.btcPriceFiat != null);
    return false;
  }, [rewardKey, currency, rows]);

  const hasSatsLabel = useMemo(
    () => rewardKey !== "minerwars" && rows.some((r) => r.satsPerTh != null),
    [rewardKey, rows],
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
      <div
        className={`dv-tables-wrap dv-tables-wrap--wide${trendsExiting ? " dv-trends-exiting" : trendsAnimating ? " dv-trends-active" : showTrends ? " dv-trends-visible" : ""}`}
      >
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
              <th>{t("common.power")}</th>
              <th>
                {t("dataViewer.poolReward")}
                {rewardKey !== "minerwars" && <InfoTooltip>{formulas.poolReward}</InfoTooltip>}
                {showTrends && hasSubLabel && currency === "BTC" && (
                  <span className="dv-th-sub">SATS/TH</span>
                )}
                {showTrends && currency !== "BTC" && (hasSubLabel || hasSatsLabel) && (
                  <span className="dv-th-sub">
                    {hasSubLabel ? "BTC PRICE" : ""}
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
                  <InfoTooltip align="right">{formulas.reward}</InfoTooltip>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatedLoadingRow show={isFetching && filteredRows.length > 0} colSpan={6} />
            {pageRows.map((row, i) => {
              const prevRow = filteredRows[page * PAGE_SIZE + i + 1];
              const diffEntry = difficultyMap.get(row.date.slice(0, 10));
              const isDiffDay = diffEntry != null;
              return (
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
                    {showTrends &&
                      rewardKey !== "minerwars" &&
                      currency === "BTC" &&
                      row.satsPerTh != null && (
                        <div className="dv-cell-sub">
                          Sats/TH: {row.satsPerTh.toFixed(2)} Sats
                          {isDiffDay && (
                            <TrendArrow current={row.satsPerTh} prev={prevRow?.satsPerTh} />
                          )}
                        </div>
                      )}
                    {showTrends &&
                      rewardKey !== "minerwars" &&
                      currency === "GMT" &&
                      row.btcPriceGmt != null && (
                        <div className="dv-cell-sub">
                          BTC Price:{" "}
                          {row.btcPriceGmt.toLocaleString(undefined, { maximumFractionDigits: 0 })}{" "}
                          GMT
                          <TrendArrow current={row.btcPriceGmt} prev={prevRow?.btcPriceGmt} />
                        </div>
                      )}
                    {showTrends &&
                      rewardKey !== "minerwars" &&
                      currency === "GMT" &&
                      row.satsPerTh != null && (
                        <div className="dv-cell-sub">
                          Sats/TH: {row.satsPerTh.toFixed(2)} Sats
                          {isDiffDay && (
                            <TrendArrow current={row.satsPerTh} prev={prevRow?.satsPerTh} />
                          )}
                        </div>
                      )}
                    {showTrends &&
                      rewardKey !== "minerwars" &&
                      currency === "USD" &&
                      row.btcPriceAtTime != null && (
                        <div className="dv-cell-sub">
                          BTC Price:{" "}
                          {row.btcPriceAtTime.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })}{" "}
                          USD
                          <TrendArrow current={row.btcPriceAtTime} prev={prevRow?.btcPriceAtTime} />
                        </div>
                      )}
                    {showTrends &&
                      rewardKey !== "minerwars" &&
                      currency === "USD" &&
                      row.satsPerTh != null && (
                        <div className="dv-cell-sub">
                          Sats/TH: {row.satsPerTh.toFixed(2)} Sats
                          {isDiffDay && (
                            <TrendArrow current={row.satsPerTh} prev={prevRow?.satsPerTh} />
                          )}
                        </div>
                      )}
                    {showTrends &&
                      rewardKey !== "minerwars" &&
                      currency === "FIAT" &&
                      row.btcPriceFiat != null && (
                        <div className="dv-cell-sub">
                          BTC Price:{" "}
                          {row.btcPriceFiat.toLocaleString(undefined, { maximumFractionDigits: 0 })}{" "}
                          {fiatCode}
                          <TrendArrow current={row.btcPriceFiat} prev={prevRow?.btcPriceFiat} />
                        </div>
                      )}
                    {showTrends &&
                      rewardKey !== "minerwars" &&
                      currency === "FIAT" &&
                      row.satsPerTh != null && (
                        <div className="dv-cell-sub">
                          Sats/TH: {row.satsPerTh.toFixed(2)} Sats
                          {isDiffDay && (
                            <TrendArrow current={row.satsPerTh} prev={prevRow?.satsPerTh} />
                          )}
                        </div>
                      )}
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
      <Pagination page={page} total={filteredRows.length} onChange={setPage} />
    </>
  );
}
export default MiningTable;
