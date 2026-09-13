const TOKEN_URL = "https://mcp-auth.gomining.com/token";
const MCP_URL = "https://mcp.gomining.com/mcp";
const OAUTH_KV_KEY = "gomining:oauth";

// Expire a bit early to avoid using a token that dies mid-request.
const EXPIRY_SAFETY_MARGIN_MS = 5 * 60 * 1000;

/**
 * Reads the stored { accessToken, accessTokenExpiresAt, refreshToken } from KV,
 * refreshes the access token if needed (persisting the rotated refresh_token —
 * GoMining's auth server issues a new one on every refresh), and returns a
 * valid access token.
 */
async function getValidAccessToken(env) {
  if (!env.PRICE_HISTORY) throw new Error("PRICE_HISTORY KV binding is not configured");
  if (!env.GOMINING_MCP_CLIENT_ID) throw new Error("GOMINING_MCP_CLIENT_ID is not configured");

  const raw = await env.PRICE_HISTORY.get(OAUTH_KV_KEY);
  if (!raw) throw new Error("GoMining MCP is not authorized yet (missing gomining:oauth in KV)");

  const stored = JSON.parse(raw);
  if (stored.accessToken && stored.accessTokenExpiresAt > Date.now() + EXPIRY_SAFETY_MARGIN_MS) {
    return stored.accessToken;
  }

  if (!stored.refreshToken) throw new Error("GoMining MCP refresh token is missing; re-authorize");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "RewardTrackr/1.0 (+https://rewardtrackr.com)",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: stored.refreshToken,
      client_id: env.GOMINING_MCP_CLIENT_ID,
    }),
  });

  if (!response.ok) {
    throw new Error(`GoMining token refresh failed: ${response.status}`);
  }

  const tokens = await response.json();
  await env.PRICE_HISTORY.put(
    OAUTH_KV_KEY,
    JSON.stringify({
      accessToken: tokens.access_token,
      accessTokenExpiresAt: Date.now() + tokens.expires_in * 1000,
      refreshToken: tokens.refresh_token ?? stored.refreshToken,
    }),
  );

  return tokens.access_token;
}

/**
 * Calls the given MCP JSON-RPC method against the GoMining MCP server and
 * returns the parsed `result` field. Responses use the "text/event-stream"
 * framing (`event: message\ndata: {...}`), so we extract the JSON payload
 * from the "data:" line.
 */
async function callMcp(accessToken, method, params) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${accessToken}`,
      "user-agent": "RewardTrackr/1.0 (+https://rewardtrackr.com)",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });

  if (!response.ok) {
    throw new Error(`GoMining MCP request failed: ${response.status}`);
  }

  const text = await response.text();
  const dataLine = text.split("\n").find((line) => line.startsWith("data:"));
  if (!dataLine) throw new Error("GoMining MCP response missing data payload");

  const payload = JSON.parse(dataLine.slice("data:".length).trim());
  if (payload.error) throw new Error(`GoMining MCP error: ${payload.error.message}`);
  return payload.result;
}

/**
 * Fetches BTC and GMT prices (USD) via the GoMining MCP server's
 * `get_ticker_prices` tool. Requires a one-time OAuth authorization to have
 * seeded the `gomining:oauth` KV entry (see testing/ for the manual flow).
 */
export async function getTickerPricesFromGoMining(env) {
  const accessToken = await getValidAccessToken(env);
  const result = await callMcp(accessToken, "tools/call", {
    name: "get_ticker_prices",
    arguments: { symbols: ["BTC", "GMT"], ticker_type: "crypto" },
  });

  const text = result?.content?.[0]?.text;
  if (!text) throw new Error("GoMining MCP response missing ticker content");

  const { tickers } = JSON.parse(text);
  const btcUsd = tickers?.find((t) => t.symbol === "BTC")?.price;
  const gmtUsd = tickers?.find((t) => t.symbol === "GMT")?.price;
  if (typeof btcUsd !== "number" || typeof gmtUsd !== "number") {
    throw new Error("GoMining MCP response missing BTC or GMT price");
  }

  return { btcUsd, gmtUsd };
}
