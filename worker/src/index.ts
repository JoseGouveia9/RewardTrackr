/**
 * RewardTrackr – Sharing Worker
 *
 * POST /share  { alias: string, data: object }
 *   → writes shared/<id>.json and updates shared/directory.json
 *     in the josegouveia9/rewardtrackr-shared GitHub repo.
 *
 * Environment variables (set in Cloudflare dashboard / wrangler secret):
 *   GITHUB_TOKEN   — fine-grained PAT with contents:write on rewardtrackr-shared
 *   ALLOWED_ORIGIN — e.g. https://josegouveia9.github.io  (defaults to that)
 */

const OWNER = "JoseGouveia9";
const REPO = "rewardtrackr-shared";
const BRANCH = "main";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

interface Env {
  GITHUB_TOKEN: string;
  ALLOWED_ORIGIN?: string;
}

interface ShareBody {
  alias: string;
  data: Record<string, unknown>;
}

interface DirectoryEntry {
  alias: string;
  id: string;
  updatedAt: string;
}

interface GithubFileResponse {
  sha?: string;
  content?: string;
}

// ── helpers ────────────────────────────────────────────────────────────────

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

// Proper UTF-8 → base64 for the GitHub API content field.
function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(b64: string): string {
  const clean = b64.replace(/\n/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function ghFetch(
  token: string,
  path: string,
  method: "GET" | "PUT",
  body?: unknown,
): Promise<Response> {
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

async function getFileSha(token: string, path: string): Promise<string | null> {
  const res = await ghFetch(token, path, "GET");
  if (!res.ok) return null;
  const data = (await res.json()) as GithubFileResponse;
  return data.sha ?? null;
}

async function readFile(token: string, path: string): Promise<string | null> {
  const res = await ghFetch(token, path, "GET");
  if (!res.ok) return null;
  const data = (await res.json()) as GithubFileResponse;
  if (!data.content) return null;
  return fromBase64(data.content);
}

async function writeFile(
  token: string,
  path: string,
  content: string,
  sha: string | null,
): Promise<void> {
  const body: Record<string, unknown> = {
    message: `update ${path}`,
    content: toBase64(content),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;
  const res = await ghFetch(token, path, "PUT", body);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub write failed (${res.status}): ${text}`);
  }
}

// ── main handler ───────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const allowedOrigin = env.ALLOWED_ORIGIN ?? "https://josegouveia9.github.io";
    const ch = corsHeaders(allowedOrigin);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...ch, "Content-Type": "application/json" },
      });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: ch });

    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/share") {
      // ── Parse body ──────────────────────────────────────────────
      let body: ShareBody;
      try {
        body = (await request.json()) as ShareBody;
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      const { alias, data } = body;

      // ── Validate alias ──────────────────────────────────────────
      if (
        typeof alias !== "string" ||
        !/^[a-zA-Z0-9_\-]{1,40}$/.test(alias.trim())
      ) {
        return json({ error: "Invalid alias (letters, numbers, _ and - only; max 40 chars)" }, 400);
      }

      // ── Validate size ───────────────────────────────────────────
      const id = alias.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
      const now = new Date().toISOString();
      const profileJson = JSON.stringify({ alias: alias.trim(), id, updatedAt: now, sheets: data });

      if (new TextEncoder().encode(profileJson).byteLength > MAX_BYTES) {
        return json({ error: "Data too large (max 5 MB)" }, 413);
      }

      const dataPath = `shared/${id}.json`;
      const dirPath = `shared/directory.json`;

      try {
        // ── Write profile file ──────────────────────────────────────
        const dataSha = await getFileSha(env.GITHUB_TOKEN, dataPath);
        await writeFile(env.GITHUB_TOKEN, dataPath, profileJson, dataSha);

        // ── Update directory ────────────────────────────────────────
        const [dirContent, dirSha] = await Promise.all([
          readFile(env.GITHUB_TOKEN, dirPath),
          getFileSha(env.GITHUB_TOKEN, dirPath),
        ]);

        let dir: DirectoryEntry[] = [];
        if (dirContent) {
          try { dir = JSON.parse(dirContent) as DirectoryEntry[]; } catch { dir = []; }
        }

        const entry: DirectoryEntry = { alias: alias.trim(), id, updatedAt: now };
        const idx = dir.findIndex((e) => e.id === id);
        if (idx >= 0) dir[idx] = entry;
        else dir.unshift(entry); // newest first

        await writeFile(
          env.GITHUB_TOKEN,
          dirPath,
          JSON.stringify(dir, null, 2),
          dirSha,
        );

        return json({ ok: true, id, updatedAt: now });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        return json({ error: msg }, 500);
      }
    }

    return json({ error: "Not found" }, 404);
  },
};
