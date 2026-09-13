import type React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ErrorBoundary } from "@/components/error-boundary/error-boundary";
import type { DifficultyEntry } from "@/lib/minerwars/difficulty-adjustments";
import type { CacheState, RewardKey } from "@/types/rewards";
import type { Currency, DateRange, EarnView, PurchaseView, SimpleView, TxView } from "../../types";
import { RowSelectionProvider } from "../../stores/row-selection-context";
import { MiningTable } from "../tables/mining-table";
import { PurchasesTable } from "../tables/purchases-table";
import { SimpleEarnTable } from "../tables/simple-earn-table";
import { SimpleTable } from "../tables/simple-table";
import { TransactionsTable } from "../tables/transactions-table";

interface DataViewerContentProps {
  rowSelectionContextValue: React.ComponentProps<typeof RowSelectionProvider>["value"];
  tableAnimationKey: string;
  activeKey: RewardKey;
  isMiningTab: boolean;
  isEarnTab: boolean;
  isTxTab: boolean;
  isPurchaseTab: boolean;
  currency: Currency;
  fiatCode: string;
  isActiveKeyFetching: boolean;
  cacheVersion: number;
  minerWarsPrefetching: boolean;
  onRefreshKeys?: (keys: RewardKey[]) => Promise<void>;
  sharedData?: Partial<CacheState> | null;
  effectiveGroupByDay: boolean;
  dateRange: DateRange;
  setDateRange: (v: DateRange) => void;
  miningPage: number;
  setMiningPage: (p: number) => void;
  showTrends: boolean;
  trendsAnimating: boolean;
  trendsExiting: boolean;
  difficultyMap: Map<string, DifficultyEntry>;
  pageSize?: number;
  isSharedContext: boolean;
  setIsMinerWarsTrackerOpen: (open: boolean) => void;
  shareDisabled: boolean;
  effectiveEarnView: EarnView;
  effectiveTxView: TxView;
  effectivePurchaseView: PurchaseView;
  effectiveSimpleView: SimpleView;
}

export function DataViewerContent({
  rowSelectionContextValue,
  tableAnimationKey,
  activeKey,
  isMiningTab,
  isEarnTab,
  isTxTab,
  isPurchaseTab,
  currency,
  fiatCode,
  isActiveKeyFetching,
  cacheVersion,
  minerWarsPrefetching,
  onRefreshKeys,
  sharedData,
  effectiveGroupByDay,
  dateRange,
  setDateRange,
  miningPage,
  setMiningPage,
  showTrends,
  trendsAnimating,
  trendsExiting,
  difficultyMap,
  pageSize,
  isSharedContext,
  setIsMinerWarsTrackerOpen,
  shareDisabled,
  effectiveEarnView,
  effectiveTxView,
  effectivePurchaseView,
  effectiveSimpleView,
}: DataViewerContentProps) {
  return (
    <div className="dv-content">
      <RowSelectionProvider value={rowSelectionContextValue}>
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
                  minerWarsPrefetching={minerWarsPrefetching}
                  onRefreshKeys={onRefreshKeys}
                  cacheEntry={sharedData ? (sharedData[activeKey] ?? null) : undefined}
                  dateRange={dateRange}
                  setDateRange={setDateRange}
                  page={miningPage}
                  setPage={setMiningPage}
                  showTrends={showTrends}
                  trendsAnimating={trendsAnimating}
                  trendsExiting={trendsExiting}
                  difficultyMap={difficultyMap}
                  pageSize={pageSize}
                  isShared={isSharedContext}
                  onCycleTrackerOpenChange={setIsMinerWarsTrackerOpen}
                  minerWarsShareDisabled={shareDisabled}
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
                  groupByDay={effectiveGroupByDay}
                  dateRange={dateRange}
                  setDateRange={setDateRange}
                  pageSize={pageSize}
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
                  groupByDay={effectiveGroupByDay}
                  dateRange={dateRange}
                  setDateRange={setDateRange}
                  pageSize={pageSize}
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
                  groupByDay={effectiveGroupByDay}
                  dateRange={dateRange}
                  setDateRange={setDateRange}
                  pageSize={pageSize}
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
                  groupByDay={effectiveGroupByDay}
                  dateRange={dateRange}
                  setDateRange={setDateRange}
                  pageSize={pageSize}
                />
              )}
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </RowSelectionProvider>
    </div>
  );
}
