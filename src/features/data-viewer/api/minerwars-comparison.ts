import { buildApiHeaders, getJson, postJson, resolveApiBase } from "@/lib/http";
import { fetchDifficultyEpochs } from "@/features/export/api/difficulty-adjustments";
import { LS_KEY_MW_COMPARISON, LS_KEY_MW_CYCLES, LS_KEY_REWARD_PREFIX } from "@/lib/storage-keys";

const API = resolveApiBase();

const MULTIPLIERS = [1, 2, 4, 8, 16, 32, 64, 128, 256];

export type CycleStatus = "in-progress" | "pending" | "completed";

export interface CycleInfo {
  cycleId: number;
  cycleStart: string; // YYYY-MM-DD
  cycleEnd: string; // YYYY-MM-DD
  status: CycleStatus;
}

export interface MinerWarsComparison {
  cycleId: number;
  cycleStart: string; // YYYY-MM-DD
  cycleEnd: string; // YYYY-MM-DD
  today: string; // YYYY-MM-DD

  /** Actual MinerWars sats earned so far (est.) */
  minerWarsSats: number;
  /** Clan MinerWars sats earned so far (est.) */
  clanMinerWarsSats: number | null;
  /** Current cycle BTC fund snapshot used for estimation */
  btcFundBtc: number | null;
  /** Solo equiv sats for elapsed days (excl. solo days) */
  soloEquivSats: number;
  diffSats: number;
  diffPct: number | null;

  /** Full 7-day projected solo target */
  targetSoloSats: number;
  progressPct: number | null;
  targetActualDays: number;
  targetProjectedDays: number;
  latestSatsPerTH: number | null;

  windowLabel: string;
  /** Sorted list of YYYY-MM-DD dates excluded from comparison (user was in solo mining) */
  soloDays: string[];
  /** False when clan analytics are unavailable — only meaningful for in-progress cycles */
  hasClanAnalytics: boolean;
  /** True when the BTC fund is still 0 — rewards not yet distributed */
  btcFundIsZero: boolean;
  /** Actual total pool reward for completed cycles (BTC), summed from income API. null for live cycles or no data. */
  actualMinerWarsBtc: number | null;
  /** Full 7-day clan solo-equivalent target (clan TH/s × sats/TH/day). null when clan power unavailable. */
  clanTargetSoloSats: number | null;
  /** Current BTC per block in sats (btcFund / totalMinedBlocks). null when no blocks mined yet. */
  btcPerBlockSats: number | null;
  /** Length of the cycle in days (always 7). Used for the funded-days badge on the BTC fund row. */
  cycleLength: number;
  /** Estimated maintenance cost in BTC (null when not computed). */
  maintenanceBtc: number | null;
  /** Estimated maintenance cost in GMT (null when no price). */
  maintenanceGmt: number | null;
  /** MW reward expressed in GMT at computation time (null when no price). */
  rewardGmt: number | null;
  /** Net BTC (reward - maintenance). null when maintenance unavailable. */
  netBtc: number | null;
  /** Net GMT (rewardGmt - maintenanceGmt). null when maintenance unavailable. */
  netGmt: number | null;
  /** Live BTC price in USD at computation time. null when unavailable. */
  btcPrice: number | null;
  /** Live GMT price in USD at computation time. null when unavailable. */
  gmtPrice: number | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getCycleStartTuesdayUTC(dateStr: string): string {
  const d = new Date(dateStr);
  const dayOfWeek = d.getUTCDay();
  const daysSinceTuesday = (dayOfWeek - 2 + 7) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceTuesday);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function cycleEndFromStart(cycleStart: string): string {
  const d = new Date(cycleStart + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

function toDateStr(iso: string): string {
  return iso.slice(0, 10);
}

function resolveCycleStatus(cycleEnd: string, today: string): CycleStatus {
  if (cycleEnd >= today) return "in-progress";
  const paymentDay = new Date(cycleEnd + "T00:00:00Z");
  paymentDay.setUTCDate(paymentDay.getUTCDate() + 1);
  const paymentDayStr = paymentDay.toISOString().slice(0, 10);
  return getActualIncomeFromBuildCache(paymentDayStr) !== null ? "completed" : "pending";
}

function withResolvedStatuses(cycles: CycleInfo[]): CycleInfo[] {
  const today = new Date().toISOString().slice(0, 10);
  return cycles.map((c) => ({
    ...c,
    status: resolveCycleStatus(c.cycleEnd, today),
  }));
}

// ─── API calls ──────────────────────────────────────────────────────────────

type RoundRow = {
  roundId: number;
  multiplier: number;
  leagueId: number;
  clanId: number;
  endedAt: string;
  cycleId: number;
};

/** Paginate rewards-by-user and collect rounds for a specific (or auto-detected) cycle. */
async function getCycleRounds(
  headers: Record<string, string>,
  targetCycleId: number | null,
): Promise<{ cycleId: number | null; cycleStartDate: string | null; rounds: RoundRow[] }> {
  const limit = 40;
  let resolvedId: number | null = targetCycleId;
  let cycleStartDate: string | null = null;
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
      cycleStartDate = getCycleStartTuesdayUTC(array[0].endedAt as string);
    }

    for (const r of array) {
      if (r.cycleId === resolvedId) {
        collected.push({
          roundId: r.roundId as number,
          multiplier: r.multiplier as number,
          leagueId: r.leagueId as number,
          clanId: r.clanId as number,
          endedAt: r.endedAt as string,
          cycleId: r.cycleId as number,
        });
        if (!cycleStartDate) cycleStartDate = getCycleStartTuesdayUTC(r.endedAt as string);
      }
    }

    // Stop once we've passed the target cycle
    if (array.some((r) => (r.cycleId as number) < (resolvedId as number)) || array.length < limit)
      break;
    skip += limit;
  }

  return { cycleId: resolvedId, cycleStartDate, rounds: collected };
}

/** Fetch all unique cycles the user has participated in, newest first. */
async function fetchAllCyclesFromApi(headers: Record<string, string>): Promise<CycleInfo[]> {
  const limit = 40;
  let skip = 0;
  const seen = new Map<number, CycleInfo>();
  const TODAY = new Date().toISOString().slice(0, 10);

  while (true) {
    const res = await postJson<{ data: { array: Array<Record<string, unknown>> } }>(
      `${API}/api/nft-game/rewards-by-user`,
      headers,
      { filters: { type: "clan" }, pagination: { skip, limit } },
    );
    const array = res.data.array ?? [];
    if (array.length === 0) break;

    for (const r of array) {
      const id = r.cycleId as number;
      if (!seen.has(id)) {
        const cycleStart = getCycleStartTuesdayUTC(r.endedAt as string).slice(0, 10);
        const cycleEnd = cycleEndFromStart(cycleStart);
        seen.set(id, {
          cycleId: id,
          cycleStart,
          cycleEnd,
          status: resolveCycleStatus(cycleEnd, TODAY),
        });
      }
    }

    if (array.length < limit) break;
    skip += limit;
  }

  return [...seen.values()].sort((a, b) => b.cycleId - a.cycleId);
}

async function getAllRoundsInCycle(
  headers: Record<string, string>,
  cycleId: number,
  leagueId: number,
) {
  const collected: Array<{ id: number; power: number; multiplier: number; active: boolean }> = [];
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
      });
    }
    if (collected.length >= (total ?? 0) || array.length < limit) break;
    skip += limit;
  }

  return collected;
}

