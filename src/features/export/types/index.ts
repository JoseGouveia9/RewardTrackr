export type RewardKey =
  | "solo-mining"
  | "minerwars"
  | "bounty"
  | "referrals"
  | "ambassador"
  | "deposits"
  | "withdrawals"
  | "purchases"
  | "upgrades"
  | "transactions"
  | "simple-earn";

export type SheetType =
  | "mining"
  | "standard"
  | "multi-currency"
  | "purchases"
  | "transactions"
  | "simple-earn";

export type EnrichType =
  | "solo-mining"
  | "minerwars"
  | "wallet-tx-coingecko"
  | "existing-price"
  | "purchase"
  | "upgrade"
  | "simple-earn";

export interface RewardRequestBody {
  pagination?: { cursor?: number; skip?: number; limit?: number; cursorCreatedAt?: string };
  limit?: number;
  [key: string]: unknown;
}

export interface CursorPaginationItem {
  createdAt: string;
  [key: string]: unknown;
}

interface RewardConfigBase {
  key: RewardKey;
  sheetName: string;
  sheetType: SheetType;
  enrichType: EnrichType;
  apiUrl: string;
  pageSize: number;
}

export interface SkipRewardConfig extends RewardConfigBase {
  pagination: "skip";
  buildBody: (skip: number) => RewardRequestBody;
  getNextCursor?: never;
}

export interface CursorRewardConfig extends RewardConfigBase {
  pagination: "cursor";
  buildBody: (cursor: number) => RewardRequestBody;
  getNextCursor: (item: CursorPaginationItem) => number;
}

export interface DateCursorRewardConfig extends RewardConfigBase {
  pagination: "date-cursor";
  buildBody: (cursor: string) => RewardRequestBody;
  getNextCursor: (item: CursorPaginationItem) => string;
}

export type RewardConfig = SkipRewardConfig | CursorRewardConfig | DateCursorRewardConfig;

export type ExtraFiatCurrency = string;

export interface FiatOptions {
  includeFiat?: boolean;
  fiatCurrency?: ExtraFiatCurrency;
}

export interface IncrementalFetchOptions {
  knownCreatedAt?: string[];
  knownTotalCount?: number | null;
}

export interface FetchRewardsOptions {
  walletTx?: FiatOptions;
  excel?: FiatOptions;
  incremental?: IncrementalFetchOptions;
}

export interface GoMiningDataArray<TRecord = unknown> {
  array?: TRecord[];
  count?: number;
}

export interface GoMiningApiResponse<TRecord = unknown> {
  data?: GoMiningDataArray<TRecord>;
  message?: string;
  error?: string;
}

export interface FxLatestResponse {
  rates?: { EUR?: number; [currency: string]: number | undefined };
}

export interface FxTimeseriesRateEntry {
  EUR?: number;
  [currency: string]: number | undefined;
}

export interface FxTimeseriesResponse {
  success?: boolean;
  description?: string;
  rates?: Record<string, FxTimeseriesRateEntry>;
}

export type CoinGeckoPriceTuple = [number, number];

export interface CoinGeckoMarketRangeResponse {
  prices?: CoinGeckoPriceTuple[];
  status?: { error_code?: number };
}

export interface CoinGeckoPriceResult {
  price: number;
  priceTimestamp: string;
}

export type CoinGeckoPriceCacheValue = CoinGeckoPriceResult | number | null;

export interface SoloIncomeListItem {
  metaData?: { poolReward?: number; maintenanceInBtc?: number };
  c1Value?: number;
  c2Value?: number;
  maintenanceForWithdrawInGmt?: number;
  maintenanceByGmt?: boolean;
  reinvestmentInPowerNftStatusExecuted?: boolean;
  power?: number;
  totalDiscount?: number;
}

export interface SoloMiningRawRecord {
  createdAt: string;
  value?: number;
  reinvestmentStatus?: string | null;
  incomeStatistic?: { btcCourseInUsd?: number; gmtPrice?: number };
  incomeList?: SoloIncomeListItem[];
}

