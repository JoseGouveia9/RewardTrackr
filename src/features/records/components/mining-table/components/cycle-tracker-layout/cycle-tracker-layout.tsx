import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { useCycleTracker } from "../../hooks/use-cycle-tracker";
import { MinerWarsIcon, RecordsIcon, ShareIcon } from "@/components/icons";
import { MinerWarsComparisonPanel } from "@/features/minerwars/components/comparison-panel/minerwars-comparison-panel";
import { MinerWarsShareModal } from "@/features/minerwars/components/share-modal/minerwars-share-modal";

export function CycleTrackerLayout({
  tracker,
  cacheVersion,
  isPrefetching,
  extraFiatCode,
  shareDisabled,
  children,
}: {
  tracker: ReturnType<typeof useCycleTracker>;
  cacheVersion: number;
  isPrefetching: boolean;
  extraFiatCode: string | null;
  shareDisabled: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { active, show } = tracker;
  const shareBlocked = shareDisabled || !tracker.shareSnapshot || tracker.busy;

  return (
    <>
      {active && (
        <div className="dv-minerwars-toolbar">
          <button
            type="button"
            className={`dv-minerwars-toggle-btn${show ? " dv-minerwars-toggle-btn--active" : ""}`}
            onClick={tracker.toggle}
          >
            {show ? <RecordsIcon /> : <MinerWarsIcon />}
            {show ? `${t("tabs.minerWars")} ${t("common.records")}` : t("cycleTracker.title")}
          </button>
          {show && (
            <button
              type="button"
              className={`dv-minerwars-share-btn${shareBlocked ? " dv-minerwars-share-btn--disabled" : ""}`}
              onClick={shareBlocked ? undefined : () => tracker.setShareOpen(true)}
              aria-label={t("dataViewer.shareRecordsLabel")}
              title={t("common.share")}
              aria-disabled={shareBlocked}
            >
              <ShareIcon />
            </button>
          )}
        </div>
      )}
      {active ? (
        <div className="dv-minerwars-slider-viewport">
          <div
            className={`dv-minerwars-slider-track${show ? " dv-minerwars-slider-track--open" : ""}`}
          >
            <div className="dv-minerwars-slider-pane">{children}</div>
            <div className="dv-minerwars-slider-pane">
              {tracker.mounted && (
                <MinerWarsComparisonPanel
                  cacheVersion={cacheVersion}
                  currency={tracker.trackerCurrency}
                  onCurrencyChange={tracker.setTrackerCurrency}
                  extraFiatCode={extraFiatCode}
                  isPrefetching={isPrefetching}
                  onShareSnapshotChange={tracker.setShareSnapshot}
                  onBusyChange={tracker.setBusy}
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        children
      )}
      <MinerWarsShareModal
        open={tracker.shareOpen}
        snapshot={tracker.shareSnapshot}
        onClose={() => tracker.setShareOpen(false)}
      />
    </>
  );
}
