import { useCallback, useState } from "react";
import * as Sentry from "@sentry/react";
import { decodeJwt } from "@/lib/http";
import { ALL_REWARD_KEYS } from "../config/reward-configs";
import { clearAllCacheEntries } from "../utils/cache";
import { executeExportFlow } from "../export-flow";
import type { CacheState, ExtraFiatCurrency, RewardKey } from "../types";

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
  handleExport: () => Promise<void>;
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
}: UseExportParams): UseExportReturn {
  const [loading, setLoading] = useState<boolean>(false);

  const handleClearCache = useCallback((): void => {
    clearAllCacheEntries();
    onCacheUpdate(Object.fromEntries(ALL_REWARD_KEYS.map((k) => [k, null])) as CacheState);
    onMessage("Cache cleared. Next export will fetch fresh data.");
  }, [onMessage, onCacheUpdate]);

  const handleExport = useCallback(async (): Promise<void> => {
    if (selectedKeys.length === 0) return;

    const decoded = decodeJwt(storedToken);
    if (!decoded || (decoded.exp && Math.floor(Date.now() / 1000) >= decoded.exp)) {
      onMessage("Session expired. Please re-sync via the GoMining Exporter extension.");
      return;
    }

    setLoading(true);
    onMessage("");

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
        onCacheUpdate,
      });
      Sentry.logger.info("Export completed", { sheets: selectedKeys.length });
      onMessage(successMessage);
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
          ? "Network error: failed to reach the GoMining API. Please try again later or report the issue at https://github.com/JoseGouveia9/GoMiningExporter/issues"
          : isAuth
            ? "Session expired. Please re-sync via the GoMining Exporter extension."
            : `Export failed: ${msg}`,
      );
    } finally {
      setLoading(false);
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

  return { loading, handleExport, handleClearCache };
}
