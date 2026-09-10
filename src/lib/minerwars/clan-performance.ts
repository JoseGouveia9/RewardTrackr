import { buildApiHeaders } from "@/lib/http";
import { mapWithConcurrency } from "@/lib/concurrency";
import { getCycleStartTuesdayUTC } from "./types";
import {
  getAbilityCosts,
  getAllRoundsInCycle,
  getBoostX1Value,
  getClanEarnersForCycle,
  getClanHeaderInfo,
  getClanLeaderboardStats,
  getClanRoster,
  getCycleClanData,
  getCycleRounds,
  getRoundClanParticipants,
} from "./api";
import {
  loadPersistedClanPerformance,
  loadRoundParticipants,
  persistClanPerformance,
  persistRoundParticipants,
} from "./cache";
import type { ClanMemberPerformance, ClanPerformance } from "./clan-types";

// Base energy efficiency GoMining's PPS formula is normalized against.
const BASE_EE = 20;
// Power-Up boost value = 0.7 × your PPS × 100 × (1 / current Boost X1 value).
const POWER_UP_PROFIT_RATIO = 0.7;
const POWER_UP_MULTIPLIER = 100;

const cache = new Map<number, { data: ClanPerformance; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;
const inFlight = new Map<number, Promise<ClanPerformance>>();

function datesInCycle(cycleStart: string, cycleEnd: string): string[] {
  const today = new Date().toISOString().slice(0, 10);
  const dates: string[] = [];
  const cursor = new Date(`${cycleStart}T00:00:00Z`);
  const end = new Date(`${cycleEnd}T00:00:00Z`);
  while (cursor <= end) {
    const d = cursor.toISOString().slice(0, 10);
    if (d <= today) dates.push(d);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

// Reads whatever was persisted the last time fetchClanPerformance() ran for this cycle,
// without hitting the network.
export function getCachedClanPerformance(cycleId: number): ClanPerformance | null {
  const inMemory = cache.get(cycleId);
  if (inMemory) return inMemory.data;
  return loadPersistedClanPerformance(cycleId);
}

// Rounds whose participants aren't cached yet are fetched concurrently (bounded batch) —
// fetching them one-at-a-time would mean a clan that won N rounds this cycle pays N
// sequential round-trips just for this step, which would dominate the whole fetch cost.
const PARTICIPANTS_FETCH_CONCURRENCY = 6;

// Same per-round formula the individual comparison view uses, substituting each member's TH;
// a round's reward only splits among members who actually participated (round leaderboard).
async function getRoundRewards(
  headers: Record<string, string>,
  clanId: number,
  allRounds: Array<{
    id: number;
    power: number;
    multiplier: number;
    active: boolean;
    winnerClanId: number | null;
  }>,
  btcFund: number,
  thByUser: Map<number, number>,
): Promise<Map<number, number>> {
  const rewardByUser = new Map<number, number>();

  const completedRounds = allRounds.filter((r) => !r.active && r.power > 0);
  const sumAllMultipliers = completedRounds.reduce((sum, r) => sum + r.multiplier, 0);
  const totalPowerSum = completedRounds.reduce((sum, r) => sum + r.power, 0);
  const avgRoundNftPower = completedRounds.length > 0 ? totalPowerSum / completedRounds.length : 1;
  if (sumAllMultipliers <= 0) return rewardByUser;

  const wonRounds = completedRounds.filter((r) => r.winnerClanId === clanId);

  const participantsByRoundId = new Map<number, number[]>();
  await mapWithConcurrency(wonRounds, PARTICIPANTS_FETCH_CONCURRENCY, async (round) => {
    let presentUserIds = loadRoundParticipants(round.id);
    if (!presentUserIds) {
      const fetched = await getRoundClanParticipants(headers, round.id, clanId).catch(() => null);
      if (!fetched) return;
      presentUserIds = [...fetched.keys()];
      persistRoundParticipants(round.id, presentUserIds);
    }
    participantsByRoundId.set(round.id, presentUserIds);
  });

  for (const round of wonRounds) {
    const powerRatio = round.power / avgRoundNftPower;
    const roundBtc = (round.multiplier / sumAllMultipliers) * btcFund * powerRatio;
    if (roundBtc <= 0) continue;

    const presentUserIds = participantsByRoundId.get(round.id);
    if (!presentUserIds) continue;

    let eligibleTotalTh = 0;
    const eligible: Array<{ userId: number; th: number }> = [];
    for (const userId of presentUserIds) {
      const th = thByUser.get(userId);
      if (th == null) continue;
      eligible.push({ userId, th });
      eligibleTotalTh += th;
    }
    if (eligibleTotalTh <= 0) continue;

    for (const { userId, th } of eligible) {
      rewardByUser.set(userId, (rewardByUser.get(userId) ?? 0) + roundBtc * (th / eligibleTotalTh));
    }
  }

  return rewardByUser;
}

// Only called for in-progress/pending cycles — completed cycles need historical TH/EE
// data that clan/get-by-id (live-only) can no longer provide.
export async function fetchClanPerformance(
  token: string,
  cycleId: number,
  cycleStart: string,
  cycleEnd: string,
  // Clan's total MinerWars BTC (header summary only); each member's own reward below is
  // computed independently per round, not by splitting this total.
  clanMinerWarsBtc: number | null,
  options: { forceRefresh?: boolean } = {},
): Promise<ClanPerformance> {
  const cached = cache.get(cycleId);
  if (!options.forceRefresh && cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const existing = inFlight.get(cycleId);
  if (!options.forceRefresh && existing) return existing;

  const promise = (async (): Promise<ClanPerformance> => {
    const headers = buildApiHeaders(token);

    const { rounds: refRounds } = await getCycleRounds(headers, cycleId);
    const refRound = refRounds[0];
    if (!refRound) throw new Error("No rounds found for this cycle");
    const { leagueId, clanId } = refRound;

    const calculatedAt = getCycleStartTuesdayUTC(cycleEnd).slice(0, 10);
    const cycleDates = datesInCycle(cycleStart, cycleEnd);
    // Live "as of" date for a still-running cycle (position/blocks change mid-cycle),
    // separate from the cycle-start Tuesday used for the header's name/logo.
    const today = new Date().toISOString().slice(0, 10);
    const liveCalculatedAt = cycleEnd >= today ? today : calculatedAt;

    const [
      headerInfo,
      roster,
      earners,
      abilityCatalog,
      boostX1Value,
      clanData,
      allRounds,
      boardSnapshot,
    ] = await Promise.all([
      getClanHeaderInfo(headers, calculatedAt, leagueId, clanId),
      getClanRoster(headers, clanId),
      getClanEarnersForCycle(headers, clanId, leagueId, cycleDates),
      getAbilityCosts(headers),
      getBoostX1Value(headers, calculatedAt),
      getCycleClanData(headers, calculatedAt, leagueId, clanId),
      getAllRoundsInCycle(headers, cycleId, leagueId),
      getClanLeaderboardStats(headers, liveCalculatedAt, leagueId, clanId),
    ]);
    const rosterById = new Map(roster.map((m) => [m.id, m]));
    const thByUser = new Map(roster.map((m) => [m.id, m.th]));
    const totalClanTh = [...thByUser.values()].reduce((sum, th) => sum + th, 0);
    const totalClanPps = roster.reduce(
      (sum, m) => sum + (m.ee && m.ee > 0 ? m.th * (BASE_EE / m.ee) : 0),
      0,
    );

    const rewardByUser = await getRoundRewards(
      headers,
      clanId,
      allRounds,
      clanData.btcFund,
      thByUser,
    );
    const userIds = new Set<number>([
      ...rosterById.keys(),
      ...earners.keys(),
      ...rewardByUser.keys(),
    ]);

    const members: ClanMemberPerformance[] = [...userIds].map((userId) => {
      const rosterMember = rosterById.get(userId) ?? null;
      const earner = earners.get(userId) ?? null;

      const th = thByUser.get(userId) ?? null;
      const ee = rosterMember?.ee ?? null;
      const pps = th != null && ee != null && ee > 0 ? th * (BASE_EE / ee) : null;
      const powerSharePct = th != null && totalClanTh > 0 ? (th / totalClanTh) * 100 : null;

      let boostCostGmt = 0;
      if (earner) {
        for (const [abilityId, count] of earner.abilityCounts) {
          const info = abilityCatalog.get(abilityId);
          if (!info) continue;
          if (info.type === "powerUp" && pps != null && boostX1Value > 0) {
            boostCostGmt +=
              (count * (POWER_UP_PROFIT_RATIO * pps * POWER_UP_MULTIPLIER)) / boostX1Value;
          } else if (info.type === "clanPowerUp" && boostX1Value > 0) {
            boostCostGmt += count * (totalClanPps / boostX1Value);
          } else {
            boostCostGmt += info.priceInGMT * count;
          }
        }
      }

      const minerWarsRewardEstBtc = rewardByUser.get(userId) ?? (th != null ? 0 : null);

      return {
        userId,
        alias: rosterMember?.alias ?? earner?.alias ?? `#${userId}`,
        avatarUrl: rosterMember?.avatarUrl ?? earner?.avatarUrl ?? null,
        th,
        ee,
        pps,
        powerSharePct,
        blocksMined: earner?.blocksMined ?? 0,
        gmtRewards: earner?.gmtRewards ?? 0,
        minerWarsRewardEstBtc,
        boostCostGmt,
        hasLeftClan: rosterMember === null,
      };
    });

    members.sort((a, b) => (b.th ?? -1) - (a.th ?? -1));

    const data: ClanPerformance = {
      header: {
        clanId,
        name: headerInfo?.name ?? "",
        logoUrl: headerInfo?.logoUrl ?? null,
        targetBtc: null,
        progressBtc: clanMinerWarsBtc,
        leagueId,
        position: boardSnapshot?.position ?? null,
        boardClanTh: boardSnapshot?.clanTh ?? null,
        boardBlocksMined: boardSnapshot?.blocksMined ?? null,
        boardBtcMined: boardSnapshot?.btcMined ?? null,
      },
      totalClanTh,
      totalClanPps,
      isLive: true,
      members,
    };

    cache.set(cycleId, { data, ts: Date.now() });
    persistClanPerformance(cycleId, data);
    return data;
  })().finally(() => inFlight.delete(cycleId));

  inFlight.set(cycleId, promise);
  return promise;
}

export function invalidateClanPerformanceCache(cycleId: number): void {
  cache.delete(cycleId);
}

export function invalidateAllClanPerformanceCache(): void {
  cache.clear();
  inFlight.clear();
}

export type { ClanPerformance, ClanMemberPerformance } from "./clan-types";
