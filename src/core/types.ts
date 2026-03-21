// Reward keys and sheet types

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
  | "transactions";

export type SheetType = "mining" | "standard" | "multi-currency" | "purchases" | "transactions";

export type EnrichType =
  | "solo-mining"
  | "minerwars"
  | "wallet-tx-coingecko"
  | "existing-price"
  | "purchase"
  | "upgrade";

// API pagination and request bodies

export interface RewardRequestBody {
  pagination?: { cursor?: number; skip?: number; limit?: number };
  limit?: number;
  [key: string]: unknown;
}

export interface CursorPaginationItem {
  createdAt: string;
  [key: string]: unknown;
}

// Reward config

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

export type RewardConfig = SkipRewardConfig | CursorRewardConfig;

// Options

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

// GoMining API responses

export interface GoMiningDataArray<TRecord = unknown> {
  array?: TRecord[];
  count?: number;
}

export interface GoMiningApiResponse<TRecord = unknown> {
  data?: GoMiningDataArray<TRecord>;
  message?: string;
  error?: string;
}

// FX and CoinGecko types

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

// Raw record shapes from the API

export interface SoloIncomeListItem {
  metaData?: { poolReward?: number };
  c1Value?: number;
  c2Value?: number;
  reinvestmentInPowerNftStatusExecuted?: boolean;
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
  reinvestmentStatus?: string | null;
  reinvestmentInPowerNftStatusExecuted?: boolean;
  incomeStatistic?: { btcCourseInUsd?: number; gmtPrice?: number };
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
}

// Enriched record shapes

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
  valueUsd: number;
  valueFiat: number;
}

export type EnrichedRecord =
  | MiningEnrichedRecord
  | WalletTxEnrichedRecord
  | StandardEnrichedRecord
  | PurchaseEnrichedRecord
  | Record<string, unknown>;

// Sheet payload

export interface RewardSheetPayload {
  key: RewardKey;
  sheetName: string;
  sheetType: SheetType;
  records: EnrichedRecord[];
  totalCount: number | null;
}

export type ProbeCountsMap = Record<string, number | null>;

// UI and cache types

export type PricingMode = "fiat-on" | "fiat-off";

export interface AuthUser {
  id?: string | null;
  email?: string | null;
  alias?: string | null;
  exp?: number | null;
}

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
}

export type CacheState = Record<RewardKey, CacheEntry | null>;

export interface RewardGroup {
  id: string;
  label: string;
  keys: RewardKey[];
}
