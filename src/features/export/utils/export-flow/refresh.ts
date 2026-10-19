import i18n from "@/i18n";
import { REWARD_CONFIG_MAP, ALL_REWARD_KEYS } from "@/config/reward-configs";
import { persistPriceCache, saveCacheEntry } from "@/lib/reward-cache";
import type {
  CacheState,
  ExtraFiatCurrency,
  IncrementalFetchOptions,
  RewardConfig,
  RewardKey,
} from "@/types/rewards";
import { getSessionPriceCache } from "../../api/coingecko";
import { enrichRecords, reenrichFiatValues } from "../transformers";
import { cacheExtras, commitSheet, prepareSheetRecords } from "./cache-update";
import { fetchAllPages } from "./pagination";
import type { PendingWalletTransactionPricing } from "./pricing-enrichment";
import { fetchSimpleEarnIncremental } from "./simple-earn-incremental";
import { evaluateCacheFreshness, fetchLiveCounts } from "./stale-detection";
import { tSheetName } from "./sheet-names";

interface RefreshSelectedSheetsParameters {
  accessToken: string;
  selectedKeys: RewardKey[];
  cache: CacheState;
  includeWalletFiat: boolean;
  excelFiatCurrency: ExtraFiatCurrency;
  onMessage: (message: string) => void;
  onCacheUpdate: (cache: CacheState) => void;
}

interface RefreshSelectedSheetsResult {
  updatedCache: CacheState;
  uncachedCount: number;
  staleCount: number;
  currencyChangeCount: number;
  pendingWalletTransactionPricing: PendingWalletTransactionPricing[];
  priceCache: ReturnType<typeof getSessionPriceCache>;
}

type FetchedSheet = {
  config: RewardConfig;
  rawRecords: unknown[];
  totalCount: number | null;
  useIncremental: boolean;
};

/**
 * Stops before the slow wallet-tx pricing pass so the build flow can prefetch MinerWars in between.
 */
