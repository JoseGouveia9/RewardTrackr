// Constants

const REQUEST_TIMEOUT_MS = 30_000;
const GET_TIMEOUT_MS = 15_000;

// Types

interface JwtPayload {
  id?: string;
  sub?: string;
  email?: string;
  alias?: string;
  username?: string;
  name?: string;
  exp?: number;
  iat?: number;
}

// API request helpers

// Builds the auth headers required by the GoMining API.
// Browsers silently drop User-Agent, but the rest are passed through.
export function buildApiHeaders(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "ngsw-bypass": "true",
    "x-device-type": "desktop",
  };
}

// Sends a POST request with a JSON body and returns the parsed response.
// Throws on HTTP errors, extracting the API error message when available.
export async function postJson<TResponse = unknown>(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<TResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      const data = parsed as Record<string, unknown> | null;
      const message =
        (data?.message as string) ||
        (data?.error as string) ||
        text?.slice(0, 300) ||
        `HTTP ${response.status}`;
      throw new Error(message);
    }

    return parsed as TResponse;
  } finally {
    clearTimeout(timeout);
  }
}

// Sends a GET request and returns the parsed JSON response.
// Throws on any non-OK HTTP status.
export async function getJson<TResponse = unknown>(url: string): Promise<TResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GET_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<TResponse>;
  } finally {
    clearTimeout(timeout);
  }
}

// Sends a GET request and attempts to parse JSON regardless of HTTP status.
// Used for APIs that may return partial data or non-standard error bodies.
export async function getJsonTolerant<TResponse = unknown>(url: string): Promise<TResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GET_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    try {
      return (text ? JSON.parse(text) : {}) as TResponse;
    } catch {
      throw new Error(response.ok ? "Invalid JSON response" : `HTTP ${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

// JWT helpers

// Decodes the payload section of a JWT without verifying the signature.
// Returns null if the token is malformed or unparseable.
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = new TextDecoder().decode(Uint8Array.from(atob(payload), (c) => c.charCodeAt(0)));
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}
