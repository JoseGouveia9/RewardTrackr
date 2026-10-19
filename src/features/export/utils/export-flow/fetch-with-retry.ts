import i18n from "@/i18n";
import { sleepWithCountdown } from "../sleep-with-countdown";

const MAX_RETRIES = 5;
const RETRY_DELAY_MILLISECONDS = 60_000;

/**
 * Retries only request timeouts (AbortError) after a fixed wait, reporting a countdown.
 * API and network errors are rethrown immediately.
 */
export async function fetchWithRetry<T>(
  operation: () => Promise<T>,
  onProgress?: (message: string) => void,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === "AbortError";
      if (!isTimeout || attempt > MAX_RETRIES) throw error;
      await sleepWithCountdown(RETRY_DELAY_MILLISECONDS, (remaining) => {
        onProgress?.(i18n.t("export.requestTimeout", { attempt, max: MAX_RETRIES, remaining }));
      });
    }
  }
  throw new Error("Max retries exceeded");
}
