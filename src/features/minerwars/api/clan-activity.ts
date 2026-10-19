import { postJson } from "@/lib/http";
import { mapWithConcurrency } from "@/lib/concurrency";
import { toDateString } from "../types";
import { API } from "./base";

type ClanDailyEarner = {
  userId: number;
  alias: string;
  avatarUrl: string | null;
  blocksMined: number;
  nftPower: number;
  usedAbilities: Array<{ nftGameAbilityId: string; count: number }>;
};

/**
 * user-leaderboard/index only returns history when `leagueId` (the clan's league on that
 * day) is passed; clanId reflects membership that day, so members who since left still appear.
 * `nftPower` is the TH on that day, unlike clan/get-by-id's always-live `power`.
 */
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
    const response = await postJson<{
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
      gmtFund = response.data.gmtFund ?? 0;
      totalMinedBlocks = response.data.totalMinedBlocks ?? 0;
      if (response.data.me && response.data.me.clanId === clanId) {
        earners.push({
          userId: response.data.me.user.userId,
          alias: response.data.me.user.alias,
          avatarUrl: response.data.me.user.image,
          blocksMined: response.data.me.blocksMined,
          nftPower: response.data.me.nftPower ?? 0,
          usedAbilities: response.data.me.usedAbilities ?? [],
        });
      }
    }

    for (const participant of response.data.participants ?? []) {
      if (participant.clanId !== clanId) continue;
      earners.push({
        userId: participant.user.userId,
        alias: participant.user.alias,
        avatarUrl: participant.user.image,
        blocksMined: participant.blocksMined,
        nftPower: participant.nftPower ?? 0,
        usedAbilities: participant.usedAbilities ?? [],
      });
    }

    const total = response.data.count ?? 0;
    skip += limit;
    if (skip >= total || (response.data.participants ?? []).length < limit) break;
  }

  return { earners, gmtFund, totalMinedBlocks };
}

type ClanEarnerSummary = {
  alias: string;
  avatarUrl: string | null;
  blocksMined: number;
  nftPower: number;
  gmtRewards: number;
  abilityCounts: Map<string, number>;
};

/**
 * blocksMined/usedAbilities are cumulative as of calculatedAt, so only the latest day is queried.
 * The API's per-participant gmtRewards is 0, so it is derived as the blocks share of gmtFund.
 */
export async function getClanEarnersForCycle(
  headers: Record<string, string>,
  clanId: number,
  leagueId: number,
  cycleDates: string[],
): Promise<Map<number, ClanEarnerSummary>> {
  const byUser = new Map<number, ClanEarnerSummary>();

  const latestDate = cycleDates[cycleDates.length - 1];
  if (!latestDate) return byUser;

  const { earners, gmtFund, totalMinedBlocks } = await getDailyClanEarnersForDate(
    headers,
    latestDate,
    leagueId,
    clanId,
  ).catch(() => ({ earners: [] as ClanDailyEarner[], gmtFund: 0, totalMinedBlocks: 0 }));
  const gmtPerBlock = totalMinedBlocks > 0 ? gmtFund / totalMinedBlocks : 0;

  for (const earner of earners) {
    byUser.set(earner.userId, {
      alias: earner.alias,
      avatarUrl: earner.avatarUrl,
      blocksMined: earner.blocksMined,
      nftPower: earner.nftPower,
      gmtRewards: earner.blocksMined * gmtPerBlock,
      abilityCounts: new Map(
        earner.usedAbilities.map((ability) => [ability.nftGameAbilityId, ability.count]),
      ),
    });
  }

  return byUser;
}

const ROUND_PARTICIPANTS_PAGE_CONCURRENCY = 8;

/**
 * Only members in a round's own leaderboard (score > 0) share its reward. The endpoint has no
 * clan filter and spans all clans, so pages after the first are fetched in parallel.
 */
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

  function applyPage(response: LeaderboardPage, skip: number): void {
    if (skip === 0 && response.data.me && response.data.me.clan?.id === clanId) {
      scoreByUser.set(response.data.me.user.id, response.data.me.score ?? 0);
    }
    for (const participant of response.data.participants ?? []) {
      if (participant.clan?.id !== clanId) continue;
      scoreByUser.set(participant.user.id, participant.score ?? 0);
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
    const remainingSkips = Array.from({ length: pageCount - 1 }, (_, index) => (index + 1) * limit);
    await mapWithConcurrency(remainingSkips, ROUND_PARTICIPANTS_PAGE_CONCURRENCY, async (skip) => {
      const response = await postJson<LeaderboardPage>(
        `${API}/api/nft-game/round/user-leaderboard`,
        headers,
        {
          roundId,
          pagination: { skip, limit, count: 0 },
        },
      );
      applyPage(response, skip);
    });
  }

  return scoreByUser;
}

