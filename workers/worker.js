// ── Shared profiles constants ──────────────────────────────────────────────
const OWNER = "JoseGouveia9";
const REPO = "rewardtrackr-shared";
const BRANCH = "main";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(b64) {
  const clean = b64.replace(/\n/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function ghFetch(token, path, method, body) {
  return fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "User-Agent": "RewardTrackr-Worker/1.0",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function getFileSha(token, path) {
  const res = await ghFetch(token, path, "GET");
  if (!res.ok) return null;
  const data = await res.json();
  return data.sha ?? null;
}

async function readFile(token, path) {
  const res = await ghFetch(token, path, "GET");
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.content) return null;
  return fromBase64(data.content);
}

async function writeFile(token, path, content, sha) {
  const body = { message: `update ${path}`, content: toBase64(content), branch: BRANCH };
  if (sha) body.sha = sha;
  const res = await ghFetch(token, path, "PUT", body);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub write failed (${res.status}): ${text}`);
  }
}

// ── Rate-limit constants ───────────────────────────────────────────────────
const MAX_EXPORTS_PER_DAY = 1;

function getUserId(request) {
  try {
    const auth = request.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return null;
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
    const decoded = JSON.parse(json);
    const id = decoded.id ?? decoded.sub ?? null;
    return id !== null ? String(id) : null;
  } catch {
    return null;
  }
}

const ALLOWED_ORIGIN = "https://josegouveia9.github.io";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Check + increment — called before export starts.
    // Counter goes to 1 immediately to prevent abuse.
    if (url.pathname === "/rl-check") {
      const userId = getUserId(request);
      if (!userId) {
        return new Response(JSON.stringify({ allowed: false, message: "Unauthorized." }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const day = new Date().toISOString().slice(0, 10);
      const key = `rl_${userId}_${day}`;
      const current = await env.RATE_LIMIT.get(key);
      const count = current ? parseInt(current) : 0;

      if (count >= MAX_EXPORTS_PER_DAY) {
        return new Response(
          JSON.stringify({
            allowed: false,
            message: "You have reached your daily export limit. Please try again tomorrow.",
          }),
          {
            status: 429,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          },
        );
      }

      try {
        await env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: 86400 });
      } catch {
        // KV write failed, allow the export anyway
      }

      return new Response(
        JSON.stringify({ allowed: true, used: count + 1, limit: MAX_EXPORTS_PER_DAY }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    // Rollback — called only when the export fails after /rl-check already incremented.
    // Decrements the counter back so the user can retry.
    if (url.pathname === "/rl-rollback") {
      const userId = getUserId(request);
      if (!userId) {
        return new Response(JSON.stringify({ message: "Unauthorized." }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const day = new Date().toISOString().slice(0, 10);
      const key = `rl_${userId}_${day}`;
      const current = await env.RATE_LIMIT.get(key);
      const count = current ? parseInt(current) : 0;

      try {
        const next = Math.max(0, count - 1);
        if (next === 0) {
          await env.RATE_LIMIT.delete(key);
        } else {
          await env.RATE_LIMIT.put(key, String(next), { expirationTtl: 86400 });
        }
      } catch {
        // Non-fatal
      }

      return new Response(JSON.stringify({ rolled_back: true }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Share profile — writes to josegouveia9/rewardtrackr-shared via GitHub API
    if (request.method === "POST" && url.pathname === "/share") {
      const jsonResponse = (body, status = 200) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });

      let body;
      try { body = await request.json(); } catch {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
      }

      const { alias, data } = body;
      if (typeof alias !== "string" || !/^[a-zA-Z0-9_\-]{1,40}$/.test(alias.trim())) {
        return jsonResponse({ error: "Invalid alias (letters, numbers, _ and - only; max 40 chars)" }, 400);
      }

      const id = alias.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
      const now = new Date().toISOString();
      const profileJson = JSON.stringify({ alias: alias.trim(), id, updatedAt: now, sheets: data });

      if (new TextEncoder().encode(profileJson).byteLength > MAX_BYTES) {
        return jsonResponse({ error: "Data too large (max 5 MB)" }, 413);
      }

      try {
        const dataPath = `shared/${id}.json`;
        const dirPath = `shared/directory.json`;

        const dataSha = await getFileSha(env.GITHUB_TOKEN, dataPath);
        await writeFile(env.GITHUB_TOKEN, dataPath, profileJson, dataSha);

        const [dirContent, dirSha] = await Promise.all([
          readFile(env.GITHUB_TOKEN, dirPath),
          getFileSha(env.GITHUB_TOKEN, dirPath),
        ]);

        let dir = [];
        if (dirContent) { try { dir = JSON.parse(dirContent); } catch { dir = []; } }

        const entry = { alias: alias.trim(), id, updatedAt: now };
        const idx = dir.findIndex((e) => e.id === id);
        if (idx >= 0) dir[idx] = entry;
        else dir.unshift(entry);

        await writeFile(env.GITHUB_TOKEN, dirPath, JSON.stringify(dir, null, 2), dirSha);
        return jsonResponse({ ok: true, id, updatedAt: now });
      } catch (e) {
        return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
      }
    }

    // Requests under /se/ — proxy to api.se.gomining.com (strips the /se prefix)
    if (url.pathname.startsWith("/se/")) {
      const target = new URL("https://api.se.gomining.com" + url.pathname.slice(3) + url.search);

      const apiRequest = new Request(target, {
        method: request.method,
        headers: request.headers,
        body: request.method !== "GET" && request.method !== "HEAD" ? request.body : null,
      });

      const response = await fetch(apiRequest);

      const newHeaders = new Headers(response.headers);
      newHeaders.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);

      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      });
    }

    // All other requests — proxy to GoMining API freely
    const target = new URL("https://api.gomining.com" + url.pathname + url.search);

    const apiRequest = new Request(target, {
      method: request.method,
      headers: request.headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : null,
    });

    const response = await fetch(apiRequest);

    const newHeaders = new Headers(response.headers);
    newHeaders.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  },
};
