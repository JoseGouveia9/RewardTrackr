import { clearMinerWarsCacheEntries, clearRecordsCacheEntries } from "@/lib/reward-cache";
import { invalidateMinerWarsCache } from "@/features/minerwars/utils/comparison";
import {
  LOCAL_STORAGE_KEY_LAST_SYNC_USER,
  LOCAL_STORAGE_KEY_MINERWARS_VERSION,
  LOCAL_STORAGE_KEY_RECORDS_VERSION,
  LOCAL_STORAGE_KEY_SYNC_ALIAS,
} from "@/lib/storage-keys";

const RECORDS_VERSION = 3;
const MINERWARS_VERSION = 3;

/** A never-set version key is only "nothing to reconcile" for users who never synced before. */
function hasSyncedBefore(): boolean {
  try {
    return (
      !!localStorage.getItem(LOCAL_STORAGE_KEY_SYNC_ALIAS) ||
      !!localStorage.getItem(LOCAL_STORAGE_KEY_LAST_SYNC_USER)
    );
  } catch {
    return false;
  }
}

/**
 * Compares the stored version to the current one and runs onStale unless this is a fresh install;
 * true if stale.
 */
function reconcileVersion(storageKey: string, current: number, onStale: () => void): boolean {
  let stored: string | null;
  try {
    stored = localStorage.getItem(storageKey);
  } catch {
    return false;
  }

  const next = String(current);
  if (stored === next) return false;

  const isNewInstall = stored === null && !hasSyncedBefore();
  if (!isNewInstall) onStale();

  try {
    localStorage.setItem(storageKey, next);
    // eslint-disable-next-line no-empty
  } catch {}

  return !isNewInstall;
}

/**
 * Wipes caches whose version constant was bumped (forcing a resync after calculation changes);
 * true if any were wiped.
 */
export function reconcileCacheVersions(): boolean {
  const recordsWiped = reconcileVersion(LOCAL_STORAGE_KEY_RECORDS_VERSION, RECORDS_VERSION, () => {
    clearRecordsCacheEntries();
  });
  const minerwarsWiped = reconcileVersion(
    LOCAL_STORAGE_KEY_MINERWARS_VERSION,
    MINERWARS_VERSION,
    () => {
      clearMinerWarsCacheEntries();
      invalidateMinerWarsCache();
    },
  );
  return recordsWiped || minerwarsWiped;
}