async function getLivePrices(): Promise<{ btcPrice: number; gmtPrice: number }> {
  const [gmtRes, btcRes] = await Promise.all([
    getJson<{ data: { value: number } }>(`${API}/api/exchanges/getTokenPrice`),
    getJson<{ data: number }>(`${API}/api/exchanges/getPrice?symbol=BTC&value=1`),
  ]);
  return { gmtPrice: gmtRes.data?.value ?? 0, btcPrice: btcRes.data ?? 0 };
}

async function getDiscountFactor(headers: Record<string, string>): Promise<number> {
  const res = await postJson<{
    data: {
      dailyMaintenanceDiscount?: number;
      levelDiscount?: number;
      discountByMaintenanceInGmt?: number;
    };
  }>(`${API}/api/user/get-my-nft-discount`, headers, {});
  const d = res.data ?? {};
  return (
    1 -
    ((d.dailyMaintenanceDiscount ?? 0) +
      (d.levelDiscount ?? 0) +
      (d.discountByMaintenanceInGmt ?? 0))
  );
}

async function getMyNftAvgEE(headers: Record<string, string>): Promise<number | null> {
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

async function getCycleClanData(
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
  };
}

async function getUserPowerChart(headers: Record<string, string>, cycleStartDate: string) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const res = await postJson<{ data: Array<{ label: string; value: number }> }>(
    `${API}/api/nft/my-computing-power-chart`,
    headers,
    { start: cycleStartDate, end: end.toISOString() },
  );

  const map = new Map<string, number>();
  for (const entry of res.data ?? []) map.set(entry.label, entry.value);
  return map;
}

