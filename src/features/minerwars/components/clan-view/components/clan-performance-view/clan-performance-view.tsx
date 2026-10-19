import { useTranslation } from "react-i18next";
import type { ClanPerformance } from "@/features/minerwars/utils/clan-performance";
import { BtcIcon, FiatIcon, GmtIcon, UsdIcon } from "@/components/icons/currency-icons";
import {
  averageMemberEnergyEfficiency,
  blocksStillNeeded,
  pickLiveOrSettled,
} from "@/features/minerwars/utils/comparison-metrics";
import {
  formatBtc,
  formatFiat,
  formatGmt,
  formatTerahash,
} from "@/features/minerwars/utils/format";
import { TargetRing } from "@/features/minerwars/components/ring/ring";
import "./clan-performance-view.css";
import type { ClanCycleFigures, ClanDisplayOptions } from "../../types";

interface ClanPerformanceViewProps {
  data: ClanPerformance;
  figures: ClanCycleFigures;
  display: ClanDisplayOptions;
  isLiveCycle: boolean;
}

export function ClanPerformanceView({
  data,
  figures,
  display,
  isLiveCycle,
}: ClanPerformanceViewProps) {
  const {
    targetBtc: clanTargetBtc,
    minerWarsBtc: clanMinerWarsBtc,
    btcPerBlockSats,
    actualDays: targetActualDays,
    projectedDays: targetProjectedDays,
  } = figures;
  const { currency, fiatCode, extraFiatRate, btcPrice, gmtPrice } = display;
  const { t } = useTranslation();
  const showGmt = currency === "GMT" && (btcPrice ?? 0) > 0 && (gmtPrice ?? 0) > 0;
  const showUsd = currency === "USD" && (btcPrice ?? 0) > 0;
  const showFiat =
    currency === "FIAT" && fiatCode != null && extraFiatRate != null && (btcPrice ?? 0) > 0;

  const renderBtcValue = (btc: number): { text: string; icon: React.ReactNode } => {
    if (showGmt && btcPrice != null && gmtPrice != null && gmtPrice > 0) {
      return { text: formatGmt((btc * btcPrice) / gmtPrice), icon: <GmtIcon /> };
    }
    if (showUsd && btcPrice != null) {
      return { text: formatFiat(btc * btcPrice), icon: <UsdIcon /> };
    }
    if (showFiat && btcPrice != null && extraFiatRate != null && fiatCode) {
      return {
        text: formatFiat(btc * btcPrice * extraFiatRate),
        icon: <FiatIcon code={fiatCode} />,
      };
    }
    return { text: formatBtc(btc), icon: <BtcIcon /> };
  };

  const members = data.members;
  const membersBlocksMined = members.reduce((total, member) => total + member.blocksMined, 0);
  const blocksMined = pickLiveOrSettled(
    isLiveCycle,
    membersBlocksMined,
    data.header.boardBlocksMined,
  );
  const derivedBtcFromBlocks =
    btcPerBlockSats != null && btcPerBlockSats > 0 ? (blocksMined * btcPerBlockSats) / 1e8 : 0;
  const recomputedBtc = clanMinerWarsBtc > 0 ? clanMinerWarsBtc : derivedBtcFromBlocks;
  const boardBtcMined = pickLiveOrSettled(isLiveCycle, recomputedBtc, data.header.boardBtcMined);
  const clanProgressPercent = clanTargetBtc > 0 ? (boardBtcMined / clanTargetBtc) * 100 : null;
  const isBreakEven = clanProgressPercent != null && clanProgressPercent >= 100;
  const neededBlocks = blocksStillNeeded(clanTargetBtc * 1e8, btcPerBlockSats, blocksMined);
  const blocksNeededText = isBreakEven
    ? t("cycleTracker.breakEvenReached")
    : neededBlocks != null
      ? t("cycleTracker.blocksNeededCount", { count: neededBlocks })
      : "\u2014";
  const projectedLabel =
    targetProjectedDays > 0
      ? `${t("cycleTracker.day", { count: targetActualDays })} + ${targetProjectedDays} ${t("cycleTracker.projected")}`
      : t("cycleTracker.day", { count: targetActualDays });

  const energyEfficiencyPerTerahash = averageMemberEnergyEfficiency(members);
  const minedValue = renderBtcValue(boardBtcMined);
  const targetValue = renderBtcValue(clanTargetBtc);

  return (
    <div className="clan-view">
      <div className="clan-view-card">
        <div className="clan-view-hero-grid">
          <div className="clan-view-hero-col-left">
            <div className="clan-view-hero-top">
              <TargetRing percent={clanProgressPercent} classPrefix="clan-view" />
              <div className="clan-view-hero-content">
                <div className="clan-view-hero-meta">
                  <span className="clan-view-rank-tag">
                    {data.header.position != null
                      ? t("cycleTracker.rankNumber", { position: data.header.position })
                      : t("cycleTracker.rankUnknown")}
                  </span>
                  <span className="clan-view-members-count">
                    {t("cycleTracker.member", { count: members.length })}
                  </span>
                </div>
                <div className="clan-view-mini-label">{t("cycleTracker.minedThisCycle")}</div>
                <div className="clan-view-mined-value">
                  {minedValue.icon} {minedValue.text}
                  <span className="minerwars-panel-projection-badge">
                    {t("cycleTracker.block", { count: blocksMined })}
                  </span>
                </div>
              </div>
            </div>

            <div className="clan-view-mini-row">
              <div className="clan-view-mini-card clan-view-mini-card--divided">
                <span className="clan-view-mini-label">{t("cycleTracker.clanTh")}</span>
                <span className="clan-view-mini-value">{formatTerahash(data.totalClanTh)}</span>
              </div>
              <div className="clan-view-mini-card clan-view-mini-card--divided">
                <span className="clan-view-mini-label">W/TH</span>
                <span className="clan-view-mini-value">
                  {energyEfficiencyPerTerahash != null
                    ? energyEfficiencyPerTerahash.toFixed(2)
                    : "\u2014"}
                </span>
              </div>
              <div className="clan-view-mini-card">
                <span className="clan-view-mini-label">{t("cycleTracker.clanPps")}</span>
                <span className="clan-view-mini-value">
                  {data.totalClanPps != null ? data.totalClanPps.toFixed(0) : "\u2014"}
                </span>
              </div>
            </div>
          </div>

          <div className="clan-view-hero-divider" />

          <div className="clan-view-hero-col-right">
            <div className="clan-view-target-block">
              <div className="minerwars-panel-row">
                <span className="minerwars-panel-label">
                  {t("cycleTracker.cycleTarget")}
                  <span className="minerwars-panel-projection-badge">{projectedLabel}</span>
                </span>
              </div>
              <div className="clan-view-target-value-row">
                {targetValue.icon}
                <span className="clan-view-target-value">{targetValue.text}</span>
              </div>
              <div className="minerwars-panel-progress-bar">
                <div
                  className={`minerwars-panel-progress-fill${isBreakEven ? " minerwars-panel-progress-fill--over" : ""}`}
                  style={{
                    width: `${Math.max(0, Math.min(100, clanProgressPercent ?? 0)).toFixed(1)}%`,
                  }}
                />
              </div>
              <div className="clan-view-target-footer">{blocksNeededText}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
