import { memo, useEffect, useMemo, useRef } from "react";
import { loadCacheEntry } from "@/features/export/utils/cache";
import { ErrorBoundary } from "@/components/error-boundary";
import type { Currency, EarnView, TxView, SimpleView, PurchaseView } from "./types";
import type { RewardKey } from "@/features/export/types";
import { ALL_TABS } from "./utils/constants";
import { loadFiatCode } from "./utils";
import { useDataViewerState } from "./hooks/use-data-viewer-state";
import { MiningTable } from "./components/tables/mining-table";
import { SimpleTable } from "./components/tables/simple-table";
import { SimpleEarnTable } from "./components/tables/simple-earn-table";
import { TransactionsTable } from "./components/tables/transactions-table";
import { PurchasesTable } from "./components/tables/purchases-table";
import "./data-viewer.css";

interface DataViewerProps {
  onClose: () => void;
  isFetching?: boolean;
}

function TabList({
  activeKey,
  onSelect,
}: {
  activeKey: string;
  onSelect: (key: RewardKey) => void;
}) {
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    tabsRef.current?.querySelector<HTMLElement>(".dv-tab--active")?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [activeKey]);

  return (
    <div ref={tabsRef} className="dv-tabs">
      {ALL_TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`dv-tab${activeKey === tab.key ? " dv-tab--active" : ""}`}
          onClick={() => onSelect(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function NativeLabel({ label }: { label: string }) {
  if (label !== "Native") return <>{label}</>;
  return (
    <>
      <span className="dv-label--full">Native</span>
      <span className="dv-label--short">ALL</span>
    </>
  );
}

function ViewSelector<K extends string>({
  views,
  activeKey,
  onSelect,
}: {
  views: { key: K; label: string }[];
  activeKey: K;
  onSelect: (key: K) => void;
}) {
  return (
    <div className="dv-currency-selector">
      {views.map((v) => (
        <button
          key={v.key}
          type="button"
          className={`dv-currency-button${activeKey === v.key ? " dv-currency-button--active" : ""}`}
          onClick={() => onSelect(v.key)}
        >
          <NativeLabel label={v.label} />
        </button>
      ))}
    </div>
  );
}

// Renders the full data-viewer page with tab navigation, currency selector, and lazy-loaded tables.
export const DataViewer = memo(function DataViewer({
  onClose,
  isFetching = false,
}: DataViewerProps) {
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
    dateRange,
    setDateRange,
  } = useDataViewerState();
  const fiatCode = useMemo(() => loadFiatCode(), []);

  const activeTab = ALL_TABS.find((t) => t.key === activeKey)!;
  const isMiningTab = activeTab.kind === "mining";
  const isEarnTab = activeTab.kind === "earn";
  const isTxTab = activeTab.kind === "tx";
  const isPurchaseTab = activeTab.kind === "purchase";
  const isSimpleTab = activeTab.kind === "simple";

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
          <button type="button" className="dv-back-button" onClick={onClose} aria-label="Back">
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
              className={`dv-group-button${groupByDay ? " dv-group-button--active" : ""}`}
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
          {!isMiningTab && <span className="dv-toolbar-separator">·</span>}
          {isMiningTab ? (
            <ViewSelector
              views={currencies}
              activeKey={currency}
              onSelect={(k) => {
                setCurrency(k);
                setSharedView(k === "USD" ? "USD" : k === "FIAT" ? "FIAT" : "NATIVE");
              }}
            />
          ) : isEarnTab ? (
            <ViewSelector views={earnViews} activeKey={effectiveEarnView} onSelect={setView} />
          ) : isTxTab && showTxSelector ? (
            <ViewSelector
              views={txViews}
              activeKey={effectiveTxView}
              onSelect={(k) => setView(k === "GMT" ? "NATIVE" : k)}
            />
          ) : isPurchaseTab ? (
            <ViewSelector
              views={purchaseViews}
              activeKey={effectivePurchaseView}
              onSelect={setView}
            />
          ) : showSimpleSelector ? (
            <ViewSelector views={simpleViews} activeKey={effectiveSimpleView} onSelect={setView} />
          ) : null}
        </div>
      </div>

      {/* Tabs */}
      <TabList activeKey={activeKey} onSelect={setActiveKey} />

      {/* Content */}
      <div className="dv-content">
        <ErrorBoundary>
          {isMiningTab ? (
            <MiningTable
              key={activeKey}
              rewardKey={activeKey}
              currency={currency}
              fiatCode={fiatCode}
              isFetching={isFetching}
              dateRange={dateRange}
              setDateRange={setDateRange}
            />
          ) : isEarnTab ? (
            <SimpleEarnTable
              key={activeKey}
              rewardKey={activeKey}
              fiatCode={fiatCode}
              earnView={effectiveEarnView}
              isFetching={isFetching}
              groupByDay={groupByDay}
              dateRange={dateRange}
              setDateRange={setDateRange}
            />
          ) : isTxTab ? (
            <TransactionsTable
              key={activeKey}
              rewardKey={activeKey}
              fiatCode={fiatCode}
              txView={effectiveTxView}
              isFetching={isFetching}
              groupByDay={groupByDay}
              dateRange={dateRange}
              setDateRange={setDateRange}
            />
          ) : isPurchaseTab ? (
            <PurchasesTable
              key={activeKey}
              fiatCode={fiatCode}
              purchaseView={effectivePurchaseView}
              isFetching={isFetching}
              groupByDay={groupByDay}
              dateRange={dateRange}
              setDateRange={setDateRange}
            />
          ) : (
            <SimpleTable
              key={activeKey}
              rewardKey={activeKey}
              fiatCode={fiatCode}
              simpleView={effectiveSimpleView}
              isFetching={isFetching}
              groupByDay={groupByDay}
              dateRange={dateRange}
              setDateRange={setDateRange}
            />
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
});

interface DataViewerButtonProps {
  active: boolean;
  onClick: () => void;
}

// Renders the header button that toggles the data-viewer panel open and closed.
export const DataViewerButton = memo(function DataViewerButton({
  active,
  onClick,
}: DataViewerButtonProps) {
  return (
    <button
      type="button"
      className={`dv-trigger-button${active ? " dv-trigger-button--active" : ""}`}
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
