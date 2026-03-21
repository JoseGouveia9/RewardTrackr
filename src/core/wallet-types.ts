import type { RewardKey } from "./types";

export const WALLET_TX_KEYS = new Set<RewardKey>(["bounty", "deposits", "withdrawals", "transactions"]);

export const TX_CHECKBOX_OPTIONS: Array<{ label: string; fromTypes: string[] }> = [
  { label: "veGoMining Reward", fromTypes: ["auto-claim"] },
  { label: "Personal MinerWars Reward", fromTypes: ["gmt-fund"] },
  { label: "Miner Sale", fromTypes: ["marketplace-deposit"] },
  { label: "Liquidity Reward", fromTypes: ["pool-liquidity-reward"] },
  { label: "Clan Ownership Reward", fromTypes: ["gmt-fund-clan-owner"] },
  { label: "Bonus", fromTypes: ["motivation-bonus", "registration-bonus", "promocompany-bonus"] },
];

export const ALL_TX_FROM_TYPES: string[] = TX_CHECKBOX_OPTIONS.flatMap((o) => o.fromTypes);

export const TX_FROM_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  TX_CHECKBOX_OPTIONS.flatMap(({ label, fromTypes }) => fromTypes.map((ft) => [ft, label])),
);
