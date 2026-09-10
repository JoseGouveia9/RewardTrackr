import type { ReactNode } from "react";
import type { MinerWarsComparison } from "@/lib/minerwars/comparison";
import type { Currency } from "../../types";
import { BtcIcon, FiatIcon, GmtIcon, UsdIcon } from "../icons/currency-icons";
import { DualCurrencyIcon } from "./minerwars-panel-parts";

export function fmtBtc(btc: number): string {
  const truncated = Math.trunc(btc * 1e8) / 1e8;
  return truncated.toLocaleString("en-US", { minimumFractionDigits: 8, maximumFractionDigits: 8 });
}

export function fmtGmt(gmt: number): string {
  const truncated = Math.trunc(gmt * 100) / 100;
  return truncated.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtFiat(value: number, currency: string): string {
  void currency;
  const truncated = Math.trunc(value * 100) / 100;
  try {
    return truncated.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return truncated.toFixed(2);
  }
}

export function fmtPct(pct: number): string {
  return (pct > 0 ? "+" : "") + pct.toFixed(1) + "%";
}

interface MinerWarsPanelViewModelArgs {
  data: MinerWarsComparison | null;
  currency: Currency;
  activeTab: "individual" | "clan";
  extraFiatCode: string | null;
  extraFiatRate: number | null;
}

export interface MinerWarsPanelViewModel {
  isActual: boolean;
  soloEquivBtc: number;
  effectiveMw: number;
  effectiveDiff: number;
  effectiveDiffPct: number | null;
  effectiveProgress: number | null;
  isPositive: boolean;
  projecting: boolean;
  maintenancePct: number | null;
  clanMinerWarsBtc: number;
  clanTargetBtc: number;
  btcPerBlockSats: number | null;
  showNoClanAnalyticsWarning: boolean;
  showBtcFundZeroWarning: boolean;
  zeroedRounds: MinerWarsComparison["zeroedRounds"];
  showZeroedRoundsWarning: boolean;
  zeroedRoundsHint: MinerWarsComparison["zeroedRoundsHint"];
  hintUserEE: NonNullable<MinerWarsComparison["zeroedRoundsHint"]>["userEE"] | null;
  hintLeagueEE: NonNullable<MinerWarsComparison["zeroedRoundsHint"]>["leagueEE"] | null;
  hintBtcPrice: string;
  canShowGmt: boolean;
  canShowUsd: boolean;
  canShowFiat: boolean;
  showGmt: boolean;
  showUsd: boolean;
  showFiat: boolean;
  heroGmt: number | null;
  soloGmt: number | null;
  targetGmt: number | null;
  diffGmt: number | null;
  heroUsd: number | null;
  soloUsd: number | null;
  targetUsd: number | null;
  diffUsd: number | null;
  individualCurrencyOptions: Array<{ key: Currency; icon: ReactNode; title: string }>;
  clanCurrencyOptions: Array<{ key: Currency; icon: ReactNode; title: string }>;
  activeCurrencyOptions: Array<{ key: Currency; icon: ReactNode; title: string }>;
  activeCurrencyOption?: { key: Currency; icon: ReactNode; title: string };
  renderValueIcon: () => ReactNode;
  formatBtcValue: (btc: number, histGmt: number | null, histUsd?: number | null) => string;
}

export function getMinerWarsPanelViewModel({
  data,
  currency,
  activeTab,
  extraFiatCode,
  extraFiatRate,
}: MinerWarsPanelViewModelArgs): MinerWarsPanelViewModel {
  const isActual = data?.actualMinerWarsBtc != null;
  const soloEquivBtc = (data?.soloEquivSats ?? 0) / 1e8;
  const effectiveMw = data != null ? (data.actualMinerWarsBtc ?? data.minerWarsSats / 1e8) : 0;
  const effectiveDiff = effectiveMw - soloEquivBtc;
  const effectiveDiffPct = soloEquivBtc > 0 ? (effectiveDiff / soloEquivBtc) * 100 : null;
  const effectiveProgress =
    data != null && data.targetSoloSats > 0
      ? (effectiveMw / (data.targetSoloSats / 1e8)) * 100
      : null;
  const isPositive = effectiveDiff >= 0;
  const projecting = (data?.targetProjectedDays ?? 0) > 0;
  const maintenancePct =
    data?.maintenanceBtc != null && effectiveMw > 0
      ? (data.maintenanceBtc / effectiveMw) * 100
      : null;
  const clanMinerWarsBtc = (data?.clanMinerWarsSats ?? 0) / 1e8;
  const clanTargetBtc = (data?.clanTargetSoloSats ?? 0) / 1e8;
  const btcPerBlockSats = data?.btcPerBlockSats ?? null;
  const showNoClanAnalyticsWarning =
    data != null && !data.hasClanAnalytics && data.actualMinerWarsBtc == null;
  const showBtcFundZeroWarning =
    data != null && data.btcFundIsZero && data.actualMinerWarsBtc == null;
  const zeroedRounds = data?.zeroedRounds ?? null;
  const showZeroedRoundsWarning = zeroedRounds != null;
  const zeroedRoundsHint = data?.zeroedRoundsHint ?? null;
  const hintUserEE = zeroedRoundsHint?.userEE ?? null;
  const hintLeagueEE = zeroedRoundsHint?.leagueEE ?? null;
  const hintBtcPrice = data?.btcPrice != null ? Math.round(data.btcPrice).toLocaleString() : "?";

  const canShowGmt = (data?.btcPrice ?? 0) > 0 && (data?.gmtPrice ?? 0) > 0;
  const impliedUsdPerBtc =
    data?.minerWarsUsd != null && effectiveMw > 0 ? data.minerWarsUsd / effectiveMw : null;
  const liveUsdPerBtc = (data?.btcPrice ?? 0) > 0 ? data!.btcPrice! : null;
  const usdPerBtc = impliedUsdPerBtc ?? liveUsdPerBtc;
  const canShowUsd = usdPerBtc != null || data?.maintenanceUsd != null || data?.netUsd != null;
  const canShowFiat = Boolean(extraFiatCode && extraFiatRate != null && canShowUsd);
  const showGmt = currency === "GMT" && canShowGmt;
  const showUsd = currency === "USD" && canShowUsd;
  const showFiat = currency === "FIAT" && canShowFiat;
  const toGmt = (btc: number) => (btc * data!.btcPrice!) / data!.gmtPrice!;

  function renderValueIcon() {
    if (showFiat) return <FiatIcon code={extraFiatCode ?? "USD"} />;
    if (showUsd) return <UsdIcon />;
    if (showGmt) return <GmtIcon />;
    return <BtcIcon />;
  }

  const formatBtcValue = (btc: number, histGmt: number | null, histUsd: number | null = null) => {
    if (showGmt) return histGmt != null ? fmtGmt(histGmt) : fmtGmt(toGmt(btc));
    if (showUsd) {
      const usd = histUsd ?? (usdPerBtc != null ? btc * usdPerBtc : null);
      return usd != null ? fmtFiat(usd, "USD") : fmtBtc(btc);
    }
    if (showFiat) {
      const usd = histUsd ?? (usdPerBtc != null ? btc * usdPerBtc : null);
      return usd != null && extraFiatRate != null && extraFiatCode
        ? fmtFiat(usd * extraFiatRate, extraFiatCode)
        : fmtBtc(btc);
    }
    return fmtBtc(btc);
  };

  const heroGmt = showGmt && data ? (data.minerWarsGmt ?? toGmt(effectiveMw)) : null;
  const soloGmt = showGmt && data ? (data.soloEquivGmt ?? toGmt(soloEquivBtc)) : null;
  const targetGmt =
    showGmt && data ? (data.targetSoloGmt ?? toGmt(data.targetSoloSats / 1e8)) : null;
  const diffGmt = heroGmt != null && soloGmt != null ? heroGmt - soloGmt : null;
  const heroUsd = data?.minerWarsUsd ?? (usdPerBtc != null ? effectiveMw * usdPerBtc : null);
  const soloUsd = usdPerBtc != null ? soloEquivBtc * usdPerBtc : null;
  const targetUsd = usdPerBtc != null ? ((data?.targetSoloSats ?? 0) / 1e8) * usdPerBtc : null;
  const diffUsd = usdPerBtc != null ? effectiveDiff * usdPerBtc : null;

  const individualCurrencyOptions: Array<{ key: Currency; icon: ReactNode; title: string }> = [
    { key: "BTC", icon: <BtcIcon />, title: "BTC" },
    ...(canShowGmt ? [{ key: "GMT" as Currency, icon: <GmtIcon />, title: "GMT" }] : []),
    ...(canShowUsd ? [{ key: "USD" as Currency, icon: <UsdIcon />, title: "USD" }] : []),
    ...(extraFiatCode && canShowFiat
      ? [
          {
            key: "FIAT" as Currency,
            icon: <FiatIcon code={extraFiatCode} />,
            title: extraFiatCode,
          },
        ]
      : []),
  ];

  const clanCurrencyOptions: Array<{ key: Currency; icon: ReactNode; title: string }> = [
    { key: "BTC", icon: <DualCurrencyIcon />, title: "BTC + GMT" },
    ...(canShowUsd ? [{ key: "USD" as Currency, icon: <UsdIcon />, title: "USD" }] : []),
    ...(extraFiatCode && canShowFiat
      ? [
          {
            key: "FIAT" as Currency,
            icon: <FiatIcon code={extraFiatCode} />,
            title: extraFiatCode,
          },
        ]
      : []),
  ];

  const activeCurrencyOptions =
    activeTab === "clan" ? clanCurrencyOptions : individualCurrencyOptions;
  const activeCurrencyOption =
    activeCurrencyOptions.find((option) => option.key === currency) ?? activeCurrencyOptions[0];

  return {
    isActual,
    soloEquivBtc,
    effectiveMw,
    effectiveDiff,
    effectiveDiffPct,
    effectiveProgress,
    isPositive,
    projecting,
    maintenancePct,
    clanMinerWarsBtc,
    clanTargetBtc,
    btcPerBlockSats,
    showNoClanAnalyticsWarning,
    showBtcFundZeroWarning,
    zeroedRounds,
    showZeroedRoundsWarning,
    zeroedRoundsHint,
    hintUserEE,
    hintLeagueEE,
    hintBtcPrice,
    canShowGmt,
    canShowUsd,
    canShowFiat,
    showGmt,
    showUsd,
    showFiat,
    heroGmt,
    soloGmt,
    targetGmt,
    diffGmt,
    heroUsd,
    soloUsd,
    targetUsd,
    diffUsd,
    individualCurrencyOptions,
    clanCurrencyOptions,
    activeCurrencyOptions,
    activeCurrencyOption,
    renderValueIcon,
    formatBtcValue,
  };
}
