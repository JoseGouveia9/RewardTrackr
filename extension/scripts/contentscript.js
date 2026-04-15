"use strict";

// Runs at document_start before the app boots.
// If a pending token was saved by the extension popup, inject it into
// sessionStorage so the auth hook picks it up on mount without needing
// a second sync click.
(async () => {
  try {
    const { rt_pending_token: token, rt_pending_alias: alias } =
      await chrome.storage.local.get(["rt_pending_token", "rt_pending_alias"]);

    if (!token) return;

    sessionStorage.setItem("rt_sync_token_stored", token);
    if (alias) localStorage.setItem("rt_sync_alias", alias);

    // Clear the pending entry so a manual page refresh doesn't re-inject
    // a potentially stale token.
    await chrome.storage.local.remove(["rt_pending_token", "rt_pending_alias"]);
  } catch {
    // Extension context unavailable (e.g. extension reloaded) — ignore.
  }
})();
