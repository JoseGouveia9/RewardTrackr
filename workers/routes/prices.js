import { getTickerPricesFromGoMining } from "../lib/gomining-mcp.js";

const CMC_URL =
  "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?slug=bitcoin,gomining-token&convert=USD";

const PRICE_KEY_PREFIX = "price:";

// Retention: when storing today's price, we check whether the entry from
// RETENTION_CHECK_DAYS_AGO days ago still exists. If it does, we purge a
// batch of RETENTION_DELETE_COUNT consecutive days starting from that date
// (this avoids needing a per-day delete/list scan — see fetchAndStoreDailyPrices).
const RETENTION_CHECK_DAYS_AGO = 8;
const RETENTION_DELETE_COUNT = 7;

function todayUtcDateString() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function addUtcDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Batch retention cleanup. Given today's date, looks back
 * RETENTION_CHECK_DAYS_AGO days; if an entry still exists there, deletes
 * RETENTION_DELETE_COUNT consecutive daily entries starting from that date
 * (i.e. everything except the most recent 2 days at that point).
 */
async function cleanupOldPrices(env, todayDate) {
  const cutoffDate = addUtcDays(todayDate, -RETENTION_CHECK_DAYS_AGO);
  const cutoffKey = `${PRICE_KEY_PREFIX}${cutoffDate}`;

  const exists = await env.PRICE_HISTORY.get(cutoffKey);
  if (!exists) return;

  const deletions = [];
  for (let i = 0; i < RETENTION_DELETE_COUNT; i++) {
    const date = addUtcDays(cutoffDate, i);
    deletions.push(env.PRICE_HISTORY.delete(`${PRICE_KEY_PREFIX}${date}`));
  }
  await Promise.all(deletions);
}

async function fetchFromCoinMarketCap(env) {
  if (!env.CMC_API_KEY) throw new Error("CMC_API_KEY is not configured");

  const response = await fetch(CMC_URL, {
    headers: {
      accept: "application/json",
      "X-CMC_PRO_API_KEY": env.CMC_API_KEY,
    },
  });
  if (!response.ok) {
    throw new Error(`CoinMarketCap request failed: ${response.status}`);
  }

  const { data } = await response.json();
  const entries = Object.values(data ?? {});
  const btcUsd = entries.find((c) => c.slug === "bitcoin")?.quote?.USD?.price;
  const gmtUsd = entries.find((c) => c.slug === "gomining-token")?.quote?.USD?.price;
  if (typeof btcUsd !== "number" || typeof gmtUsd !== "number") {
    throw new Error("CoinMarketCap response missing BTC or GMT price");
  }

  return { btcUsd, gmtUsd };
}

/**
 * Fetches BTC and GMT prices (USD) — preferring the GoMining MCP server's
 * `get_ticker_prices` tool, falling back to CoinMarketCap if GoMining is
 * unavailable or not authorized (e.g. refresh token revoked/expired) — and
 * stores them in KV, keyed by UTC date (e.g. "price:2026-09-08"). Each stored
 * entry records which `source` was used. Also runs a batch retention cleanup
 * (see cleanupOldPrices). Intended to be called once a day from the Cron
 * Trigger scheduled handler.
 */
export async function fetchAndStoreDailyPrices(env) {
  if (!env.PRICE_HISTORY) throw new Error("PRICE_HISTORY KV binding is not configured");

  let prices;
  let source;
  try {
    prices = await getTickerPricesFromGoMining(env);
    source = "gomining-mcp";
  } catch (err) {
    console.error("[prices] GoMining MCP failed, falling back to CoinMarketCap:", err);
    prices = await fetchFromCoinMarketCap(env);
    source = "coinmarketcap";
  }

  const entry = {
    date: todayUtcDateString(),
    btcUsd: prices.btcUsd,
    gmtUsd: prices.gmtUsd,
    source,
    fetchedAt: new Date().toISOString(),
  };

  await env.PRICE_HISTORY.put(`${PRICE_KEY_PREFIX}${entry.date}`, JSON.stringify(entry));
  await cleanupOldPrices(env, entry.date);

  return entry;
}

const DATE_KEY_RE = /^\/api\/prices\/(\d{4}-\d{2}-\d{2})$/;

/**
 * GET /api/prices/latest  -> most recently stored { date, btcUsd, gmtUsd, source, fetchedAt }
 * GET /api/prices/history?days=30 -> array of daily entries, oldest to newest
 * GET /api/prices/:date (YYYY-MM-DD) -> single stored entry for that UTC date, or 404
 */
export async function handlePricesRoute({ url, jsonResponse, env }) {
  if (!url.pathname.startsWith("/api/prices")) return null;
  if (!env.PRICE_HISTORY) return jsonResponse({ error: "Price history not configured" }, 503);

  if (url.pathname === "/api/prices/latest") {
    const list = await env.PRICE_HISTORY.list({ prefix: PRICE_KEY_PREFIX });
    const latestKey = list.keys.map((k) => k.name).sort().at(-1);
    if (!latestKey) return jsonResponse(null);

    const latest = await env.PRICE_HISTORY.get(latestKey);
    return jsonResponse(latest ? JSON.parse(latest) : null);
  }

  const dateMatch = url.pathname.match(DATE_KEY_RE);
  if (dateMatch) {
    const stored = await env.PRICE_HISTORY.get(`${PRICE_KEY_PREFIX}${dateMatch[1]}`);
    if (!stored) return jsonResponse({ error: "No price stored for that date" }, 404);
    return jsonResponse(JSON.parse(stored));
  }

  if (url.pathname === "/api/prices/history") {
    const requestedDays = parseInt(url.searchParams.get("days") || "30", 10);
    const days = Math.min(Math.max(Number.isFinite(requestedDays) ? requestedDays : 30, 1), 365);

    const list = await env.PRICE_HISTORY.list({ prefix: PRICE_KEY_PREFIX });
    const dateKeys = list.keys
      .map((k) => k.name)
      .sort()
      .slice(-days);

    const entries = await Promise.all(dateKeys.map((key) => env.PRICE_HISTORY.get(key)));
    return jsonResponse(entries.filter(Boolean).map((e) => JSON.parse(e)));
  }

  return null;
}
