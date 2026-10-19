import type { RewardRecord } from "@/types/rewards";

/**
 * Row IDs keyed by createdAt occurrence (not array index) so share exclusions survive prepends and re-sorts.
 */
export function buildOccurrenceIds(
  records: readonly (RewardRecord | Record<string, unknown> | unknown)[],
  key: string,
): string[] {
  const counter = new Map<string, number>();
  return records.map((record) => {
    const createdAt = String((record as Record<string, unknown>).createdAt ?? "");
    const groupKey = `${key}::${createdAt}`;
    const occurrence = counter.get(groupKey) ?? 0;
    counter.set(groupKey, occurrence + 1);
    return `${key}::${createdAt}::${occurrence}`;
  });
}
