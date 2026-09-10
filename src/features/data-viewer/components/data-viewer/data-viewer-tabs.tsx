import { AnimatePresence, motion } from "framer-motion";
import type { RewardKey } from "@/types/rewards";
import { TabList } from "../tab-list/tab-list";

interface DataViewerTabsProps {
  hidden: boolean;
  tabs: { key: RewardKey; label: string }[];
  activeKey: RewardKey;
  onSelect: (key: RewardKey) => void;
  tabsWithNew: Set<RewardKey>;
  onTabSeen?: (key: RewardKey) => void;
  fetchingKeys?: Set<RewardKey>;
}

export function DataViewerTabs({
  hidden,
  tabs,
  activeKey,
  onSelect,
  tabsWithNew,
  onTabSeen,
  fetchingKeys,
}: DataViewerTabsProps) {
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {!hidden && (
        <motion.div
          key="sheet-tabs"
          layout
          initial={{ opacity: 0, scale: 0.94, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: -6 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <TabList
            tabs={tabs}
            activeKey={activeKey}
            onSelect={onSelect}
            tabsWithNew={tabsWithNew}
            onTabSeen={onTabSeen}
            fetchingKeys={fetchingKeys}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
