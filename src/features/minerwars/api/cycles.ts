import { postJson } from "@/lib/http";
import {
  getCycleStartTuesdayUTC,
  cycleEndFromStart,
  type CycleInfo,
  type MinerWarsRewardRow,
  type MinerWarsRoundRow,
} from "../types";
import {
  loadRewardsByUserCache,
  loadRoundsByCycle,
  persistRewardsByUserCache,
  persistRoundsByCycle,
  resolveCycleStatus,
  type RewardsByUserRow,
} from "../stores/cache";
import { API } from "./base";

const MULTIPLIERS = [1, 2, 4, 8, 16, 32, 64, 128, 256];

export type RoundRow = MinerWarsRewardRow;

type RewardsByUserApiRow = RewardsByUserRow;

let rewardsByUserSnapshot: {
  auth: string;
  rows: RewardsByUserApiRow[];
  timestamp: number;
} | null = null;
const REWARDS_BY_USER_SNAPSHOT_TIME_TO_LIVE = 30 * 1000;

type AllRoundsInCycleRow = MinerWarsRoundRow;
const allRoundsInCycleCache = new Map<string, { data: AllRoundsInCycleRow[]; ts: number }>();
const allRoundsInCycleInFlight = new Map<string, Promise<AllRoundsInCycleRow[]>>();
const ALL_ROUNDS_IN_CYCLE_TIME_TO_LIVE = 30 * 1000;

/** Trims a raw rewards-by-user API row down to the fields cycle/round discovery needs. */
function toRewardRow(row: Record<string, unknown>): RoundRow {
  return {
    roundId: row.roundId as number,
    blockNumber: row.blockNumber as number,
    multiplier: row.multiplier as number,
    leagueId: row.leagueId as number,
    clanId: row.clanId as number,
    endedAt: row.endedAt as string,
    cycleId: row.cycleId as number,
  };
}

