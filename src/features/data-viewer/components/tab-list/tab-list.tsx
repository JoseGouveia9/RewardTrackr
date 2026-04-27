import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { RewardKey } from "@/features/export/types";

interface TabListProps {
  tabs: { key: RewardKey; label: string }[];
  activeKey: RewardKey;
  onSelect: (key: RewardKey) => void;
  tabsWithNew: Set<RewardKey>;
  onTabSeen?: (key: RewardKey) => void;
  fetchingKeys?: Set<RewardKey>;
}

export function TabList({
  tabs,
  activeKey,
  onSelect,
  tabsWithNew,
  onTabSeen,
  fetchingKeys,
}: TabListProps) {
  const { t } = useTranslation();
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
      {tabs.map((tab) => {
        const isFetchingTab = fetchingKeys?.has(tab.key) ?? false;
        return (
          <motion.button
            key={tab.key}
            type="button"
            className={`dv-tab${activeKey === tab.key ? " dv-tab--active" : ""}${tabsWithNew.has(tab.key) ? " dv-tab--has-new" : ""}`}
            initial={{ paddingLeft: 14, paddingRight: 14 }}
            animate={{
              paddingLeft: isFetchingTab ? 6 : 14,
              paddingRight: isFetchingTab ? 6 : 14,
            }}
            transition={{ duration: 0.2, ease: "easeOut" }}
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
            <span>{t(tab.label)}</span>
            <AnimatePresence>
              {fetchingKeys?.has(tab.key) && (
                <motion.span
                  key="spinner"
                  initial={{ width: 0, marginLeft: 0 }}
                  animate={{ width: 10, marginLeft: 6 }}
                  exit={{ width: 0, marginLeft: 0, transition: { duration: 0.2, ease: "easeOut" } }}
                  transition={{
                    width: { duration: 0.2, ease: "easeOut" },
                    marginLeft: { duration: 0.2, ease: "easeOut" },
                  }}
                  style={{
                    overflow: "hidden",
                    display: "inline-flex",
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                >
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 420, damping: 13 }}
                    style={{ display: "inline-flex", flexShrink: 0 }}
                  >
                    <span className="dv-spinner dv-tab-spinner" />
                  </motion.span>
                </motion.span>
              )}
            </AnimatePresence>
            {tabsWithNew.has(tab.key) ? (
              <span className="dv-new-badge dv-new-badge--button">{t("common.new")}</span>
            ) : null}
          </motion.button>
        );
      })}
    </div>
  );
}
