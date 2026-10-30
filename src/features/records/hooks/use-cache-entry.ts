import { useMemo } from "react";
import { loadCacheEntry } from "@/lib/reward-cache";
import { useIdbHydrated } from "@/hooks/use-idb-hydrated";
import type { CacheEntry, RewardKey } from "@/types/rewards";

/**
 * Returns the override (shared profile data) when defined, otherwise the local cache entry;
 * re-reads on cacheVersion change, and once more after IndexedDB hydration finishes.
 */
export function useCacheEntry(
  rewardKey: RewardKey,
  override: CacheEntry | null | undefined,
  cacheVersion: number,
) {
  const idbHydrated = useIdbHydrated();
  return useMemo(() => {
    void cacheVersion;
    void idbHydrated;
    return override !== undefined ? override : loadCacheEntry(rewardKey);
  }, [rewardKey, cacheVersion, override, idbHydrated]);
}