function rewardsByUserRoundId(row: RewardsByUserApiRow): number | null {
  return typeof row.roundId === "number" ? row.roundId : null;
}

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
    const resolvedId = targetCycleId ?? snapshotRows[0]?.cycleId ?? null;
    if (resolvedId != null) {
      const rounds = snapshotRows.filter((row) => row.cycleId === resolvedId);
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
 * neighboring week. Merges with the persisted rewards-by-user cache, paging only until a page
 * yields no round the cache doesn't already have (resolved rounds never change), and also
 * stores the merged rows as the in-memory rewards-by-user snapshot.
 */
export async function fetchAllCyclesFromApi(headers: Record<string, string>): Promise<CycleInfo[]> {
  const limit = 40;
  let skip = 0;
  const TODAY = new Date().toISOString().slice(0, 10);

  const persistedRows = loadRewardsByUserCache() ?? [];
  const knownRoundIds = new Set(
    persistedRows.map(rewardsByUserRoundId).filter((id): id is number => id !== null),
  );
  const incrementalMode = knownRoundIds.size > 0;
  const freshRows: RewardsByUserApiRow[] = [];

  while (true) {
    const response = await postJson<{ data: { array: Array<Record<string, unknown>> } }>(
      `${API}/api/nft-game/rewards-by-user`,
      headers,
      { filters: { type: "clan" }, pagination: { skip, limit } },
    );
    const array = response.data.array ?? [];
    if (array.length === 0) break;

    if (incrementalMode) {
      const newRows = array.filter((row) => {
        const id = row.roundId;
        return typeof id !== "number" || !knownRoundIds.has(id);
      });
      freshRows.push(...newRows.map(toRewardRow));
      if (newRows.length === 0) break;
    } else {
      freshRows.push(...array.map(toRewardRow));
    }

    if (array.length < limit) break;
    skip += limit;
  }

  const allRows = incrementalMode ? [...freshRows, ...persistedRows] : freshRows;
  persistRewardsByUserCache(allRows);

  const endedAtByCycle = new Map<number, string[]>();
  for (const row of allRows) {
    const id = row.cycleId as number;
    const list = endedAtByCycle.get(id) ?? [];
    list.push(row.endedAt as string);
    endedAtByCycle.set(id, list);
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

/**
 * Every round of the league in the cycle, including those won by other clans. A completed
 * cycle's rounds never change, so once persisted with no active round, a single lightweight
 * count probe confirms nothing new was added instead of re-paging the whole cycle.
 */
function toRoundRow(row: Record<string, unknown>): AllRoundsInCycleRow {
  return {
    id: row.id as number,
    power: Number(row.power ?? 0),
    multiplier: Number(row.multiplier ?? 0),
    active: Boolean(row.active),
    startedAt: (row.startedAt as string) ?? null,
    endedAt: (row.endedAt as string) ?? null,
    winnerClanId: (row.winnerClanId as number | null) ?? null,
  };
}

/** Pages find-by-cycleId forward from `startSkip`, merging rows (by id) into `byId` until `total` is reached. */
async function pageRoundsInto(
  headers: Record<string, string>,
  cycleId: number,
  leagueId: number,
  startSkip: number,
  byId: Map<number, AllRoundsInCycleRow>,
  total: number,
): Promise<void> {
  const limit = 50;
  let skip = startSkip;
  while (true) {
    const response = await postJson<{
      data: { count: number; array: Array<Record<string, unknown>> };
    }>(`${API}/api/nft-game/round/find-by-cycleId`, headers, {
      cycleId,
      multipliers: MULTIPLIERS,
      pagination: { limit, skip, count: 0 },
      leagueId,
    });
    const array = response.data.array ?? [];
    for (const row of array) byId.set(row.id as number, toRoundRow(row));
    if (byId.size >= total || array.length < limit) break;
    skip += limit;
  }
}

export async function getAllRoundsInCycle(
  headers: Record<string, string>,
  cycleId: number,
  leagueId: number,
) {
  const key = `${headers.authorization ?? ""}:${cycleId}:${leagueId}`;

  const cached = allRoundsInCycleCache.get(key);
  if (cached && Date.now() - cached.ts < ALL_ROUNDS_IN_CYCLE_TIME_TO_LIVE) {
    return cached.data;
  }

  const existing = allRoundsInCycleInFlight.get(key);
  if (existing) {
    return existing;
  }

  const promise = (async (): Promise<AllRoundsInCycleRow[]> => {
    const persisted = loadRoundsByCycle(cycleId, leagueId);

    const probe = await postJson<{ data: { count: number } }>(
      `${API}/api/nft-game/round/find-by-cycleId`,
      headers,
      { cycleId, multipliers: MULTIPLIERS, pagination: { limit: 1, skip: 0, count: 0 }, leagueId },
    );
    const total = probe.data.count;

    if (persisted && !persisted.hasActiveRound && total === persisted.total) {
      return persisted.rows;
    }

    const limit = 50;
    const byId = new Map<number, AllRoundsInCycleRow>(
      (persisted?.rows ?? []).map((row) => [row.id, row]),
    );

    // Rounds are appended in order, so resume near the end of what's cached: this re-checks the
    // last known page (catching an active round that has since resolved) plus any newly added
    // rounds, instead of repaging the whole cycle.
    const resumeSkip = persisted ? Math.max(0, persisted.rows.length - limit) : 0;
    await pageRoundsInto(headers, cycleId, leagueId, resumeSkip, byId, total);

    // The resume point assumes ascending order; if it didn't converge (e.g. different ordering),
    // fall back to a full walk from the start so correctness never depends on that assumption.
    if (byId.size < total) {
      byId.clear();
      await pageRoundsInto(headers, cycleId, leagueId, 0, byId, total);
    }

    const collected = [...byId.values()];
    persistRoundsByCycle(cycleId, leagueId, collected, total);
    return collected;
  })();

  allRoundsInCycleInFlight.set(key, promise);
  try {
    const data = await promise;
    allRoundsInCycleCache.set(key, { data, ts: Date.now() });
    return data;
  } finally {
    allRoundsInCycleInFlight.delete(key);
  }
}
