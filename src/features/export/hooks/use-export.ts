import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as Sentry from "@sentry/react";
import { decodeJwt } from "@/lib/http";
import { ALL_REWARD_KEYS, REWARD_CONFIG_MAP } from "@/config/reward-configs";
import { clearAllCacheEntries } from "@/lib/reward-cache";
import { executeExportFlow, refreshCacheKeys } from "../utils/export-flow";
import { invalidateMinerWarsCache } from "@/features/minerwars/utils/comparison";
import type {
  CacheState,
  ExtraFiatCurrency,
  FetchRewardsOptions,
  RewardKey,
  RewardSheetPayload,
} from "@/types/rewards";

interface UseExportParameters {
  storedToken: string;
  selectedKeys: RewardKey[];
  cache: CacheState;
  includeWalletFiat: boolean;
  includeExcelFiat: boolean;
  excelFiatCurrency: ExtraFiatCurrency;
  liveMinerWarsEnabled: boolean;
  onMessage: (message: string) => void;
  onCacheUpdate: (cache: CacheState) => void;
  onStarted?: () => void;
}

interface UseExportReturn {
  loading: boolean;
  fetchingKeys: Set<RewardKey>;
  minerWarsPrefetching: boolean;
  handleExport: () => Promise<void>;
  handleDownloadCachedExport: () => Promise<void>;
  refreshKeys: (keys: RewardKey[]) => Promise<void>;
  handleClearCache: () => void;
}

/**
 * Saves the workbook through a temporary object-URL link, which is revoked right after the click.
 */
