const GOMINING_API = "https://api.gomining.com";
const BASE_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RewardTrackr/1.0",
};

function getBearerToken(request) {
  const authorizationHeader = request.headers.get("Authorization") ?? "";
  return authorizationHeader.startsWith("Bearer ") ? authorizationHeader.slice(7) : null;
}

/** Reads the user id from the JWT payload without verifying the signature; never trust it alone. */
function decodeTokenId(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(base64), (character) => character.charCodeAt(0)),
    );
    const decoded = JSON.parse(json);
    const id = decoded?.id;
    return id !== null && id !== undefined ? String(id) : null;
  } catch {
    return null;
  }
}

/** Probes a cheap authenticated GoMining endpoint to confirm the bearer token is still accepted. */
async function verifyTokenAgainstApi(token) {
  try {
    const response = await fetch(`${GOMINING_API}/api/user-payments-history/index`, {
      method: "POST",
      headers: {
        ...BASE_HEADERS,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filters: { withCanceled: false },
        pagination: { skip: 0, limit: 1 },
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Returns the GoMining user id for the request's bearer token, or null if it can't be verified.
 * Prefers /isAuth; falls back to the id decoded from the JWT once the token passes a probe call.
 */
export async function resolveVerifiedUser(request) {
  const token = getBearerToken(request);
  if (!token) {
    return null;
  }

  const decodedId = decodeTokenId(token);

  try {
    const response = await fetch(`${GOMINING_API}/api/auth/isAuth`, {
      method: "GET",
      headers: { ...BASE_HEADERS, Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const payload = await response.json();
      const id = payload?.data?.id;
      if (id !== null && id !== undefined) {
        return String(id);
      }
    }
  } catch {}

  const verified = await verifyTokenAgainstApi(token);
  if (!verified) return null;
  return decodedId;
}
