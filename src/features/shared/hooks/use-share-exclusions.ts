import { useState, useCallback } from "react";
import { LS_KEY_SHARE_EXCLUSIONS } from "@/lib/storage-keys";
import type { RewardKey } from "@/features/export/types";

export type ExclusionRecord = Partial<Record<RewardKey, string[]>>;

function loadExclusions(): ExclusionRecord {
  try {
    const raw = localStorage.getItem(LS_KEY_SHARE_EXCLUSIONS);
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
    localStorage.setItem(LS_KEY_SHARE_EXCLUSIONS, JSON.stringify(map));
  } catch {
    // storage write failure is non-fatal
  }
}

export function useShareExclusions() {
  const [exclusions, setExclusions] = useState<ExclusionRecord>(() => loadExclusions());

  const commitExclusions = useCallback((next: ExclusionRecord) => {
    setExclusions(next);
    persistExclusions(next);
  }, []);

  return { exclusions, commitExclusions };
}
