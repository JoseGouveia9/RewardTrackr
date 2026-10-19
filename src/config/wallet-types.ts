import type { RewardKey } from "@/types/rewards";

export const WALLET_TRANSACTION_KEYS = new Set<RewardKey>([
  "bounty",
  "deposits",
  "withdrawals",
  "transactions",
]);

const TRANSACTION_CHECKBOX_OPTIONS: Array<{
  labelKey: string;
  label: string;
  fromTypes: string[];
}> = [
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

export const ALL_TRANSACTION_FROM_TYPES: string[] = TRANSACTION_CHECKBOX_OPTIONS.flatMap(
  (option) => option.fromTypes,
);

export const TRANSACTION_FROM_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  TRANSACTION_CHECKBOX_OPTIONS.flatMap(({ label, fromTypes }) =>
    fromTypes.map((fromType) => [fromType, label]),
  ),
);

export const TRANSACTION_LABEL_TO_KEY: Record<string, string> = Object.fromEntries(
  TRANSACTION_CHECKBOX_OPTIONS.map(({ label, labelKey }) => [label, labelKey]),
);
