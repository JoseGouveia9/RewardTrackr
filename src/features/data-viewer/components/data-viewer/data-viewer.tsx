import { memo, useEffect, useMemo } from "react";
import type React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { loadCacheEntry } from "@/features/export/utils/cache";
import { ErrorBoundary } from "@/components/error-boundary/error-boundary";
import type { Currency, EarnView, TxView, SimpleView, PurchaseView } from "../../types";
import type { CacheState, RewardKey } from "@/features/export/types";
import { ALL_TABS } from "../../utils/constants";
import { loadFiatCode } from "../../utils";
import { useDataViewerState } from "../../hooks/use-data-viewer-state";
import { MiningTable } from "../tables/mining-table";
import { SimpleTable } from "../tables/simple-table";
import { SimpleEarnTable } from "../tables/simple-earn-table";
import { TransactionsTable } from "../tables/transactions-table";
import { PurchasesTable } from "../tables/purchases-table";
import { TabList } from "../tab-list/tab-list";
import { ViewSelector } from "../view-selector/view-selector";
import "./data-viewer.css";

interface DataViewerProps {
  onClose: () => void;
  isFetching?: boolean;
  fetchingKeys?: Set<RewardKey>;
  cacheVersion?: number;
  onTabSeen?: (key: RewardKey) => void;
  title?: string;
  /** When set the viewer renders the supplied records instead of localStorage. */
  sharedData?: Partial<CacheState> | null;
  /** Optional banner rendered above the dv-page (e.g. SharedBanner). */
  banner?: React.ReactNode;
  /** When provided, a Share button is shown in the header. */
  onShare?: () => void;
  /** Disables the share button and shows a tooltip when true. */
  shareDisabled?: boolean;
}

