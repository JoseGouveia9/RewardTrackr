import { handleDefaultProxy, handleSeProxy } from "./routes/proxy.js";
import { handleRateLimitRoutes } from "./routes/rate-limit.js";
import { handleShareRoutes } from "./routes/share.js";

// ── Shared profiles constants ──────────────────────────────────────────────
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_EXPORTS_PER_DAY = 1;
const MAX_SHARES_PER_DAY = MAX_EXPORTS_PER_DAY;

const ALLOWED_ORIGINS = new Set([
  "https://josegouveia9.github.io",
  "http://localhost:5173",
  "http://localhost:4173",
]);

function corsHeaders(request) {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "https://josegouveia9.github.io";
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
