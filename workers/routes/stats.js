import { resolveVerifiedUser } from "../lib/auth.js";

const TOTAL_KEY = "stats:total";
const SEEN_PREFIX = "seen:";

/**
 * No-op after a user's first call; the permanent `seen:` key is what dedupes.
 * The total is a non-atomic read-modify-write, and KV errors are swallowed so stats never block a request.
 */
export async function trackUserIfNew(environment, userId) {
  if (!environment.STATS || !userId) return;

  const seenKey = `${SEEN_PREFIX}${userId}`;

  try {
    const alreadySeen = await environment.STATS.get(seenKey);
    if (alreadySeen !== null) return;

    await environment.STATS.put(seenKey, "1");

    const current = await environment.STATS.get(TOTAL_KEY);
    const next = current ? parseInt(current, 10) + 1 : 1;
    await environment.STATS.put(TOTAL_KEY, String(next));
  } catch {}
}

/**
 * GET `/api/stats` returns the total user count; a POST from a verified user also registers them.
 */
export async function handleStatsRoute({ url, request, jsonResponse, environment }) {
  if (url.pathname !== "/api/stats") return null;

  if (request.method === "POST") {
    const userId = await resolveVerifiedUser(request);
    if (userId) await trackUserIfNew(environment, userId);
  }

  try {
    const total = await environment.STATS.get(TOTAL_KEY);
    return jsonResponse({ total: total ? parseInt(total, 10) : 0 });
  } catch {
    return jsonResponse({ total: 0 });
  }
}
