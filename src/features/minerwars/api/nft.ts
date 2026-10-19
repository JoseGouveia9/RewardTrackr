import { postJson, resolveBonusMinerApiBase } from "@/lib/http";
import { API } from "./base";

let powerChartCache: { start: string; data: Map<string, number>; timestamp: number } | null = null;
const POWER_CHART_CACHE_TIME_TO_LIVE = 10 * 60 * 1000;

export function clearPowerChartCache(): void {
  powerChartCache = null;
}

/** Power-weighted average EE across owned NFTs plus the bonus miner (if any). */
export async function getMyNftAverageEnergyEfficiency(
  headers: Record<string, string>,
): Promise<number | null> {
  const [nftStats, bonusStats] = await Promise.all([
    getMyNftStats(headers),
    getBonusMinerStats(headers),
  ]);
  const nftPower = nftStats.totalPower;
  const nftEnergyEfficiency = nftStats.averageEnergyEfficiency;
  const bonusPower = bonusStats?.power ?? 0;
  const bonusEnergyEfficiency = bonusStats?.energyEfficiency ?? null;
  const totalPower = nftPower + bonusPower;
  if (totalPower <= 0) return null;
  const nftWeighted = nftEnergyEfficiency != null ? nftEnergyEfficiency * nftPower : 0;
  const bonusWeighted = bonusEnergyEfficiency != null ? bonusEnergyEfficiency * bonusPower : 0;
  if (nftEnergyEfficiency == null && bonusEnergyEfficiency == null) return null;
  return (nftWeighted + bonusWeighted) / totalPower;
}

/** Owned NFT count, total TH and power-weighted average EE (NFTs without EE are skipped). */
export async function getMyNftStats(
  headers: Record<string, string>,
): Promise<{ count: number; totalPower: number; averageEnergyEfficiency: number | null }> {
  const response = await postJson<{ data: { array: Array<Record<string, unknown>> } }>(
    `${API}/api/nft/get-my`,
    headers,
    {},
  );
  const nftRows = response.data?.array ?? [];
  let totalPower = 0;
  let weightedEnergyEfficiency = 0;
  let hasSomeEnergyEfficiency = false;
  for (const nft of nftRows) {
    const power = Number(nft.power ?? 0);
    totalPower += power;
    const energyEfficiency = nft.energyEfficiency != null ? Number(nft.energyEfficiency) : null;
    if (energyEfficiency != null && power > 0) {
      weightedEnergyEfficiency += power * energyEfficiency;
      hasSomeEnergyEfficiency = true;
    }
  }
  const averageEnergyEfficiency =
    hasSomeEnergyEfficiency && totalPower > 0 ? weightedEnergyEfficiency / totalPower : null;
  return { count: nftRows.length, totalPower, averageEnergyEfficiency };
}

/** Null when the user has no bonus miner or the request fails. */
export async function getBonusMinerStats(
  headers: Record<string, string>,
): Promise<{ power: number; energyEfficiency: number | null } | null> {
  try {
    const response = await postJson<{
      data: { miner?: { power?: number; energy_efficiency?: number } };
    }>(`${resolveBonusMinerApiBase()}/api/bonus-miner/client/find-one`, headers, {});
    const miner = response.data?.miner;
    const power = miner?.power;
    if (typeof power !== "number" || power <= 0) return null;
    const energyEfficiency =
      typeof miner?.energy_efficiency === "number" ? miner.energy_efficiency : null;
    return { power, energyEfficiency };
  } catch {
    return null;
  }
}

/**
 * Daily user TH keyed by date, cached for 10 min. A cache starting later than requested is
 * refetched from the earliest known start so a cached entry never shrinks its coverage.
 */
export async function getUserPowerChart(
  headers: Record<string, string>,
  cycleStartDate: string,
): Promise<Map<string, number>> {
  const requestStart = cycleStartDate.slice(0, 10);
  const now = Date.now();

  if (
    powerChartCache &&
    now - powerChartCache.timestamp < POWER_CHART_CACHE_TIME_TO_LIVE &&
    powerChartCache.start <= requestStart
  ) {
    return powerChartCache.data;
  }

  const fetchStart =
    powerChartCache && powerChartCache.start < requestStart ? powerChartCache.start : requestStart;

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const response = await postJson<{ data: Array<{ label: string; value: number }> }>(
    `${API}/api/nft/my-computing-power-chart`,
    headers,
    { start: fetchStart + "T00:00:00.000Z", end: end.toISOString() },
  );

  const map = new Map<string, number>();
  for (const entry of response.data ?? []) map.set(entry.label, entry.value);

  powerChartCache = { start: fetchStart, data: map, timestamp: now };
  return map;
}
