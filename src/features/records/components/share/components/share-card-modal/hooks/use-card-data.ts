import { useCallback, useEffect, useMemo, useState } from "react";
import { loadCacheEntry } from "@/lib/reward-cache";
import { buildOccurrenceIds } from "@/lib/row-ids";
import { ALL_TABS } from "@/features/records";
import type { CacheState, RewardKey } from "@/types/rewards";
import { ALL_REWARD_KEYS } from "@/config/reward-configs";
import type { ExclusionRecord } from "@/features/records/components/share/hooks/use-share-exclusions";
import { computeMiningBreakdown, computeRewardsByCurrency, filterByDate } from "../utils/card-data";
import { SHEET_LABELS } from "../utils/constants";
import type { DateRange, SheetEntry } from "../types";

/**
 * Builds the share-card sheets from cached records, date-filtered first so exclusion ids match the filter modal.
 * Purchases and upgrades are merged into one sheet; mining tabs also get a pool reward/maintenance breakdown.
 */
export function useCardData(range: DateRange | null, exclusions: ExclusionRecord) {
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());

  const availableFiat = useMemo(() => {
    for (const rewardKey of ALL_REWARD_KEYS) {
      const entry = loadCacheEntry(rewardKey);
      if (entry?.extraFiatCurrency) return entry.extraFiatCurrency;
    }
    return null;
  }, []);

  const filteredCache = useMemo((): CacheState => {
    const result = {} as CacheState;
    for (const rewardKey of ALL_REWARD_KEYS) {
      const entry = loadCacheEntry(rewardKey);
      if (!entry) {
        result[rewardKey] = null;
        continue;
      }
      const filteredRecords = filterByDate(
        entry.records as unknown[],
        range,
      ) as typeof entry.records;
      result[rewardKey] = filteredRecords.length
        ? { ...entry, records: filteredRecords, totalCount: filteredRecords.length }
        : null;
    }
    return result;
  }, [range]);

  const availableSheets = useMemo(() => {
    return ALL_TABS.filter((tab) => {
      if (tab.key === "purchases") {
        const purchasesEntry = loadCacheEntry("purchases" as RewardKey);
        const upgradesEntry = loadCacheEntry("upgrades" as RewardKey);
        return (
          (purchasesEntry?.records?.length ?? 0) > 0 || (upgradesEntry?.records?.length ?? 0) > 0
        );
      }
      return (loadCacheEntry(tab.key as RewardKey)?.records?.length ?? 0) > 0;
    });
  }, []);

  const sheetsInPeriod = useMemo(() => {
    return new Set(
      availableSheets
        .filter((tab) => {
          if (tab.key === "purchases") {
            return !!(filteredCache["purchases"] || filteredCache["upgrades"]);
          }
          return !!filteredCache[tab.key as RewardKey];
        })
        .map((t) => t.key),
    );
  }, [availableSheets, filteredCache]);

  useEffect(() => {
    setSelectedSheets(new Set(sheetsInPeriod));
  }, [sheetsInPeriod]);

  const sheetData = useMemo((): SheetEntry[] => {
    return availableSheets
      .filter((tab) => selectedSheets.has(tab.key))
      .flatMap((tab) => {
        let records: unknown[];
        if (tab.key === "purchases") {
          const purchaseRecords = loadCacheEntry("purchases" as RewardKey)?.records ?? [];
          const upgradeRecords = loadCacheEntry("upgrades" as RewardKey)?.records ?? [];
          const dateFilteredPurchases = filterByDate(purchaseRecords, range);
          const dateFilteredUpgrades = filterByDate(upgradeRecords, range);
          const excludedSet = new Set(exclusions["purchases"] ?? []);
          const idsP = buildOccurrenceIds(dateFilteredPurchases, "purchases");
          const filteredPurchases = dateFilteredPurchases.filter(
            (_, index) => !excludedSet.has(idsP[index]),
          );
          const idsU = buildOccurrenceIds(dateFilteredUpgrades, "upgrades");
          const filteredUpgrades = dateFilteredUpgrades.filter(
            (_, index) => !excludedSet.has(idsU[index]),
          );
          records = [...filteredPurchases, ...filteredUpgrades];
        } else {
          const raw = loadCacheEntry(tab.key as RewardKey)?.records ?? [];
          const dateFilteredRaw = filterByDate(raw, range);
          const excludedSet = new Set(exclusions[tab.key as RewardKey] ?? []);
          const ids = buildOccurrenceIds(dateFilteredRaw, tab.key);
          records = dateFilteredRaw.filter((_, index) => !excludedSet.has(ids[index]));
        }
        if (!records.length) return [];
        const isMining = tab.key === "solo-mining" || tab.key === "minerwars";
        const rewards = computeRewardsByCurrency(records);
        const mining = isMining ? computeMiningBreakdown(records) : undefined;
        return [{ key: tab.key, label: SHEET_LABELS[tab.key] ?? tab.key, rewards, mining }];
      });
  }, [range, selectedSheets, availableSheets, exclusions]);

  const toggleSheet = useCallback((key: string) => {
    setSelectedSheets((previousSelection) => {
      const next = new Set(previousSelection);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return {
    availableFiat,
    filteredCache,
    availableSheets,
    sheetsInPeriod,
    selectedSheets,
    sheetData,
    toggleSheet,
  };
}
