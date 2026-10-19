import type { Currency } from "@/types/currency";

export interface ClanCycleFigures {
  targetBtc: number;
  minerWarsBtc: number;
  btcPerBlockSats: number | null;
  actualDays: number;
  projectedDays: number;
}

export interface ClanDisplayOptions {
  currency: Currency;
  fiatCode: string | null;
  extraFiatRate: number | null;
  btcPrice: number | null;
  gmtPrice: number | null;
}
