import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as Sentry from "@sentry/react";
import { decodeJwt } from "@/lib/http";
import { ALL_REWARD_KEYS } from "@/config/reward-configs";
import { clearAllCacheEntries } from "@/lib/reward-cache";
import { executeExportFlow, refreshCacheKeys } from "../utils/export-flow";
import {
  fetchAvailableCycles,
  fetchMinerWarsComparison,
  getCachedMinerWarsComparison,
  invalidateMinerWarsCache,
  prefetchAllCompletedCycles,
} from "@/lib/minerwars/comparison";
import type { CacheState, ExtraFiatCurrency, RewardKey } from "@/types/rewards";

interface UseExportParams {
  storedToken: string;
  selectedKeys: RewardKey[];
  cache: CacheState;
  includeWalletFiat: boolean;
  includeExcelFiat: boolean;
  excelFiatCurrency: ExtraFiatCurrency;
  selectedTxFromTypes: string[];
  onMessage: (msg: string) => void;
  onCacheUpdate: (cache: CacheState) => void;
  onStarted?: () => void;
}

interface UseExportReturn {
  loading: boolean;
  fetchingKeys: Set<RewardKey>;
  isPrefetching: boolean;
  handleExport: () => Promise<void>;
  refreshKeys: (keys: RewardKey[]) => Promise<void>;
  handleClearCache: () => void;
}

export function useExport({
  storedToken,
  selectedKeys,
  cache,
  includeWalletFiat,
  includeExcelFiat,
  excelFiatCurrency,
  selectedTxFromTypes,
  onMessage,
  onCacheUpdate,
  onStarted,
}: UseExportParams): UseExportReturn {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingKeys, setFetchingKeys] = useState<Set<RewardKey>>(new Set());
  const [isPrefetching, setIsPrefetching] = useState(false);
  const latestCacheRef = useRef<CacheState>(cache);

  const prefetchMinerWarsPanelData = useCallback(async (token: string): Promise<void> => {
    const cycles = await fetchAvailableCycles(token).catch(() => []);
    const liveOrPending = cycles.find((c) => c.status === "in-progress" || c.status === "pending");
    if (liveOrPending) {
      await fetchMinerWarsComparison(token, liveOrPending.cycleId).catch(() => {});
    }
    await prefetchAllCompletedCycles(token).catch(() => {});
    // Fallback: fetch completed cycles not covered by build-cache prefetch
    // (e.g. incremental export skipped old records, so those payment days are absent)
    const today = new Date().toISOString().slice(0, 10);
    const uncached = cycles.filter(
      (c) => c.cycleEnd < today && getCachedMinerWarsComparison(c.cycleId) === null,
    );
    for (const cycle of uncached) {
      await fetchMinerWarsComparison(token, cycle.cycleId).catch(() => {});
    }
  }, []);

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
      onMessage(t("export.sessionExpired"));
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
        txFromTypeFilter: selectedKeys.includes("transactions") ? selectedTxFromTypes : undefined,
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
        onBeforeDownload: selectedKeys.includes("minerwars")
          ? async () => {
              onMessage(t("export.preparingCycleTracker"));
              setIsPrefetching(true);
              try {
                await prefetchMinerWarsPanelData(storedToken);
                // Bump cacheVersion so the panel re-reads cache now that comparison data is ready.
                onCacheUpdate(latestCacheRef.current);
              } finally {
                setIsPrefetching(false);
              }
            }
          : undefined,
      });
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
    selectedTxFromTypes,
    onMessage,
    onCacheUpdate,
    onStarted,
    prefetchMinerWarsPanelData,
    t,
  ]);

  const refreshKeys = useCallback(
    async (keys: RewardKey[]): Promise<void> => {
      if (keys.length === 0) return;

      const decoded = decodeJwt(storedToken);
      if (!decoded || (decoded.exp && Math.floor(Date.now() / 1000) >= decoded.exp)) {
        onMessage(t("export.sessionExpired"));
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

        if (keys.includes("minerwars")) {
          prefetchMinerWarsPanelData(storedToken);
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : t("export.failedGeneric");
        onMessage(t("export.failed", { details: msg }));
      } finally {
        setLoading(false);
        setFetchingKeys(new Set());
      }
    },
    [
      storedToken,
      cache,
      includeWalletFiat,
      excelFiatCurrency,
      onMessage,
      onCacheUpdate,
      t,
      prefetchMinerWarsPanelData,
    ],
  );

  return { loading, fetchingKeys, isPrefetching, handleExport, refreshKeys, handleClearCache };
}
