/**
 * Serves the banner JSON stored in KV key `announcement`; missing or invalid data means disabled.
 */
export async function handleAnnouncementRoute({ url, request, environment, jsonResponse }) {
  if (url.pathname === "/announcement" && request.method === "GET") {
    try {
      const value = await environment.RATE_LIMIT.get("announcement");
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
