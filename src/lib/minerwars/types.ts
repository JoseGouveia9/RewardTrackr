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
  /** Rounds zeroed because maintenance exceeded reward, split by which EE tier was active. null when maintenance not computed or no rounds were zeroed. */
  zeroedRounds: {
    /** Zeroed rounds that used user EE (before solo threshold was crossed). */
    userEE: Array<{ blockNumber: number; multiplier: number }>;
    /** Zeroed rounds that used league EE (after solo threshold was crossed). */
    leagueEE: Array<{ blockNumber: number; multiplier: number }>;
  } | null;
  /** Hints explaining why rounds were zeroed, split by which EE tier was active. null when no zeroed rounds or maintenance not computed. */
  zeroedRoundsHint: {
    /** Hint for rounds that used league EE (after solo threshold was crossed). null if no league-EE rounds were zeroed. */
    leagueEE:
      | {
          kind: "increaseGmtDiscount";
          /** Minimum GMT pay discount % needed to prevent zeroing these league-EE rounds. */
          recommendedGmtPct: number;
        }
      | { kind: "btcPriceTooLow" }
      | null;
    /** Hint for rounds that used the user's personal EE (before solo threshold). null if no user-EE rounds were zeroed. */
    userEE:
      | {
          kind: "increaseGmtDiscount";
          /** Minimum GMT pay discount % needed to prevent zeroing these user-EE rounds. */
          recommendedGmtPct: number;
        }
      | {
          kind: "improveEE";
          /** Maximum W/TH the user should have to prevent zeroing at current GMT % (floored, ≥ 15). */
          recommendedEE: number;
          /** Maximum W/TH needed if GMT discount were maxed at 20% (floored, ≥ 15). */
          recommendedEEAtMaxGmt: number;
          /** User's actual EE at time of computation. */
          currentEE: number;
        }
      | {
          kind: "btcPriceTooLow";
          /** User's actual GMT pay discount % at time of computation. */
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
