import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { REWARD_GROUPS } from "@/config/reward-configs";
import "./sheet-selector.css";
import { formatAge } from "@/lib/reward-cache";
import type { CacheState, RewardGroup } from "@/types/rewards";
import { CheckIcon, ClockIcon } from "@/components/icons";

interface SheetSelectorProps {
  cache: CacheState;
  onToggleGroup: (group: RewardGroup) => void;
  onToggleAll: () => void;
  isGroupSelected: (group: RewardGroup) => boolean;
}

export const SheetSelector = memo(function SheetSelector({
  cache,
  onToggleGroup,
  onToggleAll,
  isGroupSelected,
}: SheetSelectorProps) {
  const { t } = useTranslation();
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const totalGroupCount = REWARD_GROUPS.length;
  const selectedGroupCount = REWARD_GROUPS.filter((group) => isGroupSelected(group)).length;
  const allSelected = selectedGroupCount === totalGroupCount;

  return (
    <div className="sheet-selector">
      <button
        type="button"
        className={`sheet-card sheet-card-all${allSelected ? " sheet-card--selected" : ""}`}
        onClick={onToggleAll}
        aria-pressed={allSelected}
      >
        <div className="sheet-card-top">
          <span className="sheet-title">{t("export.selectAll")}</span>
          <span
            className={`sheet-check-icon${allSelected ? " sheet-check-icon--visible" : ""}`}
            aria-hidden="true"
          >
            <CheckIcon />
          </span>
        </div>
        <span className="sheet-meta">
          {t("export.selected", { selected: selectedGroupCount, total: totalGroupCount })}
        </span>
      </button>

      {REWARD_GROUPS.map((group) => {
        const selected = isGroupSelected(group);
        const cachedGroupCount = group.keys.filter((key) => cache[key]).length;
        const allCached = cachedGroupCount === group.keys.length;
        return (
          <button
            key={group.id}
            type="button"
            className={`sheet-card${selected ? " sheet-card--selected" : ""}`}
            onClick={() => onToggleGroup(group)}
            aria-pressed={selected}
          >
            <div className="sheet-card-top">
              <span className="sheet-title">{t(group.label)}</span>
              <span
                className={`sheet-check-icon${selected ? " sheet-check-icon--visible" : ""}`}
                aria-hidden="true"
              >
                <CheckIcon />
              </span>
            </div>
            <span className="sheet-meta">
              {allCached ? (
                <>
                  <ClockIcon size={11} />{" "}
                  {t("export.stored", {
                    age: formatAge(Math.min(...group.keys.map((key) => cache[key]!.fetchedAt))),
                  })}
                </>
              ) : cachedGroupCount > 0 ? (
                <>
                  <ClockIcon size={11} />{" "}
                  {t("export.storedPartial", { count: cachedGroupCount, total: group.keys.length })}
                </>
              ) : (
                t("export.notStored")
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
});
