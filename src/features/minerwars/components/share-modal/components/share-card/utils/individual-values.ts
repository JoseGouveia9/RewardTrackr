import type { MinerWarsComparison } from "@/features/minerwars/utils/comparison";
import type { MinerWarsIndividualCurrencyMode } from "@/features/minerwars/types/share-types";
import { effectiveMinerWarsBtc, usdPerBtcOf } from "@/features/minerwars/utils/comparison-metrics";
import { formatBtc, formatGmt } from "@/features/minerwars/utils/format";
import { formatFiatRounded } from "./format";

export interface IndividualShareValues {
  effectiveMinerWars: number;
  soloBtc: number;
  diffBtc: number;
  diffGmt: number | null;
  diffUsd: number | null;
  effectiveDifferencePercent: number | null;
  maintenancePercent: number | null;
  progressPercent: number | null;
  formatValue: (
    btc: number,
    historicalGmt?: number | null,
    historicalUsd?: number | null,
  ) => string;
}

/** Builds the individual metrics of the share card, formatted for the chosen currency mode. */
export function getIndividualShareValues(
  comparison: MinerWarsComparison,
  mode: MinerWarsIndividualCurrencyMode,
  extraRate: number | null,
): IndividualShareValues {
  const effectiveMinerWars = effectiveMinerWarsBtc(comparison);
  const soloBtc = comparison.soloEquivSats / 1e8;
  const differenceBtc = comparison.diffSats / 1e8;
  const usdPerBtc = usdPerBtcOf(comparison, effectiveMinerWars);
  const toGmt = (btc: number) =>
    (comparison.btcPrice ?? 0) > 0 && (comparison.gmtPrice ?? 0) > 0
      ? (btc * (comparison.btcPrice as number)) / (comparison.gmtPrice as number)
      : null;

  const formatValue = (
    btc: number,
    historicalGmt: number | null = null,
    historicalUsd: number | null = null,
  ): string => {
    if (mode === "gmt") {
      if (historicalGmt != null) return formatGmt(historicalGmt);
      const gmtAmount = toGmt(btc);
      if (gmtAmount != null) return formatGmt(gmtAmount);
    }
    if (mode === "usd") {
      const usdValue = historicalUsd ?? (usdPerBtc != null ? btc * usdPerBtc : null);
      if (usdValue != null) return formatFiatRounded(usdValue);
    }
    if (mode === "extra") {
      const usdValue = historicalUsd ?? (usdPerBtc != null ? btc * usdPerBtc : null);
      if (usdValue != null && extraRate != null) return formatFiatRounded(usdValue * extraRate);
    }
    return formatBtc(btc);
  };

  return {
    effectiveMinerWars,
    soloBtc,
    diffBtc: differenceBtc,
    diffGmt:
      comparison.minerWarsGmt != null && comparison.soloEquivGmt != null
        ? comparison.minerWarsGmt - comparison.soloEquivGmt
        : null,
    diffUsd: usdPerBtc != null ? differenceBtc * usdPerBtc : null,
    effectiveDifferencePercent: soloBtc > 0 ? (differenceBtc / soloBtc) * 100 : null,
    maintenancePercent:
      comparison.maintenanceBtc != null && effectiveMinerWars > 0
        ? (comparison.maintenanceBtc / effectiveMinerWars) * 100
        : null,
    progressPercent:
      comparison.targetSoloSats > 0
        ? (effectiveMinerWars / (comparison.targetSoloSats / 1e8)) * 100
        : null,
    formatValue,
  };
}
