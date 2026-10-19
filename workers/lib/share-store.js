import { readDirectoryEntries } from "./github.js";

/**
 * Finds the shared-profile id owned by a user: KV cache first, then the GitHub directory index.
 * A directory hit re-seeds the `share_profile_`/`share_owner_` KV keys; KV write failures are ignored.
 */
export async function resolveProfileIdForUser(environment, userId) {
  const profileKey = `share_profile_${userId}`;
  const keyValueId = await environment.RATE_LIMIT.get(profileKey);
  if (keyValueId) {
    return keyValueId;
  }

  const { directoryEntries } = await readDirectoryEntries(environment.GITHUB_TOKEN);
  if (!Array.isArray(directoryEntries)) {
    return null;
  }

  const ownedEntry = directoryEntries.find((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const entryOwner = entry.ownerId;
    const entryId = entry.id;
    return (
      entryOwner !== null &&
      entryOwner !== undefined &&
      String(entryOwner) === String(userId) &&
      typeof entryId === "string" &&
      entryId.length > 0
    );
  });

  if (!ownedEntry) {
    return null;
  }

  const id = String(ownedEntry.id);
  try {
    await environment.RATE_LIMIT.put(profileKey, id);
    await environment.RATE_LIMIT.put(`share_owner_${id}`, String(userId));
  } catch {}

  return id;
}
