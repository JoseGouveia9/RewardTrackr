import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import type { MinerWarsComparison } from "@/features/minerwars/utils/comparison";
import { formatMultiplier, formatPercent } from "@/features/minerwars/utils/format";
import type { IndividualShareValues } from "../../utils/individual-values";

interface IndividualBreakdownProps {
  comparison: MinerWarsComparison;
  isActual: boolean;
  values: IndividualShareValues;
  valueIcon: React.ReactNode;
  daysLabel: string;
}

interface Metric {
  label: string;
  value: string;
  caption?: string;
  tone?: "pos" | "neg";
  labelTag?: string;
  dividerBefore?: boolean;
}

function CompletedMetricList({
  comparison,
  values,
  valueIcon,
  daysLabel,
}: Omit<IndividualBreakdownProps, "isActual">) {
  const { t } = useTranslation();
  const {
    formatValue,
    soloBtc,
    diffBtc: differenceBtc,
    diffGmt: differenceGmt,
    diffUsd: differenceUsd,
    effectiveDifferencePercent,
    maintenancePercent,
  } = values;

  const metrics: Metric[] = [
    {
      label: t("cycleTracker.soloEquiv"),
      value: formatValue(soloBtc, comparison.soloEquivGmt, null),
      labelTag: daysLabel,
    },
    {
      label: t("cycleTracker.difference"),
      value: `${differenceBtc > 0 ? "+" : differenceBtc < 0 ? "-" : ""}${formatValue(Math.abs(differenceBtc), differenceGmt != null ? Math.abs(differenceGmt) : null, differenceUsd != null ? Math.abs(differenceUsd) : null)}`,
      caption:
        effectiveDifferencePercent != null
          ? `${formatPercent(effectiveDifferencePercent)} ${t("cycleTracker.vsSolo")}`
          : t("cycleTracker.noBaseline", { defaultValue: "No baseline" }),
      tone: differenceBtc >= 0 ? "pos" : "neg",
    },
    {
      label: t("cycleTracker.maintenance"),
      value: `-${formatValue(comparison.maintenanceBtc ?? 0, comparison.maintenanceGmt, comparison.maintenanceUsd)}`,
      caption:
        maintenancePercent != null
          ? t("cycleTracker.maintenanceShare", { pct: maintenancePercent.toFixed(1) })
          : undefined,
      tone: "neg",
      dividerBefore: true,
    },
    {
      label: t("cycleTracker.net"),
      value: formatValue(comparison.netBtc ?? 0, comparison.netGmt, comparison.netUsd),
      tone: (comparison.netBtc ?? 0) >= 0 ? "pos" : "neg",
      labelTag: daysLabel,
      dividerBefore: true,
    },
  ];

  return (
    <div className="mwpc-metric-list">
      {metrics.map((metric, index) => (
        <Fragment key={`${metric.label}-${index}`}>
          {metric.dividerBefore ? <div className="mwpc-metric-divider" /> : null}
          <div className="mwpc-metric-row">
            <div className="mwpc-metric-label-col">
              <div className="mwpc-metric-label-row">
                <span className="mwpc-metric-label">{metric.label}</span>
                {metric.labelTag ? <span className="mwpc-tag">{metric.labelTag}</span> : null}
              </div>
            </div>
            <div className="mwpc-metric-value-wrap">
              <div className="mwpc-metric-value-row">
                <span className="mwpc-cicon mwpc-cicon--sm">{valueIcon}</span>
                <span
                  className={`mwpc-metric-value${metric.tone === "pos" ? " mwpc-pos" : metric.tone === "neg" ? " mwpc-neg" : ""}`}
                >
                  {metric.value}
                </span>
              </div>
              {metric.caption ? (
                <span className="mwpc-metric-caption">{metric.caption}</span>
              ) : null}
            </div>
          </div>
        </Fragment>
      ))}
    </div>
  );
}

