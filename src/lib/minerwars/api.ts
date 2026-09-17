import {
  getJson,
  getJsonTolerant,
  postJson,
  resolveApiBase,
  resolveBonusMinerApiBase,
} from "@/lib/http";
import { mapWithConcurrency } from "@/lib/concurrency";
import { fetchDifficultyEpochs } from "./difficulty-adjustments";
import { getCycleStartTuesdayUTC, cycleEndFromStart, toDateStr, type CycleInfo } from "./types";
import { getActualIncomeFromBuildCache, resolveCycleStatus } from "./cache";

const API = resolveApiBase();
// RewardTrackr's own Worker — source of the daily BTC/GMT price snapshots stored in
// its PRICE_HISTORY KV (see workers/routes/prices.js). Same-origin in production; only
// needs an explicit base in local dev where the Vite dev server doesn't proxy /api/*.
const WORKER_URL =
  (import.meta.env.VITE_WORKER_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export const MULTIPLIERS = [1, 2, 4, 8, 16, 32, 64, 128, 256];

export type RoundRow = {
  roundId: number;
  blockNumber: number;
  multiplier: number;
  leagueId: number;
  clanId: number;
  endedAt: string;
  cycleId: number;
};

type RewardsByUserApiRow = Record<string, unknown>;

// Power chart cache is co-located here so clearPowerChartCache() is exported alongside getUserPowerChart.
let powerChartCache: { start: string; data: Map<string, number>; ts: number } | null = null;
const POWER_CHART_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Short-lived snapshot of rewards-by-user rows fetched by fetchAllCyclesFromApi().
// This lets the immediate follow-up comparison fetch reuse the same payload instead
// of calling the same endpoint again during manual refresh.
let rewardsByUserSnapshot: {
  auth: string;
  rows: RewardsByUserApiRow[];
  ts: number;
} | null = null;
const REWARDS_BY_USER_SNAPSHOT_TTL = 30 * 1000;

function readRewardsByUserSnapshot(headers: Record<string, string>): RewardsByUserApiRow[] | null {
  if (!rewardsByUserSnapshot) return null;
  const auth = headers.authorization ?? "";
  const age = Date.now() - rewardsByUserSnapshot.ts;
  if (rewardsByUserSnapshot.auth !== auth || age > REWARDS_BY_USER_SNAPSHOT_TTL) {
    rewardsByUserSnapshot = null;
    return null;
  }
  return rewardsByUserSnapshot.rows;
}

export function clearPowerChartCache(): void {
  powerChartCache = null;
}

export async function getCycleRounds(
  headers: Record<string, string>,
  targetCycleId: number | null,
): Promise<{ cycleId: number | null; cycleStartDate: string | null; rounds: RoundRow[] }> {
  const snapshotRows = readRewardsByUserSnapshot(headers);
  if (snapshotRows && snapshotRows.length > 0) {
    const resolvedId = targetCycleId ?? (snapshotRows[0]?.cycleId as number | null) ?? null;
    if (resolvedId != null) {
      const rounds: RoundRow[] = [];
      for (const r of snapshotRows) {
        if ((r.cycleId as number) !== resolvedId) continue;
        rounds.push({
          roundId: r.roundId as number,
          blockNumber: r.blockNumber as number,
          multiplier: r.multiplier as number,
          leagueId: r.leagueId as number,
          clanId: r.clanId as number,
          endedAt: r.endedAt as string,
          cycleId: r.cycleId as number,
        });
      }
      if (rounds.length > 0) {
        const cycleStartDate = await resolveCycleStartFromRounds(headers, resolvedId, rounds);
        return { cycleId: resolvedId, cycleStartDate, rounds };
      }
    }
  }

  const limit = 40;
  let resolvedId: number | null = targetCycleId;
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
    }

    for (const r of array) {
      if (r.cycleId === resolvedId) {
        collected.push({
          roundId: r.roundId as number,
          blockNumber: r.blockNumber as number,
          multiplier: r.multiplier as number,
          leagueId: r.leagueId as number,
          clanId: r.clanId as number,
          endedAt: r.endedAt as string,
          cycleId: r.cycleId as number,
        });
      }
    }

    // Stop once we've passed the target cycle
    if (array.some((r) => (r.cycleId as number) < (resolvedId as number)) || array.length < limit)
      break;
    skip += limit;
  }

  const cycleStartDate =
    resolvedId != null && collected.length > 0
      ? await resolveCycleStartFromRounds(headers, resolvedId, collected)
      : null;
  return { cycleId: resolvedId, cycleStartDate, rounds: collected };
}

