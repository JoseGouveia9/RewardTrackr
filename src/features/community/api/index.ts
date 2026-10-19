import type { DirectoryEntry, SharedProfile } from "../types";
import { WORKER_URL } from "@/config/app-config";

const RAW_BASE = "https://raw.githubusercontent.com/JoseGouveia9/rewardtrackr-shared/main/shared";

let inFlightDirectory: Promise<DirectoryEntry[]> | null = null;
const inFlightProfiles = new Map<string, Promise<SharedProfile>>();

/**
 * Loads the community directory from the worker, falling back to GitHub; concurrent callers share
 * one request.
 */
export async function fetchDirectory(): Promise<DirectoryEntry[]> {
  if (inFlightDirectory) return inFlightDirectory;

  inFlightDirectory = (async () => {
    if (WORKER_URL) {
      const workerResponse = await fetch(`${WORKER_URL}/share/directory`, { cache: "no-store" });
      if (workerResponse.ok) {
        const workerData: unknown = await workerResponse.json();
        return Array.isArray(workerData) ? (workerData as DirectoryEntry[]) : [];
      }
    }

    const response = await fetch(`${RAW_BASE}/directory.json`, { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load community directory");
    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as DirectoryEntry[]) : [];
  })();

  try {
    return await inFlightDirectory;
  } finally {
    inFlightDirectory = null;
  }
}

/**
 * Loads one shared profile (id sanitized) from the worker, or from GitHub raw when no worker is
 * set; deduplicates concurrent calls.
 */
export async function fetchSharedProfile(id: string): Promise<SharedProfile> {
  const safeId = id.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const inFlight = inFlightProfiles.get(safeId);
  if (inFlight) return inFlight;

  const fetchPromise = (async () => {
    if (WORKER_URL) {
      const response = await fetch(`${WORKER_URL}/share/${safeId}`, { cache: "no-store" });
      if (response.status === 404) throw new Error(`No shared profile found for "${id}"`);
      if (!response.ok) throw new Error("Failed to load shared profile");
      return response.json() as Promise<SharedProfile>;
    }

    const response = await fetch(`${RAW_BASE}/${safeId}.json`, { cache: "no-store" });
    if (response.status === 404) throw new Error(`No shared profile found for "${id}"`);
    if (!response.ok) throw new Error("Failed to load shared profile");
    return response.json() as Promise<SharedProfile>;
  })();

  inFlightProfiles.set(safeId, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    inFlightProfiles.delete(safeId);
  }
}
