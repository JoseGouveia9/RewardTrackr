"use strict";

(() => {
  const EXPORTER_URL = "https://rewardtrackr.com/";

  const INTRO_SEEN_KEY = "rt_intro_seen";
  const THEME_KEY = "rt_theme";
  const TOKEN_KEY = "rt_sync_token_stored";
  const ALIAS_KEY = "rt_sync_alias";
  const PENDING_TOKEN_KEY = "rt_pending_token";
  const PENDING_ALIAS_KEY = "rt_pending_alias";
  const GOMINING_URL = "https://app.gomining.com";

  /** Keeps a hung extension API call from blocking the UI. */
  function withTimeout(promise, timeoutMilliseconds) {
    let timeoutId;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("timeout")), timeoutMilliseconds);
      }),
    ]).finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    });
  }

  function applyTheme(theme) {
    document.body.classList.toggle("theme-dark", theme === "dark");
    document.body.classList.toggle("theme-light", theme === "light");
  }

  /**
   * The open RewardTrackr tab is the source of truth for the theme; localStorage is the fallback.
   */
  async function loadTheme() {
    try {
      const [tab] = await chrome.tabs.query({ url: `${EXPORTER_URL}*` });
      if (tab?.id != null) {
        const [result] = await withTimeout(
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (key) => localStorage.getItem(key),
            args: [THEME_KEY],
          }),
          1200,
        );
        const theme = result?.result;
        if (theme === "light" || theme === "dark") {
          localStorage.setItem(THEME_KEY, theme);
          applyTheme(theme);
          return;
        }
      }
    } catch {}
    applyTheme(localStorage.getItem(THEME_KEY) || "dark");
  }

  void loadTheme();

  const syncButton = document.getElementById("syncBtn");
  const callToActionOrElement = document.getElementById("ctaOr");
  const statusElement = document.getElementById("status");
  const greetingElement = document.getElementById("greeting");
  const syncHeroRowElement = document.querySelector("#syncScreen .hero-title-row");
  const mobileQrButton = document.getElementById("mobileQrBtn");
  const syncSubtitleElement = document.getElementById("syncSubtitle");
  const syncCopyrightElement = document.getElementById("syncCopyright");
  const qrInlinePanelElement = document.getElementById("qrInlinePanel");
  const qrInlineBackElement = document.getElementById("qrInlineBack");
  const qrInlineCodeElement = document.getElementById("qrInlineCode");

  let lastSyncedToken = null;

  const STATUS_ICONS = {
    ready: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
    loading: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    success: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  };

  function setStatus(text, type = "loading") {
    if (!statusElement) return;
    statusElement.className = `status status-${type}`;
    statusElement.innerHTML = STATUS_ICONS[type] ?? "";
    const span = document.createElement("span");
    span.textContent = text;
    statusElement.appendChild(span);
  }

  function setWelcome(alias) {
    if (!greetingElement) return;
    if (!alias) {
      greetingElement.textContent = "";
      greetingElement.classList.remove("visible");
      syncHeroRowElement?.classList.remove("synced");
      return;
    }
    greetingElement.textContent = `Hello ${alias} 👋`;
    syncHeroRowElement?.classList.add("synced");
    requestAnimationFrame(() => greetingElement.classList.add("visible"));
  }

  function setBaseViewVisible(visible) {
    syncHeroRowElement?.classList.toggle("hidden", !visible);
    syncSubtitleElement?.classList.toggle("hidden", !visible);
    syncButton?.classList.toggle("hidden", !visible);
    statusElement?.classList.toggle("hidden", !visible);
    syncCopyrightElement?.classList.toggle("hidden", !visible);
    if (!mobileQrButton) return;
    if (!visible) {
      mobileQrButton.classList.add("hidden");
      callToActionOrElement?.classList.add("hidden");
      return;
    }
    mobileQrButton.classList.toggle("hidden", !lastSyncedToken);
    callToActionOrElement?.classList.toggle("hidden", !lastSyncedToken);
  }

  function closeQrInlinePanelImmediate() {
    qrInlineCodeElement && (qrInlineCodeElement.innerHTML = "");
    qrInlinePanelElement?.classList.add("hidden");
    qrInlinePanelElement?.setAttribute("aria-hidden", "true");
    setBaseViewVisible(true);
  }

  function resetQrState() {
    closeQrInlinePanelImmediate();
    lastSyncedToken = null;
    if (mobileQrButton) {
      mobileQrButton.classList.add("hidden");
      mobileQrButton.disabled = true;
    }
    callToActionOrElement?.classList.add("hidden");
  }

  /** Compact payload eases camera scans; the `RTQR1:` prefix identifies our format. */
  function buildMobileQrPayload(token) {
    return `RTQR1:${token}`;
  }

  function renderQr(token) {
    if (!qrInlineCodeElement || typeof qrcode !== "function") return;
    const payload = buildMobileQrPayload(token);
    const qrCode = qrcode(0, "M");
    qrCode.addData(payload);
    qrCode.make();
    qrInlineCodeElement.innerHTML = qrCode.createSvgTag(6, 0);
  }

  function openQrInlinePanel() {
    if (!lastSyncedToken) return;
    renderQr(lastSyncedToken);
    setBaseViewVisible(false);
    qrInlinePanelElement?.classList.remove("hidden");
    qrInlinePanelElement?.setAttribute("aria-hidden", "false");
  }

  function showQrButton(token) {
    lastSyncedToken = token;
    if (!mobileQrButton) return;
    mobileQrButton.classList.remove("hidden");
    mobileQrButton.disabled = false;
    callToActionOrElement?.classList.remove("hidden");
  }

  function setButtonState(label, onClick, options = {}) {
    if (!syncButton) return;
    syncButton.textContent = label;
    syncButton.disabled = Boolean(options.disabled);
    syncButton.classList.toggle("not-ready", Boolean(options.notReady));
    syncButton.onclick = onClick;
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

  function isTokenExpired(token) {
    const expiresAt = getJwtExpiry(token);
    return expiresAt !== null && expiresAt * 1000 < Date.now();
  }

  function resolveAlias(profile) {
    if (!profile) return null;
    if (profile.alias?.trim()) return profile.alias.trim();
    if (profile.email?.includes("@")) return profile.email.split("@")[0];
    return profile.id ? String(profile.id) : null;
  }

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

  /**
   * Checks the active tab and cookie, then validates the session against the API before enabling sync.
   * A token cookie can exist mid-login (e.g. 2FA) without being a fully authenticated session.
   */
  async function updateReadyStatus() {
    try {
      resetQrState();
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeUrl = activeTab?.url ?? "";
      const onCorrectSite = activeUrl.startsWith(`${GOMINING_URL}/`) || activeUrl === GOMINING_URL;

      const cookie = await chrome.cookies.get({ url: GOMINING_URL, name: "access_token" });
      const hasToken = Boolean(cookie?.value);

      if (onCorrectSite && hasToken && !isTokenExpired(cookie.value)) {
        setStatus("Validating session...", "loading");
        try {
          await withTimeout(fetchGoMiningProfile(cookie.value), 1800);
          setStatus("Ready to sync.", "ready");
          setButtonState("Sync to RewardTrackr", syncProfile);
        } catch {
          setStatus("Finish login/2FA on app.gomining.com first.", "error");
          setButtonState("Not Ready", null, { disabled: true, notReady: true });
        }
      } else if (!onCorrectSite) {
        setStatus("Open app.gomining.com to continue.", "error");
        setButtonState("Not Ready", null, { disabled: true, notReady: true });
      } else if (!hasToken) {
        setStatus("Login required on app.gomining.com.", "error");
        setButtonState("Not Ready", null, { disabled: true, notReady: true });
      } else {
        setStatus("Session expired. Please log in again.", "error");
        setButtonState("Not Ready", null, { disabled: true, notReady: true });
      }
    } catch {
      setStatus("Not ready to sync.", "error");
      setButtonState("Not Ready", null, { disabled: true, notReady: true });
    }
  }

  /**
   * Sets the token/alias in the page's storage and fires a `storage` event so an already-loaded
   * app picks it up.
   */
  async function injectTokenIntoTab(tabId, token, alias) {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (token, alias, tokenKey, aliasKey) => {
        sessionStorage.setItem(tokenKey, token);
        if (alias) localStorage.setItem(aliasKey, alias);
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: tokenKey,
            newValue: token,
            storageArea: sessionStorage,
          }),
        );
      },
      args: [token, alias, TOKEN_KEY, ALIAS_KEY],
    });
  }

  /**
   * Focuses an open RewardTrackr tab and injects the token, or opens a new tab otherwise.
   * For a new tab the token is stored first so the content script can inject it at document_start.
   */
  async function openRewardTrackr(token, alias) {
    const [existingTab] = await chrome.tabs.query({ url: `${EXPORTER_URL}*` });

    if (existingTab?.id != null) {
      await chrome.tabs.update(existingTab.id, { active: true });
      await injectTokenIntoTab(existingTab.id, token, alias).catch(() => {});
      return;
    }

    await chrome.storage.local.set({ [PENDING_TOKEN_KEY]: token, [PENDING_ALIAS_KEY]: alias });
    chrome.tabs.create({ url: EXPORTER_URL });
  }

  async function syncProfile() {
    setWelcome(null);
    resetQrState();
    setButtonState("Syncing...", null, { disabled: true });
    setStatus("Reading cookie...", "loading");

    try {
      const cookie = await chrome.cookies.get({ url: GOMINING_URL, name: "access_token" });
      if (!cookie?.value)
        throw new Error("access_token cookie not found. Log in at app.gomining.com first.");

      if (isTokenExpired(cookie.value)) {
        setStatus("Session expired. Please log in again.", "error");
        setButtonState("Not Ready", null, { disabled: true, notReady: true });
        return;
      }

      setStatus("Fetching profile...", "loading");
      const profile = await fetchGoMiningProfile(cookie.value);
      const alias = resolveAlias(profile) || "there";

      setWelcome(alias);
      setStatus("Profile synced.", "success");

      const openTabs = await chrome.tabs.query({ url: `${EXPORTER_URL}*` });
      await Promise.allSettled(
        openTabs
          .filter((t) => t.id != null)
          .map((t) => withTimeout(injectTokenIntoTab(t.id, cookie.value, alias), 1200)),
      );

      showQrButton(cookie.value);

      setButtonState("Open RewardTrackr Web", () => openRewardTrackr(cookie.value, alias));
    } catch (error) {
      resetQrState();
      setStatus(`Error: ${error instanceof Error ? error.message : "Unexpected error"}`, "error");
      setButtonState("Sync to RewardTrackr", syncProfile);
    }
  }

  mobileQrButton?.addEventListener("click", openQrInlinePanel);
  qrInlineBackElement?.addEventListener("click", closeQrInlinePanelImmediate);

  function showSyncScreen() {
    introScreen?.classList.add("hidden");
    syncScreen?.classList.remove("hidden");
    if (syncButton) {
      setButtonState("Not Ready", null, { disabled: true, notReady: true });
      void updateReadyStatus();
    }
  }

  const introScreen = document.getElementById("introScreen");
  const syncScreen = document.getElementById("syncScreen");
  const nextButton = document.getElementById("nextBtn");

  if (localStorage.getItem(INTRO_SEEN_KEY)) {
    showSyncScreen();
  } else {
    nextButton?.addEventListener("click", () => {
      localStorage.setItem(INTRO_SEEN_KEY, "1");
      showSyncScreen();
    });
  }
})();
