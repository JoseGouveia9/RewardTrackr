import { mapWithConcurrency } from "@/lib/concurrency";
import { toDateString } from "../types";
import { getAllRoundsInCycle, type RoundRow } from "../api/cycles";
import {
  getClanHeaderInfo,
  getClanPowerAnalytics,
  getCurrentClanPower,
  getCycleClanData,
} from "../api/clan";
import { getClanTerahashByDate } from "../api/clan-activity";
import { getPersonalLeagueReward } from "../api/rewards";
import { powerOnDate } from "./comparison-solo";
import type { MaintenanceRecomputeInputs } from "../stores/comparison-maintenance-store";

type LeagueGroup = { leagueId: number; clanId: number; rounds: RoundRow[] };

export type LeagueGroupData = {
  leagueId: number;
  clanId: number;
  completedRounds: Awaited<ReturnType<typeof getAllRoundsInCycle>>;
  completedRoundsMap: Map<number, { power: number }>;
  sumAllMultipliers: number;
  averageRoundNftPower: number;
  btcFund: number;
  totalMinedBlocks: number;
  btcPerBlock: number;
  clanNftPower: number | null;
  leagueWeightedEnergyEfficiency: number | null;
  leagueWeightedAverageDiscount: number | null;
  clanPowerByDate: Map<string, number>;
  currentClanPower: number | null;
  clanCreatedAt: string | null;
  clanTerahashByDate: Map<string, number>;
  personalBlocksMined: number;
  personalGmtRewards: number;
  clanName: string | null;
};

export const groupKey = (leagueId: number, clanId: number): string => `${leagueId}:${clanId}`;

/**
 * Each round carries its own historical leagueId/clanId, so a user who switched league/clan
 * mid-cycle must have every group valued with that group's own context.
 */
function groupRoundsByLeagueClan(userRounds: RoundRow[]): LeagueGroup[] {
  const groupsByKey = new Map<string, LeagueGroup>();
  for (const round of userRounds) {
    const key = groupKey(round.leagueId, round.clanId);
    let group = groupsByKey.get(key);
    if (!group) {
      group = { leagueId: round.leagueId, clanId: round.clanId, rounds: [] };
      groupsByKey.set(key, group);
    }
    group.rounds.push(round);
  }
  return [...groupsByKey.values()];
}

/**
 * Everything needed to value one league/clan group: rounds, fund, clan TH history, own GMT
 * reward.
 */
async function fetchLeagueGroupData(
  headers: Record<string, string>,
  cycleId: number,
  cycleStartDate: string,
  personalRewardCalculatedAt: string,
  group: LeagueGroup,
): Promise<LeagueGroupData> {
  const allCycleRounds = await getAllRoundsInCycle(headers, cycleId, group.leagueId);
  const completedRounds = allCycleRounds.filter((round) => !round.active && round.power > 0);
  const sumAllMultipliers = completedRounds.reduce((total, round) => total + round.multiplier, 0);
  const totalPowerSum = completedRounds.reduce((total, round) => total + round.power, 0);
  const averageRoundNftPower =
    completedRounds.length > 0 ? totalPowerSum / completedRounds.length : 1;
  const completedRoundsMap = new Map(completedRounds.map((round) => [round.id, round]));

  const {
    btcFund,
    totalMinedBlocks,
    clanNftPower,
    leagueWeightedEE: leagueWeightedEnergyEfficiency,
    leagueWeightedAvgDiscount: leagueWeightedAverageDiscount,
  } = await getCycleClanData(headers, cycleStartDate, group.leagueId, group.clanId);
  const btcPerBlock = totalMinedBlocks > 0 ? btcFund / totalMinedBlocks : 0;

  const [
    clanPowerByDate,
    currentClanPowerInfo,
    clanTerahashByDate,
    personalLeagueReward,
    clanHeaderInfo,
  ] = await Promise.all([
    getClanPowerAnalytics(headers, group.clanId),
    getCurrentClanPower(headers, group.clanId),
    getClanTerahashByDate(
      headers,
      completedRounds,
      group.leagueId,
      group.clanId,
      cycleStartDate,
    ).catch(() => new Map<string, number>()),
    getPersonalLeagueReward(headers, personalRewardCalculatedAt, group.leagueId).catch(() => ({
      blocksMined: 0,
      gmtRewards: 0,
    })),
    getClanHeaderInfo(headers, personalRewardCalculatedAt, group.leagueId, group.clanId).catch(
      () => null,
    ),
  ]);

  return {
    leagueId: group.leagueId,
    clanId: group.clanId,
    completedRounds,
    completedRoundsMap,
    sumAllMultipliers,
    averageRoundNftPower,
    btcFund,
    totalMinedBlocks,
    btcPerBlock,
    clanNftPower,
    leagueWeightedEnergyEfficiency,
    leagueWeightedAverageDiscount,
    clanPowerByDate,
    currentClanPower: currentClanPowerInfo.power,
    clanCreatedAt: currentClanPowerInfo.createdAt,
    clanTerahashByDate,
    personalBlocksMined: personalLeagueReward.blocksMined,
    personalGmtRewards: personalLeagueReward.gmtRewards,
    clanName: clanHeaderInfo?.name ?? null,
  };
}

