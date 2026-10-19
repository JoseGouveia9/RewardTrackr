import type React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ErrorBoundary } from "@/components/error-boundary/error-boundary";
import type { RewardKey } from "@/types/rewards";
import type { Currency } from "@/features/records/types";
import { RowSelectionProvider } from "@/features/records/stores/row-selection-context";
import { MiningTable } from "@/features/records/components/mining-table/mining-table";
import { PurchasesTable } from "@/features/records/components/purchases-table/purchases-table";
import { SimpleEarnTable } from "@/features/records/components/simple-earn-table/simple-earn-table";
import { SimpleTable } from "@/features/records/components/simple-table/simple-table";
import { TransactionsTable } from "@/features/records/components/transactions-table/transactions-table";
import type { MiningTableState, SharedData, TableCommonProps, TabKind } from "../../types";
import type { EffectiveViews } from "../../utils/view-options";

interface DataViewerContentProps {
  rowSelection: React.ComponentProps<typeof RowSelectionProvider>["value"];
  animationKey: string;
  tab: { key: RewardKey; kind: TabKind };
  currency: Currency;
  views: EffectiveViews;
  sharedData: SharedData;
  table: TableCommonProps;
  mining: MiningTableState;
}

/** Renders the table matching the active tab's kind, with an animated swap when the view changes. */
export function DataViewerContent({
  rowSelection,
  animationKey,
  tab,
  currency,
  views,
  sharedData,
  table,
  mining,
}: DataViewerContentProps) {
  const { key } = tab;
  const cacheEntry = sharedData ? (sharedData[key] ?? null) : undefined;
  const { fiatCode, isFetching, cacheVersion, dateRange, setDateRange, pageSize } = table;
  const shared = { fiatCode, isFetching, cacheVersion, dateRange, setDateRange, pageSize };
  const listProps = { ...shared, groupByDay: table.groupByDay };

  return (
    <div className="dv-content">
      <RowSelectionProvider value={rowSelection}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={animationKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
          >
            <ErrorBoundary>
              {tab.kind === "mining" ? (
                <MiningTable
                  key={key}
                  rewardKey={key}
                  currency={currency}
                  {...shared}
                  cacheEntry={cacheEntry}
                  minerWarsPrefetching={mining.minerWarsPrefetching}
                  page={mining.page}
                  setPage={mining.setPage}
                  showTrends={mining.trends.show}
                  trendsAnimating={mining.trends.animating}
                  trendsExiting={mining.trends.exiting}
                  difficultyMap={mining.difficultyMap}
                  isShared={mining.isShared}
                  onCycleTrackerOpenChange={mining.onCycleTrackerOpenChange}
                  minerWarsShareDisabled={mining.shareDisabled}
                />
              ) : tab.kind === "earn" ? (
                <SimpleEarnTable
                  key={key}
                  rewardKey={key}
                  earnView={views.earn}
                  cacheEntry={cacheEntry}
                  {...listProps}
                />
              ) : tab.kind === "tx" ? (
                <TransactionsTable
                  key={key}
                  rewardKey={key}
                  transactionView={views.transaction}
                  cacheEntry={cacheEntry}
                  {...listProps}
                />
              ) : tab.kind === "purchase" ? (
                <PurchasesTable
                  key={key}
                  purchaseView={views.purchase}
                  purchasesCacheEntry={sharedData ? (sharedData["purchases"] ?? null) : undefined}
                  upgradesCacheEntry={sharedData ? (sharedData["upgrades"] ?? null) : undefined}
                  {...listProps}
                />
              ) : (
                <SimpleTable
                  key={key}
                  rewardKey={key}
                  simpleView={views.simple}
                  cacheEntry={cacheEntry}
                  {...listProps}
                />
              )}
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </RowSelectionProvider>
    </div>
  );
}
