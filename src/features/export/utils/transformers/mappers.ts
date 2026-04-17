import { CURRENCY_TO_COINGECKO, WALLET_TO_CURRENCY } from "../../config/currencies";
import { TX_FROM_TYPE_LABEL } from "../../config/wallet-types";
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
  WalletTxEnrichedRecord,
  WalletTxRawRecord,
} from "../../types";
import { fetchCoinGeckoPrice } from "../../api/coingecko";

function usdToGmt(usd: number, gmtPrice: number): number {
  return gmtPrice > 0 ? usd / gmtPrice : 0;
}

export function currencyFromWalletType(walletType: string | undefined): string {
  return WALLET_TO_CURRENCY[walletType ?? ""] || walletType || "UNKNOWN";
}

export function transformSoloMining(
  raw: SoloMiningRawRecord,
  fiatRate: number,
): MiningEnrichedRecord {
  const btcPrice = raw.incomeStatistic?.btcCourseInUsd ?? 0;
  const gmtPrice = raw.incomeStatistic?.gmtPrice ?? 0;

  let maintenanceInBtcSum = 0;
  let hasMaintenanceInBtc = false;
  let maintenanceGMTDirect = 0;
  let hasGmtMaintenance = false;
  let reinvested = false;
  let totalPower = 0;
  let discountMax = 0;

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
      if (inc?.totalDiscount != null && inc.totalDiscount > discountMax) {
        discountMax = inc.totalDiscount;
      }
    }
  }

  const discount = discountMax;
  const rawValue = raw.value ?? 0;

  const maintenanceBtc = hasMaintenanceInBtc
    ? maintenanceInBtcSum
    : hasGmtMaintenance && gmtPrice > 0 && btcPrice > 0
      ? (maintenanceGMTDirect * gmtPrice) / btcPrice
      : 0;

  const poolReward = hasGmtMaintenance ? rawValue : rawValue + maintenanceBtc;
  const reward = poolReward - maintenanceBtc;

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

export function transformMinerWars(
  raw: MinerWarsRawRecord,
  fiatRate: number,
): MiningEnrichedRecord {
  const btcPrice = raw.incomeStatistic?.btcCourseInUsd ?? 0;
  const gmtPrice = raw.incomeStatistic?.gmtPrice ?? 0;
  const maintenanceByGmt = raw.maintenanceByGmt ?? false;

  const c1Btc = raw.c1ValueInBtc ?? raw.c1Value ?? 0;
  const c2Btc = raw.c2ValueInBtc ?? raw.c2Value ?? 0;
  const maintenanceBtc = c1Btc + c2Btc;

  const netReward = raw.totalReward ?? 0;
  const poolReward = maintenanceByGmt ? netReward : netReward + maintenanceBtc;
  const reward = poolReward - maintenanceBtc;

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

export async function transformWalletTxCoingecko(
  raw: WalletTxRawRecord,
  fiatRate: number,
  priceCache: Map<string, CoinGeckoPriceCacheValue>,
  includeFiat: boolean,
  onWait?: (msg: string) => void,
  entryProgress?: string,
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
      const result = await fetchCoinGeckoPrice(
        cgId,
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
    txType,
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

export function transformSimpleEarn(
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
