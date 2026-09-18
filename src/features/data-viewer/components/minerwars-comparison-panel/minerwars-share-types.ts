import type { Currency } from "../../types";
import type { CycleInfo, MinerWarsComparison } from "@/lib/minerwars/comparison";
import type { ClanPerformance } from "@/lib/minerwars/clan-performance";

export type MinerWarsShareScope = "individual" | "clan" | "both";
export type MinerWarsIndividualCurrencyMode = "btc" | "gmt" | "usd" | "extra";
export type MinerWarsClanCurrencyMode = "native" | "gmt" | "usd" | "extra";

export interface MinerWarsShareSnapshot {
  currentViewMode: "individual" | "clan";
  selectedCycleId: number | null;
  cycles: CycleInfo[];
  comparison: MinerWarsComparison | null;
  clanPerformance: ClanPerformance | null;
  currency: Currency;
  extraFiatCode: string | null;
  extraFiatRate: number | null;
}
