import { CURRENCY_TO_COINGECKO, WALLET_TO_CURRENCY } from "../config/currencies";
import { TX_FROM_TYPE_LABEL } from "../config/wallet-types";
import type {
  CoinGeckoPriceCacheValue,
  EnrichedRecord,
  ExistingPriceRawRecord,
  ExtraFiatCurrency,
  MinerWarsRawRecord,
  MiningEnrichedRecord,
  PurchaseEnrichedRecord,
  PurchaseRawRecord,
  RewardConfig,
  RewardRecord,
  SimpleEarnEnrichedRecord,
  SimpleEarnRawRecord,
  SoloMiningRawRecord,
  StandardEnrichedRecord,
  UpgradeRawRecord,
  WalletTxEnrichedRecord,
  WalletTxRawRecord,
} from "../types";
import { fetchCoinGeckoPrice } from "../api/coingecko";
import { prefetchExchangeRates, prefetchAdditionalRates, getRate } from "../api/fx-rates";

// ── Private transform helpers ─────────────────────────────────────

/** Converts a USD amount to GMT using the current GMT price; returns 0 if price is zero. */
function usdToGmt(usd: number, gmtPrice: number): number {
  return gmtPrice > 0 ? usd / gmtPrice : 0;
}

/** Maps a wallet type string to its display currency code (e.g. "BTC_WALLET" → "BTC"). */
function currencyFromWalletType(walletType: string | undefined): string {
  return WALLET_TO_CURRENCY[walletType ?? ""] || walletType || "UNKNOWN";
}

/** Transforms a raw Solo Mining API record into a fully enriched MiningEnrichedRecord. */
function transformSoloMining(raw: SoloMiningRawRecord, fiatRate: number): MiningEnrichedRecord {
  const btcPrice = raw.incomeStatistic?.btcCourseInUsd ?? 0;
  const gmtPrice = raw.incomeStatistic?.gmtPrice ?? 0;

  let maintenanceInBtcSum = 0;
  let hasMaintenanceInBtc = false;
  let maintenanceGMTDirect = 0;
  let hasGmtMaintenance = false;
  let reinvested = false;
  let totalPower = 0;
  let discountSum = 0;
  let discountCount = 0;

  if (Array.isArray(raw.incomeList)) {
    for (const inc of raw.incomeList) {
      const maintenanceBtcVal = inc?.metaData?.maintenanceInBtc ?? null;
      if (maintenanceBtcVal != null) {
        maintenanceInBtcSum += maintenanceBtcVal;
        hasMaintenanceInBtc = true;
      }
      const gmtAmt = inc?.maintenanceForWithdrawInGmt ?? null;
      if (gmtAmt != null) {
        maintenanceGMTDirect += gmtAmt;
        hasGmtMaintenance = true;
      }
      if (inc?.reinvestmentInPowerNftStatusExecuted === true) reinvested = true;
      totalPower += inc?.power ?? 0;
      if (inc?.totalDiscount != null) {
        discountSum += inc.totalDiscount;
        discountCount++;
      }
    }
  }

  const discount = discountCount > 0 ? discountSum / discountCount : 0;
  const rawValue = raw.value ?? 0;

  // Maintenance in BTC: use precise metaData.maintenanceInBtc sum when available,
  // otherwise derive from GMT amount charged
  const maintenanceBtc = hasMaintenanceInBtc
    ? maintenanceInBtcSum
    : hasGmtMaintenance && gmtPrice > 0 && btcPrice > 0
      ? (maintenanceGMTDirect * gmtPrice) / btcPrice
      : 0;

  // Pool reward (gross BTC):
  //   maintenanceByGmt=true  → raw.value is already gross (maintenance paid separately in GMT)
  //   maintenanceByGmt=false → raw.value is net; add maintenance back to get gross
  // hasGmtMaintenance is our proxy for maintenanceByGmt=true
  const poolReward = hasGmtMaintenance ? rawValue : rawValue + maintenanceBtc;

  // True economic reward: gross minus maintenance
  const reward = poolReward - maintenanceBtc;

  // MaintenanceGMT: use direct sum when available, else derive from BTC
  const maintenanceGMT = hasGmtMaintenance
    ? maintenanceGMTDirect
    : btcPrice > 0 && gmtPrice > 0
      ? (maintenanceBtc * btcPrice) / gmtPrice
      : 0;

  const maintenanceUSD = maintenanceBtc * btcPrice;

  const poolRewardUSD = poolReward * btcPrice;
  const rewardInUSD = reward * btcPrice;

  return {
    createdAt: raw.createdAt,
    currency: "BTC",
    reinvestmentStatus: raw.reinvestmentStatus || null,
    poolReward,
    poolRewardGMT: usdToGmt(poolRewardUSD, gmtPrice),
    poolRewardUSD,
    poolRewardFiat: poolRewardUSD * fiatRate,
    maintenance: maintenanceBtc,
    maintenanceGMT,
    maintenanceUSD,
    maintenanceFiat: maintenanceUSD * fiatRate,
    reward,
    rewardGMT: usdToGmt(rewardInUSD, gmtPrice),
    rewardInUSD,
    rewardInFiat: rewardInUSD * fiatRate,
    reinvested,
    totalPower,
    discount,
  };
}

