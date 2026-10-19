import { useEffect, useState } from "react";
import { LOCAL_STORAGE_KEY_MINERWARS_LIVE_ENABLED } from "@/lib/storage-keys";

/**
 * Persisted toggle for live MinerWars fetching, enabled by default and tolerant of unavailable
 * storage.
 */
export function useLiveMinerWarsSetting(): [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY_MINERWARS_LIVE_ENABLED);
      return raw == null ? true : raw === "1";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_MINERWARS_LIVE_ENABLED, enabled ? "1" : "0");
      // eslint-disable-next-line no-empty
    } catch {}
  }, [enabled]);

  return [enabled, setEnabled];
}
