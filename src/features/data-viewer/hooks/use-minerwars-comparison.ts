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
}: UseMinerWarsComparisonOptions = {}): UseMinerWarsComparisonResult {
  const [cycles, setCycles] = useState<CycleInfo[]>([]);
  const [loadingCycles, setLoadingCycles] = useState(true);
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);
  const [data, setData] = useState<MinerWarsComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Ref mirror of cycles — lets effects read the latest value without adding
  // cycles as a dependency (which would cause infinite loops when reloadCycles
  // calls setCycles inside those same effects).
  const cyclesRef = useRef<CycleInfo[]>(cycles);
  useEffect(() => {
    cyclesRef.current = cycles;
  }, [cycles]);

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

  // On cycle change, read from cache only. Network fetches are allowed only
  // when skipCache=true (explicit refresh action).
  const fetchComparison = useCallback((cycleId: number, skipCache = false): Promise<void> => {
    // Default path: cache-only (no API calls on cycle switch).
    if (!skipCache) {
      const cached = getCachedMinerWarsComparison(cycleId);
      setData(cached);
      setError(null);
      setLoading(false);
      return Promise.resolve();
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

    await reloadCycles().catch(() => []);
    invalidateCycleCache(selectedCycleId);
    await fetchComparison(selectedCycleId, true);
  }, [selectedCycleId, reloadCycles, fetchComparison]);

  useEffect(() => {
    if (cacheVersion <= 0 || selectedCycleId === null) return;
    // Use ref instead of cycles state — adding cycles here would cause an infinite
    // loop: reloadCycles() → setCycles() → cycles changes → effect re-runs → repeat.
    const selected = cyclesRef.current.find((c) => c.cycleId === selectedCycleId);
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
  }, [cacheVersion, selectedCycleId, reloadCycles, fetchComparison]);

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
