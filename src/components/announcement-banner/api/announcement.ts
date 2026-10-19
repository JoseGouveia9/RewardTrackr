import { WORKER_URL } from "@/config/app-config";

export interface Announcement {
  enabled: boolean;
  id: string;
  message: string;
}

/**
 * Returns the worker's active announcement, or null when disabled, incomplete or the request
 * fails.
 */
export async function fetchAnnouncement(): Promise<Announcement | null> {
  if (!WORKER_URL) return null;
  try {
    const response = await fetch(`${WORKER_URL}/announcement`, { cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as Announcement;
    if (!data.enabled || !data.id || !data.message) return null;
    return data;
  } catch {
    return null;
  }
}
