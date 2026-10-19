import { buildApiHeaders } from "@/lib/http";
import { mapWithConcurrency } from "@/lib/concurrency";
import { getCycleStartTuesdayUTC, toDateString } from "../types";
import { getAbilityCosts, getBoostX1Value } from "../api/abilities";
import { getAllRoundsInCycle, getCycleRounds } from "../api/cycles";
import {
  getClanHeaderInfo,
  getClanLeaderboardStats,
  getClanPowerAnalytics,
  getClanRoster,
  getCurrentClanPower,
  getCycleClanData,
} from "../api/clan";
import {
  getClanEarnersForCycle,
  getClanTerahashByUserByDate,
  getRoundClanParticipants,
} from "../api/clan-activity";
import {
  clearStalePersistedClanPerformance,
  loadPersistedClanPerformance,
  loadRoundParticipants,
  persistClanPerformance,
  persistRoundParticipants,
} from "../stores/cache";
import type { ClanMemberPerformance, ClanPerformance } from "../types/clan-types";

const BASE_ENERGY_EFFICIENCY = 20;
const POWER_UP_PROFIT_RATIO = 0.7;
const POWER_UP_MULTIPLIER = 100;

const cache = new Map<number, { data: ClanPerformance; timestamp: number }>();
const CACHE_TIME_TO_LIVE = 5 * 60 * 1000;
const inFlight = new Map<number, Promise<ClanPerformance>>();

