import { memo, useEffect, useMemo, useState } from "react";
import type React from "react";
import { useTranslation } from "react-i18next";
import {
  fetchDifficultyAdjustments,
  type DifficultyEntry,
} from "@/features/minerwars/api/difficulty-adjustments";
import type { RewardKey } from "@/types/rewards";
import { RecordsGridIcon } from "@/components/icons";
import { loadFiatCode } from "../../utils";
import {
  buildViewOptions,
  resolveEffectiveViews,
  resolveTabViewSelector,
  toSelector,
} from "./utils/view-options";
import { useDataViewerState } from "./hooks/use-data-viewer-state";
import {
  useHasActiveData,
  useHasTrendsData,
  useRecordsViewInfo,
  useTabsWithNew,
  useVisibleTabs,
} from "./hooks/use-data-viewer-data";
import { useTrendsToggle } from "./hooks/use-trends-toggle";
import { DataViewerHeader } from "./components/data-viewer-header/data-viewer-header";
import { DataViewerContent } from "./components/data-viewer-content/data-viewer-content";
import { DataViewerTabs } from "./components/data-viewer-tabs/data-viewer-tabs";
import type { HeaderOptions, RecordsActions, SharedData } from "./types";
import "./data-viewer-base.css";
import "./data-viewer-controls.css";
import "./data-viewer-tables.css";
import "./data-viewer-trends.css";
import "./data-viewer-pagination-date.css";
import "./data-viewer-calendar.css";
import "./data-viewer-states.css";

interface DataViewerProps {
  onClose: () => void;
  isFetching?: boolean;
  fetchingKeys?: Set<RewardKey>;
  cacheVersion?: number;
  minerWarsPrefetching?: boolean;
  onTabSeen?: (key: RewardKey) => void;
  sharedData?: SharedData;
  banner?: React.ReactNode;
  pageSize?: number;
  rowSelection?: {
    exclusions: Partial<Record<RewardKey, string[]>>;
    onToggle: (key: RewardKey, ids: string[]) => void;
  };
  actions?: RecordsActions;
  header?: HeaderOptions;
}

const NO_ACTIONS: RecordsActions = {};
const DEFAULT_HEADER: HeaderOptions = {};

/**
 * Records screen: header controls, tab strip and the table of the active tab. Works on local
 * cache or on `sharedData` (shared profiles, share filter), which also disables cache-only features.
 */
