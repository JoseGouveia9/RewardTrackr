import { useState } from "react";
import type { RewardKey } from "@/features/export/types";
import type { Currency, DateRange } from "../types";
import { EMPTY_DATE_RANGE } from "../utils/constants";

export function useDataViewerState() {
  const [activeKey, setActiveKey] = useState<RewardKey>("solo-mining");
  const [currency, setCurrency] = useState<Currency>("BTC");
  const [sharedView, setSharedView] = useState<"NATIVE" | "USD" | "FIAT">("NATIVE");
  const [groupByDay, setGroupByDay] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_DATE_RANGE);

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
