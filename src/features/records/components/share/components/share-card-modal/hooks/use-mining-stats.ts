import { useEffect, useState } from "react";
import { LOCAL_STORAGE_KEY_SYNC_TOKEN } from "@/lib/storage-keys";
import { buildApiHeaders } from "@/lib/http";
import { getMyNftStats, getBonusMinerStats } from "@/features/minerwars/api/nft";
import type { MiningStats } from "../types";

/**
 * Fetches NFT and bonus-miner stats for the card badge; efficiency is power-weighted across both.
 * Returns null when disabled, unauthenticated, empty, or on error.
 */
export function useMiningStats(enabled: boolean): MiningStats | null {
  const [miningStats, setMiningStats] = useState<MiningStats | null>(null);

  useEffect(() => {
    if (!enabled) {
      setMiningStats(null);
      return;
    }
    let cancelled = false;
    const token = sessionStorage.getItem(LOCAL_STORAGE_KEY_SYNC_TOKEN) ?? "";
    if (!token) return;
    const headers = buildApiHeaders(token);
    void (async () => {
      try {
        const [nftStats, bonusStats] = await Promise.all([
          getMyNftStats(headers),
          getBonusMinerStats(headers),
        ]);
        if (cancelled) return;
        const totalTerahash = nftStats.totalPower + (bonusStats?.power ?? 0);
        const totalMiners = nftStats.count + (bonusStats ? 1 : 0);
        let averageEnergyEfficiency: number | null = null;
        if (totalTerahash > 0) {
          let weightedSum = (nftStats.averageEnergyEfficiency ?? 0) * nftStats.totalPower;
          if (bonusStats?.energyEfficiency != null)
            weightedSum += bonusStats.energyEfficiency * bonusStats.power;
          const hasAnyEnergyEfficiency =
            nftStats.averageEnergyEfficiency != null || bonusStats?.energyEfficiency != null;
          if (hasAnyEnergyEfficiency) averageEnergyEfficiency = weightedSum / totalTerahash;
        }
        setMiningStats(
          totalTerahash > 0
            ? { miners: totalMiners, totalTerahash, averageEnergyEfficiency }
            : null,
        );
      } catch {
        if (!cancelled) setMiningStats(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return miningStats;
}
