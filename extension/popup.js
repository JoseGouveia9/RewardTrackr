"use strict";

(() => {
  const EXPORTER_URL = "https://josegouveia9.github.io/GoMiningExporter/";
  const EXPORTER_SYNC_HASH_KEY = "gm_sync_token";
  const EXPORTER_SYNC_ALIAS_HASH_KEY = "gm_sync_alias";
  const INTRO_SEEN_KEY = "gm_intro_seen";

  // ── Theme ────────────────────────────────────────────────────
  const THEME_KEY = "gm_theme";

  function applyTheme(theme) {
    document.body.classList.toggle("theme-dark", theme === "dark");
    document.body.classList.toggle("theme-light", theme === "light");
  }

  async function loadTheme() {
    try {
      const exporterTabs = await chrome.tabs.query({ url: `${EXPORTER_URL}*` });
      if (exporterTabs.length > 0 && exporterTabs[0].id != null) {
        const results = await chrome.scripting.executeScript({
          target: { tabId: exporterTabs[0].id },
          func: (key) => localStorage.getItem(key),
          args: [THEME_KEY],
        });
        const theme = results?.[0]?.result;
        if (theme === "light" || theme === "dark") {
          localStorage.setItem(THEME_KEY, theme);
          applyTheme(theme);
          return;
        }
      }
    } catch { /* ignore — tab not accessible */ }
    applyTheme(localStorage.getItem(THEME_KEY) || "dark");
  }

  void loadTheme();

  // ─────────────────────────────────────────────────────────────

  const syncBtn = document.getElementById("syncBtn");
  const statusEl = document.getElementById("status");
  const greetingEl = document.getElementById("greeting");

  const STATUS_ICONS = {
    ready: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
    loading: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    success: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  };

  function setStatus(text, type = "loading") {
    if (!statusEl) return;
    statusEl.className = `status status-${type}`;
    statusEl.innerHTML = `${STATUS_ICONS[type]}<span>${text}</span>`;
  }

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

  function setButtonState(label, onClick, options = {}) {
    if (!syncBtn) return;
    syncBtn.textContent = label;
    syncBtn.disabled = Boolean(options.disabled);
    syncBtn.classList.toggle("not-ready", Boolean(options.notReady));
    syncBtn.onclick = onClick;
  }

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

  function resolveAlias(profile) {
    if (!profile) return null;
    if (profile.alias && typeof profile.alias === "string" && profile.alias.trim())
      return profile.alias.trim();
    if (profile.email && typeof profile.email === "string" && profile.email.includes("@"))
      return profile.email.split("@")[0];
    return profile.id ? String(profile.id) : null;
  }

  async function fetchGoMiningProfile(accessToken) {
    const response = await fetch("https://api.gomining.com/api/auth/isAuth", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "ngsw-bypass": "true",
        "x-device-type": "desktop",
      },
    });
    const data = await response.json();
    if (!response.ok || !data?.data) {
      throw new Error("Failed to fetch GoMining profile.");
    }
    return data.data;
  }

  async function updateReadyStatus() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeUrl = tabs?.[0]?.url || "";
      const onCorrectSite =
        activeUrl.startsWith("https://app.gomining.com/") ||
        activeUrl === "https://app.gomining.com";

      const cookie = await chrome.cookies.get({
        url: "https://app.gomining.com",
        name: "access_token",
      });
      const hasToken = Boolean(cookie?.value);
      const tokenExpired = hasToken
        ? (() => {
            const exp = getJwtExpiry(cookie.value);
            return exp !== null && exp * 1000 < Date.now();
          })()
        : true;

      if (onCorrectSite && hasToken && !tokenExpired) {
        setStatus("Ready to sync.", "ready");
        setButtonState("Sync to Exporter", syncProfile, { disabled: false, notReady: false });
      } else if (!onCorrectSite) {
        setStatus("Open app.gomining.com to continue.", "error");
        setButtonState("Not Ready", syncProfile, { disabled: true, notReady: true });
      } else if (!hasToken) {
        setStatus("Login required on app.gomining.com.", "error");
        setButtonState("Not Ready", syncProfile, { disabled: true, notReady: true });
      } else if (tokenExpired) {
        setStatus("Token expired. Refresh login on app.gomining.com.", "error");
        setButtonState("Not Ready", syncProfile, { disabled: true, notReady: true });
      } else {
        setStatus("Not ready to sync.", "error");
        setButtonState("Not Ready", syncProfile, { disabled: true, notReady: true });
      }
    } catch {
      setStatus("Not ready to sync.", "error");
      setButtonState("Not Ready", syncProfile, { disabled: true, notReady: true });
    }
  }

  async function syncProfile() {
    setWelcome(null);
    setButtonState("Syncing...", syncProfile, { disabled: true });
    setStatus("Reading cookie...", "loading");

    try {
      const cookie = await chrome.cookies.get({
        url: "https://app.gomining.com",
        name: "access_token",
      });

      if (!cookie?.value) {
        throw new Error("access_token cookie not found. Log in at app.gomining.com first.");
      }

      const exp = getJwtExpiry(cookie.value);
      if (exp !== null && exp * 1000 < Date.now()) {
        throw new Error("Token is expired. Refresh app.gomining.com and try again.");
      }

      setStatus("Fetching profile...", "loading");
      const profile = await fetchGoMiningProfile(cookie.value);
      const alias = resolveAlias(profile) || "there";

      setWelcome(alias);
      setStatus("Profile synced. Click below to open the exporter.", "success");

      // Push token directly into any already-open exporter tabs so they update immediately.
      const exporterTabs = await chrome.tabs.query({ url: `${EXPORTER_URL}*` });
      for (const tab of exporterTabs) {
        if (tab.id == null) continue;
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (token, alias, tokenKey, aliasKey) => {
              localStorage.setItem(tokenKey, token);
              if (alias) localStorage.setItem(aliasKey, alias);
            },
            args: [cookie.value, alias, "gm_sync_token_stored", "gm_sync_alias"],
          });
        } catch { /* tab may have navigated away, ignore */ }
      }

      setButtonState("Open Exporter", () => {
        const hash =
          `#${EXPORTER_SYNC_HASH_KEY}=${encodeURIComponent(cookie.value)}` +
          `&${EXPORTER_SYNC_ALIAS_HASH_KEY}=${encodeURIComponent(alias)}`;
        const url = EXPORTER_URL.replace(/\/?$/, "/") + hash;
        void chrome.tabs.create({ url });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      setStatus(`Error: ${message}`, "error");
      setButtonState("Sync to Exporter", syncProfile);
    }
  }

  const introScreen = document.getElementById("introScreen");
  const syncScreen = document.getElementById("syncScreen");
  const nextBtn = document.getElementById("nextBtn");

  function showSyncScreen() {
    introScreen?.classList.add("hidden");
    syncScreen?.classList.remove("hidden");
    if (syncBtn) {
      setButtonState("Not Ready", syncProfile, { disabled: true, notReady: true });
      void updateReadyStatus();
    }
  }

  if (localStorage.getItem(INTRO_SEEN_KEY)) {
    showSyncScreen();
  } else {
    nextBtn?.addEventListener("click", () => {
      localStorage.setItem(INTRO_SEEN_KEY, "1");
      showSyncScreen();
    });
  }
})();
