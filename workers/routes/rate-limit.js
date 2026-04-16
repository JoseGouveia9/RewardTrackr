import { resolveVerifiedUser } from "../lib/auth.js";

export async function handleRateLimitRoutes({
  url,
  request,
  env,
  jsonResponse,
  maxExportsPerDay,
}) {
  if (url.pathname === "/rl-check") {
    const userId = await resolveVerifiedUser(request);
    if (!userId) {
      return jsonResponse({ allowed: false, message: "Unauthorized." }, 401);
    }

    const day = new Date().toISOString().slice(0, 10);
    const key = `rl_${userId}_${day}`;
    const current = await env.RATE_LIMIT.get(key);
    const count = current ? parseInt(current) : 0;

    if (count >= maxExportsPerDay) {
      return jsonResponse(
        {
          allowed: false,
          message: "You have reached your daily export limit. Please try again tomorrow.",
        },
        429,
      );
    }

    try {
      await env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: 86400 });
    } catch {
      // KV write failed, allow the export anyway
    }

    return jsonResponse({ allowed: true, used: count + 1, limit: maxExportsPerDay });
  }

  if (url.pathname === "/rl-rollback") {
    const userId = await resolveVerifiedUser(request);
    if (!userId) {
      return jsonResponse({ message: "Unauthorized." }, 401);
    }

    const day = new Date().toISOString().slice(0, 10);
    const key = `rl_${userId}_${day}`;
    const current = await env.RATE_LIMIT.get(key);
    const count = current ? parseInt(current) : 0;

    try {
      const next = Math.max(0, count - 1);
      if (next === 0) {
        await env.RATE_LIMIT.delete(key);
      } else {
        await env.RATE_LIMIT.put(key, String(next), { expirationTtl: 86400 });
      }
    } catch {
      // Non-fatal
    }

    return jsonResponse({ rolled_back: true });
  }

  return null;
}