/** Cycle dates up to today; future days are excluded. */
function datesInCycle(cycleStart: string, cycleEnd: string): string[] {
  const today = new Date().toISOString().slice(0, 10);
  const dates: string[] = [];
  const cursor = new Date(`${cycleStart}T00:00:00Z`);
  const end = new Date(`${cycleEnd}T00:00:00Z`);
  while (cursor <= end) {
    const isoDate = cursor.toISOString().slice(0, 10);
    if (isoDate <= today) dates.push(isoDate);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/** Reads what the last fetchClanPerformance() persisted, without hitting the network. */
export function getCachedClanPerformance(cycleId: number): ClanPerformance | null {
  const inMemory = cache.get(cycleId);
  if (inMemory) return inMemory.data;
  return loadPersistedClanPerformance(cycleId);
}

/** Drops cached entries (memory + persisted) for any clan other than currentClanId. */
export function invalidateStaleClanPerformanceCache(currentClanId: number): void {
  for (const [cycleId, entry] of cache) {
    if (entry.data.header.clanId !== currentClanId) cache.delete(cycleId);
  }
  clearStalePersistedClanPerformance(currentClanId);
}

const PARTICIPANTS_FETCH_CONCURRENCY = 6;

/**
 * Same per-round split as the Individual tab: each round's clan BTC is divided by day-level
 * TH share of the whole clan, and only reaches members present in that round's leaderboard.
 * Participants of won rounds are fetched in parallel and cached, as one-by-one would dominate cost.
 */
async function getRoundRewards(
  headers: Record<string, string>,
  clanId: number,
  allRounds: Array<{
    id: number;
    power: number;
    multiplier: number;
    active: boolean;
    winnerClanId: number | null;
    endedAt: string | null;
  }>,
  btcFund: number,
  terahashByUser: Map<number, number>,
  clanTerahashByUserByDate: Map<string, Map<number, number>>,
  clanPowerByDate: Map<string, number>,
  currentClanPower: number | null,
  clanNftPower: number | null,
): Promise<Map<number, number>> {
  const rewardByUser = new Map<number, number>();
  const today = new Date().toISOString().slice(0, 10);

  const completedRounds = allRounds.filter((round) => !round.active && round.power > 0);
  const sumAllMultipliers = completedRounds.reduce((sum, round) => sum + round.multiplier, 0);
  const totalPowerSum = completedRounds.reduce((sum, round) => sum + round.power, 0);
  const averageRoundNftPower =
    completedRounds.length > 0 ? totalPowerSum / completedRounds.length : 1;
  if (sumAllMultipliers <= 0) return rewardByUser;

  const wonRounds = completedRounds.filter((round) => round.winnerClanId === clanId);

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
    if (!round.endedAt) continue;
    const powerRatio = round.power / averageRoundNftPower;
    const roundClanBtc = (round.multiplier / sumAllMultipliers) * btcFund * powerRatio;
    if (roundClanBtc <= 0) continue;

    const date = toDateString(round.endedAt);
    const isToday = date >= today;
    const byUserTerahash = clanTerahashByUserByDate.get(date);
    const effectiveClanPower = byUserTerahash
      ? [...byUserTerahash.values()].reduce((sum, terahash) => sum + terahash, 0)
      : (clanPowerByDate.get(date) ??
        (isToday ? (currentClanPower ?? clanNftPower ?? 0) : (clanNftPower ?? 0)));
    if (effectiveClanPower <= 0) continue;

    const presentUserIds = participantsByRoundId.get(round.id);
    if (!presentUserIds) continue;

    for (const userId of presentUserIds) {
      const memberTerahash = byUserTerahash?.get(userId) ?? terahashByUser.get(userId) ?? 0;
      if (memberTerahash <= 0) continue;
      rewardByUser.set(
        userId,
        (rewardByUser.get(userId) ?? 0) + roundClanBtc * (memberTerahash / effectiveClanPower),
      );
    }
  }

  return rewardByUser;
}

/**
 * Only for in-progress/pending cycles: completed ones need historical TH/EE that the live-only clan/get-by-id can't give.
 * Power-Up boost cost = 0.7 x PPS x 100 / Boost X1, with PPS = TH x (20 / EE) as in GoMining's formula.
 * Cached 5 min and deduped per cycle; member rewards come per round, not from the header total.
 */
export async function fetchClanPerformance(
  token: string,
  cycleId: number,
  cycleStart: string,
  cycleEnd: string,
  clanMinerWarsBtc: number | null,
  options: { forceRefresh?: boolean } = {},
): Promise<ClanPerformance> {
  const cached = cache.get(cycleId);
  if (!options.forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TIME_TO_LIVE)
    return cached.data;

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
    const rosterById = new Map(roster.map((member) => [member.id, member]));
    const terahashByUser = new Map(roster.map((member) => [member.id, member.th]));
    const totalClanTerahash = [...terahashByUser.values()].reduce(
      (sum, terahash) => sum + terahash,
      0,
    );
    const totalClanPps = roster.reduce(
      (sum, member) =>
        sum + (member.ee && member.ee > 0 ? member.th * (BASE_ENERGY_EFFICIENCY / member.ee) : 0),
      0,
    );

    const completedRoundsForTerahash = allRounds.filter(
      (round) => !round.active && round.power > 0,
    );
    const [clanTerahashByUserByDate, clanPowerByDate, currentClanPowerInfo] = await Promise.all([
      getClanTerahashByUserByDate(
        headers,
        completedRoundsForTerahash,
        leagueId,
        clanId,
        cycleStart,
      ).catch(() => new Map<string, Map<number, number>>()),
      getClanPowerAnalytics(headers, clanId).catch(() => new Map<string, number>()),
      getCurrentClanPower(headers, clanId).catch(() => ({
        power: null,
        createdAt: null,
      })),
    ]);
    const currentClanPower = currentClanPowerInfo.power;

    const rewardByUser = await getRoundRewards(
      headers,
      clanId,
      allRounds,
      clanData.btcFund,
      terahashByUser,
      clanTerahashByUserByDate,
      clanPowerByDate,
      currentClanPower,
      clanData.clanNftPower,
    );
    const userIds = new Set<number>(rosterById.keys());

    const members: ClanMemberPerformance[] = [...userIds].map((userId) => {
      const rosterMember = rosterById.get(userId) ?? null;
      const earner = earners.get(userId) ?? null;

      const terahash = terahashByUser.get(userId) ?? null;
      const energyEfficiency = rosterMember?.ee ?? null;
      const pps =
        terahash != null && energyEfficiency != null && energyEfficiency > 0
          ? terahash * (BASE_ENERGY_EFFICIENCY / energyEfficiency)
          : null;
      const powerSharePercent =
        terahash != null && totalClanTerahash > 0 ? (terahash / totalClanTerahash) * 100 : null;

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

      const minerWarsRewardEstimatedBtc = rewardByUser.get(userId) ?? (terahash != null ? 0 : null);

      return {
        userId,
        alias: rosterMember?.alias ?? earner?.alias ?? `#${userId}`,
        avatarUrl: rosterMember?.avatarUrl ?? earner?.avatarUrl ?? null,
        th: terahash,
        ee: energyEfficiency,
        pps,
        powerSharePct: powerSharePercent,
        blocksMined: earner?.blocksMined ?? 0,
        gmtRewards: earner?.gmtRewards ?? 0,
        minerWarsRewardEstBtc: minerWarsRewardEstimatedBtc,
        boostCostGmt,
      };
    });

    members.sort((left, right) => (right.th ?? -1) - (left.th ?? -1));

    const data: ClanPerformance = {
      header: {
        clanId,
        name: headerInfo?.name ?? "",
        logoUrl: headerInfo?.logoUrl ?? null,
        targetBtc: null,
        progressBtc: clanMinerWarsBtc,
        leagueId,
        position: boardSnapshot?.position ?? null,
        boardClanTh: boardSnapshot?.clanTerahash ?? null,
        boardBlocksMined: boardSnapshot?.blocksMined ?? null,
        boardBtcMined: boardSnapshot?.btcMined ?? null,
      },
      totalClanTh: totalClanTerahash,
      totalClanPps,
      isLive: true,
      members,
    };

    cache.set(cycleId, { data, timestamp: Date.now() });
    persistClanPerformance(cycleId, data);
    return data;
  })().finally(() => inFlight.delete(cycleId));

  inFlight.set(cycleId, promise);
  return promise;
}

export type { ClanPerformance } from "../types/clan-types";
