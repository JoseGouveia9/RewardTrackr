import { useCallback, useEffect, useMemo, useState } from "react";
import { ALL_REWARD_KEYS } from "@/config/reward-configs";
import { reconcileCacheVersions } from "../utils/cache-versions";
import { loadAllCacheEntries } from "@/lib/reward-cache";
import { idbReady, setIdbItem } from "@/lib/idb-kv";
import { LOCAL_STORAGE_KEY_REWARD_PREFIX } from "@/lib/storage-keys";
import type { CacheState, RewardKey } from "@/types/rewards";

/**
 * Mirrors the localStorage reward cache in state; cacheVersion bumps on each change to trigger dependents.
 * Runs the cache version reconciliation on mount and flags when it wiped data.
 */
export function useCacheState(includeWalletFiat: boolean) {
  const [cache, setCache] = useState<CacheState>(() => loadAllCacheEntries());
  const [cacheVersion, setCacheVersion] = useState(0);
  const [dataVersionWiped, setDataVersionWiped] = useState(false);

  useEffect(() => {
    if (reconcileCacheVersions(includeWalletFiat)) {
      setCache(loadAllCacheEntries());
      setCacheVersion((version) => version + 1);
      setDataVersionWiped(true);
    }
  }, [includeWalletFiat]);

  // Re-read once the IndexedDB mirror hydrates, without bumping cacheVersion: that signal also
  // means "refetch over the network" to unrelated consumers (e.g. MinerWars comparison).
  useEffect(() => {
    let cancelled = false;
    void idbReady.then(() => {
      if (cancelled) return;
      setCache(loadAllCacheEntries());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCacheUpdate = useCallback((nextCache: CacheState) => {
    setCache(nextCache);
    setCacheVersion((version) => version + 1);
  }, []);

  const handleTabSeen = useCallback((key: RewardKey) => {
    setCache((previousCache) => {
      const entry = previousCache[key];
      if (!entry || (entry.newEntriesCount ?? 0) <= 0) return previousCache;
      const nextEntry = { ...entry, newEntriesCount: 0 };
      try {
        setIdbItem(LOCAL_STORAGE_KEY_REWARD_PREFIX + key, JSON.stringify(nextEntry));
        // eslint-disable-next-line no-empty
      } catch {}
      return { ...previousCache, [key]: nextEntry };
    });
    setCacheVersion((version) => version + 1);
  }, []);

  const hasCachedSheets = useMemo(
    () => ALL_REWARD_KEYS.some((key) => cache[key] !== null),
    [cache],
  );

  const hasNewRecords = useMemo(() => {
    const purchasesNew =
      (cache["purchases"]?.newEntriesCount ?? 0) + (cache["upgrades"]?.newEntriesCount ?? 0);
    return (
      (cache["solo-mining"]?.newEntriesCount ?? 0) > 0 ||
      (cache["minerwars"]?.newEntriesCount ?? 0) > 0 ||
      (cache["bounty"]?.newEntriesCount ?? 0) > 0 ||
      (cache["referrals"]?.newEntriesCount ?? 0) > 0 ||
      (cache["ambassador"]?.newEntriesCount ?? 0) > 0 ||
      (cache["deposits"]?.newEntriesCount ?? 0) > 0 ||
      (cache["withdrawals"]?.newEntriesCount ?? 0) > 0 ||
      purchasesNew > 0 ||
      (cache["simple-earn"]?.newEntriesCount ?? 0) > 0 ||
      (cache["transactions"]?.newEntriesCount ?? 0) > 0
    );
  }, [cache]);

  return {
    cache,
    cacheVersion,
    dataVersionWiped,
    setCache,
    setCacheVersion,
    handleCacheUpdate,
    handleTabSeen,
    hasCachedSheets,
    hasNewRecords,
  };
}
