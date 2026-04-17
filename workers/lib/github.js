const OWNER = "JoseGouveia9";
const REPO = "rewardtrackr-shared";
const BRANCH = "main";

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
  const res = await ghFetch(token, path, "GET");
  if (!res.ok) return null;
  const data = await res.json();
  return data.sha ?? null;
}

export async function readFile(token, path, { withSha = false } = {}) {
  const res = await ghFetch(token, path, "GET");
  if (!res.ok) return withSha ? { content: null, sha: null } : null;
  const data = await res.json();
  const sha = data.sha ?? null;

  let content = null;
  if (data.content) {
    content = fromBase64(data.content);
  } else if (sha) {
    // File >1MB: content is null, fetch by blob SHA via Git API (content-addressed, no CDN caching)
    const blobRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/git/blobs/${sha}`, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "RewardTrackr-Worker/1.0",
        "Cache-Control": "no-cache",
      },
    });
    if (blobRes.ok) {
      const blob = await blobRes.json();
      if (blob.content) content = fromBase64(blob.content);
    }
  }

  return withSha ? { content, sha } : content;
}

export async function writeFile(token, path, content, sha) {
  const body = { message: `update ${path}`, content: toBase64(content), branch: BRANCH };
  if (sha) body.sha = sha;
  const res = await ghFetch(token, path, "PUT", body);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub write failed (${res.status}): ${text}`);
  }
}

export async function deleteFile(token, path, sha) {
  if (!sha) return;
  const body = { message: `delete ${path}`, sha, branch: BRANCH };
  const res = await ghFetch(token, path, "DELETE", body);
  if (res.status === 404) return;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub delete failed (${res.status}): ${text}`);
  }
}

export async function readDirectoryEntries(token, options = {}) {
  const { withSha = false } = options;
  const dirPath = "shared/directory.json";
  const result = await readFile(token, dirPath, { withSha });
  const dirContent = withSha ? result.content : result;
  const dirSha = withSha ? result.sha : null;

  let dir = [];
  if (dirContent) {
    try {
      dir = JSON.parse(dirContent);
    } catch {
      dir = [];
    }
  }

  return { dirPath, dirSha, dir };
}