export const DataViewer = memo(function DataViewer({
  onClose,
  isFetching = false,
  fetchingKeys,
  cacheVersion = 0,
  minerWarsPrefetching = false,
  onTabSeen,
  sharedData,
  banner,
  pageSize,
  rowSelection,
  actions = NO_ACTIONS,
  header = DEFAULT_HEADER,
}: DataViewerProps) {
  const { title = "Records", hidden: hideHeader = false, showBackButton = true } = header;
  const shareDisabled = actions.disabled ?? false;

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

  const rowSelectionContextValue = useMemo(() => {
    if (!rowSelection) return null;
    return {
      exclusions: rowSelection.exclusions,
      onToggle: rowSelection.onToggle,
    };
  }, [rowSelection]);

  const isActiveKeyFetching =
    isFetching && (fetchingKeys === undefined || fetchingKeys.has(activeKey));

  const visibleTabs = useVisibleTabs(cacheVersion, isFetching, sharedData);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === activeKey)) {
      setActiveKey(visibleTabs[0].key);
    }
  }, [activeKey, setActiveKey, visibleTabs]);

  const activeTab = visibleTabs.find((t) => t.key === activeKey) ?? visibleTabs[0];
  const isMiningTab = activeTab.kind === "mining";

  const simpleDataInfo = useRecordsViewInfo(
    activeKey,
    activeTab.kind === "simple",
    cacheVersion,
    sharedData,
  );
  const transactionDataInfo = useRecordsViewInfo(
    activeKey,
    activeTab.kind === "tx",
    cacheVersion,
    sharedData,
  );
  const hasTrendsData = useHasTrendsData(activeKey, currency, cacheVersion, sharedData);
  const tabsWithNew = useTabsWithNew(cacheVersion, sharedData);
  const hasActiveData = useHasActiveData(
    activeKey,
    activeTab.kind === "purchase",
    cacheVersion,
    sharedData,
  );

  const viewOptions = buildViewOptions(fiatCode, transactionDataInfo, simpleDataInfo);
  const effectiveViews = resolveEffectiveViews(sharedView, transactionDataInfo, simpleDataInfo);

  const { showTrends, trendsAnimating, trendsExiting, toggleTrends } = useTrendsToggle();
  const [isMinerWarsTrackerOpen, setIsMinerWarsTrackerOpen] = useState(false);

  const [difficultyMap, setDifficultyMap] = useState<Map<string, DifficultyEntry>>(new Map());
  useEffect(() => {
    void fetchDifficultyAdjustments().then(setDifficultyMap);
  }, []);

  const trackerOpen = activeKey === "minerwars" && isMinerWarsTrackerOpen;

  const selectedView =
    activeTab.kind === "mining"
      ? activeKey === "minerwars"
        ? "mw"
        : currency
      : activeTab.kind === "tx"
        ? effectiveViews.transaction
        : effectiveViews[activeTab.kind];
  const tableAnimationKey = `${activeKey}:${selectedView}:${groupByDay ? "grouped" : "raw"}`;

  const showMiningViewSelector = hasActiveData && isMiningTab && !trackerOpen;
  const showMiningTrendsToggle =
    hasActiveData &&
    isMiningTab &&
    hasTrendsData &&
    (activeKey === "solo-mining" || (activeKey === "minerwars" && !trackerOpen));

  return (
    <>
      {banner}
      <div className="dv-page">
        {!hideHeader && (
          <DataViewerHeader
            title={title}
            showBackButton={showBackButton}
            onClose={onClose}
            actions={trackerOpen ? NO_ACTIONS : actions}
            groupByDay={
              hasActiveData && !isMiningTab
                ? { active: groupByDay, onToggle: () => setGroupByDay((isGrouped) => !isGrouped) }
                : null
            }
            trendsToggle={
              showMiningTrendsToggle
                ? { active: showTrends && !trendsExiting, onToggle: toggleTrends }
                : null
            }
            currencySelector={
              showMiningViewSelector
                ? toSelector(viewOptions.currencies, currency, (key) => {
                    setCurrency(key);
                    setSharedView(key === "USD" ? "USD" : key === "FIAT" ? "FIAT" : "NATIVE");
                  })
                : null
            }
            tabViewSelector={
              hasActiveData
                ? resolveTabViewSelector(activeTab.kind, viewOptions, effectiveViews, setView)
                : null
            }
          />
        )}

        <DataViewerTabs
          hidden={trackerOpen}
          tabs={visibleTabs}
          activeKey={activeKey}
          onSelect={setActiveKey}
          tabsWithNew={tabsWithNew}
          onTabSeen={onTabSeen}
          fetchingKeys={fetchingKeys}
        />

        <DataViewerContent
          rowSelection={rowSelectionContextValue}
          animationKey={tableAnimationKey}
          tab={{ key: activeKey, kind: activeTab.kind }}
          currency={currency}
          views={effectiveViews}
          sharedData={sharedData}
          table={{
            fiatCode,
            isFetching: isActiveKeyFetching,
            cacheVersion,
            groupByDay,
            dateRange,
            setDateRange,
            pageSize,
          }}
          mining={{
            minerWarsPrefetching,
            page: miningPage,
            setPage: setMiningPage,
            trends: { show: showTrends, animating: trendsAnimating, exiting: trendsExiting },
            difficultyMap,
            isShared: isSharedContext,
            onCycleTrackerOpenChange: setIsMinerWarsTrackerOpen,
            shareDisabled,
          }}
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
