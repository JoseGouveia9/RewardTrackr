import { useTranslation } from "react-i18next";
import type { MinerWarsComparison } from "@/features/minerwars/utils/comparison";
import { readIndividualTrendPoints } from "@/features/minerwars/utils/individual-trend";
import { BtcIcon, FiatIcon, GmtIcon, UsdIcon } from "@/components/icons/currency-icons";
import { UserAvatarIcon } from "@/components/icons";
import { formatGmt } from "@/features/minerwars/utils/format";
import { personalNetGmt } from "@/features/minerwars/utils/comparison-metrics";
import { MinerWarsLineTrend } from "@/features/minerwars/components/line-trend/minerwars-line-trend";
import type {
  MinerWarsIndividualCurrencyMode,
  MinerWarsShareSnapshot,
} from "@/features/minerwars/types/share-types";
import { formatFiatRounded } from "../../utils/format";
import { IndividualBreakdown } from "../individual-breakdown/individual-breakdown";
import { getIndividualShareValues } from "../../utils/individual-values";
import { ShareRing } from "../share-ring/share-ring";

interface IndividualSnapshotProps {
  snapshot: MinerWarsShareSnapshot;
  comparison: MinerWarsComparison;
  individualMode: MinerWarsIndividualCurrencyMode;
  showTrendChart: boolean;
  showPersonalRow: boolean;
  light: boolean;
}

