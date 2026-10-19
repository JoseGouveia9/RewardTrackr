import { useEffect } from "react";
import type { AuthUser } from "@/features/auth";
import { clearAllCacheEntries, loadAllCacheEntries } from "@/lib/reward-cache";
import type { CacheState } from "@/types/rewards";
import {
  LOCAL_STORAGE_KEY_EXPORT_CONFIG,
  LOCAL_STORAGE_KEY_LAST_SYNC_USER,
} from "@/lib/storage-keys";

interface AccountSwitchOptions {
  user: AuthUser | null;
  resetConfig: () => void;
  setCache: (cache: CacheState) => void;
  setCacheVersion: (updater: (version: number) => number) => void;
  setMessage: (message: string) => void;
}

/**
 * Detects a different logged-in account than the last synced one and wipes caches and export
 * options.
 */
export function useAccountSwitch({
  user,
  resetConfig,
  setCache,
  setCacheVersion,
  setMessage,
}: AccountSwitchOptions): void {
  const currentUserIdentity = user?.id
    ? `id:${user.id}`
    : user?.email
      ? `email:${String(user.email).toLowerCase()}`
      : null;

  useEffect(() => {
    if (!currentUserIdentity) return;

    const lastUser = localStorage.getItem(LOCAL_STORAGE_KEY_LAST_SYNC_USER);
    const hasStablePrefix = (identity: string) =>
      identity.startsWith("id:") || identity.startsWith("email:");
    const lastComparable = lastUser && hasStablePrefix(lastUser) ? lastUser : null;

    if (lastComparable && lastComparable !== currentUserIdentity) {
      clearAllCacheEntries();
      localStorage.removeItem(LOCAL_STORAGE_KEY_EXPORT_CONFIG);
      resetConfig();
      setCache(loadAllCacheEntries());
      setCacheVersion((version) => version + 1);
      setMessage("Different account detected. Cache and export options were reset.");
    }

    localStorage.setItem(LOCAL_STORAGE_KEY_LAST_SYNC_USER, currentUserIdentity);
  }, [currentUserIdentity, resetConfig, setCache, setCacheVersion, setMessage]);
}
