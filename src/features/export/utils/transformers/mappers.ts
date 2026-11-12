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
import { fetchHistoricalPrice } from "../../api/historical-price";
import { fetchSoloMiningNftDetails } from "./fetch-nft-details";

function usdToGmt(usd: number, gmtPrice: number): number {
  return gmtPrice > 0 ? usd / gmtPrice : 0;
}

export function currencyFromWalletType(walletType: string | undefined): string {
  return WALLET_TO_CURRENCY[walletType ?? ""] || walletType || "UNKNOWN";
}

/**
 * totalInBtc includes the bonus but already deducts BTC-paid maintenance. Preserve the gross
 * pool and net payout independently, including server rounding. totalInGmt preserves the
 * server's conversion. Both solo and MinerWars list endpoints use these payout fields.
 */
function transformMiningAmounts(raw: SoloMiningRawRecord | MinerWarsRawRecord, fiatRate: number) {
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

  const poolReward =
    raw.totalInBtc != null && rawMaintenanceBtc === 0
      ? raw.totalInBtc
      : (raw.poolRewardInBtc ?? 0) + (raw.goBtcPayBonus ?? 0);
  const reward =
    raw.totalInBtc != null
      ? raw.totalInBtc - (maintenanceBtc - rawMaintenanceBtc)
      : poolReward - maintenanceBtc;

  const poolRewardUSD = poolReward * btcPrice;
  const poolRewardGMT = raw.totalInGmt ?? usdToGmt(poolRewardUSD, gmtPrice);
  const rewardInUSD = reward * btcPrice;

  return {
    poolReward,
    poolRewardGMT,
    poolRewardUSD,
    poolRewardFiat: poolRewardUSD * fiatRate,
    maintenance: maintenanceBtc,
    maintenanceGMT,
    maintenanceUSD,
    maintenanceFiat: maintenanceUSD * fiatRate,
    reward,
    rewardGMT:
      raw.totalInGmt != null ? poolRewardGMT - maintenanceGMT : usdToGmt(rewardInUSD, gmtPrice),
    rewardInUSD,
    rewardInFiat: rewardInUSD * fiatRate,
    btcPriceAtTime: btcPrice > 0 ? btcPrice : undefined,
    btcPriceGmt: btcPrice > 0 && gmtPrice > 0 ? btcPrice / gmtPrice : undefined,
  };
}

/** Daily kWh / TH gives historical farm efficiency; details fill gaps in older records. */
export async function transformSoloMining(
  raw: SoloMiningRawRecord,
  fiatRate: number,
  accessToken?: string,
): Promise<MiningEnrichedRecord> {
  const amounts = transformMiningAmounts(raw, fiatRate);
  const { poolReward } = amounts;
  const totalPower = raw.totalPower ?? 0;
  let satsPerTh = totalPower > 0 ? (poolReward * 1e8) / totalPower : undefined;
  let energyEfficiency =
    totalPower > 0 && raw.totalKwConsumed != null
      ? (raw.totalKwConsumed * 1000) / (24 * totalPower)
      : undefined;
  if (
    (energyEfficiency == null || satsPerTh == null) &&
    accessToken &&
    typeof raw.nftIncomeStatisticId === "number"
  ) {
    try {
      const details = await fetchSoloMiningNftDetails(raw.nftIncomeStatisticId, accessToken);
      let detailPower = 0;
      let efficiencyPower = 0;
      let weightedEfficiency = 0;
      for (const item of details) {
        const power = item.power ?? 0;
        if (power <= 0) continue;
        detailPower += power;
        const efficiency =
          item.kwConsumed != null
            ? (item.kwConsumed * 1000) / (24 * power)
            : (item.nft?.energyEfficiency ?? 0);
        if (efficiency > 0) {
          weightedEfficiency += efficiency * power;
          efficiencyPower += power;
        }
      }
      if (satsPerTh == null && detailPower > 0) {
        satsPerTh = (poolReward * 1e8) / detailPower;
      }
      if (energyEfficiency == null && efficiencyPower > 0) {
        energyEfficiency = weightedEfficiency / efficiencyPower;
      }
    } catch (error) {
      console.warn(
        `[transformSoloMining] failed to fetch details for statistic ${raw.nftIncomeStatisticId}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return {
    createdAt: raw.createdAt,
    currency: "BTC",
    reinvestmentStatus: raw.reinvestmentStatus || null,
    ...amounts,
    reinvested: raw.reinvestmentInPowerNftStatusExecuted === true,
    totalPower,
    discount: raw.totalDiscount ?? 0,
    energyEfficiency,
    satsPerTh,
  };
}

/**
 * MinerWars uses the same payout accounting as solo. Cycle consumption alone cannot determine
 * W/TH without the effective mining duration, so energyEfficiency/satsPerTh stay undefined.
 */
export function transformMinerWars(
  raw: MinerWarsRawRecord,
  fiatRate: number,
): MiningEnrichedRecord {
  return {
    createdAt: raw.createdAt,
    currency: "BTC",
    reinvestmentStatus: raw.reinvestmentStatus || null,
    ...transformMiningAmounts(raw, fiatRate),
    reinvested: raw.reinvestmentInPowerNftStatusExecuted === true,
    totalPower: raw.avgPower ?? 0,
    discount: raw.totalDiscount ?? 0,
    energyEfficiency: undefined,
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
      const result = await fetchHistoricalPrice(coinGeckoId, raw.createdAt, priceCache);
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