/** Transforms a raw Miner Wars API record into a fully enriched MiningEnrichedRecord. */
function transformMinerWars(raw: MinerWarsRawRecord, fiatRate: number): MiningEnrichedRecord {
  const btcPrice = raw.incomeStatistic?.btcCourseInUsd ?? 0;
  const gmtPrice = raw.incomeStatistic?.gmtPrice ?? 0;
  const maintenanceByGmt = raw.maintenanceByGmt ?? false;

  // Use InBtc variants when available — same precision as c1Value/c2Value for now but future-proof
  const c1Btc = raw.c1ValueInBtc ?? raw.c1Value ?? 0;
  const c2Btc = raw.c2ValueInBtc ?? raw.c2Value ?? 0;
  const maintenanceBtc = c1Btc + c2Btc;

  // Pool reward (gross BTC):
  //   maintenanceByGmt=true  → totalReward is gross (maintenance paid separately in GMT)
  //   maintenanceByGmt=false → totalReward is net; add maintenance back to get gross
  const netReward = raw.totalReward ?? 0;
  const poolReward = maintenanceByGmt ? netReward : netReward + maintenanceBtc;
  const reward = poolReward - maintenanceBtc;

  // MaintenanceGMT: use InGmt fields when maintenance was paid in GMT, else derive from BTC
  const c1Gmt = raw.c1ValueInGmt ?? 0;
  const c2Gmt = raw.c2ValueInGmt ?? 0;
  const maintenanceGMT =
    maintenanceByGmt && c1Gmt + c2Gmt > 0
      ? c1Gmt + c2Gmt
      : usdToGmt(maintenanceBtc * btcPrice, gmtPrice);

  const poolRewardUSD = poolReward * btcPrice;
  const maintenanceUSD = maintenanceBtc * btcPrice;
  const rewardUSD = reward * btcPrice;

  return {
    createdAt: raw.createdAt,
    currency: "BTC",
    reinvestmentStatus: raw.reinvestmentStatus || null,
    poolReward,
    poolRewardGMT: usdToGmt(poolRewardUSD, gmtPrice),
    poolRewardUSD,
    poolRewardFiat: poolRewardUSD * fiatRate,
    maintenance: maintenanceBtc,
    maintenanceGMT,
    maintenanceUSD,
    maintenanceFiat: maintenanceUSD * fiatRate,
    reward,
    rewardGMT: usdToGmt(rewardUSD, gmtPrice),
    rewardInUSD: rewardUSD,
    rewardInFiat: rewardUSD * fiatRate,
    reinvested: raw.reinvestmentInPowerNftStatusExecuted === true,
    totalPower: raw.power ?? 0,
    discount: raw.totalDiscount ?? 0,
  };
}

/** Transforms a raw wallet-tx record, fetching its historical USD price from CoinGecko. */
async function transformWalletTxCoingecko(
  raw: WalletTxRawRecord,
  fiatRate: number,
  priceCache: Map<string, CoinGeckoPriceCacheValue>,
  includeFiat: boolean,
  onWait?: (msg: string) => void,
): Promise<WalletTxEnrichedRecord> {
  const currency = currencyFromWalletType(raw.walletType);
  const reward = parseFloat(raw.valueNumeric || "0") / 1e18;
  const fromType = raw.fromType;
  const txType = fromType ? (TX_FROM_TYPE_LABEL[fromType] ?? fromType) : undefined;

  if (!includeFiat) {
    return {
      createdAt: raw.createdAt,
      currency,
      reward,
      priceAtTime: 0,
      priceTimestamp: null,
      rewardInUSD: 0,
      rewardInFiat: 0,
      fromType,
      txType,
    };
  }

  let priceAtTime: number | null = null;
  let priceTimestamp: string | null = null;

  if (currency === "USDT" || currency === "USDC") {
    priceAtTime = 1;
    priceTimestamp = raw.createdAt;
  } else {
    const cgId = CURRENCY_TO_COINGECKO[currency];
    if (cgId) {
      const result = await fetchCoinGeckoPrice(cgId, raw.createdAt, priceCache, onWait);
      if (result) {
        priceAtTime = result.price;
        priceTimestamp = result.priceTimestamp || null;
      }
    }
  }

  const rewardInUSD = priceAtTime != null ? reward * priceAtTime : 0;
  return {
    createdAt: raw.createdAt,
    currency,
    reward,
    priceAtTime: priceAtTime ?? 0,
    priceTimestamp,
    rewardInUSD,
    rewardInFiat: rewardInUSD * fiatRate,
    fromType,
    txType,
  };
}

