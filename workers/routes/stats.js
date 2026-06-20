import { resolveVerifiedUser } from "../lib/auth.js";

const TOTAL_KEY = "stats:total";
const SEEN_PREFIX = "seen:";

/**
 * Increments the global user counter the first time a given userId is seen.
 * Safe to call on every authenticated request — it's a no-op after the first call.
 */
export async function trackUserIfNew(env, userId) {
  if (!env.STATS || !userId) return;

  const seenKey = `${SEEN_PREFIX}${userId}`;

  try {
    const alreadySeen = await env.STATS.get(seenKey);
    if (alreadySeen !== null) return;

    // Mark user as seen (no expiration — permanent)
    await env.STATS.put(seenKey, "1");

    // Increment total counter atomically (read-modify-write; KV eventual consistency
    // is acceptable here — off-by-one under high concurrency is fine for a display counter)
    const current = await env.STATS.get(TOTAL_KEY);
    const next = current ? parseInt(current, 10) + 1 : 1;
    await env.STATS.put(TOTAL_KEY, String(next));
  } catch {
    // Never block the main request due to stats failures
  }
}

export async function handleStatsRoute({ url, request, jsonResponse, env }) {
  if (url.pathname !== "/api/stats") return null;

  // POST /api/stats — track user then return total
  if (request.method === "POST") {
    const userId = await resolveVerifiedUser(request);
    if (userId) await trackUserIfNew(env, userId);

    try {
      const total = await env.STATS.get(TOTAL_KEY);
      return jsonResponse({ total: total ? parseInt(total, 10) : 0 });
    } catch {
      return jsonResponse({ total: 0 });
    }
  }

  // GET /api/stats — return total only
  try {
    const total = await env.STATS.get(TOTAL_KEY);
    return jsonResponse({ total: total ? parseInt(total, 10) : 0 });
  } catch {
    return jsonResponse({ total: 0 });
  }
}
