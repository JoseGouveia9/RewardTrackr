"use strict";

/**
 * Hands off the token saved by the popup before the app boots, so no second sync click is needed.
 * The pending keys are cleared afterwards so a manual refresh doesn't re-inject a stale token.
 */
async function injectPendingToken() {
  try {
    const { rt_pending_token: token, rt_pending_alias: alias } = await chrome.storage.local.get([
      "rt_pending_token",
      "rt_pending_alias",
    ]);

    if (!token) return;

    sessionStorage.setItem("rt_sync_token_stored", token);
    if (alias) localStorage.setItem("rt_sync_alias", alias);

    await chrome.storage.local.remove(["rt_pending_token", "rt_pending_alias"]);
  } catch {}
}

void injectPendingToken();
