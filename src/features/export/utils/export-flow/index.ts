import i18n from "@/i18n";
import type { CacheState, ExtraFiatCurrency, RewardKey } from "@/types/rewards";
import { prefetchMinerWarsData } from "./minerwars-prefetch";
import { enrichPendingWalletTransactionPricing } from "./pricing-enrichment";
import { checkExportRateLimit, rollbackExportRateLimit } from "./rate-limit";
import { refreshSelectedSheets } from "./refresh";

interface RefreshCounts {
  uncachedCount: number;
  staleCount: number;
  currencyChangeCount: number;
}

function summaryParts(
  totalKeys: number,
  { uncachedCount, staleCount, currencyChangeCount }: RefreshCounts,
): string[] {
  const freshCount = totalKeys - uncachedCount - staleCount - currencyChangeCount;
  const parts: string[] = [];
  if (uncachedCount > 0) parts.push(i18n.t("export.partFetched", { count: uncachedCount }));
  if (staleCount > 0) parts.push(i18n.t("export.partUpdated", { count: staleCount }));
  if (currencyChangeCount > 0)
    parts.push(i18n.t("export.partReEnriched", { count: currencyChangeCount }));
  if (freshCount > 0) parts.push(i18n.t("export.partFromCache", { count: freshCount }));
  return parts;
}

interface RefreshCacheKeysParameters {
  accessToken: string;
  keys: RewardKey[];
  cache: CacheState;
  includeWalletFiat: boolean;
  excelFiatCurrency: ExtraFiatCurrency;
  onMessage?: (message: string) => void;
  onCacheUpdate?: (cache: CacheState) => void;
}

/**
 * Refreshes the given sheets without building an Excel file, then prices pending wallet
 * transactions.
 */
export async function refreshCacheKeys({
  accessToken,
  keys,
  cache,
  includeWalletFiat,
  excelFiatCurrency,
  onMessage,
  onCacheUpdate,
}: RefreshCacheKeysParameters): Promise<CacheState> {
  if (keys.length === 0) return cache;

  const messageHandler = onMessage ?? (() => {});
  const cacheHandler = onCacheUpdate ?? (() => {});

  const refreshed = await refreshSelectedSheets({
    accessToken,
    selectedKeys: keys,
    cache,
    includeWalletFiat,
    excelFiatCurrency,
    onMessage: messageHandler,
    onCacheUpdate: cacheHandler,
  });

  const updatedCache = await enrichPendingWalletTransactionPricing({
    updatedCache: refreshed.updatedCache,
    pendingWalletTransactionPricing: refreshed.pendingWalletTransactionPricing,
    priceCache: refreshed.priceCache,
    includeWalletFiat,
    excelFiatCurrency,
    onMessage: messageHandler,
    onCacheUpdate: cacheHandler,
  });

  const parts = summaryParts(keys.length, refreshed);
  messageHandler(
    parts.length > 0
      ? i18n.t("export.refreshComplete", { details: parts.join(", ") })
      : i18n.t("export.refreshUpToDate"),
  );

  return updatedCache;
}

interface ExportFlowParameters {
  accessToken: string;
  selectedKeys: RewardKey[];
  cache: CacheState;
  includeWalletFiat: boolean;
  excelFiatCurrency: ExtraFiatCurrency;
  disableMinerWarsLiveFetch?: boolean;
  onMessage: (message: string) => void;
  onCacheUpdate: (cache: CacheState) => void;
  onStarted?: () => void;
  onMinerWarsPrefetchingChange?: (prefetching: boolean) => void;
}

/**
 * Full export: server rate-limit check, sheet refresh, MinerWars prefetch, then wallet-tx pricing.
 * The rate-limit slot is rolled back if anything fails; resolves with the summary message.
 */
export async function executeExportFlow({
  accessToken,
  selectedKeys,
  cache,
  includeWalletFiat,
  excelFiatCurrency,
  disableMinerWarsLiveFetch,
  onMessage,
  onCacheUpdate,
  onStarted,
  onMinerWarsPrefetchingChange,
}: ExportFlowParameters): Promise<string> {
  await checkExportRateLimit(accessToken);
  onStarted?.();

  try {
    const refreshed = await refreshSelectedSheets({
      accessToken,
      selectedKeys,
      cache,
      includeWalletFiat,
      excelFiatCurrency,
      onMessage,
      onCacheUpdate,
    });

    if (selectedKeys.includes("minerwars")) {
      await prefetchMinerWarsData({
        accessToken,
        disableLiveFetch: disableMinerWarsLiveFetch,
        onMessage,
        onPrefetchingChange: onMinerWarsPrefetchingChange,
      });
    }

    await enrichPendingWalletTransactionPricing({
      updatedCache: refreshed.updatedCache,
      pendingWalletTransactionPricing: refreshed.pendingWalletTransactionPricing,
      priceCache: refreshed.priceCache,
      includeWalletFiat,
      excelFiatCurrency,
      onMessage,
      onCacheUpdate,
    });

    const details =
      summaryParts(selectedKeys.length, refreshed).join(", ") || i18n.t("export.allFromCache");
    return `Build done. Cached data updated (${details}). Use Download Excel in Records.`;
  } catch (error) {
    await rollbackExportRateLimit(accessToken);
    throw error;
  }
}
