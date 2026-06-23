import type { RewardRecord } from "@/types/rewards";

/**
 * Build position-independent row IDs for a record array.
 * Format: `${key}::${createdAt}::${occ}` where `occ` is the 0-based occurrence of
 * that createdAt among records sharing the same key. This stays stable when new
 * entries are prepended on fetch or the list is re-sorted (unlike an absolute
 * array index), so share exclusions keep matching the same records across fetches.
 */
export function buildOccurrenceIds(
  records: readonly (RewardRecord | Record<string, unknown> | unknown)[],
  key: string,
): string[] {
  const counter = new Map<string, number>();
  return records.map((rec) => {
    const createdAt = String((rec as Record<string, unknown>).createdAt ?? "");
    const groupKey = `${key}::${createdAt}`;
    const occ = counter.get(groupKey) ?? 0;
    counter.set(groupKey, occ + 1);
    return `${key}::${createdAt}::${occ}`;
  });
}
