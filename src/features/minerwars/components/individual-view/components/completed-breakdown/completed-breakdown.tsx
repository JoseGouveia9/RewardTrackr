import { useTranslation } from "react-i18next";
import type { MinerWarsComparison } from "@/features/minerwars/utils/comparison";
import { CurrencyAmount } from "@/features/minerwars/components/currency-amount/currency-amount";
import { formatPercent } from "@/features/minerwars/utils/format";
import type { MinerWarsPanelViewModel } from "@/features/minerwars/utils/minerwars-panel-view-model";

interface CompletedBreakdownProps {
  data: MinerWarsComparison;
  viewModel: MinerWarsPanelViewModel;
}

export function CompletedBreakdown({ data, viewModel }: CompletedBreakdownProps) {
  const {
    renderValueIcon,
    formatBtcValue,
    soloEquivBtc,
    soloGmt,
    soloUsd,
    isPositive,
    effectiveDiff: effectiveDifference,
    diffGmt: differenceGmt,
    diffUsd: differenceUsd,
    effectiveDifferencePercent,
    showGmt,
    showUsd,
    showFiat,
    extraFiatRate,
    extraFiatCode,
    maintenancePercent,
  } = viewModel;
  const { t } = useTranslation();
  const currencyFlags = { showGmt, showUsd, showFiat, extraFiatRate, extraFiatCode };

  return (
    <>
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
            {(effectiveDifference > 0 ? "+" : "") +
              formatBtcValue(effectiveDifference, differenceGmt, differenceUsd)}
          </span>
          {effectiveDifferencePercent != null && (
            <span className="minerwars-panel-caption">
              {formatPercent(effectiveDifferencePercent)} {t("cycleTracker.vsSolo")}
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
                {t("cycleTracker.maintenance")}
              </span>
            </span>
            <span className="minerwars-panel-value-col">
              <span className="minerwars-panel-value minerwars-panel-value--neg">
                <CurrencyAmount
                  btc={data.maintenanceBtc}
                  gmt={data.maintenanceGmt}
                  usd={data.maintenanceUsd}
                  prefix="-"
                  {...currencyFlags}
                />
              </span>
              {maintenancePercent != null && (
                <span className="minerwars-panel-caption">
                  {t("cycleTracker.maintenanceShare", { pct: maintenancePercent.toFixed(1) })}
                </span>
              )}
            </span>
          </div>
          {data.netBtc != null && (
            <>
              <div className="minerwars-panel-divider" />
              <div className="minerwars-panel-row">
                <span className="minerwars-panel-label minerwars-panel-label--sub">
                  {t("cycleTracker.net")}
                  <span className="minerwars-panel-projection-badge">
                    {t("cycleTracker.day", { count: data.targetActualDays })}
                  </span>
                </span>
                <span
                  className={`minerwars-panel-value ${(showFiat || showUsd ? (data.netUsd ?? 0) : showGmt ? (data.netGmt ?? 0) : data.netBtc) >= 0 ? "minerwars-panel-value--pos" : "minerwars-panel-value--neg"}`}
                >
                  <CurrencyAmount
                    btc={data.netBtc}
                    gmt={data.netGmt}
                    usd={data.netUsd}
                    {...currencyFlags}
                  />
                </span>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
