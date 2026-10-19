import type { CacheState, RewardKey } from "@/types/rewards";
import { buildOccurrenceIds } from "@/lib/row-ids";
import type { ExclusionRecord } from "@/features/records/components/share/hooks/use-share-exclusions";

/** Upgrades share the purchases tab, so their exclusions are stored under "purchases" */
export function toTabKey(key: RewardKey): RewardKey {
  return key === "upgrades" ? "purchases" : key;
}

/** New entries are auto-excluded only when the sheet already had exclusions */
export function buildEffectiveExclusions(
  exclusions: ExclusionRecord,
  availableSheets: RewardKey[],
  cache: CacheState,
): ExclusionRecord {
  const result = { ...exclusions };
  for (const rewardKey of availableSheets) {
    const entry = cache[rewardKey];
    if (!entry?.newEntriesCount) continue;
    const tabKey = toTabKey(rewardKey);
    const hasExistingExclusions = (result[tabKey] ?? []).some((id) =>
      id.startsWith(`${rewardKey}::`),
    );
    if (!hasExistingExclusions) continue;
    const existing = new Set(result[tabKey] ?? []);
    const ids = buildOccurrenceIds(entry.records, rewardKey);
    for (let index = 0; index < entry.newEntriesCount && index < entry.records.length; index++) {
      existing.add(ids[index]);
    }
    result[tabKey] = [...existing];
  }
  return result;
}

/** True when every record of the sheet is excluded; empty sheets are never considered excluded. */
export function isAllExcluded(
  cache: CacheState,
  effectiveExclusions: ExclusionRecord,
  key: RewardKey,
): boolean {
  const records = cache[key]?.records;
  if (!records || records.length === 0) return false;
  const excluded = new Set(effectiveExclusions[toTabKey(key)] ?? []);
  const ids = buildOccurrenceIds(records, key);
  return records.every((_, index) => excluded.has(ids[index]));
}

/** Seeds the filter modal by excluding every record of the sheets the user deselected. */
export function buildFilterInitialExclusions(
  effectiveExclusions: ExclusionRecord,
  availableSheets: RewardKey[],
  selectedKeys: Set<RewardKey>,
  cache: CacheState,
): ExclusionRecord {
  const result = { ...effectiveExclusions };
  for (const rewardKey of availableSheets) {
    if (selectedKeys.has(rewardKey)) continue;
    const tabKey = toTabKey(rewardKey);
    const ids = buildOccurrenceIds(cache[rewardKey]?.records ?? [], rewardKey);
    const existing = new Set(result[tabKey] ?? []);
    ids.forEach((id) => existing.add(id));
    result[tabKey] = [...existing];
  }
  return result;
}

/** Drops sheets the filter left fully excluded; never re-adds explicitly deselected sheets. */
export function reconcileSelectedKeys(
  previousKeys: Set<RewardKey>,
  availableSheets: RewardKey[],
  cache: CacheState,
  next: ExclusionRecord,
): Set<RewardKey> {
  const updated = new Set(previousKeys);
  for (const rewardKey of availableSheets) {
    if (!updated.has(rewardKey)) continue;
    const records = cache[rewardKey]?.records ?? [];
    if (!records.length) continue;
    const excluded = new Set(next[toTabKey(rewardKey)] ?? []);
    const ids = buildOccurrenceIds(records, rewardKey);
    const allExcluded = records.every((_, index) => excluded.has(ids[index]));
    if (allExcluded) updated.delete(rewardKey);
  }
  return updated;
}

/**
 * Applies exclusions to the cache so only the remaining records are published; untouched sheets
 * are reused as is.
 */
export function buildSheetsToPublish(
  sheetsToShare: RewardKey[],
  cache: CacheState,
  exclusions: ExclusionRecord,
): Partial<CacheState> {
  const sheets: Partial<CacheState> = {};
  for (const rewardKey of sheetsToShare) {
    const entry = cache[rewardKey];
    if (!entry) continue;
    const excluded = new Set(exclusions[toTabKey(rewardKey)] ?? []);
    const ids = buildOccurrenceIds(entry.records, rewardKey);
    const filtered = entry.records.filter((_, index) => !excluded.has(ids[index]));
    sheets[rewardKey] =
      filtered.length === entry.records.length
        ? entry
        : { ...entry, records: filtered, totalCount: filtered.length };
  }
  return sheets;
}
