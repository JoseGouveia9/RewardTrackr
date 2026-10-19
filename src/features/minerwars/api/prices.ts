import { getJson, getJsonTolerant } from "@/lib/http";
import { mapWithConcurrency } from "@/lib/concurrency";
import { WORKER_URL } from "@/config/app-config";
import { API } from "./base";

export async function getLivePrices(): Promise<{ btcPrice: number; gmtPrice: number }> {
  const [gmtResponse, btcResponse] = await Promise.all([
    getJson<{ data: { value: number } }>(`${API}/api/exchanges/getTokenPrice`),
    getJson<{ data: number }>(`${API}/api/exchanges/getPrice?symbol=BTC&value=1`),
  ]);
  return { gmtPrice: gmtResponse.data?.value ?? 0, btcPrice: btcResponse.data ?? 0 };
}

/** Daily snapshot from the Worker's PRICE_HISTORY KV; null when absent or already purged. */
async function getHistoricalPrice(
  date: string,
): Promise<{ btcUsd: number; gmtUsd: number } | null> {
  const response = await getJsonTolerant<{ btcUsd?: number; gmtUsd?: number }>(
    `${WORKER_URL}/api/prices/${date}`,
  ).catch(() => null);
  if (!response || typeof response.btcUsd !== "number" || typeof response.gmtUsd !== "number")
    return null;
  return { btcUsd: response.btcUsd, gmtUsd: response.gmtUsd };
}

/** Daily BTC/GMT USD prices (5 concurrent requests); dates without a snapshot are omitted. */
export async function getHistoricalPrices(
  dates: string[],
): Promise<Map<string, { btcUsd: number; gmtUsd: number }>> {
  const uniqueDates = [...new Set(dates)];
  const results = await mapWithConcurrency(uniqueDates, 5, async (date) => {
    const price = await getHistoricalPrice(date);
    return [date, price] as const;
  });
  const map = new Map<string, { btcUsd: number; gmtUsd: number }>();
  for (const [date, price] of results) {
    if (price) map.set(date, price);
  }
  return map;
}
