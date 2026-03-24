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
import { prefetchExchangeRates, getRate } from "../api/fx-rates";

function usdToGmt(usd: number, gmtPrice: number): number {
  return gmtPrice > 0 ? usd / gmtPrice : 0;
}

function currencyFromWalletType(walletType: string | undefined): string {
  return WALLET_TO_CURRENCY[walletType ?? ""] || walletType || "UNKNOWN";
}

function transformSoloMining(raw: SoloMiningRawRecord, fiatRate: number): MiningEnrichedRecord {
  const btcPrice = raw.incomeStatistic?.btcCourseInUsd ?? 0;
  const gmtPrice = raw.incomeStatistic?.gmtPrice ?? 0;

  let poolReward = 0;
  let maintenance = 0;
  let reinvested = false;

  if (Array.isArray(raw.incomeList)) {
    for (const inc of raw.incomeList) {
      poolReward += inc?.metaData?.poolReward ?? 0;
      maintenance += (inc?.c1Value ?? 0) + (inc?.c2Value ?? 0);
      if (inc?.reinvestmentInPowerNftStatusExecuted === true) reinvested = true;
    }
  }

  if (poolReward === 0 && Number.isFinite(raw.value ?? 0)) {
    poolReward = (raw.value ?? 0) + maintenance;
  }

  const reward = poolReward - maintenance;
  const poolRewardUSD = poolReward * btcPrice;
  const maintenanceUSD = maintenance * btcPrice;
  const rewardInUSD = reward * btcPrice;

  return {
    createdAt: raw.createdAt,
    currency: "BTC",
    reinvestmentStatus: raw.reinvestmentStatus || null,
    poolReward,
    poolRewardGMT: usdToGmt(poolRewardUSD, gmtPrice),
    poolRewardUSD,
    poolRewardFiat: poolRewardUSD * fiatRate,
    maintenance,
    maintenanceGMT: usdToGmt(maintenanceUSD, gmtPrice),
    maintenanceUSD,
    maintenanceFiat: maintenanceUSD * fiatRate,
    reward,
    rewardGMT: usdToGmt(rewardInUSD, gmtPrice),
    rewardInUSD,
    rewardInFiat: rewardInUSD * fiatRate,
    reinvested,
  };
}

function transformMinerWars(raw: MinerWarsRawRecord, fiatRate: number): MiningEnrichedRecord {
  const btcPrice = raw.incomeStatistic?.btcCourseInUsd ?? 0;
  const gmtPrice = raw.incomeStatistic?.gmtPrice ?? 0;
  const maintenance = (raw.c1Value ?? 0) + (raw.c2Value ?? 0);
  const poolReward = (raw.totalReward ?? 0) + maintenance;
  const reward = poolReward - maintenance;
  const poolRewardUSD = poolReward * btcPrice;
  const maintenanceUSD = maintenance * btcPrice;
  const rewardUSD = reward * btcPrice;

  return {
    createdAt: raw.createdAt,
    currency: "BTC",
    reinvestmentStatus: raw.reinvestmentStatus || null,
    poolReward,
    poolRewardGMT: usdToGmt(poolRewardUSD, gmtPrice),
    poolRewardUSD,
    poolRewardFiat: poolRewardUSD * fiatRate,
    maintenance,
    maintenanceGMT: usdToGmt(maintenanceUSD, gmtPrice),
    maintenanceUSD,
    maintenanceFiat: maintenanceUSD * fiatRate,
    reward,
    rewardGMT: usdToGmt(rewardUSD, gmtPrice),
    rewardInUSD: rewardUSD,
    rewardInFiat: rewardUSD * fiatRate,
    reinvested: raw.reinvestmentInPowerNftStatusExecuted === true,
  };
}

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

function transformPurchase(raw: PurchaseRawRecord, fiatRate: number): PurchaseEnrichedRecord {
  const valueFiatRaw = raw.value ?? 0;
  const valueUsd = fiatRate > 0 ? valueFiatRaw / fiatRate : 0;
  return {
    createdAt: raw.createdAt,
    type: "Purchase",
    currency: raw.currency || "EUR",
    valueUsd: parseFloat(valueUsd.toFixed(2)),
    valueFiat: parseFloat(valueFiatRaw.toFixed(2)),
  };
}

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
      currency: a.asset ?? "BTC",
      reward,
      priceAtTime: reward > 0 ? rewardInUSD / reward : 0,
      rewardInUSD,
      rewardInFiat: rewardInUSD * fiatRate,
    };
  });
}

function transformUpgrade(raw: UpgradeRawRecord, fiatRate: number): PurchaseEnrichedRecord {
  const valueUsd = raw.usdtValue ?? 0;
  const kind = raw.upgradeType || raw.dataType || "";
  return {
    createdAt: raw.createdAt,
    type: kind === "nftEnergyEfficiencyUpgrade" ? "Upgrade - Energy Efficiency" : "Upgrade - Power",
    currency: "USD",
    valueUsd: parseFloat(valueUsd.toFixed(2)),
    valueFiat: parseFloat((valueUsd * fiatRate).toFixed(2)),
  };
}

// Recomputes only the fiat fields on already-enriched cached records using a new currency.
// Reads USD values already stored on each record — no GoMining API call needed.
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

// Enriches raw API records with fiat pricing. All fiat values use historical rates for `extraFiatCurrency`.
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
        case "purchase":
          record = transformPurchase(raw as unknown as PurchaseRawRecord, fiatRate);
          break;
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
