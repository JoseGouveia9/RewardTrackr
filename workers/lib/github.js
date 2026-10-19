const OWNER = "JoseGouveia9";
const REPO = "rewardtrackr-shared";
const BRANCH = "main";

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(base64Text) {
  const clean = base64Text.replace(/\n/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}

/**
 * Calls the GitHub contents API on the shared-data repo, bypassing caches so reads see fresh
 * writes.
 */
async function githubFetch(token, path, method, body) {
  return fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    method,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "User-Agent": "RewardTrackr-Worker/1.0",
      "Cache-Control": "no-cache",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function getFileSha(token, path) {
  const response = await githubFetch(token, path, "GET");
  if (!response.ok) return null;
  const data = await response.json();
  return data.sha ?? null;
}

/**
 * Reads a repo file as text, or null if missing; files too large for the contents API come via the blobs API.
 * With `withSha` it returns `{ content, sha }` so callers can update the file.
 */
export async function readFile(token, path, { withSha = false } = {}) {
  const response = await githubFetch(token, path, "GET");
  if (!response.ok) return withSha ? { content: null, sha: null } : null;
  const data = await response.json();
  const sha = data.sha ?? null;

  let content = null;
  if (data.content) {
    content = fromBase64(data.content);
  } else if (sha) {
    const blobResponse = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/git/blobs/${sha}`,
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "RewardTrackr-Worker/1.0",
          "Cache-Control": "no-cache",
        },
      },
    );
    if (blobResponse.ok) {
      const blob = await blobResponse.json();
      if (blob.content) content = fromBase64(blob.content);
    }
  }

  return withSha ? { content, sha } : content;
}

export async function writeFile(token, path, content, sha) {
  const body = { message: `update ${path}`, content: toBase64(content), branch: BRANCH };
  if (sha) body.sha = sha;
  const response = await githubFetch(token, path, "PUT", body);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub write failed (${response.status}): ${text}`);
  }
}

/** Deletes a repo file; a missing sha or a 404 counts as already deleted. */
export async function deleteFile(token, path, sha) {
  if (!sha) return;
  const body = { message: `delete ${path}`, sha, branch: BRANCH };
  const response = await githubFetch(token, path, "DELETE", body);
  if (response.status === 404) return;
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub delete failed (${response.status}): ${text}`);
  }
}

/**
 * Loads the community index `shared/directory.json`; an unreadable or invalid file yields an
 * empty list.
 */
export async function readDirectoryEntries(token, options = {}) {
  const { withSha = false } = options;
  const directoryPath = "shared/directory.json";
  const result = await readFile(token, directoryPath, { withSha });
  const directoryContent = withSha ? result.content : result;
  const directorySha = withSha ? result.sha : null;

  let directoryEntries = [];
  if (directoryContent) {
    try {
      directoryEntries = JSON.parse(directoryContent);
    } catch {
      directoryEntries = [];
    }
  }

  return { directoryPath, directorySha, directoryEntries };
}
