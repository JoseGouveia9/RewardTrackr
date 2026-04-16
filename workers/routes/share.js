import { resolveVerifiedUser } from "../lib/auth.js";
import {
  deleteFile,
  getFileSha,
  readDirectoryEntries,
  readFile,
  writeFile,
} from "../lib/github.js";
import { resolveProfileIdForUser } from "../lib/share-store.js";
import { sanitizeSheetsPayload } from "../lib/sanitize.js";

function buildMyShareResponse(content, fallbackId) {
  try {
    const parsed = JSON.parse(content);
    return {
      exists: true,
      id: fallbackId,
      alias: typeof parsed.alias === "string" ? parsed.alias : fallbackId,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      communityVisible: parsed?.communityVisible !== false,
    };
  } catch {
    return { exists: true, id: fallbackId, alias: fallbackId, updatedAt: null, communityVisible: true };
  }
}

export async function handleShareRoutes({
  url,
  request,
  env,
  jsonResponse,
  maxBytes,
  maxSharesPerDay,
}) {
  if (url.pathname === "/share/directory" && request.method === "GET") {
    try {
      const { dir } = await readDirectoryEntries(env.GITHUB_TOKEN);
      return jsonResponse(Array.isArray(dir) ? dir : []);
    } catch (e) {
      return jsonResponse({ error: e instanceof Error ? e.message : "Failed to load directory" }, 500);
    }
  }

  if (url.pathname === "/share/me" && request.method === "GET") {
    const userId = await resolveVerifiedUser(request);
    if (!userId) {
      return jsonResponse({ error: "Unauthorized." }, 401);
    }

    const id = await resolveProfileIdForUser(env, userId);
    if (!id) {
      return jsonResponse({ exists: false });
    }

    const path = `shared/${id}.json`;
    const content = await readFile(env.GITHUB_TOKEN, path);
    if (!content) {
      const profileKey = `share_profile_${userId}`;
      await env.RATE_LIMIT.delete(profileKey);
      await env.RATE_LIMIT.delete(`share_owner_${id}`);

      const recoveredId = await resolveProfileIdForUser(env, userId);
      if (!recoveredId || recoveredId === id) {
        return jsonResponse({ exists: false });
      }

      const recoveredPath = `shared/${recoveredId}.json`;
      const recoveredContent = await readFile(env.GITHUB_TOKEN, recoveredPath);
      if (!recoveredContent) {
        return jsonResponse({ exists: false });
      }

      return jsonResponse(buildMyShareResponse(recoveredContent, recoveredId));
    }

    return jsonResponse(buildMyShareResponse(content, id));
  }

  if (request.method === "GET" && url.pathname.startsWith("/share/")) {
    const id = url.pathname.slice("/share/".length).toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!id || id === "directory") {
      return null;
    }

    const path = `shared/${id}.json`;
    const content = await readFile(env.GITHUB_TOKEN, path);
    if (!content) {
      return jsonResponse({ error: `No shared profile found for "${id}"` }, 404);
    }

    try {
      return jsonResponse(JSON.parse(content));
    } catch {
      return jsonResponse({ error: "Shared profile data is invalid" }, 500);
    }
  }

  if (url.pathname === "/share/me" && request.method === "DELETE") {
    const userId = await resolveVerifiedUser(request);
    if (!userId) {
      return jsonResponse({ error: "Unauthorized." }, 401);
    }

    const profileKey = `share_profile_${userId}`;
    const id = await resolveProfileIdForUser(env, userId);
    if (!id) {
      return jsonResponse({ deleted: false, exists: false });
    }

    try {
      const path = `shared/${id}.json`;
      const sha = await getFileSha(env.GITHUB_TOKEN, path);
      await deleteFile(env.GITHUB_TOKEN, path, sha);

      const { dirPath, dirSha, dir } = await readDirectoryEntries(env.GITHUB_TOKEN, { withSha: true });
      const filteredDir = Array.isArray(dir)
        ? dir.filter((entry) => entry?.id !== id && entry?.ownerId !== userId)
        : [];
      await writeFile(env.GITHUB_TOKEN, dirPath, JSON.stringify(filteredDir, null, 2), dirSha);

      await env.RATE_LIMIT.delete(`share_owner_${id}`);
      await env.RATE_LIMIT.delete(profileKey);

      return jsonResponse({ deleted: true, id });
    } catch (e) {
      return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
    }
  }

  if (request.method === "POST" && url.pathname === "/share") {
    const userId = await resolveVerifiedUser(request);
    if (!userId) {
      return jsonResponse({ error: "Unauthorized." }, 401);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const { alias, data, communityVisible } = body;
    if (typeof alias !== "string" || !/^[a-zA-Z0-9_-]{1,40}$/.test(alias.trim())) {
      return jsonResponse({ error: "Invalid alias (letters, numbers, _ and - only; max 40 chars)" }, 400);
    }

    const isCommunityVisible = communityVisible !== false;

    const id = alias.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const now = new Date().toISOString();
    const day = now.slice(0, 10);

    const userProfileKey = `share_profile_${userId}`;
    const ownerKey = `share_owner_${id}`;
    const shareLimitKey = `share_${userId}_${day}`;

    const [existingOwnerId, current] = await Promise.all([
      env.RATE_LIMIT.get(ownerKey),
      env.RATE_LIMIT.get(shareLimitKey),
    ]);

    if (existingOwnerId && existingOwnerId !== userId) {
      return jsonResponse({ error: "This alias is already locked to another user." }, 403);
    }

    const count = current ? parseInt(current) : 0;
    if (count >= maxSharesPerDay) {
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
      communityVisible: isCommunityVisible,
      sheets,
    });

    if (new TextEncoder().encode(profileJson).byteLength > maxBytes) {
      return jsonResponse({ error: "Data too large (max 5 MB)" }, 413);
    }

    let shareIncremented = false;
    try {
      await env.RATE_LIMIT.put(shareLimitKey, String(count + 1), { expirationTtl: 86400 });
      shareIncremented = true;

      const dataPath = `shared/${id}.json`;

      const dataSha = await getFileSha(env.GITHUB_TOKEN, dataPath);
      await writeFile(env.GITHUB_TOKEN, dataPath, profileJson, dataSha);

      const { dirPath, dirSha, dir } = await readDirectoryEntries(env.GITHUB_TOKEN, { withSha: true });

      const entry = {
        alias: alias.trim(),
        id,
        ownerId: userId,
        updatedAt: now,
        communityVisible: isCommunityVisible,
      };
      const idx = dir.findIndex((e) => e.id === id || e.ownerId === userId);
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

  return null;
}
