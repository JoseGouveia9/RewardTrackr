import i18n from "@/i18n";
import { CURRENCY_TO_COINGECKO } from "@/config/currencies";
import type {
  CoinGeckoPriceCacheValue,
  EnrichedRecord,
  ExtraFiatCurrency,
  PurchaseRawRecord,
  RewardConfig,
  RewardRecord,
  SimpleEarnRawRecord,
  WalletTransactionEnrichedRecord,
} from "@/types/rewards";
import { fetchHistoricalPrice } from "../../api/historical-price";
import { getRate, prefetchAdditionalRates, prefetchExchangeRates } from "@/lib/fx-rates";
import {
  currencyFromWalletType,
  transformExistingPrice,
  transformMinerWars,
  transformPurchase,
  transformSimpleEarn,
  transformSoloMining,
  transformUpgrade,
  transformWalletTransactionCoingecko,
} from "./mappers";

/**
 * Recomputes only the fiat columns from the stored USD values, e.g. after the fiat currency
 * changes.
 */
export async function reenrichFiatValues(
  config: RewardConfig,
  records: RewardRecord[],
  extraFiatCurrency: string,
): Promise<RewardRecord[]> {
  await prefetchExchangeRates(
    records.map((record) => record?.createdAt),
    extraFiatCurrency,
  );

  return Promise.all(
    records.map(async (record) => {
      try {
        const fiatRate = await getRate(record.createdAt as string, extraFiatCurrency);
        switch (config.enrichType) {
          case "solo-mining":
          case "minerwars":
            return {
              ...record,
              poolRewardFiat: ((record.poolRewardUSD as number) ?? 0) * fiatRate,
              maintenanceFiat: ((record.maintenanceUSD as number) ?? 0) * fiatRate,
              rewardInFiat: ((record.rewardInUSD as number) ?? 0) * fiatRate,
            };
          case "purchase":
          case "upgrade":
            return { ...record, valueFiat: ((record.valueUsd as number) ?? 0) * fiatRate };
          default:
            return { ...record, rewardInFiat: ((record.rewardInUSD as number) ?? 0) * fiatRate };
        }
      } catch {
        return record;
      }
    }),
  );
}

/**
 * Turns raw API records into enriched rows with USD/fiat values, picking the mapper from config.enrichType.
 * Wallet transactions and non-USD purchases are priced from exchange candles; malformed records are skipped with a warning.
 */
export async function enrichRecords(
  config: RewardConfig,
  rawRecords: unknown[],
  priceCache: Map<string, CoinGeckoPriceCacheValue>,
  includeWalletFiat: boolean,
  extraFiatCurrency: ExtraFiatCurrency,
  onProgress?: (message: string) => void,
  accessToken?: string,
): Promise<EnrichedRecord[]> {
  const includeFiat = config.enrichType !== "wallet-tx-coingecko" || includeWalletFiat;

  if (includeFiat) {
    await prefetchExchangeRates(
      (rawRecords as Array<{ createdAt?: string }>).map((rawRecord) => rawRecord?.createdAt),
      extraFiatCurrency,
    );
  }

  if (config.enrichType === "purchase") {
    const fiatPurchaseCurrencies = [
      ...new Set(
        (rawRecords as Array<{ currency?: string }>)
          .map((rawRecord) => rawRecord?.currency)
          .filter(
            (currencyCode): currencyCode is string =>
              !!currencyCode &&
              currencyCode !== extraFiatCurrency &&
              !CURRENCY_TO_COINGECKO[currencyCode],
          ),
      ),
    ];
    for (const fiatPurchaseCurrency of fiatPurchaseCurrencies) {
      await prefetchAdditionalRates(
        (rawRecords as Array<{ createdAt?: string }>).map((rawRecord) => rawRecord?.createdAt),
        fiatPurchaseCurrency,
      );
    }
  }

  const enriched: EnrichedRecord[] = [];

  for (let index = 0; index < rawRecords.length; index++) {
    const raw = rawRecords[index] as Record<string, unknown>;

    try {
      if (config.enrichType === "simple-earn") {
        const normalizedCreatedAt = String(raw?.createdAt ?? "")
          .replace(" ", "T")
          .replace(/(\.\d{3})\d+/, "$1")
          .replace(/\+00$/, "Z");
        const fiatRate = includeFiat ? await getRate(normalizedCreatedAt, extraFiatCurrency) : 0;
        enriched.push(
          ...transformSimpleEarn(
            { ...raw, createdAt: normalizedCreatedAt } as unknown as SimpleEarnRawRecord,
            fiatRate,
          ),
        );
        continue;
      }

      const fiatRate = includeFiat ? await getRate(raw?.createdAt as string, extraFiatCurrency) : 0;

      let record: EnrichedRecord;
      switch (config.enrichType) {
        case "solo-mining":
          onProgress?.(
            i18n.t("export.fetchingDetails", { done: index + 1, total: rawRecords.length }),
          );
          record = await transformSoloMining(raw as never, fiatRate, accessToken);
          break;
        case "minerwars":
          record = transformMinerWars(raw as never, fiatRate);
          break;
        case "wallet-tx-coingecko": {
          const currency = currencyFromWalletType(raw?.walletType as string | undefined);
          onProgress?.(
            `Fetching ${currency} price for ${String(raw?.createdAt || "").slice(0, 10)} (${index + 1} of ${rawRecords.length})...`,
          );
          record = (await transformWalletTransactionCoingecko(
            raw as never,
            fiatRate,
            priceCache,
            includeWalletFiat,
          )) as WalletTransactionEnrichedRecord;
          break;
        }
        case "existing-price":
          record = transformExistingPrice(raw as never, fiatRate);
          break;
        case "purchase": {
          const purchaseRaw = raw as unknown as PurchaseRawRecord;
          const purchaseCurrency = purchaseRaw.currency || "EUR";
          const purchaseAmount = purchaseRaw.value ?? 0;
          let purchaseValueUsd: number;
          if (
            purchaseCurrency === "USD" ||
            purchaseCurrency === "USDT" ||
            purchaseCurrency === "USDC"
          ) {
            purchaseValueUsd = purchaseAmount;
          } else {
            const coinGeckoId = CURRENCY_TO_COINGECKO[purchaseCurrency];
            if (coinGeckoId) {
              const result = await fetchHistoricalPrice(
                coinGeckoId,
                purchaseRaw.createdAt,
                priceCache,
              );
              purchaseValueUsd = result ? purchaseAmount * result.price : 0;
            } else {
              const purchaseFiatRate = await getRate(purchaseRaw.createdAt, purchaseCurrency);
              purchaseValueUsd = purchaseFiatRate > 0 ? purchaseAmount / purchaseFiatRate : 0;
            }
          }
          record = transformPurchase(purchaseRaw, purchaseValueUsd, fiatRate);
          break;
        }
        case "upgrade":
          record = transformUpgrade(raw as never, fiatRate);
          break;
        default:
          record = raw as EnrichedRecord;
      }

      enriched.push(record);
    } catch (error) {
      onProgress?.(
        `Warning: Skipped malformed record at index ${index + 1}, ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return enriched;
}
