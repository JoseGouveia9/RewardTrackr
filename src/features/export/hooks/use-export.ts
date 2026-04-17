import { useCallback, useState } from "react";
import * as Sentry from "@sentry/react";
import { decodeJwt } from "@/lib/http";
import { ALL_REWARD_KEYS } from "../config/reward-configs";
import { clearAllCacheEntries } from "../utils/cache";
import { executeExportFlow } from "../utils/export-flow";
import type { CacheState, ExtraFiatCurrency, RewardKey } from "../types";

// Types

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
}

interface UseExportReturn {
  loading: boolean;
  fetchingKeys: Set<RewardKey>;
  handleExport: () => Promise<void>;
  handleClearCache: () => void;
}

// Hook

// Manages export execution state, triggering the export flow and handling errors and cache clearing.
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
}: UseExportParams): UseExportReturn {
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingKeys, setFetchingKeys] = useState<Set<RewardKey>>(new Set());

  // Clears all localStorage cache entries and resets the in-memory cache state.
  const handleClearCache = useCallback((): void => {
    clearAllCacheEntries();
    onCacheUpdate(Object.fromEntries(ALL_REWARD_KEYS.map((k) => [k, null])) as CacheState);
    onMessage("Cache cleared. Next export will fetch fresh data.");
  }, [onMessage, onCacheUpdate]);

  // Validates the session token then runs the full export flow, reporting success or error.
  const handleExport = useCallback(async (): Promise<void> => {
    if (selectedKeys.length === 0) return;

    const decoded = decodeJwt(storedToken);
    if (!decoded || (decoded.exp && Math.floor(Date.now() / 1000) >= decoded.exp)) {
      onMessage("Session expired. Please re-sync via the RewardTrackr extension.");
      return;
    }

    setLoading(true);
    onMessage("");
    const pendingKeys = new Set(selectedKeys.filter((k) => !cache[k]) as RewardKey[]);
    setFetchingKeys(pendingKeys);

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
        onCacheUpdate: (newCache) => {
          setFetchingKeys((prev) => {
            const next = new Set(prev);
            for (const k of prev) {
              if (newCache[k]) next.delete(k);
            }
            return next;
          });
          onCacheUpdate(newCache);
        },
      });
      Sentry.logger.info("Export completed", { sheets: selectedKeys.length });
      onMessage(successMessage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Export failed";
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
          ? "Network error: Failed to reach the GoMining API. Please try again later or report the issue [here](https://github.com/JoseGouveia9/RewardTrackr/issues)."
          : isAuth
            ? "Session expired. Please re-sync via the RewardTrackr extension."
            : `Export failed: ${msg}`,
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
  ]);

  return { loading, fetchingKeys, handleExport, handleClearCache };
}
