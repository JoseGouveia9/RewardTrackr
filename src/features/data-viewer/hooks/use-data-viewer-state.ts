import { useState } from "react";
import type { RewardKey } from "@/features/export/types";
import type { Currency } from "../types";

/** Manages the data viewer's active tab, currency selector, shared view mode, and group-by-day toggle. */
export function useDataViewerState() {
  const [activeKey, setActiveKey] = useState<RewardKey>("solo-mining");
  const [currency, setCurrency] = useState<Currency>("BTC");
  const [sharedView, setSharedView] = useState<"NATIVE" | "USD" | "FIAT">("NATIVE");
  const [groupByDay, setGroupByDay] = useState(false);

  /** Sets the shared view mode and synchronises the currency selector accordingly. */
  function setView(v: "NATIVE" | "USD" | "FIAT") {
    setSharedView(v);
    if (v === "USD") setCurrency("USD");
    else if (v === "FIAT") setCurrency("FIAT");
    // NATIVE: leave mining currency as-is (BTC or GMT)
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
  };
}
