import { memo } from "react";
import { REWARD_GROUPS } from "@/core/reward-configs";
import { formatAge } from "@/features/cache";
import type { CacheState, RewardGroup } from "@/core/types";

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
  const totalGroupCount = REWARD_GROUPS.length;
  const selectedGroupCount = REWARD_GROUPS.filter((g) => isGroupSelected(g)).length;

  return (
    <div className="sheet-selector">
      <button
        type="button"
        className={`sheet-card sheet-card-all ${selectedGroupCount === totalGroupCount ? "selected" : ""}`}
        onClick={onToggleAll}
        aria-pressed={selectedGroupCount === totalGroupCount}
      >
        <span className="sheet-title">Select All</span>
        <span className="sheet-meta">
          {selectedGroupCount}/{totalGroupCount} selected
        </span>
      </button>

      {REWARD_GROUPS.map((group) => {
        const selected = isGroupSelected(group);
        const cachedGroupCount = group.keys.filter((k) => cache[k]).length;
        const allCached = cachedGroupCount === group.keys.length;
        return (
          <button
            key={group.id}
            type="button"
            className={`sheet-card ${selected ? "selected" : ""}`}
            onClick={() => onToggleGroup(group)}
            aria-pressed={selected}
          >
            <span className="sheet-title">{group.label}</span>
            <span className="sheet-meta">
              {allCached ? (
                <span className="cache-badge">
                  Stored{" "}
                  {group.keys.length === 1
                    ? formatAge(cache[group.keys[0]]!.fetchedAt)
                    : `${group.keys.length}/${group.keys.length}`}
                </span>
              ) : cachedGroupCount > 0 ? (
                <span className="cache-badge">
                  Stored {cachedGroupCount}/{group.keys.length}
                </span>
              ) : (
                "Not stored"
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
});
