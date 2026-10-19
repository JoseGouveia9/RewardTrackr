import { LOCAL_STORAGE_KEY_MINERWARS_SIMULATION_INPUTS } from "@/lib/storage-keys";
import { loadHistoricalPrices, persistHistoricalPrices, type HistoricalPriceEntry } from "./cache";
import { addUtcDays } from "../utils/date-range";
import { getHistoricalPrices } from "../api/prices";
import type { RoundRow } from "../api/cycles";

type RoundContext = {
  clanTerahash: number;
  leagueEnergyEfficiency: number | null;
  leagueDiscountFactor: number | null;
  btcPerBlock: number;
  sumAllMultipliers: number;
};

export type MaintenanceRecomputeInputs = {
  userRounds: RoundRow[];
  completedRoundsMap: Map<number, { power: number }>;
  userPowerByDate: Map<string, number>;
  clanPowerByDate: Map<string, number>;
  clanTerahashByDate: Map<string, number>;
  currentClanPower: number | null;
  clanNftPower: number | null;
  lastUserPower: number | null;
  roundRewards: Map<number, { userBtc: number; clanBtc: number; date: string }>;
  solodays: Set<string>;
  sumAllMultipliers: number;
  soloEquivSats: number;
  elapsedMinerWarsDays: number;
  userEnergyEfficiency: number;
  leagueEnergyEfficiency: number;
  maintenanceBtcPrice: number;
  maintenanceGmtPrice: number;
  historicalPrices: Map<string, HistoricalPriceEntry>;
  maintenanceDiscountFactor: number;
  maintenanceGmtDiscount: number;
  actualMinerWarsBtc: number | null;
  minerWarsSatsBase: number;
  btcPerBlock: number;
  roundContextById: Map<number, RoundContext>;
  today: string;
  currentLeagueId: number;
  currentClanId: number;
  clanNamesByGroup: Map<string, string | null>;
};

const maintenanceInputsCache = new Map<number, MaintenanceRecomputeInputs>();

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
  roundContextById: Array<[number, RoundContext]>;
  today: string;
  currentLeagueId: number;
  currentClanId: number;
  clanNamesByGroup: Array<[string, string | null]>;
};

/** Serves prices from localStorage and fetches (then persists) only the missing dates. */
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

/** GMT per BTC at the day's settled price (the next day's snapshot), else the live rate. */
export function historicalGmtPerBtc(
  dateString: string,
  historicalPrices: Map<string, HistoricalPriceEntry>,
  liveBtcPrice: number,
  liveGmtPrice: number,
): number | null {
  const settled = historicalPrices.get(addUtcDays(dateString, 1));
  if (settled && settled.gmtUsd > 0) return settled.btcUsd / settled.gmtUsd;
  return liveGmtPrice > 0 ? liveBtcPrice / liveGmtPrice : null;
}

