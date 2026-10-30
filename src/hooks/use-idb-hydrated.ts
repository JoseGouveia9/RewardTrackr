import { useEffect, useState } from "react";
import { idbReady } from "@/lib/idb-kv";

/**
 * Flips from false to true once the IndexedDB-backed cache's in-memory mirror has hydrated, so
 * memoized reads taken before hydration (which look like a cache miss) can recompute.
 */
export function useIdbHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void idbReady.then(() => {
      if (!cancelled) setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return hydrated;
}
