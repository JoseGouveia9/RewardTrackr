import { useCallback, useEffect, useRef, useState } from "react";
import { buildApiHeaders, decodeJwt } from "@/lib/http";
import { LOCAL_STORAGE_KEY_SYNC_TOKEN } from "@/lib/storage-keys";
import { resolveCycleStatus, persistCycles } from "@/features/minerwars/stores/cache";
import { getCurrentClanId } from "@/features/minerwars/api/clan";
import { invalidateStaleClanPerformanceCache } from "@/features/minerwars/utils/clan-performance";
import {
  fetchAvailableCycles,
  fetchMinerWarsComparison,
  getCachedCycles,
  getCachedMinerWarsComparison,
  invalidateCycleCache,
  prefetchAllCompletedCycles,
  syncMinerWarsSheet,
  type CycleInfo,
  type MinerWarsComparison,
} from "@/features/minerwars/utils/comparison";

interface UseMinerWarsComparisonResult {
  cycles: CycleInfo[];
  loadingCycles: boolean;
  selectedCycleId: number | null;
  setSelectedCycleId: (id: number) => void;
  data: MinerWarsComparison | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isLoggedIn: boolean;
}

interface UseMinerWarsComparisonOptions {
  cacheVersion?: number;
}

function getToken(): string {
  return sessionStorage.getItem(LOCAL_STORAGE_KEY_SYNC_TOKEN) ?? "";
}

function isTokenValid(token: string): boolean {
  if (!token) return false;
  const decoded = decodeJwt(token);
  return Boolean(decoded) && (decoded!.exp == null || Math.floor(Date.now() / 1000) < decoded!.exp);
}

/**
 * Owns the cycle list and selected-cycle comparison. Reads the cache on mount and cycle change,
 * hits the network only on explicit refresh or an empty cache, and tracks token expiry across tabs.
 */
export function useMinerWarsComparison({
  cacheVersion = 0,
}: UseMinerWarsComparisonOptions = {}): UseMinerWarsComparisonResult {
  const [cycles, setCycles] = useState<CycleInfo[]>([]);
  const [loadingCycles, setLoadingCycles] = useState(true);
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);
  const [data, setData] = useState<MinerWarsComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(() => isTokenValid(getToken()));

  useEffect(() => {
    const check = () => setIsLoggedIn(isTokenValid(getToken()));
    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  }, []);

  useEffect(() => {
    const handleExpired = () => setIsLoggedIn(false);
    window.addEventListener("rt:session-expired", handleExpired);
    return () => window.removeEventListener("rt:session-expired", handleExpired);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    const decoded = decodeJwt(getToken());
    if (decoded?.exp == null) return;
    const millisecondsUntilExpiry = decoded.exp * 1000 - Date.now() - 30_000;
    if (millisecondsUntilExpiry <= 0) {
      setIsLoggedIn(false);
      return;
    }
    const timer = setTimeout(() => setIsLoggedIn(false), millisecondsUntilExpiry);
    return () => clearTimeout(timer);
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn) return;
    const interval = setInterval(() => {
      if (isTokenValid(getToken())) setIsLoggedIn(true);
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  const reloadCycles = useCallback(async (): Promise<CycleInfo[]> => {
    const token = getToken();
    try {
      const list = await fetchAvailableCycles(token);
      setCycles(list);
      return list;
    } catch {
      if (!isTokenValid(token)) {
        setData(null);
        setError("Session expired");
      }
      setCycles([]);
      return [];
    }
  }, []);

  useEffect(() => {
    const cached = getCachedCycles();
    if (cached && cached.length > 0) {
      setCycles(cached);
      setSelectedCycleId(cached[0].cycleId);
    }
    setLoadingCycles(false);
  }, []);

  /** Network fetches only happen on an explicit refresh (skipCache=true). */
  const fetchComparison = useCallback((cycleId: number, skipCache = false): Promise<void> => {
    if (!skipCache) {
      const cached = getCachedMinerWarsComparison(cycleId);
      setData(cached);
      setError(null);
      setLoading(false);
      return Promise.resolve();
    }

    const token = getToken();
    if (!token || !isTokenValid(token)) {
      window.dispatchEvent(new CustomEvent("rt:session-expired"));
      setData(null);
      setLoading(false);
      return Promise.resolve();
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setData(null);
    setLoading(true);
    setError(null);

    return fetchMinerWarsComparison(token, cycleId, { forceRefresh: skipCache })
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((caughtError: unknown) => {
        if ((caughtError as { name?: string }).name === "AbortError") return;
        setData(null);
        setError(caughtError instanceof Error ? caughtError.message : "Unknown error");
        window.dispatchEvent(new CustomEvent("rt:fetch-failed"));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedCycleId === null) return;
    const cached = getCachedMinerWarsComparison(selectedCycleId);
    void fetchComparison(selectedCycleId, cached === null);
    return () => abortRef.current?.abort();
  }, [selectedCycleId, fetchComparison]);

  const refresh = useCallback(async () => {
    if (selectedCycleId === null) return;

    setLoading(true);
    const list = await reloadCycles().catch(() => []);

    const currentClanId = await getCurrentClanId(buildApiHeaders(getToken())).catch(() => null);
    if (currentClanId != null) invalidateStaleClanPerformanceCache(currentClanId);

    if (list.some((cycle) => cycle.status === "pending")) {
      const { newEntries } = await syncMinerWarsSheet(getToken()).catch(() => ({ newEntries: 0 }));
      if (newEntries > 0) {
        await prefetchAllCompletedCycles(getToken(), list).catch(() => {});

        const today = new Date().toISOString().slice(0, 10);
        const updatedList = list.map((cycle) => ({
          ...cycle,
          status: resolveCycleStatus(cycle.cycleEnd, today),
        }));
        setCycles(updatedList);
        persistCycles(updatedList);
      }
    }

    invalidateCycleCache(selectedCycleId);
    await fetchComparison(selectedCycleId, true);

    const warmList = getCachedCycles();
    if (warmList) {
      const MAX_WARM_CYCLES = 12;
      const toWarm = warmList
        .filter((cycle) => {
          if (cycle.cycleId === selectedCycleId) return false;
          if (cycle.status === "in-progress") return true;
          return getCachedMinerWarsComparison(cycle.cycleId) === null;
        })
        .slice(0, MAX_WARM_CYCLES);
      for (const cycle of toWarm) {
        void fetchMinerWarsComparison(getToken(), cycle.cycleId).catch(() => {});
      }
    }
  }, [selectedCycleId, reloadCycles, fetchComparison]);

  useEffect(() => {
    if (cacheVersion <= 0) return;
    const fresh = getCachedCycles();
    if (fresh !== null) setCycles(fresh);
    if (selectedCycleId === null) {
      if (fresh && fresh.length > 0) setSelectedCycleId(fresh[0].cycleId);
      setLoadingCycles(false);
      return;
    }
    const cached = getCachedMinerWarsComparison(selectedCycleId);
    void fetchComparison(selectedCycleId, cached === null);
  }, [cacheVersion, selectedCycleId, fetchComparison]);

  return {
    cycles,
    loadingCycles,
    selectedCycleId,
    setSelectedCycleId,
    data,
    loading,
    error,
    refresh,
    isLoggedIn,
  };
}
