import { useCallback, useEffect, useRef, useState } from "react";
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
} from "@/lib/minerwars/comparison";

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
  const [isLoggedIn, setIsLoggedIn] = useState(() => isTokenValid(getToken()));

  // Cross-tab: storage event fires when another tab sets/removes the token
  useEffect(() => {
    const check = () => setIsLoggedIn(isTokenValid(getToken()));
    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  }, []);

  // Same-tab API 401: rt:session-expired is dispatched by postJson on unauthorized response
  useEffect(() => {
    const handleExpired = () => setIsLoggedIn(false);
    window.addEventListener("rt:session-expired", handleExpired);
    return () => window.removeEventListener("rt:session-expired", handleExpired);
  }, []);

  // Same-tab expiry: mirror useAuth's 30s-early logout so the button disappears
  // at the same time the user state is cleared.
  useEffect(() => {
    if (!isLoggedIn) return;
    const decoded = decodeJwt(getToken());
    if (decoded?.exp == null) return;
    const msUntilExpiry = decoded.exp * 1000 - Date.now() - 30_000;
    if (msUntilExpiry <= 0) {
      setIsLoggedIn(false);
      return;
    }
    const timer = setTimeout(() => setIsLoggedIn(false), msUntilExpiry);
    return () => clearTimeout(timer);
  }, [isLoggedIn]);

  // Same-tab token injection (e.g. from browser extension): match useAuth's 1s poll
  useEffect(() => {
    if (isLoggedIn) return;
    const interval = setInterval(() => {
      if (isTokenValid(getToken())) setIsLoggedIn(true);
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

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

  // On cycle change, read from cache. If the cache is empty (e.g. the background
  // prefetch failed or was skipped), fall back to a network fetch automatically
  // so the panel always populates without requiring a manual refresh.
  useEffect(() => {
    if (selectedCycleId === null) return;
    const cached = getCachedMinerWarsComparison(selectedCycleId);
    void fetchComparison(selectedCycleId, cached === null);
    return () => abortRef.current?.abort();
  }, [selectedCycleId, fetchComparison]);

  const refresh = useCallback(async () => {
    if (selectedCycleId === null) return;

    setLoading(true);
    await reloadCycles().catch(() => []);
    invalidateCycleCache(selectedCycleId);
    await fetchComparison(selectedCycleId, true);
  }, [selectedCycleId, reloadCycles, fetchComparison]);

  useEffect(() => {
    if (cacheVersion <= 0) return;
    // Re-read cycles from cache only — no status re-evaluation, no network call.
    // Status re-evaluation (withResolvedStatuses) only happens on explicit refresh
    // (refresh button) or build report (prefetchAllCompletedCycles), which persist
    // resolved statuses back via fetchAvailableCycles. This prevents a tab-seen
    // cacheVersion bump from silently flipping "in-progress" → "pending".
    const fresh = getCachedCycles();
    if (fresh !== null) setCycles(fresh);
    if (selectedCycleId === null) {
      if (fresh && fresh.length > 0) setSelectedCycleId(fresh[0].cycleId);
      setLoadingCycles(false);
      return;
    }
    const cached = getCachedMinerWarsComparison(selectedCycleId);
    void fetchComparison(selectedCycleId, cached === null);
  }, [cacheVersion, selectedCycleId, fetchComparison]); // reloadCycles intentionally excluded

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
