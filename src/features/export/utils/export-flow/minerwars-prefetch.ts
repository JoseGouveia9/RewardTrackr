import i18n from "@/i18n";
import { buildApiHeaders } from "@/lib/http";
import {
  fetchAvailableCycles,
  fetchMinerWarsComparison,
  getCachedMinerWarsComparison,
  invalidateCycleCache,
  prefetchAllCompletedCycles,
} from "@/features/minerwars/utils/comparison";
import {
  fetchClanPerformance,
  invalidateStaleClanPerformanceCache,
} from "@/features/minerwars/utils/clan-performance";
import { getCurrentClanId } from "@/features/minerwars/api/clan";

interface PrefetchMinerWarsParameters {
  accessToken: string;
  disableLiveFetch?: boolean;
  onMessage: (message: string) => void;
  onPrefetchingChange?: (prefetching: boolean) => void;
}

/**
 * Warms the MinerWars caches (live cycle, clan performance, completed-cycle history) after a build.
 * Never throws: a prefetch failure must not abort the export.
 */
export async function prefetchMinerWarsData({
  accessToken,
  disableLiveFetch,
  onMessage,
  onPrefetchingChange,
}: PrefetchMinerWarsParameters): Promise<void> {
  try {
    onPrefetchingChange?.(true);
    onMessage(i18n.t("cycleTracker.computingIndividual"));
    const cycles = await fetchAvailableCycles(accessToken).catch(() => []);
    const liveOrPending = disableLiveFetch
      ? undefined
      : cycles.find((cycle) => cycle.status === "in-progress" || cycle.status === "pending");
    if (liveOrPending) {
      invalidateCycleCache(liveOrPending.cycleId);
      const comparison = await fetchMinerWarsComparison(accessToken, liveOrPending.cycleId).catch(
        () => null,
      );
      if (comparison) {
        onMessage(i18n.t("cycleTracker.computingClan"));
        await fetchClanPerformance(
          accessToken,
          liveOrPending.cycleId,
          comparison.cycleStart,
          comparison.cycleEnd,
          (comparison.clanMinerWarsSats ?? 0) / 1e8,
        ).catch(() => {});
      }
    }
    onMessage(i18n.t("cycleTracker.computingHistory"));
    const currentClanId = await getCurrentClanId(buildApiHeaders(accessToken)).catch(() => null);
    if (currentClanId != null) invalidateStaleClanPerformanceCache(currentClanId);
    let lastHistoryProgressTimestamp = 0;
    await prefetchAllCompletedCycles(accessToken, cycles, (done, total) => {
      const now = Date.now();
      if (done < total && now - lastHistoryProgressTimestamp < 250) return;
      lastHistoryProgressTimestamp = now;
      onMessage(i18n.t("cycleTracker.computingHistoryProgress", { done, total }));
    }).catch(() => {});
    const today = new Date().toISOString().slice(0, 10);
    const uncached = cycles.filter(
      (cycle) => cycle.cycleEnd < today && getCachedMinerWarsComparison(cycle.cycleId) === null,
    );
    for (const cycle of uncached) {
      await fetchMinerWarsComparison(accessToken, cycle.cycleId).catch(() => {});
    }
  } catch {
    if (!("hasMinerWarsHistory" in window)) {
      try {
        const raw = localStorage.getItem("mw-comparison-cache");
        if (raw && raw.length > 0) {
          onMessage(i18n.t("cycleTracker.computing"));
        }
        // eslint-disable-next-line no-empty
      } catch {}
    }
  } finally {
    onPrefetchingChange?.(false);
  }
}
