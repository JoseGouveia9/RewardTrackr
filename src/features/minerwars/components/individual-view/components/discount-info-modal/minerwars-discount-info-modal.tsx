import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { CloseIcon } from "@/components/icons";

interface MinerWarsDiscountInfoModalProps {
  open: boolean;
  personalDiscountPercent: number | null;
  rewardDistributionDiscountPercent: number | null;
  leagueDiscountPercent: number | null;
  onClose: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function MinerWarsDiscountInfoModal({
  open,
  personalDiscountPercent,
  rewardDistributionDiscountPercent,
  leagueDiscountPercent,
  onClose,
  containerRef,
}: MinerWarsDiscountInfoModalProps) {
  const { t } = useTranslation();

  if (!open) return null;

  const soloDiscountPercent =
    personalDiscountPercent != null
      ? `${((personalDiscountPercent + (rewardDistributionDiscountPercent ?? 0)) * 100).toFixed(2)}%`
      : "-";

  return createPortal(
    <div className="minerwars-panel-simulate-overlay">
      <div className="minerwars-panel-simulate" ref={containerRef} role="dialog" aria-modal="true">
        <div className="minerwars-panel-simulate-header">
          <span className="minerwars-panel-simulate-title">
            {t("cycleTracker.maintenanceDiscountInfoTitle")}
          </span>
          <button
            type="button"
            className="minerwars-panel-simulate-close"
            onClick={onClose}
            aria-label={t("cycleTracker.simulateClose")}
          >
            <CloseIcon width={14} height={14} />
          </button>
        </div>
        <div className="minerwars-panel-simulate-body">
          <p className="minerwars-panel-simulate-hint">
            {t("cycleTracker.maintenanceDiscountInfoDesc")}
          </p>

          <div className="minerwars-panel-compare-header-row minerwars-panel-compare-header-row--modal">
            <span className="minerwars-panel-compare-value-col">
              <span className="minerwars-panel-compare-header-text">{t("cycleTracker.solo")}</span>
            </span>
            <span className="minerwars-panel-compare-value-col">
              <span className="minerwars-panel-compare-header-text">
                {t("cycleTracker.minerWarsColumn")}
              </span>
            </span>
          </div>

          <div className="minerwars-panel-compare-row">
            <span className="minerwars-panel-compare-value-col">
              <span className="minerwars-panel-tags-col minerwars-panel-tags-col--center">
                <span className="minerwars-panel-tag">
                  <span className="minerwars-panel-tag-label">
                    {t("cycleTracker.personalDiscountLabel")}
                  </span>
                  <span className="minerwars-panel-tag-value">{soloDiscountPercent}</span>
                </span>
              </span>
            </span>
            <span className="minerwars-panel-compare-value-col">
              <span className="minerwars-panel-tags-col minerwars-panel-tags-col--center">
                {personalDiscountPercent != null && (
                  <span className="minerwars-panel-tag">
                    <span className="minerwars-panel-tag-label">
                      {t("cycleTracker.personalDiscountLabel")}
                    </span>
                    <span className="minerwars-panel-tag-value">
                      {(personalDiscountPercent * 100).toFixed(2)}%
                    </span>
                  </span>
                )}
                <span className="minerwars-panel-tag">
                  <span className="minerwars-panel-tag-label">
                    {t("cycleTracker.leagueDiscountSectionLabel")}
                  </span>
                  <span className="minerwars-panel-tag-value">
                    {leagueDiscountPercent != null
                      ? `${(leagueDiscountPercent * 100).toFixed(2)}%`
                      : "-"}
                  </span>
                </span>
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
