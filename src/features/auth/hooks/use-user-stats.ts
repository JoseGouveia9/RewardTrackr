import { useEffect, useState } from "react";
import { fetchUserStats } from "../api/user-stats";

/**
 * Total user count for display; stays null when the request fails since the counter is
 * non-critical.
 */
export function useUserStats(): number | null {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    fetchUserStats()
      .then(setTotal)
      .catch(() => {});
  }, []);

  return total;
}
