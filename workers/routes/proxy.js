/** Forwards the request upstream and swaps in our CORS origin header on the response. */
async function relay(corsHeaders, input, init) {
  const response = await fetch(input, init);

  const newHeaders = new Headers(response.headers);
  newHeaders.set("Access-Control-Allow-Origin", corsHeaders["Access-Control-Allow-Origin"]);

  return new Response(response.body, {
    status: response.status,
    headers: newHeaders,
  });
}

/**
 * Relays the incoming request to `target`, dropping cookies so browser credentials never reach
 * GoMining.
 */
function relayRequest(target, request, corsHeaders) {
  const headers = new Headers(request.headers);
  headers.delete("Cookie");

  return relay(
    corsHeaders,
    new Request(target, {
      method: request.method,
      headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : null,
    }),
  );
}

export async function handleSeProxy({ url, request, corsHeaders }) {
  if (!url.pathname.startsWith("/se/")) return null;

  const target = new URL("https://api.se.gomining.com" + url.pathname.slice(3) + url.search);
  return relayRequest(target, request, corsHeaders);
}

export async function handleBonusMinerProxy({ url, request, corsHeaders }) {
  if (!url.pathname.startsWith("/bm/")) return null;

  const target = new URL(
    "https://api.bonus-miner.gomining.com" + url.pathname.slice(3) + url.search,
  );
  return relayRequest(target, request, corsHeaders);
}

/** CryptoCompare sends no CORS headers; the API key stays server-side. */
export async function handleCryptoCompareProxy({ url, corsHeaders, environment }) {
  if (!url.pathname.startsWith("/cc/data/")) return null;

  const target = new URL("https://min-api.cryptocompare.com" + url.pathname.slice(3) + url.search);
  const headers = environment.CRYPTOCOMPARE_API_KEY
    ? { Authorization: `Apikey ${environment.CRYPTOCOMPARE_API_KEY}` }
    : {};
  return relay(corsHeaders, target, { method: "GET", headers });
}

export async function handleDefaultProxy({ url, request, corsHeaders }) {
  if (!url.pathname.startsWith("/api/")) return new Response("Not found", { status: 404 });

  const target = new URL("https://api.gomining.com" + url.pathname + url.search);
  return relayRequest(target, request, corsHeaders);
}
