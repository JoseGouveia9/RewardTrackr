import i18n from "@/i18n";

const REWARD_KEY_I18N: Record<string, string> = {
  "solo-mining": "tabs.soloMining",
  minerwars: "tabs.minerWars",
  bounty: "tabs.bounties",
  referrals: "tabs.referrals",
  ambassador: "tabs.ambassador",
  deposits: "tabs.deposits",
  withdrawals: "tabs.withdrawals",
  purchases: "export.sheetPurchases",
  upgrades: "export.sheetUpgrades",
  transactions: "tabs.transactions",
  "simple-earn": "tabs.simpleEarn",
};

export function tSheetName(key: string, fallback: string): string {
  const i18nKey = REWARD_KEY_I18N[key];
  return i18nKey ? i18n.t(i18nKey, { defaultValue: fallback }) : fallback;
}
