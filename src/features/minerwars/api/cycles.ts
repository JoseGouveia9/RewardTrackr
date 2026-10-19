import { postJson } from "@/lib/http";
import { getCycleStartTuesdayUTC, cycleEndFromStart, type CycleInfo } from "../types";
import { resolveCycleStatus } from "../stores/cache";
import { API } from "./base";

const MULTIPLIERS = [1, 2, 4, 8, 16, 32, 64, 128, 256];

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

let rewardsByUserSnapshot: {
  auth: string;
  rows: RewardsByUserApiRow[];
  timestamp: number;
} | null = null;
const REWARDS_BY_USER_SNAPSHOT_TIME_TO_LIVE = 30 * 1000;

/**
 * Short-lived (30s) snapshot saved by fetchAllCyclesFromApi, so the follow-up comparison
 * fetch reuses the rows instead of re-paging rewards-by-user. Scoped to the auth token.
 */
function readRewardsByUserSnapshot(headers: Record<string, string>): RewardsByUserApiRow[] | null {
  if (!rewardsByUserSnapshot) return null;
  const auth = headers.authorization ?? "";
  const age = Date.now() - rewardsByUserSnapshot.timestamp;
  if (rewardsByUserSnapshot.auth !== auth || age > REWARDS_BY_USER_SNAPSHOT_TIME_TO_LIVE) {
    rewardsByUserSnapshot = null;
    return null;
  }
  return rewardsByUserSnapshot.rows;
}

/** The user's rounds of a cycle (the newest when null), from the snapshot or by paging the API. */
export async function getCycleRounds(
  headers: Record<string, string>,
  targetCycleId: number | null,
): Promise<{ cycleId: number | null; cycleStartDate: string | null; rounds: RoundRow[] }> {
  const snapshotRows = readRewardsByUserSnapshot(headers);
  if (snapshotRows && snapshotRows.length > 0) {
    const resolvedId = targetCycleId ?? (snapshotRows[0]?.cycleId as number | null) ?? null;
    if (resolvedId != null) {
      const rounds: RoundRow[] = [];
      for (const row of snapshotRows) {
        if ((row.cycleId as number) !== resolvedId) continue;
        rounds.push({
          roundId: row.roundId as number,
          blockNumber: row.blockNumber as number,
          multiplier: row.multiplier as number,
          leagueId: row.leagueId as number,
          clanId: row.clanId as number,
          endedAt: row.endedAt as string,
          cycleId: row.cycleId as number,
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
    const response = await postJson<{ data: { array: Array<Record<string, unknown>> } }>(
      `${API}/api/nft-game/rewards-by-user`,
      headers,
      { filters: { type: "clan" }, pagination: { skip, limit } },
    );
    const array = response.data.array ?? [];
    if (array.length === 0) break;

    if (resolvedId === null) {
      resolvedId = array[0].cycleId as number;
    }

    for (const row of array) {
      if (row.cycleId === resolvedId) {
        collected.push({
          roundId: row.roundId as number,
          blockNumber: row.blockNumber as number,
          multiplier: row.multiplier as number,
          leagueId: row.leagueId as number,
          clanId: row.clanId as number,
          endedAt: row.endedAt as string,
          cycleId: row.cycleId as number,
        });
      }
    }

    if (
      array.some((row) => (row.cycleId as number) < (resolvedId as number)) ||
      array.length < limit
    )
      break;
    skip += limit;
  }

  const cycleStartDate =
    resolvedId != null && collected.length > 0
      ? await resolveCycleStartFromRounds(headers, resolvedId, collected)
      : null;
  return { cycleId: resolvedId, cycleStartDate, rounds: collected };
}

/**
 * Uses the earliest round's startedAt: a late-settling user round's endedAt can spill into
 * the next week and be misclassified as the following cycle.
 */
async function resolveCycleStartFromRounds(
  headers: Record<string, string>,
  cycleId: number,
  userRounds: RoundRow[],
): Promise<string | null> {
  const leagueId = userRounds[0]?.leagueId;
  if (leagueId == null) return null;
  const allCycleRounds = await getAllRoundsInCycle(headers, cycleId, leagueId).catch(() => []);
  const earliestStart = allCycleRounds
    .map((row) => row.startedAt)
    .filter((startedAt): startedAt is string => !!startedAt)
    .sort()[0];
  return earliestStart ? `${earliestStart.slice(0, 10)}T00:00:00.000Z` : null;
}

/**
 * Cycle start is the median endedAt's Tuesday: robust against rounds that spill into a
 * neighboring week. Also stores the fetched rows as the rewards-by-user snapshot.
 */
export async function fetchAllCyclesFromApi(headers: Record<string, string>): Promise<CycleInfo[]> {
  const limit = 40;
  let skip = 0;
  const endedAtByCycle = new Map<number, string[]>();
  const allRows: RewardsByUserApiRow[] = [];
  const TODAY = new Date().toISOString().slice(0, 10);

  while (true) {
    const response = await postJson<{ data: { array: Array<Record<string, unknown>> } }>(
      `${API}/api/nft-game/rewards-by-user`,
      headers,
      { filters: { type: "clan" }, pagination: { skip, limit } },
    );
    const array = response.data.array ?? [];
    if (array.length === 0) break;
    allRows.push(...array);

    for (const row of array) {
      const id = row.cycleId as number;
      const list = endedAtByCycle.get(id) ?? [];
      list.push(row.endedAt as string);
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
    timestamp: Date.now(),
  };

  return [...seen.values()].sort((left, right) => right.cycleId - left.cycleId);
}

/** Every round of the league in the cycle, including those won by other clans. */
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
    const response = await postJson<{
      data: { count: number; array: Array<Record<string, unknown>> };
    }>(`${API}/api/nft-game/round/find-by-cycleId`, headers, {
      cycleId,
      multipliers: MULTIPLIERS,
      pagination: { limit, skip, count: 0 },
      leagueId,
    });
    if (total === null) total = response.data.count;
    const array = response.data.array ?? [];
    for (const row of array) {
      collected.push({
        id: row.id as number,
        power: Number(row.power ?? 0),
        multiplier: Number(row.multiplier ?? 0),
        active: Boolean(row.active),
        startedAt: (row.startedAt as string) ?? null,
        endedAt: (row.endedAt as string) ?? null,
        winnerClanId: (row.winnerClanId as number | null) ?? null,
      });
    }
    if (collected.length >= (total ?? 0) || array.length < limit) break;
    skip += limit;
  }

  return collected;
}
