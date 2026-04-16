import { readDirectoryEntries } from "./github.js";

export async function resolveProfileIdForUser(env, userId) {
  const profileKey = `share_profile_${userId}`;
  const kvId = await env.RATE_LIMIT.get(profileKey);
  if (kvId) {
    return kvId;
  }

  const { dir } = await readDirectoryEntries(env.GITHUB_TOKEN);
  if (!Array.isArray(dir)) {
    return null;
  }

  const ownedEntry = dir.find((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const entryOwner = entry.ownerId;
    const entryId = entry.id;
    return (
      entryOwner !== null
      && entryOwner !== undefined
      && String(entryOwner) === String(userId)
      && typeof entryId === "string"
      && entryId.length > 0
    );
  });

  if (!ownedEntry) {
    return null;
  }

  const id = String(ownedEntry.id);
  try {
    await env.RATE_LIMIT.put(profileKey, id);
    await env.RATE_LIMIT.put(`share_owner_${id}`, String(userId));
  } catch {
    // Non-fatal; fallback still works without KV write
  }

  return id;
}
