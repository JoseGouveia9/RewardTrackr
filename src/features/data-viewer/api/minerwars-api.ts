import { getJson, postJson, resolveApiBase } from "@/lib/http";
import { fetchDifficultyEpochs } from "@/features/export/api/difficulty-adjustments";
import {
  getCycleStartTuesdayUTC,
  cycleEndFromStart,
  toDateStr,
  type CycleInfo,
} from "../types/minerwars";
import { getActualIncomeFromBuildCache, resolveCycleStatus } from "../utils/minerwars-cache";

const API = resolveApiBase();

export const MULTIPLIERS = [1, 2, 4, 8, 16, 32, 64, 128, 256];

export type RoundRow = {
  roundId: number;
  multiplier: number;
  leagueId: number;
  clanId: number;
  endedAt: string;
  cycleId: number;
};

// Power chart cache is co-located here so clearPowerChartCache() is exported alongside getUserPowerChart.
let powerChartCache: { start: string; data: Map<string, number>; ts: number } | null = null;
const POWER_CHART_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export function clearPowerChartCache(): void {
  powerChartCache = null;
}

export async function getCycleRounds(
  headers: Record<string, string>,
  targetCycleId: number | null,
): Promise<{ cycleId: number | null; cycleStartDate: string | null; rounds: RoundRow[] }> {
  const limit = 40;
  let resolvedId: number | null = targetCycleId;
  let cycleStartDate: string | null = null;
  const collected: RoundRow[] = [];
  let skip = 0;

  while (true) {
    const res = await postJson<{ data: { array: Array<Record<string, unknown>> } }>(
      `${API}/api/nft-game/rewards-by-user`,
      headers,
      { filters: { type: "clan" }, pagination: { skip, limit } },
    );
    const array = res.data.array ?? [];
    if (array.length === 0) break;

    // Auto-detect: use the most recent cycle from the first page
    if (resolvedId === null) {
      resolvedId = array[0].cycleId as number;
      cycleStartDate = getCycleStartTuesdayUTC(array[0].endedAt as string);
    }

    for (const r of array) {
      if (r.cycleId === resolvedId) {
        collected.push({
          roundId: r.roundId as number,
          multiplier: r.multiplier as number,
          leagueId: r.leagueId as number,
          clanId: r.clanId as number,
          endedAt: r.endedAt as string,
          cycleId: r.cycleId as number,
        });
        if (!cycleStartDate) cycleStartDate = getCycleStartTuesdayUTC(r.endedAt as string);
      }
    }

    // Stop once we've passed the target cycle
    if (array.some((r) => (r.cycleId as number) < (resolvedId as number)) || array.length < limit)
      break;
    skip += limit;
  }

  return { cycleId: resolvedId, cycleStartDate, rounds: collected };
}

export async function fetchAllCyclesFromApi(headers: Record<string, string>): Promise<CycleInfo[]> {
  const limit = 40;
  let skip = 0;
  const seen = new Map<number, CycleInfo>();
  const TODAY = new Date().toISOString().slice(0, 10);

  while (true) {
    const res = await postJson<{ data: { array: Array<Record<string, unknown>> } }>(
      `${API}/api/nft-game/rewards-by-user`,
      headers,
      { filters: { type: "clan" }, pagination: { skip, limit } },
    );
    const array = res.data.array ?? [];
    if (array.length === 0) break;

    for (const r of array) {
      const id = r.cycleId as number;
      if (!seen.has(id)) {
        const cycleStart = getCycleStartTuesdayUTC(r.endedAt as string).slice(0, 10);
        const cycleEnd = cycleEndFromStart(cycleStart);
        seen.set(id, {
          cycleId: id,
          cycleStart,
          cycleEnd,
          status: resolveCycleStatus(cycleEnd, TODAY),
        });
      }
    }

    if (array.length < limit) break;
    skip += limit;
  }

  return [...seen.values()].sort((a, b) => b.cycleId - a.cycleId);
}

export async function getAllRoundsInCycle(
  headers: Record<string, string>,
  cycleId: number,
  leagueId: number,
) {
  const collected: Array<{ id: number; power: number; multiplier: number; active: boolean }> = [];
  const limit = 50;
  let skip = 0;
  let total: number | null = null;

  while (true) {
    const res = await postJson<{ data: { count: number; array: Array<Record<string, unknown>> } }>(
      `${API}/api/nft-game/round/find-by-cycleId`,
      headers,
      { cycleId, multipliers: MULTIPLIERS, pagination: { limit, skip, count: 0 }, leagueId },
    );
    if (total === null) total = res.data.count;
    const array = res.data.array ?? [];
    for (const r of array) {
      collected.push({
        id: r.id as number,
        power: Number(r.power ?? 0),
        multiplier: Number(r.multiplier ?? 0),
        active: Boolean(r.active),
      });
    }
    if (collected.length >= (total ?? 0) || array.length < limit) break;
    skip += limit;
  }

  return collected;
}

