import { lazy, memo, Suspense, useMemo } from "react";
import { loadCacheEntry } from "@/features/export/utils/cache";
import { ErrorBoundary } from "@/components/error-boundary";
import type { Currency, EarnView, TxView, SimpleView, PurchaseView } from "./types";
import { ALL_TABS } from "./utils/constants";
import { loadFiatCode } from "./utils";
import { useDataViewerState } from "./hooks/use-data-viewer-state";
import "./data-viewer.css";

const MiningTable = lazy(() => import("./components/tables/mining-table"));
const SimpleTable = lazy(() => import("./components/tables/simple-table"));
const SimpleEarnTable = lazy(() => import("./components/tables/simple-earn-table"));
const TransactionsTable = lazy(() => import("./components/tables/transactions-table"));
const PurchasesTable = lazy(() => import("./components/tables/purchases-table"));

interface DataViewerProps {
  onClose: () => void;
}

/** Renders the full data-viewer page with tab navigation, currency selector, and lazy-loaded tables. */
export const DataViewer = memo(function DataViewer({ onClose }: DataViewerProps) {
  const {
    activeKey,
    setActiveKey,
    currency,
    setCurrency,
    sharedView,
    setSharedView,
    setView,
    groupByDay,
    setGroupByDay,
  } = useDataViewerState();
  const fiatCode = useMemo(() => loadFiatCode(), []);

  const activeTab = ALL_TABS.find((t) => t.key === activeKey)!;
  const isMiningTab = activeTab.kind === "mining";
  const isEarnTab = activeTab.kind === "earn";
  const isTxTab = activeTab.kind === "tx";
  const isPurchaseTab = activeTab.kind === "purchase";
  const isSimpleTab = !isMiningTab && !isEarnTab && !isTxTab && !isPurchaseTab;

  const simpleDataInfo = useMemo(() => {
    if (!isSimpleTab) return { currencies: [] as string[], hasUsd: false, hasFiat: false };
    const entry = loadCacheEntry(activeKey);
    if (!entry?.records?.length)
      return { currencies: [] as string[], hasUsd: false, hasFiat: false };
    const set = new Set<string>();
    let hasUsd = false;
    let hasFiat = false;
    for (const r of entry.records) {
      const rec = r as Record<string, unknown>;
      const cur = String(rec.currency ?? "");
      if (cur) set.add(cur);
      if (Number(rec.rewardInUSD ?? rec.rewardInUsd ?? 0) !== 0) hasUsd = true;
      if (Number(rec.rewardInFiat ?? 0) !== 0) hasFiat = true;
    }
    return { currencies: [...set], hasUsd, hasFiat };
  }, [activeKey, isSimpleTab]);

  const txDataInfo = useMemo(() => {
    if (!isTxTab) return { hasUsd: false, hasFiat: false };
    const entry = loadCacheEntry(activeKey);
    if (!entry?.records?.length) return { hasUsd: false, hasFiat: false };
    let hasUsd = false;
    let hasFiat = false;
    for (const r of entry.records) {
      const rec = r as Record<string, unknown>;
      if (Number(rec.rewardInUSD ?? rec.rewardInUsd ?? 0) !== 0) hasUsd = true;
      if (Number(rec.rewardInFiat ?? 0) !== 0) hasFiat = true;
    }
    return { hasUsd, hasFiat };
  }, [activeKey, isTxTab]);

  // Derive per-tab effective views from sharedView, falling back to first option if unavailable
  const effectiveEarnView: EarnView = sharedView;
  const effectiveTxView: TxView =
    sharedView === "USD" && !txDataInfo.hasUsd
      ? "GMT"
      : sharedView === "FIAT" && !txDataInfo.hasFiat
        ? "GMT"
        : sharedView === "NATIVE"
          ? "GMT"
          : sharedView;
  const effectiveSimpleView: SimpleView =
    sharedView === "USD" && !simpleDataInfo.hasUsd
      ? "NATIVE"
      : sharedView === "FIAT" && !simpleDataInfo.hasFiat
        ? "NATIVE"
        : sharedView;
  const effectivePurchaseView: PurchaseView = sharedView;

  const currencies: { key: Currency; label: string }[] = [
    { key: "BTC", label: "BTC" },
    { key: "GMT", label: "GMT" },
    { key: "USD", label: "USD" },
    { key: "FIAT", label: fiatCode },
  ];

  const earnViews: { key: EarnView; label: string }[] = [
    { key: "NATIVE", label: "BTC" },
    { key: "USD", label: "USD" },
    { key: "FIAT", label: fiatCode },
  ];

  const txViews: { key: TxView; label: string }[] = [
    { key: "GMT", label: "GMT" },
    ...(txDataInfo.hasUsd ? [{ key: "USD" as TxView, label: "USD" }] : []),
    ...(txDataInfo.hasFiat ? [{ key: "FIAT" as TxView, label: fiatCode }] : []),
  ];
  const showTxSelector = txDataInfo.hasUsd || txDataInfo.hasFiat;

  const {
    currencies: simpleCurrencies,
    hasUsd: simpleHasUsd,
    hasFiat: simpleHasFiat,
  } = simpleDataInfo;
  const nativeLabel = simpleCurrencies.length === 1 ? simpleCurrencies[0] : "Native";
  const simpleViews: { key: SimpleView; label: string }[] = [
    { key: "NATIVE", label: nativeLabel },
    ...(simpleHasUsd ? [{ key: "USD" as SimpleView, label: "USD" }] : []),
    ...(simpleHasFiat ? [{ key: "FIAT" as SimpleView, label: fiatCode }] : []),
  ];
  const showSimpleSelector = simpleHasUsd || simpleHasFiat;

  const purchaseViews: { key: PurchaseView; label: string }[] = [
    { key: "NATIVE", label: "Native" },
    { key: "USD", label: "USD" },
    { key: "FIAT", label: fiatCode },
  ];

  return (
    <div className="dv-page">
      {/* Header */}
      <div className="dv-header">
        <div className="dv-header-left">
          <button type="button" className="dv-back-btn" onClick={onClose} aria-label="Back">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
            <span>Back</span>
          </button>
          <span className="dv-title">Records</span>
        </div>

        {/* Toolbar: group button + currency selector */}
        <div className="dv-toolbar">
          {!isMiningTab && (
            <button
              type="button"
              className={`dv-group-btn${groupByDay ? " dv-group-btn--active" : ""}`}
              onClick={() => setGroupByDay((v) => !v)}
              title="Group by day"
              aria-pressed={groupByDay}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="15" y2="12" />
                <line x1="3" y1="18" x2="15" y2="18" />
                <polyline points="17 15 20 18 23 15" />
              </svg>
              <span>Group by day</span>
            </button>
          )}
          {!isMiningTab && <span className="dv-toolbar-sep">·</span>}
          {isMiningTab ? (
            <div className="dv-currency-selector">
              {currencies.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={`dv-currency-btn${currency === c.key ? " dv-currency-btn--active" : ""}`}
                  onClick={() => {
                    setCurrency(c.key);
                    setSharedView(c.key === "USD" ? "USD" : c.key === "FIAT" ? "FIAT" : "NATIVE");
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          ) : isEarnTab ? (
            <div className="dv-currency-selector">
              {earnViews.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  className={`dv-currency-btn${effectiveEarnView === v.key ? " dv-currency-btn--active" : ""}`}
                  onClick={() => setView(v.key)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          ) : isTxTab && showTxSelector ? (
            <div className="dv-currency-selector">
              {txViews.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  className={`dv-currency-btn${effectiveTxView === v.key ? " dv-currency-btn--active" : ""}`}
                  onClick={() => setView(v.key === "GMT" ? "NATIVE" : v.key)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          ) : isPurchaseTab ? (
            <div className="dv-currency-selector">
              {purchaseViews.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  className={`dv-currency-btn${effectivePurchaseView === v.key ? " dv-currency-btn--active" : ""}`}
                  onClick={() => setView(v.key)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          ) : showSimpleSelector ? (
            <div className="dv-currency-selector">
              {simpleViews.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  className={`dv-currency-btn${effectiveSimpleView === v.key ? " dv-currency-btn--active" : ""}`}
                  onClick={() => setView(v.key)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Tabs */}
      <div className="dv-tabs">
        {ALL_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`dv-tab${activeKey === tab.key ? " dv-tab--active" : ""}`}
            onClick={() => setActiveKey(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="dv-content">
        <ErrorBoundary>
          <Suspense>
            {isMiningTab ? (
              <MiningTable
                key={activeKey}
                rewardKey={activeKey}
                currency={currency}
                fiatCode={fiatCode}
              />
            ) : isEarnTab ? (
              <SimpleEarnTable
                key={activeKey}
                rewardKey={activeKey}
                fiatCode={fiatCode}
                earnView={effectiveEarnView}
                groupByDay={groupByDay}
              />
            ) : isTxTab ? (
              <TransactionsTable
                key={activeKey}
                rewardKey={activeKey}
                fiatCode={fiatCode}
                txView={effectiveTxView}
                groupByDay={groupByDay}
              />
            ) : isPurchaseTab ? (
              <PurchasesTable
                key={activeKey}
                fiatCode={fiatCode}
                purchaseView={effectivePurchaseView}
                groupByDay={groupByDay}
              />
            ) : (
              <SimpleTable
                key={activeKey}
                rewardKey={activeKey}
                fiatCode={fiatCode}
                simpleView={effectiveSimpleView}
                groupByDay={groupByDay}
              />
            )}
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
});

// ── Trigger button ────────────────────────────────────────────

interface DataViewerButtonProps {
  active: boolean;
  onClick: () => void;
}

/** Renders the header button that toggles the data-viewer panel open and closed. */
export const DataViewerButton = memo(function DataViewerButton({
  active,
  onClick,
}: DataViewerButtonProps) {
  return (
    <button
      type="button"
      className={`dv-trigger-btn${active ? " dv-trigger-btn--active" : ""}`}
      onClick={onClick}
      aria-label="View records"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
      <span>Records</span>
    </button>
  );
});
