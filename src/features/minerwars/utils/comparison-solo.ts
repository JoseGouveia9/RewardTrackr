import { historicalGmtPerBtc } from "../stores/comparison-maintenance-store";
import { ELECTRICITY_USD_PER_KWH, SERVICE_USD_PER_TERAHASH } from "./comparison-maintenance";
import type { HistoricalPriceEntry } from "../stores/cache";

export function lastPowerOf(powerByDate: Map<string, number>): number | null {
  return powerByDate.size > 0 ? ([...powerByDate.values()].slice(-1)[0] ?? null) : null;
}

export function powerOnDate(
  powerByDate: Map<string, number>,
  lastPower: number | null,
  dateString: string,
): number {
  return powerByDate.has(dateString) ? powerByDate.get(dateString)! : (lastPower ?? 0);
}

type PriceContext = {
  historicalPrices: Map<string, HistoricalPriceEntry>;
  maintenanceBtcPrice: number;
  maintenanceGmtPrice: number;
};

type SoloSideInput = PriceContext & {
  dates: string[];
  soloDays: Set<string>;
  userPowerByDate: Map<string, number>;
  lastUserPower: number | null;
  satsPerTerahashByDate: Map<string, number>;
  latestSatsPerTerahash: number | null;
  userEnergyEfficiency: number;
  soloMaintenanceDiscountFactor: number;
};

/** Flat-rate solo maintenance: the user's own EE and discount, no per-round league blending. */
export function computeSoloSide(input: SoloSideInput) {
  const {
    dates,
    soloDays,
    userPowerByDate,
    lastUserPower,
    satsPerTerahashByDate,
    latestSatsPerTerahash,
    historicalPrices,
    maintenanceBtcPrice,
    maintenanceGmtPrice,
    userEnergyEfficiency,
    soloMaintenanceDiscountFactor,
  } = input;

  let soloEquivSats = 0;
  let soloEquivalentGmtHistorical = 0;
  let hasSoloEquivGmt = false;
  let soloMaintenanceUsdAccumulated = 0;
  for (const dateString of dates) {
    if (soloDays.has(dateString)) continue;
    const userPower = powerOnDate(userPowerByDate, lastUserPower, dateString);
    const satsPerTerahash = satsPerTerahashByDate.get(dateString) ?? latestSatsPerTerahash;
    if (satsPerTerahash != null && userPower) {
      const daySats = satsPerTerahash * userPower;
      soloEquivSats += daySats;
      const rate = historicalGmtPerBtc(
        dateString,
        historicalPrices,
        maintenanceBtcPrice,
        maintenanceGmtPrice,
      );
      if (rate != null) {
        soloEquivalentGmtHistorical += (daySats / 1e8) * rate;
        hasSoloEquivGmt = true;
      }
      const electricityUsd =
        (ELECTRICITY_USD_PER_KWH * 24 * userEnergyEfficiency * userPower) / 1000;
      const serviceUsd = SERVICE_USD_PER_TERAHASH * userPower;
      soloMaintenanceUsdAccumulated +=
        (electricityUsd + serviceUsd) * soloMaintenanceDiscountFactor;
    }
  }

  const soloMaintenanceUsd = maintenanceBtcPrice > 0 ? soloMaintenanceUsdAccumulated : null;
  const soloMaintenanceBtc =
    maintenanceBtcPrice > 0 ? soloMaintenanceUsdAccumulated / maintenanceBtcPrice : null;
  const soloMaintenanceGmt =
    maintenanceGmtPrice > 0 ? soloMaintenanceUsdAccumulated / maintenanceGmtPrice : null;
  return {
    soloEquivSats,
    soloEquivGmt: hasSoloEquivGmt ? soloEquivalentGmtHistorical : null,
    soloMaintenanceBtc,
    soloMaintenanceGmt,
    soloMaintenanceUsd,
    soloNetBtc: soloMaintenanceBtc != null ? soloEquivSats / 1e8 - soloMaintenanceBtc : null,
    soloNetGmt:
      hasSoloEquivGmt && soloMaintenanceGmt != null
        ? soloEquivalentGmtHistorical - soloMaintenanceGmt
        : null,
    soloNetUsd:
      soloMaintenanceUsd != null
        ? (soloEquivSats / 1e8) * maintenanceBtcPrice - soloMaintenanceUsd
        : null,
  };
}

