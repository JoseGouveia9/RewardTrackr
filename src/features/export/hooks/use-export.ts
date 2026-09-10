import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as Sentry from "@sentry/react";
import { decodeJwt } from "@/lib/http";
import { ALL_REWARD_KEYS, REWARD_CONFIG_MAP } from "@/config/reward-configs";
import { clearAllCacheEntries } from "@/lib/reward-cache";
import { executeExportFlow, refreshCacheKeys } from "../utils/export-flow";
import { invalidateMinerWarsCache } from "@/lib/minerwars/comparison";
import { buildExcelFromSheets } from "../utils/excel-builder";
import type {
  CacheState,
  ExtraFiatCurrency,
  FetchRewardsOptions,
  RewardKey,
  RewardSheetPayload,
} from "@/types/rewards";

interface UseExportParams {
  storedToken: string;
  selectedKeys: RewardKey[];
  cache: CacheState;
  includeWalletFiat: boolean;
  includeExcelFiat: boolean;
  excelFiatCurrency: ExtraFiatCurrency;
  liveMinerWarsEnabled: boolean;
  onMessage: (msg: string) => void;
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
}: UseExportParams): UseExportReturn {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingKeys, setFetchingKeys] = useState<Set<RewardKey>>(new Set());
  const [minerWarsPrefetching, setMinerWarsPrefetching] = useState(false);
  const latestCacheRef = useRef<CacheState>(cache);

  const handleClearCache = useCallback((): void => {
    clearAllCacheEntries();
    invalidateMinerWarsCache();
    onCacheUpdate(Object.fromEntries(ALL_REWARD_KEYS.map((k) => [k, null])) as CacheState);
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
        includeExcelFiat,
        excelFiatCurrency,
        disableMinerWarsLiveFetch: !liveMinerWarsEnabled,
        onMessage,
        onStarted,
        onCacheUpdate: (newCache) => {
          latestCacheRef.current = newCache;
          setFetchingKeys((prev) => {
            const next = new Set(prev);
            for (const k of prev) {
              if (newCache[k]) next.delete(k);
            }
            return next;
          });
          onCacheUpdate(newCache);
        },
        onBeforeDownload: undefined,
        onMinerWarsPrefetchingChange: setMinerWarsPrefetching,
        downloadExcel: false,
      });
      // Ensure a final same-tab cache bump after MinerWars prefetch completes,
      // so the cycle tracker re-reads local caches without a full page refresh.
      const latestCache = { ...latestCacheRef.current };
      latestCacheRef.current = latestCache;
      onCacheUpdate(latestCache);
      Sentry.logger.info("Export completed", { sheets: selectedKeys.length });
      onMessage(successMessage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t("export.failedGeneric");
      const msgLower = msg.toLowerCase();
      const isCors =
        msgLower.includes("failed to fetch") ||
        msgLower.includes("cors") ||
        msgLower.includes("networkerror");
      const isAuth =
        msgLower.includes("unauthorized") ||
        msgLower.includes("unauthenticated") ||
        msgLower.includes("expired") ||
        msgLower.includes("jwt") ||
        msgLower.includes("forbidden");
      Sentry.captureException(error, {
        extra: { reason: isCors ? "cors" : isAuth ? "auth" : "unknown" },
      });
      Sentry.logger.error("Export failed", {
        reason: isCors ? "cors" : isAuth ? "auth" : "unknown",
        message: msg,
      });
      onMessage(
        isCors
          ? t("export.networkError")
          : isAuth
            ? t("export.sessionExpired")
            : t("export.failed", { details: msg }),
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
    includeExcelFiat,
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
            setFetchingKeys((prev) => {
              const next = new Set(prev);
              for (const k of prev) {
                if (newCache[k]) next.delete(k);
              }
              return next;
            });
          },
        });
        onCacheUpdate(updated);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : t("export.failedGeneric");
        onMessage(t("export.failed", { details: msg }));
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
        walletTx: { includeFiat: includeWalletFiat },
        excel: { includeFiat: includeExcelFiat, fiatCurrency: excelFiatCurrency },
      };

      const buffer = await buildExcelFromSheets(sheetsPayload, options);
      triggerFileDownload(buffer, `rewards-${new Date().toISOString().slice(0, 10)}.xlsx`);

      onMessage(
        t("export.downloaded", {
          details: t("export.partFromCache", { count: cachedKeys.length }),
        }),
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t("export.failedGeneric");
      onMessage(t("export.failed", { details: msg }));
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