/** Converts the Map-based recompute inputs into arrays so they can be stored as JSON. */
function serializeMaintenanceInputs(
  inputs: MaintenanceRecomputeInputs,
): PersistedMaintenanceRecomputeInputs {
  return {
    userRounds: inputs.userRounds,
    completedRoundsMap: Array.from(inputs.completedRoundsMap.entries()),
    userPowerByDate: Array.from(inputs.userPowerByDate.entries()),
    clanPowerByDate: Array.from(inputs.clanPowerByDate.entries()),
    clanThByDate: Array.from(inputs.clanTerahashByDate.entries()),
    currentClanPower: inputs.currentClanPower,
    clanNftPower: inputs.clanNftPower,
    lastUserPower: inputs.lastUserPower,
    roundRewards: Array.from(inputs.roundRewards.entries()),
    soloDays: Array.from(inputs.solodays),
    sumAllMultipliers: inputs.sumAllMultipliers,
    soloEquivSats: inputs.soloEquivSats,
    elapsedMWDays: inputs.elapsedMinerWarsDays,
    userEE: inputs.userEnergyEfficiency,
    leagueEE: inputs.leagueEnergyEfficiency,
    maintBtcPrice: inputs.maintenanceBtcPrice,
    maintGmtPrice: inputs.maintenanceGmtPrice,
    historicalPrices: Array.from(inputs.historicalPrices.entries()),
    maintDiscountFactor: inputs.maintenanceDiscountFactor,
    maintGmtDiscount: inputs.maintenanceGmtDiscount,
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

/** Rebuilds Maps/Sets with defaults for missing fields (EE defaults to 15); null if malformed. */
function deserializeMaintenanceInputs(raw: unknown): MaintenanceRecomputeInputs | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as Partial<PersistedMaintenanceRecomputeInputs>;
  if (!Array.isArray(parsed.userRounds)) return null;
  return {
    userRounds: parsed.userRounds,
    completedRoundsMap: new Map(parsed.completedRoundsMap ?? []),
    userPowerByDate: new Map(parsed.userPowerByDate ?? []),
    clanPowerByDate: new Map(parsed.clanPowerByDate ?? []),
    clanTerahashByDate: new Map(parsed.clanThByDate ?? []),
    currentClanPower: parsed.currentClanPower ?? null,
    clanNftPower: parsed.clanNftPower ?? null,
    lastUserPower: parsed.lastUserPower ?? null,
    roundRewards: new Map(parsed.roundRewards ?? []),
    solodays: new Set(parsed.soloDays ?? []),
    sumAllMultipliers: parsed.sumAllMultipliers ?? 0,
    soloEquivSats: parsed.soloEquivSats ?? 0,
    elapsedMinerWarsDays: parsed.elapsedMWDays ?? 0,
    userEnergyEfficiency: parsed.userEE ?? 15,
    leagueEnergyEfficiency: parsed.leagueEE ?? parsed.userEE ?? 15,
    maintenanceBtcPrice: parsed.maintBtcPrice ?? 0,
    maintenanceGmtPrice: parsed.maintGmtPrice ?? 0,
    historicalPrices: new Map(parsed.historicalPrices ?? []),
    maintenanceDiscountFactor: parsed.maintDiscountFactor ?? 1,
    maintenanceGmtDiscount: parsed.maintGmtDiscount ?? 0,
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

function persistMaintenanceInputs(cycleId: number, inputs: MaintenanceRecomputeInputs): void {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_MINERWARS_SIMULATION_INPUTS);
    const store: Record<string, unknown> = raw ? JSON.parse(raw) : {};
    store[String(cycleId)] = { data: serializeMaintenanceInputs(inputs) };
    localStorage.setItem(LOCAL_STORAGE_KEY_MINERWARS_SIMULATION_INPUTS, JSON.stringify(store));
    // eslint-disable-next-line no-empty
  } catch {}
}

function loadPersistedMaintenanceInputs(cycleId: number): MaintenanceRecomputeInputs | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_MINERWARS_SIMULATION_INPUTS);
    if (!raw) return null;
    const store = JSON.parse(raw) as Record<string, { data?: unknown }>;
    const entry = store[String(cycleId)];
    if (!entry) return null;
    return deserializeMaintenanceInputs(entry.data);
  } catch {
    return null;
  }
}

export function deletePersistedMaintenanceInputs(cycleId: number): void {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_MINERWARS_SIMULATION_INPUTS);
    if (!raw) return;
    const store = JSON.parse(raw) as Record<string, unknown>;
    delete store[String(cycleId)];
    localStorage.setItem(LOCAL_STORAGE_KEY_MINERWARS_SIMULATION_INPUTS, JSON.stringify(store));
    // eslint-disable-next-line no-empty
  } catch {}
}

/** Memory first, then localStorage, so the simulation survives a page reload. */
export function getMaintenanceInputs(cycleId: number): MaintenanceRecomputeInputs | null {
  const cached = maintenanceInputsCache.get(cycleId);
  if (cached) return cached;
  const persisted = loadPersistedMaintenanceInputs(cycleId);
  if (!persisted) return null;
  maintenanceInputsCache.set(cycleId, persisted);
  return persisted;
}

export function cacheMaintenanceInputs(cycleId: number, inputs: MaintenanceRecomputeInputs): void {
  maintenanceInputsCache.set(cycleId, inputs);
  persistMaintenanceInputs(cycleId, inputs);
}

export function clearMaintenanceInputsCache(cycleId?: number): void {
  if (typeof cycleId === "number") {
    maintenanceInputsCache.delete(cycleId);
    return;
  }
  maintenanceInputsCache.clear();
}
