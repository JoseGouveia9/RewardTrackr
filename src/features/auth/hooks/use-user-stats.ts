import { useEffect, useState } from "react";

interface UserStats {
  total: number;
}

const WORKER_URL =
  (import.meta.env.VITE_WORKER_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export function useUserStats(): number | null {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${WORKER_URL}/api/stats`)
      .then((res) => (res.ok ? (res.json() as Promise<UserStats>) : Promise.reject()))
      .then((data) => setTotal(data.total))
      .catch(() => {
        // Silently fail — the counter is non-critical
      });
  }, []);

  return total;
}
