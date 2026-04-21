import { useEffect } from "react";
import type { AuthUser } from "@/features/auth";
import { clearAllCacheEntries, loadAllCacheEntries } from "@/features/export/utils/cache";
import type { CacheState } from "@/features/export";
import { LS_KEY_EXPORT_CONFIG, LS_KEY_LAST_SYNC_USER } from "@/lib/storage-keys";

interface AccountSwitchOptions {
  user: AuthUser | null;
  resetConfig: () => void;
  setCache: (cache: CacheState) => void;
  setCacheVersion: (updater: (v: number) => number) => void;
  setMessage: (msg: string) => void;
}

// Clears cache and resets export config when a different account is detected on login.
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

    const lastUser = localStorage.getItem(LS_KEY_LAST_SYNC_USER);
    const hasStablePrefix = (v: string) => v.startsWith("id:") || v.startsWith("email:");
    const lastComparable = lastUser && hasStablePrefix(lastUser) ? lastUser : null;

    if (lastComparable && lastComparable !== currentUserIdentity) {
      clearAllCacheEntries();
      localStorage.removeItem(LS_KEY_EXPORT_CONFIG);
      resetConfig();
      setCache(loadAllCacheEntries());
      setCacheVersion((v) => v + 1);
      setMessage("Different account detected. Cache and export options were reset.");
    }

    localStorage.setItem(LS_KEY_LAST_SYNC_USER, currentUserIdentity);
  }, [currentUserIdentity, resetConfig, setCache, setCacheVersion, setMessage]);
}
