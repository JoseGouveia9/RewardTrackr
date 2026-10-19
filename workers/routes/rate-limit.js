import { resolveVerifiedUser } from "../lib/auth.js";
import { decrementCount, readCount, utcDay } from "../lib/counter.js";
import { trackUserIfNew } from "./stats.js";

/**
 * `/rl-check` counts a daily export per verified user (KV `rl_<id>_<day>`) and answers 429 over the limit.
 * `/rl-rollback` gives the export back when it failed.
 */
export async function handleRateLimitRoutes({
  url,
  request,
  environment,
  jsonResponse,
  maxExportsPerDay,
}) {
  if (url.pathname === "/rl-check") {
    const userId = await resolveVerifiedUser(request);
    if (!userId) {
      return jsonResponse({ allowed: false, message: "Unauthorized." }, 401);
    }

    await trackUserIfNew(environment, userId);

    const key = `rl_${userId}_${utcDay()}`;
    const count = await readCount(environment.RATE_LIMIT, key);

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
      await environment.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: 86400 });
    } catch {}

    return jsonResponse({ allowed: true, used: count + 1, limit: maxExportsPerDay });
  }

  if (url.pathname === "/rl-rollback") {
    const userId = await resolveVerifiedUser(request);
    if (!userId) {
      return jsonResponse({ message: "Unauthorized." }, 401);
    }

    try {
      await decrementCount(environment.RATE_LIMIT, `rl_${userId}_${utcDay()}`);
    } catch {}

    return jsonResponse({ rolled_back: true });
  }

  return null;
}
