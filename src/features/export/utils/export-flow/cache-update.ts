import { WALLET_TRANSACTION_KEYS } from "@/config/wallet-types";
import { filterCacheableRecords, persistPriceCache, saveCacheEntry } from "@/lib/reward-cache";
import type {
  CacheEntry,
  CacheState,
  EnrichedRecord,
  ExtraFiatCurrency,
  RewardConfig,
  RewardKey,
  RewardRecord,
} from "@/types/rewards";

/**
 * Pricing mode applies to wallet-tx sheets only; every entry records the fiat currency it was
 * enriched with.
 */
export function cacheExtras(
  key: RewardKey,
  includeWalletFiat: boolean,
  currency: ExtraFiatCurrency,
) {
  const pricingMode = WALLET_TRANSACTION_KEYS.has(key)
    ? ((includeWalletFiat ? "fiat-on" : "fiat-off") as "fiat-on" | "fiat-off")
    : undefined;
  return pricingMode
    ? { pricingMode, extraFiatCurrency: currency }
    : { extraFiatCurrency: currency };
}

/** Merges by a composite dedupe key (incoming wins on conflicts) and sorts newest first. */
function mergeRecords(existing: RewardRecord[], incoming: RewardRecord[]): RewardRecord[] {
  const seen = new Set<string>();
  const merged: RewardRecord[] = [];

  const dedupeKey = (item: RewardRecord): string | null => {
    const createdAt = typeof item?.createdAt === "string" ? item.createdAt : "";
    if (!createdAt) return null;

    const currency = typeof item?.currency === "string" ? item.currency : "";
    const asset = typeof item?.asset === "string" ? item.asset : "";
    const type = typeof item?.type === "string" ? item.type : "";
    const transactionType = typeof item?.txType === "string" ? item.txType : "";
    const fromType = typeof item?.fromType === "string" ? item.fromType : "";
    const reward = typeof item?.reward === "number" ? String(item.reward) : "";

    return [createdAt, currency, asset, type, transactionType, fromType, reward].join("|");
  };

  for (const item of [...incoming, ...existing]) {
    const key = dedupeKey(item);
    if (!key) {
      merged.push(item);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged.sort(
    (left, right) =>
      new Date(String(right?.createdAt || 0)).getTime() -
      new Date(String(left?.createdAt || 0)).getTime(),
  );
}

/**
 * Filters cacheable records (reporting how many pending ones were dropped) and merges into the cached ones when incremental.
 * Falls back to the stored record count when the API total is missing or implausibly 0.
 */
export function prepareSheetRecords(
  key: RewardKey,
  enriched: EnrichedRecord[],
  totalCount: number | null,
  currentEntry: CacheEntry | null,
  useIncremental: boolean,
) {
  const fallbackTotalCount = typeof totalCount === "number" ? totalCount : enriched.length;
  const prepared = filterCacheableRecords(key, enriched as RewardRecord[], fallbackTotalCount);
  const recordsForCache =
    useIncremental && currentEntry
      ? mergeRecords(currentEntry.records, prepared.records)
      : prepared.records;
  const hasApiTotalCount =
    typeof totalCount === "number" && (totalCount > 0 || prepared.records.length === 0);
  const totalCountForCache = hasApiTotalCount ? totalCount : recordsForCache.length;
  return { removedCreated: prepared.removedCreated, recordsForCache, totalCountForCache };
}

/**
 * Persists the sheet (and its price cache) to localStorage and notifies the UI with the new cache
 * state.
 */
export function commitSheet(
  cache: CacheState,
  config: RewardConfig,
  records: RewardRecord[],
  totalCount: number,
  extras: Partial<CacheEntry>,
  onCacheUpdate: (cache: CacheState) => void,
): CacheState {
  const key = config.key;
  saveCacheEntry(key, config.sheetName, records, totalCount, extras);
  persistPriceCache(key, records);

  const next: CacheState = {
    ...cache,
    [key]: {
      sheetName: config.sheetName,
      records,
      totalCount,
      fetchedAt: Date.now(),
      ...extras,
    },
  };
  onCacheUpdate(next);
  return next;
}
