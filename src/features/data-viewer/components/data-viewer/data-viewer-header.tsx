import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { Currency, EarnView, PurchaseView, SimpleView, TxView } from "../../types";
import { ViewSelector } from "../view-selector/view-selector";
import {
  BackIcon,
  DownloadIcon,
  GroupByDayIcon,
  RefreshIcon,
  SettingsIcon,
  ShareIcon,
  TrendsIcon,
} from "../icons";

interface DataViewerHeaderProps {
  hideHeader: boolean;
  showBackButton: boolean;
  onClose: () => void;
  title: string | null;
  onShare?: () => void;
  shareDisabled: boolean;
  onRefreshRecords?: () => void;
  onDownloadRecords?: () => void;
  onOpenBuildSettings?: () => void;
  hasActiveData: boolean;
  isMiningTab: boolean;
  isEarnTab: boolean;
  isTxTab: boolean;
  isPurchaseTab: boolean;
  groupByDay: boolean;
  onToggleGroupByDay: () => void;
  hasViewSelector: boolean;
  showRecordsHeaderActionGroup: boolean;
  showRecordsShareButton: boolean;
  showRecordsRefreshButton: boolean;
  showRecordsDownloadButton: boolean;
  showBuildSettingsButton: boolean;
  showMiningHeaderControlGroup: boolean;
  showMiningTrendsToggle: boolean;
  showTrends: boolean;
  trendsExiting: boolean;
  onToggleTrends: () => void;
  showMiningViewSelector: boolean;
  currencies: { key: Currency; label: string }[];
  currency: Currency;
  onSelectMiningCurrency: (key: Currency) => void;
  earnViews: { key: EarnView; label: string }[];
  effectiveEarnView: EarnView;
  onSelectEarnView: (key: EarnView) => void;
  txViews: { key: TxView; label: string }[];
  effectiveTxView: TxView;
  showTxSelector: boolean;
  onSelectTxView: (key: TxView) => void;
  purchaseViews: { key: PurchaseView; label: string }[];
  effectivePurchaseView: PurchaseView;
  onSelectPurchaseView: (key: PurchaseView) => void;
  simpleViews: { key: SimpleView; label: string }[];
  effectiveSimpleView: SimpleView;
  showSimpleSelector: boolean;
  onSelectSimpleView: (key: SimpleView) => void;
}

const headerControlMotion = {
  initial: { opacity: 0, scale: 0.88, y: -5 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.88, y: -5 },
  transition: { duration: 0.18, ease: "easeOut" as const },
};

const headerLayoutTransition = { duration: 0.18, ease: "easeOut" as const };
const groupedControlRowStyle = {
  display: "inline-flex",
  alignItems: "center",
  flexDirection: "row" as const,
  flexWrap: "nowrap" as const,
  gap: "8px",
  whiteSpace: "nowrap" as const,
  flexShrink: 0,
  width: "max-content",
};

