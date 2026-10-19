import type { MinerWarsComparison } from "@/features/minerwars/utils/comparison";
import type { ClanPerformance } from "@/features/minerwars/utils/clan-performance";

export function effectiveMinerWarsBtc(comparison: MinerWarsComparison): number {
  return comparison.actualMinerWarsBtc ?? comparison.minerWarsSats / 1e8;
}

export function usdPerBtcOf(
  comparison: Pick<MinerWarsComparison, "minerWarsUsd" | "btcPrice">,
  effectiveMinerWars: number,
): number | null {
  if (comparison.minerWarsUsd != null && effectiveMinerWars > 0)
    return comparison.minerWarsUsd / effectiveMinerWars;
  return (comparison.btcPrice ?? 0) > 0 ? comparison.btcPrice : null;
}

export function personalNetGmt(comparison: MinerWarsComparison): number | null {
  if (comparison.personalGmtRewards == null && comparison.personalBoostCostGmt == null) return null;
  return (comparison.personalGmtRewards ?? 0) - (comparison.personalBoostCostGmt ?? 0);
}

/**
 * Live cycles: the board's raw value lags (reads 0 mid-cycle), so prefer the recomputed one.
 * Completed cycles: the raw board value is final.
 */
export function pickLiveOrSettled(
  isLive: boolean,
  recomputed: number,
  board: number | null | undefined,
): number {
  const raw = board ?? 0;
  if (isLive) return recomputed || raw;
  return raw > 0 ? raw : recomputed;
}

export function averageMemberEnergyEfficiency(members: ClanPerformance["members"]): number | null {
  const values = members
    .map((member) => member.ee)
    .filter((value): value is number => value != null && Number.isFinite(value));
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function blocksStillNeeded(
  targetSats: number,
  btcPerBlockSats: number | null,
  blocksMined: number,
): number | null {
  if (btcPerBlockSats == null || btcPerBlockSats <= 0) return null;
  const total = Math.max(0, Math.ceil(targetSats / btcPerBlockSats));
  return Math.max(0, total - blocksMined);
}
