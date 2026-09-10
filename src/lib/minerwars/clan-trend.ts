import { buildApiHeaders } from "@/lib/http";
import { mapWithConcurrency } from "@/lib/concurrency";
import { getCycleStartTuesdayUTC, toDateStr, type CycleInfo } from "./types";
import {
  getAllRoundsInCycle,
  getClanLeaderboardStats,
  getClanThByDate,
  getCycleRounds,
} from "./api";
import { fetchDifficultyEpochs, estimateTargetBtcFromPower } from "./difficulty-adjustments";
import { loadClanTrendEntry, persistClanTrendEntry } from "./cache";

export type ClanTrendPoint = {
  cycleId: number;
  blocksMined: number;
  btcMined: number;
  targetBtc: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A `null` result here can mean "genuinely no data" or a transient hiccup/rate-limit —
// since a false negative gets persisted as a PERMANENT skip below, retry a few times with
// a short backoff before giving up.
async function fetchClanLeaderboardStatsWithRetry(
  headers: Record<string, string>,
  calculatedAt: string,
  leagueId: number,
  clanId: number,
  attempts = 4,
): ReturnType<typeof getClanLeaderboardStats> {
  for (let i = 0; i < attempts; i++) {
    const result = await getClanLeaderboardStats(headers, calculatedAt, leagueId, clanId).catch(
      () => null,
    );
    if (result) return result;
    if (i < attempts - 1) await sleep(500 * (i + 1));
  }
  return null;
}

// A thrown/empty result here can be genuinely "no round data that cycle" or a transient
// hiccup/rate-limit (these calls fan out to several sub-requests internally) — a false
// negative would silently degrade the day-by-day reconstruction to the cruder single-point
// estimate below AND persist that as a permanent cache entry, so retry a few times first.
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await sleep(500 * (i + 1));
    }
  }
  throw lastErr;
}

// Sole place clan-trend history is network-fetched. Warms the cache; a no-op once
// everything's already warmed.
export async function warmClanTrendHistory(
  token: string,
  cycles: CycleInfo[],
  liveCycleId: number | null,
): Promise<void> {
  const uncached = cycles
    .filter((cycle) => cycle.cycleId !== liveCycleId && loadClanTrendEntry(cycle.cycleId) === null)
    .sort((a, b) => b.cycleId - a.cycleId);
  if (uncached.length === 0) return;

  const headers = buildApiHeaders(token);
  const epochs = await fetchDifficultyEpochs().catch(() => []);

  // Independent per-cycle network I/O, bounded so as not to hammer the API — matches
  // testing/minerwars-clan-target.mjs's step [8] concurrency of 2.
  await mapWithConcurrency(uncached, 2, async (cycle) => {
    try {
      const rounds = await getCycleRounds(headers, cycle.cycleId);
      const leagueId = rounds.rounds[0]?.leagueId ?? null;
      const clanId = rounds.rounds[0]?.clanId ?? null;
      if (leagueId == null || clanId == null) {
        persistClanTrendEntry(cycle.cycleId, { kind: "skip" });
        return;
      }

      const calculatedAt = getCycleStartTuesdayUTC(cycle.cycleEnd).slice(0, 10);
      const snapshot = await fetchClanLeaderboardStatsWithRetry(
        headers,
        calculatedAt,
        leagueId,
        clanId,
      );
      if (!snapshot) {
        persistClanTrendEntry(cycle.cycleId, { kind: "skip" });
        return;
      }

      const blocksMined = snapshot.blocksMined ?? 0;
      const btcMined = snapshot.btcMined ?? 0;

      const allCycleRounds = await withRetry(() =>
        getAllRoundsInCycle(headers, cycle.cycleId, leagueId),
      );
      const clanThByDate = await withRetry(() =>
        getClanThByDate(
          headers,
          allCycleRounds.filter((round) => !round.active && round.power > 0),
          leagueId,
          clanId,
          `${calculatedAt}T00:00:00.000Z`,
        ),
      );

      let targetBtc: number;
      if (clanThByDate.size > 0) {
        let lastKnownTh = snapshot.clanTh ?? 0;
        let targetSats = 0;
        for (
          let d = new Date(`${cycle.cycleStart}T00:00:00Z`);
          d.toISOString().slice(0, 10) <= cycle.cycleEnd;
          d.setUTCDate(d.getUTCDate() + 1)
        ) {
          const dateStr = toDateStr(d.toISOString());
          const dayTh = clanThByDate.get(dateStr);
          if (dayTh != null) lastKnownTh = dayTh;
          let applicableEpoch: (typeof epochs)[0] | null = null;
          for (const ep of epochs) if (ep.date < dateStr) applicableEpoch = ep;
          if (applicableEpoch) targetSats += applicableEpoch.satsPerTH * lastKnownTh;
        }
        targetBtc = targetSats / 1e8;
      } else {
        // Reconstruction found nothing (e.g. a very old/short cycle) — fall back to the
        // single point-in-time snapshot.
        targetBtc = estimateTargetBtcFromPower(
          epochs,
          cycle.cycleStart,
          cycle.cycleEnd,
          snapshot.clanTh ?? 0,
        );
      }

      persistClanTrendEntry(cycle.cycleId, { kind: "point", blocksMined, btcMined, targetBtc });
    } catch {
      // Not persisted as "skip" so the next warm pass retries this transient failure
      // instead of remembering a bogus permanent exclusion.
    }
  });
}

export function readClanTrendPoints(
  cycles: CycleInfo[],
  selectedCycleId: number,
  selectedCycleStatus: CycleInfo["status"],
  live: { blocksMined: number; btcMined: number; targetBtc: number },
): ClanTrendPoint[] {
  const targetCycles = cycles.filter((cycle) => cycle.cycleId <= selectedCycleId).reverse();
  const points: ClanTrendPoint[] = [];

  for (const cycle of targetCycles) {
    if (cycle.cycleId === selectedCycleId && selectedCycleStatus === "in-progress") {
      points.push({ cycleId: cycle.cycleId, ...live });
      continue;
    }
    const cached = loadClanTrendEntry(cycle.cycleId);
    if (cached?.kind === "point") points.push({ cycleId: cycle.cycleId, ...cached });
  }

  return points;
}

export function computeClanRecordPct(
  clanTrendPoints: ClanTrendPoint[],
  excludeCycleId: number | null,
): number | null {
  let max = 0;
  for (const point of clanTrendPoints) {
    if (point.cycleId === excludeCycleId) continue;
    if (point.targetBtc > 0) {
      const pct = (point.btcMined / point.targetBtc) * 100;
      if (pct > max) max = pct;
    }
  }
  return max > 0 ? max : null;
}
