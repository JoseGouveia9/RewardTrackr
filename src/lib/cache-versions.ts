import { clearMinerWarsCacheEntries, clearRecordsCacheEntries } from "./reward-cache";
import { invalidateMinerWarsCache } from "./minerwars/comparison";
import { LS_KEY_MINERWARS_VERSION, LS_KEY_RECORDS_VERSION } from "./storage-keys";

export const RECORDS_VERSION = 1;
export const MINERWARS_VERSION = 1;

function reconcileVersion(storageKey: string, current: number, onStale: () => void): boolean {
  let stored: string | null;
  try {
    stored = localStorage.getItem(storageKey);
  } catch {
    return false;
  }

  const next = String(current);
  if (stored === next) return false;

  const isFirstVisit = stored === null;
  if (!isFirstVisit) onStale();

  try {
    localStorage.setItem(storageKey, next);
  } catch {
    // ignore quota errors
  }

  return !isFirstVisit;
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
