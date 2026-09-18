import { LS_KEY_MW_SIM_INPUTS } from "@/lib/storage-keys";
import type { HistoricalPriceEntry } from "./cache";
import { loadHistoricalPrices, persistHistoricalPrices } from "./cache";
import { addUtcDays } from "./date-range";
import { getHistoricalPrices, type RoundRow } from "./api";

export type MaintenanceRecomputeInputs = {
  userRounds: RoundRow[];
  completedRoundsMap: Map<number, { power: number }>;
  userPowerByDate: Map<string, number>;
  clanPowerByDate: Map<string, number>;
  // Reconstructed from that day's actual leaderboard participants (see
  // getClanThByDate()) — preferred over clanPowerByDate/currentClanPower/clanNftPower
  // when available, since it correctly reflects members who've since left the clan.
  clanThByDate: Map<string, number>;
  currentClanPower: number | null;
  clanNftPower: number | null;
  lastUserPower: number | null;
  roundRewards: Map<number, { userBtc: number; clanBtc: number; date: string }>;
  solodays: Set<string>;
  sumAllMultipliers: number;
  soloEquivSats: number;
  elapsedMWDays: number;
  userEE: number;
  leagueEE: number;
  maintBtcPrice: number;
  maintGmtPrice: number;
  historicalPrices: Map<string, HistoricalPriceEntry>;
  maintDiscountFactor: number;
  maintGmtDiscount: number;
  actualMinerWarsBtc: number | null;
  minerWarsSatsBase: number;
  btcPerBlock: number;
  // Per-round override for the round's OWN league/clan context (clan TH, league
  // EE/discount, btcPerBlock, sumAllMultipliers) — populated when the user won rounds
  // under more than one league/clan this cycle. Rounds without an entry here fall back
  // to the scalar current-league values above (the common single-league case).
  roundContextById: Map<
    number,
    {
      clanTH: number;
      leagueEE: number | null;
      leagueDiscountFactor: number | null;
      btcPerBlock: number;
      sumAllMultipliers: number;
    }
  >;
  today: string;
  currentLeagueId: number;
  currentClanId: number;
  clanNamesByGroup: Map<string, string | null>;
};

const maintInputsCache = new Map<number, MaintenanceRecomputeInputs>();

type PersistedMaintenanceRecomputeInputs = {
  userRounds: RoundRow[];
  completedRoundsMap: Array<[number, { power: number }]>;
  userPowerByDate: Array<[string, number]>;
  clanPowerByDate: Array<[string, number]>;
  clanThByDate: Array<[string, number]>;
  currentClanPower: number | null;
  clanNftPower: number | null;
  lastUserPower: number | null;
  roundRewards: Array<[number, { userBtc: number; clanBtc: number; date: string }]>;
  soloDays: string[];
  sumAllMultipliers: number;
  soloEquivSats: number;
  elapsedMWDays: number;
  userEE: number;
  leagueEE: number;
  maintBtcPrice: number;
  maintGmtPrice: number;
  historicalPrices: Array<[string, HistoricalPriceEntry]>;
  maintDiscountFactor: number;
  maintGmtDiscount: number;
  actualMinerWarsBtc: number | null;
  minerWarsSatsBase: number;
  btcPerBlock: number;
  roundContextById: Array<
    [
      number,
      {
        clanTH: number;
        leagueEE: number | null;
        leagueDiscountFactor: number | null;
        btcPerBlock: number;
        sumAllMultipliers: number;
      },
    ]
  >;
  today: string;
  currentLeagueId: number;
  currentClanId: number;
  clanNamesByGroup: Array<[string, string | null]>;
};

export async function getHistoricalPricesCached(
  dates: string[],
): Promise<Map<string, HistoricalPriceEntry>> {
  const cached = loadHistoricalPrices(dates);
  const missingDates = dates.filter((date) => !cached.has(date));
  if (missingDates.length === 0) return cached;

  const fetched = await getHistoricalPrices(missingDates).catch(
    () => new Map<string, HistoricalPriceEntry>(),
  );
  if (fetched.size > 0) persistHistoricalPrices(fetched);

  const merged = new Map(cached);
  for (const [date, price] of fetched) merged.set(date, price);
  return merged;
}

export function historicalGmtPerBtc(
  dateStr: string,
  historicalPrices: Map<string, HistoricalPriceEntry>,
  liveBtcPrice: number,
  liveGmtPrice: number,
): number | null {
  const settled = historicalPrices.get(addUtcDays(dateStr, 1));
  if (settled && settled.gmtUsd > 0) return settled.btcUsd / settled.gmtUsd;
  return liveGmtPrice > 0 ? liveBtcPrice / liveGmtPrice : null;
}

