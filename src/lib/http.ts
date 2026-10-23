const REQUEST_TIMEOUT_MILLISECONDS = 30_000;
const GET_TIMEOUT_MILLISECONDS = 15_000;

/**
 * Picks the env override, else the same-origin proxy path on rewardtrackr.com, else the direct
 * API URL.
 */
function resolveBase(
  environmentBase: string | undefined,
  proxyPath: string,
  fallback: string,
): string {
  const fromEnvironment = environmentBase?.replace(/\/$/, "");
  if (fromEnvironment) return fromEnvironment;

  if (typeof window !== "undefined" && /(^|\.)rewardtrackr\.com$/i.test(window.location.hostname)) {
    return `${window.location.origin}${proxyPath}`;
  }

  return fallback;
}

export function resolveApiBase(): string {
  return resolveBase(
    import.meta.env.VITE_API_BASE as string | undefined,
    "",
    "https://api.gomining.com",
  );
}

export function resolveBonusMinerApiBase(): string {
  return resolveBase(
    import.meta.env.VITE_BONUS_MINER_API_BASE as string | undefined,
    "/gomining-api/bm",
    "https://api.bonus-miner.gomining.com",
  );
}

/**
 * MEXC sends no CORS headers, so browsers always reach it through a same-origin /mexc proxy (the
 * Vite dev/preview server locally, the Worker on rewardtrackr.com); only non-browser callers go direct.
 */
export function resolveMexcApiBase(): string {
  const fromEnvironment = (import.meta.env.VITE_MEXC_API_BASE as string | undefined)?.replace(
    /\/$/,
    "",
  );
  if (fromEnvironment) return fromEnvironment;
  return typeof window !== "undefined" ? `${window.location.origin}/mexc` : "https://api.mexc.com";
}

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

export function buildApiHeaders(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "ngsw-bypass": "true",
    "x-device-type": "desktop",
  };
}

/**
 * POSTs JSON with a 30s timeout; non-2xx throws the API message and a 401 fires the
 * rt:session-expired event.
 */
export async function postJson<TResponse = unknown>(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<TResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MILLISECONDS);

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
      if (response.status === 401) {
        window.dispatchEvent(new CustomEvent("rt:session-expired"));
      }
      throw new Error(message);
    }

    return parsed as TResponse;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getJson<TResponse = unknown>(url: string): Promise<TResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GET_TIMEOUT_MILLISECONDS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<TResponse>;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * GET that parses the body as JSON even on error statuses, throwing only if it is not valid JSON.
 */
export async function getJsonTolerant<TResponse = unknown>(url: string): Promise<TResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GET_TIMEOUT_MILLISECONDS);
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

/** Decodes the JWT payload without verifying the signature; null when malformed. */
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(payload), (character) => character.charCodeAt(0)),
    );
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}