export interface MinerWarsRawRecord {
  createdAt: string;
  totalReward?: number;
  c1Value?: number;
  c2Value?: number;
  c1ValueInBtc?: number;
  c2ValueInBtc?: number;
  c1ValueInGmt?: number;
  c2ValueInGmt?: number;
  maintenanceByGmt?: boolean;
  reinvestmentStatus?: string | null;
  reinvestmentInPowerNftStatusExecuted?: boolean;
  incomeStatistic?: { btcCourseInUsd?: number; gmtPrice?: number };
  power?: number;
  totalDiscount?: number;
}

export interface WalletTxRawRecord {
  createdAt: string;
  walletType?: string;
  valueNumeric?: string;
  fromType?: string;
}

export interface ExistingPriceRawRecord {
  createdAt: string;
  currency?: string;
  reward?: number;
  rewardInUsd?: number;
  rewardInUSD?: number;
}

export interface SimpleEarnAsset {
  asset: string;
  price: string;
  apr?: number;
  vipLevelMultiplier?: number;
  reward: string;
  rewardInUsd: string;
}

export interface SimpleEarnRawRecord {
  createdAt: string;
  assetToUsd: string;
  asset?: string;
  assets?: SimpleEarnAsset[];
}

export interface PurchaseRawRecord {
  createdAt: string;
  currency?: string;
  value?: number;
}

export interface UpgradeRawRecord {
  createdAt: string;
  dataType?: string;
  upgradeType?: string;
  usdtValue?: number;
  providerCurrency?: string;
  providerCurrencyValue?: number;
}

export interface MiningEnrichedRecord {
  createdAt: string;
  currency: string;
  reinvestmentStatus: string | null;
  poolReward: number;
  poolRewardGMT: number;
  poolRewardUSD: number;
  poolRewardFiat: number;
  maintenance: number;
  maintenanceGMT: number;
  maintenanceUSD: number;
  maintenanceFiat: number;
  reward: number;
  rewardGMT: number;
  rewardInUSD: number;
  rewardInFiat: number;
  reinvested: boolean;
  totalPower: number;
  discount: number;
  satsPerTh?: number;
  btcPriceAtTime?: number;
  btcPriceGmt?: number;
}

export interface WalletTxEnrichedRecord {
  createdAt: string;
  currency: string;
  reward: number;
  priceAtTime: number;
  priceTimestamp: string | null;
  rewardInUSD: number;
  rewardInFiat: number;
  fromType?: string;
  txType?: string;
}

export interface StandardEnrichedRecord {
  createdAt: string;
  currency: string;
  reward: number;
  priceAtTime: number;
  rewardInUSD: number;
  rewardInFiat: number;
}

export interface PurchaseEnrichedRecord {
  createdAt: string;
  type: string;
  currency: string;
  reward?: number;
  valueUsd: number;
  valueFiat: number;
}

export interface SimpleEarnEnrichedRecord {
  createdAt: string;
  asset: string;
  apr: number;
  currency: string;
  reward: number;
  priceAtTime: number;
  rewardInUSD: number;
  rewardInFiat: number;
}

export type EnrichedRecord =
  | MiningEnrichedRecord
  | WalletTxEnrichedRecord
  | StandardEnrichedRecord
  | PurchaseEnrichedRecord
  | SimpleEarnEnrichedRecord
  | Record<string, unknown>;

export interface RewardSheetPayload {
  key: RewardKey;
  sheetName: string;
  sheetType: SheetType;
  records: EnrichedRecord[];
  totalCount: number | null;
}

export type ProbeCountsMap = Record<string, number | null>;

export type PricingMode = "fiat-on" | "fiat-off";

export interface RewardRecord {
  createdAt?: string;
  currency?: string;
  reward?: number;
  priceAtTime?: number;
  rewardInUSD?: number;
  rewardInUsd?: number;
  rewardInFiat?: number;
  valueUsd?: number;
  valueFiat?: number;
  priceTimestamp?: string | null;
  reinvestmentStatus?: string;
  [key: string]: unknown;
}

export interface CacheEntry {
  sheetName: string;
  records: RewardRecord[];
  totalCount: number;
  fetchedAt: number;
  pricingMode?: PricingMode;
  extraFiatCurrency?: ExtraFiatCurrency;
  newEntriesCount?: number;
}

export type CacheState = Record<RewardKey, CacheEntry | null>;

export interface RewardGroup {
  id: string;
  label: string;
  keys: RewardKey[];
}
