import { useEffect, useRef } from "react";
import type { RewardKey } from "@/features/export/types";
import { ALL_TABS } from "../../utils/constants";

interface TabListProps {
  activeKey: RewardKey;
  onSelect: (key: RewardKey) => void;
  tabsWithNew: Set<RewardKey>;
  onTabSeen?: (key: RewardKey) => void;
}

export function TabList({ activeKey, onSelect, tabsWithNew, onTabSeen }: TabListProps) {
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    tabsRef.current?.querySelector<HTMLElement>(".dv-tab--active")?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [activeKey]);

  return (
    <div ref={tabsRef} className="dv-tabs">
      {ALL_TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`dv-tab${activeKey === tab.key ? " dv-tab--active" : ""}${tabsWithNew.has(tab.key) ? " dv-tab--has-new" : ""}`}
          onClick={() => {
            if (tab.key !== activeKey) {
              onTabSeen?.(activeKey);
              if (activeKey === "purchases") onTabSeen?.("upgrades");
            }
            onTabSeen?.(tab.key);
            if (tab.key === "purchases") onTabSeen?.("upgrades");
            onSelect(tab.key);
          }}
        >
          <span>{tab.label}</span>
          {tabsWithNew.has(tab.key) ? (
            <span className="dv-new-badge dv-new-badge--button">NEW</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