// Derives a cycle's Tuesday start date from the actual round table (round/find-by-cycleId),
// using the EARLIEST round's startedAt. This avoids relying on any single user reward round's
// endedAt, since a late-settling round can have an endedAt that spills into the next calendar
// week and gets misclassified as belonging to the following cycle.
async function resolveCycleStartFromRounds(
  headers: Record<string, string>,
  cycleId: number,
  userRounds: RoundRow[],
): Promise<string | null> {
  const leagueId = userRounds[0]?.leagueId;
  if (leagueId == null) return null;
  const allCycleRounds = await getAllRoundsInCycle(headers, cycleId, leagueId).catch(() => []);
  const earliestStart = allCycleRounds
    .map((r) => r.startedAt)
    .filter((s): s is string => !!s)
    .sort()[0];
  return earliestStart ? `${earliestStart.slice(0, 10)}T00:00:00.000Z` : null;
}

// The clan the user is in right now — used to invalidate/skip stale per-clan caches
// (clan performance, clan trend) instead of mixing in data from a previous clan.
export async function getCurrentClanId(headers: Record<string, string>): Promise<number | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${API}/api/nft-game/clan/get-my`, {
      headers,
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { data?: { id?: number } | null };
    return json.data?.id ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchAllCyclesFromApi(headers: Record<string, string>): Promise<CycleInfo[]> {
  const limit = 40;
  let skip = 0;
  // Collect every round's endedAt per cycleId across ALL pages, then use the MEDIAN to
  // derive the week — robust against outlier rounds whose endedAt spills into a
  // neighboring calendar week (e.g. a late-settling round tagged with the old cycleId).
  const endedAtByCycle = new Map<number, string[]>();
  const allRows: RewardsByUserApiRow[] = [];
  const TODAY = new Date().toISOString().slice(0, 10);

  while (true) {
    const res = await postJson<{ data: { array: Array<Record<string, unknown>> } }>(
      `${API}/api/nft-game/rewards-by-user`,
      headers,
      { filters: { type: "clan" }, pagination: { skip, limit } },
    );
    const array = res.data.array ?? [];
    if (array.length === 0) break;
    allRows.push(...array);

    for (const r of array) {
      const id = r.cycleId as number;
      const list = endedAtByCycle.get(id) ?? [];
      list.push(r.endedAt as string);
      endedAtByCycle.set(id, list);
    }

    if (array.length < limit) break;
    skip += limit;
  }

  const seen = new Map<number, CycleInfo>();
  for (const [id, endedAtList] of endedAtByCycle) {
    const sorted = [...endedAtList].sort();
    const median = sorted[Math.floor(sorted.length / 2)];
    const cycleStart = getCycleStartTuesdayUTC(median).slice(0, 10);
    const cycleEnd = cycleEndFromStart(cycleStart);
    seen.set(id, {
      cycleId: id,
      cycleStart,
      cycleEnd,
      status: resolveCycleStatus(cycleEnd, TODAY),
    });
  }

  rewardsByUserSnapshot = {
    auth: headers.authorization ?? "",
    rows: allRows,
    ts: Date.now(),
  };

  return [...seen.values()].sort((a, b) => b.cycleId - a.cycleId);
}

export async function getAllRoundsInCycle(
  headers: Record<string, string>,
  cycleId: number,
  leagueId: number,
) {
  const collected: Array<{
    id: number;
    power: number;
    multiplier: number;
    active: boolean;
    startedAt: string | null;
    endedAt: string | null;
    winnerClanId: number | null;
  }> = [];
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
        startedAt: (r.startedAt as string) ?? null,
        endedAt: (r.endedAt as string) ?? null,
        winnerClanId: (r.winnerClanId as number | null) ?? null,
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

// Looks up RewardTrackr's stored BTC/GMT price snapshot for a single UTC date
// (YYYY-MM-DD). Returns null when nothing is stored for that date (e.g. not fetched
// yet, or already purged by the Worker's retention cleanup) — callers should fall back
// to a live price in that case.
async function getHistoricalPrice(
  date: string,
): Promise<{ btcUsd: number; gmtUsd: number } | null> {
  const res = await getJsonTolerant<{ btcUsd?: number; gmtUsd?: number }>(
    `${WORKER_URL}/api/prices/${date}`,
  ).catch(() => null);
  if (!res || typeof res.btcUsd !== "number" || typeof res.gmtUsd !== "number") return null;
  return { btcUsd: res.btcUsd, gmtUsd: res.gmtUsd };
}

// Batched lookup for a set of UTC dates, e.g. the "day after" each mined block in the
// live MinerWars cycle. Returns a map of only the dates that had a stored price —
// missing dates simply aren't in the returned map.
export async function getHistoricalPrices(
  dates: string[],
): Promise<Map<string, { btcUsd: number; gmtUsd: number }>> {
  const uniqueDates = [...new Set(dates)];
  const results = await mapWithConcurrency(uniqueDates, 5, async (date) => {
    const price = await getHistoricalPrice(date);
    return [date, price] as const;
  });
  const map = new Map<string, { btcUsd: number; gmtUsd: number }>();
  for (const [date, price] of results) {
    if (price) map.set(date, price);
  }
  return map;
}

export async function getDiscountFactor(
  headers: Record<string, string>,
): Promise<{ factor: number; gmtDiscount: number }> {
  const res = await postJson<{
    data: {
      dailyMaintenanceDiscount?: number;
      levelDiscount?: number;
      discountByMaintenanceInGmt?: number;
    };
  }>(`${API}/api/user/get-my-nft-discount`, headers, {});
  const d = res.data ?? {};
  const gmtDiscount = d.discountByMaintenanceInGmt ?? 0;
  return {
    factor: 1 - ((d.dailyMaintenanceDiscount ?? 0) + (d.levelDiscount ?? 0) + gmtDiscount),
    gmtDiscount,
  };
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

/** Returns count, total TH power, and power-weighted avg energy efficiency for all owned NFTs. */
export async function getMyNftStats(
  headers: Record<string, string>,
): Promise<{ count: number; totalPower: number; avgEE: number | null }> {
  const res = await postJson<{ data: { array: Array<Record<string, unknown>> } }>(
    `${API}/api/nft/get-my`,
    headers,
    {},
  );
  const arr = res.data?.array ?? [];
  let totalPower = 0;
  let weightedEE = 0;
  let hasSomeEE = false;
  for (const n of arr) {
    const p = Number(n.power ?? 0);
    totalPower += p;
    const ee = n.energyEfficiency != null ? Number(n.energyEfficiency) : null;
    if (ee != null && p > 0) {
      weightedEE += p * ee;
      hasSomeEE = true;
    }
  }
  const avgEE = hasSomeEE && totalPower > 0 ? weightedEE / totalPower : null;
  return { count: arr.length, totalPower, avgEE };
}

/** Returns the bonus miner power and energy efficiency (if the user has one). */
export async function getBonusMinerStats(
  headers: Record<string, string>,
): Promise<{ power: number; energyEfficiency: number | null } | null> {
  try {
    const res = await postJson<{
      data: { miner?: { power?: number; energy_efficiency?: number } };
    }>(`${resolveBonusMinerApiBase()}/api/bonus-miner/client/find-one`, headers, {});
    const miner = res.data?.miner;
    const power = miner?.power;
    if (typeof power !== "number" || power <= 0) return null;
    const energyEfficiency =
      typeof miner?.energy_efficiency === "number" ? miner.energy_efficiency : null;
    return { power, energyEfficiency };
  } catch {
    return null;
  }
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
  let leagueWeightedAvgDiscount: number | null = null;

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
      // Fraction (e.g. 0.061499 for 6.1499%) — the league's weighted average mining
      // discount, exposed directly by this endpoint.
      leagueWeightedAvgDiscount =
        ((res.data as Record<string, unknown>).weightedAvgDiscount as number | null) ?? null;
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
    leagueWeightedAvgDiscount,
  };
}

export type AbilityInfo = { priceInGMT: number; type: string };

let abilityCatalogCache: {
  data: Map<string, AbilityInfo>;
  boostX1ByDate: Array<{ from: string; to: string; value: number }>;
  ts: number;
} | null = null;
const ABILITY_CATALOG_CACHE_TTL = 30 * 60 * 1000;

async function loadAbilityCatalog(headers: Record<string, string>) {
  if (abilityCatalogCache && Date.now() - abilityCatalogCache.ts < ABILITY_CATALOG_CACHE_TTL) {
    return abilityCatalogCache;
  }
  const res = await postJson<{
    data: {
      array: Array<{
        id: string;
        name: string;
        type: string;
        priceInGMT?: number;
        data?: { value?: number };
        availableFrom?: string;
        availableTo?: string;
      }>;
    };
  }>(`${API}/api/nft-game/nft-game-ability/find-all`, headers, {});

  const array = res.data?.array ?? [];
  const data = new Map<string, AbilityInfo>();
  for (const ability of array)
    data.set(ability.id, { priceInGMT: ability.priceInGMT ?? 0, type: ability.type });

  const boostX1ByDate = array
    .filter((a) => a.name === "Boost X1")
    .map((a) => ({
      from: a.availableFrom ?? "",
      to: a.availableTo ?? "",
      value: a.data?.value ?? 2000,
    }));

  abilityCatalogCache = { data, boostX1ByDate, ts: Date.now() };
  return abilityCatalogCache;
}

// The ability catalog is versioned (the same boost gets new ids as its price/value change
// over time); this returns the priceInGMT/type for every id currently in the catalog.
export async function getAbilityCosts(
  headers: Record<string, string>,
): Promise<Map<string, AbilityInfo>> {
  return (await loadAbilityCatalog(headers)).data;
}

// The "Boost X1" ability's value field is the PPS denominator used by GoMining's own
// Power-Up / Clan Power-Up boost formulas. Versioned like the rest of the ability catalog,
// so the version active on `referenceDate` (not necessarily today) must be picked.
export async function getBoostX1Value(
  headers: Record<string, string>,
  referenceDate: string,
): Promise<number> {
  const { boostX1ByDate } = await loadAbilityCatalog(headers);
  const active = boostX1ByDate.find((v) => v.from <= referenceDate && referenceDate <= v.to);
  return active?.value ?? 2000;
}

export async function getClanHeaderInfo(
  headers: Record<string, string>,
  calculatedAt: string,
  leagueId: number,
  myClanId: number,
): Promise<{ name: string; logoUrl: string | null; nftPower: number } | null> {
  const limit = 50;
  let skip = 0;

  while (true) {
    const res = await postJson<{
      data: {
        count: number;
        clansPromoted?: Array<{
          clanId: number;
          nftPower: number;
          clan?: { name: string; image: string | null };
        }>;
        clansRemaining?: Array<{
          clanId: number;
          nftPower: number;
          clan?: { name: string; image: string | null };
        }>;
        clansRelegated?: Array<{
          clanId: number;
          nftPower: number;
          clan?: { name: string; image: string | null };
        }>;
      };
    }>(`${API}/api/nft-game/clan-leaderboard/index-v2`, headers, {
      calculatedAt,
      leagueId,
      pagination: { skip, limit },
    });

    const allClans = [
      ...(res.data.clansPromoted ?? []),
      ...(res.data.clansRemaining ?? []),
      ...(res.data.clansRelegated ?? []),
    ];
    const mine = allClans.find((c) => c.clanId === myClanId);
    if (mine?.clan)
      return {
        name: mine.clan.name,
        logoUrl: mine.clan.image ?? null,
        nftPower: mine.nftPower ?? 0,
      };

    const totalCount = res.data.count ?? 0;
    skip += limit;
    if (skip >= totalCount || allClans.length < limit) return null;
  }
}

// Per-clan blocksMined/btcMined/position/nftPower snapshot at a given point in time —
// varying calculatedAt + leagueId walks through any historical cycle's clan-leaderboard
// row. Used to build the clan trend/position display from real data instead of the
// passive comparison cache.
export async function getClanLeaderboardStats(
  headers: Record<string, string>,
  calculatedAt: string,
  leagueId: number,
  myClanId: number,
): Promise<{
  position: number | null;
  clanTh: number | null;
  blocksMined: number | null;
  btcMined: number | null;
} | null> {
  const limit = 50;
  let skip = 0;

  while (true) {
    const res = await postJson<{
      data: {
        count: number;
        clansPromoted?: Array<{
          clanId: number;
          position?: number;
          nftPower?: number;
          blocksMined?: number;
          btcMined?: number;
        }>;
        clansRemaining?: Array<{
          clanId: number;
          position?: number;
          nftPower?: number;
          blocksMined?: number;
          btcMined?: number;
        }>;
        clansRelegated?: Array<{
          clanId: number;
          position?: number;
          nftPower?: number;
          blocksMined?: number;
          btcMined?: number;
        }>;
      };
    }>(`${API}/api/nft-game/clan-leaderboard/index-v2`, headers, {
      calculatedAt,
      leagueId,
      pagination: { skip, limit },
    });

    const allClans = [
      ...(res.data.clansPromoted ?? []),
      ...(res.data.clansRemaining ?? []),
      ...(res.data.clansRelegated ?? []),
    ];
    const mine = allClans.find((clan) => clan.clanId === myClanId);
    if (mine) {
      return {
        position: mine.position ?? null,
        clanTh: mine.nftPower ?? null,
        blocksMined: mine.blocksMined ?? null,
        btcMined: mine.btcMined ?? null,
      };
    }

    const totalCount = res.data.count ?? 0;
    skip += limit;
    if (skip >= totalCount || allClans.length < limit) break;
  }

  return null;
}

export type ClanRosterMember = {
  id: number;
  alias: string;
  avatarUrl: string | null;
  th: number;
  ee: number | null;
  // When they joined the clan — used to exclude rounds the clan won before this member
  // was actually a member from their share of the reward.
  joinDate: string;
};

export async function getClanRoster(
  headers: Record<string, string>,
  clanId: number,
): Promise<ClanRosterMember[]> {
  const limit = 50;
  let skip = 0;
  const seen = new Map<number, ClanRosterMember>();

  while (true) {
    const res = await postJson<{
      data: {
        usersCount: number;
        myProfile: {
          id: number;
          alias: string;
          power: number;
          ee: number | null;
          joinDate: string;
          avatar?: { smallImageUrl: string | null };
        } | null;
        usersForClient: Array<{
          id: number;
          alias: string;
          power: number;
          ee: number | null;
          joinDate: string;
          avatar?: { smallImageUrl: string | null };
        }>;
      };
    }>(`${API}/api/nft-game/clan/get-by-id`, headers, {
      clanId,
      pagination: { limit, skip, count: 0 },
      filters: { filterType: "none" },
      sort: { sortType: "none" },
    });

    const raw = [res.data.myProfile, ...(res.data.usersForClient ?? [])].filter(
      (m): m is NonNullable<typeof m> => m != null,
    );
    for (const m of raw) {
      if (seen.has(m.id)) continue;
      seen.set(m.id, {
        id: m.id,
        alias: m.alias,
        avatarUrl: m.avatar?.smallImageUrl ?? null,
        th: m.power,
        ee: m.ee,
        joinDate: m.joinDate,
      });
    }

    const total = res.data.usersCount ?? seen.size;
    skip += limit;
    if (seen.size >= total || (res.data.usersForClient ?? []).length < limit) break;
  }

  return [...seen.values()];
}

export type ClanDailyEarner = {
  userId: number;
  alias: string;
  avatarUrl: string | null;
  blocksMined: number;
  // TH as of `calculatedAt` — unlike clan/get-by-id's `power` (always live), this reflects
  // the member's actual power on that specific day, which is what a "done" cycle needs.
  nftPower: number;
  usedAbilities: Array<{ nftGameAbilityId: string; count: number }>;
};

// user-leaderboard/index has no history by date alone — it only ever returns today's
// snapshot unless `leagueId` is included, in which case it returns that league's board as
// of `calculatedAt`. leagueId must be the clan's league AS OF that specific day (leagues
// change cycle to cycle), the same resolution getClanHeaderInfo() relies on.
//
// Scans one day's leaderboard for participants currently tagged with `clanId` (the tag
// reflects clan membership as of that day, so a member who has since left still shows up
// here — that's how the UI can flag them as "left").
async function getDailyClanEarnersForDate(
  headers: Record<string, string>,
  calculatedAt: string,
  leagueId: number,
  clanId: number,
): Promise<{ earners: ClanDailyEarner[]; gmtFund: number; totalMinedBlocks: number }> {
  const limit = 50;
  let skip = 0;
  const earners: ClanDailyEarner[] = [];
  let gmtFund = 0;
  let totalMinedBlocks = 0;

  while (true) {
    const res = await postJson<{
      data: {
        count: number;
        gmtFund: number;
        totalMinedBlocks: number;
        me: {
          user: { userId: number; alias: string; image: string | null };
          clanId: number;
          blocksMined: number;
          nftPower?: number;
          usedAbilities: Array<{ nftGameAbilityId: string; count: number }>;
        } | null;
        participants: Array<{
          user: { userId: number; alias: string; image: string | null };
          clanId: number;
          blocksMined: number;
          nftPower?: number;
          usedAbilities: Array<{ nftGameAbilityId: string; count: number }>;
        }>;
      };
    }>(`${API}/api/nft-game/user-leaderboard/index`, headers, {
      calculatedAt,
      leagueId,
      pagination: { skip, limit },
    });

    if (skip === 0) {
      gmtFund = res.data.gmtFund ?? 0;
      totalMinedBlocks = res.data.totalMinedBlocks ?? 0;
      if (res.data.me && res.data.me.clanId === clanId) {
        earners.push({
          userId: res.data.me.user.userId,
          alias: res.data.me.user.alias,
          avatarUrl: res.data.me.user.image,
          blocksMined: res.data.me.blocksMined,
          nftPower: res.data.me.nftPower ?? 0,
          usedAbilities: res.data.me.usedAbilities ?? [],
        });
      }
    }

    for (const p of res.data.participants ?? []) {
      if (p.clanId !== clanId) continue;
      earners.push({
        userId: p.user.userId,
        alias: p.user.alias,
        avatarUrl: p.user.image,
        blocksMined: p.blocksMined,
        nftPower: p.nftPower ?? 0,
        usedAbilities: p.usedAbilities ?? [],
      });
    }

    const total = res.data.count ?? 0;
    skip += limit;
    if (skip >= total || (res.data.participants ?? []).length < limit) break;
  }

  return { earners, gmtFund, totalMinedBlocks };
}

export async function getClanEarnersForCycle(
  headers: Record<string, string>,
  clanId: number,
  leagueId: number,
  cycleDates: string[],
): Promise<
  Map<
    number,
    {
      alias: string;
      avatarUrl: string | null;
      blocksMined: number;
      nftPower: number;
      gmtRewards: number;
      abilityCounts: Map<string, number>;
    }
  >
> {
  const byUser = new Map<
    number,
    {
      alias: string;
      avatarUrl: string | null;
      blocksMined: number;
      nftPower: number;
      gmtRewards: number;
      abilityCounts: Map<string, number>;
    }
  >();

  // blocksMined/usedAbilities returned for a given calculatedAt are already the running
  // total for the cycle as of that date (not a per-day delta) — so only the latest
  // available day needs to be queried, not every day in the cycle.
  const latestDate = cycleDates[cycleDates.length - 1];
  if (!latestDate) return byUser;

  const { earners, gmtFund, totalMinedBlocks } = await getDailyClanEarnersForDate(
    headers,
    latestDate,
    leagueId,
    clanId,
  ).catch(() => ({ earners: [] as ClanDailyEarner[], gmtFund: 0, totalMinedBlocks: 0 }));
  // The API's own per-participant gmtRewards field stays 0 in this snapshot, so the
  // personal GMT reward is derived the same way GoMining computes it: each user's slice of
  // the cycle's gmtFund, proportional to the blocks they mined.
  const gmtPerBlock = totalMinedBlocks > 0 ? gmtFund / totalMinedBlocks : 0;

  for (const earner of earners) {
    byUser.set(earner.userId, {
      alias: earner.alias,
      avatarUrl: earner.avatarUrl,
      blocksMined: earner.blocksMined,
      nftPower: earner.nftPower,
      gmtRewards: earner.blocksMined * gmtPerBlock,
      abilityCounts: new Map(earner.usedAbilities.map((a) => [a.nftGameAbilityId, a.count])),
    });
  }

  return byUser;
}

// A round's reward is only shared among clan members who actually appear in that specific
// round's leaderboard (score > 0 = had power in it) — not every current/roster member.
// Capped at 50/page by the API; a round can have hundreds/thousands of participants across
// ALL clans (this endpoint has no server-side clan filter), so pages are fetched in
// parallel (bounded) once the total count is known from page 1.
const ROUND_PARTICIPANTS_PAGE_CONCURRENCY = 8;

export async function getRoundClanParticipants(
  headers: Record<string, string>,
  roundId: number,
  clanId: number,
): Promise<Map<number, number>> {
  const limit = 50;
  const scoreByUser = new Map<number, number>();

  type LeaderboardPage = {
    data: {
      count: number;
      me: { user: { id: number }; clan?: { id: number }; score: number } | null;
      participants: Array<{ user: { id: number }; clan?: { id: number }; score: number }>;
    };
  };

  function applyPage(res: LeaderboardPage, skip: number): void {
    if (skip === 0 && res.data.me && res.data.me.clan?.id === clanId) {
      scoreByUser.set(res.data.me.user.id, res.data.me.score ?? 0);
    }
    for (const p of res.data.participants ?? []) {
      if (p.clan?.id !== clanId) continue;
      scoreByUser.set(p.user.id, p.score ?? 0);
    }
  }

  const firstPage = await postJson<LeaderboardPage>(
    `${API}/api/nft-game/round/user-leaderboard`,
    headers,
    {
      roundId,
      pagination: { skip: 0, limit, count: 0 },
    },
  );
  applyPage(firstPage, 0);

  const total = firstPage.data.count ?? 0;
  const pageCount = Math.ceil(total / limit);
  if (pageCount > 1) {
    const remainingSkips = Array.from({ length: pageCount - 1 }, (_, i) => (i + 1) * limit);
    await mapWithConcurrency(remainingSkips, ROUND_PARTICIPANTS_PAGE_CONCURRENCY, async (skip) => {
      const res = await postJson<LeaderboardPage>(
        `${API}/api/nft-game/round/user-leaderboard`,
        headers,
        {
          roundId,
          pagination: { skip, limit, count: 0 },
        },
      );
      applyPage(res, skip);
    });
  }

  return scoreByUser;
}

const LEAGUE_LEADERBOARD_PAGE_CONCURRENCY = 8;

export type LeagueThEntry = { th: number; alias: string | null };

// Whole-league TH-by-user snapshot as of `calculatedAt`, unfiltered by clan — used by
// getClanThByDate() to look up the TH of clan-round participants (who may since have
// left the clan, or the clan's roster endpoint may not reflect their historical TH).
async function getLeagueThByUser(
  headers: Record<string, string>,
  calculatedAt: string,
  leagueId: number,
): Promise<Map<number, LeagueThEntry>> {
  const limit = 50;

  type LeaderboardPage = {
    data: {
      count: number;
      me: { user: { userId: number; alias: string }; nftPower?: number } | null;
      participants: Array<{ user: { userId: number; alias: string }; nftPower?: number }>;
    };
  };

  const map = new Map<number, LeagueThEntry>();
  function applyPage(res: LeaderboardPage, skip: number): void {
    if (skip === 0 && res.data.me?.user?.userId != null) {
      map.set(res.data.me.user.userId, {
        th: res.data.me.nftPower ?? 0,
        alias: res.data.me.user.alias ?? null,
      });
    }
    for (const p of res.data.participants ?? []) {
      if (p.user?.userId != null)
        map.set(p.user.userId, { th: p.nftPower ?? 0, alias: p.user.alias ?? null });
    }
  }

  const firstPage = await postJson<LeaderboardPage>(
    `${API}/api/nft-game/user-leaderboard/index`,
    headers,
    {
      calculatedAt,
      leagueId,
      pagination: { skip: 0, limit },
    },
  );
  applyPage(firstPage, 0);

  const total = firstPage.data.count ?? 0;
  const pageCount = Math.ceil(total / limit);
  if (pageCount > 1) {
    const remainingSkips = Array.from({ length: pageCount - 1 }, (_, i) => (i + 1) * limit);
    await mapWithConcurrency(remainingSkips, LEAGUE_LEADERBOARD_PAGE_CONCURRENCY, async (skip) => {
      const res = await postJson<LeaderboardPage>(
        `${API}/api/nft-game/user-leaderboard/index`,
        headers,
        {
          calculatedAt,
          leagueId,
          pagination: { skip, limit },
        },
      );
      applyPage(res, skip);
    });
  }

  return map;
}

const CLAN_TH_BY_DATE_CONCURRENCY = 4;

// Day-by-day clan TH reconstruction for a past cycle, from actual round participants —
// mirrors the live-cycle behavior (getClanPowerAnalytics-style day resolution) so a member
// who joined/left mid-cycle doesn't apply their current TH to days they weren't present.
// Returns the per-user breakdown (not just the clan-wide sum) so callers that need each
// individual member's historical TH (e.g. clan-performance's per-member reward split) can
// reuse the exact same day-level snapshot the personal comparison view is built from.
export async function getClanThByUserByDate(
  headers: Record<string, string>,
  completedRounds: Array<{ id: number; endedAt: string | null }>,
  leagueId: number,
  clanId: number,
  calculatedAt: string,
): Promise<Map<string, Map<number, number>>> {
  // Sample the FIRST round of each day, not the last — matches real CSV settlement data.
  const firstRoundByDate = new Map<string, { id: number; endedAt: string }>();
  for (const round of completedRounds) {
    if (!round.endedAt) continue;
    const dateStr = toDateStr(round.endedAt);
    const prev = firstRoundByDate.get(dateStr);
    if (!prev || round.endedAt < prev.endedAt) {
      firstRoundByDate.set(dateStr, { id: round.id, endedAt: round.endedAt });
    }
  }
  if (firstRoundByDate.size === 0) return new Map();

  const leagueThByUser = await getLeagueThByUser(headers, calculatedAt, leagueId).catch(
    () => new Map<number, LeagueThEntry>(),
  );

  const map = new Map<string, Map<number, number>>();
  await mapWithConcurrency(
    [...firstRoundByDate.entries()],
    CLAN_TH_BY_DATE_CONCURRENCY,
    async ([dateStr, round]) => {
      const participants = await getRoundClanParticipants(headers, round.id, clanId).catch(
        () => new Map<number, number>(),
      );
      if (participants.size === 0) return;
      const byUser = new Map<number, number>();
      for (const userId of participants.keys()) {
        const th = leagueThByUser.get(userId)?.th ?? 0;
        if (th > 0) byUser.set(userId, th);
      }
      if (byUser.size > 0) map.set(dateStr, byUser);
    },
  );
  return map;
}

// mirrors the live-cycle behavior (getClanPowerAnalytics-style day resolution) so a member
// who joined/left mid-cycle doesn't apply their current TH to days they weren't present.
export async function getClanThByDate(
  headers: Record<string, string>,
  completedRounds: Array<{ id: number; endedAt: string | null }>,
  leagueId: number,
  clanId: number,
  calculatedAt: string,
): Promise<Map<string, number>> {
  const byUserByDate = await getClanThByUserByDate(
    headers,
    completedRounds,
    leagueId,
    clanId,
    calculatedAt,
  );
  const map = new Map<string, number>();
  for (const [dateStr, byUser] of byUserByDate) {
    let total = 0;
    for (const th of byUser.values()) total += th;
    if (total > 0) map.set(dateStr, total);
  }
  return map;
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

export async function getCurrentClanPower(
  headers: Record<string, string>,
  clanId: number,
): Promise<{ power: number | null; myJoinDate: string | null; createdAt: string | null }> {
  const res = await postJson<{
    data: { power: number; createdAt?: string; myProfile: { joinDate: string | null } | null };
  }>(`${API}/api/nft-game/clan/get-by-id`, headers, {
    clanId,
    pagination: { limit: 10, skip: 0, count: 0 },
    filters: { filterType: "none" },
    sort: { sortType: "none" },
  });
  return {
    power: res.data?.power ?? null,
    // null for the clan's owner/creator (they never "joined" — use the clan's createdAt instead).
    myJoinDate: res.data?.myProfile?.joinDate ?? null,
    createdAt: res.data?.createdAt ?? null,
  };
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
      if (ep.date < dateStr) applicable = ep;
    }
    if (applicable) byDate.set(dateStr, applicable.satsPerTH);
  }

  const latest = epochs[epochs.length - 1];
  return { byDate, latestSatsPerTH: latest?.satsPerTH ?? null };
}
