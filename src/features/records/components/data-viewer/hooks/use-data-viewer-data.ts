import { useMemo } from "react";
import { loadCacheEntry } from "@/lib/reward-cache";
import { userHasMinerWarsHistory } from "@/features/minerwars/utils/comparison";
import type { CacheEntry, CacheState, RewardKey } from "@/types/rewards";
import type { Currency, TabDef } from "@/features/records/types";
import { ALL_TABS } from "@/features/records/utils/constants";
import type { RecordsViewInfo } from "../utils/view-options";

type SharedData = Partial<CacheState> | null | undefined;

const EMPTY_INFO: RecordsViewInfo = { currencies: [], hasUsd: false, hasFiat: false };

const readEntry = (sharedData: SharedData, key: RewardKey): CacheEntry | null | undefined =>
  sharedData ? sharedData[key] : loadCacheEntry(key);

const hasRecords = (entry: CacheEntry | null | undefined) => (entry?.records?.length ?? 0) > 0;

/**
 * Tabs to show; MinerWars only appears with history. In shared profiles, tabs without records are hidden
 * unless that would leave none.
 */
export function useVisibleTabs(
  cacheVersion: number,
  isFetching: boolean,
  sharedData: SharedData,
): TabDef[] {
  const isSharedContext = sharedData !== null && sharedData !== undefined;
  return useMemo(() => {
    void cacheVersion;
    const baseTabs = userHasMinerWarsHistory()
      ? ALL_TABS
      : ALL_TABS.filter((tab) => tab.key !== "minerwars");

    if (!isSharedContext || isFetching) return baseTabs;

    const filtered = baseTabs.filter((tab) =>
      tab.key === "purchases"
        ? hasRecords(sharedData?.["purchases"]) || hasRecords(sharedData?.["upgrades"])
        : hasRecords(sharedData?.[tab.key]),
    );

    return filtered.length > 0 ? filtered : baseTabs;
  }, [cacheVersion, isFetching, isSharedContext, sharedData]);
}

/**
 * Scans the active tab's records for currencies and whether any USD/fiat values exist (drives
 * view selectors).
 */
export function useRecordsViewInfo(
  activeKey: RewardKey,
  enabled: boolean,
  cacheVersion: number,
  sharedData: SharedData,
): RecordsViewInfo {
  return useMemo(() => {
    void cacheVersion;
    if (!enabled) return EMPTY_INFO;
    const entry = readEntry(sharedData, activeKey);
    if (!entry?.records?.length) return EMPTY_INFO;
    const currencies = new Set<string>();
    let hasUsd = false;
    let hasFiat = false;
    for (const entryRecord of entry.records) {
      const record = entryRecord as Record<string, unknown>;
      const currency = String(record.currency ?? "");
      if (currency) currencies.add(currency);
      if (Number(record.rewardInUSD ?? record.rewardInUsd ?? 0) !== 0) hasUsd = true;
      if (Number(record.rewardInFiat ?? 0) !== 0) hasFiat = true;
    }
    return { currencies: [...currencies], hasUsd, hasFiat };
  }, [activeKey, enabled, cacheVersion, sharedData]);
}

/**
 * Trends need btcPriceAtTime (MinerWars, non-BTC currency) or satsPerTh (solo mining) on at least
 * one record.
 */
export function useHasTrendsData(
  activeKey: RewardKey,
  currency: Currency,
  cacheVersion: number,
  sharedData: SharedData,
) {
  return useMemo(() => {
    void cacheVersion;
    if (activeKey === "minerwars") {
      if (currency === "BTC") return false;
      const entry = readEntry(sharedData, "minerwars");
      if (!entry?.records?.length) return false;
      return (entry.records as Record<string, unknown>[]).some(
        (record) => record.btcPriceAtTime != null,
      );
    }
    const entry = readEntry(sharedData, "solo-mining");
    if (!entry?.records?.length) return false;
    return (entry.records as Record<string, unknown>[]).some((record) => record.satsPerTh != null);
  }, [activeKey, currency, cacheVersion, sharedData]);
}

/**
 * Tabs holding unseen entries; purchases and upgrades are summed, and shared profiles never flag.
 */
export function useTabsWithNew(cacheVersion: number, sharedData: SharedData) {
  return useMemo(() => {
    const flagged = new Set<RewardKey>();
    if (sharedData) return flagged;
    void cacheVersion;
    for (const tab of ALL_TABS) {
      const count =
        tab.key === "purchases"
          ? (loadCacheEntry("purchases")?.newEntriesCount ?? 0) +
            (loadCacheEntry("upgrades")?.newEntriesCount ?? 0)
          : (loadCacheEntry(tab.key)?.newEntriesCount ?? 0);
      if (count > 0) flagged.add(tab.key);
    }
    return flagged;
  }, [cacheVersion, sharedData]);
}

export function useHasActiveData(
  activeKey: RewardKey,
  isPurchaseTab: boolean,
  cacheVersion: number,
  sharedData: SharedData,
) {
  return useMemo(() => {
    void cacheVersion;
    if (isPurchaseTab) {
      return (
        hasRecords(readEntry(sharedData, "purchases")) ||
        hasRecords(readEntry(sharedData, "upgrades"))
      );
    }
    return hasRecords(readEntry(sharedData, activeKey));
  }, [activeKey, cacheVersion, isPurchaseTab, sharedData]);
}
