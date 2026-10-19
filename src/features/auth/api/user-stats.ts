import { WORKER_URL } from "@/config/app-config";

interface UserStats {
  total: number;
}

export async function fetchUserStats(): Promise<number> {
  const response = await fetch(`${WORKER_URL}/api/stats`);
  if (!response.ok) throw new Error("Failed to load stats");
  return ((await response.json()) as UserStats).total;
}
