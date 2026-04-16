export async function handleSeProxy({ url, request, corsHeaders }) {
  if (!url.pathname.startsWith("/se/")) return null;

  const target = new URL("https://api.se.gomining.com" + url.pathname.slice(3) + url.search);

  const apiRequest = new Request(target, {
    method: request.method,
    headers: request.headers,
    body: request.method !== "GET" && request.method !== "HEAD" ? request.body : null,
  });

  const response = await fetch(apiRequest);

  const newHeaders = new Headers(response.headers);
  newHeaders.set("Access-Control-Allow-Origin", corsHeaders["Access-Control-Allow-Origin"]);

  return new Response(response.body, {
    status: response.status,
    headers: newHeaders,
  });
}

export async function handleDefaultProxy({ url, request, corsHeaders }) {
  const target = new URL("https://api.gomining.com" + url.pathname + url.search);

  const apiRequest = new Request(target, {
    method: request.method,
    headers: request.headers,
    body: request.method !== "GET" && request.method !== "HEAD" ? request.body : null,
  });

  const response = await fetch(apiRequest);

  const newHeaders = new Headers(response.headers);
  newHeaders.set("Access-Control-Allow-Origin", corsHeaders["Access-Control-Allow-Origin"]);

  return new Response(response.body, {
    status: response.status,
    headers: newHeaders,
  });
}
