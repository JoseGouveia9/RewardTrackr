import { toDateString } from "../types";
import {
  getMaintenanceInputs,
  type MaintenanceRecomputeInputs,
} from "../stores/comparison-maintenance-store";
import { computeMaintenanceAndNet, type MaintenanceAndNet } from "./comparison-maintenance";

export type LeagueGroupOverride = {
  leagueId: number;
  clanId: number;
  leagueEnergyEfficiency?: number;
  leagueDiscountPercent?: number;
};

export type SimulationInputs = {
  terahash?: number;
  userEnergyEfficiency?: number;
  personalDiscountPercent?: number;
  leagueGroupOverrides?: LeagueGroupOverride[];
};

type LeagueGroupDefault = {
  leagueId: number;
  clanId: number;
  leagueEnergyEfficiency: number;
  leagueDiscountPercent: number;
  isCurrent: boolean;
  clanName: string | null;
};

type SimulationDefaults = {
  terahash: number | null;
  userEnergyEfficiency: number;
  personalDiscountPercent: number;
  leagueGroups: LeagueGroupDefault[];
};

/** Groups with rounds past the solo-equivalent threshold, where league EE/discount matter. */
function groupsWithLeagueEnergyEfficiencyImpact(inputs: MaintenanceRecomputeInputs): Set<string> {
  const groups = new Set<string>();
  let cumulativeMinerWarsSats = 0;
  const sorted = [...inputs.userRounds].sort((left, right) => left.roundId - right.roundId);
  for (const round of sorted) {
    const roundDate = toDateString(round.endedAt);
    if (inputs.solodays.has(roundDate)) continue;
    const roundUserSats = (inputs.roundRewards.get(round.roundId)?.userBtc ?? 0) * 1e8;
    const isLeagueEnergyEfficiency = cumulativeMinerWarsSats >= inputs.soloEquivSats;
    const crossesThreshold =
      !isLeagueEnergyEfficiency &&
      inputs.soloEquivSats > 0 &&
      roundUserSats > 0 &&
      cumulativeMinerWarsSats + roundUserSats > inputs.soloEquivSats;
    if (isLeagueEnergyEfficiency || crossesThreshold) {
      groups.add(`${round.leagueId}:${round.clanId}`);
    }
    cumulativeMinerWarsSats += roundUserSats;
  }
  return groups;
}

/** Editable starting values from the cached inputs; null when none were cached for the cycle. */
export function getSimulationDefaults(cycleId: number): SimulationDefaults | null {
  const inputs = getMaintenanceInputs(cycleId);
  if (!inputs) return null;

  const groupsPastSoloThreshold = groupsWithLeagueEnergyEfficiencyImpact(inputs);

  const seenGroups = new Set<string>();
  const leagueGroups: LeagueGroupDefault[] = [];
  for (const round of inputs.userRounds) {
    const key = `${round.leagueId}:${round.clanId}`;
    if (seenGroups.has(key)) continue;
    seenGroups.add(key);
    if (!groupsPastSoloThreshold.has(key)) continue;
    const context = inputs.roundContextById.get(round.roundId);
    leagueGroups.push({
      leagueId: round.leagueId,
      clanId: round.clanId,
      leagueEnergyEfficiency: context?.leagueEnergyEfficiency ?? inputs.leagueEnergyEfficiency,
      leagueDiscountPercent:
        context?.leagueDiscountFactor != null
          ? 1 - context.leagueDiscountFactor
          : 1 - inputs.maintenanceDiscountFactor,
      isCurrent: round.leagueId === inputs.currentLeagueId && round.clanId === inputs.currentClanId,
      clanName: inputs.clanNamesByGroup.get(key) ?? null,
    });
  }

  return {
    terahash: inputs.lastUserPower,
    userEnergyEfficiency: inputs.userEnergyEfficiency,
    personalDiscountPercent: 1 - inputs.maintenanceDiscountFactor,
    leagueGroups,
  };
}

/**
 * Recomputes maintenance/net with overridden TH, EE or discounts. A TH override scales rewards
 * and the solo equivalent proportionally and shifts every clan TH by the same delta.
 */
export function simulateMaintenanceAndNet(
  cycleId: number,
  overrides: SimulationInputs,
): (MaintenanceAndNet & { soloEquivSats: number }) | null {
  const inputs = getMaintenanceInputs(cycleId);
  if (!inputs) return null;

  let simulatedInputs: MaintenanceRecomputeInputs = { ...inputs };
  if (overrides.terahash != null) {
    const baseline = inputs.lastUserPower ?? 0;
    const delta = overrides.terahash - baseline;
    const scale = baseline > 0 ? overrides.terahash / baseline : 1;
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
      lastUserPower: overrides.terahash,
      clanPowerByDate: new Map(
        Array.from(inputs.clanPowerByDate.entries()).map(([date, power]) => [
          date,
          Math.max(0, power + delta),
        ]),
      ),
      clanTerahashByDate: new Map(
        Array.from(inputs.clanTerahashByDate.entries()).map(([date, power]) => [
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
  if (overrides.userEnergyEfficiency != null)
    simulatedInputs.userEnergyEfficiency = overrides.userEnergyEfficiency;

  const groupOverrides = overrides.leagueGroupOverrides ?? [];
  let currentLeagueDiscountPercent: number | null = null;
  if (groupOverrides.length > 0) {
    const overrideByGroup = new Map(
      groupOverrides.map((override) => [`${override.leagueId}:${override.clanId}`, override]),
    );
    const roundGroupById = new Map(
      inputs.userRounds.map((round) => [round.roundId, `${round.leagueId}:${round.clanId}`]),
    );
    simulatedInputs.roundContextById = new Map(
      Array.from(inputs.roundContextById.entries()).map(([id, context]) => {
        const group = roundGroupById.get(id);
        const override = group ? overrideByGroup.get(group) : undefined;
        if (!override) return [id, context];
        return [
          id,
          {
            ...context,
            leagueEnergyEfficiency:
              override.leagueEnergyEfficiency ?? context.leagueEnergyEfficiency,
            leagueDiscountFactor:
              override.leagueDiscountPercent != null
                ? 1 - override.leagueDiscountPercent
                : context.leagueDiscountFactor,
          },
        ];
      }),
    );
    const currentOverride = overrideByGroup.get(
      `${inputs.currentLeagueId}:${inputs.currentClanId}`,
    );
    if (currentOverride?.leagueEnergyEfficiency != null)
      simulatedInputs.leagueEnergyEfficiency = currentOverride.leagueEnergyEfficiency;
    currentLeagueDiscountPercent = currentOverride?.leagueDiscountPercent ?? null;
  }
  if (overrides.personalDiscountPercent != null) {
    simulatedInputs.maintenanceDiscountFactor = 1 - overrides.personalDiscountPercent;
  }

  const recomputed = computeMaintenanceAndNet(simulatedInputs, currentLeagueDiscountPercent);
  return { ...recomputed, soloEquivSats: simulatedInputs.soloEquivSats };
}
