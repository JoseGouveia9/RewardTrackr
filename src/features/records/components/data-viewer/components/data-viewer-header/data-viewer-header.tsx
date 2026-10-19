import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ViewSelector } from "@/features/records/components/view-selector/view-selector";
import {
  BackIcon,
  DownloadIcon,
  GroupByDayIcon,
  RefreshIcon,
  SettingsIcon,
  ShareIcon,
  TrendsIcon,
} from "@/components/icons";
import type { RecordsActions, ViewSelectorConfig } from "../../types";

interface ToggleConfig {
  active: boolean;
  onToggle: () => void;
}

interface DataViewerHeaderProps {
  title: string | null;
  showBackButton: boolean;
  onClose: () => void;
  actions: RecordsActions;
  groupByDay: ToggleConfig | null;
  trendsToggle: ToggleConfig | null;
  currencySelector: ViewSelectorConfig | null;
  tabViewSelector: ViewSelectorConfig | null;
}

const headerControlMotion = {
  initial: { opacity: 0, scale: 0.88, y: -5 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.88, y: -5 },
  transition: { duration: 0.18, ease: "easeOut" as const },
};

const headerLayoutTransition = { duration: 0.18, ease: "easeOut" as const };

function SelectorFor({ config }: { config: ViewSelectorConfig }) {
  return <ViewSelector views={config.views} activeKey={config.active} onSelect={config.onSelect} />;
}

/** Back button, title and action buttons on the left; grouping, trends and view selectors on the right. */
export function DataViewerHeader({
  title,
  showBackButton,
  onClose,
  actions,
  groupByDay,
  trendsToggle,
  currencySelector,
  tabViewSelector,
}: DataViewerHeaderProps) {
  const { t } = useTranslation();
  const { onShare, onRefresh, onDownload, onOpenSettings, disabled = false } = actions;
  const hasActions = Boolean(onShare || onRefresh || onDownload || onOpenSettings);
  const actionClass = `dv-refresh-button${disabled ? " dv-refresh-button--disabled" : ""}`;

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
          {hasActions && (
            <motion.div
              key="records-header-actions"
              className="dv-toolbar-pop dv-header-action-group dv-grouped-control-row"
              layout
              {...headerControlMotion}
            >
              {onShare && (
                <button
                  type="button"
                  className={`dv-share-button${disabled ? " dv-share-button--disabled" : ""}`}
                  onClick={disabled ? undefined : onShare}
                  aria-disabled={disabled}
                  aria-label={t("dataViewer.shareRecordsLabel")}
                  title={disabled ? "Export in progress — share after it completes" : undefined}
                >
                  <ShareIcon />
                  <span>{t("common.share")}</span>
                </button>
              )}
              {onRefresh && (
                <button
                  type="button"
                  className={actionClass}
                  onClick={disabled ? undefined : () => void onRefresh()}
                  aria-disabled={disabled}
                  aria-label={t("common.refresh", { defaultValue: "Refresh" })}
                  title={t("common.refresh", { defaultValue: "Refresh" })}
                >
                  <RefreshIcon className={disabled ? "dv-refresh-button-icon-spin" : undefined} />
                </button>
              )}
              {onDownload && (
                <button
                  type="button"
                  className={actionClass}
                  onClick={disabled ? undefined : () => void onDownload()}
                  aria-disabled={disabled}
                  aria-label={t("app.downloadExcel", { defaultValue: "Download Excel" })}
                  title={t("app.downloadExcel", { defaultValue: "Download Excel" })}
                >
                  <DownloadIcon />
                </button>
              )}
              {onOpenSettings && (
                <button
                  type="button"
                  className={actionClass}
                  onClick={disabled ? undefined : onOpenSettings}
                  aria-disabled={disabled}
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
        {groupByDay && (
          <button
            type="button"
            className={`dv-group-button${groupByDay.active ? " dv-group-button--active" : ""}`}
            onClick={groupByDay.onToggle}
            title={t("dataViewer.groupByDay")}
            aria-pressed={groupByDay.active}
          >
            <GroupByDayIcon />
            <span>{t("dataViewer.groupByDay")}</span>
          </button>
        )}
        {tabViewSelector && <span className="dv-toolbar-separator">·</span>}
        <AnimatePresence initial={false} mode="popLayout">
          {(trendsToggle || currencySelector) && (
            <motion.div
              key="mining-header-controls"
              className="dv-toolbar-pop dv-toolbar-control-group dv-grouped-control-row"
              layout
              {...headerControlMotion}
            >
              {trendsToggle && (
                <button
                  type="button"
                  className={`dv-trends-toggle${trendsToggle.active ? " dv-trends-toggle--active" : ""}`}
                  onClick={trendsToggle.onToggle}
                  aria-pressed={trendsToggle.active}
                >
                  <TrendsIcon />
                  <span className="trends-label-full">{t("dataViewer.trends")}</span>
                  <span className="trends-label-short">{t("dataViewer.trendsShort")}</span>
                </button>
              )}
              {trendsToggle && currencySelector && <span className="dv-toolbar-separator">·</span>}
              {currencySelector && <SelectorFor config={currencySelector} />}
            </motion.div>
          )}
        </AnimatePresence>
        {tabViewSelector && <SelectorFor config={tabViewSelector} />}
      </div>
    </div>
  );
}
