import type { MinerWarsComparison } from "@/features/minerwars/utils/comparison";
import { FiatIcon, GmtIcon, UsdIcon } from "@/components/icons/currency-icons";
import { personalNetGmt } from "@/features/minerwars/utils/comparison-metrics";
import { formatFiat, formatGmt } from "@/features/minerwars/utils/format";
import { useTranslation } from "react-i18next";
import type { MinerWarsPanelViewModel } from "@/features/minerwars/utils/minerwars-panel-view-model";

interface PersonalRewardsRowProps {
  data: MinerWarsComparison;
  viewModel: MinerWarsPanelViewModel;
}

export function PersonalRewardsRow({ data, viewModel }: PersonalRewardsRowProps) {
  const { isActual, showUsd, showFiat, extraFiatRate, extraFiatCode } = viewModel;
  const { t } = useTranslation();

  if (data.personalGmtRewards == null && data.personalBoostCostGmt == null) return null;

  const netGmt = personalNetGmt(data);

  const renderPersonalGmt = (
    gmt: number,
    negative = false,
  ): { icon: React.ReactNode; text: string } => {
    const signed = negative ? -Math.abs(gmt) : gmt;
    if (!isActual && showUsd && data.gmtPrice != null) {
      return { icon: <UsdIcon />, text: formatFiat(signed * data.gmtPrice) };
    }
    if (!isActual && showFiat && data.gmtPrice != null && extraFiatRate != null && extraFiatCode) {
      return {
        icon: <FiatIcon code={extraFiatCode} />,
        text: formatFiat(signed * data.gmtPrice * extraFiatRate),
      };
    }
    return { icon: <GmtIcon />, text: formatGmt(signed) };
  };

  const gmtDisplay =
    data.personalGmtRewards != null ? renderPersonalGmt(data.personalGmtRewards) : null;
  const boostDisplay =
    data.personalBoostCostGmt != null ? renderPersonalGmt(data.personalBoostCostGmt, true) : null;
  const netDisplay = netGmt != null ? renderPersonalGmt(netGmt) : null;

  return (
    <div className="minerwars-panel-personal-row">
      <div className="minerwars-panel-personal-col minerwars-panel-personal-col--divided">
        <div className="minerwars-panel-personal-head">
          <span className="minerwars-panel-personal-label">{t("cycleTracker.personalGmt")}</span>
        </div>
        <span className="minerwars-panel-personal-value">
          {gmtDisplay ? (
            <>
              {gmtDisplay.icon} {gmtDisplay.text}
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
          <span className="minerwars-panel-personal-label">{t("cycleTracker.boostCost")}</span>
        </div>
        <span className="minerwars-panel-personal-value minerwars-panel-value--neg">
          {boostDisplay ? (
            <>
              {boostDisplay.icon} {boostDisplay.text}
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
          className={`minerwars-panel-personal-value ${netGmt != null && netGmt >= 0 ? "minerwars-panel-value--pos" : "minerwars-panel-value--neg"}`}
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
  );
}
