import { useState, useCallback } from "react";
import { LOCAL_STORAGE_KEY_SHARE_EXCLUSIONS } from "@/lib/storage-keys";
import type { RewardKey } from "@/types/rewards";

export type ExclusionRecord = Partial<Record<RewardKey, string[]>>;

/** Reads persisted exclusions, returning an empty record for missing or malformed data. */
function loadExclusions(): ExclusionRecord {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_SHARE_EXCLUSIONS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return parsed as ExclusionRecord;
  } catch {
    return {};
  }
}

function persistExclusions(map: ExclusionRecord): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_SHARE_EXCLUSIONS, JSON.stringify(map));
  } catch {
    return;
  }
}

/**
 * Excluded row ids per reward key, persisted to localStorage on every commit (write failures are
 * ignored).
 */
export function useShareExclusions() {
  const [exclusions, setExclusions] = useState<ExclusionRecord>(() => loadExclusions());

  const commitExclusions = useCallback((next: ExclusionRecord) => {
    setExclusions(next);
    persistExclusions(next);
  }, []);

  return { exclusions, commitExclusions };
}
