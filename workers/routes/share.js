import { resolveVerifiedUser } from "../lib/auth.js";
import { decrementCount, readCount, utcDay } from "../lib/counter.js";
import {
  deleteFile,
  getFileSha,
  readDirectoryEntries,
  readFile,
  writeFile,
} from "../lib/github.js";
import { resolveProfileIdForUser } from "../lib/share-store.js";
import { sanitizeSheetsPayload } from "../lib/sanitize.js";

const RESERVED_ID = "directory";

/**
 * Wraps a stored profile into the `/share/me` shape; unparseable content falls back to defaults.
 */
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
    return {
      exists: true,
      id: fallbackId,
      alias: fallbackId,
      updatedAt: null,
      communityVisible: true,
    };
  }
}

/** Lists the community index (`shared/directory.json`) from the shared GitHub repo. */
async function handleDirectory({ environment, jsonResponse }) {
  try {
    const { directoryEntries } = await readDirectoryEntries(environment.GITHUB_TOKEN);
    return jsonResponse(Array.isArray(directoryEntries) ? directoryEntries : []);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to load directory" },
      500,
    );
  }
}

/**
 * Returns the caller's own shared profile summary. A cached KV mapping that points at a missing file
 * is dropped and re-resolved from the directory.
 */
async function handleGetMine({ request, environment, jsonResponse }) {
  const userId = await resolveVerifiedUser(request);
  if (!userId) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const id = await resolveProfileIdForUser(environment, userId);
  if (!id) {
    return jsonResponse({ exists: false });
  }

  const [{ directoryEntries }, content] = await Promise.all([
    readDirectoryEntries(environment.GITHUB_TOKEN),
    readFile(environment.GITHUB_TOKEN, `shared/${id}.json`),
  ]);

  const directoryEntry = Array.isArray(directoryEntries)
    ? directoryEntries.find((candidate) => candidate.id === id || candidate.ownerId === userId)
    : null;

  let response;
  if (content) {
    response = buildMyShareResponse(content, id);
  } else {
    await environment.RATE_LIMIT.delete(`share_profile_${userId}`);
    await environment.RATE_LIMIT.delete(`share_owner_${id}`);

    const recoveredId = await resolveProfileIdForUser(environment, userId);
    if (!recoveredId || recoveredId === id) {
      return jsonResponse({ exists: false });
    }

    const recoveredContent = await readFile(environment.GITHUB_TOKEN, `shared/${recoveredId}.json`);
    if (!recoveredContent) {
      return jsonResponse({ exists: false });
    }
    response = buildMyShareResponse(recoveredContent, recoveredId);
  }

  if (directoryEntry?.updatedAt) response.updatedAt = directoryEntry.updatedAt;
  return jsonResponse(response);
}

/**
 * Public profile read for `/share/:id`. Returns null for the reserved id `directory`,
 * which is the community index file and not a profile.
 */
async function handleGetProfile({ url, environment, jsonResponse }) {
  const id = url.pathname
    .slice("/share/".length)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  if (!id || id === RESERVED_ID) {
    return null;
  }

  const [{ directoryEntries }, content] = await Promise.all([
    readDirectoryEntries(environment.GITHUB_TOKEN),
    readFile(environment.GITHUB_TOKEN, `shared/${id}.json`),
  ]);

  if (!content) {
    return jsonResponse({ error: `No shared profile found for "${id}"` }, 404);
  }

  try {
    const profile = JSON.parse(content);
    const directoryEntry = Array.isArray(directoryEntries)
      ? directoryEntries.find((candidate) => candidate.id === id)
      : null;
    if (directoryEntry?.updatedAt) profile.updatedAt = directoryEntry.updatedAt;
    return jsonResponse(profile);
  } catch {
    return jsonResponse({ error: "Shared profile data is invalid" }, 500);
  }
}

