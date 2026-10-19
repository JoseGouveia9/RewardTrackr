import type { RewardKey } from "@/types/rewards";

export type { Currency } from "@/types/currency";
export type ViewKey = "NATIVE" | "USD" | "FIAT";
type TabKind = "mining" | "simple" | "earn" | "tx" | "purchase";

export interface TabDef {
  key: RewardKey;
  label: string;
  kind: TabKind;
}

export type SimpleView = ViewKey;
export type EarnView = ViewKey;
export type TransactionView = "GMT" | "USD" | "FIAT";
export type PurchaseView = ViewKey;

export interface DateRange {
  from: string;
  to: string;
}
