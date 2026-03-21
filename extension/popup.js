"use strict";

(() => {
  const EXPORTER_URL = "https://josegouveia9.github.io/GoMiningExporter/";
  const EXPORTER_SYNC_HASH_KEY = "gm_sync_token";
  const EXPORTER_SYNC_ALIAS_HASH_KEY = "gm_sync_alias";
  const INTRO_SEEN_KEY = "gm_intro_seen";

  const syncBtn = document.getElementById("syncBtn");
  const statusEl = document.getElementById("status");
  const welcomeEl = document.getElementById("welcome");

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function setWelcome(text) {
    if (!welcomeEl) return;
    if (!text) {
      welcomeEl.textContent = "";
      welcomeEl.classList.add("hidden");
      return;
    }
    welcomeEl.textContent = text;
    welcomeEl.classList.remove("hidden");
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
        setStatus("Ready to sync.");
        setButtonState("Sync to Exporter", syncProfile, { disabled: false, notReady: false });
      } else if (!onCorrectSite) {
        setStatus("Open app.gomining.com to continue.");
        setButtonState("Not Ready", syncProfile, { disabled: true, notReady: true });
      } else if (!hasToken) {
        setStatus("Login required on app.gomining.com.");
        setButtonState("Not Ready", syncProfile, { disabled: true, notReady: true });
      } else if (tokenExpired) {
        setStatus("Token expired. Refresh login on app.gomining.com.");
        setButtonState("Not Ready", syncProfile, { disabled: true, notReady: true });
      } else {
        setStatus("Not ready to sync.");
        setButtonState("Not Ready", syncProfile, { disabled: true, notReady: true });
      }
    } catch {
      setStatus("Not ready to sync.");
      setButtonState("Not Ready", syncProfile, { disabled: true, notReady: true });
    }
  }

  async function syncProfile() {
    setWelcome(null);
    setButtonState("Syncing...", syncProfile, { disabled: true });
    setStatus("Reading cookie...");

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

      setStatus("Fetching profile...");
      const profile = await fetchGoMiningProfile(cookie.value);
      const alias = resolveAlias(profile) || "there";

      setWelcome(`Welcome ${alias}!`);
      setStatus("Profile synced. Click below to open the exporter.");

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
      setStatus(`Error: ${message}`);
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