/** Transforms a raw record that already carries a USD price into a StandardEnrichedRecord. */
function transformExistingPrice(
  raw: ExistingPriceRawRecord,
  fiatRate: number,
): StandardEnrichedRecord {
  const reward = raw.reward ?? 0;
  const rewardInUSD = raw.rewardInUsd ?? raw.rewardInUSD ?? 0;
  return {
    createdAt: raw.createdAt,
    currency: raw.currency || "UNKNOWN",
    reward,
    priceAtTime: reward > 0 ? rewardInUSD / reward : 0,
    rewardInUSD,
    rewardInFiat: rewardInUSD * fiatRate,
  };
}

/** Transforms a raw purchase record into a PurchaseEnrichedRecord with USD and fiat values. */
function transformPurchase(
  raw: PurchaseRawRecord,
  valueUsd: number,
  fiatRate: number,
): PurchaseEnrichedRecord {
  const nativeAmount = raw.value ?? 0;
  return {
    createdAt: raw.createdAt,
    type: "Purchase",
    currency: raw.currency || "EUR",
    reward: parseFloat(nativeAmount.toFixed(8)),
    valueUsd: parseFloat(valueUsd.toFixed(2)),
    valueFiat: parseFloat((valueUsd * fiatRate).toFixed(2)),
  };
}

/** Expands a Simple Earn daily record into per-asset enriched rows with fiat values. */
function transformSimpleEarn(
  raw: SimpleEarnRawRecord,
  fiatRate: number,
): SimpleEarnEnrichedRecord[] {
  return (raw.assets ?? []).map((a) => {
    const reward = Number(a.reward) / 1e18;
    const rewardInUSD = Number(a.rewardInUsd) / 1e18;
    const apr = (a.apr ?? 0) * (a.vipLevelMultiplier ?? 1);
    return {
      createdAt: raw.createdAt,
      asset: a.asset ?? "BTC",
      apr,
      currency: raw.asset ?? "BTC",
      reward,
      priceAtTime: reward > 0 ? rewardInUSD / reward : 0,
      rewardInUSD,
      rewardInFiat: rewardInUSD * fiatRate,
    };
  });
}

/** Transforms a raw upgrade record into a PurchaseEnrichedRecord with USD and fiat values. */
function transformUpgrade(raw: UpgradeRawRecord, fiatRate: number): PurchaseEnrichedRecord {
  const valueUsd = raw.usdtValue ?? 0;
  const kind = raw.upgradeType || raw.dataType || "";
  return {
    createdAt: raw.createdAt,
    type: kind === "nftEnergyEfficiencyUpgrade" ? "Upgrade - Energy Efficiency" : "Upgrade - Power",
    currency: raw.providerCurrency || "GMT",
    reward: raw.providerCurrencyValue ?? 0,
    valueUsd: parseFloat(valueUsd.toFixed(2)),
    valueFiat: parseFloat((valueUsd * fiatRate).toFixed(2)),
  };
}

// ── Public API ───────────────────────────────────────────────────

/** Recomputes only the fiat fields on already-enriched cached records using a new currency.
 *  Reads USD values already stored on each record — no GoMining API call needed. */
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

/** Enriches raw API records with fiat pricing. All fiat values use historical rates for `extraFiatCurrency`. */
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

  // For purchases, also prefetch FX rates for any fiat purchase currencies that differ from extraFiatCurrency.
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
        // Postgres timestamps ("2026-03-24 08:00:36.530083+00") must be normalised to ISO 8601
        // before getRate, which splits on "T" to extract the date portion.
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
          record = transformSoloMining(raw as unknown as SoloMiningRawRecord, fiatRate);
          break;
        case "minerwars":
          record = transformMinerWars(raw as unknown as MinerWarsRawRecord, fiatRate);
          break;
        case "wallet-tx-coingecko": {
          const currency = currencyFromWalletType(raw?.walletType as string | undefined);
          onProgress?.(
            `Fetching ${currency} price for ${String(raw?.createdAt || "").slice(0, 10)} (${i + 1} of ${rawRecords.length})...`,
          );
          record = await transformWalletTxCoingecko(
            raw as unknown as WalletTxRawRecord,
            fiatRate,
            priceCache,
            includeWalletFiat,
            onProgress,
          );
          break;
        }
        case "existing-price":
          record = transformExistingPrice(raw as unknown as ExistingPriceRawRecord, fiatRate);
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
              );
              purchaseValueUsd = result ? purchaseAmount * result.price : 0;
            } else {
              // Fiat currency: rate was prefetched above if it differs from extraFiatCurrency
              const purchaseFiatRate = await getRate(purchaseRaw.createdAt, purchaseCurrency);
              purchaseValueUsd = purchaseFiatRate > 0 ? purchaseAmount / purchaseFiatRate : 0;
            }
          }
          record = transformPurchase(purchaseRaw, purchaseValueUsd, fiatRate);
          break;
        }
        case "upgrade":
          record = transformUpgrade(raw as unknown as UpgradeRawRecord, fiatRate);
          break;
        default:
          record = raw;
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
