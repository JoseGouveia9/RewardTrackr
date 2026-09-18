import { useTranslation } from "react-i18next";
import type { MinerWarsComparison } from "@/lib/minerwars/comparison";
import { BtcIcon, FiatIcon, GmtIcon, UsdIcon } from "../icons/currency-icons";
import { AlertTriangleIcon, CalculatorIcon } from "../icons";
import { TargetRing } from "./minerwars-panel-parts";
import { fmtBtc, fmtFiat, fmtGmt, fmtPct } from "./minerwars-panel-view-model";

interface MinerWarsIndividualViewProps {
  data: MinerWarsComparison;
  canSimulate: boolean;
  simulateOpen: boolean;
  onToggleSimulate: () => void;
  effectiveProgress: number | null;
  renderValueIcon: () => React.ReactNode;
  formatBtcValue: (btc: number, histGmt: number | null, histUsd?: number | null) => string;
  effectiveMw: number;
  heroGmt: number | null;
  heroUsd: number | null;
  isActual: boolean;
  projecting: boolean;
  targetGmt: number | null;
  targetUsd: number | null;
  soloEquivBtc: number;
  soloGmt: number | null;
  soloUsd: number | null;
  isPositive: boolean;
  effectiveDiff: number;
  diffGmt: number | null;
  diffUsd: number | null;
  effectiveDiffPct: number | null;
  showGmt: boolean;
  showUsd: boolean;
  showFiat: boolean;
  extraFiatRate: number | null;
  extraFiatCode: string | null;
  maintenancePct: number | null;
  showBtcFundZeroWarning: boolean;
  showZeroedRoundsWarning: boolean;
  zeroedRounds: MinerWarsComparison["zeroedRounds"];
  hintUserEE: NonNullable<MinerWarsComparison["zeroedRoundsHint"]>["userEE"] | null;
  hintLeagueEE: NonNullable<MinerWarsComparison["zeroedRoundsHint"]>["leagueEE"] | null;
  hintBtcPrice: string;
  isCycleLive: boolean;
  showNoClanAnalyticsWarning: boolean;
}

