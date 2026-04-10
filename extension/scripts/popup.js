"use strict";

(() => {
  const EXPORTER_URL = "https://josegouveia9.github.io/RewardTrackr/";

  const INTRO_SEEN_KEY = "rt_intro_seen";
  const THEME_KEY = "rt_theme";
  const TOKEN_KEY = "rt_sync_token_stored";
  const ALIAS_KEY = "rt_sync_alias";
  const PENDING_TOKEN_KEY = "rt_pending_token";
  const PENDING_ALIAS_KEY = "rt_pending_alias";
  const GOMINING_URL = "https://app.gomining.com";

  // Theme

  // Applies a theme class to the body, removing the other.
  function applyTheme(theme) {
    document.body.classList.toggle("theme-dark", theme === "dark");
    document.body.classList.toggle("theme-light", theme === "light");
  }

  // Reads the active RewardTrackr tab's stored theme preference and applies it; falls back to localStorage.
  async function loadTheme() {
    try {
      const [tab] = await chrome.tabs.query({ url: `${EXPORTER_URL}*` });
      if (tab?.id != null) {
        const [result] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (key) => localStorage.getItem(key),
          args: [THEME_KEY],
        });
        const theme = result?.result;
        if (theme === "light" || theme === "dark") {
          localStorage.setItem(THEME_KEY, theme);
          applyTheme(theme);
          return;
        }
      }
    } catch {
      // tab not accessible, fall through to stored preference
    }
    applyTheme(localStorage.getItem(THEME_KEY) || "dark");
  }

  void loadTheme();

  // DOM refs

  const syncBtn = document.getElementById("syncBtn");
  const statusEl = document.getElementById("status");
  const greetingEl = document.getElementById("greeting");

  // Status icons

  const STATUS_ICONS = {
    ready: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
    loading: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    success: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  };

  // UI helpers

  // Updates the status bar with an icon and message for the given type (ready, loading, success, error).
  function setStatus(text, type = "loading") {
    if (!statusEl) return;
    statusEl.className = `status status-${type}`;
    statusEl.innerHTML = `${STATUS_ICONS[type]}<span>${text}</span>`;
  }

  // Shows or hides the personalised greeting on the sync screen.
  function setWelcome(alias) {
    const titleRow = document.querySelector("#syncScreen .hero-title-row");
    if (!greetingEl) return;
    if (!alias) {
      greetingEl.textContent = "";
      greetingEl.classList.remove("visible");
      titleRow?.classList.remove("synced");
      return;
    }
    greetingEl.textContent = `Hello ${alias} 👋`;
    titleRow?.classList.add("synced");
    requestAnimationFrame(() => greetingEl.classList.add("visible"));
  }

  // Sets the sync button's label, click handler, and disabled/not-ready visual state.
  function setButtonState(label, onClick, options = {}) {
    if (!syncBtn) return;
    syncBtn.textContent = label;
    syncBtn.disabled = Boolean(options.disabled);
    syncBtn.classList.toggle("not-ready", Boolean(options.notReady));
    syncBtn.onclick = onClick;
  }

  // JWT helpers

  // Decodes the JWT payload and returns the exp claim as a Unix timestamp, or null if unreadable.
  function getJwtExpiry(token) {
    try {
      const payload = token.split(".")[1];
      if (!payload) return null;
      const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
      return typeof decoded.exp === "number" ? decoded.exp : null;
    } catch {
      return null;
    }
  }

  // Returns true if the token's exp claim is in the past.
  function isTokenExpired(token) {
    const exp = getJwtExpiry(token);
    return exp !== null && exp * 1000 < Date.now();
  }

  // GoMining API

  // Extracts a display name from the GoMining profile, falling back to email prefix then user ID.
  function resolveAlias(profile) {
    if (!profile) return null;
    if (profile.alias?.trim()) return profile.alias.trim();
    if (profile.email?.includes("@")) return profile.email.split("@")[0];
    return profile.id ? String(profile.id) : null;
  }

  // Fetches the authenticated GoMining user profile using the provided access token.
  async function fetchGoMiningProfile(accessToken) {
    const response = await fetch(`${GOMINING_URL.replace("app.", "api.")}/api/auth/isAuth`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "ngsw-bypass": "true",
        "x-device-type": "desktop",
      },
    });
    const data = await response.json();
    if (!response.ok || !data?.data) throw new Error("Failed to fetch GoMining profile.");
    return data.data;
  }

  // Ready state check

  // Checks the active tab URL and the GoMining access_token cookie to determine which button state to show.
  async function updateReadyStatus() {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeUrl = activeTab?.url ?? "";
      const onCorrectSite =
        activeUrl.startsWith(`${GOMINING_URL}/`) || activeUrl === GOMINING_URL;

      const cookie = await chrome.cookies.get({ url: GOMINING_URL, name: "access_token" });
      const hasToken = Boolean(cookie?.value);

      if (onCorrectSite && hasToken && !isTokenExpired(cookie.value)) {
        setStatus("Ready to sync.", "ready");
        setButtonState("Sync to RewardTrackr", syncProfile);
      } else if (!onCorrectSite) {
        setStatus("Open app.gomining.com to continue.", "error");
        setButtonState("Not Ready", null, { disabled: true, notReady: true });
      } else if (!hasToken) {
        setStatus("Login required on app.gomining.com.", "error");
        setButtonState("Not Ready", null, { disabled: true, notReady: true });
      } else {
        // has token but expired
        setStatus("Session expired. Click below to refresh and sync.", "error");
        setButtonState("Refresh & Sync", refreshAndSync);
      }
    } catch {
      setStatus("Not ready to sync.", "error");
      setButtonState("Not Ready", null, { disabled: true, notReady: true });
    }
  }

  // Token injection

  // Writes the token and alias into the tab's localStorage and fires a StorageEvent so the app reacts immediately.
  async function injectTokenIntoTab(tabId, token, alias) {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (token, alias, tokenKey, aliasKey) => {
        localStorage.setItem(tokenKey, token);
        if (alias) localStorage.setItem(aliasKey, alias);
        window.dispatchEvent(new StorageEvent("storage", { key: tokenKey, newValue: token, storageArea: localStorage }));
      },
      args: [token, alias, TOKEN_KEY, ALIAS_KEY],
    });
  }

  // Opens or focuses the RewardTrackr tab and injects the token; persists it to extension storage first
  // so the content script can inject it at document_start even if the popup closes before the tab loads.
  async function openRewardTrackr(token, alias) {
    const [existingTab] = await chrome.tabs.query({ url: `${EXPORTER_URL}*` });

    if (existingTab?.id != null) {
      await chrome.tabs.update(existingTab.id, { active: true });
      await injectTokenIntoTab(existingTab.id, token, alias).catch(() => {});
      return;
    }

    if (chrome.storage?.local) {
      await chrome.storage.local.set({ [PENDING_TOKEN_KEY]: token, [PENDING_ALIAS_KEY]: alias });
      chrome.tabs.create({ url: EXPORTER_URL });
    } else {
      // Fallback: inject via tabs.onUpdated (may not fire if popup closes first).
      chrome.tabs.create({ url: EXPORTER_URL }, (tab) => {
        const listener = (tabId, changeInfo) => {
          if (tabId !== tab.id || changeInfo.status !== "complete") return;
          chrome.tabs.onUpdated.removeListener(listener);
          injectTokenIntoTab(tabId, token, alias).catch(() => {});
        };
        chrome.tabs.onUpdated.addListener(listener);
      });
    }
  }

  // Session refresh

  // Uses the refresh_token cookie to obtain a new access token from GoMining, then re-runs syncProfile.
  async function refreshAndSync() {
    setButtonState("Refreshing…", null, { disabled: true });
    setStatus("Refreshing session…", "loading");
    try {
      const refreshCookie = await chrome.cookies.get({ url: GOMINING_URL, name: "refresh_token" });
      if (!refreshCookie?.value) throw new Error("No refresh token found. Please log in to app.gomining.com.");

      const response = await fetch(`${GOMINING_URL.replace("app.", "api.")}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "ngsw-bypass": "true", "x-device-type": "desktop" },
        body: JSON.stringify({ refreshToken: refreshCookie.value }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error("Failed to refresh session. Please log in again.");

      const newToken = data?.data?.accessToken ?? data?.accessToken;
      if (!newToken) throw new Error("Unexpected refresh response.");

      await chrome.cookies.set({ url: GOMINING_URL, name: "access_token", value: newToken, path: "/", secure: true });
      await syncProfile();
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : "Unexpected error"}`, "error");
      setButtonState("Refresh & Sync", refreshAndSync);
    }
  }

  // Sync profile

  // Validates the GoMining session cookie, fetches the user profile, injects the token into open tabs,
  // and shows the Open RewardTrackr button on success.
  async function syncProfile() {
    setWelcome(null);
    setButtonState("Syncing...", null, { disabled: true });
    setStatus("Reading cookie...", "loading");

    try {
      const cookie = await chrome.cookies.get({ url: GOMINING_URL, name: "access_token" });
      if (!cookie?.value) throw new Error("access_token cookie not found. Log in at app.gomining.com first.");

      if (isTokenExpired(cookie.value)) {
        setStatus("Session expired. Click below to refresh and sync.", "error");
        setButtonState("Refresh & Sync", refreshAndSync);
        return;
      }

      setStatus("Fetching profile...", "loading");
      const profile = await fetchGoMiningProfile(cookie.value);
      const alias = resolveAlias(profile) || "there";

      setWelcome(alias);
      setStatus("Profile synced.", "success");

      // Push token into all already-open RewardTrackr tabs in parallel.
      const openTabs = await chrome.tabs.query({ url: `${EXPORTER_URL}*` });
      await Promise.all(
        openTabs
          .filter((t) => t.id != null)
          .map((t) => injectTokenIntoTab(t.id, cookie.value, alias).catch(() => {}))
      );

      setButtonState("Open RewardTrackr", () => openRewardTrackr(cookie.value, alias));
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : "Unexpected error"}`, "error");
      setButtonState("Sync to RewardTrackr", syncProfile);
    }
  }

  // Screen navigation

  // Transitions from the intro screen to the sync screen and triggers the ready-state check.
  function showSyncScreen() {
    introScreen?.classList.add("hidden");
    syncScreen?.classList.remove("hidden");
    if (syncBtn) {
      setButtonState("Not Ready", null, { disabled: true, notReady: true });
      void updateReadyStatus();
    }
  }

  const introScreen = document.getElementById("introScreen");
  const syncScreen = document.getElementById("syncScreen");
  const nextBtn = document.getElementById("nextBtn");

  if (localStorage.getItem(INTRO_SEEN_KEY)) {
    showSyncScreen();
  } else {
    nextBtn?.addEventListener("click", () => {
      localStorage.setItem(INTRO_SEEN_KEY, "1");
      showSyncScreen();
    });
  }
})();
