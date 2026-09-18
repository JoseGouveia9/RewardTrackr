import { forwardRef, Fragment } from "react";
import { useTranslation } from "react-i18next";
import type {
  MinerWarsClanCurrencyMode,
  MinerWarsIndividualCurrencyMode,
  MinerWarsShareScope,
  MinerWarsShareSnapshot,
} from "./minerwars-share-types";
import { BtcIcon, FiatIcon, GmtIcon, UsdIcon } from "../icons/currency-icons";
import { CrossedSwordsIcon, UserAvatarIcon } from "../icons";
import { readIndividualTrendPoints } from "@/lib/minerwars/individual-trend";
import { MinerWarsLineTrend } from "./minerwars-line-trend";
import appLogo from "/logo.webp";
import "./minerwars-share-card.css";

// ─── Formatters (match mobile screens/minerwars/utils/format.ts) ────────────────
function fmtBtc(btc: number): string {
  const truncated = Math.trunc(btc * 1e8) / 1e8;
  return truncated.toLocaleString("en-US", { minimumFractionDigits: 8, maximumFractionDigits: 8 });
}
function fmtGmt(gmt: number): string {
  const truncated = Math.trunc(gmt * 100) / 100;
  return truncated.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtFiat(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtTh(th: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(th) + " TH";
}
function fmtCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 100 ? 0 : value >= 10 ? 1 : 2,
  }).format(value);
}
function fmtPct(pct: number): string {
  return (pct > 0 ? "+" : "") + pct.toFixed(1) + "%";
}

function toRoman(num: number): string {
  if (num <= 0) return String(num);
  const numerals: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let result = "";
  let remaining = num;
  for (const [value, symbol] of numerals) {
    while (remaining >= value) {
      result += symbol;
      remaining -= value;
    }
  }
  return result;
}
function leagueName(leagueId: number): string {
  if (leagueId === 1) return "Odyssey";
  if (leagueId === 3) return "Eclipse";
  if (leagueId === 4) return "Horizon";
  return `Dune ${toRoman(leagueId - 4)}`;
}

