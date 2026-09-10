import { addUtcDays } from "./date-range";
import { toDateStr } from "./types";
import type { MinerWarsComparison } from "./types";
import {
  getMaintInputs,
  historicalGmtPerBtc,
  type MaintenanceRecomputeInputs,
} from "./comparison-maintenance-store";

const KWH = 0.05;
const SVC = 0.0089;
const GMT_DISCOUNT_MAX = 0.2;
const EE_MIN = 12;

type MaintenanceAndNet = {
  minerWarsSats: number;
  diffSats: number;
  diffPct: number | null;
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

export function computeMaintenanceAndNet(
  inputs: MaintenanceRecomputeInputs,
  leagueDiscountPct: number | null,
): MaintenanceAndNet {
  const {
    userRounds,
    completedRoundsMap,
    userPowerByDate,
    clanPowerByDate,
    currentClanPower,
    clanNftPower,
    lastUserPower,
    roundRewards,
    solodays,
    sumAllMultipliers,
    soloEquivSats,
    elapsedMWDays,
    userEE,
    leagueEE,
    maintBtcPrice,
    maintGmtPrice,
    historicalPrices,
    maintDiscountFactor,
    maintGmtDiscount,
    actualMinerWarsBtc,
    minerWarsSatsBase,
    btcPerBlock,
    today,
  } = inputs;

  const leagueDiscountFactor =
    leagueDiscountPct != null ? 1 - leagueDiscountPct : maintDiscountFactor;

  let minerWarsSats = minerWarsSatsBase;
  let diffSats = minerWarsSats - soloEquivSats;
  let diffPct = soloEquivSats > 0 ? (diffSats / soloEquivSats) * 100 : null;

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
  const nonGmtDiscount = 1 - maintDiscountFactor - maintGmtDiscount;
  const discFactorAtMaxGmt = 1 - (nonGmtDiscount + GMT_DISCOUNT_MAX);
  let worstMinTotalDiscountUserEE = 0;
  let worstMinTotalDiscountLeagueEE = 0;
  let worstMaxUserEE = Infinity;
  let worstMaxUserEEAtMaxGmt = Infinity;

  if (maintBtcPrice > 0 && elapsedMWDays > 0) {
    let totalMaintSats = 0;
    let totalMaintUsd = 0;
    let totalMaintGmt = 0;
    let hasMaintGmtPrice = false;
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
      const isToday = roundDate >= today;
      const clanTH = clanPowerByDate.has(roundDate)
        ? clanPowerByDate.get(roundDate)!
        : isToday
          ? (currentClanPower ?? clanNftPower ?? 1)
          : (clanNftPower ?? 1);
      const isLeagueEE = cumulativeMWSats >= soloEquivSats;
      const ee = isLeagueEE ? leagueEE : userEE;
      const roundElecUSD = (KWH * 24 * elapsedMWDays * roundPower * ee) / 1000;
      const roundSvcUSD = SVC * elapsedMWDays * roundPower;
      const share =
        clanTH > 0 && sumAllMultipliers > 0
          ? (round.multiplier / sumAllMultipliers) * (userTH / clanTH)
          : 0;
      const effectiveDiscountFactor = isLeagueEE ? leagueDiscountFactor : maintDiscountFactor;
      const roundMaintUSD = (roundElecUSD + roundSvcUSD) * share * effectiveDiscountFactor;
      const roundUserSats =
        btcPerBlock * round.multiplier * (clanTH > 0 ? userTH / clanTH : 0) * 1e8;
      const historicalPrice = historicalPrices.get(addUtcDays(roundDate, 1));
      const roundBtcPrice = historicalPrice?.btcUsd ?? maintBtcPrice;
      const roundGmtPrice = historicalPrice?.gmtUsd ?? maintGmtPrice;
      const roundMaintSats = (roundMaintUSD / roundBtcPrice) * 1e8;
      if (roundMaintSats > roundUserSats) {
        zeroedRounds[isLeagueEE ? "leagueEE" : "userEE"].push({
          blockNumber: round.blockNumber,
          multiplier: round.multiplier,
        });
        zeroedRoundIds.add(round.roundId);
        const rawMaintSats =
          effectiveDiscountFactor > 0 ? roundMaintSats / effectiveDiscountFactor : Infinity;
        const minDiscFactor = rawMaintSats > 0 ? roundUserSats / rawMaintSats : 0;
        const minTotalDisc = 1 - minDiscFactor;
        if (isLeagueEE) {
          if (minTotalDisc > worstMinTotalDiscountLeagueEE) {
            worstMinTotalDiscountLeagueEE = minTotalDisc;
          }
        } else {
          if (minTotalDisc > worstMinTotalDiscountUserEE)
            worstMinTotalDiscountUserEE = minTotalDisc;
          const elecCoeff =
            (KWH * 24 * elapsedMWDays * roundPower * share * maintDiscountFactor * 1e8) /
            (maintBtcPrice * 1000);
          const svcSats =
            (SVC * elapsedMWDays * roundPower * share * maintDiscountFactor * 1e8) / maintBtcPrice;
          const maxEE = elecCoeff > 0 ? (roundUserSats - svcSats) / elecCoeff : -Infinity;
          if (maxEE < worstMaxUserEE) worstMaxUserEE = maxEE;
          const ratio = maintDiscountFactor > 0 ? discFactorAtMaxGmt / maintDiscountFactor : 0;
          const elecCoeffMaxGmt = elecCoeff * ratio;
          const svcSatsMaxGmt = svcSats * ratio;
          const maxEEAtMaxGmt =
            elecCoeffMaxGmt > 0 ? (roundUserSats - svcSatsMaxGmt) / elecCoeffMaxGmt : -Infinity;
          if (maxEEAtMaxGmt < worstMaxUserEEAtMaxGmt) worstMaxUserEEAtMaxGmt = maxEEAtMaxGmt;
        }
      } else {
        totalMaintSats += roundMaintSats;
        totalMaintUsd += roundMaintUSD;
        if (roundGmtPrice > 0) {
          totalMaintGmt += roundMaintUSD / roundGmtPrice;
          hasMaintGmtPrice = true;
        }
      }
      cumulativeMWSats += roundUserSats;
    }
    maintenanceBtc = totalMaintSats / 1e8;
    maintenanceGmt = hasMaintGmtPrice ? totalMaintGmt : null;
    maintenanceUsd = totalMaintUsd;

    let minerWarsGmtHist = 0;
    let hasMinerWarsGmtHist = false;
    for (const [roundId, { userBtc, date }] of roundRewards) {
      if (solodays.has(date)) continue;
      if (zeroedRoundIds.has(roundId)) {
        minerWarsSats -= userBtc * 1e8;
        continue;
      }
      const rate = historicalGmtPerBtc(date, historicalPrices, maintBtcPrice, maintGmtPrice);
      if (rate != null) {
        minerWarsGmtHist += userBtc * rate;
        hasMinerWarsGmtHist = true;
      }
    }
    diffSats = minerWarsSats - soloEquivSats;
    diffPct = soloEquivSats > 0 ? (diffSats / soloEquivSats) * 100 : null;
    const effectiveMwBtc = actualMinerWarsBtc ?? minerWarsSats / 1e8;
    rewardGmt = maintGmtPrice > 0 ? (effectiveMwBtc * maintBtcPrice) / maintGmtPrice : null;
    netBtc = effectiveMwBtc - maintenanceBtc;
    netGmt = rewardGmt != null && maintenanceGmt != null ? rewardGmt - maintenanceGmt : null;
    const rewardUsd = effectiveMwBtc * maintBtcPrice;
    netUsd = rewardUsd - maintenanceUsd;
    minerWarsGmt = actualMinerWarsBtc == null && hasMinerWarsGmtHist ? minerWarsGmtHist : null;
  }

  let zeroedRoundsHint: MinerWarsComparison["zeroedRoundsHint"] = null;
  if ((zeroedRounds.userEE.length > 0 || zeroedRounds.leagueEE.length > 0) && maintBtcPrice > 0) {
    let leagueEEHint:
      | { kind: "increaseGmtDiscount"; recommendedGmtPct: number }
      | { kind: "btcPriceTooLow" }
      | null = null;
    if (worstMinTotalDiscountLeagueEE > 0) {
      const recGmt = worstMinTotalDiscountLeagueEE - nonGmtDiscount;
      if (recGmt <= GMT_DISCOUNT_MAX) {
        leagueEEHint = {
          kind: "increaseGmtDiscount",
          recommendedGmtPct: Math.ceil(Math.max(recGmt, 0) * 100),
        };
      } else {
        leagueEEHint = { kind: "btcPriceTooLow" };
      }
    }

    let userEEHint:
      | { kind: "increaseGmtDiscount"; recommendedGmtPct: number }
      | {
          kind: "improveEE";
          recommendedEE: number;
          recommendedEEAtMaxGmt: number;
          currentEE: number;
        }
      | { kind: "btcPriceTooLow"; currentGmtPct: number }
      | null = null;
    if (worstMinTotalDiscountUserEE > 0) {
      const recGmt = worstMinTotalDiscountUserEE - nonGmtDiscount;
      if (recGmt <= GMT_DISCOUNT_MAX) {
        userEEHint = {
          kind: "increaseGmtDiscount",
          recommendedGmtPct: Math.ceil(Math.max(recGmt, 0) * 100),
        };
      } else if (worstMaxUserEE >= EE_MIN) {
        userEEHint = {
          kind: "improveEE",
          recommendedEE: Math.floor(worstMaxUserEE),
          recommendedEEAtMaxGmt: Math.max(Math.floor(worstMaxUserEEAtMaxGmt), EE_MIN),
          currentEE: userEE,
        };
      } else {
        userEEHint = {
          kind: "btcPriceTooLow",
          currentGmtPct: Math.round(maintGmtDiscount * 100),
        };
      }
    }

    if (leagueEEHint !== null || userEEHint !== null) {
      zeroedRoundsHint = { leagueEE: leagueEEHint, userEE: userEEHint };
    }
  }

  return {
    minerWarsSats,
    diffSats,
    diffPct,
    maintenanceBtc,
    maintenanceGmt,
    maintenanceUsd,
    rewardGmt,
    netBtc,
    netGmt,
    netUsd,
    minerWarsGmt,
    zeroedRounds:
      maintBtcPrice > 0 &&
      elapsedMWDays > 0 &&
      (zeroedRounds.userEE.length > 0 || zeroedRounds.leagueEE.length > 0)
        ? zeroedRounds
        : null,
    zeroedRoundsHint: maintBtcPrice > 0 && elapsedMWDays > 0 ? zeroedRoundsHint : null,
  };
}

