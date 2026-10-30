const REQUEST_TIMEOUT_MILLISECONDS = 30_000;
const GET_TIMEOUT_MILLISECONDS = 15_000;

/** Caps simultaneous requests so one screen's burst of parallel calls can't trip GoMining's Cloudflare rate limit. */
class ConcurrencyGate {
  private active = 0;
  private readonly queue: Array<() => void> = [];
  constructor(private readonly limit: number) {}

  async acquire(): Promise<() => void> {
    if (this.active < this.limit) {
      this.active++;
      return () => this.release();
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    return () => this.release();
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) next();
    else this.active--;
  }
}

const apiRequestGate = new ConcurrencyGate(6);

/** Paces actual request firing to a max rate/sec; the gate alone caps concurrency, not throughput. */
class RateLimiter {
  private timestamps: number[] = [];
  constructor(private readonly maxPerSecond: number) {}

  async wait(): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.timestamps = this.timestamps.filter((timestamp) => now - timestamp < 1000);
      if (this.timestamps.length < this.maxPerSecond) {
        this.timestamps.push(now);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 - (now - this.timestamps[0]) + 5));
    }
  }
}

const apiRateLimiter = new RateLimiter(5);

// ─── Dev-only request instrumentation, mirrors testing/minerwars-live-replay.mjs's counters ───
const DEV_STATS_ENABLED = import.meta.env.DEV;
const requestStats = new Map<string, { count: number; totalMs: number; errors: number }>();
const CLOUDFLARE_1015_PATTERN = /error 1015|you are being rate limited/i;
let rateLimitHit = false;

function pathOf(url: string): string {
  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.origin : undefined);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function recordRequest(
  url: string,
  startedAt: number,
  status: number | null,
  bodyText: string,
): void {
  if (!DEV_STATS_ENABLED) return;
  const key = pathOf(url);
  const entry = requestStats.get(key) ?? { count: 0, totalMs: 0, errors: 0 };
  entry.count++;
  entry.totalMs += performance.now() - startedAt;
  const isError = status == null || status >= 400;
  if (isError) entry.errors++;
  requestStats.set(key, entry);

  if (
    status != null &&
    [403, 429, 503].includes(status) &&
    CLOUDFLARE_1015_PATTERN.test(bodyText)
  ) {
    rateLimitHit = true;
    console.warn(`[rt:api] ⚠ Cloudflare 1015 detected at ${key} (HTTP ${status})`);
  }
}

if (DEV_STATS_ENABLED && typeof window !== "undefined") {
  (window as unknown as { __rtApiStats: () => void }).__rtApiStats = () => {
    const rows = [...requestStats.entries()].sort((left, right) => right[1].count - left[1].count);
    const totalRequests = rows.reduce((sum, [, entry]) => sum + entry.count, 0);
    console.log(
      `[rt:api] ${totalRequests} request(s) across ${rows.length} endpoint(s)` +
        (rateLimitHit ? " — ⚠ Cloudflare 1015 was hit this session" : ""),
    );
    console.table(
      rows.map(([path, entry]) => ({
        path,
        count: entry.count,
        avgMs: Math.round(entry.totalMs / entry.count),
        errors: entry.errors,
      })),
    );
  };
  console.log(
    "[rt:api] Dev request stats enabled — call __rtApiStats() in the console to see the breakdown.",
  );
}

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
  const release = await apiRequestGate.acquire();
  await apiRateLimiter.wait();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MILLISECONDS);
  const startedAt = performance.now();
  let responseReceived = false;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    responseReceived = true;
    recordRequest(url, startedAt, response.status, text);
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
  } catch (error) {
    if (!responseReceived) recordRequest(url, startedAt, null, "");
    throw error;
  } finally {
    release();
    clearTimeout(timeout);
  }
}

export async function getJson<TResponse = unknown>(url: string): Promise<TResponse> {
  const release = await apiRequestGate.acquire();
  await apiRateLimiter.wait();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GET_TIMEOUT_MILLISECONDS);
  const startedAt = performance.now();
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    recordRequest(url, startedAt, response.status, text);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (text ? JSON.parse(text) : null) as TResponse;
  } finally {
    release();
    clearTimeout(timeout);
  }
}

/**
 * GET that parses the body as JSON even on error statuses, throwing only if it is not valid JSON.
 */
export async function getJsonTolerant<TResponse = unknown>(url: string): Promise<TResponse> {
  const release = await apiRequestGate.acquire();
  await apiRateLimiter.wait();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GET_TIMEOUT_MILLISECONDS);
  const startedAt = performance.now();
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    recordRequest(url, startedAt, response.status, text);
    try {
      return (text ? JSON.parse(text) : {}) as TResponse;
    } catch {
      throw new Error(response.ok ? "Invalid JSON response" : `HTTP ${response.status}`);
    }
  } finally {
    release();
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
