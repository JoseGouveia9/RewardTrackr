import { getTickerPricesFromGoMining } from "../lib/gomining-mcp.js";
import { utcDay } from "../lib/counter.js";

const COINMARKETCAP_URL =
  "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?slug=bitcoin,gomining-token&convert=USD";

const PRICE_KEY_PREFIX = "price:";

const RETENTION_CHECK_DAYS_AGO = 8;
const RETENTION_DELETE_COUNT = 7;

function addUtcDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Batch retention: once the entry from RETENTION_CHECK_DAYS_AGO exists, deletes
 * RETENTION_DELETE_COUNT consecutive days from there, avoiding a list/scan on every run.
 */
async function cleanupOldPrices(environment, todayDate) {
  const cutoffDate = addUtcDays(todayDate, -RETENTION_CHECK_DAYS_AGO);
  const cutoffKey = `${PRICE_KEY_PREFIX}${cutoffDate}`;

  const exists = await environment.PRICE_HISTORY.get(cutoffKey);
  if (!exists) return;

  const deletions = [];
  for (let dayOffset = 0; dayOffset < RETENTION_DELETE_COUNT; dayOffset++) {
    const date = addUtcDays(cutoffDate, dayOffset);
    deletions.push(environment.PRICE_HISTORY.delete(`${PRICE_KEY_PREFIX}${date}`));
  }
  await Promise.all(deletions);
}

/** Fallback price source used when the GoMining MCP call fails. */
async function fetchFromCoinMarketCap(environment) {
  if (!environment.CMC_API_KEY) throw new Error("CMC_API_KEY is not configured");

  const response = await fetch(COINMARKETCAP_URL, {
    headers: {
      accept: "application/json",
      "X-CMC_PRO_API_KEY": environment.CMC_API_KEY,
    },
  });
  if (!response.ok) {
    throw new Error(`CoinMarketCap request failed: ${response.status}`);
  }

  const { data } = await response.json();
  const entries = Object.values(data ?? {});
  const btcUsd = entries.find((entry) => entry.slug === "bitcoin")?.quote?.USD?.price;
  const gmtUsd = entries.find((entry) => entry.slug === "gomining-token")?.quote?.USD?.price;
  if (typeof btcUsd !== "number" || typeof gmtUsd !== "number") {
    throw new Error("CoinMarketCap response missing BTC or GMT price");
  }

  return { btcUsd, gmtUsd };
}

/**
 * Prefers the GoMining MCP prices, falls back to CoinMarketCap; stored under "price:YYYY-MM-DD".
 * Called once a day by the Cron Trigger.
 */
export async function fetchAndStoreDailyPrices(environment) {
  if (!environment.PRICE_HISTORY) throw new Error("PRICE_HISTORY KV binding is not configured");

  let prices;
  let source;
  try {
    prices = await getTickerPricesFromGoMining(environment);
    source = "gomining-mcp";
  } catch (error) {
    console.error("[prices] GoMining MCP failed, falling back to CoinMarketCap:", error);
    prices = await fetchFromCoinMarketCap(environment);
    source = "coinmarketcap";
  }

  const entry = {
    date: utcDay(),
    btcUsd: prices.btcUsd,
    gmtUsd: prices.gmtUsd,
    source,
    fetchedAt: new Date().toISOString(),
  };

  await environment.PRICE_HISTORY.put(`${PRICE_KEY_PREFIX}${entry.date}`, JSON.stringify(entry));
  await cleanupOldPrices(environment, entry.date);

  return entry;
}

const DATE_KEY_PATTERN = /^\/api\/prices\/(\d{4}-\d{2}-\d{2})$/;

/** GET /api/prices/latest | /api/prices/history?days=30 (max 365) | /api/prices/:YYYY-MM-DD */
export async function handlePricesRoute({ url, jsonResponse, environment }) {
  if (!url.pathname.startsWith("/api/prices")) return null;
  if (!environment.PRICE_HISTORY)
    return jsonResponse({ error: "Price history not configured" }, 503);

  if (url.pathname === "/api/prices/latest") {
    const list = await environment.PRICE_HISTORY.list({ prefix: PRICE_KEY_PREFIX });
    const latestKey = list.keys
      .map((key) => key.name)
      .sort()
      .at(-1);
    if (!latestKey) return jsonResponse(null);

    const latest = await environment.PRICE_HISTORY.get(latestKey);
    return jsonResponse(latest ? JSON.parse(latest) : null);
  }

  const dateMatch = url.pathname.match(DATE_KEY_PATTERN);
  if (dateMatch) {
    const stored = await environment.PRICE_HISTORY.get(`${PRICE_KEY_PREFIX}${dateMatch[1]}`);
    if (!stored) return jsonResponse({ error: "No price stored for that date" }, 404);
    return jsonResponse(JSON.parse(stored));
  }

  if (url.pathname === "/api/prices/history") {
    const requestedDays = parseInt(url.searchParams.get("days") || "30", 10);
    const days = Math.min(Math.max(Number.isFinite(requestedDays) ? requestedDays : 30, 1), 365);

    const list = await environment.PRICE_HISTORY.list({ prefix: PRICE_KEY_PREFIX });
    const dateKeys = list.keys
      .map((key) => key.name)
      .sort()
      .slice(-days);

    const entries = await Promise.all(dateKeys.map((key) => environment.PRICE_HISTORY.get(key)));
    return jsonResponse(entries.filter(Boolean).map((entryJson) => JSON.parse(entryJson)));
  }

  return null;
}