function ProgressRing({ pct, light }: { pct: number | null; light: boolean }) {
  const size = 92;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safe = pct != null ? Math.max(0, Math.min(100, pct)) : 0;
  const dash = (safe / 100) * circumference;
  const overflow = pct != null ? Math.max(0, Math.min(100, pct - 100)) : 0;
  const overflowDash = (overflow / 100) * circumference;
  return (
    <svg width={size} height={size} className="mwpc-ring-svg" viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={light ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)"}
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#f7931a"
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${Math.max(0, circumference - dash)}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      {overflow > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#22c55e"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${overflowDash} ${Math.max(0, circumference - overflowDash)}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
    </svg>
  );
}

interface CardProps {
  snapshot: MinerWarsShareSnapshot;
  scope: MinerWarsShareScope;
  individualMode: MinerWarsIndividualCurrencyMode;
  clanMode: MinerWarsClanCurrencyMode;
  showLeague: boolean;
  showClanName: boolean;
  showTrendChart: boolean;
  showPersonalRow: boolean;
  light: boolean;
  generatedFooter: string;
}

export const MinerWarsShareCard = forwardRef<HTMLDivElement, CardProps>(function MinerWarsShareCard(
  {
    snapshot,
    scope,
    individualMode,
    clanMode,
    showLeague,
    showClanName,
    showTrendChart,
    showPersonalRow,
    light,
    generatedFooter,
  },
  ref,
) {
  const { t } = useTranslation();
  const cmp = snapshot.comparison;
  const clan = snapshot.clanPerformance;
  const extraCode = snapshot.extraFiatCode;
  const extraRate = snapshot.extraFiatRate;

  const showIndividual = (scope === "individual" || scope === "both") && cmp != null;
  const showClan = (scope === "clan" || scope === "both") && clan != null;

  const iconIndividual = (mode: MinerWarsIndividualCurrencyMode) => {
    if (mode === "gmt") return <GmtIcon />;
    if (mode === "usd") return <UsdIcon />;
    if (mode === "extra") return <FiatIcon code={extraCode ?? "USD"} />;
    return <BtcIcon />;
  };

  // ─── Individual snapshot ──────────────────────────────────────────────────────
  let individualBlock: React.ReactNode = null;
  if (showIndividual && cmp) {
    const isActual = cmp.actualMinerWarsBtc != null;
    const effectiveMw = cmp.actualMinerWarsBtc ?? cmp.minerWarsSats / 1e8;
    const soloBtc = cmp.soloEquivSats / 1e8;
    const diffBtc = cmp.diffSats / 1e8;
    const usdPerBtc =
      cmp.minerWarsUsd != null && effectiveMw > 0
        ? cmp.minerWarsUsd / effectiveMw
        : (cmp.btcPrice ?? 0) > 0
          ? (cmp.btcPrice as number)
          : null;
    const toGmt = (btc: number) =>
      (cmp.btcPrice ?? 0) > 0 && (cmp.gmtPrice ?? 0) > 0
        ? (btc * (cmp.btcPrice as number)) / (cmp.gmtPrice as number)
        : null;

    const fmtVal = (
      btc: number,
      histGmt: number | null = null,
      histUsd: number | null = null,
    ): string => {
      if (individualMode === "gmt") {
        if (histGmt != null) return fmtGmt(histGmt);
        const g = toGmt(btc);
        if (g != null) return fmtGmt(g);
      }
      if (individualMode === "usd") {
        const v = histUsd ?? (usdPerBtc != null ? btc * usdPerBtc : null);
        if (v != null) return fmtFiat(v);
      }
      if (individualMode === "extra") {
        const v = histUsd ?? (usdPerBtc != null ? btc * usdPerBtc : null);
        if (v != null && extraRate != null) return fmtFiat(v * extraRate);
      }
      return fmtBtc(btc);
    };
    const valIcon = iconIndividual(individualMode);
    const progressPct =
      cmp.targetSoloSats > 0 ? (effectiveMw / (cmp.targetSoloSats / 1e8)) * 100 : null;
    const diffGmt =
      cmp.minerWarsGmt != null && cmp.soloEquivGmt != null
        ? cmp.minerWarsGmt - cmp.soloEquivGmt
        : null;
    const diffUsd = usdPerBtc != null ? diffBtc * usdPerBtc : null;
    const effectiveDiffPct = soloBtc > 0 ? (diffBtc / soloBtc) * 100 : null;
    const projecting = (cmp.targetProjectedDays ?? 0) > 0;
    const daysLabel = t("cycleTracker.day", { count: cmp.targetActualDays });
    const projLabel = projecting
      ? `${daysLabel} + ${cmp.targetProjectedDays} ${t("cycleTracker.projected")}`
      : daysLabel;
    const maintPct =
      cmp.maintenanceBtc != null && effectiveMw > 0
        ? (cmp.maintenanceBtc / effectiveMw) * 100
        : null;

    const individualTrendPoints = (() => {
      const allCycles = snapshot.cycles ?? [];
      const newestCycleId = allCycles.reduce(
        (max, c) => Math.max(max, c.cycleId),
        snapshot.selectedCycleId ?? 0,
      );
      return newestCycleId > 0 ? readIndividualTrendPoints(allCycles, newestCycleId, cmp) : [];
    })();
    const chartIndividualPoints = individualTrendPoints.slice(-15);
    const trendLabels = chartIndividualPoints.map((point) => `#${point.cycleId}`);
    const trendProgressPct = chartIndividualPoints.map((point) => point.progressPct ?? 0);

    interface Metric {
      label: string;
      value: string;
      caption?: string;
      tone?: "pos" | "neg";
      labelTag?: string;
      showIcon?: boolean;
      icon?: React.ReactNode;
      dividerBefore?: boolean;
      tags?: Array<{ label: string; value: string }>;
    }
    const metrics: Metric[] = [
      {
        label: t("cycleTracker.soloEquiv"),
        value: fmtVal(soloBtc, cmp.soloEquivGmt, null),
        labelTag: daysLabel,
        showIcon: true,
      },
      {
        label: t("cycleTracker.difference"),
        value: `${diffBtc > 0 ? "+" : diffBtc < 0 ? "-" : ""}${fmtVal(Math.abs(diffBtc), diffGmt != null ? Math.abs(diffGmt) : null, diffUsd != null ? Math.abs(diffUsd) : null)}`,
        caption:
          effectiveDiffPct != null
            ? `${fmtPct(effectiveDiffPct)} ${t("cycleTracker.vsSolo")}`
            : t("cycleTracker.noBaseline", { defaultValue: "No baseline" }),
        tone: diffBtc >= 0 ? "pos" : "neg",
        showIcon: true,
      },
      {
        label: isActual ? t("cycleTracker.maintenance") : t("cycleTracker.maintenanceEst"),
        value:
          cmp.maintenanceBtc != null
            ? `-${fmtVal(cmp.maintenanceBtc, cmp.maintenanceGmt, cmp.maintenanceUsd)}`
            : "—",
        caption:
          maintPct != null
            ? t("cycleTracker.maintenanceShare", { pct: maintPct.toFixed(1) })
            : undefined,
        tone: cmp.maintenanceBtc != null ? "neg" : undefined,
        showIcon: cmp.maintenanceBtc != null,
        dividerBefore: true,
        tags:
          cmp.personalDiscountPct != null || !isActual
            ? [
                ...(cmp.personalDiscountPct != null
                  ? [
                      {
                        label: t("cycleTracker.personalDiscountLabel"),
                        value: `${(cmp.personalDiscountPct * 100).toFixed(2)}%`,
                      },
                    ]
                  : []),
                ...(!isActual
                  ? [
                      {
                        label: t("cycleTracker.leagueDiscountSectionLabel"),
                        value:
                          cmp.leagueDiscountPct != null
                            ? `${(cmp.leagueDiscountPct * 100).toFixed(2)}%`
                            : "-",
                      },
                    ]
                  : []),
              ]
            : undefined,
      },
      {
        label: isActual ? t("cycleTracker.net") : t("cycleTracker.netEst"),
        value: cmp.netBtc != null ? fmtVal(cmp.netBtc, cmp.netGmt, cmp.netUsd) : "—",
        tone: cmp.netBtc == null ? undefined : cmp.netBtc >= 0 ? "pos" : "neg",
        labelTag: daysLabel,
        showIcon: cmp.netBtc != null,
        dividerBefore: true,
      },
    ];

    const personalNetGmt =
      cmp.personalGmtRewards != null || cmp.personalBoostCostGmt != null
        ? (cmp.personalGmtRewards ?? 0) - (cmp.personalBoostCostGmt ?? 0)
        : null;

    const renderPersonalGmt = (gmt: number): { icon: React.ReactNode; text: string } => {
      if (individualMode === "usd" && cmp.gmtPrice != null) {
        return { icon: <UsdIcon />, text: fmtFiat(gmt * cmp.gmtPrice) };
      }
      if (individualMode === "extra" && cmp.gmtPrice != null && extraRate != null) {
        return {
          icon: <FiatIcon code={extraCode ?? "USD"} />,
          text: fmtFiat(gmt * cmp.gmtPrice * extraRate),
        };
      }
      return { icon: <GmtIcon />, text: fmtGmt(gmt) };
    };
    const personalGmtDisplay =
      cmp.personalGmtRewards != null ? renderPersonalGmt(cmp.personalGmtRewards) : null;
    const personalBoostDisplay =
      cmp.personalBoostCostGmt != null
        ? renderPersonalGmt(-Math.abs(cmp.personalBoostCostGmt))
        : null;
    const personalNetDisplay = personalNetGmt != null ? renderPersonalGmt(personalNetGmt) : null;

    individualBlock = (
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
                <div className="mwpc-ring-wrap">
                  <ProgressRing pct={progressPct} light={light} />
                  <span className="mwpc-ring-pct">
                    {progressPct != null ? `${progressPct.toFixed(1)}%` : "—"}
                  </span>
                  <span className="mwpc-ring-label">TARGET</span>
                </div>
                <div className="mwpc-ind-hero-main">
                  <div className="mwpc-ind-hero-label-row">
                    <span className="mwpc-ind-hero-label">
                      {isActual
                        ? t("cycleTracker.minerWarsActual")
                        : t("cycleTracker.minerWarsEst")}
                    </span>
                    <span className="mwpc-tag">{daysLabel}</span>
                  </div>
                  <div className="mwpc-ind-hero-value-row">
                    <span className="mwpc-cicon">{valIcon}</span>
                    <span className="mwpc-ind-hero-value">
                      {fmtVal(effectiveMw, cmp.minerWarsGmt, cmp.minerWarsUsd)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mwpc-ind-target-block">
                <div className="mwpc-target-header-inline">
                  <span className="mwpc-stat-label">{t("cycleTracker.soloTarget")}</span>
                  <span className="mwpc-tag">{projLabel}</span>
                </div>
                <div className="mwpc-target-value-row">
                  <span className="mwpc-cicon">{valIcon}</span>
                  <span className="mwpc-target-value">
                    {fmtVal(cmp.targetSoloSats / 1e8, cmp.targetSoloGmt, null)}
                  </span>
                </div>
                <div className="mwpc-target-bar">
                  <div
                    className="mwpc-target-bar-fill"
                    style={{ width: `${Math.max(0, Math.min(100, progressPct ?? 0)).toFixed(1)}%` }}
                  />
                </div>
              </div>

              {showPersonalRow &&
                (cmp.personalGmtRewards != null || cmp.personalBoostCostGmt != null) && (
                  <div className="mwpc-personal-row">
                    <div className="mwpc-personal-col mwpc-personal-col--divided">
                      <div className="mwpc-personal-head">
                        <span className="mwpc-personal-label">{t("cycleTracker.personalGmt")}</span>
                      </div>
                      <span className="mwpc-personal-value">
                        {personalGmtDisplay ? (
                          <>
                            {personalGmtDisplay.icon} {personalGmtDisplay.text}
                          </>
                        ) : (
                          "—"
                        )}
                        {cmp.personalBlocksMined != null && (
                          <span className="mwpc-tag mwpc-personal-tag">
                            {t("cycleTracker.blockShort", { count: cmp.personalBlocksMined })}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="mwpc-personal-col mwpc-personal-col--divided">
                      <div className="mwpc-personal-head">
                        <span className="mwpc-personal-label">{t("cycleTracker.boostCost")}</span>
                      </div>
                      <span className="mwpc-personal-value mwpc-neg">
                        {personalBoostDisplay ? (
                          <>
                            {personalBoostDisplay.icon} {personalBoostDisplay.text}
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
                        className={`mwpc-personal-value ${personalNetGmt != null && personalNetGmt >= 0 ? "mwpc-pos" : "mwpc-neg"}`}
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

            <div className="mwpc-ind-vdivider" />

            <div className="mwpc-ind-right">
              <div className="mwpc-metric-list">
                {metrics.map((m, i) => (
                  <Fragment key={`${m.label}-${i}`}>
                    {m.dividerBefore ? <div className="mwpc-metric-divider" /> : null}
                    <div className="mwpc-metric-row">
                      <div className="mwpc-metric-label-col">
                        <div className="mwpc-metric-label-row">
                          <span className="mwpc-metric-label">{m.label}</span>
                          {m.labelTag ? <span className="mwpc-tag">{m.labelTag}</span> : null}
                        </div>
                        {m.tags && m.tags.length > 0 ? (
                          <div className="mwpc-metric-tags-col">
                            {m.tags.map((tag, ti) => (
                              <span key={`${tag.label}-${ti}`} className="mwpc-metric-tag">
                                <span className="mwpc-metric-tag-label">{tag.label}</span>
                                <span className="mwpc-metric-tag-value">{tag.value}</span>
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="mwpc-metric-value-wrap">
                        <div className="mwpc-metric-value-row">
                          {m.showIcon ? (
                            <span className="mwpc-cicon mwpc-cicon--sm">{m.icon ?? valIcon}</span>
                          ) : null}
                          <span
                            className={`mwpc-metric-value${m.tone === "pos" ? " mwpc-pos" : m.tone === "neg" ? " mwpc-neg" : ""}`}
                          >
                            {m.value}
                          </span>
                        </div>
                        {m.caption ? (
                          <span className="mwpc-metric-caption">{m.caption}</span>
                        ) : null}
                      </div>
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>

        {showTrendChart && (
          <div className="mwpc-line-trend-row">
            <MinerWarsLineTrend
              title="vs Target trend"
              values={trendProgressPct}
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

  // ─── Clan snapshot ────────────────────────────────────────────────────────────
  let clanBlock: React.ReactNode = null;
  if (showClan && clan) {
    const btcPrice = cmp?.btcPrice ?? 0;
    const gmtPrice = cmp?.gmtPrice ?? 0;
    const asUsd = (btc: number, gmt = 0): number | null =>
      btcPrice > 0 ? btc * btcPrice + gmt * gmtPrice : null;
    const asExtra = (btc: number, gmt = 0): number | null => {
      const usd = asUsd(btc, gmt);
      return usd != null && extraRate != null ? usd * extraRate : null;
    };
    const toGmt = (btc: number, gmt = 0): number | null =>
      btcPrice > 0 && gmtPrice > 0 ? (btc * btcPrice) / gmtPrice + gmt : gmt !== 0 ? gmt : null;
    const renderClanValue = (btc: number, gmt = 0): { value: string; icon: React.ReactNode } => {
      if (clanMode === "gmt") {
        const g = toGmt(btc, gmt);
        if (g != null) return { value: fmtGmt(g), icon: <GmtIcon /> };
      }
      if (clanMode === "usd") {
        const usd = asUsd(btc, gmt);
        if (usd != null) return { value: fmtFiat(usd), icon: <UsdIcon /> };
      }
      if (clanMode === "extra" && extraCode) {
        const fiat = asExtra(btc, gmt);
        if (fiat != null) return { value: fmtFiat(fiat), icon: <FiatIcon code={extraCode} /> };
      }
      if (gmt !== 0 && btc === 0) return { value: fmtGmt(gmt), icon: <GmtIcon /> };
      return { value: fmtBtc(btc), icon: <BtcIcon /> };
    };
    const activeMembers = clan.members;
    const clanBlocksMined = clan.members.reduce((s, m) => s + (m.blocksMined ?? 0), 0);
    const memberBtcSum = clan.members.reduce((s, m) => s + (m.minerWarsRewardEstBtc ?? 0), 0);
    const clanBtcMined =
      cmp?.clanMinerWarsSats != null
        ? cmp.clanMinerWarsSats / 1e8
        : (clan.header.progressBtc ?? memberBtcSum);
    const clanTargetBtc =
      cmp?.clanTargetSoloSats != null ? cmp.clanTargetSoloSats / 1e8 : (clan.header.targetBtc ?? 0);
    // For a LIVE cycle the raw board snapshot's btcMined lags/reads 0 mid-cycle, so the
    // round-based reconstruction (clanBtcMined) is preferred, with the raw field only as a
    // last-resort fallback. For a COMPLETED cycle the raw field is presumed final/settled.
    const isLiveCycle =
      (snapshot.cycles ?? []).find((c) => c.cycleId === snapshot.selectedCycleId)?.status ===
      "in-progress";
    const boardBtcMined = isLiveCycle
      ? clanBtcMined || (clan.header.boardBtcMined ?? 0)
      : clan.header.boardBtcMined != null && clan.header.boardBtcMined > 0
        ? clan.header.boardBtcMined
        : clanBtcMined;
    const clanProgressPct = clanTargetBtc > 0 ? (boardBtcMined / clanTargetBtc) * 100 : null;
    const position = clan.header.position;
    const clanTh = clan.header.boardClanTh ?? clan.totalClanTh ?? 0;
    const boardBlocksMined = clan.header.boardBlocksMined ?? 0;
    const blocksMined = isLiveCycle
      ? clanBlocksMined || boardBlocksMined
      : boardBlocksMined > 0
        ? boardBlocksMined
        : clanBlocksMined;
    const targetDays = cmp?.clanTargetActualDays ?? cmp?.cycleLength ?? 7;
    const projectedDays = cmp?.clanTargetProjectedDays ?? 0;
    const projecting = projectedDays > 0;
    const projLabel = projecting
      ? `${t("cycleTracker.day", { count: targetDays })} + ${projectedDays} ${t("cycleTracker.projected")}`
      : t("cycleTracker.day", { count: targetDays });
    const btcPerBlockSats = cmp?.btcPerBlockSats ?? null;
    const clanTargetSoloSats = cmp?.clanTargetSoloSats ?? clanTargetBtc * 1e8;
    const clanTargetBlocksTotal =
      btcPerBlockSats != null && btcPerBlockSats > 0
        ? Math.max(0, Math.ceil(clanTargetSoloSats / btcPerBlockSats))
        : null;
    const eeValues = activeMembers
      .map((m) => m.ee)
      .filter((v): v is number => v != null && Number.isFinite(v));
    const weightedEePerTh =
      eeValues.length > 0 ? eeValues.reduce((s, v) => s + v, 0) / eeValues.length : null;
    const neededBlocks =
      clanTargetBlocksTotal != null ? Math.max(0, clanTargetBlocksTotal - blocksMined) : null;
    const isBreakEven = clanProgressPct != null && clanProgressPct >= 100;

    const blocksNeededText = isBreakEven
      ? t("cycleTracker.breakEvenReached")
      : neededBlocks != null
        ? t("cycleTracker.blocksNeededCount", { count: neededBlocks })
        : "—";

    const clanMinedDisplay = renderClanValue(boardBtcMined, 0);
    const clanTargetDisplay = renderClanValue(clanTargetBtc, 0);
    const targetProgressPct =
      clanProgressPct != null ? Math.max(0, Math.min(100, clanProgressPct)) : 0;

    clanBlock = (
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
                <div className="mwpc-ring-wrap">
                  <ProgressRing pct={clanProgressPct} light={light} />
                  <span className="mwpc-ring-pct">
                    {clanProgressPct != null ? `${clanProgressPct.toFixed(1)}%` : "—"}
                  </span>
                  <span className="mwpc-ring-label">TARGET</span>
                </div>
                <div className="mwpc-clan-top-info">
                  <div className="mwpc-clan-rank-row">
                    <span className="mwpc-clan-rank-pill">
                      {position != null ? `RANK #${position}` : "RANK —"}
                    </span>
                    <span className="mwpc-clan-members">
                      {t("cycleTracker.member", {
                        count: activeMembers.length,
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
                  <span className="mwpc-clan-strip-value">{fmtTh(clanTh)}</span>
                </div>
                <div className="mwpc-clan-strip-col mwpc-clan-strip-divider">
                  <span className="mwpc-clan-strip-label">W/TH</span>
                  <span className="mwpc-clan-strip-value">
                    {weightedEePerTh != null ? weightedEePerTh.toFixed(2) : "—"}
                  </span>
                </div>
                <div className="mwpc-clan-strip-col">
                  <span className="mwpc-clan-strip-label">
                    {t("cycleTracker.clanPps", { defaultValue: "Clan PPS" })}
                  </span>
                  <span className="mwpc-clan-strip-value">
                    {clan.totalClanPps != null ? fmtCompact(clan.totalClanPps) : "—"}
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
                  <span className="mwpc-tag">{projLabel}</span>
                </div>
                <div className="mwpc-target-value-row">
                  <span className="mwpc-cicon">{clanTargetDisplay.icon}</span>
                  <span className="mwpc-target-value">{clanTargetDisplay.value}</span>
                </div>
                <div className="mwpc-target-bar">
                  <div
                    className="mwpc-target-bar-fill"
                    style={{ width: `${targetProgressPct.toFixed(1)}%` }}
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

  const clanHeader = clan?.header;
  const useClanBrand = showClanName && clanHeader?.name != null;
  const brandName = useClanBrand ? clanHeader!.name : "REWARDTRACKR";
  const brandLogoUrl = showClanName ? (clanHeader?.logoUrl ?? appLogo) : appLogo;

  return (
    <div ref={ref} className={`mwpc-root${light ? " mwpc-root--light" : " mwpc-root--dark"}`}>
      <div className="mwpc-hero">
        <div className="mwpc-brand-row">
          <div className="mwpc-brand-left">
            <img
              className="mwpc-logo"
              src={brandLogoUrl}
              alt=""
              crossOrigin={showClanName && clanHeader?.logoUrl ? "anonymous" : undefined}
            />
            <div>
              <div className="mwpc-brand-text">
                {useClanBrand ? (
                  brandName
                ) : (
                  <>
                    REWARD
                    <span className="mwpc-brand-text-accent">TRACKR</span>
                  </>
                )}
              </div>
              <div className="mwpc-brand-sub">MINERWARS PERFORMANCE SNAPSHOT</div>
            </div>
          </div>
          <div className="mwpc-brand-tags">
            <span className="mwpc-meta-pill mwpc-meta-pill--primary">
              {snapshot.selectedCycleId != null ? `Cycle #${snapshot.selectedCycleId}` : "Cycle"}
            </span>
            {showClan && clan && showLeague && (
              <span className="mwpc-meta-pill">
                {clan.header.leagueId != null
                  ? `League ${leagueName(clan.header.leagueId)}`
                  : "League —"}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mwpc-sections">
        {individualBlock}
        {clanBlock}
      </div>

      <div className="mwpc-footer">
        <span className="mwpc-footer-text">rewardtrackr.com</span>
        <span className="mwpc-footer-text">
          {t("minerwarsShare.generatedOn", {
            date: generatedFooter,
            defaultValue: `Generated ${generatedFooter}`,
          })}
        </span>
      </div>
    </div>
  );
});
