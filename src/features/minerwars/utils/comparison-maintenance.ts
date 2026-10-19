import { addUtcDays } from "./date-range";
import { toDateString } from "../types";
import type { MinerWarsComparison } from "../types";
import {
  historicalGmtPerBtc,
  type MaintenanceRecomputeInputs,
} from "../stores/comparison-maintenance-store";

export const ELECTRICITY_USD_PER_KWH = 0.05;
export const SERVICE_USD_PER_TERAHASH = 0.0089;
const GMT_DISCOUNT_MAX = 0.2;
const ENERGY_EFFICIENCY_MIN = 12;

export type MaintenanceAndNet = {
  minerWarsSats: number;
  diffSats: number;
  differencePercent: number | null;
  maintenanceBtc: number | null;
  maintenanceGmt: number | null;
  maintenanceUsd: number | null;
  rewardGmt: number | null;
  netBtc: number | null;
  netGmt: number | null;
  netUsd: number | null;
  minerWarsGmt: number | null;
  zeroedRounds: MinerWarsComparison["zeroedRounds"];
  zeroedRoundsHint: MinerWarsComparison["zeroedRoundsHint"];
};

/**
 * Walks rounds oldest-first charging maintenance at the user's EE/discount until rewards reach the
 * solo equivalent, then at league rates (the crossing round blends both; per-round context wins).
 * A round costing more than it paid is zeroed out of rewards and feeds the zeroedRounds hints.
 */
