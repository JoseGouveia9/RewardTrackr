import type { RewardRecord } from "@/types/rewards";

/**
 * Parses GoMining dates, which use a space instead of T, sub-ms precision and a "+00" suffix.
 * Returns NaN when the value is missing or unparseable.
 */
export function toEpoch(createdAt: string | undefined | null): number {
  if (!createdAt) return Number.NaN;
  const normalized = createdAt
    .trim()
    .replace(/^(\d{4}-\d{2}-\d{2})\s+/, "$1T")
    .replace(/(\.\d{3})\d+/, "$1")
    .replace(/\s*\+00(?::?00)?$/, "Z");
  return new Date(normalized).getTime();
}

export function latestRecordEpoch(records: RewardRecord[]): number {
  let latest = Number.NaN;
  for (const record of records) {
    const epoch = toEpoch(typeof record?.createdAt === "string" ? record.createdAt : null);
    if (!Number.isFinite(epoch)) continue;
    if (!Number.isFinite(latest) || epoch > latest) latest = epoch;
  }
  return latest;
}
