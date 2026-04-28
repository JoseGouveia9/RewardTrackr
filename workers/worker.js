import { handleAnnouncementRoute } from "./routes/announcement.js";
import { handleOgRoute } from "./routes/og.js";
import { handleDefaultProxy, handleSeProxy } from "./routes/proxy.js";
import { handleRateLimitRoutes } from "./routes/rate-limit.js";
import { handleShareRoutes } from "./routes/share.js";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_EXPORTS_PER_DAY = 3;
const MAX_SHARES_PER_DAY = 3;

const ALLOWED_ORIGINS = new Set([
  "https://rewardtrackr.com",
  "https://josegouveia9.github.io",
  "http://localhost:5173",
  "http://localhost:4173",
]);

function corsHeaders(request) {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "https://rewardtrackr.com";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const CORS_HEADERS = corsHeaders(request);
    const jsonResponse = (body, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const ogResponse = await handleOgRoute({ url, request, env });
    if (ogResponse) return ogResponse;

    const announcementResponse = await handleAnnouncementRoute({ url, request, env, jsonResponse });
    if (announcementResponse) return announcementResponse;

    const rateLimitResponse = await handleRateLimitRoutes({
      url,
      request,
      env,
      jsonResponse,
      maxExportsPerDay: MAX_EXPORTS_PER_DAY,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const shareResponse = await handleShareRoutes({
      url,
      request,
      env,
      jsonResponse,
      maxBytes: MAX_BYTES,
      maxSharesPerDay: MAX_SHARES_PER_DAY,
    });
    if (shareResponse) return shareResponse;

    const seProxyResponse = await handleSeProxy({
      url,
      request,
      corsHeaders: CORS_HEADERS,
    });
    if (seProxyResponse) return seProxyResponse;

    return handleDefaultProxy({
      url,
      request,
      corsHeaders: CORS_HEADERS,
    });
  },
};
