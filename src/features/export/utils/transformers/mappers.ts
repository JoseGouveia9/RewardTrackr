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

function usdToGmt(usd: number, gmtPrice: number): number {
  return gmtPrice > 0 ? usd / gmtPrice : 0;
}

export function currencyFromWalletType(walletType: string | undefined): string {
  return WALLET_TO_CURRENCY[walletType ?? ""] || walletType || "UNKNOWN";
}

/**
 * Solo mining: maintenance paid in GMT leaves raw.value net, otherwise it is gross of maintenance.
 * maintenanceInBtc is counted only for non-GMT items to avoid duplicating the GMT amount.
 */
export function transformSoloMining(
  raw: SoloMiningRawRecord,
  fiatRate: number,
): MiningEnrichedRecord {
  const btcPrice = raw.incomeStatistic?.btcCourseInUsd ?? 0;
  const gmtPrice = raw.incomeStatistic?.gmtPrice ?? 0;

  let maintenanceInBtcSum = 0;
  let maintenanceGMTDirect = 0;
  let hasGmtMaintenance = false;
  let reinvested = false;
  let totalPower = 0;
  let discountMax = 0;
  const satsPerTerahashValues: number[] = [];
  const efficiencyValues: number[] = [];

  if (Array.isArray(raw.incomeList)) {
    for (const incomeItem of raw.incomeList) {
      if (incomeItem?.maintenanceByGmt) {
        const gmtAmount = incomeItem?.maintenanceForWithdrawInGmt ?? null;
        if (gmtAmount != null) {
          maintenanceGMTDirect += gmtAmount;
          hasGmtMaintenance = true;
        }
      } else {
        const maintenanceBtcValue = incomeItem?.metaData?.maintenanceInBtc ?? null;
        if (maintenanceBtcValue != null) {
          maintenanceInBtcSum += maintenanceBtcValue;
        }
      }
      if (incomeItem?.reinvestmentInPowerNftStatusExecuted === true) reinvested = true;
      totalPower += incomeItem?.power ?? 0;
      if (incomeItem?.totalDiscount != null && incomeItem.totalDiscount > discountMax) {
        discountMax = incomeItem.totalDiscount;
      }
      const incomePoolReward = incomeItem?.metaData?.poolReward;
      const incomePower = incomeItem?.power;
      if (incomePoolReward != null && incomePower != null && incomePower > 0) {
        satsPerTerahashValues.push((incomePoolReward * 1e8) / incomePower);
      }
      if (incomeItem?.energyEfficiency != null && incomeItem.energyEfficiency > 0) {
        efficiencyValues.push(incomeItem.energyEfficiency);
      }
    }
  }

  const discount = discountMax;
  const rawValue = raw.value ?? 0;

  const canConvertMaintenance = gmtPrice > 0 && btcPrice > 0;
  const maintenanceBtc =
    maintenanceInBtcSum +
    (canConvertMaintenance ? (maintenanceGMTDirect * gmtPrice) / btcPrice : 0);
  const maintenanceGMT =
    maintenanceGMTDirect +
    (canConvertMaintenance ? (maintenanceInBtcSum * btcPrice) / gmtPrice : 0);
  const maintenanceUSD = maintenanceInBtcSum * btcPrice + maintenanceGMTDirect * gmtPrice;

  const poolReward = hasGmtMaintenance ? rawValue : rawValue + maintenanceBtc;
  const reward = poolReward - maintenanceBtc;

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
    energyEfficiency:
      efficiencyValues.length > 0
        ? efficiencyValues.reduce((total, value) => total + value, 0) / efficiencyValues.length
        : undefined,
    satsPerTh:
      satsPerTerahashValues.length > 0
        ? satsPerTerahashValues.reduce((total, value) => total + value, 0) /
          satsPerTerahashValues.length
        : undefined,
    btcPriceAtTime: btcPrice > 0 ? btcPrice : undefined,
    btcPriceGmt: btcPrice > 0 && gmtPrice > 0 ? btcPrice / gmtPrice : undefined,
  };
}

/**
 * MinerWars: totalReward is gross when maintenance is in GMT and net when in BTC, normalized to pool/reward.
 * Maintenance may be split across BTC and GMT in one cycle, so both portions are summed and cross-converted.
 */
export function transformMinerWars(
  raw: MinerWarsRawRecord,
  fiatRate: number,
): MiningEnrichedRecord {
  const btcPrice = raw.incomeStatistic?.btcCourseInUsd ?? 0;
  const gmtPrice = raw.incomeStatistic?.gmtPrice ?? 0;
  const maintenanceByGmt = raw.maintenanceByGmt ?? false;

  const c1Btc = raw.c1ValueInBtc ?? raw.c1Value ?? 0;
  const c2Btc = raw.c2ValueInBtc ?? raw.c2Value ?? 0;
  const rawMaintenanceBtc = c1Btc + c2Btc;

  const c1Gmt = raw.c1ValueInGmt ?? 0;
  const c2Gmt = raw.c2ValueInGmt ?? 0;
  const rawMaintenanceGmt = c1Gmt + c2Gmt;

  const canConvertMaintenance = gmtPrice > 0 && btcPrice > 0;
  const maintenanceGMT =
    rawMaintenanceGmt + (canConvertMaintenance ? (rawMaintenanceBtc * btcPrice) / gmtPrice : 0);
  const maintenanceBtc =
    rawMaintenanceBtc + (canConvertMaintenance ? (rawMaintenanceGmt * gmtPrice) / btcPrice : 0);
  const maintenanceUSD = rawMaintenanceBtc * btcPrice + rawMaintenanceGmt * gmtPrice;

  const netReward = raw.totalReward ?? 0;
  const poolReward = maintenanceByGmt ? netReward : netReward + maintenanceBtc;
  const reward = maintenanceByGmt ? netReward - maintenanceBtc : netReward;

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
    totalPower: raw.power ?? 0,
    discount: raw.totalDiscount ?? 0,
    energyEfficiency:
      raw.energyEfficiency != null && raw.energyEfficiency > 0 ? raw.energyEfficiency : undefined,
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
