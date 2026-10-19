import { useState } from "react";
import type { RewardKey } from "@/types/rewards";
import type { Currency, DateRange, ViewKey } from "@/features/records/types";
import { EMPTY_DATE_RANGE } from "@/features/records/utils/constants";

/**
 * Viewer-wide selection state; `setView` also syncs the currency (USD/FIAT map to themselves,
 * anything else to BTC).
 */
export function useDataViewerState() {
  const [activeKey, setActiveKey] = useState<RewardKey>("solo-mining");
  const [currency, setCurrency] = useState<Currency>("BTC");
  const [sharedView, setSharedView] = useState<ViewKey>("NATIVE");
  const [groupByDay, setGroupByDay] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_DATE_RANGE);
  const [miningPage, setMiningPage] = useState(0);

  function setView(view: ViewKey) {
    setSharedView(view);
    if (view === "USD") setCurrency("USD");
    else if (view === "FIAT") setCurrency("FIAT");
    else setCurrency("BTC");
  }

  return {
    activeKey,
    setActiveKey,
    currency,
    setCurrency,
    sharedView,
    setSharedView,
    setView,
    groupByDay,
    setGroupByDay,
    dateRange,
    setDateRange,
    miningPage,
    setMiningPage,
  };
}