export async function getLivePrices(): Promise<{ btcPrice: number; gmtPrice: number }> {
  const [gmtRes, btcRes] = await Promise.all([
    getJson<{ data: { value: number } }>(`${API}/api/exchanges/getTokenPrice`),
    getJson<{ data: number }>(`${API}/api/exchanges/getPrice?symbol=BTC&value=1`),
  ]);
  return { gmtPrice: gmtRes.data?.value ?? 0, btcPrice: btcRes.data ?? 0 };
}

export async function getDiscountFactor(headers: Record<string, string>): Promise<number> {
  const res = await postJson<{
    data: {
      dailyMaintenanceDiscount?: number;
      levelDiscount?: number;
      discountByMaintenanceInGmt?: number;
    };
  }>(`${API}/api/user/get-my-nft-discount`, headers, {});
  const d = res.data ?? {};
  return (
    1 -
    ((d.dailyMaintenanceDiscount ?? 0) +
      (d.levelDiscount ?? 0) +
      (d.discountByMaintenanceInGmt ?? 0))
  );
}

export async function getMyNftAvgEE(headers: Record<string, string>): Promise<number | null> {
  const res = await postJson<{ data: { array: Array<{ energyEfficiency?: number }> } }>(
    `${API}/api/nft/get-my`,
    headers,
    {},
  );
  const vals = (res.data?.array ?? [])
    .map((n) => n.energyEfficiency)
    .filter((v): v is number => v != null && v > 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

export async function getCycleClanData(
  headers: Record<string, string>,
  calculatedAt: string,
  leagueId: number,
  myClanId: number,
) {
  const limit = 50;
  let skip = 0;
  let btcFund: number | null = null;
  let totalMinedBlocks: number | null = null;
  let clanNftPower: number | null = null;
  let leagueWeightedEE: number | null = null;

  while (true) {
    const res = await postJson<{
      data: {
        btcFund: unknown;
        totalMinedBlocks: unknown;
        count: number;
        clansPromoted?: Array<{ clanId: number; nftPower: number }>;
        clansRemaining?: Array<{ clanId: number; nftPower: number }>;
        clansRelegated?: Array<{ clanId: number; nftPower: number }>;
      };
    }>(`${API}/api/nft-game/clan-leaderboard/index-v2`, headers, {
      calculatedAt,
      leagueId,
      pagination: { skip, limit },
    });

    if (btcFund === null) {
      btcFund = parseFloat(String(res.data.btcFund));
      totalMinedBlocks = Number(res.data.totalMinedBlocks ?? 0);
      leagueWeightedEE =
        ((res.data as Record<string, unknown>).weightedEnergyEfficiencyPerTh as number | null) ??
        null;
    }

    const allClans = [
      ...(res.data.clansPromoted ?? []),
      ...(res.data.clansRemaining ?? []),
      ...(res.data.clansRelegated ?? []),
    ];

    const mine = allClans.find((c) => c.clanId === myClanId);
    if (mine) {
      clanNftPower = mine.nftPower;
      break;
    }

    const totalCount = res.data.count ?? 0;
    skip += limit;
    if (skip >= totalCount || allClans.length < limit) break;
  }

  return {
    btcFund: btcFund ?? 0,
    totalMinedBlocks: totalMinedBlocks ?? 0,
    clanNftPower,
    leagueWeightedEE,
  };
}

export async function getUserPowerChart(
  headers: Record<string, string>,
  cycleStartDate: string,
): Promise<Map<string, number>> {
  const reqStart = cycleStartDate.slice(0, 10);
  const now = Date.now();

  // Cache hit: data covers requested range and hasn't expired
  if (
    powerChartCache &&
    now - powerChartCache.ts < POWER_CHART_CACHE_TTL &&
    powerChartCache.start <= reqStart
  ) {
    return powerChartCache.data;
  }

  // Use the earliest known start (keep coverage if cache exists but is stale/shorter)
  const fetchStart =
    powerChartCache && powerChartCache.start < reqStart ? powerChartCache.start : reqStart;

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const res = await postJson<{ data: Array<{ label: string; value: number }> }>(
    `${API}/api/nft/my-computing-power-chart`,
    headers,
    { start: fetchStart + "T00:00:00.000Z", end: end.toISOString() },
  );

  const map = new Map<string, number>();
  for (const entry of res.data ?? []) map.set(entry.label, entry.value);

  powerChartCache = { start: fetchStart, data: map, ts: now };
  return map;
}

export async function getClanPowerAnalytics(headers: Record<string, string>, clanId: number) {
  const res = await postJson<{
    data: Array<{ analyticsData: Array<{ date: string; power: number }> }>;
  }>(`${API}/api/nft-game/clan/analytics`, headers, {
    type: "default",
    clanId,
    timeRange: "30-days",
  });

  const map = new Map<string, number>();
  const clan = res.data?.[0];
  for (const entry of clan?.analyticsData ?? []) map.set(toDateStr(entry.date), entry.power);
  return map;
}

export async function getCurrentClanPower(headers: Record<string, string>, clanId: number) {
  const res = await postJson<{ data: { power: number } }>(
    `${API}/api/nft-game/clan/get-by-id`,
    headers,
    {
      clanId,
      pagination: { limit: 10, skip: 0, count: 0 },
      filters: { filterType: "none" },
      sort: { sortType: "none" },
    },
  );
  return res.data?.power ?? null;
}

export async function getSoloMiningDates(
  headers: Record<string, string>,
  cycleStartDate: string,
  cycleEndDate: string,
) {
  // Add 1 extra day to endDate: solo income for the last cycle day is stored in the DB
  // around 00:10 UTC the *next* day (createdAt), so a window capped at cycleEndDate misses it.
  const endPlus1 = new Date(cycleEndDate);
  endPlus1.setUTCDate(endPlus1.getUTCDate() + 1);
  const endDateStr = endPlus1.toISOString().slice(0, 10);

  const res = await postJson<{
    data: { array: Array<{ incomeStatistic?: { calculatedAt?: string }; createdAt?: string }> };
  }>(`${API}/api/nft-income/find-aggregated-by-date`, headers, {
    startDate: `${cycleStartDate}T00:00:00.000Z`,
    endDate: `${endDateStr}T23:59:59.999Z`,
    limit: 20,
    skip: 0,
  });

  const dates = new Set<string>();
  for (const r of res.data?.array ?? []) {
    // calculatedAt reflects the actual day the income was for (always T23:59:59.999Z)
    const d = toDateStr(r.incomeStatistic?.calculatedAt ?? r.createdAt ?? "");
    if (d) dates.add(d);
  }
  return dates;
}

export async function getMinerWarsActualIncome(
  headers: Record<string, string>,
  cycleEnd: string,
): Promise<number | null> {
  // MinerWars payment is created ~00:10 UTC the day AFTER the cycle ends.
  // Using only that single day avoids picking up the previous cycle's payment
  // (which was created on cycleStart — the day after the prior cycle ended).
  const paymentDay = new Date(cycleEnd + "T00:00:00Z");
  paymentDay.setUTCDate(paymentDay.getUTCDate() + 1);
  const paymentDayStr = paymentDay.toISOString().slice(0, 10);

  // Fast path: read from the build-report localStorage cache if available
  const cached = getActualIncomeFromBuildCache(paymentDayStr);
  if (cached !== null) return cached;

  const res = await postJson<{
    data: {
      array: Array<{
        totalReward?: number;
        c1ValueInBtc?: number;
        c2ValueInBtc?: number;
        c1Value?: number;
        c2Value?: number;
        maintenanceByGmt?: boolean;
      }>;
    };
  }>(`${API}/api/nft-game/nft-game-income/find-aggregated-by-date`, headers, {
    startDate: `${paymentDayStr}T00:00:00.000Z`,
    endDate: `${paymentDayStr}T23:59:59.999Z`,
    limit: 20,
    skip: 0,
  });

  const records = res.data?.array ?? [];
  if (records.length === 0) return null;

  let total = 0;
  for (const r of records) {
    const netReward = r.totalReward ?? 0;
    const maintenanceByGmt = r.maintenanceByGmt ?? false;
    const c1Btc = r.c1ValueInBtc ?? r.c1Value ?? 0;
    const c2Btc = r.c2ValueInBtc ?? r.c2Value ?? 0;
    total += maintenanceByGmt ? netReward : netReward + c1Btc + c2Btc;
  }
  return total;
}

export async function getMempoolEpochs(cycleDates: string[]) {
  // Full Bitcoin history — no 3-month limit, no extra block lookups needed
  const epochs = await fetchDifficultyEpochs();

  const byDate = new Map<string, number>();
  for (const dateStr of cycleDates) {
    let applicable: (typeof epochs)[0] | null = null;
    for (const ep of epochs) {
      if (ep.date <= dateStr) applicable = ep;
    }
    if (applicable) byDate.set(dateStr, applicable.satsPerTH);
  }

  const latest = epochs[epochs.length - 1];
  return { byDate, latestSatsPerTH: latest?.satsPerTH ?? null };
}