export function IndividualSnapshot({
  snapshot,
  comparison,
  individualMode,
  showTrendChart,
  showPersonalRow,
  light,
}: IndividualSnapshotProps) {
  const { t } = useTranslation();
  const extraCode = snapshot.extraFiatCode;
  const extraRate = snapshot.extraFiatRate;

  const isActual = comparison.actualMinerWarsBtc != null;
  const values = getIndividualShareValues(comparison, individualMode, extraRate);
  const { effectiveMinerWars, formatValue, progressPercent } = values;

  const valueIcon =
    individualMode === "gmt" ? (
      <GmtIcon />
    ) : individualMode === "usd" ? (
      <UsdIcon />
    ) : individualMode === "extra" ? (
      <FiatIcon code={extraCode ?? "USD"} />
    ) : (
      <BtcIcon />
    );

  const projecting = (comparison.targetProjectedDays ?? 0) > 0;
  const daysLabel = t("cycleTracker.day", { count: comparison.targetActualDays });
  const projectedLabel = projecting
    ? `${daysLabel} + ${comparison.targetProjectedDays} ${t("cycleTracker.projected")}`
    : daysLabel;

  const allCycles = snapshot.cycles ?? [];
  const newestCycleId = allCycles.reduce(
    (max, cycle) => Math.max(max, cycle.cycleId),
    snapshot.selectedCycleId ?? 0,
  );
  const trendPoints =
    newestCycleId > 0
      ? readIndividualTrendPoints(allCycles, newestCycleId, comparison).slice(-15)
      : [];
  const trendLabels = trendPoints.map((point) => `#${point.cycleId}`);
  const trendProgressPercent = trendPoints.map((point) => point.progressPercent ?? 0);

  const netGmt = personalNetGmt(comparison);

  const renderPersonalGmt = (gmt: number): { icon: React.ReactNode; text: string } => {
    if (!isActual && individualMode === "usd" && comparison.gmtPrice != null) {
      return { icon: <UsdIcon />, text: formatFiatRounded(gmt * comparison.gmtPrice) };
    }
    if (
      !isActual &&
      individualMode === "extra" &&
      comparison.gmtPrice != null &&
      extraRate != null
    ) {
      return {
        icon: <FiatIcon code={extraCode ?? "USD"} />,
        text: formatFiatRounded(gmt * comparison.gmtPrice * extraRate),
      };
    }
    return { icon: <GmtIcon />, text: formatGmt(gmt) };
  };
  const gmtDisplay =
    comparison.personalGmtRewards != null ? renderPersonalGmt(comparison.personalGmtRewards) : null;
  const boostDisplay =
    comparison.personalBoostCostGmt != null
      ? renderPersonalGmt(-Math.abs(comparison.personalBoostCostGmt))
      : null;
  const netDisplay = netGmt != null ? renderPersonalGmt(netGmt) : null;

  return (
    <div className="mwpc-section">
      <div className="mwpc-section-header">
        <div className="mwpc-section-title-wrap">
          <UserAvatarIcon size={18} color="#f7931a" />
          <span className="mwpc-section-title">
            {t("minerwars.individual", { defaultValue: "Individual" })}
          </span>
        </div>
      </div>

      <div className="mwpc-ind-card">
        <div className="mwpc-ind-split">
          <div className="mwpc-ind-left">
            <div className="mwpc-ind-hero-row">
              <ShareRing percent={progressPercent} light={light} />
              <div className="mwpc-ind-hero-main">
                <div className="mwpc-ind-hero-label-row">
                  <span className="mwpc-ind-hero-label">
                    {isActual ? t("cycleTracker.minerWarsActual") : t("cycleTracker.minerWarsEst")}
                  </span>
                  <span className="mwpc-tag">{daysLabel}</span>
                </div>
                <div className="mwpc-ind-hero-value-row">
                  <span className="mwpc-cicon">{valueIcon}</span>
                  <span className="mwpc-ind-hero-value">
                    {formatValue(
                      effectiveMinerWars,
                      comparison.minerWarsGmt,
                      comparison.minerWarsUsd,
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="mwpc-ind-target-block">
              <div className="mwpc-target-header-inline">
                <span className="mwpc-stat-label">{t("cycleTracker.soloTarget")}</span>
                <span className="mwpc-tag">{projectedLabel}</span>
              </div>
              <div className="mwpc-target-value-row">
                <span className="mwpc-cicon">{valueIcon}</span>
                <span className="mwpc-target-value">
                  {formatValue(comparison.targetSoloSats / 1e8, comparison.targetSoloGmt, null)}
                </span>
              </div>
              <div className="mwpc-target-bar">
                <div
                  className="mwpc-target-bar-fill"
                  style={{
                    width: `${Math.max(0, Math.min(100, progressPercent ?? 0)).toFixed(1)}%`,
                  }}
                />
              </div>
            </div>

            {showPersonalRow &&
              (comparison.personalGmtRewards != null ||
                comparison.personalBoostCostGmt != null) && (
                <div className="mwpc-personal-row">
                  <div className="mwpc-personal-col mwpc-personal-col--divided">
                    <div className="mwpc-personal-head">
                      <span className="mwpc-personal-label">{t("cycleTracker.personalGmt")}</span>
                    </div>
                    <span className="mwpc-personal-value">
                      {gmtDisplay ? (
                        <>
                          {gmtDisplay.icon} {gmtDisplay.text}
                        </>
                      ) : (
                        "—"
                      )}
                      {comparison.personalBlocksMined != null && (
                        <span className="mwpc-tag mwpc-personal-tag">
                          {t("cycleTracker.blockShort", { count: comparison.personalBlocksMined })}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="mwpc-personal-col mwpc-personal-col--divided">
                    <div className="mwpc-personal-head">
                      <span className="mwpc-personal-label">{t("cycleTracker.boostCost")}</span>
                    </div>
                    <span className="mwpc-personal-value mwpc-neg">
                      {boostDisplay ? (
                        <>
                          {boostDisplay.icon} {boostDisplay.text}
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>
                  <div className="mwpc-personal-col">
                    <div className="mwpc-personal-head">
                      <span className="mwpc-personal-label">{t("cycleTracker.net")}</span>
                    </div>
                    <span
                      className={`mwpc-personal-value ${netGmt != null && netGmt >= 0 ? "mwpc-pos" : "mwpc-neg"}`}
                    >
                      {netDisplay ? (
                        <>
                          {netDisplay.icon} {netDisplay.text}
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>
                </div>
              )}
          </div>

          <div className="mwpc-ind-vdivider" />

          <div className="mwpc-ind-right">
            <IndividualBreakdown
              comparison={comparison}
              isActual={isActual}
              values={values}
              valueIcon={valueIcon}
              daysLabel={daysLabel}
            />
          </div>
        </div>
      </div>

      {showTrendChart && (
        <div className="mwpc-line-trend-row">
          <MinerWarsLineTrend
            title="vs Target trend"
            values={trendProgressPercent}
            labels={trendLabels}
            suffix="%"
            pointSuffix="%"
            light={light}
          />
        </div>
      )}
    </div>
  );
}