export function DataViewerHeader({
  hideHeader,
  showBackButton,
  onClose,
  title,
  onShare,
  shareDisabled,
  onRefreshRecords,
  onDownloadRecords,
  onOpenBuildSettings,
  hasActiveData,
  isMiningTab,
  isEarnTab,
  isTxTab,
  isPurchaseTab,
  groupByDay,
  onToggleGroupByDay,
  hasViewSelector,
  showRecordsHeaderActionGroup,
  showRecordsShareButton,
  showRecordsRefreshButton,
  showRecordsDownloadButton,
  showBuildSettingsButton,
  showMiningHeaderControlGroup,
  showMiningTrendsToggle,
  showTrends,
  trendsExiting,
  onToggleTrends,
  showMiningViewSelector,
  currencies,
  currency,
  onSelectMiningCurrency,
  earnViews,
  effectiveEarnView,
  onSelectEarnView,
  txViews,
  effectiveTxView,
  showTxSelector,
  onSelectTxView,
  purchaseViews,
  effectivePurchaseView,
  onSelectPurchaseView,
  simpleViews,
  effectiveSimpleView,
  showSimpleSelector,
  onSelectSimpleView,
}: DataViewerHeaderProps) {
  const { t } = useTranslation();

  if (hideHeader) return null;

  return (
    <div className="dv-header">
      <motion.div className="dv-header-left" layout transition={headerLayoutTransition}>
        {showBackButton && (
          <button
            type="button"
            className="dv-back-button"
            onClick={onClose}
            aria-label={t("common.back")}
          >
            <BackIcon />
            <span>{t("common.back")}</span>
          </button>
        )}
        {title ? <span className="dv-title">{title}</span> : null}
        <AnimatePresence initial={false} mode="popLayout">
          {showRecordsHeaderActionGroup && (
            <motion.div
              key="records-header-actions"
              className="dv-toolbar-pop dv-header-action-group"
              layout
              style={groupedControlRowStyle}
              {...headerControlMotion}
            >
              {showRecordsShareButton && (
                <button
                  type="button"
                  className={`dv-share-button${shareDisabled ? " dv-share-button--disabled" : ""}`}
                  onClick={shareDisabled ? undefined : onShare}
                  aria-disabled={shareDisabled}
                  aria-label={t("dataViewer.shareRecordsLabel")}
                  title={
                    shareDisabled ? "Export in progress — share after it completes" : undefined
                  }
                >
                  <ShareIcon />
                  <span>{t("common.share")}</span>
                </button>
              )}
              {showRecordsRefreshButton && (
                <button
                  type="button"
                  className={`dv-refresh-button${shareDisabled ? " dv-refresh-button--disabled" : ""}`}
                  onClick={shareDisabled ? undefined : onRefreshRecords}
                  aria-disabled={shareDisabled}
                  aria-label={t("common.refresh", { defaultValue: "Refresh" })}
                  title={t("common.refresh", { defaultValue: "Refresh" })}
                >
                  <RefreshIcon
                    className={shareDisabled ? "dv-refresh-button-icon-spin" : undefined}
                  />
                </button>
              )}
              {showRecordsDownloadButton && (
                <button
                  type="button"
                  className={`dv-refresh-button${shareDisabled ? " dv-refresh-button--disabled" : ""}`}
                  onClick={shareDisabled ? undefined : onDownloadRecords}
                  aria-disabled={shareDisabled}
                  aria-label={t("app.downloadExcel", { defaultValue: "Download Excel" })}
                  title={t("app.downloadExcel", { defaultValue: "Download Excel" })}
                >
                  <DownloadIcon />
                </button>
              )}
              {showBuildSettingsButton && (
                <button
                  type="button"
                  className={`dv-refresh-button${shareDisabled ? " dv-refresh-button--disabled" : ""}`}
                  onClick={shareDisabled ? undefined : onOpenBuildSettings}
                  aria-disabled={shareDisabled}
                  aria-label={t("app.saveSettings", { defaultValue: "Save Settings" })}
                  title={t("app.saveSettings", { defaultValue: "Save Settings" })}
                >
                  <SettingsIcon />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="dv-toolbar">
        {hasActiveData && !isMiningTab && (
          <button
            type="button"
            className={`dv-group-button${groupByDay ? " dv-group-button--active" : ""}`}
            onClick={onToggleGroupByDay}
            title={t("dataViewer.groupByDay")}
            aria-pressed={groupByDay}
          >
            <GroupByDayIcon />
            <span>{t("dataViewer.groupByDay")}</span>
          </button>
        )}
        {hasViewSelector && !isMiningTab && <span className="dv-toolbar-separator">·</span>}
        <AnimatePresence initial={false} mode="popLayout">
          {showMiningHeaderControlGroup && (
            <motion.div
              key="mining-header-controls"
              className="dv-toolbar-pop dv-toolbar-control-group"
              layout
              style={groupedControlRowStyle}
              {...headerControlMotion}
            >
              {showMiningTrendsToggle && (
                <button
                  type="button"
                  className={`dv-trends-toggle${showTrends && !trendsExiting ? " dv-trends-toggle--active" : ""}`}
                  onClick={onToggleTrends}
                  aria-pressed={showTrends && !trendsExiting}
                >
                  <TrendsIcon />
                  <span className="trends-label-full">{t("dataViewer.trends")}</span>
                  <span className="trends-label-short">{t("dataViewer.trendsShort")}</span>
                </button>
              )}
              {showMiningTrendsToggle && showMiningViewSelector && (
                <span className="dv-toolbar-separator">·</span>
              )}
              {showMiningViewSelector && (
                <ViewSelector
                  views={currencies}
                  activeKey={currency}
                  onSelect={onSelectMiningCurrency}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {hasActiveData && isEarnTab ? (
          <ViewSelector
            views={earnViews}
            activeKey={effectiveEarnView}
            onSelect={onSelectEarnView}
          />
        ) : hasActiveData && isTxTab && showTxSelector ? (
          <ViewSelector views={txViews} activeKey={effectiveTxView} onSelect={onSelectTxView} />
        ) : hasActiveData && isPurchaseTab ? (
          <ViewSelector
            views={purchaseViews}
            activeKey={effectivePurchaseView}
            onSelect={onSelectPurchaseView}
          />
        ) : hasActiveData && showSimpleSelector ? (
          <ViewSelector
            views={simpleViews}
            activeKey={effectiveSimpleView}
            onSelect={onSelectSimpleView}
          />
        ) : null}
      </div>
    </div>
  );
}
