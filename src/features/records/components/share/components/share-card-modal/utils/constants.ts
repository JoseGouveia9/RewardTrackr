export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const SHEET_LABELS: Partial<Record<string, string>> = {
  "solo-mining": "Solo Mining",
  minerwars: "MinerWars",
  bounty: "Bounties",
  referrals: "Referrals",
  ambassador: "Ambassador",
  deposits: "Deposits",
  withdrawals: "Withdrawals",
  purchases: "Purchases & Upgrades",
  "simple-earn": "Simple Earn",
  transactions: "Transactions",
};

export const CARD_WIDTH = 900;
export const PADDING = 36;
export const GAP = 12;
export const CARD_BASE_HEIGHT = 52;
export const REWARD_ROW_HEIGHT = 22;
export const MINING_ROW_HEIGHT = 30;
export const HEADER_HEIGHT = 80;
export const DIVIDER_HEIGHT = 1;
export const GRID_TOP = 18;
export const GRID_BOTTOM = 18;
export const FOOTER_HEIGHT = 40;
export const PADDING_BOTTOM = 22;
export const LOGO_SIZE = 36;

export const MINING_GROUP_KEYS = new Set(["solo-mining", "minerwars"]);
