import { useTranslation } from "react-i18next";
import type { MinerWarsPanelViewModel } from "@/features/minerwars/utils/minerwars-panel-view-model";
import { AlertTriangleIcon } from "@/components/icons";

interface ZeroedRoundsGroupProps {
  summary: string;
  rounds: Array<{ blockNumber: number; multiplier: number }>;
}

function ZeroedRoundsGroup({ summary, rounds }: ZeroedRoundsGroupProps) {
  const { t } = useTranslation();
  return (
    <details className="minerwars-panel-zeroed-group">
      <summary className="minerwars-panel-zeroed-group-summary">{summary}</summary>
      <ul className="minerwars-panel-zeroed-list">
        {rounds.map((round) => (
          <li key={round.blockNumber}>
            {t("cycleTracker.warnZeroedRoundsItem", {
              blockNumber: round.blockNumber,
              multiplier: round.multiplier,
            })}
          </li>
        ))}
      </ul>
    </details>
  );
}

interface IndividualWarningsProps {
  viewModel: MinerWarsPanelViewModel;
  isCycleLive: boolean;
}

export function IndividualWarnings({ viewModel, isCycleLive }: IndividualWarningsProps) {
  const {
    showBtcFundZeroWarning,
    showZeroedRoundsWarning,
    zeroedRounds,
    hintUserEnergyEfficiency,
    hintLeagueEnergyEfficiency,
    hintBtcPrice,
    showNoClanAnalyticsWarning,
  } = viewModel;
  const { t } = useTranslation();

  return (
    <>
      {showBtcFundZeroWarning && (
        <div className="minerwars-panel-notice minerwars-panel-notice--warn minerwars-panel-notice--flex">
          <AlertTriangleIcon width={13} height={13} />
          <span className="minerwars-panel-notice-preline">
            {t("cycleTracker.warnBtcFundZero")}
          </span>
        </div>
      )}
      {showZeroedRoundsWarning && zeroedRounds && (
        <div className="minerwars-panel-notice minerwars-panel-notice--warn minerwars-panel-notice--flex">
          <AlertTriangleIcon width={13} height={13} />
          <span>
            {t("cycleTracker.warnZeroedRounds")}
            {zeroedRounds.userEE.length > 0 && (
              <ZeroedRoundsGroup
                summary={t("cycleTracker.warnZeroedRoundsGroupUserEE", {
                  count: zeroedRounds.userEE.length,
                })}
                rounds={zeroedRounds.userEE}
              />
            )}
            {zeroedRounds.leagueEE.length > 0 && (
              <ZeroedRoundsGroup
                summary={t("cycleTracker.warnZeroedRoundsGroupLeagueEE", {
                  count: zeroedRounds.leagueEE.length,
                })}
                rounds={zeroedRounds.leagueEE}
              />
            )}
            {hintUserEnergyEfficiency && (
              <p className="minerwars-panel-zeroed-hint">
                <strong className="minerwars-panel-zeroed-hint-label">
                  {t("cycleTracker.warnZeroedRoundsHintLabelUserEE")}
                </strong>{" "}
                {hintUserEnergyEfficiency.kind === "increaseGmtDiscount"
                  ? t("cycleTracker.warnZeroedRoundsHintGmt", {
                      recommendedGmtPct: hintUserEnergyEfficiency.recommendedGmtPct.toString(),
                      btcPrice: hintBtcPrice,
                    })
                  : hintUserEnergyEfficiency.kind === "improveEE"
                    ? t("cycleTracker.warnZeroedRoundsHintEE", {
                        recommendedEE: hintUserEnergyEfficiency.recommendedEE.toString(),
                        recommendedEEAtMaxGmt:
                          hintUserEnergyEfficiency.recommendedEEAtMaxGmt.toString(),
                        currentEE: hintUserEnergyEfficiency.currentEE.toString(),
                      })
                    : t("cycleTracker.warnZeroedRoundsHintBtcPrice", {
                        currentGmtPct: hintUserEnergyEfficiency.currentGmtPct.toString(),
                        btcPrice: hintBtcPrice,
                      })}
              </p>
            )}
            {hintLeagueEnergyEfficiency && (
              <p className="minerwars-panel-zeroed-hint">
                <strong className="minerwars-panel-zeroed-hint-label">
                  {t("cycleTracker.warnZeroedRoundsHintLabelLeagueEE")}
                </strong>{" "}
                {hintLeagueEnergyEfficiency.kind === "increaseGmtDiscount"
                  ? t("cycleTracker.warnZeroedRoundsLeagueHintGmt", {
                      recommendedGmtPct: hintLeagueEnergyEfficiency.recommendedGmtPct.toString(),
                      btcPrice: hintBtcPrice,
                    })
                  : t("cycleTracker.warnZeroedRoundsLeagueHintBtcPrice", {
                      btcPrice: hintBtcPrice,
                    })}
              </p>
            )}
          </span>
        </div>
      )}
      {showNoClanAnalyticsWarning && (
        <div className="minerwars-panel-notice minerwars-panel-notice--warn minerwars-panel-notice--flex">
          <AlertTriangleIcon width={13} height={13} />
          <span>
            {isCycleLive
              ? t("cycleTracker.warnNoClanAnalyticsLive")
              : t("cycleTracker.warnNoClanAnalyticsDone")}
          </span>
        </div>
      )}
    </>
  );
}