export async function refreshSelectedSheets({
  accessToken,
  selectedKeys,
  cache,
  includeWalletFiat,
  excelFiatCurrency,
  onMessage,
  onCacheUpdate,
}: RefreshSelectedSheetsParameters): Promise<RefreshSelectedSheetsResult> {
  const cachedKeys = selectedKeys.filter((key) => cache[key]);
  const uncachedKeys = selectedKeys.filter((key) => !cache[key]);

  let updatedCache: CacheState = { ...cache };
  let staleKeys: RewardKey[] = [];
  const incrementalKeys = new Set<RewardKey>();
  const currencyChangeKeys = new Set<RewardKey>();

  if (cachedKeys.length > 0) {
    onMessage(i18n.t("export.checkingCached", { count: cachedKeys.length }));
    const counts = await fetchLiveCounts(accessToken, cachedKeys);

    staleKeys = cachedKeys.filter((key) => {
      const entry = updatedCache[key];
      const config = REWARD_CONFIG_MAP[key];
      if (!config) return true;
      const decision = evaluateCacheFreshness(
        key,
        entry,
        config,
        counts[key],
        includeWalletFiat,
        excelFiatCurrency,
      );

      if (decision.useIncremental) incrementalKeys.add(key);
      if (decision.currencyChanged) currencyChangeKeys.add(key);
      return decision.isStale;
    });
  }

  const order = Object.fromEntries(ALL_REWARD_KEYS.map((key, index) => [key, index]));
  const keysToFetch = [...uncachedKeys, ...staleKeys].sort(
    (left, right) => (order[left] ?? 999) - (order[right] ?? 999),
  );

  const priceCache = getSessionPriceCache();
  const fetched: FetchedSheet[] = [];

  for (let index = 0; index < keysToFetch.length; index++) {
    const key = keysToFetch[index];
    const config = REWARD_CONFIG_MAP[key];
    if (!config) continue;

    const translatedName = tSheetName(key, config.sheetName);
    onMessage(
      i18n.t("export.fetchingSheet", {
        name: translatedName,
        current: index + 1,
        total: keysToFetch.length,
      }),
    );

    const currentEntry = updatedCache[key];
    const useIncremental = Boolean(currentEntry && incrementalKeys.has(key));
    const incrementalOptions: IncrementalFetchOptions | undefined =
      useIncremental && currentEntry
        ? {
            knownCreatedAt: currentEntry.records
              .map((record) => (typeof record?.createdAt === "string" ? record.createdAt : ""))
              .filter(Boolean),
            knownTotalCount: currentEntry.totalCount,
          }
        : undefined;

    const { records: rawRecords, totalCount } =
      key === "simple-earn" && useIncremental && currentEntry
        ? await fetchSimpleEarnIncremental(
            config,
            accessToken,
            currentEntry.records,
            onMessage,
            translatedName,
          )
        : await fetchAllPages(config, accessToken, incrementalOptions, onMessage, translatedName);
    fetched.push({ config, rawRecords, totalCount, useIncremental });
  }

  for (const key of currencyChangeKeys) {
    const currentEntry = updatedCache[key];
    if (!currentEntry) continue;
    const config = REWARD_CONFIG_MAP[key];
    if (!config) continue;

    onMessage(
      i18n.t("export.applyingRates", {
        currency: excelFiatCurrency,
        name: tSheetName(key, config.sheetName),
      }),
    );
    const reEnriched = await reenrichFiatValues(config, currentEntry.records, excelFiatCurrency);
    const extras = {
      ...cacheExtras(key, includeWalletFiat, excelFiatCurrency),
      newEntriesCount: 0,
    };

    saveCacheEntry(key, currentEntry.sheetName, reEnriched, currentEntry.totalCount, extras);
    persistPriceCache(key, reEnriched);

    updatedCache = {
      ...updatedCache,
      [key]: { ...currentEntry, records: reEnriched, fetchedAt: Date.now(), ...extras },
    };
    onCacheUpdate(updatedCache);
  }

  const pendingWalletTransactionPricing: PendingWalletTransactionPricing[] = [];

  const fetchedNonWalletTransactions = fetched.filter(
    (fetchedSheet) => fetchedSheet.config.enrichType !== "wallet-tx-coingecko",
  );
  const fetchedWalletTransactions = fetched.filter(
    (fetchedSheet) => fetchedSheet.config.enrichType === "wallet-tx-coingecko",
  );
  const enrichTotal = fetchedNonWalletTransactions.length + fetchedWalletTransactions.length;

  for (let index = 0; index < fetchedNonWalletTransactions.length; index++) {
    const { config, rawRecords, totalCount, useIncremental } = fetchedNonWalletTransactions[index];
    const key = config.key;

    onMessage(
      i18n.t("export.enrichingSheet", {
        name: tSheetName(key, config.sheetName),
        current: index + 1,
        total: enrichTotal,
      }),
    );
    const enriched = await enrichRecords(
      config,
      rawRecords,
      priceCache,
      includeWalletFiat,
      excelFiatCurrency,
      onMessage,
    );

    const currentEntry = updatedCache[key];
    const { removedCreated, recordsForCache, totalCountForCache } = prepareSheetRecords(
      key,
      enriched,
      totalCount,
      currentEntry,
      useIncremental,
    );

    if (removedCreated > 0) {
      onMessage(
        i18n.t("export.skippedPending", {
          name: tSheetName(key, config.sheetName),
          count: removedCreated,
        }),
      );
    }

    const newEntriesCount = Math.max(
      0,
      recordsForCache.length - (currentEntry?.records.length ?? 0),
    );
    const extras = {
      ...cacheExtras(key, includeWalletFiat, excelFiatCurrency),
      newEntriesCount,
    };
    updatedCache = commitSheet(
      updatedCache,
      config,
      recordsForCache,
      totalCountForCache,
      extras,
      onCacheUpdate,
    );
  }

  for (let index = 0; index < fetchedWalletTransactions.length; index++) {
    const { config, rawRecords, totalCount, useIncremental } = fetchedWalletTransactions[index];
    const key = config.key;

    onMessage(
      i18n.t("export.enrichingSheet", {
        name: tSheetName(key, config.sheetName),
        current: fetchedNonWalletTransactions.length + index + 1,
        total: enrichTotal,
      }),
    );

    const enriched = await enrichRecords(
      config,
      rawRecords,
      priceCache,
      false,
      excelFiatCurrency,
      onMessage,
    );

    const { recordsForCache, totalCountForCache } = prepareSheetRecords(
      key,
      enriched,
      totalCount,
      updatedCache[key],
      useIncremental,
    );

    updatedCache = commitSheet(
      updatedCache,
      config,
      recordsForCache,
      totalCountForCache,
      { pricingMode: "fiat-off", extraFiatCurrency: undefined },
      onCacheUpdate,
    );

    pendingWalletTransactionPricing.push({
      config,
      records: rawRecords,
      totalCount,
      useIncremental,
    });
  }

  return {
    updatedCache,
    uncachedCount: uncachedKeys.length,
    staleCount: staleKeys.length,
    currencyChangeCount: currencyChangeKeys.size,
    pendingWalletTransactionPricing,
    priceCache,
  };
}
