import { postJson } from "@/lib/http";
import { toDateString } from "../types";
import { API } from "./base";

/** Used to skip/invalidate per-clan caches that belong to a previous clan. */
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

/**
 * Pages the league's clan leaderboard for the clan's TH plus league-wide fund and weighted EE.
 * `weightedAvgDiscount` is a fraction (0.0615 = 6.15%).
 */
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
  let leagueWeightedEnergyEfficiency: number | null = null;
  let leagueWeightedAverageDiscount: number | null = null;

  while (true) {
    const response = await postJson<{
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
      btcFund = parseFloat(String(response.data.btcFund));
      totalMinedBlocks = Number(response.data.totalMinedBlocks ?? 0);
      leagueWeightedEnergyEfficiency =
        ((response.data as Record<string, unknown>).weightedEnergyEfficiencyPerTh as
          | number
          | null) ?? null;
      leagueWeightedAverageDiscount =
        ((response.data as Record<string, unknown>).weightedAvgDiscount as number | null) ?? null;
    }

    const allClans = [
      ...(response.data.clansPromoted ?? []),
      ...(response.data.clansRemaining ?? []),
      ...(response.data.clansRelegated ?? []),
    ];

    const mine = allClans.find((clan) => clan.clanId === myClanId);
    if (mine) {
      clanNftPower = mine.nftPower;
      break;
    }

    const totalCount = response.data.count ?? 0;
    skip += limit;
    if (skip >= totalCount || allClans.length < limit) break;
  }

  return {
    btcFund: btcFund ?? 0,
    totalMinedBlocks: totalMinedBlocks ?? 0,
    clanNftPower,
    leagueWeightedEE: leagueWeightedEnergyEfficiency,
    leagueWeightedAvgDiscount: leagueWeightedAverageDiscount,
  };
}

/** Clan name, logo and TH as listed on the given day's league leaderboard; null if absent. */
export async function getClanHeaderInfo(
  headers: Record<string, string>,
  calculatedAt: string,
  leagueId: number,
  myClanId: number,
): Promise<{ name: string; logoUrl: string | null; nftPower: number } | null> {
  const limit = 50;
  let skip = 0;

  while (true) {
    const response = await postJson<{
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
      ...(response.data.clansPromoted ?? []),
      ...(response.data.clansRemaining ?? []),
      ...(response.data.clansRelegated ?? []),
    ];
    const mine = allClans.find((clan) => clan.clanId === myClanId);
    if (mine?.clan)
      return {
        name: mine.clan.name,
        logoUrl: mine.clan.image ?? null,
        nftPower: mine.nftPower ?? 0,
      };

    const totalCount = response.data.count ?? 0;
    skip += limit;
    if (skip >= totalCount || allClans.length < limit) return null;
  }
}

/** Varying calculatedAt + leagueId walks any historical cycle's clan-leaderboard row. */
export async function getClanLeaderboardStats(
  headers: Record<string, string>,
  calculatedAt: string,
  leagueId: number,
  myClanId: number,
): Promise<{
  position: number | null;
  clanTerahash: number | null;
  blocksMined: number | null;
  btcMined: number | null;
} | null> {
  const limit = 50;
  let skip = 0;

  while (true) {
    const response = await postJson<{
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
      ...(response.data.clansPromoted ?? []),
      ...(response.data.clansRemaining ?? []),
      ...(response.data.clansRelegated ?? []),
    ];
    const mine = allClans.find((clan) => clan.clanId === myClanId);
    if (mine) {
      return {
        position: mine.position ?? null,
        clanTerahash: mine.nftPower ?? null,
        blocksMined: mine.blocksMined ?? null,
        btcMined: mine.btcMined ?? null,
      };
    }

    const totalCount = response.data.count ?? 0;
    skip += limit;
    if (skip >= totalCount || allClans.length < limit) break;
  }

  return null;
}

type ClanRosterMember = {
  id: number;
  alias: string;
  avatarUrl: string | null;
  th: number;
  ee: number | null;
};

/** Current members only, with today's TH/EE; the caller's own profile arrives separately. */
export async function getClanRoster(
  headers: Record<string, string>,
  clanId: number,
): Promise<ClanRosterMember[]> {
  const limit = 50;
  let skip = 0;
  const seen = new Map<number, ClanRosterMember>();

  while (true) {
    const response = await postJson<{
      data: {
        usersCount: number;
        myProfile: {
          id: number;
          alias: string;
          power: number;
          ee: number | null;
          avatar?: { smallImageUrl: string | null };
        } | null;
        usersForClient: Array<{
          id: number;
          alias: string;
          power: number;
          ee: number | null;
          avatar?: { smallImageUrl: string | null };
        }>;
      };
    }>(`${API}/api/nft-game/clan/get-by-id`, headers, {
      clanId,
      pagination: { limit, skip, count: 0 },
      filters: { filterType: "none" },
      sort: { sortType: "none" },
    });

    const raw = [response.data.myProfile, ...(response.data.usersForClient ?? [])].filter(
      (member): member is NonNullable<typeof member> => member != null,
    );
    for (const member of raw) {
      if (seen.has(member.id)) continue;
      seen.set(member.id, {
        id: member.id,
        alias: member.alias,
        avatarUrl: member.avatar?.smallImageUrl ?? null,
        th: member.power,
        ee: member.ee,
      });
    }

    const total = response.data.usersCount ?? seen.size;
    skip += limit;
    if (seen.size >= total || (response.data.usersForClient ?? []).length < limit) break;
  }

  return [...seen.values()];
}

/** Daily clan TH for the last 30 days, keyed by YYYY-MM-DD. */
export async function getClanPowerAnalytics(headers: Record<string, string>, clanId: number) {
  const response = await postJson<{
    data: Array<{ analyticsData: Array<{ date: string; power: number }> }>;
  }>(`${API}/api/nft-game/clan/analytics`, headers, {
    type: "default",
    clanId,
    timeRange: "30-days",
  });

  const map = new Map<string, number>();
  const clan = response.data?.[0];
  for (const entry of clan?.analyticsData ?? []) map.set(toDateString(entry.date), entry.power);
  return map;
}

/** Live TH and creation date; not historical. */
export async function getCurrentClanPower(
  headers: Record<string, string>,
  clanId: number,
): Promise<{ power: number | null; createdAt: string | null }> {
  const response = await postJson<{
    data: { power: number; createdAt?: string };
  }>(`${API}/api/nft-game/clan/get-by-id`, headers, {
    clanId,
    pagination: { limit: 10, skip: 0, count: 0 },
    filters: { filterType: "none" },
    sort: { sortType: "none" },
  });
  return {
    power: response.data?.power ?? null,
    createdAt: response.data?.createdAt ?? null,
  };
}
