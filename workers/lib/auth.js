function getBearerToken(request) {
  const auth = request.headers.get("Authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : null;
}

function decodeTokenId(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
    const decoded = JSON.parse(json);
    const id = decoded?.id;
    return id !== null && id !== undefined ? String(id) : null;
  } catch {
    return null;
  }
}

async function verifyTokenAgainstApi(token) {
  try {
    const res = await fetch("https://api.gomining.com/api/user-payments-history/index", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RewardTrackr/1.0",
      },
      body: JSON.stringify({
        filters: { withCanceled: false },
        pagination: { skip: 0, limit: 1 },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function resolveVerifiedUser(request) {
  const token = getBearerToken(request);
  if (!token) {
    return null;
  }

  const decodedId = decodeTokenId(token);
  const verifyHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RewardTrackr/1.0",
  };

  try {
    const res = await fetch("https://api.gomining.com/api/auth/isAuth", {
      method: "GET",
      headers: verifyHeaders,
    });
    if (res.ok) {
      const payload = await res.json();
      const id = payload?.data?.id;
      if (id !== null && id !== undefined) {
        return String(id);
      }
    }
  } catch {
    // Fall through to secondary verification
  }

  const verified = await verifyTokenAgainstApi(token);
  if (!verified) return null;
  return decodedId;
}
