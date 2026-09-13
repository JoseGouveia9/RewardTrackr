import { clearMinerWarsCacheEntries, clearRecordsCacheEntries } from "./reward-cache";
import { invalidateMinerWarsCache } from "./minerwars/comparison";
import {
  LS_KEY_LAST_SYNC_USER,
  LS_KEY_MINERWARS_VERSION,
  LS_KEY_RECORDS_VERSION,
  LS_KEY_SYNC_ALIAS,
} from "./storage-keys";

export const RECORDS_VERSION = 1;
// Bumped: the v1->unsuffixed MinerWars key rename orphaned existing users' data
// without ever routing them through the wipe+auto-resync flow below, since a
// missing version key was (wrongly) treated as "nothing to reconcile".
export const MINERWARS_VERSION = 2;

// A version key that has never been set only means "nothing to reconcile" for
// users who have never synced before; an already-synced user can still be missing
// the key (e.g. it was introduced after they last visited), so treat those as stale too.
function hasSyncedBefore(): boolean {
  try {
    return (
      !!localStorage.getItem(LS_KEY_SYNC_ALIAS) || !!localStorage.getItem(LS_KEY_LAST_SYNC_USER)
    );
  } catch {
    return false;
  }
}

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
  } catch {
    // ignore quota errors
  }

  return !isNewInstall;
}

export function reconcileCacheVersions(): boolean {
  const recordsWiped = reconcileVersion(LS_KEY_RECORDS_VERSION, RECORDS_VERSION, () => {
    clearRecordsCacheEntries();
  });
  const minerwarsWiped = reconcileVersion(LS_KEY_MINERWARS_VERSION, MINERWARS_VERSION, () => {
    clearMinerWarsCacheEntries();
    invalidateMinerWarsCache();
  });
  return recordsWiped || minerwarsWiped;
}
