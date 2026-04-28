import type { TabDef, DateRange } from "../types";
import { toIsoOffset, zeroPad } from "./index";

export const ALL_TABS: TabDef[] = [
  { key: "solo-mining", label: "tabs.soloMining", kind: "mining" },
  { key: "minerwars", label: "tabs.minerWars", kind: "mining" },
  { key: "bounty", label: "tabs.bounties", kind: "simple" },
  { key: "referrals", label: "tabs.referrals", kind: "simple" },
  { key: "ambassador", label: "tabs.ambassador", kind: "simple" },
  { key: "deposits", label: "tabs.deposits", kind: "simple" },
  { key: "withdrawals", label: "tabs.withdrawals", kind: "simple" },
  { key: "purchases", label: "tabs.purchasesUpgrades", kind: "purchase" },
  { key: "simple-earn", label: "tabs.simpleEarn", kind: "earn" },
  { key: "transactions", label: "tabs.transactions", kind: "tx" },
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
  { label: "dataViewer.today", from: () => toIsoOffset(0), to: () => toIsoOffset(0) },
  { label: "dataViewer.last7Days", from: () => toIsoOffset(-6), to: () => toIsoOffset(0) },
  { label: "dataViewer.last30Days", from: () => toIsoOffset(-29), to: () => toIsoOffset(0) },
  {
    label: "dataViewer.thisMonth",
    from: () => {
      const d = new Date();
      return `${d.getFullYear()}-${zeroPad(d.getMonth() + 1)}-01`;
    },
    to: () => toIsoOffset(0),
  },
  {
    label: "dataViewer.thisYear",
    from: () => `${new Date().getFullYear()}-01-01`,
    to: () => toIsoOffset(0),
  },
  {
    label: "dataViewer.lastYear",
    from: () => `${new Date().getFullYear() - 1}-01-01`,
    to: () => `${new Date().getFullYear() - 1}-12-31`,
  },
];
