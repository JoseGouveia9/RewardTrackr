import type { CacheState } from "@/types/rewards";
import { WORKER_URL } from "@/config/app-config";

export function isWorkerConfigured(): boolean {
  return !!WORKER_URL;
}

export function buildShareLink(profileId: string): string {
  return `${window.location.origin}/view/${profileId}`;
}

/**
 * Creates or updates the user's shared profile on the worker; throws the worker's error message
 * on failure.
 */
export async function publishProfile(
  alias: string,
  sheets: Partial<CacheState>,
  authToken: string,
  communityVisible = true,
): Promise<{ id: string; updatedAt: string }> {
  if (!WORKER_URL) throw new Error("Sharing is not configured for this deployment");
  if (!authToken) throw new Error("You must be authenticated to share records");
  const response = await fetch(`${WORKER_URL}/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ alias, data: sheets, communityVisible }),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error((errorBody as { error?: string }).error ?? `HTTP ${response.status}`);
  }
  return response.json() as Promise<{ id: string; updatedAt: string }>;
}

/**
 * Looks up the authenticated user's own shared profile; `exists` is false when none was
 * published.
 */
export async function fetchMySharedProfile(authToken: string): Promise<{
  exists: boolean;
  id?: string;
  alias?: string;
  updatedAt?: string | null;
  communityVisible?: boolean;
}> {
  if (!WORKER_URL) throw new Error("Sharing is not configured for this deployment");
  if (!authToken) throw new Error("You must be authenticated to view your shared link");

  const response = await fetch(`${WORKER_URL}/share/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error((errorBody as { error?: string }).error ?? `HTTP ${response.status}`);
  }
  return response.json() as Promise<{
    exists: boolean;
    id?: string;
    alias?: string;
    updatedAt?: string | null;
    communityVisible?: boolean;
  }>;
}

export async function deleteMySharedProfile(
  authToken: string,
): Promise<{ deleted: boolean; id?: string }> {
  if (!WORKER_URL) throw new Error("Sharing is not configured for this deployment");
  if (!authToken) throw new Error("You must be authenticated to delete your shared link");

  const response = await fetch(`${WORKER_URL}/share/me`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error((errorBody as { error?: string }).error ?? `HTTP ${response.status}`);
  }
  return response.json() as Promise<{ deleted: boolean; id?: string }>;
}
