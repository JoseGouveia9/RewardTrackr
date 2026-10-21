import { buildApiHeaders, postJson } from "@/lib/http";
import { REWARD_CONFIG_MAP } from "@/config/reward-configs";
import { WALLET_TRANSACTION_KEYS } from "@/config/wallet-types";
import { hasMissingPrices } from "@/lib/reward-cache";
import type {
  CacheState,
  ExtraFiatCurrency,
  GoMiningApiResponse,
  RewardConfig,
  RewardKey,
  RewardRequestBody,
} from "@/types/rewards";
import { latestRecordEpoch, toEpoch } from "./date-utils";
import { buildRequestBody, getInitialPointer } from "./pagination";

type LiveProbe = {
  count: number | null;
  latestCreatedAt: string | null;
};

type CacheFreshnessDecision = {
  isStale: boolean;
  useIncremental: boolean;
  currencyChanged: boolean;
};

const FULL_REFETCH: CacheFreshnessDecision = {
  isStale: true,
  useIncremental: false,
  currencyChanged: false,
};
const INCREMENTAL_REFETCH: CacheFreshnessDecision = {
  isStale: true,
  useIncremental: true,
  currencyChanged: false,
};

/**
 * Probes each endpoint with limit 1 to get the live total count and newest createdAt; failures
 * yield nulls.
 */
export async function fetchLiveCounts(
  accessToken: string,
  keys: RewardKey[],
): Promise<Record<string, LiveProbe>> {
  const headers = buildApiHeaders(accessToken);
  const configs: RewardConfig[] = keys.reduce<RewardConfig[]>((accumulator, key) => {
    const config = REWARD_CONFIG_MAP[key];
    if (config) accumulator.push(config);
    return accumulator;
  }, []);

  const entries = await Promise.all(
    configs.map(async (config) => {
      const probeBody: RewardRequestBody = {
        ...buildRequestBody(config, getInitialPointer(config)),
      };
      if (probeBody.pagination) {
        probeBody.pagination = { ...probeBody.pagination, limit: 1 };
      } else if (probeBody.limit !== undefined) {
        probeBody.limit = 1;
      }
      try {
        const payload = await postJson<GoMiningApiResponse>(config.apiUrl, headers, probeBody);
        const first = Array.isArray(payload?.data?.array)
          ? (payload.data.array[0] as Record<string, unknown> | undefined)
          : (payload?.data?.items?.[0] as Record<string, unknown> | undefined);
        const latestCreatedAt = typeof first?.createdAt === "string" ? first.createdAt : null;
        return [config.key, { count: payload?.data?.count ?? null, latestCreatedAt }] as const;
      } catch {
        return [config.key, { count: null, latestCreatedAt: null }] as const;
      }
    }),
  );

  return Object.fromEntries(entries);
}

/**
 * Decides whether a cached sheet needs a full refetch, an incremental one, or none, by comparing
 * live vs cached counts. Simple Earn and the list-cursor endpoints (solo-mining, minerwars)
 * compare newest timestamps instead, since their counts are unreliable or absent.
 */
export function evaluateCacheFreshness(
  key: RewardKey,
  entry: CacheState[RewardKey],
  config: RewardConfig,
  liveProbe: LiveProbe | undefined,
  includeWalletFiat: boolean,
  excelFiatCurrency: ExtraFiatCurrency,
): CacheFreshnessDecision {
  if (!entry) return FULL_REFETCH;

  if (WALLET_TRANSACTION_KEYS.has(key)) {
    const desiredMode = includeWalletFiat ? "fiat-on" : "fiat-off";
    if ((entry.pricingMode || "fiat-on") !== desiredMode) return FULL_REFETCH;
    if (hasMissingPrices(entry, key, includeWalletFiat)) return FULL_REFETCH;
  }

  const liveCount = liveProbe?.count ?? null;

  const countUnreliable = config.key === "simple-earn" || config.pagination === "list-cursor";

  if (countUnreliable) {
    const hasLiveLatest = typeof liveProbe?.latestCreatedAt === "string";
    const liveCountReliable = liveCount != null && (liveCount > 0 || !hasLiveLatest);

    if (liveCountReliable) {
      if (liveCount > entry.totalCount) return INCREMENTAL_REFETCH;
      if (liveCount !== entry.totalCount) return FULL_REFETCH;
    }

    const liveLatestEpoch = toEpoch(liveProbe?.latestCreatedAt);
    const cachedLatestEpoch = latestRecordEpoch(entry.records);

    if (
      Number.isFinite(liveLatestEpoch) &&
      Number.isFinite(cachedLatestEpoch) &&
      liveLatestEpoch > cachedLatestEpoch
    ) {
      return INCREMENTAL_REFETCH;
    }

    if (
      !liveCountReliable &&
      (!Number.isFinite(liveLatestEpoch) || !Number.isFinite(cachedLatestEpoch))
    ) {
      return INCREMENTAL_REFETCH;
    }
  } else {
    if (liveCount == null) return FULL_REFETCH;
    if (liveCount > entry.totalCount) return INCREMENTAL_REFETCH;
    if (liveCount !== entry.totalCount) return FULL_REFETCH;
  }

  const currencyChanged = entry.extraFiatCurrency !== excelFiatCurrency;
  return { isStale: false, useIncremental: false, currencyChanged };
}
