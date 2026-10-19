const TOKEN_URL = "https://mcp-auth.gomining.com/token";
const MCP_URL = "https://mcp.gomining.com/mcp";
const OAUTH_KV_KEY = "gomining:oauth";

const EXPIRY_SAFETY_MARGIN_MILLISECONDS = 5 * 60 * 1000;

/**
 * Returns a cached access token, refreshing it a few minutes before expiry so it can't lapse mid-request.
 * GoMining rotates the refresh token on every refresh, so the new one is persisted to KV.
 */
async function getValidAccessToken(environment) {
  if (!environment.PRICE_HISTORY) throw new Error("PRICE_HISTORY KV binding is not configured");
  if (!environment.GOMINING_MCP_CLIENT_ID)
    throw new Error("GOMINING_MCP_CLIENT_ID is not configured");

  const raw = await environment.PRICE_HISTORY.get(OAUTH_KV_KEY);
  if (!raw) throw new Error("GoMining MCP is not authorized yet (missing gomining:oauth in KV)");

  const stored = JSON.parse(raw);
  if (
    stored.accessToken &&
    stored.accessTokenExpiresAt > Date.now() + EXPIRY_SAFETY_MARGIN_MILLISECONDS
  ) {
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
      client_id: environment.GOMINING_MCP_CLIENT_ID,
    }),
  });

  if (!response.ok) {
    throw new Error(`GoMining token refresh failed: ${response.status}`);
  }

  const tokens = await response.json();
  await environment.PRICE_HISTORY.put(
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
 * Responses are SSE-framed (`event: message\ndata: {...}`), so the JSON is read from the data
 * line.
 */
async function callMcp(accessToken, method, parameters) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${accessToken}`,
      "user-agent": "RewardTrackr/1.0 (+https://rewardtrackr.com)",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: parameters }),
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

/** Needs a one-time OAuth authorization that seeds the `gomining:oauth` KV entry. */
export async function getTickerPricesFromGoMining(environment) {
  const accessToken = await getValidAccessToken(environment);
  const result = await callMcp(accessToken, "tools/call", {
    name: "get_ticker_prices",
    arguments: { symbols: ["BTC", "GMT"], ticker_type: "crypto" },
  });

  const text = result?.content?.[0]?.text;
  if (!text) throw new Error("GoMining MCP response missing ticker content");

  const { tickers } = JSON.parse(text);
  const btcUsd = tickers?.find((ticker) => ticker.symbol === "BTC")?.price;
  const gmtUsd = tickers?.find((ticker) => ticker.symbol === "GMT")?.price;
  if (typeof btcUsd !== "number" || typeof gmtUsd !== "number") {
    throw new Error("GoMining MCP response missing BTC or GMT price");
  }

  return { btcUsd, gmtUsd };
}
