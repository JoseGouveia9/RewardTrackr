import i18n from "@/i18n";
import { WORKER_URL } from "@/config/app-config";

/**
 * Reserves an export slot on the worker (skipped when no worker is configured); throws its
 * message when the limit is hit.
 */
export async function checkExportRateLimit(token: string): Promise<void> {
  if (!WORKER_URL) return;
  const response = await fetch(`${WORKER_URL}/rl-check`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(data?.message ?? i18n.t("export.limitReached"));
  }
}

export async function rollbackExportRateLimit(token: string): Promise<void> {
  if (!WORKER_URL) return;
  await fetch(`${WORKER_URL}/rl-rollback`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}
