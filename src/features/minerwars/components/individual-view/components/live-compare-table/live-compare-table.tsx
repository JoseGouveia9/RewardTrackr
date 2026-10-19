import { useTranslation } from "react-i18next";
import type { MinerWarsComparison } from "@/features/minerwars/utils/comparison";
import { InfoIcon } from "@/components/icons";
import { formatMultiplier } from "@/features/minerwars/utils/format";
import type { MinerWarsPanelViewModel } from "@/features/minerwars/utils/minerwars-panel-view-model";

interface LiveCompareTableProps {
  data: MinerWarsComparison;
  viewModel: MinerWarsPanelViewModel;
  onOpenDiscountInfo: () => void;
}

export function LiveCompareTable({ data, viewModel, onOpenDiscountInfo }: LiveCompareTableProps) {
  const {
    renderValueIcon,
    formatBtcValue,
    soloEquivBtc,
    soloGmt,
    soloUsd,
    effectiveMinerWars,
    heroGmt,
    heroUsd,
    effectiveDiff: effectiveDifference,
    diffGmt: differenceGmt,
    diffUsd: differenceUsd,
    maintenancePercent,
  } = viewModel;
  const { t } = useTranslation();

  const netValue = data.netBtc ?? effectiveDifference;
  const netIsPositive = netValue >= 0;
  const soloNetIsPositive = data.soloNetBtc != null ? data.soloNetBtc >= 0 : null;

  return (
    <>
      <div className="minerwars-panel-compare-header-row">
        <span className="minerwars-panel-compare-label-col" />
        <span className="minerwars-panel-compare-value-col">
          <span className="minerwars-panel-compare-header-text">{t("cycleTracker.solo")}</span>
        </span>
        <span className="minerwars-panel-compare-value-col minerwars-panel-compare-value-col--right">
          <span className="minerwars-panel-compare-header-text minerwars-panel-compare-header-text--right">
            {t("cycleTracker.minerWarsColumn")}
          </span>
        </span>
      </div>

      <div className="minerwars-panel-compare-row">
        <span className="minerwars-panel-compare-label-col">
          <span className="minerwars-panel-label minerwars-panel-label--sub">
            {t("cycleTracker.gross")}
            <span className="minerwars-panel-projection-badge">
              {t("cycleTracker.day", { count: data.targetActualDays })}
            </span>
          </span>
        </span>
        <span className="minerwars-panel-compare-value-col">
          <span className="minerwars-panel-compare-value">
            {renderValueIcon()} {formatBtcValue(soloEquivBtc, soloGmt, soloUsd)}
          </span>
        </span>
        <span className="minerwars-panel-compare-value-col minerwars-panel-compare-value-col--right">
          <span className="minerwars-panel-compare-value">
            {renderValueIcon()} {formatBtcValue(effectiveMinerWars, heroGmt, heroUsd)}
          </span>
          {formatMultiplier(effectiveMinerWars, soloEquivBtc) != null && (
            <span className="minerwars-panel-compare-badge">
              {formatMultiplier(effectiveMinerWars, soloEquivBtc)} {t("cycleTracker.vsSolo")}
            </span>
          )}
        </span>
      </div>

      <div className="minerwars-panel-divider" />

      <div className="minerwars-panel-compare-row">
        <span className="minerwars-panel-compare-label-col">
          <span className="minerwars-panel-label minerwars-panel-label--sub">
            {t("cycleTracker.maintenanceEst")}
            <button
              type="button"
              className="minerwars-panel-info-btn"
              onClick={onOpenDiscountInfo}
              aria-label={t("cycleTracker.maintenanceDiscountInfoTitle")}
            >
              <InfoIcon width={13} height={13} />
            </button>
          </span>
        </span>
        <span className="minerwars-panel-compare-value-col">
          <span className="minerwars-panel-compare-value minerwars-panel-value--neg">
            {data.soloMaintenanceBtc != null ? (
              <>
                {renderValueIcon()}{" "}
                {`-${formatBtcValue(data.soloMaintenanceBtc, data.soloMaintenanceGmt, data.soloMaintenanceUsd)}`}
              </>
            ) : (
              "\u2014"
            )}
          </span>
        </span>
        <span className="minerwars-panel-compare-value-col minerwars-panel-compare-value-col--right">
          <span className="minerwars-panel-compare-value minerwars-panel-value--neg">
            {renderValueIcon()}{" "}
            {`-${formatBtcValue(data.maintenanceBtc ?? 0, data.maintenanceGmt, data.maintenanceUsd)}`}
          </span>
          {maintenancePercent != null && (
            <span className="minerwars-panel-compare-badge">
              {t("cycleTracker.maintenanceShareShort", { pct: maintenancePercent.toFixed(1) })}
            </span>
          )}
        </span>
      </div>

      <div className="minerwars-panel-divider" />

      <div className="minerwars-panel-compare-row">
        <span className="minerwars-panel-compare-label-col">
          <span className="minerwars-panel-label minerwars-panel-label--sub">
            {t("cycleTracker.netEst")}
            <span className="minerwars-panel-projection-badge">
              {t("cycleTracker.day", { count: data.targetActualDays })}
            </span>
          </span>
        </span>
        <span className="minerwars-panel-compare-value-col">
          <span
            className={`minerwars-panel-compare-value ${soloNetIsPositive == null ? "" : soloNetIsPositive ? "minerwars-panel-value--pos" : "minerwars-panel-value--neg"}`}
          >
            {data.soloNetBtc != null ? (
              <>
                {renderValueIcon()}{" "}
                {formatBtcValue(data.soloNetBtc, data.soloNetGmt, data.soloNetUsd)}
              </>
            ) : (
              "\u2014"
            )}
          </span>
        </span>
        <span className="minerwars-panel-compare-value-col minerwars-panel-compare-value-col--right">
          <span
            className={`minerwars-panel-compare-value ${netIsPositive ? "minerwars-panel-value--pos" : "minerwars-panel-value--neg"}`}
          >
            {data.netBtc != null ? (
              <>
                {renderValueIcon()} {formatBtcValue(data.netBtc, data.netGmt, data.netUsd)}
              </>
            ) : (
              <>
                {renderValueIcon()}{" "}
                {formatBtcValue(effectiveDifference, differenceGmt, differenceUsd)}
              </>
            )}
          </span>
          {formatMultiplier(data.netBtc ?? netValue, data.soloNetBtc) != null && (
            <span className="minerwars-panel-compare-badge">
              {formatMultiplier(data.netBtc ?? netValue, data.soloNetBtc)}{" "}
              {t("cycleTracker.vsSolo")}
            </span>
          )}
        </span>
      </div>
    </>
  );
}
