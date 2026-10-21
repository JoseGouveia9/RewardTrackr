import { CURRENCY_TO_COINGECKO, WALLET_TO_CURRENCY } from "@/config/currencies";
import { TRANSACTION_FROM_TYPE_LABEL } from "@/config/wallet-types";
import type {
  CoinGeckoPriceCacheValue,
  ExistingPriceRawRecord,
  MinerWarsRawRecord,
  MiningEnrichedRecord,
  PurchaseEnrichedRecord,
  PurchaseRawRecord,
  SimpleEarnEnrichedRecord,
  SimpleEarnRawRecord,
  SoloMiningRawRecord,
  StandardEnrichedRecord,
  UpgradeRawRecord,
  WalletTransactionEnrichedRecord,
  WalletTransactionRawRecord,
} from "@/types/rewards";
import { fetchCoinGeckoPrice } from "../../api/coingecko";
import { fetchSoloMiningNftDetails } from "./fetch-nft-details";

function usdToGmt(usd: number, gmtPrice: number): number {
  return gmtPrice > 0 ? usd / gmtPrice : 0;
}

export function currencyFromWalletType(walletType: string | undefined): string {
  return WALLET_TO_CURRENCY[walletType ?? ""] || walletType || "UNKNOWN";
}

/**
 * Solo mining: poolRewardInBtc is the gross reward computed server-side; c1/c2InBtc and
 * c1/c2MaintenanceInGmt are the real BTC/GMT maintenance actually deducted. energyEfficiency/
 * satsPerTh come from a separate per-NFT /details call (the /list record no longer has them).
 */
export async function transformSoloMining(
  raw: SoloMiningRawRecord,
  fiatRate: number,
  accessToken?: string,
): Promise<MiningEnrichedRecord> {
  const btcPrice = raw.incomeStatistic?.btcCourseInUsd ?? 0;
  const gmtPrice = raw.incomeStatistic?.gmtPrice ?? 0;

  const rawMaintenanceBtc = (raw.c1InBtc ?? 0) + (raw.c2InBtc ?? 0);
  const rawMaintenanceGmt = (raw.c1MaintenanceInGmt ?? 0) + (raw.c2MaintenanceInGmt ?? 0);

  const canConvertMaintenance = gmtPrice > 0 && btcPrice > 0;
  const maintenanceGMT =
    rawMaintenanceGmt + (canConvertMaintenance ? (rawMaintenanceBtc * btcPrice) / gmtPrice : 0);
  const maintenanceBtc =
    rawMaintenanceBtc + (canConvertMaintenance ? (rawMaintenanceGmt * gmtPrice) / btcPrice : 0);
  const maintenanceUSD = rawMaintenanceBtc * btcPrice + rawMaintenanceGmt * gmtPrice;

  const poolReward = raw.poolRewardInBtc ?? 0;
  const reward = poolReward - maintenanceBtc;

  const poolRewardUSD = poolReward * btcPrice;
  const rewardInUSD = reward * btcPrice;

  let satsPerTh: number | undefined;
  let energyEfficiency: number | undefined;
  if (accessToken && typeof raw.nftIncomeStatisticId === "number") {
    try {
      const details = await fetchSoloMiningNftDetails(raw.nftIncomeStatisticId, accessToken);
      const satsPerThValues: number[] = [];
      const efficiencyValues: number[] = [];
      for (const item of details) {
        if (item.poolRewardInBtc != null && item.power != null && item.power > 0) {
          satsPerThValues.push((item.poolRewardInBtc * 1e8) / item.power);
        }
        const ee = item.nft?.energyEfficiency;
        if (ee != null && ee > 0) efficiencyValues.push(ee);
      }
      if (satsPerThValues.length > 0) {
        satsPerTh =
          satsPerThValues.reduce((total, value) => total + value, 0) / satsPerThValues.length;
      }
      if (efficiencyValues.length > 0) {
        energyEfficiency =
          efficiencyValues.reduce((total, value) => total + value, 0) / efficiencyValues.length;
      }
    } catch {
      // best-effort
    }
  }

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
    reinvested: raw.reinvestmentInPowerNftStatusExecuted === true,
    totalPower: raw.totalPower ?? 0,
    discount: raw.totalDiscount ?? 0,
    energyEfficiency,
    satsPerTh,
    btcPriceAtTime: btcPrice > 0 ? btcPrice : undefined,
    btcPriceGmt: btcPrice > 0 && gmtPrice > 0 ? btcPrice / gmtPrice : undefined,
  };
}

