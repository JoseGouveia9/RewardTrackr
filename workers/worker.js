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

async function deleteFile(token, path, sha) {
  if (!sha) return;
  const body = { message: `delete ${path}`, sha, branch: BRANCH };
  const res = await ghFetch(token, path, "DELETE", body);
  if (res.status === 404) return;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub delete failed (${res.status}): ${text}`);
  }
}

// ── Rate-limit constants ───────────────────────────────────────────────────
const MAX_EXPORTS_PER_DAY = 1;
const MAX_SHARES_PER_DAY = MAX_EXPORTS_PER_DAY;

const SHARE_ALLOWED_KEYS = new Set([
  "solo-mining",
  "minerwars",
  "bounty",
  "referrals",
  "ambassador",
  "deposits",
  "withdrawals",
  "purchases",
  "upgrades",
  "transactions",
  "simple-earn",
]);

const SHARE_FIELDS_BY_KEY = {
  "solo-mining": [
    "createdAt",
    "currency",
    "poolReward",
    "poolRewardGMT",
    "poolRewardUSD",
    "poolRewardFiat",
    "maintenance",
    "maintenanceGMT",
    "maintenanceUSD",
    "maintenanceFiat",
    "reward",
    "rewardGMT",
    "rewardInUSD",
    "rewardInFiat",
    "totalPower",
    "discount",
  ],
  minerwars: [
    "createdAt",
    "currency",
    "poolReward",
    "poolRewardGMT",
    "poolRewardUSD",
    "poolRewardFiat",
    "maintenance",
    "maintenanceGMT",
    "maintenanceUSD",
    "maintenanceFiat",
    "reward",
    "rewardGMT",
    "rewardInUSD",
    "rewardInFiat",
    "totalPower",
    "discount",
  ],
  bounty: ["createdAt", "currency", "reward", "rewardInUSD", "rewardInUsd", "rewardInFiat"],
  referrals: [
    "createdAt",
    "currency",
    "reward",
    "rewardInUSD",
    "rewardInUsd",
    "rewardInFiat",
  ],
  ambassador: [
    "createdAt",
    "currency",
    "reward",
    "rewardInUSD",
    "rewardInUsd",
    "rewardInFiat",
  ],
  deposits: ["createdAt", "currency", "reward", "rewardInUSD", "rewardInUsd", "rewardInFiat"],
  withdrawals: ["createdAt", "currency", "reward", "rewardInUSD", "rewardInUsd", "rewardInFiat"],
  purchases: ["createdAt", "type", "currency", "reward", "valueUsd", "valueFiat"],
  upgrades: ["createdAt", "type", "currency", "reward", "valueUsd", "valueFiat"],
  transactions: [
    "createdAt",
    "txType",
    "fromType",
    "reward",
    "rewardInUSD",
    "rewardInUsd",
    "rewardInFiat",
  ],
  "simple-earn": [
    "createdAt",
    "asset",
    "currency",
    "apr",
    "reward",
    "rewardInUSD",
    "rewardInUsd",
    "rewardInFiat",
  ],
};

const STRING_FIELDS = new Set([
  "createdAt",
  "currency",
  "asset",
  "type",
  "txType",
  "fromType",
]);

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function sanitizeString(value, maxLen = 80) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

function sanitizeRecord(record, allowedFields) {
  if (!isPlainObject(record)) return null;

  const out = {};
  for (const field of allowedFields) {
    if (!(field in record)) continue;
    if (STRING_FIELDS.has(field)) {
      const value = sanitizeString(record[field], field === "createdAt" ? 40 : 40);
      if (value) out[field] = value;
      continue;
    }
    out[field] = sanitizeNumber(record[field]);
  }

  if (!out.createdAt) return null;
  return out;
}

function sanitizeSheetsPayload(rawData) {
  if (!isPlainObject(rawData)) return {};

  const sanitized = {};
  for (const [rawKey, rawEntry] of Object.entries(rawData)) {
    const key = String(rawKey);
    if (!SHARE_ALLOWED_KEYS.has(key)) continue;
    if (!isPlainObject(rawEntry)) continue;

    const allowedFields = SHARE_FIELDS_BY_KEY[key] ?? [];
    const rawRecords = Array.isArray(rawEntry.records) ? rawEntry.records : [];
    const records = [];

    for (const record of rawRecords) {
      const clean = sanitizeRecord(record, allowedFields);
      if (clean) records.push(clean);
    }

    sanitized[key] = {
      sheetName: sanitizeString(rawEntry.sheetName, 120) || key,
      fetchedAt: sanitizeNumber(rawEntry.fetchedAt || Date.now()),
      records,
    };
  }

  return sanitized;
}

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
    const id = decoded.id ?? null;
    return id !== null ? String(id) : null;
  } catch {
    return null;
  }
}

const ALLOWED_ORIGINS = new Set([
  "https://josegouveia9.github.io",
  "http://localhost:5173",
  "http://localhost:4173",
]);

function corsHeaders(request) {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "https://josegouveia9.github.io";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const CORS_HEADERS = corsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Check + increment: called before export starts.
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

    // Rollback: called only when the export fails after /rl-check already incremented.
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

    // Share profile: writes to josegouveia9/rewardtrackr-shared via GitHub API
    if (request.method === "POST" && url.pathname === "/share") {
      const jsonResponse = (body, status = 200) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });

      const userId = getUserId(request);
      if (!userId) {
        return jsonResponse({ error: "Unauthorized." }, 401);
      }

      let body;
      try { body = await request.json(); } catch {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
      }

      const { alias, data } = body;
      if (typeof alias !== "string" || !/^[a-zA-Z0-9_\-]{1,40}$/.test(alias.trim())) {
        return jsonResponse({ error: "Invalid alias (letters, numbers, _ and - only; max 40 chars)" }, 400);
      }

      const requestedId = alias.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
      const userProfileKey = `share_profile_${userId}`;
      const existingProfileId = await env.RATE_LIMIT.get(userProfileKey);
      const id = requestedId;
      const now = new Date().toISOString();

      const ownerKey = `share_owner_${id}`;
      const existingOwnerId = await env.RATE_LIMIT.get(ownerKey);
      if (existingOwnerId && existingOwnerId !== userId) {
        return jsonResponse({ error: "This alias is already locked to another user." }, 403);
      }

      if (existingProfileId) {
        const previousOwnerKey = `share_owner_${existingProfileId}`;
        const previousOwnerId = await env.RATE_LIMIT.get(previousOwnerKey);
        if (previousOwnerId && previousOwnerId !== userId) {
          return jsonResponse({ error: "Current shared profile owner mismatch." }, 403);
        }
      }

      const day = new Date().toISOString().slice(0, 10);
      const shareLimitKey = `share_${userId}_${day}`;
      const current = await env.RATE_LIMIT.get(shareLimitKey);
      const count = current ? parseInt(current) : 0;
      if (count >= MAX_SHARES_PER_DAY) {
        return jsonResponse(
          {
            error: "You have reached your daily share limit. Please try again tomorrow.",
          },
          429,
        );
      }

      const sheets = sanitizeSheetsPayload(data);
      const keys = Object.keys(sheets);
      if (keys.length === 0) {
        return jsonResponse({ error: "No valid sheets to share." }, 400);
      }

      const profileJson = JSON.stringify({
        alias: alias.trim(),
        id,
        ownerId: userId,
        updatedAt: now,
        sheets,
      });

      if (new TextEncoder().encode(profileJson).byteLength > MAX_BYTES) {
        return jsonResponse({ error: "Data too large (max 5 MB)" }, 413);
      }

      let shareIncremented = false;
      try {
        await env.RATE_LIMIT.put(shareLimitKey, String(count + 1), { expirationTtl: 86400 });
        shareIncremented = true;

        const dataPath = `shared/${id}.json`;
        const dirPath = `shared/directory.json`;

        const dataSha = await getFileSha(env.GITHUB_TOKEN, dataPath);
        await writeFile(env.GITHUB_TOKEN, dataPath, profileJson, dataSha);

        if (existingProfileId && existingProfileId !== id) {
          const previousDataPath = `shared/${existingProfileId}.json`;
          const previousSha = await getFileSha(env.GITHUB_TOKEN, previousDataPath);
          await deleteFile(env.GITHUB_TOKEN, previousDataPath, previousSha);
          await env.RATE_LIMIT.delete(`share_owner_${existingProfileId}`);
        }

        const [dirContent, dirSha] = await Promise.all([
          readFile(env.GITHUB_TOKEN, dirPath),
          getFileSha(env.GITHUB_TOKEN, dirPath),
        ]);

        let dir = [];
        if (dirContent) { try { dir = JSON.parse(dirContent); } catch { dir = []; } }

        const entry = { alias: alias.trim(), id, ownerId: userId, updatedAt: now };
        const idx = dir.findIndex(
          (e) => e.id === id || e.ownerId === userId || e.id === existingProfileId,
        );
        if (idx >= 0) dir[idx] = entry;
        else dir.unshift(entry);

        await writeFile(env.GITHUB_TOKEN, dirPath, JSON.stringify(dir, null, 2), dirSha);
        await env.RATE_LIMIT.put(ownerKey, userId);
        await env.RATE_LIMIT.put(userProfileKey, id);
        return jsonResponse({ ok: true, id, updatedAt: now });
      } catch (e) {
        if (shareIncremented) {
          try {
            const latest = await env.RATE_LIMIT.get(shareLimitKey);
            const latestCount = latest ? parseInt(latest) : 0;
            const next = Math.max(0, latestCount - 1);
            if (next === 0) await env.RATE_LIMIT.delete(shareLimitKey);
            else await env.RATE_LIMIT.put(shareLimitKey, String(next), { expirationTtl: 86400 });
          } catch {
            // Non-fatal rollback failure
          }
        }
        return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
      }
    }

    // Requests under /se/: proxy to api.se.gomining.com (strips the /se prefix)
    if (url.pathname.startsWith("/se/")) {
      const target = new URL("https://api.se.gomining.com" + url.pathname.slice(3) + url.search);

      const apiRequest = new Request(target, {
        method: request.method,
        headers: request.headers,
        body: request.method !== "GET" && request.method !== "HEAD" ? request.body : null,
      });

      const response = await fetch(apiRequest);

      const newHeaders = new Headers(response.headers);
      newHeaders.set("Access-Control-Allow-Origin", CORS_HEADERS["Access-Control-Allow-Origin"]);

      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      });
    }

    // All other requests: proxy to GoMining API freely
    const target = new URL("https://api.gomining.com" + url.pathname + url.search);

    const apiRequest = new Request(target, {
      method: request.method,
      headers: request.headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : null,
    });

    const response = await fetch(apiRequest);

    const newHeaders = new Headers(response.headers);
    newHeaders.set("Access-Control-Allow-Origin", CORS_HEADERS["Access-Control-Allow-Origin"]);

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  },
};
