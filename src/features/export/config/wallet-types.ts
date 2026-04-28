import type { RewardKey } from "../types";

export const WALLET_TX_KEYS = new Set<RewardKey>([
  "bounty",
  "deposits",
  "withdrawals",
  "transactions",
]);

export const TX_CHECKBOX_OPTIONS: Array<{ labelKey: string; label: string; fromTypes: string[] }> =
  [
    {
      labelKey: "txFilter.veGoMiningReward",
      label: "veGoMining Reward",
      fromTypes: ["auto-claim"],
    },
    {
      labelKey: "txFilter.personalMinerWarsReward",
      label: "Personal MinerWars Reward",
      fromTypes: ["gmt-fund"],
    },
    { labelKey: "txFilter.minerSale", label: "Miner Sale", fromTypes: ["marketplace-deposit"] },
    {
      labelKey: "txFilter.liquidityReward",
      label: "Liquidity Reward",
      fromTypes: ["pool-liquidity-reward"],
    },
    {
      labelKey: "txFilter.clanOwnershipReward",
      label: "Clan Ownership Reward",
      fromTypes: ["gmt-fund-clan-owner"],
    },
    {
      labelKey: "txFilter.bonus",
      label: "Bonus",
      fromTypes: ["motivation-bonus", "registration-bonus", "promocompany-bonus"],
    },
  ];

export const ALL_TX_FROM_TYPES: string[] = TX_CHECKBOX_OPTIONS.flatMap((o) => o.fromTypes);

export const TX_FROM_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  TX_CHECKBOX_OPTIONS.flatMap(({ label, fromTypes }) => fromTypes.map((ft) => [ft, label])),
);

export const TX_LABEL_TO_KEY: Record<string, string> = Object.fromEntries(
  TX_CHECKBOX_OPTIONS.map(({ label, labelKey }) => [label, labelKey]),
);