/** Fetches the league data of every league/clan group the user played in, two groups at a time. */
export async function fetchLeagueGroups(
  headers: Record<string, string>,
  cycleId: number,
  cycleStartDate: string,
  personalRewardCalculatedAt: string,
  userRounds: RoundRow[],
): Promise<LeagueGroupData[]> {
  return mapWithConcurrency(groupRoundsByLeagueClan(userRounds), 2, (group) =>
    fetchLeagueGroupData(headers, cycleId, cycleStartDate, personalRewardCalculatedAt, group),
  );
}

/**
 * Per user round: BTC = multiplier share of the fund x round power ratio x user/clan TH that day.
 * Clan TH prefers the day's real participants, then analytics, then current/league power.
 * Uses the official reward formula, not btcPerBlock, which assumes a power ratio of 1.
 */
export function computeRoundRewards(
  userRounds: RoundRow[],
  groupDataByKey: Map<string, LeagueGroupData>,
  userPowerByDate: Map<string, number>,
  lastUserPower: number | null,
  today: string,
) {
  const roundRewards: MaintenanceRecomputeInputs["roundRewards"] = new Map();
  const roundContextById: MaintenanceRecomputeInputs["roundContextById"] = new Map();
  for (const round of userRounds) {
    const group = groupDataByKey.get(groupKey(round.leagueId, round.clanId));
    if (!group) continue;
    const entry = group.completedRoundsMap.get(round.roundId);
    if (!entry) continue;

    const roundDate = toDateString(round.endedAt);
    const isToday = roundDate >= today;
    const effectiveUserPower = powerOnDate(userPowerByDate, lastUserPower, roundDate);
    const effectiveClanPower = group.clanTerahashByDate.has(roundDate)
      ? group.clanTerahashByDate.get(roundDate)!
      : group.clanPowerByDate.has(roundDate)
        ? group.clanPowerByDate.get(roundDate)!
        : isToday
          ? (group.currentClanPower ?? group.clanNftPower ?? 1)
          : (group.clanNftPower ?? 1);

    const powerRatio = entry.power / group.averageRoundNftPower;
    const clanReward = group.btcPerBlock * round.multiplier;
    const userReward =
      effectiveClanPower > 0
        ? ((round.multiplier / group.sumAllMultipliers) *
            group.btcFund *
            powerRatio *
            effectiveUserPower) /
          effectiveClanPower
        : 0;

    roundRewards.set(round.roundId, { userBtc: userReward, clanBtc: clanReward, date: roundDate });
    roundContextById.set(round.roundId, {
      clanTerahash: effectiveClanPower,
      leagueEnergyEfficiency: group.leagueWeightedEnergyEfficiency,
      leagueDiscountFactor:
        group.leagueWeightedAverageDiscount != null
          ? 1 - group.leagueWeightedAverageDiscount
          : null,
      btcPerBlock: group.btcPerBlock,
      sumAllMultipliers: group.sumAllMultipliers,
    });
  }
  return { roundRewards, roundContextById };
}
