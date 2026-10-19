export type CycleStatus = "in-progress" | "pending" | "completed";

export interface CycleInfo {
  cycleId: number;
  cycleStart: string;
  cycleEnd: string;
  status: CycleStatus;
}

export interface MinerWarsComparison {
  cycleId: number;
  cycleStart: string;
  cycleEnd: string;
  today: string;

  minerWarsSats: number;
  clanMinerWarsSats: number | null;
  btcFundBtc: number | null;
  soloEquivSats: number;
  diffSats: number;
  diffPct: number | null;

  targetSoloSats: number;
  progressPct: number | null;
  targetActualDays: number;
  targetProjectedDays: number;
  latestSatsPerTH: number | null;

  windowLabel: string;
  soloDays: string[];
  hasClanAnalytics: boolean;
  btcFundIsZero: boolean;
  actualMinerWarsBtc: number | null;
  clanTargetSoloSats: number | null;
  clanTargetActualDays: number;
  clanTargetProjectedDays: number;
  btcPerBlockSats: number | null;
  cycleLength: number;
  maintenanceBtc: number | null;
  maintenanceGmt: number | null;
  maintenanceUsd: number | null;
  rewardGmt: number | null;
  netBtc: number | null;
  netGmt: number | null;
  netUsd: number | null;
  minerWarsGmt: number | null;
  minerWarsUsd: number | null;
  soloEquivGmt: number | null;
  targetSoloGmt: number | null;
  btcPrice: number | null;
  gmtPrice: number | null;

  soloMaintenanceBtc: number | null;
  soloMaintenanceGmt: number | null;
  soloMaintenanceUsd: number | null;
  soloNetBtc: number | null;
  soloNetGmt: number | null;
  soloNetUsd: number | null;

  leagueDiscountPct: number | null;
  personalDiscountPct: number | null;
  rewardDistributionDiscountPct: number | null;
  personalGmtRewards: number | null;
  personalBlocksMined: number | null;
  personalBoostCostGmt: number | null;
  zeroedRounds: {
    userEE: Array<{ blockNumber: number; multiplier: number }>;
    leagueEE: Array<{ blockNumber: number; multiplier: number }>;
  } | null;
  zeroedRoundsHint: {
    leagueEE:
      | {
          kind: "increaseGmtDiscount";
          recommendedGmtPct: number;
        }
      | { kind: "btcPriceTooLow" }
      | null;
    userEE:
      | {
          kind: "increaseGmtDiscount";
          recommendedGmtPct: number;
        }
      | {
          kind: "improveEE";
          recommendedEE: number;
          recommendedEEAtMaxGmt: number;
          currentEE: number;
        }
      | {
          kind: "btcPriceTooLow";
          currentGmtPct: number;
        }
      | null;
  } | null;
}

export function getCycleStartTuesdayUTC(dateString: string): string {
  const date = new Date(dateString);
  const dayOfWeek = date.getUTCDay();
  const daysSinceTuesday = (dayOfWeek - 2 + 7) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceTuesday);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

export function cycleEndFromStart(cycleStart: string): string {
  const date = new Date(cycleStart + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + 6);
  return date.toISOString().slice(0, 10);
}

export function toDateString(iso: string): string {
  return iso.slice(0, 10);
}
