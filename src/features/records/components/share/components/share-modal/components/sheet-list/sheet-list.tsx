import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import type { CacheState, RewardKey } from "@/types/rewards";
import { formatAge } from "@/lib/reward-cache";
import { buildOccurrenceIds } from "@/lib/row-ids";
import type { ExclusionRecord } from "@/features/records/components/share/hooks/use-share-exclusions";
import { CheckIcon } from "@/components/icons";
import { isAllExcluded, toTabKey } from "../../utils/exclusions";

const SHEET_I18N_KEY: Record<string, string> = {
  "solo-mining": "tabs.soloMining",
  minerwars: "tabs.minerWars",
  bounty: "tabs.bounties",
  referrals: "tabs.referrals",
  ambassador: "tabs.ambassador",
  deposits: "tabs.deposits",
  withdrawals: "tabs.withdrawals",
  purchases: "export.sheetPurchases",
  upgrades: "export.sheetUpgrades",
  transactions: "tabs.transactions",
  "simple-earn": "tabs.simpleEarn",
};

export function SheetList({
  cache,
  availableSheets,
  selectedKeys,
  setSelectedKeys,
  exclusions,
  effectiveExclusions,
  commitExclusions,
  disabled,
}: {
  cache: CacheState;
  availableSheets: RewardKey[];
  selectedKeys: Set<RewardKey>;
  setSelectedKeys: Dispatch<SetStateAction<Set<RewardKey>>>;
  exclusions: ExclusionRecord;
  effectiveExclusions: ExclusionRecord;
  commitExclusions: (next: ExclusionRecord) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="share-modal-sheet-list">
      {availableSheets
        .filter((rewardKey) => !(rewardKey === "upgrades" && availableSheets.includes("purchases")))
        .map((rewardKey) => {
          const isCombo = rewardKey === "purchases" && availableSheets.includes("upgrades");
          const comboKeys: RewardKey[] = isCombo ? ["purchases", "upgrades"] : [rewardKey];
          const allExcluded = comboKeys.every((comboKey) =>
            isAllExcluded(cache, effectiveExclusions, comboKey),
          );
          const checked = comboKeys.some((comboKey) => selectedKeys.has(comboKey)) && !allExcluded;
          const totalRecords = comboKeys.reduce(
            (sum, comboKey) => sum + (cache[comboKey]?.records.length ?? 0),
            0,
          );
          const excludedCount = comboKeys.reduce((sum, comboKey) => {
            const excludedSet = new Set(effectiveExclusions[toTabKey(comboKey)] ?? []);
            const ckRecords = cache[comboKey]?.records ?? [];
            const ids = buildOccurrenceIds(ckRecords, comboKey);
            return sum + ckRecords.filter((_, index) => excludedSet.has(ids[index])).length;
          }, 0);
          const visibleCount = totalRecords - excludedCount;
          const label = isCombo
            ? t("tabs.purchasesUpgrades")
            : t(SHEET_I18N_KEY[rewardKey] ?? "", { defaultValue: cache[rewardKey]!.sheetName });
          const fetchedAt = cache[rewardKey]?.fetchedAt ?? 0;
          return (
            <button
              key={rewardKey}
              type="button"
              className={`share-modal-sheet-row share-modal-sheet-row--check${checked ? " share-modal-sheet-row--checked" : ""}`}
              onClick={() => {
                if (allExcluded) {
                  const next = { ...exclusions };
                  for (const comboKey of comboKeys) {
                    const tabKey = toTabKey(comboKey);
                    const remaining = (next[tabKey] ?? []).filter(
                      (id) => !id.startsWith(`${comboKey}::`),
                    );
                    if (remaining.length === 0) delete next[tabKey];
                    else next[tabKey] = remaining;
                  }
                  commitExclusions(next);
                  setSelectedKeys((previousKeys) => {
                    const updatedKeys = new Set(previousKeys);
                    comboKeys.forEach((comboKey) => updatedKeys.add(comboKey));
                    return updatedKeys;
                  });
                } else {
                  setSelectedKeys((previousKeys) => {
                    const updatedKeys = new Set(previousKeys);
                    const willDeselect = comboKeys.some((comboKey) => updatedKeys.has(comboKey));
                    if (willDeselect) comboKeys.forEach((comboKey) => updatedKeys.delete(comboKey));
                    else comboKeys.forEach((comboKey) => updatedKeys.add(comboKey));
                    return updatedKeys;
                  });
                }
              }}
              disabled={disabled}
              aria-pressed={checked}
            >
              <span
                className={`sheet-check-icon${checked ? " sheet-check-icon--visible" : ""}`}
                aria-hidden="true"
              >
                <CheckIcon />
              </span>
              <span className="share-modal-sheet-name">{label}</span>
              <span className="share-modal-sheet-meta">
                {checked
                  ? `${visibleCount}/${totalRecords} ${t("common.records").toLowerCase()}`
                  : `0/${totalRecords} ${t("common.records").toLowerCase()}`}{" "}
                · {formatAge(fetchedAt)}
              </span>
            </button>
          );
        })}
    </div>
  );
}
