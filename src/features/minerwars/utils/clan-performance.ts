import { buildApiHeaders } from "@/lib/http";
import { getCycleStartTuesdayUTC } from "../types";
import { getAbilityCosts, getBoostX1Value } from "../api/abilities";
import { getCycleRounds } from "../api/cycles";
import { getClanHeaderInfo, getClanLeaderboardStats, getClanRoster } from "../api/clan";
import { getClanEarnersForCycle } from "../api/clan-activity";
import {
  clearStalePersistedClanPerformance,
  loadPersistedClanPerformance,
  persistClanPerformance,
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

/**
 * Only for in-progress/pending cycles: completed ones need historical TH/EE that the live-only clan/get-by-id can't give.
 * Power-Up boost cost = 0.7 x PPS x 100 / Boost X1, with PPS = TH x (20 / EE) as in GoMining's formula.
 * Cached 5 min and deduped per cycle.
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

    const [headerInfo, roster, earners, abilityCatalog, boostX1Value, boardSnapshot] =
      await Promise.all([
        getClanHeaderInfo(headers, calculatedAt, leagueId, clanId),
        getClanRoster(headers, clanId),
        getClanEarnersForCycle(headers, clanId, leagueId, cycleDates),
        getAbilityCosts(headers),
        getBoostX1Value(headers, calculatedAt),
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