async function getClanPowerAnalytics(headers: Record<string, string>, clanId: number) {
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

async function getCurrentClanPower(headers: Record<string, string>, clanId: number) {
  const res = await postJson<{ data: { power: number } }>(
    `${API}/api/nft-game/clan/get-by-id`,
    headers,
    {
      clanId,
      pagination: { limit: 10, skip: 0, count: 0 },
      filters: { filterType: "none" },
      sort: { sortType: "none" },
    },
  );
  return res.data?.power ?? null;
}

async function getSoloMiningDates(
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

async function getMinerWarsActualIncome(
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

async function getMempoolEpochs(cycleDates: string[]) {
  // Full Bitcoin history — no 3-month limit, no extra block lookups needed
  const epochs = await fetchDifficultyEpochs();

  const byDate = new Map<string, number>();
  for (const dateStr of cycleDates) {
    let applicable: (typeof epochs)[0] | null = null;
    for (const ep of epochs) {
      if (ep.date <= dateStr) applicable = ep;
    }
    if (applicable) byDate.set(dateStr, applicable.satsPerTH);
  }

  const latest = epochs[epochs.length - 1];
  return { byDate, latestSatsPerTH: latest?.satsPerTH ?? null };
}

// ─── Cache ───────────────────────────────────────────────────────────────────

const comparisonCache = new Map<number, { data: MinerWarsComparison; ts: number }>();
let cyclesCache: { data: CycleInfo[]; ts: number } | null = null;

type CyclesStoreEntry = { data: CycleInfo[]; ts: number };

function loadPersistedCycles(): CyclesStoreEntry | null {
  try {
    const raw = localStorage.getItem(LS_KEY_MW_CYCLES);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data?: unknown; ts?: unknown };
    if (!Array.isArray(parsed.data) || typeof parsed.ts !== "number") return null;
    return { data: parsed.data as CycleInfo[], ts: parsed.ts };
  } catch {
    return null;
  }
}

function persistCycles(data: CycleInfo[]): void {
  try {
    localStorage.setItem(LS_KEY_MW_CYCLES, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // ignore quota errors
  }
}

// ─── Persistent localStorage cache (completed cycles only) ───────────────────

/** Read a cycle's comparison from localStorage. Returns null on miss/error. */
function loadPersistedComparison(
  cycleId: number,
): { data: MinerWarsComparison; ts: number } | null {
  try {
    const raw = localStorage.getItem(LS_KEY_MW_COMPARISON);
    if (!raw) return null;
    const store = JSON.parse(raw) as Record<string, unknown>;
    const entry = store[String(cycleId)] as
      | { data?: unknown; ts?: unknown }
      | MinerWarsComparison
      | undefined;
    if (!entry || typeof entry !== "object") return null;

    // New format: { data, ts }
    if ("data" in entry && "ts" in entry && typeof (entry as { ts?: unknown }).ts === "number") {
      return {
        data: (entry as { data: MinerWarsComparison }).data,
        ts: (entry as { ts: number }).ts,
      };
    }

    // Legacy format migration: entry was the comparison object itself.
    const legacy = entry as MinerWarsComparison;
    if (typeof legacy.cycleId === "number" && typeof legacy.cycleStart === "string") {
      const migrated = { data: legacy, ts: Date.now() };
      store[String(cycleId)] = migrated;
      localStorage.setItem(LS_KEY_MW_COMPARISON, JSON.stringify(store));
      return migrated;
    }

    return null;
  } catch {
    return null;
  }
}

/** Save a cycle's comparison to localStorage (both completed and live). */
function persistComparison(data: MinerWarsComparison): void {
  try {
    const raw = localStorage.getItem(LS_KEY_MW_COMPARISON);
    const store: Record<string, unknown> = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    store[String(data.cycleId)] = { data, ts: Date.now() };
    localStorage.setItem(LS_KEY_MW_COMPARISON, JSON.stringify(store));
  } catch {
    /* ignore quota errors */
  }
}

/**
 * Try to read the pool reward for a specific payment day directly from the
 * already-fetched build-report minerwars cache (localStorage), avoiding an
 * extra API round-trip when the user has already built their report.
 */
function getActualIncomeFromBuildCache(paymentDayStr: string): number | null {
  try {
    const raw = localStorage.getItem(LS_KEY_REWARD_PREFIX + "minerwars");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { records?: Array<Record<string, unknown>> };
    if (!Array.isArray(parsed.records)) return null;
    const matches = parsed.records.filter(
      (r) =>
        typeof r.createdAt === "string" && (r.createdAt as string).slice(0, 10) === paymentDayStr,
    );
    if (matches.length === 0) return null;
    let total = 0;
    for (const r of matches) total += Number(r.poolReward ?? 0);
    return total;
  } catch {
    return null;
  }
}

export function invalidateMinerWarsCache() {
  comparisonCache.clear();
  cyclesCache = null;
}

/** Remove a single cycle from both in-memory and localStorage caches (forces re-fetch). */
export function invalidateCycleCache(cycleId: number): void {
  comparisonCache.delete(cycleId);
  try {
    const raw = localStorage.getItem(LS_KEY_MW_COMPARISON);
    if (!raw) return;
    const store = JSON.parse(raw) as Record<string, unknown>;
    delete store[String(cycleId)];
    localStorage.setItem(LS_KEY_MW_COMPARISON, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

/** Read a cycle comparison from memory/localStorage only (no network). */
export function getCachedMinerWarsComparison(cycleId: number): MinerWarsComparison | null {
  const mem = comparisonCache.get(cycleId);
  if (mem) return mem.data;

  const persisted = loadPersistedComparison(cycleId);
  if (!persisted) return null;

  comparisonCache.set(cycleId, { data: persisted.data, ts: persisted.ts });
  return persisted.data;
}

// ─── Build-cache helpers for batch prefetch ──────────────────────────────────

/**
 * Derive solo-mining dates for a cycle from the build-report localStorage cache,
 * avoiding an extra API call.  Returns null if the solo-mining cache is absent.
 * Solo income records have createdAt ~00:10 UTC the day AFTER the mining date.
 */
function getSoloDaysFromBuildCache(cycleStart: string, cycleEnd: string): Set<string> | null {
  try {
    const raw = localStorage.getItem(LS_KEY_REWARD_PREFIX + "solo-mining");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { records?: Array<Record<string, unknown>> };
    if (!Array.isArray(parsed.records)) return null;
    const dates = new Set<string>();
    for (const r of parsed.records) {
      if (typeof r.createdAt !== "string") continue;
      const dayBefore = new Date(r.createdAt as string);
      dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
      const miningDate = dayBefore.toISOString().slice(0, 10);
      if (miningDate >= cycleStart && miningDate <= cycleEnd) dates.add(miningDate);
    }
    return dates;
  } catch {
    return null;
  }
}

/**
 * Pre-compute and persist MinerWars comparisons for all completed cycles that are
 * in the build-report cache but not yet in the persistent comparison store.
 *
 * API calls: fetchAvailableCycles (1×, cached) + getUserPowerChart (1× total, covers
 * full history) + fetchDifficultyEpochs (cached) + getSoloMiningDates (only if
 * solo-mining build cache is absent — otherwise 0 API calls per cycle).
 *
 * Call this in the background after the build report completes.
 */
export async function prefetchAllCompletedCycles(token: string): Promise<void> {
  const TODAY = new Date().toISOString().slice(0, 10);
  const headers = buildApiHeaders(token);

  let cycles: CycleInfo[];
  try {
    cycles = await fetchAvailableCycles(token);
  } catch {
    return;
  }

  // Only completed cycles not already persisted
  const todo = cycles.filter(
    (c) => c.cycleEnd < TODAY && loadPersistedComparison(c.cycleId) == null,
  );
  if (todo.length === 0) return;

  // Only process cycles that have actual BTC data in the build cache
  const toProcess = todo.filter((c) => {
    const payDay = new Date(c.cycleEnd + "T00:00:00Z");
    payDay.setUTCDate(payDay.getUTCDate() + 1);
    return getActualIncomeFromBuildCache(payDay.toISOString().slice(0, 10)) !== null;
  });
  if (toProcess.length === 0) return;

  // One getUserPowerChart call covering all cycles (earliest start date)
  const earliestStart = toProcess.reduce(
    (min, c) => (c.cycleStart < min ? c.cycleStart : min),
    toProcess[0].cycleStart,
  );
  let userPowerByDate: Map<string, number>;
  try {
    userPowerByDate = await getUserPowerChart(headers, earliestStart + "T00:00:00.000Z");
  } catch {
    return;
  }
  const lastUserPower =
    userPowerByDate.size > 0 ? ([...userPowerByDate.values()].slice(-1)[0] ?? null) : null;

  // Difficulty epochs — already cached in memory after first use
  const epochs = await fetchDifficultyEpochs();

  for (const cycle of toProcess) {
    try {
      const { cycleId, cycleStart: CYCLE_START, cycleEnd: CYCLE_END } = cycle;

      // Actual BTC from build cache
      const payDay = new Date(CYCLE_END + "T00:00:00Z");
      payDay.setUTCDate(payDay.getUTCDate() + 1);
      const actualMinerWarsBtc = getActualIncomeFromBuildCache(payDay.toISOString().slice(0, 10));
      if (actualMinerWarsBtc === null) continue;

      // Build the list of dates in this cycle
      const cycleDates: string[] = [];
      for (let d = new Date(CYCLE_START + "T00:00:00Z"); ; d.setUTCDate(d.getUTCDate() + 1)) {
        const s = d.toISOString().slice(0, 10);
        cycleDates.push(s);
        if (s === CYCLE_END) break;
      }
      const cycleDateSet = new Set(cycleDates);

      // Difficulty per date
      const satsPerThByDate = new Map<string, number>();
      for (const dateStr of cycleDates) {
        let applicable: (typeof epochs)[0] | null = null;
        for (const ep of epochs) {
          if (ep.date <= dateStr) applicable = ep;
        }
        if (applicable) satsPerThByDate.set(dateStr, applicable.satsPerTH);
      }
      const latestSatsPerTH = epochs[epochs.length - 1]?.satsPerTH ?? null;

      // Solo days — build cache first, fall back to API
      const solodayCandidates =
        getSoloDaysFromBuildCache(CYCLE_START, CYCLE_END) ??
        (await getSoloMiningDates(headers, CYCLE_START, CYCLE_END));

      // soloEquivSats & targetSoloSats (same loop — all days are actual for completed cycles)
      let soloEquivSats = 0;
      let targetSoloSats = 0;
      let targetActualDays = 0;
      for (const dateStr of cycleDates) {
        if (solodayCandidates.has(dateStr)) continue;
        const userPow = userPowerByDate.has(dateStr)
          ? userPowerByDate.get(dateStr)!
          : (lastUserPower ?? 0);
        const satsPerTH = satsPerThByDate.get(dateStr) ?? latestSatsPerTH;
        if (satsPerTH != null && userPow) {
          soloEquivSats += satsPerTH * userPow;
          targetSoloSats += satsPerTH * userPow;
          targetActualDays++;
        }
      }

      const minerWarsSats = actualMinerWarsBtc * 1e8;
      const diffSats = minerWarsSats - soloEquivSats;
      const diffPct = soloEquivSats > 0 ? (diffSats / soloEquivSats) * 100 : null;
      const progressPct = targetSoloSats > 0 ? (minerWarsSats / targetSoloSats) * 100 : null;
      const soloDaysSorted = [...solodayCandidates].filter((d) => cycleDateSet.has(d)).sort();
      const windowLabel =
        soloDaysSorted.length === 0
          ? "full cycle"
          : `excl. solo day(s): ${soloDaysSorted.join(", ")}`;

      const result: MinerWarsComparison = {
        cycleId,
        cycleStart: CYCLE_START,
        cycleEnd: CYCLE_END,
        today: TODAY,
        minerWarsSats,
        clanMinerWarsSats: null,
        btcFundBtc: null,
        soloEquivSats,
        diffSats,
        diffPct,
        targetSoloSats,
        progressPct,
        targetActualDays,
        targetProjectedDays: 0, // completed — no projections
        latestSatsPerTH,
        windowLabel,
        soloDays: soloDaysSorted,
        hasClanAnalytics: true, // suppressed for completed cycles anyway
        btcFundIsZero: false, // has actual income
        actualMinerWarsBtc,
        clanTargetSoloSats: null,
        btcPerBlockSats: null,
        cycleLength: cycleDates.length,
        maintenanceBtc: null,
        maintenanceGmt: null,
        rewardGmt: null,
        netBtc: null,
        netGmt: null,
        btcPrice: null,
        gmtPrice: null,
      };

      persistComparison(result);
      comparisonCache.set(cycleId, { data: result, ts: Date.now() });
    } catch {
      // continue with next cycle on any per-cycle error
    }
  }
}

// ─── Public: fetch available cycles ─────────────────────────────────────────

/** Read cycles from memory/localStorage cache only. Returns null when no cache exists. */
export function getCachedCycles(): CycleInfo[] | null {
  if (cyclesCache) return withResolvedStatuses(cyclesCache.data);
  const persisted = loadPersistedCycles();
  if (persisted) {
    cyclesCache = persisted;
    return withResolvedStatuses(persisted.data);
  }
  return null;
}

/** Fetch cycles from cache, falling back to API when cache is empty (requires valid token). */
export async function fetchAvailableCycles(token: string): Promise<CycleInfo[]> {
  if (cyclesCache) return withResolvedStatuses(cyclesCache.data);

  const persisted = loadPersistedCycles();
  if (persisted) {
    cyclesCache = persisted;
    return withResolvedStatuses(persisted.data);
  }

  const data = await fetchAllCyclesFromApi(buildApiHeaders(token));
  cyclesCache = { data, ts: Date.now() };
  persistCycles(data);
  return withResolvedStatuses(data);
}

// ─── Public: fetch comparison for a specific cycle ───────────────────────────

export async function fetchMinerWarsComparison(
  token: string,
  targetCycleId: number | null = null,
): Promise<MinerWarsComparison> {
  const TODAY = new Date().toISOString().slice(0, 10);

  // Fast path: always read from localStorage when available.
  // Use the refresh button to force a live cycle re-fetch.
  if (targetCycleId !== null) {
    const persisted = loadPersistedComparison(targetCycleId);
    if (persisted) {
      const statusNow = resolveCycleStatus(persisted.data.cycleEnd, TODAY);
      const hasActual = persisted.data.actualMinerWarsBtc != null;
      const shouldRecompute = statusNow === "completed" && !hasActual;
      if (!shouldRecompute) {
        comparisonCache.set(targetCycleId, { data: persisted.data, ts: persisted.ts });
        return persisted.data;
      }
    }
  }

  const headers = buildApiHeaders(token);

  // 1. Cycle rounds (auto-detect or specific)
  const {
    cycleId,
    cycleStartDate,
    rounds: userRounds,
  } = await getCycleRounds(headers, targetCycleId);
  if (!cycleId || !cycleStartDate || userRounds.length === 0) {
    throw new Error("No rounds found for selected cycle");
  }

  // Check in-memory cache (no TTL; explicit refresh invalidates the entry)
  const CYCLE_END_CHECK = cycleEndFromStart(cycleStartDate.slice(0, 10));
  const cycleStatusNow = resolveCycleStatus(CYCLE_END_CHECK, TODAY);
  const isCompleted = cycleStatusNow === "completed";
  const cached = comparisonCache.get(cycleId);
  if (cached) return cached.data;

  userRounds.sort((a, b) => b.roundId - a.roundId);
  const refRound = userRounds[0];
  const leagueId = refRound.leagueId;
  const clanId = refRound.clanId;

  // 2. All rounds in cycle
  const allCycleRounds = await getAllRoundsInCycle(headers, cycleId, leagueId);
  const completedRounds = allCycleRounds.filter((r) => !r.active && r.power > 0);
  const sumAllMultipliers = completedRounds.reduce((s, r) => s + r.multiplier, 0);
  const totalPowerSum = completedRounds.reduce((s, r) => s + r.power, 0);
  const avgRoundNftPower = completedRounds.length > 0 ? totalPowerSum / completedRounds.length : 1;
  const completedRoundsMap = new Map(completedRounds.map((r) => [r.id, r]));

  // 3. BTC fund + total mined blocks + clan power
  const { btcFund, totalMinedBlocks, clanNftPower, leagueWeightedEE } = await getCycleClanData(
    headers,
    cycleStartDate,
    leagueId,
    clanId,
  );
  const btcPerBlock = totalMinedBlocks > 0 ? btcFund / totalMinedBlocks : 0;

  // 4. Power charts (parallel)
  const [userPowerByDate, clanPowerByDate, currentClanPower] = await Promise.all([
    getUserPowerChart(headers, cycleStartDate),
    getClanPowerAnalytics(headers, clanId),
    getCurrentClanPower(headers, clanId),
  ]);

  const lastUserPower =
    userPowerByDate.size > 0 ? ([...userPowerByDate.values()].slice(-1)[0] ?? null) : null;

  // 5. Round reward calculation
  const CYCLE_END = CYCLE_END_CHECK;
  const CYCLE_START = cycleStartDate.slice(0, 10);
  const isCycleLive = TODAY >= CYCLE_START && TODAY <= CYCLE_END;

  const cycleCutoff = CYCLE_END < TODAY ? CYCLE_END : TODAY;
  const cycleDates: string[] = [];
  for (
    let d = new Date(cycleStartDate);
    d.toISOString().slice(0, 10) <= cycleCutoff;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    cycleDates.push(d.toISOString().slice(0, 10));
  }

  // Live cycles have a one-day funding lag: day 1 is funded on day 2.
  // For elapsed solo-equivalent comparisons, exclude cycle day 1 while live.
  const elapsedComparisonDates = isCycleLive ? cycleDates.slice(1) : cycleDates;

  const roundRewards = new Map<number, { userBtc: number; clanBtc: number; date: string }>();
  for (const round of userRounds) {
    const entry = completedRoundsMap.get(round.roundId);
    if (!entry) continue;

    const roundDate = toDateStr(round.endedAt);
    const isToday = roundDate >= TODAY;
    const effectiveUserPower = userPowerByDate.has(roundDate)
      ? userPowerByDate.get(roundDate)!
      : (lastUserPower ?? 0);
    const effectiveClanPower = clanPowerByDate.has(roundDate)
      ? clanPowerByDate.get(roundDate)!
      : isToday
        ? (currentClanPower ?? clanNftPower ?? 1)
        : (clanNftPower ?? 1);

    const powerRatio = entry.power / avgRoundNftPower;
    // Clan reward: new validated formula — btcFund / totalMinedBlocks × multiplier
    const clanReward = btcPerBlock * round.multiplier;
    // User reward: validated estimation — power-weighted share of old formula base
    const userReward =
      effectiveClanPower > 0
        ? ((round.multiplier / sumAllMultipliers) * btcFund * powerRatio * effectiveUserPower) /
          effectiveClanPower
        : 0;

    roundRewards.set(round.roundId, { userBtc: userReward, clanBtc: clanReward, date: roundDate });
  }

  // 6. Mempool difficulty + solo dates + actual income + maintenance inputs (parallel)
  const [
    { byDate: satsPerThByDate, latestSatsPerTH },
    solodays,
    actualMinerWarsBtc,
    maintDiscountFactor,
    maintPrices,
    maintUserEE,
  ] = await Promise.all([
    getMempoolEpochs(cycleDates),
    getSoloMiningDates(headers, CYCLE_START, CYCLE_END),
    isCompleted ? getMinerWarsActualIncome(headers, CYCLE_END) : Promise.resolve(null),
    getDiscountFactor(headers).catch(() => 1),
    getLivePrices().catch(() => ({ btcPrice: 0, gmtPrice: 0 })),
    getMyNftAvgEE(headers).catch(() => null),
  ]);

  // 7. Compute comparison
  let minerWarsSats = 0;
  let clanMinerWarsSats = 0;
  for (const { userBtc, clanBtc, date } of roundRewards.values()) {
    if (!solodays.has(date)) {
      minerWarsSats += userBtc * 1e8;
      clanMinerWarsSats += clanBtc * 1e8;
    }
  }

  let soloEquivSats = 0;
  for (const dateStr of elapsedComparisonDates) {
    if (solodays.has(dateStr)) continue;
    const userPow = userPowerByDate.has(dateStr)
      ? userPowerByDate.get(dateStr)!
      : (lastUserPower ?? 0);
    const satsPerTH = satsPerThByDate.get(dateStr) ?? latestSatsPerTH;
    if (satsPerTH != null && userPow) soloEquivSats += satsPerTH * userPow;
  }

  const diffSats = minerWarsSats - soloEquivSats;
  const diffPct = soloEquivSats > 0 ? (diffSats / soloEquivSats) * 100 : null;

  // ── Maintenance estimation (per-round official formula) ──────────────────
  const KWH = 0.05; // $/kWh — GoMining platform constant
  const SVC = 0.0089; // $/TH/day — GoMining platform constant
  const userEE = maintUserEE ?? 15;
  const leagueEE = leagueWeightedEE ?? userEE;
  const elapsedMWDays = elapsedComparisonDates.filter((d) => !solodays.has(d)).length;
  const { btcPrice: maintBtcPrice, gmtPrice: maintGmtPrice } = maintPrices;

  let maintenanceBtc: number | null = null;
  let maintenanceGmt: number | null = null;
  let rewardGmt: number | null = null;
  let netBtc: number | null = null;
  let netGmt: number | null = null;

  if (maintBtcPrice > 0 && elapsedMWDays > 0) {
    let totalMaintUSD = 0;
    let cumulativeMWSats = 0;
    const sortedForMaint = [...userRounds].sort((a, b) => a.roundId - b.roundId);
    for (const round of sortedForMaint) {
      const roundDate = toDateStr(round.endedAt);
      if (solodays.has(roundDate)) continue;
      const entry = completedRoundsMap.get(round.roundId);
      const roundPower = entry?.power ?? 0;
      const userTH = userPowerByDate.has(roundDate)
        ? userPowerByDate.get(roundDate)!
        : (lastUserPower ?? 0);
      const isToday = roundDate >= TODAY;
      const clanTH = clanPowerByDate.has(roundDate)
        ? clanPowerByDate.get(roundDate)!
        : isToday
          ? (currentClanPower ?? clanNftPower ?? 1)
          : (clanNftPower ?? 1);
      const EE = cumulativeMWSats < soloEquivSats ? userEE : leagueEE;
      const roundElecUSD = (KWH * 24 * elapsedMWDays * roundPower * EE) / 1000;
      const roundSvcUSD = SVC * elapsedMWDays * roundPower;
      const share =
        clanTH > 0 && sumAllMultipliers > 0
          ? (round.multiplier / sumAllMultipliers) * (userTH / clanTH)
          : 0;
      totalMaintUSD += (roundElecUSD + roundSvcUSD) * share * maintDiscountFactor;
      cumulativeMWSats += btcPerBlock * round.multiplier * (clanTH > 0 ? userTH / clanTH : 0) * 1e8;
    }
    maintenanceBtc = totalMaintUSD / maintBtcPrice;
    maintenanceGmt = maintGmtPrice > 0 ? totalMaintUSD / maintGmtPrice : null;
    const effectiveMwBtc = actualMinerWarsBtc ?? minerWarsSats / 1e8;
    rewardGmt = maintGmtPrice > 0 ? (effectiveMwBtc * maintBtcPrice) / maintGmtPrice : null;
    netBtc = effectiveMwBtc - maintenanceBtc;
    netGmt = rewardGmt != null && maintenanceGmt != null ? rewardGmt - maintenanceGmt : null;
  }

  // 8. Full 7-day target
  const fullCycleDates: string[] = [];
  for (let d = new Date(CYCLE_START + "T00:00:00Z"); ; d.setUTCDate(d.getUTCDate() + 1)) {
    const s = d.toISOString().slice(0, 10);
    fullCycleDates.push(s);
    if (s === CYCLE_END) break;
  }

  const cycleDateSet = new Set(cycleDates);
  let targetSoloSats = 0;
  let targetActualDays = 0;
  let targetProjectedDays = 0;
  let clanTargetSoloSats = 0;
  const lastClanPower = currentClanPower ?? clanNftPower ?? 0;

  for (const dateStr of fullCycleDates) {
    const isPast = elapsedComparisonDates.includes(dateStr);
    const satsPerTH = isPast ? (satsPerThByDate.get(dateStr) ?? latestSatsPerTH) : latestSatsPerTH;

    if (!solodays.has(dateStr)) {
      const userPow = isPast
        ? userPowerByDate.has(dateStr)
          ? userPowerByDate.get(dateStr)!
          : (lastUserPower ?? 0)
        : (lastUserPower ?? 0);
      if (satsPerTH != null && userPow) {
        targetSoloSats += satsPerTH * userPow;
        if (isPast) targetActualDays++;
        else targetProjectedDays++;
      }
    }

    const clanPow = isPast
      ? clanPowerByDate.has(dateStr)
        ? clanPowerByDate.get(dateStr)!
        : lastClanPower
      : lastClanPower;
    if (satsPerTH != null && clanPow) clanTargetSoloSats += satsPerTH * clanPow;
  }

  const progressPct = targetSoloSats > 0 ? (minerWarsSats / targetSoloSats) * 100 : null;
  const soloDaysSorted = [...solodays].filter((d) => cycleDateSet.has(d)).sort();
  const windowLabel =
    soloDaysSorted.length === 0 ? "full cycle" : `excl. solo day(s): ${soloDaysSorted.join(", ")}`;

  const result: MinerWarsComparison = {
    cycleId,
    cycleStart: CYCLE_START,
    cycleEnd: CYCLE_END,
    today: TODAY,
    minerWarsSats,
    clanMinerWarsSats,
    btcFundBtc: btcFund,
    soloEquivSats,
    diffSats,
    diffPct,
    targetSoloSats,
    progressPct,
    targetActualDays,
    targetProjectedDays,
    latestSatsPerTH,
    windowLabel,
    soloDays: soloDaysSorted,
    hasClanAnalytics: clanPowerByDate.size > 0,
    btcFundIsZero: btcFund === 0,
    actualMinerWarsBtc,
    clanTargetSoloSats: lastClanPower > 0 ? clanTargetSoloSats : null,
    btcPerBlockSats: totalMinedBlocks > 0 ? (btcFund / totalMinedBlocks) * 1e8 : null,
    cycleLength: cycleDates.length,
    maintenanceBtc,
    maintenanceGmt,
    rewardGmt,
    netBtc,
    netGmt,
    btcPrice: maintBtcPrice > 0 ? maintBtcPrice : null,
    gmtPrice: maintGmtPrice > 0 ? maintGmtPrice : null,
  };

  comparisonCache.set(cycleId, { data: result, ts: Date.now() });
  persistComparison(result); // persist both completed and live cycles
  return result;
}
