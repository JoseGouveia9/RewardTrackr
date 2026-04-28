const REQUEST_TIMEOUT_MS = 30_000;
const GET_TIMEOUT_MS = 15_000;

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
