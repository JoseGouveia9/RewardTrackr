import i18n from "@/i18n";
import type { CacheState, ExtraFiatCurrency, RewardConfig } from "@/types/rewards";
import { getSessionPriceCache, persistPriceCache } from "../../api/historical-price";
import { enrichRecords } from "../transformers";
import { commitSheet, cacheExtras, prepareSheetRecords } from "./cache-update";
import { tSheetName } from "./sheet-names";

export type PendingWalletTransactionPricing = {
  config: RewardConfig;
  records: unknown[];
  totalCount: number | null;
  useIncremental: boolean;
};

interface EnrichPendingWalletTransactionPricingParameters {
  updatedCache: CacheState;
  pendingWalletTransactionPricing: PendingWalletTransactionPricing[];
  priceCache: ReturnType<typeof getSessionPriceCache>;
  includeWalletFiat: boolean;
  excelFiatCurrency: ExtraFiatCurrency;
  onMessage: (message: string) => void;
  onCacheUpdate: (cache: CacheState) => void;
}

/**
 * Slow pass pricing wallet transactions from exchange candles; runs after the MinerWars prefetch so cycle data lands first.
 */
export async function enrichPendingWalletTransactionPricing({
  updatedCache,
  pendingWalletTransactionPricing,
  priceCache,
  includeWalletFiat,
  excelFiatCurrency,
  onMessage,
  onCacheUpdate,
}: EnrichPendingWalletTransactionPricingParameters): Promise<CacheState> {
  if (pendingWalletTransactionPricing.length > 0) {
    onMessage(i18n.t("export.enrichingSheet", { name: "Pricing", current: 1, total: 1 }));
  }

  for (let index = 0; index < pendingWalletTransactionPricing.length; index++) {
    const { config, records, totalCount, useIncremental } = pendingWalletTransactionPricing[index];
    const key = config.key;

    onMessage(
      i18n.t("export.enrichingSheet", {
        name: tSheetName(key, config.sheetName),
        current: index + 1,
        total: pendingWalletTransactionPricing.length,
      }),
    );

    const enriched = await enrichRecords(
      config,
      records,
      priceCache,
      includeWalletFiat,
      excelFiatCurrency,
      onMessage,
    );

    const { recordsForCache, totalCountForCache } = prepareSheetRecords(
      key,
      enriched,
      totalCount,
      updatedCache[key],
      useIncremental,
    );
    const extras = {
      ...cacheExtras(key, includeWalletFiat, excelFiatCurrency),
      newEntriesCount: 0,
    };
    updatedCache = commitSheet(
      updatedCache,
      config,
      recordsForCache,
      totalCountForCache,
      extras,
      onCacheUpdate,
    );
  }

  persistPriceCache(priceCache);

  return updatedCache;
}
