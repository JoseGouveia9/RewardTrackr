import { CURRENCY_TO_COINGECKO } from "../config/currencies";
import type {
  CoinGeckoPriceCacheValue,
  EnrichedRecord,
  ExtraFiatCurrency,
  PurchaseRawRecord,
  RewardConfig,
  RewardRecord,
  SimpleEarnRawRecord,
  WalletTxEnrichedRecord,
} from "../types";
import { fetchCoinGeckoPrice } from "../api/coingecko";
import { getRate, prefetchAdditionalRates, prefetchExchangeRates } from "../api/fx-rates";
import {
  currencyFromWalletType,
  transformExistingPrice,
  transformMinerWars,
  transformPurchase,
  transformSimpleEarn,
  transformSoloMining,
  transformUpgrade,
  transformWalletTxCoingecko,
} from "./transformers/mappers";

export async function reenrichFiatValues(
  config: RewardConfig,
  records: RewardRecord[],
  extraFiatCurrency: string,
): Promise<RewardRecord[]> {
  await prefetchExchangeRates(
    records.map((r) => r?.createdAt),
    extraFiatCurrency,
  );

  return Promise.all(
    records.map(async (r) => {
      try {
        const fiatRate = await getRate(r.createdAt as string, extraFiatCurrency);
        switch (config.enrichType) {
          case "solo-mining":
          case "minerwars":
            return {
              ...r,
              poolRewardFiat: ((r.poolRewardUSD as number) ?? 0) * fiatRate,
              maintenanceFiat: ((r.maintenanceUSD as number) ?? 0) * fiatRate,
              rewardInFiat: ((r.rewardInUSD as number) ?? 0) * fiatRate,
            };
          case "purchase":
          case "upgrade":
            return { ...r, valueFiat: ((r.valueUsd as number) ?? 0) * fiatRate };
          default:
            return { ...r, rewardInFiat: ((r.rewardInUSD as number) ?? 0) * fiatRate };
        }
      } catch {
        return r;
      }
    }),
  );
}

export async function enrichRecords(
  config: RewardConfig,
  rawRecords: unknown[],
  priceCache: Map<string, CoinGeckoPriceCacheValue>,
  includeWalletFiat: boolean,
  extraFiatCurrency: ExtraFiatCurrency,
  onProgress?: (msg: string) => void,
): Promise<EnrichedRecord[]> {
  const includeFiat = config.enrichType !== "wallet-tx-coingecko" || includeWalletFiat;

  if (includeFiat) {
    await prefetchExchangeRates(
      (rawRecords as Array<{ createdAt?: string }>).map((r) => r?.createdAt),
      extraFiatCurrency,
    );
  }

  if (config.enrichType === "purchase") {
    const fiatPurchaseCurrencies = [
      ...new Set(
        (rawRecords as Array<{ currency?: string }>)
          .map((r) => r?.currency)
          .filter((c): c is string => !!c && c !== extraFiatCurrency && !CURRENCY_TO_COINGECKO[c]),
      ),
    ];
    for (const cur of fiatPurchaseCurrencies) {
      await prefetchAdditionalRates(
        (rawRecords as Array<{ createdAt?: string }>).map((r) => r?.createdAt),
        cur,
      );
    }
  }

  const enriched: EnrichedRecord[] = [];

  for (let i = 0; i < rawRecords.length; i++) {
    const raw = rawRecords[i] as Record<string, unknown>;

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
          record = transformSoloMining(raw as never, fiatRate);
          break;
        case "minerwars":
          record = transformMinerWars(raw as never, fiatRate);
          break;
        case "wallet-tx-coingecko": {
          const currency = currencyFromWalletType(raw?.walletType as string | undefined);
          onProgress?.(
            `Fetching ${currency} price for ${String(raw?.createdAt || "").slice(0, 10)} (${i + 1} of ${rawRecords.length})...`,
          );
          record = (await transformWalletTxCoingecko(
            raw as never,
            fiatRate,
            priceCache,
            includeWalletFiat,
            onProgress,
            `${i + 1} of ${rawRecords.length}`,
          )) as WalletTxEnrichedRecord;
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
            const cgId = CURRENCY_TO_COINGECKO[purchaseCurrency];
            if (cgId) {
              const result = await fetchCoinGeckoPrice(
                cgId,
                purchaseRaw.createdAt,
                priceCache,
                onProgress,
                `${i + 1} of ${rawRecords.length}`,
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
    } catch (err) {
      onProgress?.(
        `Warning: Skipped malformed record at index ${i + 1}, ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return enriched;
}
