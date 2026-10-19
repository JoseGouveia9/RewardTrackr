import { useEffect, useMemo, useState } from "react";
import { getCachedCycles } from "@/features/minerwars/utils/comparison";
import type { MinerWarsShareSnapshot } from "@/features/minerwars/types/share-types";
import type { Currency } from "@/features/records/types";

/**
 * State for the MinerWars cycle tracker panel; stays unmounted until first opened and auto-closes without cached cycles.
 * The tracker currency follows the table's only while the panel is closed.
 */
export function useCycleTracker({
  enabled,
  cacheVersion,
  currency,
  onOpenChange,
}: {
  enabled: boolean;
  cacheVersion: number;
  currency: Currency;
  onOpenChange?: (open: boolean) => void;
}) {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSnapshot, setShareSnapshot] = useState<MinerWarsShareSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [trackerCurrency, setTrackerCurrency] = useState<Currency>(currency);

  useEffect(() => {
    if (show) setMounted(true);
  }, [show]);
  useEffect(() => {
    if (!show) setTrackerCurrency(currency);
  }, [currency, show]);

  const hasCachedData = useMemo(() => {
    if (!enabled) return false;
    void cacheVersion;
    const cycles = getCachedCycles();
    return Boolean(cycles && cycles.length > 0);
  }, [cacheVersion, enabled]);

  useEffect(() => {
    if (!hasCachedData && show) setShow(false);
  }, [hasCachedData, show]);

  useEffect(() => {
    onOpenChange?.(enabled && hasCachedData && show);
    return () => onOpenChange?.(false);
  }, [hasCachedData, enabled, onOpenChange, show]);

  return {
    active: enabled && hasCachedData,
    show,
    toggle: () => setShow((wasShown) => !wasShown),
    mounted,
    shareOpen,
    setShareOpen,
    shareSnapshot,
    setShareSnapshot,
    busy,
    setBusy,
    trackerCurrency,
    setTrackerCurrency,
  };
}