/** Removes the caller's profile file and directory entry, then clears its KV ownership keys. */
async function handleDeleteMine({ request, environment, jsonResponse }) {
  const userId = await resolveVerifiedUser(request);
  if (!userId) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const id = await resolveProfileIdForUser(environment, userId);
  if (!id) {
    return jsonResponse({ deleted: false, exists: false });
  }

  try {
    const path = `shared/${id}.json`;
    const sha = await getFileSha(environment.GITHUB_TOKEN, path);
    await deleteFile(environment.GITHUB_TOKEN, path, sha);

    const { directoryPath, directorySha, directoryEntries } = await readDirectoryEntries(
      environment.GITHUB_TOKEN,
      {
        withSha: true,
      },
    );
    const filteredDirectoryEntries = Array.isArray(directoryEntries)
      ? directoryEntries.filter((entry) => entry?.id !== id && entry?.ownerId !== userId)
      : [];
    await writeFile(
      environment.GITHUB_TOKEN,
      directoryPath,
      JSON.stringify(filteredDirectoryEntries, null, 2),
      directorySha,
    );

    await environment.RATE_LIMIT.delete(`share_owner_${id}`);
    await environment.RATE_LIMIT.delete(`share_profile_${userId}`);

    return jsonResponse({ deleted: true, id });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}

/**
 * Publishes a sanitised profile and upserts the directory index; aliases are locked to their first owner.
 * The daily share count is taken before the GitHub writes and rolled back if they fail.
 */
async function handleCreate({ request, environment, jsonResponse, maxBytes, maxSharesPerDay }) {
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
    return jsonResponse(
      { error: "Invalid alias (letters, numbers, _ and - only; max 40 chars)" },
      400,
    );
  }

  const isCommunityVisible = communityVisible !== false;

  const id = alias
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  if (id === RESERVED_ID) {
    return jsonResponse({ error: "This alias is reserved." }, 400);
  }

  const now = new Date().toISOString();

  const userProfileKey = `share_profile_${userId}`;
  const ownerKey = `share_owner_${id}`;
  const shareLimitKey = `share_${userId}_${utcDay()}`;

  const [existingOwnerId, count] = await Promise.all([
    environment.RATE_LIMIT.get(ownerKey),
    readCount(environment.RATE_LIMIT, shareLimitKey),
  ]);

  if (existingOwnerId && existingOwnerId !== userId) {
    return jsonResponse({ error: "This alias is already locked to another user." }, 403);
  }

  if (count >= maxSharesPerDay) {
    return jsonResponse(
      {
        error: "You have reached your daily share limit. Please try again tomorrow.",
      },
      429,
    );
  }

  const sheets = sanitizeSheetsPayload(data);
  if (Object.keys(sheets).length === 0) {
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
    await environment.RATE_LIMIT.put(shareLimitKey, String(count + 1), { expirationTtl: 86400 });
    shareIncremented = true;

    const dataPath = `shared/${id}.json`;

    const dataSha = await getFileSha(environment.GITHUB_TOKEN, dataPath);
    await writeFile(environment.GITHUB_TOKEN, dataPath, profileJson, dataSha);

    const { directoryPath, directorySha, directoryEntries } = await readDirectoryEntries(
      environment.GITHUB_TOKEN,
      {
        withSha: true,
      },
    );

    const entry = {
      alias: alias.trim(),
      id,
      ownerId: userId,
      updatedAt: now,
      communityVisible: isCommunityVisible,
    };
    const existingIndex = directoryEntries.findIndex(
      (candidate) => candidate.id === id || candidate.ownerId === userId,
    );
    if (existingIndex >= 0) directoryEntries[existingIndex] = entry;
    else directoryEntries.unshift(entry);

    await writeFile(
      environment.GITHUB_TOKEN,
      directoryPath,
      JSON.stringify(directoryEntries, null, 2),
      directorySha,
    );
    await environment.RATE_LIMIT.put(ownerKey, userId);
    await environment.RATE_LIMIT.put(userProfileKey, id);
    return jsonResponse({ ok: true, id, updatedAt: now });
  } catch (error) {
    if (shareIncremented) {
      try {
        await decrementCount(environment.RATE_LIMIT, shareLimitKey);
      } catch {}
    }
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}

/**
 * Dispatches `/share*` requests to their handlers; returns null when the path/method isn't ours.
 */
export async function handleShareRoutes({
  url,
  request,
  environment,
  jsonResponse,
  maxBytes,
  maxSharesPerDay,
}) {
  const routeContext = { url, request, environment, jsonResponse };
  const { pathname } = url;

  if (pathname === "/share/directory" && request.method === "GET")
    return handleDirectory(routeContext);
  if (pathname === "/share/me" && request.method === "GET") return handleGetMine(routeContext);
  if (request.method === "GET" && pathname.startsWith("/share/"))
    return handleGetProfile(routeContext);
  if (pathname === "/share/me" && request.method === "DELETE")
    return handleDeleteMine(routeContext);
  if (pathname === "/share" && request.method === "POST") {
    return handleCreate({ ...routeContext, maxBytes, maxSharesPerDay });
  }

  return null;
}
