import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ErrorBoundary } from "@/components/error-boundary/error-boundary";
import { SheetSelector } from "../sheet-selector/sheet-selector";
import { ExportOptions } from "../export-options/export-options";
import type { ExportConfig } from "../../hooks/use-export-config";
import type { CacheState } from "@/types/rewards";
import { LAYOUT_SPRING } from "@/lib/motion";
import { StatusMessage } from "@/components/status-message/status-message";
import { FileBarChartIcon, TableIcon, TrashIcon } from "@/components/icons";

interface BuildFlow {
  loading: boolean;
  message: string;
  onExport: () => Promise<void>;
  onClearCache: () => void;
  onCloseMessage: () => void;
}

interface BuildScreenProps {
  config: ExportConfig;
  cache: CacheState;
  hasCachedSheets: boolean;
  liveMinerWars: { enabled: boolean; onToggle: (enabled: boolean) => void };
  buildFlow: BuildFlow;
}

export function BuildScreen({
  config,
  cache,
  hasCachedSheets,
  liveMinerWars,
  buildFlow,
}: BuildScreenProps) {
  const { loading, message, onExport, onClearCache, onCloseMessage } = buildFlow;
  const { t } = useTranslation();
  const { selectedKeys } = config;
  const cachedCount = selectedKeys.filter((key) => cache[key]).length;
  const primaryBuildCallToActionLabel = hasCachedSheets
    ? t("app.saveSettings", { defaultValue: "Save Settings" })
    : t("app.buildReport");

  return (
    <ErrorBoundary>
      <motion.section className="panel-glass" layout transition={LAYOUT_SPRING}>
        <div className="actions-header">
          <h3>
            <TableIcon className="section-icon" />
            {t("app.selectSheets")}
          </h3>
          {hasCachedSheets && (
            <button className="btn-danger btn-danger-small" onClick={onClearCache}>
              <TrashIcon />
              {t("app.clearCache")}
            </button>
          )}
        </div>
        <SheetSelector
          cache={cache}
          onToggleGroup={config.toggleGroup}
          onToggleAll={config.toggleAll}
          isGroupSelected={config.isGroupSelected}
        />
      </motion.section>

      <ExportOptions config={config} liveMinerWars={liveMinerWars} />

      <motion.section className="export-section panel-glass" layout transition={LAYOUT_SPRING}>
        <div className="export-meta-row">
          {cachedCount > 0 && cachedCount < selectedKeys.length && (
            <p className="subtle">
              {t("app.sheetsToFetch", {
                fetch: selectedKeys.length - cachedCount,
                stored: cachedCount,
              })}
            </p>
          )}
          {cachedCount === selectedKeys.length && selectedKeys.length > 0 && (
            <p className="subtle">{t("app.allSheetsStored")}</p>
          )}
          <p className="export-limit-notice">{t("app.maxExportsPerDay", { max: 3 })}</p>
        </div>
        <div className="export-button-wrapper">
          <button
            className="btn-primary btn-primary-large"
            disabled={loading || selectedKeys.length === 0}
            onClick={() => {
              void onExport();
            }}
          >
            {loading ? (
              t("app.processing")
            ) : (
              <>
                <FileBarChartIcon className="btn-icon" />
                {primaryBuildCallToActionLabel}
              </>
            )}
          </button>
        </div>
      </motion.section>

      <StatusMessage message={message} onClose={onCloseMessage} keyPrefix="main-message" />
    </ErrorBoundary>
  );
}
