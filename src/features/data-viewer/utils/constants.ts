import type { TabDef, DateRange } from "../types";
import { toIsoOffset, zeroPad } from "./index";

export const ALL_TABS: TabDef[] = [
  { key: "solo-mining", label: "Solo Mining", kind: "mining" },
  { key: "minerwars", label: "MinerWars", kind: "mining" },
  { key: "bounty", label: "Bounties", kind: "simple" },
  { key: "referrals", label: "Referrals", kind: "simple" },
  { key: "ambassador", label: "Ambassador", kind: "simple" },
  { key: "deposits", label: "Deposits", kind: "simple" },
  { key: "withdrawals", label: "Withdrawals", kind: "simple" },
  { key: "purchases", label: "Purchases & Upgrades", kind: "purchase" },
  { key: "simple-earn", label: "Simple Earn", kind: "earn" },
  { key: "transactions", label: "Transactions", kind: "tx" },
];

export const CURRENCY_COLORS: Record<string, string> = {
  ETH: "#627EEA",
  BNB: "#F0B90B",
  SOL: "#9945FF",
  TON: "#0098EA",
  USDT: "#26A17B",
  USDC: "#2775CA",
};

export const PAGE_SIZE = 15;

export const EMPTY_DATE_RANGE: DateRange = { from: "", to: "" };

export const DATE_PRESETS = [
  { label: "Today", from: () => toIsoOffset(0), to: () => toIsoOffset(0) },
  { label: "Last 7 days", from: () => toIsoOffset(-6), to: () => toIsoOffset(0) },
  { label: "Last 30 days", from: () => toIsoOffset(-29), to: () => toIsoOffset(0) },
  {
    label: "This month",
    from: () => {
      const d = new Date();
      return `${d.getFullYear()}-${zeroPad(d.getMonth() + 1)}-01`;
    },
    to: () => toIsoOffset(0),
  },
  { label: "This year", from: () => `${new Date().getFullYear()}-01-01`, to: () => toIsoOffset(0) },
];
