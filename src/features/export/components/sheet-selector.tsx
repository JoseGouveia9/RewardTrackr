import { memo, useEffect, useState } from "react";
import { REWARD_GROUPS } from "../config/reward-configs";
import "./sheet-selector.css";
import { formatAge } from "../utils/cache";
import type { CacheState, RewardGroup } from "../types";

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
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

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
        <div className="sheet-card-top">
          <span className="sheet-title">Select All</span>
          {selectedGroupCount === totalGroupCount && (
            <span className="sheet-check-icon" aria-hidden="true">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          )}
        </div>
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
            <div className="sheet-card-top">
              <span className="sheet-title">{group.label}</span>
              {selected && (
                <span className="sheet-check-icon" aria-hidden="true">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}
            </div>
            <span className="sheet-meta">
              {allCached ? (
                <>
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>{" "}
                  Stored{" "}
                  {group.keys.length === 1
                    ? formatAge(cache[group.keys[0]]!.fetchedAt)
                    : `${group.keys.length}/${group.keys.length}`}
                </>
              ) : cachedGroupCount > 0 ? (
                <>
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>{" "}
                  Stored {cachedGroupCount}/{group.keys.length}
                </>
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
