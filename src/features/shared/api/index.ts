import type { DirectoryEntry, SharedProfile } from "../types";
import type { CacheState } from "@/features/export/types";

const RAW_BASE = "https://raw.githubusercontent.com/JoseGouveia9/rewardtrackr-shared/main/shared";

const WORKER_URL = (import.meta.env.VITE_WORKER_URL as string | undefined) ?? "";
let inFlightDirectory: Promise<DirectoryEntry[]> | null = null;
const inFlightProfiles = new Map<string, Promise<SharedProfile>>();

export function isWorkerConfigured(): boolean {
  return !!WORKER_URL;
}

export function buildShareLink(profileId: string): string {
  return `${window.location.origin}/view/${profileId}`;
}

export async function fetchDirectory(): Promise<DirectoryEntry[]> {
  if (inFlightDirectory) return inFlightDirectory;

  inFlightDirectory = (async () => {
    if (WORKER_URL) {
      const workerRes = await fetch(`${WORKER_URL}/share/directory`, { cache: "no-store" });
      if (workerRes.ok) {
        const workerData: unknown = await workerRes.json();
        return Array.isArray(workerData) ? (workerData as DirectoryEntry[]) : [];
      }
    }

    const res = await fetch(`${RAW_BASE}/directory.json`, { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load community directory");
    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as DirectoryEntry[]) : [];
  })();

  try {
    return await inFlightDirectory;
  } finally {
    inFlightDirectory = null;
  }
}

export async function fetchSharedProfile(id: string): Promise<SharedProfile> {
  const safeId = id.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const inFlight = inFlightProfiles.get(safeId);
  if (inFlight) return inFlight;

  const fetchPromise = (async () => {
    if (WORKER_URL) {
      const res = await fetch(`${WORKER_URL}/share/${safeId}`, { cache: "no-store" });
      if (res.status === 404) throw new Error(`No shared profile found for "${id}"`);
      if (!res.ok) throw new Error("Failed to load shared profile");
      return res.json() as Promise<SharedProfile>;
    }

    const res = await fetch(`${RAW_BASE}/${safeId}.json`, { cache: "no-store" });
    if (res.status === 404) throw new Error(`No shared profile found for "${id}"`);
    if (!res.ok) throw new Error("Failed to load shared profile");
    return res.json() as Promise<SharedProfile>;
  })();

  inFlightProfiles.set(safeId, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    inFlightProfiles.delete(safeId);
  }
}

export async function publishProfile(
  alias: string,
  sheets: Partial<CacheState>,
  authToken: string,
  communityVisible = true,
): Promise<{ id: string; updatedAt: string }> {
  if (!WORKER_URL) throw new Error("Sharing is not configured for this deployment");
  if (!authToken) throw new Error("You must be authenticated to share records");
  const res = await fetch(`${WORKER_URL}/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ alias, data: sheets, communityVisible }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ id: string; updatedAt: string }>;
}

export async function fetchMySharedProfile(authToken: string): Promise<{
  exists: boolean;
  id?: string;
  alias?: string;
  updatedAt?: string | null;
  communityVisible?: boolean;
}> {
  if (!WORKER_URL) throw new Error("Sharing is not configured for this deployment");
  if (!authToken) throw new Error("You must be authenticated to view your shared link");

  const res = await fetch(`${WORKER_URL}/share/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<{
    exists: boolean;
    id?: string;
    alias?: string;
    updatedAt?: string | null;
    communityVisible?: boolean;
  }>;
}

export interface Announcement {
  enabled: boolean;
  id: string;
  message: string;
}

export async function fetchAnnouncement(): Promise<Announcement | null> {
  if (!WORKER_URL) return null;
  try {
    const res = await fetch(`${WORKER_URL}/announcement`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as Announcement;
    if (!data.enabled || !data.id || !data.message) return null;
    return data;
  } catch {
    return null;
  }
}

export async function deleteMySharedProfile(
  authToken: string,
): Promise<{ deleted: boolean; id?: string }> {
  if (!WORKER_URL) throw new Error("Sharing is not configured for this deployment");
  if (!authToken) throw new Error("You must be authenticated to delete your shared link");

  const res = await fetch(`${WORKER_URL}/share/me`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ deleted: boolean; id?: string }>;
}
