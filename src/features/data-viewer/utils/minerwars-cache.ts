import { LS_KEY_MW_COMPARISON, LS_KEY_MW_CYCLES, LS_KEY_REWARD_PREFIX } from "@/lib/storage-keys";
import { type CycleInfo, type MinerWarsComparison } from "../types/minerwars";

// Bump to force recomputation when the persisted comparison shape changes.
export const MW_COMPARISON_SCHEMA_VERSION = 2;

export type CyclesStoreEntry = { data: CycleInfo[]; ts: number };

export function loadPersistedCycles(): CyclesStoreEntry | null {
  try {
    const raw = localStorage.getItem(LS_KEY_MW_CYCLES);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data?: unknown; ts?: unknown };
    if (!Array.isArray(parsed.data) || typeof parsed.ts !== "number") return null;
    return { data: parsed.data as CycleInfo[], ts: parsed.ts };
  } catch {
    return null;
  }
}

export function persistCycles(data: CycleInfo[]): void {
  try {
    localStorage.setItem(LS_KEY_MW_CYCLES, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // ignore quota errors
  }
}

export function loadPersistedComparison(
  cycleId: number,
): { data: MinerWarsComparison; ts: number } | null {
  try {
    const raw = localStorage.getItem(LS_KEY_MW_COMPARISON);
    if (!raw) return null;
    const store = JSON.parse(raw) as Record<string, unknown>;
    const entry = store[String(cycleId)] as
      | { data?: unknown; ts?: unknown }
      | MinerWarsComparison
      | undefined;
    if (!entry || typeof entry !== "object") return null;

    // New format: { data, ts }
    if ("data" in entry && "ts" in entry && typeof (entry as { ts?: unknown }).ts === "number") {
      // Invalidate entries saved before schema version 2 (no historical price data)
      const v = (entry as { v?: unknown }).v;
      if ((v as number | undefined) !== MW_COMPARISON_SCHEMA_VERSION) return null;
      return {
        data: (entry as { data: MinerWarsComparison }).data,
        ts: (entry as { ts: number }).ts,
      };
    }

    // Legacy format migration: entry was the comparison object itself.
    const legacy = entry as MinerWarsComparison;
    if (typeof legacy.cycleId === "number" && typeof legacy.cycleStart === "string") {
      const migrated = { data: legacy, ts: Date.now() };
      store[String(cycleId)] = migrated;
      localStorage.setItem(LS_KEY_MW_COMPARISON, JSON.stringify(store));
      return migrated;
    }

    return null;
  } catch {
    return null;
  }
}

export function persistComparison(data: MinerWarsComparison): void {
  try {
    const raw = localStorage.getItem(LS_KEY_MW_COMPARISON);
    const store: Record<string, unknown> = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    store[String(data.cycleId)] = { data, ts: Date.now(), v: MW_COMPARISON_SCHEMA_VERSION };
    localStorage.setItem(LS_KEY_MW_COMPARISON, JSON.stringify(store));
  } catch {
    // ignore quota errors
  }
}

export function getActualIncomeFromBuildCache(paymentDayStr: string): number | null {
  try {
    const raw = localStorage.getItem(LS_KEY_REWARD_PREFIX + "minerwars");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { records?: Array<Record<string, unknown>> };
    if (!Array.isArray(parsed.records)) return null;
    const matches = parsed.records.filter(
      (r) =>
        typeof r.createdAt === "string" && (r.createdAt as string).slice(0, 10) === paymentDayStr,
    );
    if (matches.length === 0) return null;
    let total = 0;
    for (const r of matches) total += Number(r.poolReward ?? 0);
    return total;
  } catch {
    return null;
  }
}

// Reads enriched payment data from the build cache for a completed cycle.
// Uses stored BTC/GMT values to derive a historical price ratio (rule of three):
// if poolReward BTC = poolRewardGMT GMT, then X BTC = X * (poolRewardGMT / poolReward) GMT.
export function getPaymentDataFromBuildCache(paymentDayStr: string): {
  actualBtc: number;
  btcPrice: number | null;
  gmtPrice: number | null;
} | null {
  try {
    const raw = localStorage.getItem(LS_KEY_REWARD_PREFIX + "minerwars");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { records?: Array<Record<string, unknown>> };
    if (!Array.isArray(parsed.records)) return null;
    const matches = parsed.records.filter(
      (r) =>
        typeof r.createdAt === "string" && (r.createdAt as string).slice(0, 10) === paymentDayStr,
    );
    if (matches.length === 0) return null;

    let totalBtc = 0;
    let totalGmt = 0;
    let hasGmt = false;
    let btcPrice: number | null = null;

    for (const r of matches) {
      totalBtc += Number(r.poolReward ?? 0);
      if (r.poolRewardGMT != null) {
        totalGmt += Number(r.poolRewardGMT);
        hasGmt = true;
      }
      if (btcPrice === null && r.btcPriceAtTime != null) {
        btcPrice = Number(r.btcPriceAtTime);
      }
    }

    // Rule of three: store ratio directly as btcPrice=totalGmt / gmtPrice=totalBtc
    // so toGmt(btc) = btc × totalGmt / totalBtc with a single division (no floating-point drift)
    if (!hasGmt || totalBtc === 0) return { actualBtc: totalBtc, btcPrice: null, gmtPrice: null };
    return { actualBtc: totalBtc, btcPrice: totalGmt, gmtPrice: totalBtc };
  } catch {
    return null;
  }
}

// Derives solo-mining dates from the build-report localStorage cache, avoiding an extra API call.
// Solo income records have createdAt ~00:10 UTC the day AFTER the mining date.
export function getSoloDaysFromBuildCache(
  cycleStart: string,
  cycleEnd: string,
): Set<string> | null {
  try {
    const raw = localStorage.getItem(LS_KEY_REWARD_PREFIX + "solo-mining");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { records?: Array<Record<string, unknown>> };
    if (!Array.isArray(parsed.records)) return null;
    const dates = new Set<string>();
    for (const r of parsed.records) {
      if (typeof r.createdAt !== "string") continue;
      const dayBefore = new Date(r.createdAt as string);
      dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
      const miningDate = dayBefore.toISOString().slice(0, 10);
      if (miningDate >= cycleStart && miningDate <= cycleEnd) dates.add(miningDate);
    }
    return dates;
  } catch {
    return null;
  }
}

export function resolveCycleStatus(
  cycleEnd: string,
  today: string,
): import("../types/minerwars").CycleStatus {
  if (cycleEnd >= today) return "in-progress";
  const paymentDay = new Date(cycleEnd + "T00:00:00Z");
  paymentDay.setUTCDate(paymentDay.getUTCDate() + 1);
  const paymentDayStr = paymentDay.toISOString().slice(0, 10);
  return getActualIncomeFromBuildCache(paymentDayStr) !== null ? "completed" : "pending";
}

export function deletePersistedComparison(cycleId: number): void {
  try {
    const raw = localStorage.getItem(LS_KEY_MW_COMPARISON);
    if (!raw) return;
    const store = JSON.parse(raw) as Record<string, unknown>;
    delete store[String(cycleId)];
    localStorage.setItem(LS_KEY_MW_COMPARISON, JSON.stringify(store));
  } catch {
    // ignore
  }
}
