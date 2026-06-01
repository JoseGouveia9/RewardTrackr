import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { decodeJwt } from "@/lib/http";
import { LS_KEY_SYNC_TOKEN } from "@/lib/storage-keys";
import {
  fetchAvailableCycles,
  fetchMinerWarsComparison,
  getCachedCycles,
  getCachedMinerWarsComparison,
  invalidateCycleCache,
  type CycleInfo,
  type MinerWarsComparison,
} from "../api/minerwars-comparison";

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
  onRefreshMinerwarsTable?: () => Promise<void> | void;
}

function getToken(): string {
  return sessionStorage.getItem(LS_KEY_SYNC_TOKEN) ?? "";
}

function isTokenValid(token: string): boolean {
  if (!token) return false;
  const decoded = decodeJwt(token);
  return Boolean(decoded) && (decoded!.exp == null || Math.floor(Date.now() / 1000) < decoded!.exp);
}

export function useMinerWarsComparison({
  cacheVersion = 0,
  onRefreshMinerwarsTable,
}: UseMinerWarsComparisonOptions = {}): UseMinerWarsComparisonResult {
  const [cycles, setCycles] = useState<CycleInfo[]>([]);
  const [loadingCycles, setLoadingCycles] = useState(true);
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);
  const [data, setData] = useState<MinerWarsComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Computed once per mount — token doesn't change mid-session, and if it did
  // the user would see a network error on the next action anyway.
  const isLoggedIn = useMemo(() => isTokenValid(getToken()), []);

  const reloadCycles = useCallback(async (): Promise<CycleInfo[]> => {
    const token = getToken();
    // Always attempt fetchAvailableCycles — it reads localStorage cache first
    // and only hits the network when the cache is empty (requires a valid token).
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

  // Load available cycles from cache only — no API calls on initial load.
  // Cache is populated by build report / explicit refresh.
  useEffect(() => {
    const cached = getCachedCycles();
    if (cached && cached.length > 0) {
      setCycles(cached);
      setSelectedCycleId(cached[0].cycleId);
    }
    setLoadingCycles(false);
  }, []);

  // Re-evaluate cycle statuses at UTC midnight (GoMining operates on UTC time).
  // This ensures the status badge and refresh button update correctly without
  // requiring a page reload when the user is in a timezone ahead of UTC.
  useEffect(() => {
    const now = new Date();
    const nextUtcMidnight = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
    );
    const timer = setTimeout(() => {
      const refreshed = getCachedCycles();
      if (refreshed) setCycles(refreshed);
    }, nextUtcMidnight.getTime() - now.getTime());

    return () => clearTimeout(timer);
  }, []);

  // On cycle change, prefer cache; fall back to network only when cache is empty.
  // Pass skipCache=true (refresh button) to bypass the cache and force a live fetch.
  const fetchComparison = useCallback((cycleId: number, skipCache = false): Promise<void> => {
    // Always try cache first — works even when not logged in.
    if (!skipCache) {
      const cached = getCachedMinerWarsComparison(cycleId);
      if (cached) {
        setData(cached);
        setError(null);
        setLoading(false);
        return Promise.resolve();
      }
    }

    // Network required — validate token.
    const token = getToken();
    if (!token || !isTokenValid(token)) {
      setData(null);
      setError("Session expired");
      setLoading(false);
      return Promise.resolve();
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setData(null);
    setLoading(true);
    setError(null);

    return fetchMinerWarsComparison(token, cycleId)
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string }).name === "AbortError") return;
        setData(null);
        setError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedCycleId !== null) fetchComparison(selectedCycleId);
    return () => abortRef.current?.abort();
  }, [selectedCycleId, fetchComparison]);

  const refresh = useCallback(async () => {
    if (selectedCycleId === null) return;

    const selected = cycles.find((c) => c.cycleId === selectedCycleId);
    const today = new Date().toISOString().slice(0, 10);
    const cycleEnded = selected ? selected.cycleEnd < today : false;

    // If the cycle already ended, refresh the minerwars table first to check
    // whether the payment entry has landed, then recompute status/panel data.
    if (cycleEnded && onRefreshMinerwarsTable) {
      await onRefreshMinerwarsTable();
    }

    await reloadCycles().catch(() => []);
    invalidateCycleCache(selectedCycleId);
    await fetchComparison(selectedCycleId, true);
  }, [selectedCycleId, cycles, onRefreshMinerwarsTable, reloadCycles, fetchComparison]);

  useEffect(() => {
    if (cacheVersion <= 0 || selectedCycleId === null) return;
    const selected = cycles.find((c) => c.cycleId === selectedCycleId);
    if (!selected || selected.status !== "pending") return;

    reloadCycles()
      .then((nextCycles) => {
        const nextSelected = nextCycles.find((c) => c.cycleId === selectedCycleId);
        if (nextSelected?.status === "completed") {
          void fetchComparison(selectedCycleId);
        }
      })
      .catch(() => {
        /* ignore */
      });
  }, [cacheVersion, selectedCycleId, cycles, reloadCycles, fetchComparison]);

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