export function computeMaintenanceAndNet(
  inputs: MaintenanceRecomputeInputs,
  leagueDiscountPercent: number | null,
): MaintenanceAndNet {
  const {
    userRounds,
    completedRoundsMap,
    userPowerByDate,
    clanPowerByDate,
    clanTerahashByDate,
    currentClanPower,
    clanNftPower,
    lastUserPower,
    roundRewards,
    solodays,
    sumAllMultipliers,
    soloEquivSats,
    elapsedMinerWarsDays,
    userEnergyEfficiency,
    leagueEnergyEfficiency,
    maintenanceBtcPrice,
    maintenanceGmtPrice,
    historicalPrices,
    maintenanceDiscountFactor,
    maintenanceGmtDiscount,
    actualMinerWarsBtc,
    minerWarsSatsBase,
    roundContextById,
    today,
  } = inputs;

  const leagueDiscountFactor =
    leagueDiscountPercent != null ? 1 - leagueDiscountPercent : maintenanceDiscountFactor;

  let minerWarsSats = minerWarsSatsBase;
  let differenceSats = minerWarsSats - soloEquivSats;
  let differencePercent = soloEquivSats > 0 ? (differenceSats / soloEquivSats) * 100 : null;

  let maintenanceBtc: number | null = null;
  let maintenanceGmt: number | null = null;
  let maintenanceUsd: number | null = null;
  let rewardGmt: number | null = null;
  let netBtc: number | null = null;
  let netGmt: number | null = null;
  let netUsd: number | null = null;
  let minerWarsGmt: number | null = null;

  const zeroedRounds = {
    userEE: [] as Array<{ blockNumber: number; multiplier: number }>,
    leagueEE: [] as Array<{ blockNumber: number; multiplier: number }>,
  };
  const zeroedRoundIds = new Set<number>();
  const nonGmtDiscount = 1 - maintenanceDiscountFactor - maintenanceGmtDiscount;
  const discountFactorAtMaxGmt = 1 - (nonGmtDiscount + GMT_DISCOUNT_MAX);
  let worstMinTotalDiscountUserEnergyEfficiency = 0;
  let worstMinTotalDiscountLeagueEnergyEfficiency = 0;
  let worstMaxUserEnergyEfficiency = Infinity;
  let worstMaxUserEnergyEfficiencyAtMaxGmt = Infinity;

  if (maintenanceBtcPrice > 0) {
    let totalMaintenanceSats = 0;
    let totalMaintenanceUsd = 0;
    let totalMaintenanceGmt = 0;
    let hasMaintenanceGmtPrice = false;
    let cumulativeMinerWarsSats = 0;
    const sortedForMaintenance = [...userRounds].sort(
      (left, right) => left.roundId - right.roundId,
    );
    for (const round of sortedForMaintenance) {
      const roundDate = toDateString(round.endedAt);
      if (solodays.has(roundDate)) continue;
      const entry = completedRoundsMap.get(round.roundId);
      const roundPower = entry?.power ?? 0;
      const userTerahash = userPowerByDate.has(roundDate)
        ? userPowerByDate.get(roundDate)!
        : (lastUserPower ?? 0);
      const isToday = roundDate >= today;
      const roundContext = roundContextById?.get(round.roundId);
      const clanTerahash =
        roundContext?.clanTerahash ??
        (clanTerahashByDate.has(roundDate)
          ? clanTerahashByDate.get(roundDate)!
          : clanPowerByDate.has(roundDate)
            ? clanPowerByDate.get(roundDate)!
            : isToday
              ? (currentClanPower ?? clanNftPower ?? 1)
              : (clanNftPower ?? 1));
      const roundLeagueEnergyEfficiency =
        roundContext?.leagueEnergyEfficiency ?? leagueEnergyEfficiency;
      const roundLeagueDiscountFactor = roundContext?.leagueDiscountFactor ?? leagueDiscountFactor;
      const roundSumAllMultipliers = roundContext?.sumAllMultipliers ?? sumAllMultipliers;
      const isLeagueEnergyEfficiency = cumulativeMinerWarsSats >= soloEquivSats;
      const roundUserSats = (roundRewards.get(round.roundId)?.userBtc ?? 0) * 1e8;
      const crossesThreshold =
        !isLeagueEnergyEfficiency &&
        soloEquivSats > 0 &&
        roundUserSats > 0 &&
        cumulativeMinerWarsSats + roundUserSats > soloEquivSats;
      const ownFraction = crossesThreshold
        ? (soloEquivSats - cumulativeMinerWarsSats) / roundUserSats
        : isLeagueEnergyEfficiency
          ? 0
          : 1;
      const leagueFraction = 1 - ownFraction;
      const electricityUsdFull =
        (ELECTRICITY_USD_PER_KWH * 24 * elapsedMinerWarsDays * roundPower) / 1000;
      const roundElectricityUsd =
        electricityUsdFull *
        (userEnergyEfficiency * ownFraction + roundLeagueEnergyEfficiency * leagueFraction);
      const roundServiceUsd = SERVICE_USD_PER_TERAHASH * elapsedMinerWarsDays * roundPower;
      const share =
        clanTerahash > 0 && roundSumAllMultipliers > 0
          ? (round.multiplier / roundSumAllMultipliers) * (userTerahash / clanTerahash)
          : 0;
      const effectiveDiscountFactor =
        maintenanceDiscountFactor * ownFraction + roundLeagueDiscountFactor * leagueFraction;
      const roundMaintenanceUSD =
        (roundElectricityUsd + roundServiceUsd) * share * effectiveDiscountFactor;
      const historicalPrice = historicalPrices.get(addUtcDays(roundDate, 1));
      const roundBtcPrice = historicalPrice?.btcUsd ?? maintenanceBtcPrice;
      const roundGmtPrice = historicalPrice?.gmtUsd ?? maintenanceGmtPrice;
      const roundMaintenanceSats = (roundMaintenanceUSD / roundBtcPrice) * 1e8;
      if (roundMaintenanceSats > roundUserSats) {
        zeroedRounds[isLeagueEnergyEfficiency ? "leagueEE" : "userEE"].push({
          blockNumber: round.blockNumber,
          multiplier: round.multiplier,
        });
        zeroedRoundIds.add(round.roundId);
        const rawMaintenanceSats =
          effectiveDiscountFactor > 0 ? roundMaintenanceSats / effectiveDiscountFactor : Infinity;
        const minDiscountFactor = rawMaintenanceSats > 0 ? roundUserSats / rawMaintenanceSats : 0;
        const minTotalDiscount = 1 - minDiscountFactor;
        if (isLeagueEnergyEfficiency) {
          if (minTotalDiscount > worstMinTotalDiscountLeagueEnergyEfficiency) {
            worstMinTotalDiscountLeagueEnergyEfficiency = minTotalDiscount;
          }
        } else {
          if (minTotalDiscount > worstMinTotalDiscountUserEnergyEfficiency)
            worstMinTotalDiscountUserEnergyEfficiency = minTotalDiscount;
          const electricityCoeff =
            (ELECTRICITY_USD_PER_KWH *
              24 *
              elapsedMinerWarsDays *
              roundPower *
              share *
              maintenanceDiscountFactor *
              1e8) /
            (maintenanceBtcPrice * 1000);
          const serviceSats =
            (SERVICE_USD_PER_TERAHASH *
              elapsedMinerWarsDays *
              roundPower *
              share *
              maintenanceDiscountFactor *
              1e8) /
            maintenanceBtcPrice;
          const maxEnergyEfficiency =
            electricityCoeff > 0 ? (roundUserSats - serviceSats) / electricityCoeff : -Infinity;
          if (maxEnergyEfficiency < worstMaxUserEnergyEfficiency)
            worstMaxUserEnergyEfficiency = maxEnergyEfficiency;
          const ratio =
            maintenanceDiscountFactor > 0 ? discountFactorAtMaxGmt / maintenanceDiscountFactor : 0;
          const electricityCoeffMaxGmt = electricityCoeff * ratio;
          const serviceSatsMaxGmt = serviceSats * ratio;
          const maxEnergyEfficiencyAtMaxGmt =
            electricityCoeffMaxGmt > 0
              ? (roundUserSats - serviceSatsMaxGmt) / electricityCoeffMaxGmt
              : -Infinity;
          if (maxEnergyEfficiencyAtMaxGmt < worstMaxUserEnergyEfficiencyAtMaxGmt)
            worstMaxUserEnergyEfficiencyAtMaxGmt = maxEnergyEfficiencyAtMaxGmt;
        }
      } else {
        totalMaintenanceSats += roundMaintenanceSats;
        totalMaintenanceUsd += roundMaintenanceUSD;
        if (roundGmtPrice > 0) {
          totalMaintenanceGmt += roundMaintenanceUSD / roundGmtPrice;
          hasMaintenanceGmtPrice = true;
        }
      }
      cumulativeMinerWarsSats += roundUserSats;
    }
    maintenanceBtc = totalMaintenanceSats / 1e8;
    maintenanceGmt = hasMaintenanceGmtPrice ? totalMaintenanceGmt : null;
    maintenanceUsd = totalMaintenanceUsd;

    let minerWarsGmtHistorical = 0;
    let hasMinerWarsGmtHistorical = false;
    for (const [roundId, { userBtc, date }] of roundRewards) {
      if (solodays.has(date)) continue;
      if (zeroedRoundIds.has(roundId)) {
        minerWarsSats -= userBtc * 1e8;
        continue;
      }
      const rate = historicalGmtPerBtc(
        date,
        historicalPrices,
        maintenanceBtcPrice,
        maintenanceGmtPrice,
      );
      if (rate != null) {
        minerWarsGmtHistorical += userBtc * rate;
        hasMinerWarsGmtHistorical = true;
      }
    }
    differenceSats = minerWarsSats - soloEquivSats;
    differencePercent = soloEquivSats > 0 ? (differenceSats / soloEquivSats) * 100 : null;
    const effectiveMinerWarsBtc = actualMinerWarsBtc ?? minerWarsSats / 1e8;
    rewardGmt =
      maintenanceGmtPrice > 0
        ? (effectiveMinerWarsBtc * maintenanceBtcPrice) / maintenanceGmtPrice
        : null;
    netBtc = effectiveMinerWarsBtc - maintenanceBtc;
    netGmt = rewardGmt != null && maintenanceGmt != null ? rewardGmt - maintenanceGmt : null;
    const rewardUsd = effectiveMinerWarsBtc * maintenanceBtcPrice;
    netUsd = rewardUsd - maintenanceUsd;
    minerWarsGmt =
      actualMinerWarsBtc == null && hasMinerWarsGmtHistorical ? minerWarsGmtHistorical : null;
  }

  let zeroedRoundsHint: MinerWarsComparison["zeroedRoundsHint"] = null;
  if (
    (zeroedRounds.userEE.length > 0 || zeroedRounds.leagueEE.length > 0) &&
    maintenanceBtcPrice > 0
  ) {
    let leagueEnergyEfficiencyHint:
      | { kind: "increaseGmtDiscount"; recommendedGmtPct: number }
      | { kind: "btcPriceTooLow" }
      | null = null;
    if (worstMinTotalDiscountLeagueEnergyEfficiency > 0) {
      const recommendedGmt = worstMinTotalDiscountLeagueEnergyEfficiency - nonGmtDiscount;
      if (recommendedGmt <= GMT_DISCOUNT_MAX) {
        leagueEnergyEfficiencyHint = {
          kind: "increaseGmtDiscount",
          recommendedGmtPct: Math.ceil(Math.max(recommendedGmt, 0) * 100),
        };
      } else {
        leagueEnergyEfficiencyHint = { kind: "btcPriceTooLow" };
      }
    }

    let userEnergyEfficiencyHint:
      | { kind: "increaseGmtDiscount"; recommendedGmtPct: number }
      | {
          kind: "improveEE";
          recommendedEE: number;
          recommendedEEAtMaxGmt: number;
          currentEE: number;
        }
      | { kind: "btcPriceTooLow"; currentGmtPct: number }
      | null = null;
    if (worstMinTotalDiscountUserEnergyEfficiency > 0) {
      const recommendedGmt = worstMinTotalDiscountUserEnergyEfficiency - nonGmtDiscount;
      if (recommendedGmt <= GMT_DISCOUNT_MAX) {
        userEnergyEfficiencyHint = {
          kind: "increaseGmtDiscount",
          recommendedGmtPct: Math.ceil(Math.max(recommendedGmt, 0) * 100),
        };
      } else if (worstMaxUserEnergyEfficiency >= ENERGY_EFFICIENCY_MIN) {
        userEnergyEfficiencyHint = {
          kind: "improveEE",
          recommendedEE: Math.floor(worstMaxUserEnergyEfficiency),
          recommendedEEAtMaxGmt: Math.max(
            Math.floor(worstMaxUserEnergyEfficiencyAtMaxGmt),
            ENERGY_EFFICIENCY_MIN,
          ),
          currentEE: userEnergyEfficiency,
        };
      } else {
        userEnergyEfficiencyHint = {
          kind: "btcPriceTooLow",
          currentGmtPct: Math.round(maintenanceGmtDiscount * 100),
        };
      }
    }

    if (leagueEnergyEfficiencyHint !== null || userEnergyEfficiencyHint !== null) {
      zeroedRoundsHint = { leagueEE: leagueEnergyEfficiencyHint, userEE: userEnergyEfficiencyHint };
    }
  }

  return {
    minerWarsSats,
    diffSats: differenceSats,
    differencePercent,
    maintenanceBtc,
    maintenanceGmt,
    maintenanceUsd,
    rewardGmt,
    netBtc,
    netGmt,
    netUsd,
    minerWarsGmt,
    zeroedRounds:
      maintenanceBtcPrice > 0 &&
      elapsedMinerWarsDays > 0 &&
      (zeroedRounds.userEE.length > 0 || zeroedRounds.leagueEE.length > 0)
        ? zeroedRounds
        : null,
    zeroedRoundsHint: maintenanceBtcPrice > 0 && elapsedMinerWarsDays > 0 ? zeroedRoundsHint : null,
  };
}
