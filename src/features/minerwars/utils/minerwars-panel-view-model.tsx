import type { ReactNode } from "react";
import type { MinerWarsComparison } from "@/features/minerwars/utils/comparison";
import type { Currency } from "@/types/currency";
import { BtcIcon, FiatIcon, GmtIcon, UsdIcon } from "@/components/icons/currency-icons";
import { DualCurrencyIcon } from "../components/comparison-panel/components/minerwars-panel-parts/minerwars-panel-parts";
import { effectiveMinerWarsBtc, usdPerBtcOf } from "./comparison-metrics";
import { formatBtc, formatFiat, formatGmt } from "./format";

type CurrencyOption = { key: Currency; icon: ReactNode; title: string };

interface MinerWarsPanelViewModelArguments {
  data: MinerWarsComparison | null;
  currency: Currency;
  activeTab: "individual" | "clan";
  extraFiatCode: string | null;
  extraFiatRate: number | null;
}

export interface MinerWarsPanelViewModel {
  extraFiatCode: string | null;
  extraFiatRate: number | null;
  isActual: boolean;
  soloEquivBtc: number;
  effectiveMinerWars: number;
  effectiveDiff: number;
  effectiveDifferencePercent: number | null;
  effectiveProgress: number | null;
  isPositive: boolean;
  projecting: boolean;
  maintenancePercent: number | null;
  clanMinerWarsBtc: number;
  clanTargetBtc: number;
  btcPerBlockSats: number | null;
  showNoClanAnalyticsWarning: boolean;
  showBtcFundZeroWarning: boolean;
  zeroedRounds: MinerWarsComparison["zeroedRounds"];
  showZeroedRoundsWarning: boolean;
  hintUserEnergyEfficiency: NonNullable<MinerWarsComparison["zeroedRoundsHint"]>["userEE"] | null;
  hintLeagueEnergyEfficiency:
    | NonNullable<MinerWarsComparison["zeroedRoundsHint"]>["leagueEE"]
    | null;
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
  individualCurrencyOptions: CurrencyOption[];
  activeCurrencyOptions: CurrencyOption[];
  activeCurrencyOption?: CurrencyOption;
  renderValueIcon: () => ReactNode;
  formatBtcValue: (
    btc: number,
    historicalGmt: number | null,
    historicalUsd?: number | null,
  ) => string;
}

/**
 * Derives every figure the comparison panel shows (effective BTC, diff vs solo, progress,
 * warnings) from the comparison data.
 */
export function getMinerWarsPanelViewModel({
  data,
  currency,
  activeTab,
  extraFiatCode,
  extraFiatRate,
}: MinerWarsPanelViewModelArguments): MinerWarsPanelViewModel {
  const isActual = data?.actualMinerWarsBtc != null;
  const soloEquivBtc = (data?.soloEquivSats ?? 0) / 1e8;
  const effectiveMinerWars = data != null ? effectiveMinerWarsBtc(data) : 0;
  const effectiveDifference = effectiveMinerWars - soloEquivBtc;
  const effectiveDifferencePercent =
    soloEquivBtc > 0 ? (effectiveDifference / soloEquivBtc) * 100 : null;
  const effectiveProgress =
    data != null && data.targetSoloSats > 0
      ? (effectiveMinerWars / (data.targetSoloSats / 1e8)) * 100
      : null;
  const isPositive = effectiveDifference >= 0;
  const projecting = (data?.targetProjectedDays ?? 0) > 0;
  const maintenancePercent =
    data?.maintenanceBtc != null && effectiveMinerWars > 0
      ? (data.maintenanceBtc / effectiveMinerWars) * 100
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
  const hintUserEnergyEfficiency = zeroedRoundsHint?.userEE ?? null;
  const hintLeagueEnergyEfficiency = zeroedRoundsHint?.leagueEE ?? null;
  const hintBtcPrice = data?.btcPrice != null ? Math.round(data.btcPrice).toLocaleString() : "?";

  const canShowGmt = (data?.btcPrice ?? 0) > 0 && (data?.gmtPrice ?? 0) > 0;
  const usdPerBtc = data != null ? usdPerBtcOf(data, effectiveMinerWars) : null;
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

  const formatBtcValue = (
    btc: number,
    historicalGmt: number | null,
    historicalUsd: number | null = null,
  ) => {
    if (showGmt) return historicalGmt != null ? formatGmt(historicalGmt) : formatGmt(toGmt(btc));
    if (showUsd) {
      const usd = historicalUsd ?? (usdPerBtc != null ? btc * usdPerBtc : null);
      return usd != null ? formatFiat(usd) : formatBtc(btc);
    }
    if (showFiat) {
      const usd = historicalUsd ?? (usdPerBtc != null ? btc * usdPerBtc : null);
      return usd != null && extraFiatRate != null && extraFiatCode
        ? formatFiat(usd * extraFiatRate)
        : formatBtc(btc);
    }
    return formatBtc(btc);
  };

  const heroGmt = showGmt && data ? (data.minerWarsGmt ?? toGmt(effectiveMinerWars)) : null;
  const soloGmt = showGmt && data ? (data.soloEquivGmt ?? toGmt(soloEquivBtc)) : null;
  const targetGmt =
    showGmt && data ? (data.targetSoloGmt ?? toGmt(data.targetSoloSats / 1e8)) : null;
  const differenceGmt = heroGmt != null && soloGmt != null ? heroGmt - soloGmt : null;
  const heroUsd = data?.minerWarsUsd ?? (usdPerBtc != null ? effectiveMinerWars * usdPerBtc : null);
  const soloUsd = usdPerBtc != null ? soloEquivBtc * usdPerBtc : null;
  const targetUsd = usdPerBtc != null ? ((data?.targetSoloSats ?? 0) / 1e8) * usdPerBtc : null;
  const differenceUsd = usdPerBtc != null ? effectiveDifference * usdPerBtc : null;

  const extraCurrencyOptions: CurrencyOption[] = [
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
  const individualCurrencyOptions: CurrencyOption[] = [
    { key: "BTC", icon: <DualCurrencyIcon />, title: "BTC + GMT" },
    ...extraCurrencyOptions,
  ];
  const clanCurrencyOptions: CurrencyOption[] = [
    { key: "BTC", icon: <BtcIcon />, title: "BTC" },
    ...extraCurrencyOptions,
  ];

  const activeCurrencyOptions =
    activeTab === "clan" ? clanCurrencyOptions : individualCurrencyOptions;
  const activeCurrencyOption =
    activeCurrencyOptions.find((option) => option.key === currency) ?? activeCurrencyOptions[0];

  return {
    extraFiatCode,
    extraFiatRate,
    isActual,
    soloEquivBtc,
    effectiveMinerWars,
    effectiveDiff: effectiveDifference,
    effectiveDifferencePercent,
    effectiveProgress,
    isPositive,
    projecting,
    maintenancePercent,
    clanMinerWarsBtc,
    clanTargetBtc,
    btcPerBlockSats,
    showNoClanAnalyticsWarning,
    showBtcFundZeroWarning,
    zeroedRounds,
    showZeroedRoundsWarning,
    hintUserEnergyEfficiency,
    hintLeagueEnergyEfficiency,
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
    diffGmt: differenceGmt,
    heroUsd,
    soloUsd,
    targetUsd,
    diffUsd: differenceUsd,
    individualCurrencyOptions,
    activeCurrencyOptions,
    activeCurrencyOption,
    renderValueIcon,
    formatBtcValue,
  };
}
