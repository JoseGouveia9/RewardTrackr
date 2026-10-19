export type Period = "7d" | "month" | "year" | "all";

export interface DateRange {
  from: string;
  to: string;
}

export interface CurrencyReward {
  currency: string;
  total: number;
  totalUSD: number;
  totalFiat: number;
}

export interface MiningBreakdown {
  poolReward: number;
  maintenance: number;
  reward: number;
  poolRewardInUSD: number;
  poolRewardInFiat: number;
}

export interface SheetEntry {
  key: string;
  label: string;
  rewards: CurrencyReward[];
  mining?: MiningBreakdown;
}

export interface CardColors {
  ORANGE: string;
  CARD_BACKGROUND: string;
  WHITE: string;
  MUTED: string;
  DIM: string;
}

export interface MiningStats {
  miners: number;
  totalTerahash: number;
  averageEnergyEfficiency: number | null;
}
