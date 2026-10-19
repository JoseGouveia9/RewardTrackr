import { useTranslation } from "react-i18next";
import type { ClanPerformance } from "@/features/minerwars/utils/clan-performance";
import type { MinerWarsComparison } from "@/features/minerwars/utils/comparison";
import { BtcIcon, FiatIcon, GmtIcon, UsdIcon } from "@/components/icons/currency-icons";
import { CrossedSwordsIcon } from "@/components/icons";
import {
  averageMemberEnergyEfficiency,
  blocksStillNeeded,
  pickLiveOrSettled,
} from "@/features/minerwars/utils/comparison-metrics";
import {
  formatBtc,
  formatCompact,
  formatGmt,
  formatTerahash,
} from "@/features/minerwars/utils/format";
import type {
  MinerWarsClanCurrencyMode,
  MinerWarsShareSnapshot,
} from "@/features/minerwars/types/share-types";
import { formatFiatRounded } from "../../utils/format";
import { ShareRing } from "../share-ring/share-ring";

interface ClanSnapshotProps {
  snapshot: MinerWarsShareSnapshot;
  clan: ClanPerformance;
  comparison: MinerWarsComparison | null;
  clanMode: MinerWarsClanCurrencyMode;
  light: boolean;
}

export function ClanSnapshot({ snapshot, clan, comparison, clanMode, light }: ClanSnapshotProps) {
  const { t } = useTranslation();
  const extraCode = snapshot.extraFiatCode;
  const extraRate = snapshot.extraFiatRate;

  const btcPrice = comparison?.btcPrice ?? 0;
  const gmtPrice = comparison?.gmtPrice ?? 0;
  const asUsd = (btc: number): number | null => (btcPrice > 0 ? btc * btcPrice : null);
  const toGmt = (btc: number): number | null =>
    btcPrice > 0 && gmtPrice > 0 ? (btc * btcPrice) / gmtPrice : null;
  const renderClanValue = (btc: number): { value: string; icon: React.ReactNode } => {
    if (clanMode === "gmt") {
      const gmtAmount = toGmt(btc);
      if (gmtAmount != null) return { value: formatGmt(gmtAmount), icon: <GmtIcon /> };
    }
    if (clanMode === "usd") {
      const usd = asUsd(btc);
      if (usd != null) return { value: formatFiatRounded(usd), icon: <UsdIcon /> };
    }
    if (clanMode === "extra" && extraCode) {
      const usd = asUsd(btc);
      if (usd != null && extraRate != null) {
        return { value: formatFiatRounded(usd * extraRate), icon: <FiatIcon code={extraCode} /> };
      }
    }
    return { value: formatBtc(btc), icon: <BtcIcon /> };
  };

  const members = clan.members;
  const clanBlocksMined = members.reduce((total, member) => total + member.blocksMined, 0);
  const memberBtcSum = members.reduce(
    (total, member) => total + (member.minerWarsRewardEstBtc ?? 0),
    0,
  );
  const clanBtcMined =
    comparison?.clanMinerWarsSats != null
      ? comparison.clanMinerWarsSats / 1e8
      : (clan.header.progressBtc ?? memberBtcSum);
  const clanTargetBtc =
    comparison?.clanTargetSoloSats != null
      ? comparison.clanTargetSoloSats / 1e8
      : (clan.header.targetBtc ?? 0);
  const isLiveCycle =
    snapshot.cycles.find((cycle) => cycle.cycleId === snapshot.selectedCycleId)?.status ===
    "in-progress";
  const boardBtcMined = pickLiveOrSettled(isLiveCycle, clanBtcMined, clan.header.boardBtcMined);
  const clanProgressPercent = clanTargetBtc > 0 ? (boardBtcMined / clanTargetBtc) * 100 : null;
  const position = clan.header.position;
  const clanTerahash = clan.header.boardClanTh ?? clan.totalClanTh ?? 0;
  const blocksMined = pickLiveOrSettled(isLiveCycle, clanBlocksMined, clan.header.boardBlocksMined);
  const targetDays = comparison?.clanTargetActualDays ?? comparison?.cycleLength ?? 7;
  const projectedDays = comparison?.clanTargetProjectedDays ?? 0;
  const projectedLabel =
    projectedDays > 0
      ? `${t("cycleTracker.day", { count: targetDays })} + ${projectedDays} ${t("cycleTracker.projected")}`
      : t("cycleTracker.day", { count: targetDays });
  const clanTargetSoloSats = comparison?.clanTargetSoloSats ?? clanTargetBtc * 1e8;
  const neededBlocks = blocksStillNeeded(
    clanTargetSoloSats,
    comparison?.btcPerBlockSats ?? null,
    blocksMined,
  );
  const energyEfficiencyPerTerahash = averageMemberEnergyEfficiency(members);
  const isBreakEven = clanProgressPercent != null && clanProgressPercent >= 100;

  const blocksNeededText = isBreakEven
    ? t("cycleTracker.breakEvenReached")
    : neededBlocks != null
      ? t("cycleTracker.blocksNeededCount", { count: neededBlocks })
      : "—";

  const clanMinedDisplay = renderClanValue(boardBtcMined);
  const clanTargetDisplay = renderClanValue(clanTargetBtc);
  const targetProgressPercent =
    clanProgressPercent != null ? Math.max(0, Math.min(100, clanProgressPercent)) : 0;

  return (
    <div className="mwpc-section">
      <div className="mwpc-section-header">
        <div className="mwpc-section-title-wrap">
          <CrossedSwordsIcon size={18} color="#f7931a" />
          <span className="mwpc-section-title">
            {t("minerwars.clan", { defaultValue: "Clan" })}
          </span>
        </div>
      </div>

      <div className="mwpc-clan-card">
        <div className="mwpc-clan-split">
          <div className="mwpc-clan-left">
            <div className="mwpc-clan-top-row">
              <ShareRing percent={clanProgressPercent} light={light} />
              <div className="mwpc-clan-top-info">
                <div className="mwpc-clan-rank-row">
                  <span className="mwpc-clan-rank-pill">
                    {position != null ? `RANK #${position}` : "RANK —"}
                  </span>
                  <span className="mwpc-clan-members">
                    {t("cycleTracker.member", {
                      count: members.length,
                      defaultValue: "members",
                    })}
                  </span>
                </div>
                <span className="mwpc-clan-mined-kicker">{t("cycleTracker.minedThisCycle")}</span>
                <div className="mwpc-clan-mined-row">
                  <span className="mwpc-cicon">{clanMinedDisplay.icon}</span>
                  <span className="mwpc-clan-mined-value">{clanMinedDisplay.value}</span>
                  <span className="mwpc-tag">
                    {t("cycleTracker.block", { count: blocksMined, defaultValue: "blocks" })}
                  </span>
                </div>
              </div>
            </div>

            <div className="mwpc-clan-strip">
              <div className="mwpc-clan-strip-col mwpc-clan-strip-divider">
                <span className="mwpc-clan-strip-label">
                  {t("cycleTracker.clanTh", { defaultValue: "Clan TH" })}
                </span>
                <span className="mwpc-clan-strip-value">{formatTerahash(clanTerahash)}</span>
              </div>
              <div className="mwpc-clan-strip-col mwpc-clan-strip-divider">
                <span className="mwpc-clan-strip-label">W/TH</span>
                <span className="mwpc-clan-strip-value">
                  {energyEfficiencyPerTerahash != null
                    ? energyEfficiencyPerTerahash.toFixed(2)
                    : "—"}
                </span>
              </div>
              <div className="mwpc-clan-strip-col">
                <span className="mwpc-clan-strip-label">
                  {t("cycleTracker.clanPps", { defaultValue: "Clan PPS" })}
                </span>
                <span className="mwpc-clan-strip-value">
                  {clan.totalClanPps != null ? formatCompact(clan.totalClanPps) : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="mwpc-clan-mid-divider" />

          <div className="mwpc-clan-right">
            <div className="mwpc-clan-target-block">
              <div className="mwpc-target-header-inline">
                <span className="mwpc-stat-label">
                  {t("cycleTracker.cycleTarget", { defaultValue: "Cycle Target" })}
                </span>
                <span className="mwpc-tag">{projectedLabel}</span>
              </div>
              <div className="mwpc-target-value-row">
                <span className="mwpc-cicon">{clanTargetDisplay.icon}</span>
                <span className="mwpc-target-value">{clanTargetDisplay.value}</span>
              </div>
              <div className="mwpc-target-bar">
                <div
                  className="mwpc-target-bar-fill"
                  style={{ width: `${targetProgressPercent.toFixed(1)}%` }}
                />
              </div>
              <div className="mwpc-clan-target-footer">{blocksNeededText}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
