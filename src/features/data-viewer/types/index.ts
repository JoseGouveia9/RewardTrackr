import type { RewardKey } from "@/features/export/types";

export type Currency = "BTC" | "GMT" | "USD" | "FIAT";
export type TabKind = "mining" | "simple" | "earn" | "tx" | "purchase";

export interface TabDef {
  key: RewardKey;
  label: string;
  kind: TabKind;
}

export type SimpleView = "NATIVE" | "USD" | "FIAT";
export type EarnView = "NATIVE" | "USD" | "FIAT";
export type TxView = "GMT" | "USD" | "FIAT";
export type PurchaseView = "NATIVE" | "USD" | "FIAT";

export interface DateRange {
  from: string;
  to: string;
}
