const MAX_REQUESTS_PER_DAY = 500;

function getUserId(request) {
  try {
    const auth = request.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return null;
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded.sub ?? decoded.id ?? decoded.userId ?? null;
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const userId = getUserId(request);
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const identifier = userId ?? ip;
    const day = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const key = `rl_${identifier}_${day}`;

    const current = await env.RATE_LIMIT.get(key);
    const count = current ? parseInt(current) : 0;

    if (count >= MAX_REQUESTS_PER_DAY) {
      return new Response("Too Many Requests", {
        status: 429,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Retry-After": "86400",
        },
      });
    }

    await env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: 86400 });

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
