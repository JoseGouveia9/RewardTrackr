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
  // Settled payout for completed cycles.
  actualMinerWarsBtc: number | null;
  clanTargetSoloSats: number | null;
  btcPerBlockSats: number | null;
  cycleLength: number;
  maintenanceBtc: number | null;
  maintenanceGmt: number | null;
  // For live cycles this is formula-native USD; for completed cycles it is settled payout USD.
  maintenanceUsd: number | null;
  rewardGmt: number | null;
  netBtc: number | null;
  netGmt: number | null;
  netUsd: number | null;
  // Historical GMT equivalent for live/pending display.
  minerWarsGmt: number | null;
  // Settled USD total for completed cycles.
  minerWarsUsd: number | null;
  soloEquivGmt: number | null;
  targetSoloGmt: number | null;
  btcPrice: number | null;
  gmtPrice: number | null;
  // Weighted league discount used after the solo threshold is crossed.
  leagueDiscountPct: number | null;
  // User-level maintenance discount.
  personalDiscountPct: number | null;
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

export function getCycleStartTuesdayUTC(dateStr: string): string {
  const d = new Date(dateStr);
  const dayOfWeek = d.getUTCDay();
  const daysSinceTuesday = (dayOfWeek - 2 + 7) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceTuesday);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export function cycleEndFromStart(cycleStart: string): string {
  const d = new Date(cycleStart + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

export function toDateStr(iso: string): string {
  return iso.slice(0, 10);
}
