import { useCallback, useEffect, useRef, useState } from "react";
import { buildApiHeaders } from "@/lib/http";
import { LOCAL_STORAGE_KEY_SYNC_TOKEN } from "@/lib/storage-keys";
import { getCurrentClanId } from "@/features/minerwars/api/clan";
import {
  fetchClanPerformance,
  getCachedClanPerformance,
  type ClanPerformance,
} from "@/features/minerwars/utils/clan-performance";
import type { CycleStatus } from "@/features/minerwars/types";

interface UseClanPerformanceOptions {
  cycleId: number | null;
  cycleStatus: CycleStatus | undefined;
  cycleStart: string | undefined;
  cycleEnd: string | undefined;
  clanMinerWarsSats: number | null | undefined;
  enabled: boolean;
}

interface UseClanPerformanceResult {
  data: ClanPerformance | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function getToken(): string {
  return sessionStorage.getItem(LOCAL_STORAGE_KEY_SYNC_TOKEN) ?? "";
}

/**
 * Loads clan performance for a live cycle once `enabled`: cache first, refetching only when
 * the cached clan is no longer the user's. Completed cycles are not supported.
 */
export function useClanPerformance({
  cycleId,
  cycleStatus,
  cycleStart,
  cycleEnd,
  clanMinerWarsSats,
  enabled,
}: UseClanPerformanceOptions): UseClanPerformanceResult {
  const [data, setData] = useState<ClanPerformance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortedRef = useRef(false);
  const manualRefreshRef = useRef(false);

  const notAvailable = cycleStatus === "completed";

  useEffect(() => {
    abortedRef.current = false;
    if (!enabled || cycleId == null || notAvailable || !cycleStart || !cycleEnd) {
      if (notAvailable) setData(null);
      return;
    }
    if (manualRefreshRef.current) return;

    const cached = getCachedClanPerformance(cycleId);
    setData(cached);
    setError(null);

    const token = getToken();
    if (!token) return;

    if (cached) {
      getCurrentClanId(buildApiHeaders(token))
        .then((currentClanId) => {
          if (abortedRef.current) return;
          if (currentClanId == null || currentClanId === cached.header.clanId) return;
          setLoading(true);
          return fetchClanPerformance(
            token,
            cycleId,
            cycleStart,
            cycleEnd,
            (clanMinerWarsSats ?? 0) / 1e8,
            { forceRefresh: true },
          )
            .then((result) => {
              if (!abortedRef.current) setData(result);
            })
            .catch((caughtError: unknown) => {
              if (!abortedRef.current)
                setError(caughtError instanceof Error ? caughtError.message : "Unknown error");
            })
            .finally(() => {
              if (!abortedRef.current) setLoading(false);
            });
        })
        .catch(() => {});
      return;
    }

    setLoading(true);
    fetchClanPerformance(token, cycleId, cycleStart, cycleEnd, (clanMinerWarsSats ?? 0) / 1e8)
      .then((result) => {
        if (abortedRef.current) return;
        setData(result);
      })
      .catch((caughtError: unknown) => {
        if (abortedRef.current) return;
        setError(caughtError instanceof Error ? caughtError.message : "Unknown error");
      })
      .finally(() => {
        if (abortedRef.current) return;
        setLoading(false);
      });

    return () => {
      abortedRef.current = true;
    };
  }, [enabled, cycleId, notAvailable, cycleStart, cycleEnd, clanMinerWarsSats]);

  const refresh = useCallback(async (): Promise<void> => {
    if (cycleId == null || notAvailable || !cycleStart || !cycleEnd) return;
    const token = getToken();
    if (!token) return;
    manualRefreshRef.current = true;
    setData(null);
    setLoading(true);
    setError(null);
    try {
      const result = await fetchClanPerformance(
        token,
        cycleId,
        cycleStart,
        cycleEnd,
        (clanMinerWarsSats ?? 0) / 1e8,
        { forceRefresh: true },
      );
      setData(result);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unknown error");
    } finally {
      setLoading(false);
      manualRefreshRef.current = false;
    }
  }, [cycleId, notAvailable, cycleStart, cycleEnd, clanMinerWarsSats]);

  return { data, loading, error, refresh };
}