const LEAGUE_LEADERBOARD_PAGE_CONCURRENCY = 8;

type LeagueTerahashEntry = { terahash: number; alias: string | null };

/** Unfiltered by clan: round participants may have since left the clan. */
async function getLeagueTerahashByUser(
  headers: Record<string, string>,
  calculatedAt: string,
  leagueId: number,
): Promise<Map<number, LeagueTerahashEntry>> {
  const limit = 50;

  type LeaderboardPage = {
    data: {
      count: number;
      me: { user: { userId: number; alias: string }; nftPower?: number } | null;
      participants: Array<{ user: { userId: number; alias: string }; nftPower?: number }>;
    };
  };

  const map = new Map<number, LeagueTerahashEntry>();
  function applyPage(response: LeaderboardPage, skip: number): void {
    if (skip === 0 && response.data.me?.user?.userId != null) {
      map.set(response.data.me.user.userId, {
        terahash: response.data.me.nftPower ?? 0,
        alias: response.data.me.user.alias ?? null,
      });
    }
    for (const participant of response.data.participants ?? []) {
      if (participant.user?.userId != null)
        map.set(participant.user.userId, {
          terahash: participant.nftPower ?? 0,
          alias: participant.user.alias ?? null,
        });
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
    const remainingSkips = Array.from({ length: pageCount - 1 }, (_, index) => (index + 1) * limit);
    await mapWithConcurrency(remainingSkips, LEAGUE_LEADERBOARD_PAGE_CONCURRENCY, async (skip) => {
      const response = await postJson<LeaderboardPage>(
        `${API}/api/nft-game/user-leaderboard/index`,
        headers,
        {
          calculatedAt,
          leagueId,
          pagination: { skip, limit },
        },
      );
      applyPage(response, skip);
    });
  }

  return map;
}

const CLAN_TERAHASH_BY_DATE_CONCURRENCY = 4;

/**
 * Per-user TH for each day of a past cycle, taken from the day's first round's participants,
 * so members who joined/left mid-cycle don't get today's TH on days they weren't present.
 * The day's first (not last) round is used, matching the settlement CSV.
 */
export async function getClanTerahashByUserByDate(
  headers: Record<string, string>,
  completedRounds: Array<{ id: number; endedAt: string | null }>,
  leagueId: number,
  clanId: number,
  calculatedAt: string,
): Promise<Map<string, Map<number, number>>> {
  const firstRoundByDate = new Map<string, { id: number; endedAt: string }>();
  for (const round of completedRounds) {
    if (!round.endedAt) continue;
    const dateString = toDateString(round.endedAt);
    const previousRound = firstRoundByDate.get(dateString);
    if (!previousRound || round.endedAt < previousRound.endedAt) {
      firstRoundByDate.set(dateString, { id: round.id, endedAt: round.endedAt });
    }
  }
  if (firstRoundByDate.size === 0) return new Map();

  const leagueTerahashByUser = await getLeagueTerahashByUser(headers, calculatedAt, leagueId).catch(
    () => new Map<number, LeagueTerahashEntry>(),
  );

  const map = new Map<string, Map<number, number>>();
  await mapWithConcurrency(
    [...firstRoundByDate.entries()],
    CLAN_TERAHASH_BY_DATE_CONCURRENCY,
    async ([dateString, round]) => {
      const participants = await getRoundClanParticipants(headers, round.id, clanId).catch(
        () => new Map<number, number>(),
      );
      if (participants.size === 0) return;
      const byUser = new Map<number, number>();
      for (const userId of participants.keys()) {
        const terahash = leagueTerahashByUser.get(userId)?.terahash ?? 0;
        if (terahash > 0) byUser.set(userId, terahash);
      }
      if (byUser.size > 0) map.set(dateString, byUser);
    },
  );
  return map;
}

/** Sums the per-user TH of each day; days with no known TH are omitted. */
export async function getClanTerahashByDate(
  headers: Record<string, string>,
  completedRounds: Array<{ id: number; endedAt: string | null }>,
  leagueId: number,
  clanId: number,
  calculatedAt: string,
): Promise<Map<string, number>> {
  const byUserByDate = await getClanTerahashByUserByDate(
    headers,
    completedRounds,
    leagueId,
    clanId,
    calculatedAt,
  );
  const map = new Map<string, number>();
  for (const [dateString, byUser] of byUserByDate) {
    let total = 0;
    for (const terahash of byUser.values()) total += terahash;
    if (total > 0) map.set(dateString, total);
  }
  return map;
}
