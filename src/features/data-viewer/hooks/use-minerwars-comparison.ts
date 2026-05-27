import { useCallback, useEffect, useRef, useState } from "react";
import { decodeJwt } from "@/lib/http";
import { LS_KEY_SYNC_TOKEN } from "@/lib/storage-keys";
import {
  fetchAvailableCycles,
  fetchMinerWarsComparison,
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
}

interface UseMinerWarsComparisonOptions {
  cacheVersion?: number;
  onRefreshMinerwarsTable?: () => Promise<void> | void;
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

  const getToken = () => sessionStorage.getItem(LS_KEY_SYNC_TOKEN) ?? "";
  const isTokenExpired = (token: string): boolean => {
    const decoded = decodeJwt(token);
    return !decoded || (decoded.exp != null && Math.floor(Date.now() / 1000) >= decoded.exp);
  };

  const reloadCycles = useCallback(async (): Promise<CycleInfo[]> => {
    const token = getToken();
    if (!token || isTokenExpired(token)) {
      setCycles([]);
      setData(null);
      setError("Session expired");
      return [];
    }
    const list = await fetchAvailableCycles(token);
    setCycles(list);
    return list;
  }, []);

  // Step 1: load available cycles once
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoadingCycles(false);
      return;
    }
    setLoadingCycles(true);
    reloadCycles()
      .then((list) => {
        if (list.length > 0) setSelectedCycleId(list[0].cycleId);
      })
      .catch(() => {
        /* silently ignore */
      })
      .finally(() => setLoadingCycles(false));
  }, [reloadCycles]);

  // Step 2: on cycle change, read comparison from cache only (no network).
  // Network fetches are reserved for explicit refresh/build flows.
  const fetchComparison = useCallback((cycleId: number, allowNetwork = false): Promise<void> => {
    const token = getToken();
    if (!token || isTokenExpired(token)) {
      setData(null);
      setError("Session expired");
      setLoading(false);
      return Promise.resolve();
    }

    if (!allowNetwork) {
      const cached = getCachedMinerWarsComparison(cycleId);
      if (cached) {
        setData(cached);
        setError(null);
        setLoading(false);
        return Promise.resolve();
      }
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
    if (selectedCycleId !== null) fetchComparison(selectedCycleId, false);
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
          void fetchComparison(selectedCycleId, false);
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
  };
}
