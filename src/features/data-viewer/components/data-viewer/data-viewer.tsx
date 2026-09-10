import { memo, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { useTranslation } from "react-i18next";
import { loadCacheEntry } from "@/lib/reward-cache";
import {
  fetchDifficultyAdjustments,
  type DifficultyEntry,
} from "@/lib/minerwars/difficulty-adjustments";
import type { Currency, EarnView, TxView, SimpleView, PurchaseView } from "../../types";
import type { CacheState, RewardKey } from "@/types/rewards";
import { userHasMinerWarsHistory } from "@/lib/minerwars/comparison";
import { ALL_TABS } from "../../utils/constants";
import { loadFiatCode } from "../../utils";
import { useDataViewerState } from "../../hooks/use-data-viewer-state";
import { DataViewerHeader } from "./data-viewer-header";
import { DataViewerContent } from "./data-viewer-content";
import { DataViewerTabs } from "./data-viewer-tabs";
import { RecordsGridIcon } from "../icons";
import "./data-viewer.css";

interface DataViewerProps {
  onClose: () => void;
  isFetching?: boolean;
  fetchingKeys?: Set<RewardKey>;
  cacheVersion?: number;
  minerWarsPrefetching?: boolean;
  onRefreshKeys?: (keys: RewardKey[]) => Promise<void>;
  onRefreshRecords?: () => Promise<void>;
  onDownloadRecords?: () => Promise<void>;
  onOpenBuildSettings?: () => void;
  onTabSeen?: (key: RewardKey) => void;
  title?: string | null;
  sharedData?: Partial<CacheState> | null;
  banner?: React.ReactNode;
  onShare?: () => void;
  shareDisabled?: boolean;
  hideHeader?: boolean;
  showBackButton?: boolean;
  pageSize?: number;
  rowSelection?: {
    exclusions: Partial<Record<RewardKey, string[]>>;
    onToggle: (key: RewardKey, ids: string[]) => void;
  };
}

export const DataViewer = memo(function DataViewer({
  onClose,
  isFetching = false,
  fetchingKeys,
  cacheVersion = 0,
  minerWarsPrefetching = false,
  onRefreshKeys,
  onRefreshRecords,
  onDownloadRecords,
  onOpenBuildSettings,
  onTabSeen,
  title = "Records",
  sharedData,
  banner,
  onShare,
  shareDisabled = false,
  hideHeader = false,
  showBackButton = true,
  pageSize,
  rowSelection,
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
    miningPage,
    setMiningPage,
  } = useDataViewerState();

  useEffect(() => setMiningPage(0), [activeKey, dateRange, setMiningPage]);
  const fiatCode = useMemo(() => loadFiatCode(), []);

  const isSharedContext = sharedData !== null && sharedData !== undefined;
  const effectiveGroupByDay = groupByDay;

  const rowSelectionContextValue = useMemo(() => {
    if (!rowSelection) return null;
    return {
      exclusions: rowSelection.exclusions,
      onToggle: rowSelection.onToggle,
    };
  }, [rowSelection]);

  const isActiveKeyFetching =
    isFetching && (fetchingKeys === undefined || fetchingKeys.has(activeKey));

  const visibleTabs = useMemo(() => {
    void cacheVersion;
    const baseTabs = userHasMinerWarsHistory()
      ? ALL_TABS
      : ALL_TABS.filter((t) => t.key !== "minerwars");

    if (!isSharedContext || isFetching) return baseTabs;

    const filtered = baseTabs.filter((tab) => {
      if (tab.key === "purchases") {
        return (
          (sharedData?.["purchases"]?.records?.length ?? 0) > 0 ||
          (sharedData?.["upgrades"]?.records?.length ?? 0) > 0
        );
      }
      return (sharedData?.[tab.key]?.records?.length ?? 0) > 0;
    });

    return filtered.length > 0 ? filtered : baseTabs;
  }, [cacheVersion, isFetching, isSharedContext, sharedData]);

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

  const hasTrendsData = useMemo(() => {
    void cacheVersion;
    if (activeKey === "minerwars") {
      if (currency === "BTC") return false;
      const entry = sharedData ? sharedData["minerwars"] : loadCacheEntry("minerwars");
      if (!entry?.records?.length) return false;
      return (entry.records as Record<string, unknown>[]).some((r) => r.btcPriceAtTime != null);
    }
    const entry = sharedData ? sharedData["solo-mining"] : loadCacheEntry("solo-mining");
    if (!entry?.records?.length) return false;
    return (entry.records as Record<string, unknown>[]).some((r) => r.satsPerTh != null);
  }, [activeKey, currency, cacheVersion, sharedData]);

  const tabsWithNew = useMemo(() => {
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

  const [showTrends, setShowTrends] = useState(false);
  const [trendsAnimating, setTrendsAnimating] = useState(false);
  const [trendsExiting, setTrendsExiting] = useState(false);
  const [isMinerWarsTrackerOpen, setIsMinerWarsTrackerOpen] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleTrends = () => {
    if (exitTimer.current) clearTimeout(exitTimer.current);
    if (animTimer.current) clearTimeout(animTimer.current);
    if (!showTrends) {
      setTrendsExiting(false);
      setTrendsAnimating(true);
      setShowTrends(true);
      animTimer.current = setTimeout(() => setTrendsAnimating(false), 220);
    } else {
      setTrendsAnimating(false);
      setTrendsExiting(true);
      exitTimer.current = setTimeout(() => {
        setShowTrends(false);
        setTrendsExiting(false);
      }, 180);
    }
  };

  const [difficultyMap, setDifficultyMap] = useState<Map<string, DifficultyEntry>>(new Map());
  useEffect(() => {
    void fetchDifficultyAdjustments().then(setDifficultyMap);
  }, []);

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
      ? activeKey === "minerwars"
        ? "mw"
        : currency
      : isEarnTab
        ? effectiveEarnView
        : isTxTab
          ? effectiveTxView
          : isPurchaseTab
            ? effectivePurchaseView
            : effectiveSimpleView
  }:${effectiveGroupByDay ? "grouped" : "raw"}`;

  const showMiningViewSelector =
    hasActiveData && isMiningTab && !(activeKey === "minerwars" && isMinerWarsTrackerOpen);
  const showMiningTrendsToggle =
    hasActiveData &&
    isMiningTab &&
    hasTrendsData &&
    (activeKey === "solo-mining" || (activeKey === "minerwars" && !isMinerWarsTrackerOpen));
  const hideRecordsHeaderActions = activeKey === "minerwars" && isMinerWarsTrackerOpen;
  const showRecordsShareButton = Boolean(onShare) && !hideRecordsHeaderActions;
  const showRecordsRefreshButton = Boolean(onRefreshRecords) && !hideRecordsHeaderActions;
  const showRecordsDownloadButton = Boolean(onDownloadRecords) && !hideRecordsHeaderActions;
  const showBuildSettingsButton = Boolean(onOpenBuildSettings) && !hideRecordsHeaderActions;
  const showRecordsHeaderActionGroup =
    showRecordsShareButton ||
    showRecordsRefreshButton ||
    showRecordsDownloadButton ||
    showBuildSettingsButton;
  const showMiningHeaderControlGroup = showMiningTrendsToggle || showMiningViewSelector;
  const handleRefreshRecordsClick = () => {
    if (onRefreshRecords) void onRefreshRecords();
  };
  const handleDownloadRecordsClick = () => {
    if (onDownloadRecords) void onDownloadRecords();
  };

  return (
    <>
      {banner}
      <div className="dv-page">
        <DataViewerHeader
          hideHeader={hideHeader}
          showBackButton={showBackButton}
          onClose={onClose}
          title={title}
          onShare={onShare}
          shareDisabled={shareDisabled}
          onRefreshRecords={showRecordsRefreshButton ? handleRefreshRecordsClick : undefined}
          onDownloadRecords={showRecordsDownloadButton ? handleDownloadRecordsClick : undefined}
          onOpenBuildSettings={showBuildSettingsButton ? onOpenBuildSettings : undefined}
          hasActiveData={hasActiveData}
          isMiningTab={isMiningTab}
          isEarnTab={isEarnTab}
          isTxTab={isTxTab}
          isPurchaseTab={isPurchaseTab}
          groupByDay={groupByDay}
          onToggleGroupByDay={() => setGroupByDay((v) => !v)}
          hasViewSelector={hasViewSelector}
          showRecordsHeaderActionGroup={showRecordsHeaderActionGroup}
          showRecordsShareButton={showRecordsShareButton}
          showRecordsRefreshButton={showRecordsRefreshButton}
          showRecordsDownloadButton={showRecordsDownloadButton}
          showBuildSettingsButton={showBuildSettingsButton}
          showMiningHeaderControlGroup={showMiningHeaderControlGroup}
          showMiningTrendsToggle={showMiningTrendsToggle}
          showTrends={showTrends}
          trendsExiting={trendsExiting}
          onToggleTrends={toggleTrends}
          showMiningViewSelector={showMiningViewSelector}
          currencies={currencies}
          currency={currency}
          onSelectMiningCurrency={(k) => {
            setCurrency(k);
            setSharedView(k === "USD" ? "USD" : k === "FIAT" ? "FIAT" : "NATIVE");
          }}
          earnViews={earnViews}
          effectiveEarnView={effectiveEarnView}
          onSelectEarnView={setView}
          txViews={txViews}
          effectiveTxView={effectiveTxView}
          showTxSelector={showTxSelector}
          onSelectTxView={(k) => setView(k === "GMT" ? "NATIVE" : k)}
          purchaseViews={purchaseViews}
          effectivePurchaseView={effectivePurchaseView}
          onSelectPurchaseView={setView}
          simpleViews={simpleViews}
          effectiveSimpleView={effectiveSimpleView}
          showSimpleSelector={showSimpleSelector}
          onSelectSimpleView={setView}
        />

        <DataViewerTabs
          hidden={hideRecordsHeaderActions}
          tabs={visibleTabs}
          activeKey={activeKey}
          onSelect={setActiveKey}
          tabsWithNew={tabsWithNew}
          onTabSeen={onTabSeen}
          fetchingKeys={fetchingKeys}
        />

        {}
        <DataViewerContent
          rowSelectionContextValue={rowSelectionContextValue}
          tableAnimationKey={tableAnimationKey}
          activeKey={activeKey}
          isMiningTab={isMiningTab}
          isEarnTab={isEarnTab}
          isTxTab={isTxTab}
          isPurchaseTab={isPurchaseTab}
          currency={currency}
          fiatCode={fiatCode}
          isActiveKeyFetching={isActiveKeyFetching}
          cacheVersion={cacheVersion}
          minerWarsPrefetching={minerWarsPrefetching}
          onRefreshKeys={onRefreshKeys}
          sharedData={sharedData}
          effectiveGroupByDay={effectiveGroupByDay}
          dateRange={dateRange}
          setDateRange={setDateRange}
          miningPage={miningPage}
          setMiningPage={setMiningPage}
          showTrends={showTrends}
          trendsAnimating={trendsAnimating}
          trendsExiting={trendsExiting}
          difficultyMap={difficultyMap}
          pageSize={pageSize}
          isSharedContext={isSharedContext}
          setIsMinerWarsTrackerOpen={setIsMinerWarsTrackerOpen}
          shareDisabled={shareDisabled}
          effectiveEarnView={effectiveEarnView}
          effectiveTxView={effectiveTxView}
          effectivePurchaseView={effectivePurchaseView}
          effectiveSimpleView={effectiveSimpleView}
        />
      </div>
    </>
  );
});

interface DataViewerButtonProps {
  active: boolean;
  onClick: () => void;
  hasNew?: boolean;
}

export const DataViewerButton = memo(function DataViewerButton({
  active,
  onClick,
  hasNew = false,
}: DataViewerButtonProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={`dv-trigger-button${active ? " dv-trigger-button--active" : ""}${hasNew && !active ? " dv-trigger-button--has-new" : ""}`}
      onClick={onClick}
      aria-label={t("app.records")}
    >
      <RecordsGridIcon />
      <span>{t("app.records")}</span>
      {hasNew ? <span className="dv-new-badge dv-new-badge--button">{t("common.new")}</span> : null}
    </button>
  );
});
