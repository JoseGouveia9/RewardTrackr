import { useCallback, useEffect, useRef, useState } from "react";
import { buildApiHeaders } from "@/lib/http";
import { LS_KEY_SYNC_TOKEN } from "@/lib/storage-keys";
import { getCurrentClanId } from "@/lib/minerwars/api";
import {
  fetchClanPerformance,
  getCachedClanPerformance,
  type ClanPerformance,
} from "@/lib/minerwars/clan-performance";
import type { CycleStatus } from "@/lib/minerwars/types";

interface UseClanPerformanceOptions {
  cycleId: number | null;
  cycleStatus: CycleStatus | undefined;
  cycleStart: string | undefined;
  cycleEnd: string | undefined;
  clanMinerWarsSats: number | null | undefined;
  // Only starts fetching once true — the Clan tab's data isn't needed until the user
  // actually opens it (or has opened it before this cycle selection).
  enabled: boolean;
}

interface UseClanPerformanceResult {
  data: ClanPerformance | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function getToken(): string {
  return sessionStorage.getItem(LS_KEY_SYNC_TOKEN) ?? "";
}

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
  // Toggling the Clan tab off/on re-runs the mount effect (via `enabled`); this guards
  // it from re-reading the (stale) cache over a manual refresh() still in flight.
  const manualRefreshRef = useRef(false);

  // Clan performance isn't available for completed cycles (needs historical TH/EE data
  // that only the live clan roster/leaderboard endpoints can provide).
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
      // Cache may be for a clan the user has since left; validate in the background and
      // refetch only if actually stale.
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
            .catch((err: unknown) => {
              if (!abortedRef.current)
                setError(err instanceof Error ? err.message : "Unknown error");
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
      .catch((err: unknown) => {
        if (abortedRef.current) return;
        setError(err instanceof Error ? err.message : "Unknown error");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      manualRefreshRef.current = false;
    }
  }, [cycleId, notAvailable, cycleStart, cycleEnd, clanMinerWarsSats]);

  return { data, loading, error, refresh };
}
