const MAX_EXPORTS_PER_DAY = 1;

function getUserId(request) {
  try {
    const auth = request.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return null;
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
    const decoded = JSON.parse(json);
    const id = decoded.id ?? decoded.sub ?? null;
    return id !== null ? String(id) : null;
  } catch {
    return null;
  }
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Rate limit check endpoint — called once per export attempt
    if (url.pathname === "/rl-check") {
      const userId = getUserId(request);
      if (!userId) {
        return new Response(JSON.stringify({ allowed: false, message: "Unauthorized." }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const day = new Date().toISOString().slice(0, 10);
      const key = `rl_${userId}_${day}`;

      const current = await env.RATE_LIMIT.get(key);
      const count = current ? parseInt(current) : 0;

      if (count >= MAX_EXPORTS_PER_DAY) {
        return new Response(
          JSON.stringify({
            allowed: false,
            message: "You have reached your daily export limit. Please try again tomorrow.",
          }),
          {
            status: 429,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          },
        );
      }

      try {
        await env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: 86400 });
      } catch {
        // KV write failed, allow the export anyway
      }

      return new Response(
        JSON.stringify({ allowed: true, used: count + 1, limit: MAX_EXPORTS_PER_DAY }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    // All other requests — proxy to GoMining API freely
    const target = new URL("https://api.gomining.com" + url.pathname + url.search);

    const apiRequest = new Request(target, {
      method: request.method,
      headers: request.headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : null,
    });

    const response = await fetch(apiRequest);

    const newHeaders = new Headers(response.headers);
    newHeaders.set("Access-Control-Allow-Origin", "*");

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  },
};