export type SimulationInputs = {
  th?: number;
  userEE?: number;
  leagueEE?: number;
  personalDiscountPct?: number;
  leagueDiscountPct?: number;
};

export type SimulationDefaults = {
  th: number | null;
  userEE: number;
  leagueEE: number;
  personalDiscountPct: number;
};

export function getSimulationDefaults(cycleId: number): SimulationDefaults | null {
  const inputs = getMaintInputs(cycleId);
  if (!inputs) return null;
  return {
    th: inputs.lastUserPower,
    userEE: inputs.userEE,
    leagueEE: inputs.leagueEE,
    personalDiscountPct: 1 - inputs.maintDiscountFactor,
  };
}

export function simulateMaintenanceAndNet(
  cycleId: number,
  overrides: SimulationInputs,
): (MaintenanceAndNet & { soloEquivSats: number }) | null {
  const inputs = getMaintInputs(cycleId);
  if (!inputs) return null;

  let simulatedInputs: MaintenanceRecomputeInputs = { ...inputs };
  if (overrides.th != null) {
    const baseline = inputs.lastUserPower ?? 0;
    const delta = overrides.th - baseline;
    const scale = baseline > 0 ? overrides.th / baseline : 1;
    const scaledRoundRewards = new Map<
      number,
      { userBtc: number; clanBtc: number; date: string }
    >();
    for (const [id, reward] of inputs.roundRewards) {
      scaledRoundRewards.set(id, {
        userBtc: reward.userBtc * scale,
        clanBtc: reward.clanBtc,
        date: reward.date,
      });
    }
    simulatedInputs = {
      ...simulatedInputs,
      userPowerByDate: new Map(),
      lastUserPower: overrides.th,
      clanPowerByDate: new Map(
        Array.from(inputs.clanPowerByDate.entries()).map(([date, power]) => [
          date,
          Math.max(0, power + delta),
        ]),
      ),
      clanNftPower:
        inputs.clanNftPower != null
          ? Math.max(0, inputs.clanNftPower + delta)
          : inputs.clanNftPower,
      currentClanPower:
        inputs.currentClanPower != null
          ? Math.max(0, inputs.currentClanPower + delta)
          : inputs.currentClanPower,
      roundRewards: scaledRoundRewards,
      soloEquivSats: inputs.soloEquivSats * scale,
      minerWarsSatsBase: inputs.minerWarsSatsBase * scale,
    };
  }
  if (overrides.userEE != null) simulatedInputs.userEE = overrides.userEE;
  if (overrides.leagueEE != null) simulatedInputs.leagueEE = overrides.leagueEE;
  if (overrides.personalDiscountPct != null) {
    simulatedInputs.maintDiscountFactor = 1 - overrides.personalDiscountPct;
  }

  const recomputed = computeMaintenanceAndNet(simulatedInputs, overrides.leagueDiscountPct ?? null);
  return { ...recomputed, soloEquivSats: simulatedInputs.soloEquivSats };
}