/**
 * MinerWars: poolRewardInBtc is the gross reward computed server-side; c1/c2InBtc and
 * c1/c2MaintenanceInGmt are the real BTC/GMT maintenance actually deducted. There's no
 * MinerWars equivalent of nft-income/details, so energyEfficiency/satsPerTh stay undefined.
 */
export function transformMinerWars(
  raw: MinerWarsRawRecord,
  fiatRate: number,
): MiningEnrichedRecord {
  const btcPrice = raw.incomeStatistic?.btcCourseInUsd ?? 0;
  const gmtPrice = raw.incomeStatistic?.gmtPrice ?? 0;

  const rawMaintenanceBtc = (raw.c1InBtc ?? 0) + (raw.c2InBtc ?? 0);
  const rawMaintenanceGmt = (raw.c1MaintenanceInGmt ?? 0) + (raw.c2MaintenanceInGmt ?? 0);

  const canConvertMaintenance = gmtPrice > 0 && btcPrice > 0;
  const maintenanceGMT =
    rawMaintenanceGmt + (canConvertMaintenance ? (rawMaintenanceBtc * btcPrice) / gmtPrice : 0);
  const maintenanceBtc =
    rawMaintenanceBtc + (canConvertMaintenance ? (rawMaintenanceGmt * gmtPrice) / btcPrice : 0);
  const maintenanceUSD = rawMaintenanceBtc * btcPrice + rawMaintenanceGmt * gmtPrice;

  const poolReward = raw.poolRewardInBtc ?? 0;
  const reward = poolReward - maintenanceBtc;

  const poolRewardUSD = poolReward * btcPrice;
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
    totalPower: raw.avgPower ?? 0,
    discount: raw.totalDiscount ?? 0,
    energyEfficiency: undefined,
    btcPriceAtTime: btcPrice > 0 ? btcPrice : undefined,
    btcPriceGmt: btcPrice > 0 && gmtPrice > 0 ? btcPrice / gmtPrice : undefined,
  };
}

/**
 * Converts a raw wallet transaction (wei, 1e18) to a priced record; stablecoins are fixed at 1 USD.
 * With includeFiat false no price is fetched and all USD/fiat values are 0.
 */
export async function transformWalletTransactionCoingecko(
  raw: WalletTransactionRawRecord,
  fiatRate: number,
  priceCache: Map<string, CoinGeckoPriceCacheValue>,
  includeFiat: boolean,
  onWait?: (message: string) => void,
  entryProgress?: string,
): Promise<WalletTransactionEnrichedRecord> {
  const currency = currencyFromWalletType(raw.walletType);
  const reward = parseFloat(raw.valueNumeric || "0") / 1e18;
  const fromType = raw.fromType;
  const transactionType = fromType
    ? (TRANSACTION_FROM_TYPE_LABEL[fromType] ?? fromType)
    : undefined;

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
      txType: transactionType,
    };
  }

  let priceAtTime: number | null = null;
  let priceTimestamp: string | null = null;

  if (currency === "USDT" || currency === "USDC") {
    priceAtTime = 1;
    priceTimestamp = raw.createdAt;
  } else {
    const coinGeckoId = CURRENCY_TO_COINGECKO[currency];
    if (coinGeckoId) {
      const result = await fetchCoinGeckoPrice(
        coinGeckoId,
        raw.createdAt,
        priceCache,
        onWait,
        entryProgress,
      );
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
    txType: transactionType,
  };
}

export function transformExistingPrice(
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

export function transformPurchase(
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

/**
 * Flattens one Simple Earn payout into a row per asset (amounts in wei, 1e18).
 * APR includes the VIP multiplier, and non-BTC rewards are converted into the payout asset.
 */
export function transformSimpleEarn(
  raw: SimpleEarnRawRecord,
  fiatRate: number,
): SimpleEarnEnrichedRecord[] {
  return (raw.assets ?? []).map((asset) => {
    const reward = Number(asset.reward) / 1e18;
    const rewardInUSD = Number(asset.rewardInUsd) / 1e18;
    const apr = (asset.apr ?? 0) * (asset.vipLevelMultiplier ?? 1);
    return {
      createdAt: raw.createdAt,
      asset: asset.asset ?? "BTC",
      apr,
      currency: raw.asset ?? "BTC",
      reward:
        asset.asset != "BTC" ? (reward * Number(asset.price)) / Number(raw.assetToUsd) : reward,
      priceAtTime: reward > 0 ? rewardInUSD / reward : 0,
      rewardInUSD,
      rewardInFiat: rewardInUSD * fiatRate,
    };
  });
}

export function transformUpgrade(raw: UpgradeRawRecord, fiatRate: number): PurchaseEnrichedRecord {
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
