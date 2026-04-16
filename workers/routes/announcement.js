export async function handleAnnouncementRoute({ url, request, env, jsonResponse }) {
  if (url.pathname === "/announcement" && request.method === "GET") {
    try {
      const value = await env.RATE_LIMIT.get("announcement");
      if (!value) return jsonResponse({ enabled: false });
      try {
        return jsonResponse(JSON.parse(value));
      } catch {
        return jsonResponse({ enabled: false });
      }
    } catch {
      return jsonResponse({ enabled: false });
    }
  }
  return null;
}