export function MinerWarsIndividualView({
  data,
  canSimulate,
  simulateOpen,
  onToggleSimulate,
  effectiveProgress,
  renderValueIcon,
  formatBtcValue,
  effectiveMw,
  heroGmt,
  heroUsd,
  isActual,
  projecting,
  targetGmt,
  targetUsd,
  soloEquivBtc,
  soloGmt,
  soloUsd,
  isPositive,
  effectiveDiff,
  diffGmt,
  diffUsd,
  effectiveDiffPct,
  showGmt,
  showUsd,
  showFiat,
  extraFiatRate,
  extraFiatCode,
  maintenancePct,
  showBtcFundZeroWarning,
  showZeroedRoundsWarning,
  zeroedRounds,
  hintUserEE,
  hintLeagueEE,
  hintBtcPrice,
  isCycleLive,
  showNoClanAnalyticsWarning,
}: MinerWarsIndividualViewProps) {
  const { t } = useTranslation();

  const personalNetGmt =
    data.personalGmtRewards != null || data.personalBoostCostGmt != null
      ? (data.personalGmtRewards ?? 0) - (data.personalBoostCostGmt ?? 0)
      : null;

  const renderPersonalGmt = (
    gmt: number,
    negative = false,
  ): { icon: React.ReactNode; text: string } => {
    const signed = negative ? -Math.abs(gmt) : gmt;
    if (showUsd && data.gmtPrice != null) {
      return { icon: <UsdIcon />, text: fmtFiat(signed * data.gmtPrice, "USD") };
    }
    if (showFiat && data.gmtPrice != null && extraFiatRate != null && extraFiatCode) {
      return {
        icon: <FiatIcon code={extraFiatCode} />,
        text: fmtFiat(signed * data.gmtPrice * extraFiatRate, extraFiatCode),
      };
    }
    return { icon: <GmtIcon />, text: fmtGmt(signed) };
  };

  const personalGmtDisplay =
    data.personalGmtRewards != null ? renderPersonalGmt(data.personalGmtRewards) : null;
  const personalBoostDisplay =
    data.personalBoostCostGmt != null ? renderPersonalGmt(data.personalBoostCostGmt, true) : null;
  const personalNetDisplay = personalNetGmt != null ? renderPersonalGmt(personalNetGmt) : null;

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
              <TargetRing pct={effectiveProgress} />
              <div className="minerwars-panel-hero-main">
                <span className="minerwars-panel-label">
                  {isActual ? t("cycleTracker.minerWarsActual") : t("cycleTracker.minerWarsEst")}
                  <span className="minerwars-panel-projection-badge">
                    {t("cycleTracker.day", { count: data.targetActualDays })}
                  </span>
                </span>
                <span className="minerwars-panel-hero-value">
                  {renderValueIcon()} {formatBtcValue(effectiveMw, heroGmt, heroUsd)}
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

            {(data.personalGmtRewards != null || data.personalBoostCostGmt != null) && (
              <div className="minerwars-panel-personal-row">
                <div className="minerwars-panel-personal-col minerwars-panel-personal-col--divided">
                  <div className="minerwars-panel-personal-head">
                    <span className="minerwars-panel-personal-label">
                      {t("cycleTracker.personalGmt")}
                    </span>
                  </div>
                  <span className="minerwars-panel-personal-value">
                    {personalGmtDisplay ? (
                      <>
                        {personalGmtDisplay.icon} {personalGmtDisplay.text}
                      </>
                    ) : (
                      "—"
                    )}
                    {data.personalBlocksMined != null && (
                      <span className="minerwars-panel-tag minerwars-panel-personal-tag">
                        {t("cycleTracker.blockShort", { count: data.personalBlocksMined })}
                      </span>
                    )}
                  </span>
                </div>
                <div className="minerwars-panel-personal-col minerwars-panel-personal-col--divided">
                  <div className="minerwars-panel-personal-head">
                    <span className="minerwars-panel-personal-label">
                      {t("cycleTracker.boostCost")}
                    </span>
                  </div>
                  <span className="minerwars-panel-personal-value minerwars-panel-value--neg">
                    {personalBoostDisplay ? (
                      <>
                        {personalBoostDisplay.icon} {personalBoostDisplay.text}
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
                <div className="minerwars-panel-personal-col">
                  <div className="minerwars-panel-personal-head">
                    <span className="minerwars-panel-personal-label">{t("cycleTracker.net")}</span>
                  </div>
                  <span
                    className={`minerwars-panel-personal-value ${personalNetGmt != null && personalNetGmt >= 0 ? "minerwars-panel-value--pos" : "minerwars-panel-value--neg"}`}
                  >
                    {personalNetDisplay ? (
                      <>
                        {personalNetDisplay.icon} {personalNetDisplay.text}
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="minerwars-panel-hero-divider" />

          <div className="minerwars-panel-hero-col-right">
            <div className="minerwars-panel-breakdown">
              <div className="minerwars-panel-row">
                <span className="minerwars-panel-label minerwars-panel-label--sub">
                  {t("cycleTracker.soloEquiv")}
                  <span className="minerwars-panel-projection-badge">
                    {t("cycleTracker.day", { count: data.targetActualDays })}
                  </span>
                </span>
                <span className="minerwars-panel-value">
                  {renderValueIcon()} {formatBtcValue(soloEquivBtc, soloGmt, soloUsd)}
                </span>
              </div>

              <div className="minerwars-panel-row minerwars-panel-row--tags">
                <span className="minerwars-panel-label-col">
                  <span className="minerwars-panel-label minerwars-panel-label--sub">
                    {t("cycleTracker.difference")}
                  </span>
                </span>
                <span className="minerwars-panel-value-col">
                  <span
                    className={`minerwars-panel-value minerwars-panel-value--diff ${isPositive ? "minerwars-panel-value--pos" : "minerwars-panel-value--neg"}`}
                  >
                    {renderValueIcon()}{" "}
                    {(effectiveDiff > 0 ? "+" : "") +
                      formatBtcValue(effectiveDiff, diffGmt, diffUsd)}
                  </span>
                  {effectiveDiffPct != null && (
                    <span className="minerwars-panel-caption">
                      {fmtPct(effectiveDiffPct)} {t("cycleTracker.vsSolo")}
                    </span>
                  )}
                </span>
              </div>

              {data.maintenanceBtc != null && (
                <>
                  <div className="minerwars-panel-divider" />
                  <div className="minerwars-panel-row minerwars-panel-row--tags">
                    <span className="minerwars-panel-label-col">
                      <span className="minerwars-panel-label minerwars-panel-label--sub">
                        {isActual
                          ? t("cycleTracker.maintenance")
                          : t("cycleTracker.maintenanceEst")}
                      </span>
                      {(data.personalDiscountPct != null || !isActual) && (
                        <span className="minerwars-panel-tags-col">
                          {data.personalDiscountPct != null && (
                            <span className="minerwars-panel-tag">
                              <span className="minerwars-panel-tag-label">
                                {t("cycleTracker.personalDiscountLabel")}
                              </span>
                              <span className="minerwars-panel-tag-value">
                                {(data.personalDiscountPct * 100).toFixed(2)}%
                              </span>
                            </span>
                          )}
                          {!isActual && (
                            <span className="minerwars-panel-tag">
                              <span className="minerwars-panel-tag-label">
                                {t("cycleTracker.leagueDiscountSectionLabel")}
                              </span>
                              <span className="minerwars-panel-tag-value">
                                {data.leagueDiscountPct != null
                                  ? `${(data.leagueDiscountPct * 100).toFixed(2)}%`
                                  : "-"}
                              </span>
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                    <span className="minerwars-panel-value-col">
                      <span className="minerwars-panel-value minerwars-panel-value--neg">
                        {showGmt && data.maintenanceGmt != null ? (
                          <>
                            <GmtIcon /> {`-${fmtGmt(data.maintenanceGmt)}`}
                          </>
                        ) : showUsd && data.maintenanceUsd != null ? (
                          <>
                            <UsdIcon /> {`-${fmtFiat(data.maintenanceUsd, "USD")}`}
                          </>
                        ) : showFiat &&
                          data.maintenanceUsd != null &&
                          extraFiatRate != null &&
                          extraFiatCode ? (
                          <>
                            <FiatIcon code={extraFiatCode} />{" "}
                            {`-${fmtFiat(data.maintenanceUsd * extraFiatRate, extraFiatCode)}`}
                          </>
                        ) : (
                          <>
                            <BtcIcon /> {`-${fmtBtc(data.maintenanceBtc)}`}
                          </>
                        )}
                      </span>
                      {maintenancePct != null && (
                        <span className="minerwars-panel-caption">
                          {t("cycleTracker.maintenanceShare", { pct: maintenancePct.toFixed(1) })}
                        </span>
                      )}
                    </span>
                  </div>
                  {data.netBtc != null && (
                    <>
                      <div className="minerwars-panel-divider" />
                      <div className="minerwars-panel-row">
                        <span className="minerwars-panel-label minerwars-panel-label--sub">
                          {isActual ? t("cycleTracker.net") : t("cycleTracker.netEst")}
                          <span className="minerwars-panel-projection-badge">
                            {t("cycleTracker.day", { count: data.targetActualDays })}
                          </span>
                        </span>
                        <span
                          className={`minerwars-panel-value ${(showFiat || showUsd ? (data.netUsd ?? 0) : showGmt ? (data.netGmt ?? 0) : data.netBtc) >= 0 ? "minerwars-panel-value--pos" : "minerwars-panel-value--neg"}`}
                        >
                          {showGmt && data.netGmt != null ? (
                            <>
                              <GmtIcon /> {fmtGmt(data.netGmt)}
                            </>
                          ) : showUsd && data.netUsd != null ? (
                            <>
                              <UsdIcon /> {fmtFiat(data.netUsd, "USD")}
                            </>
                          ) : showFiat &&
                            data.netUsd != null &&
                            extraFiatRate != null &&
                            extraFiatCode ? (
                            <>
                              <FiatIcon code={extraFiatCode} />{" "}
                              {fmtFiat(data.netUsd * extraFiatRate, extraFiatCode)}
                            </>
                          ) : (
                            <>
                              <BtcIcon /> {fmtBtc(data.netBtc)}
                            </>
                          )}
                        </span>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

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
              <details className="minerwars-panel-zeroed-group">
                <summary className="minerwars-panel-zeroed-group-summary">
                  {t("cycleTracker.warnZeroedRoundsGroupUserEE", {
                    count: zeroedRounds.userEE.length,
                  })}
                </summary>
                <ul className="minerwars-panel-zeroed-list">
                  {zeroedRounds.userEE.map((round) => (
                    <li key={round.blockNumber}>
                      {t("cycleTracker.warnZeroedRoundsItem", {
                        blockNumber: round.blockNumber,
                        multiplier: round.multiplier,
                      })}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {zeroedRounds.leagueEE.length > 0 && (
              <details className="minerwars-panel-zeroed-group">
                <summary className="minerwars-panel-zeroed-group-summary">
                  {t("cycleTracker.warnZeroedRoundsGroupLeagueEE", {
                    count: zeroedRounds.leagueEE.length,
                  })}
                </summary>
                <ul className="minerwars-panel-zeroed-list">
                  {zeroedRounds.leagueEE.map((round) => (
                    <li key={round.blockNumber}>
                      {t("cycleTracker.warnZeroedRoundsItem", {
                        blockNumber: round.blockNumber,
                        multiplier: round.multiplier,
                      })}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {hintUserEE && (
              <p className="minerwars-panel-zeroed-hint">
                <strong className="minerwars-panel-zeroed-hint-label">
                  {t("cycleTracker.warnZeroedRoundsHintLabelUserEE")}
                </strong>{" "}
                {hintUserEE.kind === "increaseGmtDiscount"
                  ? t("cycleTracker.warnZeroedRoundsHintGmt", {
                      recommendedGmtPct: hintUserEE.recommendedGmtPct.toString(),
                      btcPrice: hintBtcPrice,
                    })
                  : hintUserEE.kind === "improveEE"
                    ? t("cycleTracker.warnZeroedRoundsHintEE", {
                        recommendedEE: hintUserEE.recommendedEE.toString(),
                        recommendedEEAtMaxGmt: hintUserEE.recommendedEEAtMaxGmt.toString(),
                        currentEE: hintUserEE.currentEE.toString(),
                      })
                    : t("cycleTracker.warnZeroedRoundsHintBtcPrice", {
                        currentGmtPct: hintUserEE.currentGmtPct.toString(),
                        btcPrice: hintBtcPrice,
                      })}
              </p>
            )}
            {hintLeagueEE && (
              <p className="minerwars-panel-zeroed-hint">
                <strong className="minerwars-panel-zeroed-hint-label">
                  {t("cycleTracker.warnZeroedRoundsHintLabelLeagueEE")}
                </strong>{" "}
                {hintLeagueEE.kind === "increaseGmtDiscount"
                  ? t("cycleTracker.warnZeroedRoundsLeagueHintGmt", {
                      recommendedGmtPct: hintLeagueEE.recommendedGmtPct.toString(),
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
