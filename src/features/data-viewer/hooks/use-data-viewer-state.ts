import { useState } from "react";
import type { RewardKey } from "@/features/export/types";
import type { Currency, DateRange } from "../types";
import { EMPTY_DATE_RANGE } from "../utils/constants";

// Manages the data viewer's active tab, currency selector, shared view mode, and group-by-day toggle.
export function useDataViewerState() {
  const [activeKey, setActiveKey] = useState<RewardKey>("solo-mining");
  const [currency, setCurrency] = useState<Currency>("BTC");
  const [sharedView, setSharedView] = useState<"NATIVE" | "USD" | "FIAT">("NATIVE");
  const [groupByDay, setGroupByDay] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_DATE_RANGE);

  // Sets the shared view mode and synchronises the currency selector accordingly.
  function setView(v: "NATIVE" | "USD" | "FIAT") {
    setSharedView(v);
    if (v === "USD") setCurrency("USD");
    else if (v === "FIAT") setCurrency("FIAT");
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
  };
}