function triggerFileDownload(buffer: ArrayBuffer, fileName: string): void {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Runs the export flow, tracking which sheets are still being fetched.
 * Re-emits the cache after the MinerWars prefetch so the cycle tracker re-reads local caches.
 */
export function useExport({
  storedToken,
  selectedKeys,
  cache,
  includeWalletFiat,
  includeExcelFiat,
  excelFiatCurrency,
  liveMinerWarsEnabled,
  onMessage,
  onCacheUpdate,
  onStarted,
}: UseExportParameters): UseExportReturn {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingKeys, setFetchingKeys] = useState<Set<RewardKey>>(new Set());
  const [minerWarsPrefetching, setMinerWarsPrefetching] = useState(false);
  const latestCacheRef = useRef<CacheState>(cache);

  const handleClearCache = useCallback((): void => {
    clearAllCacheEntries();
    invalidateMinerWarsCache();
    onCacheUpdate(Object.fromEntries(ALL_REWARD_KEYS.map((key) => [key, null])) as CacheState);
    onMessage(t("export.cacheCleared"));
  }, [onMessage, onCacheUpdate, t]);

  const handleExport = useCallback(async (): Promise<void> => {
    if (selectedKeys.length === 0) return;

    const decoded = decodeJwt(storedToken);
    if (!decoded || (decoded.exp && Math.floor(Date.now() / 1000) >= decoded.exp)) {
      window.dispatchEvent(new CustomEvent("rt:session-expired"));
      return;
    }

    setLoading(true);
    onMessage("");
    setFetchingKeys(new Set(selectedKeys));

    Sentry.logger.info("Export started", {
      sheets: selectedKeys.join(", "),
      currency: excelFiatCurrency,
    });

    try {
      const successMessage = await executeExportFlow({
        accessToken: storedToken,
        selectedKeys,
        cache,
        includeWalletFiat,
        excelFiatCurrency,
        disableMinerWarsLiveFetch: !liveMinerWarsEnabled,
        onMessage,
        onStarted,
        onCacheUpdate: (newCache) => {
          latestCacheRef.current = newCache;
          setFetchingKeys((previousKeys) => {
            const next = new Set(previousKeys);
            for (const key of previousKeys) {
              if (newCache[key]) next.delete(key);
            }
            return next;
          });
          onCacheUpdate(newCache);
        },
        onMinerWarsPrefetchingChange: setMinerWarsPrefetching,
      });
      const latestCache = { ...latestCacheRef.current };
      latestCacheRef.current = latestCache;
      onCacheUpdate(latestCache);
      Sentry.logger.info("Export completed", { sheets: selectedKeys.length });
      onMessage(successMessage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("export.failedGeneric");
      const messageLower = message.toLowerCase();
      const isCors =
        messageLower.includes("failed to fetch") ||
        messageLower.includes("cors") ||
        messageLower.includes("networkerror");
      const isAuth =
        messageLower.includes("unauthorized") ||
        messageLower.includes("unauthenticated") ||
        messageLower.includes("expired") ||
        messageLower.includes("jwt") ||
        messageLower.includes("forbidden");
      const reason = isCors ? "cors" : isAuth ? "auth" : "unknown";
      Sentry.captureException(error, { extra: { reason } });
      Sentry.logger.error("Export failed", { reason, message });
      onMessage(
        isCors
          ? t("export.networkError")
          : isAuth
            ? t("export.sessionExpired")
            : t("export.failed", { details: message }),
      );
      if (isAuth) window.dispatchEvent(new CustomEvent("rt:session-expired"));
      else window.dispatchEvent(new CustomEvent("rt:fetch-failed"));
    } finally {
      setLoading(false);
      setFetchingKeys(new Set());
    }
  }, [
    storedToken,
    selectedKeys,
    cache,
    includeWalletFiat,
    excelFiatCurrency,
    liveMinerWarsEnabled,
    onMessage,
    onCacheUpdate,
    onStarted,
    t,
  ]);

  const refreshKeys = useCallback(
    async (keys: RewardKey[]): Promise<void> => {
      if (keys.length === 0) return;

      const decoded = decodeJwt(storedToken);
      if (!decoded || (decoded.exp && Math.floor(Date.now() / 1000) >= decoded.exp)) {
        window.dispatchEvent(new CustomEvent("rt:session-expired"));
        return;
      }

      setLoading(true);
      setFetchingKeys(new Set(keys));
      try {
        const updated = await refreshCacheKeys({
          accessToken: storedToken,
          keys,
          cache,
          includeWalletFiat,
          excelFiatCurrency,
          onMessage,
          onCacheUpdate: (newCache) => {
            onCacheUpdate(newCache);
            setFetchingKeys((previousKeys) => {
              const next = new Set(previousKeys);
              for (const key of previousKeys) {
                if (newCache[key]) next.delete(key);
              }
              return next;
            });
          },
        });
        onCacheUpdate(updated);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : t("export.failedGeneric");
        onMessage(t("export.failed", { details: message }));
      } finally {
        setLoading(false);
        setFetchingKeys(new Set());
      }
    },
    [storedToken, cache, includeWalletFiat, excelFiatCurrency, onMessage, onCacheUpdate, t],
  );

  const handleDownloadCachedExport = useCallback(async (): Promise<void> => {
    const cachedKeys = selectedKeys.filter((key) => {
      const entry = cache[key];
      return Boolean(entry && entry.records.length > 0);
    });

    if (cachedKeys.length === 0) {
      onMessage("No cached sheets available. Run a build once, then download from Records.");
      return;
    }

    try {
      setLoading(true);
      onMessage(t("export.buildingExcel"));

      const sheetsPayload: RewardSheetPayload[] = cachedKeys.map((key) => {
        const entry = cache[key]!;
        const config = REWARD_CONFIG_MAP[key];
        return {
          key,
          sheetName: entry.sheetName,
          sheetType: config?.sheetType ?? "standard",
          records: entry.records as RewardSheetPayload["records"],
          totalCount: entry.totalCount,
        };
      });

      const options: FetchRewardsOptions = {
        walletTransaction: { includeFiat: includeWalletFiat },
        excel: { includeFiat: includeExcelFiat, fiatCurrency: excelFiatCurrency },
      };

      const { buildExcelFromSheets } = await import("../utils/excel-builder");
      const buffer = await buildExcelFromSheets(sheetsPayload, options);
      triggerFileDownload(buffer, `rewards-${new Date().toISOString().slice(0, 10)}.xlsx`);

      onMessage(
        t("export.downloaded", {
          details: t("export.partFromCache", { count: cachedKeys.length }),
        }),
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("export.failedGeneric");
      onMessage(t("export.failed", { details: message }));
    } finally {
      setLoading(false);
    }
  }, [cache, excelFiatCurrency, includeExcelFiat, includeWalletFiat, onMessage, selectedKeys, t]);

  return {
    loading,
    fetchingKeys,
    minerWarsPrefetching,
    handleExport,
    handleDownloadCachedExport,
    refreshKeys,
    handleClearCache,
  };
}