function LiveCompareList({
  comparison,
  values,
  valueIcon,
}: Omit<IndividualBreakdownProps, "isActual" | "daysLabel">) {
  const { t } = useTranslation();
  const {
    formatValue,
    soloBtc,
    diffBtc: differenceBtc,
    effectiveMinerWars,
    maintenancePercent,
  } = values;
  const netValue = comparison.netBtc ?? differenceBtc;

  return (
    <div className="mwpc-compare-list">
      <div className="mwpc-compare-header-row">
        <span className="mwpc-compare-label-col" />
        <span className="mwpc-compare-value-col">
          <span className="mwpc-compare-header-text">{t("cycleTracker.solo")}</span>
        </span>
        <span className="mwpc-compare-value-col mwpc-compare-value-col--right">
          <span className="mwpc-compare-header-text mwpc-compare-header-text--right">
            {t("cycleTracker.minerWarsColumn")}
          </span>
        </span>
      </div>

      <div className="mwpc-compare-row">
        <span className="mwpc-compare-label-col">
          <span className="mwpc-compare-label">{t("cycleTracker.gross")}</span>
        </span>
        <span className="mwpc-compare-value-col">
          <span className="mwpc-compare-value">
            <span className="mwpc-cicon mwpc-cicon--sm">{valueIcon}</span>
            {formatValue(soloBtc, comparison.soloEquivGmt, null)}
          </span>
        </span>
        <span className="mwpc-compare-value-col mwpc-compare-value-col--right">
          <span className="mwpc-compare-value">
            <span className="mwpc-cicon mwpc-cicon--sm">{valueIcon}</span>
            {formatValue(effectiveMinerWars, comparison.minerWarsGmt, comparison.minerWarsUsd)}
          </span>
          {formatMultiplier(effectiveMinerWars, soloBtc) != null && (
            <span className="mwpc-compare-badge">
              {formatMultiplier(effectiveMinerWars, soloBtc)} {t("cycleTracker.vsSolo")}
            </span>
          )}
        </span>
      </div>

      <div className="mwpc-metric-divider" />

      <div className="mwpc-compare-row">
        <span className="mwpc-compare-label-col">
          <span className="mwpc-compare-label">{t("cycleTracker.maintenanceEst")}</span>
        </span>
        <span className="mwpc-compare-value-col">
          <span className="mwpc-compare-value mwpc-neg">
            {comparison.soloMaintenanceBtc != null ? (
              <>
                <span className="mwpc-cicon mwpc-cicon--sm">{valueIcon}</span>
                {`-${formatValue(Math.abs(comparison.soloMaintenanceBtc), comparison.soloMaintenanceGmt, comparison.soloMaintenanceUsd)}`}
              </>
            ) : (
              "\u2014"
            )}
          </span>
        </span>
        <span className="mwpc-compare-value-col mwpc-compare-value-col--right">
          <span className="mwpc-compare-value mwpc-neg">
            <span className="mwpc-cicon mwpc-cicon--sm">{valueIcon}</span>
            {`-${formatValue(comparison.maintenanceBtc ?? 0, comparison.maintenanceGmt, comparison.maintenanceUsd)}`}
          </span>
          {maintenancePercent != null && (
            <span className="mwpc-compare-badge">
              {t("cycleTracker.maintenanceShareShort", { pct: maintenancePercent.toFixed(1) })}
            </span>
          )}
        </span>
      </div>

      <div className="mwpc-metric-divider" />

      <div className="mwpc-compare-row">
        <span className="mwpc-compare-label-col">
          <span className="mwpc-compare-label">{t("cycleTracker.netEst")}</span>
        </span>
        <span className="mwpc-compare-value-col">
          <span
            className={`mwpc-compare-value${comparison.soloNetBtc != null ? (comparison.soloNetBtc >= 0 ? " mwpc-pos" : " mwpc-neg") : ""}`}
          >
            {comparison.soloNetBtc != null ? (
              <>
                <span className="mwpc-cicon mwpc-cicon--sm">{valueIcon}</span>
                {formatValue(comparison.soloNetBtc, comparison.soloNetGmt, comparison.soloNetUsd)}
              </>
            ) : (
              "\u2014"
            )}
          </span>
        </span>
        <span className="mwpc-compare-value-col mwpc-compare-value-col--right">
          <span className={`mwpc-compare-value${netValue >= 0 ? " mwpc-pos" : " mwpc-neg"}`}>
            <span className="mwpc-cicon mwpc-cicon--sm">{valueIcon}</span>
            {formatValue(netValue, comparison.netGmt, comparison.netUsd)}
          </span>
          {formatMultiplier(netValue, comparison.soloNetBtc) != null && (
            <span className="mwpc-compare-badge">
              {formatMultiplier(netValue, comparison.soloNetBtc)} {t("cycleTracker.vsSolo")}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

export function IndividualBreakdown({ isActual, ...props }: IndividualBreakdownProps) {
  return isActual ? <CompletedMetricList {...props} /> : <LiveCompareList {...props} />;
}