function serializeMaintInputs(
  inputs: MaintenanceRecomputeInputs,
): PersistedMaintenanceRecomputeInputs {
  return {
    userRounds: inputs.userRounds,
    completedRoundsMap: Array.from(inputs.completedRoundsMap.entries()),
    userPowerByDate: Array.from(inputs.userPowerByDate.entries()),
    clanPowerByDate: Array.from(inputs.clanPowerByDate.entries()),
    clanThByDate: Array.from(inputs.clanThByDate.entries()),
    currentClanPower: inputs.currentClanPower,
    clanNftPower: inputs.clanNftPower,
    lastUserPower: inputs.lastUserPower,
    roundRewards: Array.from(inputs.roundRewards.entries()),
    soloDays: Array.from(inputs.solodays),
    sumAllMultipliers: inputs.sumAllMultipliers,
    soloEquivSats: inputs.soloEquivSats,
    elapsedMWDays: inputs.elapsedMWDays,
    userEE: inputs.userEE,
    leagueEE: inputs.leagueEE,
    maintBtcPrice: inputs.maintBtcPrice,
    maintGmtPrice: inputs.maintGmtPrice,
    historicalPrices: Array.from(inputs.historicalPrices.entries()),
    maintDiscountFactor: inputs.maintDiscountFactor,
    maintGmtDiscount: inputs.maintGmtDiscount,
    actualMinerWarsBtc: inputs.actualMinerWarsBtc,
    minerWarsSatsBase: inputs.minerWarsSatsBase,
    btcPerBlock: inputs.btcPerBlock,
    roundContextById: Array.from(inputs.roundContextById.entries()),
    today: inputs.today,
    currentLeagueId: inputs.currentLeagueId,
    currentClanId: inputs.currentClanId,
    clanNamesByGroup: Array.from(inputs.clanNamesByGroup.entries()),
  };
}

function deserializeMaintInputs(raw: unknown): MaintenanceRecomputeInputs | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as Partial<PersistedMaintenanceRecomputeInputs>;
  if (!Array.isArray(parsed.userRounds)) return null;
  return {
    userRounds: parsed.userRounds,
    completedRoundsMap: new Map(parsed.completedRoundsMap ?? []),
    userPowerByDate: new Map(parsed.userPowerByDate ?? []),
    clanPowerByDate: new Map(parsed.clanPowerByDate ?? []),
    clanThByDate: new Map(parsed.clanThByDate ?? []),
    currentClanPower: parsed.currentClanPower ?? null,
    clanNftPower: parsed.clanNftPower ?? null,
    lastUserPower: parsed.lastUserPower ?? null,
    roundRewards: new Map(parsed.roundRewards ?? []),
    solodays: new Set(parsed.soloDays ?? []),
    sumAllMultipliers: parsed.sumAllMultipliers ?? 0,
    soloEquivSats: parsed.soloEquivSats ?? 0,
    elapsedMWDays: parsed.elapsedMWDays ?? 0,
    userEE: parsed.userEE ?? 15,
    leagueEE: parsed.leagueEE ?? parsed.userEE ?? 15,
    maintBtcPrice: parsed.maintBtcPrice ?? 0,
    maintGmtPrice: parsed.maintGmtPrice ?? 0,
    historicalPrices: new Map(parsed.historicalPrices ?? []),
    maintDiscountFactor: parsed.maintDiscountFactor ?? 1,
    maintGmtDiscount: parsed.maintGmtDiscount ?? 0,
    actualMinerWarsBtc: parsed.actualMinerWarsBtc ?? null,
    minerWarsSatsBase: parsed.minerWarsSatsBase ?? 0,
    btcPerBlock: parsed.btcPerBlock ?? 0,
    roundContextById: new Map(parsed.roundContextById ?? []),
    today: parsed.today ?? new Date().toISOString().slice(0, 10),
    currentLeagueId: parsed.currentLeagueId ?? parsed.userRounds[0]?.leagueId ?? 0,
    currentClanId: parsed.currentClanId ?? parsed.userRounds[0]?.clanId ?? 0,
    clanNamesByGroup: new Map(parsed.clanNamesByGroup ?? []),
  };
}

function persistMaintInputs(cycleId: number, inputs: MaintenanceRecomputeInputs): void {
  try {
    const raw = localStorage.getItem(LS_KEY_MW_SIM_INPUTS);
    const store: Record<string, unknown> = raw ? JSON.parse(raw) : {};
    store[String(cycleId)] = { data: serializeMaintInputs(inputs) };
    localStorage.setItem(LS_KEY_MW_SIM_INPUTS, JSON.stringify(store));
  } catch {
    // ignore quota errors
  }
}

function loadPersistedMaintInputs(cycleId: number): MaintenanceRecomputeInputs | null {
  try {
    const raw = localStorage.getItem(LS_KEY_MW_SIM_INPUTS);
    if (!raw) return null;
    const store = JSON.parse(raw) as Record<string, { data?: unknown }>;
    const entry = store[String(cycleId)];
    if (!entry) return null;
    return deserializeMaintInputs(entry.data);
  } catch {
    return null;
  }
}

export function deletePersistedMaintInputs(cycleId: number): void {
  try {
    const raw = localStorage.getItem(LS_KEY_MW_SIM_INPUTS);
    if (!raw) return;
    const store = JSON.parse(raw) as Record<string, unknown>;
    delete store[String(cycleId)];
    localStorage.setItem(LS_KEY_MW_SIM_INPUTS, JSON.stringify(store));
  } catch {
    // ignore
  }
}

export function getMaintInputs(cycleId: number): MaintenanceRecomputeInputs | null {
  const cached = maintInputsCache.get(cycleId);
  if (cached) return cached;
  const persisted = loadPersistedMaintInputs(cycleId);
  if (!persisted) return null;
  maintInputsCache.set(cycleId, persisted);
  return persisted;
}

export function cacheMaintInputs(cycleId: number, inputs: MaintenanceRecomputeInputs): void {
  maintInputsCache.set(cycleId, inputs);
  persistMaintInputs(cycleId, inputs);
}

export function clearMaintInputsCache(cycleId?: number): void {
  if (typeof cycleId === "number") {
    maintInputsCache.delete(cycleId);
    return;
  }
  maintInputsCache.clear();
}
