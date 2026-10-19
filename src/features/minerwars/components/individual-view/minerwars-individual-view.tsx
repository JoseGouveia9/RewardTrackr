import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MinerWarsComparison } from "@/features/minerwars/utils/comparison";
import type { MinerWarsPanelViewModel } from "@/features/minerwars/utils/minerwars-panel-view-model";
import { useOutsideClick } from "@/hooks/use-outside-click";
import { CalculatorIcon } from "@/components/icons";
import { TargetRing } from "../ring/ring";
import { MinerWarsDiscountInfoModal } from "./components/discount-info-modal/minerwars-discount-info-modal";
import { CompletedBreakdown } from "./components/completed-breakdown/completed-breakdown";
import { IndividualWarnings } from "./components/individual-warnings/individual-warnings";
import { LiveCompareTable } from "./components/live-compare-table/live-compare-table";
import { PersonalRewardsRow } from "./components/personal-rewards-row/personal-rewards-row";

interface MinerWarsIndividualViewProps {
  data: MinerWarsComparison;
  viewModel: MinerWarsPanelViewModel;
  simulation: { canSimulate: boolean; simulateOpen: boolean; toggleSimulate: () => void };
  isCycleLive: boolean;
}

/** Hero card (progress, solo target, breakdown) plus warnings for the selected cycle. */
export function MinerWarsIndividualView({
  data,
  viewModel,
  simulation,
  isCycleLive,
}: MinerWarsIndividualViewProps) {
  const { canSimulate, simulateOpen, toggleSimulate: onToggleSimulate } = simulation;
  const {
    effectiveProgress,
    renderValueIcon,
    formatBtcValue,
    effectiveMinerWars,
    heroGmt,
    heroUsd,
    isActual,
    projecting,
    targetGmt,
    targetUsd,
  } = viewModel;
  const { t } = useTranslation();

  const [discountInfoOpen, setDiscountInfoOpen] = useState(false);
  const discountInfoRef = useRef<HTMLDivElement>(null);
  useOutsideClick(discountInfoRef, () => setDiscountInfoOpen(false), discountInfoOpen);

  return (
    <>
      <div className="minerwars-panel-hero-card">
        <div className="minerwars-panel-hero-grid">
          <div
            className={`minerwars-panel-hero-col-left${canSimulate ? " minerwars-panel-hero-col-left--with-tools" : ""}`}
          >
            {canSimulate && (
              <div className="minerwars-panel-hero-tools">
                <button
                  type="button"
                  className={`minerwars-panel-simulate-btn${simulateOpen ? " minerwars-panel-simulate-btn--active" : ""}`}
                  onClick={onToggleSimulate}
                  title={t("cycleTracker.simulate")}
                  aria-label={t("cycleTracker.simulate")}
                >
                  <CalculatorIcon />
                </button>
              </div>
            )}
            <div className="minerwars-panel-hero-row">
              <TargetRing percent={effectiveProgress} classPrefix="minerwars-panel" />
              <div className="minerwars-panel-hero-main">
                <span className="minerwars-panel-label">
                  {isActual ? t("cycleTracker.minerWarsActual") : t("cycleTracker.minerWarsEst")}
                  <span className="minerwars-panel-projection-badge">
                    {t("cycleTracker.day", { count: data.targetActualDays })}
                  </span>
                </span>
                <span className="minerwars-panel-hero-value">
                  {renderValueIcon()} {formatBtcValue(effectiveMinerWars, heroGmt, heroUsd)}
                </span>
              </div>
            </div>

            <div className="minerwars-panel-target-block">
              <div className="minerwars-panel-row">
                <span className="minerwars-panel-label">
                  {t("cycleTracker.soloTarget")}
                  {projecting && (
                    <span className="minerwars-panel-projection-badge">
                      {t("cycleTracker.day", { count: data.targetActualDays })} +{" "}
                      {data.targetProjectedDays} {t("cycleTracker.projected")}
                    </span>
                  )}
                </span>
              </div>
              <div className="minerwars-panel-target-value-row">
                <span className="minerwars-panel-target-value">
                  {renderValueIcon()}{" "}
                  {formatBtcValue(data.targetSoloSats / 1e8, targetGmt, targetUsd)}
                </span>
              </div>
              <div className="minerwars-panel-progress-bar" aria-hidden="true">
                <div
                  className={`minerwars-panel-progress-fill${(effectiveProgress ?? 0) > 100 ? " minerwars-panel-progress-fill--over" : ""}`}
                  style={{ width: `${Math.max(0, Math.min(100, effectiveProgress ?? 0))}%` }}
                />
              </div>
            </div>

            <PersonalRewardsRow data={data} viewModel={viewModel} />
          </div>

          <div className="minerwars-panel-hero-divider" />

          <div className="minerwars-panel-hero-col-right">
            <div className="minerwars-panel-breakdown">
              {isActual ? (
                <CompletedBreakdown data={data} viewModel={viewModel} />
              ) : (
                <LiveCompareTable
                  data={data}
                  viewModel={viewModel}
                  onOpenDiscountInfo={() => setDiscountInfoOpen(true)}
                />
              )}
            </div>
          </div>
        </div>

        {!isActual && (
          <MinerWarsDiscountInfoModal
            open={discountInfoOpen}
            personalDiscountPercent={data.personalDiscountPct}
            rewardDistributionDiscountPercent={data.rewardDistributionDiscountPct}
            leagueDiscountPercent={data.leagueDiscountPct}
            onClose={() => setDiscountInfoOpen(false)}
            containerRef={discountInfoRef}
          />
        )}
      </div>

      <IndividualWarnings viewModel={viewModel} isCycleLive={isCycleLive} />
    </>
  );
}