export const DataViewer = memo(function DataViewer({
  onClose,
  isFetching = false,
  fetchingKeys,
  cacheVersion = 0,
  onTabSeen,
  title = "Records",
  sharedData,
  banner,
  onShare,
  shareDisabled = false,
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

  const isSharedContext = sharedData !== null && sharedData !== undefined;

  const isActiveKeyFetching =
    isFetching && (fetchingKeys === undefined || fetchingKeys.has(activeKey));

  const visibleTabs = useMemo(() => {
    if (!isSharedContext || isFetching) return ALL_TABS;

    const filtered = ALL_TABS.filter((tab) => {
      if (tab.key === "purchases") {
        return (
          (sharedData?.["purchases"]?.records?.length ?? 0) > 0 ||
          (sharedData?.["upgrades"]?.records?.length ?? 0) > 0
        );
      }
      return (sharedData?.[tab.key]?.records?.length ?? 0) > 0;
    });

    return filtered.length > 0 ? filtered : ALL_TABS;
  }, [isFetching, isSharedContext, sharedData]);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === activeKey)) {
      setActiveKey(visibleTabs[0].key);
    }
  }, [activeKey, setActiveKey, visibleTabs]);

  const activeTab = visibleTabs.find((t) => t.key === activeKey) ?? visibleTabs[0];
  const isMiningTab = activeTab.kind === "mining";
  const isEarnTab = activeTab.kind === "earn";
  const isTxTab = activeTab.kind === "tx";
  const isPurchaseTab = activeTab.kind === "purchase";
  const isSimpleTab = activeTab.kind === "simple";

  const simpleDataInfo = useMemo(() => {
    void cacheVersion;
    if (!isSimpleTab) return { currencies: [] as string[], hasUsd: false, hasFiat: false };
    const entry = sharedData ? sharedData[activeKey] : loadCacheEntry(activeKey);
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
  }, [activeKey, isSimpleTab, cacheVersion, sharedData]);

  const txDataInfo = useMemo(() => {
    void cacheVersion;
    if (!isTxTab) return { hasUsd: false, hasFiat: false };
    const entry = sharedData ? sharedData[activeKey] : loadCacheEntry(activeKey);
    if (!entry?.records?.length) return { hasUsd: false, hasFiat: false };
    let hasUsd = false;
    let hasFiat = false;
    for (const r of entry.records) {
      const rec = r as Record<string, unknown>;
      if (Number(rec.rewardInUSD ?? rec.rewardInUsd ?? 0) !== 0) hasUsd = true;
      if (Number(rec.rewardInFiat ?? 0) !== 0) hasFiat = true;
    }
    return { hasUsd, hasFiat };
  }, [activeKey, isTxTab, cacheVersion, sharedData]);

  const tabsWithNew = useMemo(() => {
    // Never show "new" badges when viewing a shared profile
    if (sharedData) return new Set<RewardKey>();
    void cacheVersion;
    const flagged = new Set<RewardKey>();
    for (const tab of ALL_TABS) {
      const count =
        tab.key === "purchases"
          ? (loadCacheEntry("purchases")?.newEntriesCount ?? 0) +
            (loadCacheEntry("upgrades")?.newEntriesCount ?? 0)
          : (loadCacheEntry(tab.key)?.newEntriesCount ?? 0);
      if (count > 0) flagged.add(tab.key);
    }
    return flagged;
  }, [cacheVersion, sharedData]);

  const hasActiveData = useMemo(() => {
    void cacheVersion;
    if (sharedData) {
      if (isPurchaseTab) {
        return Boolean(
          (sharedData["purchases"]?.records?.length ?? 0) > 0 ||
          (sharedData["upgrades"]?.records?.length ?? 0) > 0,
        );
      }
      return (sharedData[activeKey]?.records?.length ?? 0) > 0;
    }
    if (isPurchaseTab) {
      return Boolean(
        (loadCacheEntry("purchases")?.records?.length ?? 0) > 0 ||
        (loadCacheEntry("upgrades")?.records?.length ?? 0) > 0,
      );
    }
    return (loadCacheEntry(activeKey)?.records?.length ?? 0) > 0;
  }, [activeKey, cacheVersion, isPurchaseTab, sharedData]);

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

  const hasViewSelector =
    hasActiveData &&
    (isMiningTab ||
      isEarnTab ||
      (isTxTab && showTxSelector) ||
      isPurchaseTab ||
      showSimpleSelector);

  const purchaseViews: { key: PurchaseView; label: string }[] = [
    { key: "NATIVE", label: "Native" },
    { key: "USD", label: "USD" },
    { key: "FIAT", label: fiatCode },
  ];

  const tableAnimationKey = `${activeKey}:${
    isMiningTab
      ? currency
      : isEarnTab
        ? effectiveEarnView
        : isTxTab
          ? effectiveTxView
          : isPurchaseTab
            ? effectivePurchaseView
            : effectiveSimpleView
  }:${groupByDay ? "grouped" : "raw"}`;

  return (
    <>
      {banner}
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
            {title ? <span className="dv-title">{title}</span> : null}
            {onShare && (
              <button
                type="button"
                className={`dv-share-button${shareDisabled ? " dv-share-button--disabled" : ""}`}
                onClick={shareDisabled ? undefined : onShare}
                aria-disabled={shareDisabled}
                aria-label="Share records"
                title={shareDisabled ? "Export in progress — share after it completes" : undefined}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                <span>Share</span>
              </button>
            )}
          </div>

          {/* Toolbar: group button + currency selector */}
          <div className="dv-toolbar">
            {hasActiveData && !isMiningTab && (
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
            {hasViewSelector && !isMiningTab && <span className="dv-toolbar-separator">·</span>}
            {hasActiveData && isMiningTab ? (
              <ViewSelector
                views={currencies}
                activeKey={currency}
                onSelect={(k) => {
                  setCurrency(k);
                  setSharedView(k === "USD" ? "USD" : k === "FIAT" ? "FIAT" : "NATIVE");
                }}
              />
            ) : hasActiveData && isEarnTab ? (
              <ViewSelector views={earnViews} activeKey={effectiveEarnView} onSelect={setView} />
            ) : hasActiveData && isTxTab && showTxSelector ? (
              <ViewSelector
                views={txViews}
                activeKey={effectiveTxView}
                onSelect={(k) => setView(k === "GMT" ? "NATIVE" : k)}
              />
            ) : hasActiveData && isPurchaseTab ? (
              <ViewSelector
                views={purchaseViews}
                activeKey={effectivePurchaseView}
                onSelect={setView}
              />
            ) : hasActiveData && showSimpleSelector ? (
              <ViewSelector
                views={simpleViews}
                activeKey={effectiveSimpleView}
                onSelect={setView}
              />
            ) : null}
          </div>
        </div>

        {/* Tabs */}
        <TabList
          tabs={visibleTabs}
          activeKey={activeKey}
          onSelect={setActiveKey}
          tabsWithNew={tabsWithNew}
          onTabSeen={onTabSeen}
          fetchingKeys={fetchingKeys}
        />

        {/* Content */}
        <div className="dv-content">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tableAnimationKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
            >
              <ErrorBoundary>
                {isMiningTab ? (
                  <MiningTable
                    key={activeKey}
                    rewardKey={activeKey}
                    currency={currency}
                    fiatCode={fiatCode}
                    isFetching={isActiveKeyFetching}
                    cacheVersion={cacheVersion}
                    cacheEntry={sharedData ? (sharedData[activeKey] ?? null) : undefined}
                    dateRange={dateRange}
                    setDateRange={setDateRange}
                  />
                ) : isEarnTab ? (
                  <SimpleEarnTable
                    key={activeKey}
                    rewardKey={activeKey}
                    fiatCode={fiatCode}
                    earnView={effectiveEarnView}
                    isFetching={isActiveKeyFetching}
                    cacheVersion={cacheVersion}
                    cacheEntry={sharedData ? (sharedData[activeKey] ?? null) : undefined}
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
                    isFetching={isActiveKeyFetching}
                    cacheVersion={cacheVersion}
                    cacheEntry={sharedData ? (sharedData[activeKey] ?? null) : undefined}
                    groupByDay={groupByDay}
                    dateRange={dateRange}
                    setDateRange={setDateRange}
                  />
                ) : isPurchaseTab ? (
                  <PurchasesTable
                    key={activeKey}
                    fiatCode={fiatCode}
                    purchaseView={effectivePurchaseView}
                    isFetching={isActiveKeyFetching}
                    cacheVersion={cacheVersion}
                    purchasesCacheEntry={sharedData ? (sharedData["purchases"] ?? null) : undefined}
                    upgradesCacheEntry={sharedData ? (sharedData["upgrades"] ?? null) : undefined}
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
                    isFetching={isActiveKeyFetching}
                    cacheVersion={cacheVersion}
                    cacheEntry={sharedData ? (sharedData[activeKey] ?? null) : undefined}
                    groupByDay={groupByDay}
                    dateRange={dateRange}
                    setDateRange={setDateRange}
                  />
                )}
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </>
  );
});

interface DataViewerButtonProps {
  active: boolean;
  onClick: () => void;
  hasNew?: boolean;
}

// Renders the header button that toggles the data-viewer panel open and closed.
export const DataViewerButton = memo(function DataViewerButton({
  active,
  onClick,
  hasNew = false,
}: DataViewerButtonProps) {
  return (
    <button
      type="button"
      className={`dv-trigger-button${active ? " dv-trigger-button--active" : ""}${hasNew && !active ? " dv-trigger-button--has-new" : ""}`}
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
      {hasNew ? <span className="dv-new-badge dv-new-badge--button">NEW</span> : null}
    </button>
  );
});
