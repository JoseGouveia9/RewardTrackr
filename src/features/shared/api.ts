import type { DirectoryEntry, SharedProfile } from "./types";
import type { CacheState } from "@/features/export/types";

const RAW_BASE =
  "https://raw.githubusercontent.com/JoseGouveia9/rewardtrackr-shared/main/shared";

const WORKER_URL = (import.meta.env.VITE_WORKER_URL as string | undefined) ?? "";

export function isWorkerConfigured(): boolean {
  return !!WORKER_URL;
}

// Fetches the public directory listing from the shared repo.
export async function fetchDirectory(): Promise<DirectoryEntry[]> {
  const res = await fetch(`${RAW_BASE}/directory.json?t=${Date.now()}`);
  if (!res.ok) throw new Error("Could not load community directory");
  const data: unknown = await res.json();
  return Array.isArray(data) ? (data as DirectoryEntry[]) : [];
}

// Fetches a single shared profile by its id slug.
export async function fetchSharedProfile(id: string): Promise<SharedProfile> {
  const safeId = id.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const res = await fetch(`${RAW_BASE}/${safeId}.json?t=${Date.now()}`);
  if (res.status === 404) throw new Error(`No shared profile found for "${id}"`);
  if (!res.ok) throw new Error("Failed to load shared profile");
  return res.json() as Promise<SharedProfile>;
}

// POSTs the user's records to the Cloudflare Worker which writes them to the shared repo.
export async function publishProfile(
  alias: string,
  sheets: Partial<CacheState>,
): Promise<{ id: string; updatedAt: string }> {
  if (!WORKER_URL) throw new Error("Sharing is not configured for this deployment");
  const res = await fetch(`${WORKER_URL}/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alias, data: sheets }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ id: string; updatedAt: string }>;
}
