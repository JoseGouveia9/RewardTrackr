import { useMemo } from "react";
import { loadCacheEntry } from "@/lib/reward-cache";
import type { CacheEntry, RewardKey } from "@/types/rewards";

/**
 * Returns the override (shared profile data) when defined, otherwise the local cache entry;
 * re-reads on cacheVersion change.
 */
export function useCacheEntry(
  rewardKey: RewardKey,
  override: CacheEntry | null | undefined,
  cacheVersion: number,
) {
  return useMemo(() => {
    void cacheVersion;
    return override !== undefined ? override : loadCacheEntry(rewardKey);
  }, [rewardKey, cacheVersion, override]);
}