type TargetsInput = PriceContext & {
  cycleDates: string[];
  fullCycleDates: string[];
  elapsedComparisonDates: string[];
  isCycleLive: boolean;
  today: string;
  soloDays: Set<string>;
  satsPerTerahashByDate: Map<string, number>;
  latestSatsPerTerahash: number | null;
  userPowerByDate: Map<string, number>;
  lastUserPower: number | null;
  clanTerahashByDate: Map<string, number>;
  clanPowerByDate: Map<string, number>;
  lastClanPower: number;
  clanTenureStartDate: string;
};

/**
 * Whole-cycle solo-mining targets for the user and, from the day they joined it, the current clan.
 */
export function computeTargets(input: TargetsInput) {
  const {
    cycleDates,
    fullCycleDates,
    elapsedComparisonDates,
    isCycleLive,
    today,
    soloDays,
    satsPerTerahashByDate,
    latestSatsPerTerahash,
    userPowerByDate,
    lastUserPower,
    clanTerahashByDate,
    clanPowerByDate,
    lastClanPower,
    clanTenureStartDate,
    historicalPrices,
    maintenanceBtcPrice,
    maintenanceGmtPrice,
  } = input;

  let targetSoloSats = 0;
  let targetActualDays = 0;
  let targetProjectedDays = 0;
  let clanTargetSoloSats = 0;
  let clanTargetActualDays = 0;
  let clanTargetProjectedDays = 0;
  let targetSoloGmtHistorical = 0;
  let hasTargetSoloGmt = false;
  /**
   * Clan tenure drops its first day while live for the same reason as the whole-cycle day-1 exclusion.
   */
  const clanTenureDatesSoFar = cycleDates.filter((date) => date >= clanTenureStartDate);
  const clanElapsedDates = isCycleLive ? clanTenureDatesSoFar.slice(1) : clanTenureDatesSoFar;

  for (const dateString of fullCycleDates) {
    const isPast = elapsedComparisonDates.includes(dateString);
    const dateOccurred = dateString <= today;
    const satsPerTerahash = dateOccurred
      ? (satsPerTerahashByDate.get(dateString) ?? latestSatsPerTerahash)
      : latestSatsPerTerahash;

    if (!soloDays.has(dateString)) {
      const userPower = dateOccurred
        ? powerOnDate(userPowerByDate, lastUserPower, dateString)
        : (lastUserPower ?? 0);
      if (satsPerTerahash != null && userPower) {
        const daySats = satsPerTerahash * userPower;
        targetSoloSats += daySats;
        if (isPast) targetActualDays++;
        else targetProjectedDays++;
        const rate = historicalGmtPerBtc(
          dateString,
          historicalPrices,
          maintenanceBtcPrice,
          maintenanceGmtPrice,
        );
        if (rate != null) {
          targetSoloGmtHistorical += (daySats / 1e8) * rate;
          hasTargetSoloGmt = true;
        }
      }
    }

    if (dateString < clanTenureStartDate) continue;

    const clanPower = dateOccurred
      ? clanTerahashByDate.has(dateString)
        ? clanTerahashByDate.get(dateString)!
        : clanPowerByDate.has(dateString)
          ? clanPowerByDate.get(dateString)!
          : lastClanPower
      : lastClanPower;
    if (satsPerTerahash != null && clanPower) clanTargetSoloSats += satsPerTerahash * clanPower;
    if (clanElapsedDates.includes(dateString)) clanTargetActualDays++;
    else clanTargetProjectedDays++;
  }

  return {
    targetSoloSats,
    targetActualDays,
    targetProjectedDays,
    targetSoloGmt: hasTargetSoloGmt ? targetSoloGmtHistorical : null,
    clanTargetSoloSats: lastClanPower > 0 ? clanTargetSoloSats : null,
    clanTargetActualDays,
    clanTargetProjectedDays,
  };
}
