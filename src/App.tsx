import { useEffect, useState } from "react";
import { decodeJwt } from "@/core/http";
import { WALLET_TX_KEYS, TX_CHECKBOX_OPTIONS, ALL_TX_FROM_TYPES } from "@/core/wallet-types";
import { REWARD_GROUPS, ALL_REWARD_KEYS } from "@/core/reward-configs";
import { loadAllCacheEntries, clearAllCacheEntries, formatAge } from "@/features/cache";
import { executeExportFlow } from "@/features/export-flow";
import type { AuthUser, CacheState, ExtraFiatCurrency, RewardGroup, RewardKey } from "@/core/types";
import { AuthPanel } from "@/components/auth-panel";
import { FiatDropdown } from "@/components/fiat-dropdown";
import { DonateSection } from "@/components/donate-section";
import "./App.css";

const EXTENSION_SYNC_HASH_KEY = "gm_sync_token";
const EXTENSION_SYNC_ALIAS_HASH_KEY = "gm_sync_alias";
const EXTENSION_SYNC_ALIAS_STORE_KEY = "gm_sync_alias";
const EXTENSION_SYNC_TOKEN_STORE_KEY = "gm_sync_token_stored";
const THEME_STORAGE_KEY = "gm_theme";

type ThemeMode = "light" | "dark";

function getSyncPayloadFromHash(): { token: string | null; alias: string | null } {
  const rawHash = window.location.hash || "";
  if (!rawHash.startsWith("#")) return { token: null, alias: null };
  const params = new URLSearchParams(rawHash.slice(1));
  const token = params.get(EXTENSION_SYNC_HASH_KEY);
  const alias = params.get(EXTENSION_SYNC_ALIAS_HASH_KEY);
  return {
    token: token && token.trim() ? token : null,
    alias: alias && alias.trim() ? alias.trim() : null,
  };
}

function clearSyncHash(): void {
  if (!window.location.hash) return;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}

function loginWithToken(token: string): AuthUser | null {
  const decoded = decodeJwt(token);
  if (!decoded || typeof decoded !== "object") return null;

  const nowSec = Math.floor(Date.now() / 1000);
  if (decoded.exp && nowSec >= decoded.exp) return null;

  const alias =
    decoded.alias ||
    decoded.username ||
    decoded.name ||
    (decoded.email ? String(decoded.email).split("@")[0] : null) ||
    decoded.id ||
    decoded.sub ||
    null;

  return { id: decoded.id || decoded.sub || null, email: decoded.email || null, alias, exp: decoded.exp || null };
}

function App() {
  const [storedToken, setStoredToken] = useState<string>("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [syncedAlias, setSyncedAlias] = useState<string>(() =>
    (localStorage.getItem(EXTENSION_SYNC_ALIAS_STORE_KEY) || "").trim(),
  );
  const [selectedKeys, setSelectedKeys] = useState<RewardKey[]>(() => [...ALL_REWARD_KEYS]);
  const [selectedTxFromTypes, setSelectedTxFromTypes] = useState<string[]>(() => [...ALL_TX_FROM_TYPES]);
  const [includeWalletFiat, setIncludeWalletFiat] = useState<boolean>(true);
  const [includeExcelFiat, setIncludeExcelFiat] = useState<boolean>(true);
  const [excelFiatCurrency, setExcelFiatCurrency] = useState<ExtraFiatCurrency>("EUR");
  const [cache, setCache] = useState<CacheState>(() => loadAllCacheEntries());
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" ? "light" : "dark";
  });

  function toggleTheme(): void {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }

  function isGroupSelected(group: RewardGroup): boolean {
    return group.keys.every((k) => selectedKeys.includes(k));
  }

  function toggleGroup(group: RewardGroup): void {
    setSelectedKeys((prev) => {
      const allSelected = group.keys.every((k) => prev.includes(k));
      if (allSelected) return prev.filter((k) => !group.keys.includes(k));
      return [...new Set([...prev, ...group.keys])];
    });
  }

  function toggleAll(): void {
    setSelectedKeys((prev) => (prev.length === ALL_REWARD_KEYS.length ? [] : [...ALL_REWARD_KEYS]));
  }

  useEffect(() => {
    const { token: syncToken, alias } = getSyncPayloadFromHash();
    if (alias) {
      setSyncedAlias(alias);
      localStorage.setItem(EXTENSION_SYNC_ALIAS_STORE_KEY, alias);
    }
    if (syncToken) {
      const userData = loginWithToken(syncToken);
      if (userData) {
        if (alias) userData.alias = alias;
        localStorage.setItem(EXTENSION_SYNC_TOKEN_STORE_KEY, syncToken);
        setStoredToken(syncToken);
        setUser(userData);
        setMessage("Synced successfully. Welcome!");
      } else {
        setMessage("Extension token is invalid or expired.");
      }
      clearSyncHash();
    }
  }, []);

  useEffect(() => {
    const handleStorage = (e: StorageEvent): void => {
      if (e.key !== EXTENSION_SYNC_TOKEN_STORE_KEY || !e.newValue) return;
      const userData = loginWithToken(e.newValue);
      if (!userData) return;
      const storedAlias = localStorage.getItem(EXTENSION_SYNC_ALIAS_STORE_KEY)?.trim() ?? null;
      if (storedAlias) userData.alias = storedAlias;
      setStoredToken(e.newValue);
      setUser(userData);
      setMessage("Session refreshed from extension.");
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (user) return;
    const interval = setInterval(() => {
      const token = localStorage.getItem(EXTENSION_SYNC_TOKEN_STORE_KEY);
      if (!token) return;
      const userData = loginWithToken(token);
      if (!userData) return;
      const storedAlias = localStorage.getItem(EXTENSION_SYNC_ALIAS_STORE_KEY)?.trim() ?? null;
      if (storedAlias) userData.alias = storedAlias;
      setStoredToken(token);
      setUser(userData);
      setMessage("Session synced from extension.");
    }, 1000);
    return () => clearInterval(interval);
  }, [user]);

  function handleCheckSync(): void {
    const { token: hashToken, alias } = getSyncPayloadFromHash();
    const syncToken = hashToken ?? localStorage.getItem(EXTENSION_SYNC_TOKEN_STORE_KEY);

    if (alias) {
      setSyncedAlias(alias);
      localStorage.setItem(EXTENSION_SYNC_ALIAS_STORE_KEY, alias);
    }

    if (syncToken) {
      const userData = loginWithToken(syncToken);
      if (userData) {
        const storedAlias =
          alias ?? localStorage.getItem(EXTENSION_SYNC_ALIAS_STORE_KEY)?.trim() ?? null;
        if (storedAlias) userData.alias = storedAlias;
        localStorage.setItem(EXTENSION_SYNC_TOKEN_STORE_KEY, syncToken);
        setStoredToken(syncToken);
        setUser(userData);
        setMessage("Synced successfully. Welcome!");
      } else {
        setMessage("Extension token is invalid or expired.");
      }
      if (hashToken) clearSyncHash();
    } else {
      setMessage("No token found. Please sync via the GoMining extension first.");
    }
  }

  function handleLogout(): void {
    localStorage.removeItem(EXTENSION_SYNC_TOKEN_STORE_KEY);
    setUser(null);
    setStoredToken("");
    setMessage("Logged out.");
  }

  function handleClearCache(): void {
    clearAllCacheEntries();
    setCache(Object.fromEntries(ALL_REWARD_KEYS.map((k) => [k, null])) as CacheState);
    setMessage("Cache cleared. Next export will fetch fresh data.");
  }

  async function handleExport(): Promise<void> {
    if (selectedKeys.length === 0) return;

    const decoded = decodeJwt(storedToken);
    if (!decoded || (decoded.exp && Math.floor(Date.now() / 1000) >= decoded.exp)) {
      setMessage("Session expired. Please re-sync via the GoMining Exporter extension.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const successMessage = await executeExportFlow({
        accessToken: storedToken,
        selectedKeys,
        cache,
        includeWalletFiat,
        includeExcelFiat,
        excelFiatCurrency,
        txFromTypeFilter: selectedKeys.includes("transactions") ? selectedTxFromTypes : undefined,
        onMessage: setMessage,
        onCacheUpdate: setCache,
      });
      setMessage(successMessage);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Export failed";
      const msgLower = msg.toLowerCase();
      const isCors =
        msgLower.includes("failed to fetch") ||
        msgLower.includes("cors") ||
        msgLower.includes("networkerror");
      const isAuth =
        msgLower.includes("unauthorized") ||
        msgLower.includes("unauthenticated") ||
        msgLower.includes("expired") ||
        msgLower.includes("jwt") ||
        msgLower.includes("forbidden");
      setMessage(
        isCors
          ? "Network error: GoMining API blocked the request (CORS). Try using the browser extension to sync your token, or run the app locally with the v2 server."
          : isAuth
            ? "Session expired. Please re-sync via the GoMining Exporter extension."
            : `Export failed: ${msg}`,
      );
    } finally {
      setLoading(false);
    }
  }

  const walletSheetsSelected = [...WALLET_TX_KEYS].some((k) => selectedKeys.includes(k));
  const displayAlias = syncedAlias || user?.alias?.trim() || "User";
  const totalGroupCount = REWARD_GROUPS.length;
  const selectedGroupCount = REWARD_GROUPS.filter((g) => isGroupSelected(g)).length;
  const cachedCount = selectedKeys.filter((k) => cache[k]).length;

  return (
    <div className={`page ${theme === "dark" ? "theme-dark" : "theme-light"}`}>
      <div className="bg-shape shape-a" />
      <div className="bg-shape shape-b" />

      <main className="container">
        <header className="hero">
          <div className="hero-top">
            <h1>GoMining Exporter</h1>
            <button type="button" className="btn-theme" onClick={toggleTheme}>
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
          </div>
          <p className="hero-subtitle">
            Connect your GoMining session and generate a complete all-rewards Excel report in one
            click. Your token never leaves your browser.
          </p>
        </header>

        {!user ? (
          <AuthPanel onSync={handleCheckSync} />
        ) : (
          <>
            <section className="panel panel-split">
              <div>
                <h2 className="welcome-title">Welcome {displayAlias}!</h2>
                <p className="identity-line">
                  <span className="identity-label">User ID:</span>{" "}
                  <span className="identity-value">{user.id || "n/a"}</span>
                </p>
                <p className="identity-line">
                  <span className="identity-label">Email:</span>{" "}
                  <span className="identity-value">{user.email || "n/a"}</span>
                </p>
              </div>
              <button className="btn-danger" onClick={handleLogout}>
                Logout
              </button>
            </section>

            <section className="panel panel-actions">
              <div className="actions-header">
                <h2>Select Sheets</h2>
                {Object.values(cache).some(Boolean) && (
                  <button className="btn-danger btn-danger-small" onClick={handleClearCache}>
                    Clear Cache
                  </button>
                )}
              </div>

              <div className="sheet-selector">
                <button
                  type="button"
                  className={`sheet-card sheet-card-all ${selectedGroupCount === totalGroupCount ? "selected" : ""}`}
                  onClick={toggleAll}
                  aria-pressed={selectedGroupCount === totalGroupCount}
                >
                  <span className="sheet-title">Select All</span>
                  <span className="sheet-meta">
                    {selectedGroupCount}/{totalGroupCount} selected
                  </span>
                </button>

                {REWARD_GROUPS.map((group) => {
                  const selected = isGroupSelected(group);
                  const cachedGroupCount = group.keys.filter((k) => cache[k]).length;
                  const allCached = cachedGroupCount === group.keys.length;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      className={`sheet-card ${selected ? "selected" : ""}`}
                      onClick={() => toggleGroup(group)}
                      aria-pressed={selected}
                    >
                      <span className="sheet-title">{group.label}</span>
                      <span className="sheet-meta">
                        {allCached ? (
                          <span className="cache-badge">
                            Stored{" "}
                            {group.keys.length === 1
                              ? formatAge(cache[group.keys[0]]!.fetchedAt)
                              : `${group.keys.length}/${group.keys.length}`}
                          </span>
                        ) : cachedGroupCount > 0 ? (
                          <span className="cache-badge">
                            Stored {cachedGroupCount}/{group.keys.length}
                          </span>
                        ) : (
                          "Not stored"
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedKeys.includes("transactions") && (
                <div className="wallet-options">
                  <p className="wallet-options-title">Transactions Filter</p>
                  {TX_CHECKBOX_OPTIONS.map((opt) => {
                    const checked = opt.fromTypes.every((ft) => selectedTxFromTypes.includes(ft));
                    return (
                      <label key={opt.label} className="wallet-option-row">
                        <input
                          type="checkbox"
                          className="toggle-switch"
                          checked={checked}
                          onChange={(e) => {
                            setSelectedTxFromTypes((prev) =>
                              e.target.checked
                                ? [...new Set([...prev, ...opt.fromTypes])]
                                : prev.filter((ft) => !opt.fromTypes.includes(ft)),
                            );
                          }}
                        />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
              )}

              {walletSheetsSelected && (
                <div className="wallet-options">
                  <p className="wallet-options-title">Wallet Pricing</p>
                  <p className="subtle wallet-note">
                    Applies only to Bounty, Deposits, Withdrawals and Transactions. GoMining API
                    does not return fiat pricing for these sheets, so we enrich them using CoinGecko
                    during export.
                  </p>
                  <label className="wallet-option-row">
                    <input
                      type="checkbox"
                      className="toggle-switch"
                      checked={includeWalletFiat}
                      onChange={(e) => setIncludeWalletFiat(e.target.checked)}
                    />
                    Include fiat pricing (USD). Extra fiat is configured below.
                  </label>
                  {includeWalletFiat && (
                    <p className="wallet-warning">
                      Warning: this can take some time. CoinGecko free plan has rate limits, and
                      each limit hit triggers a 60s cooldown.
                    </p>
                  )}
                </div>
              )}

              <div className="excel-options">
                <p className="wallet-options-title">Extra Fiat Conversion</p>
                <label className="wallet-option-row">
                  <input
                    type="checkbox"
                    className="toggle-switch"
                    checked={includeExcelFiat}
                    onChange={(e) => setIncludeExcelFiat(e.target.checked)}
                  />
                  Include extra conversion column (USD is always included)
                </label>
                {includeExcelFiat && (
                  <label className="wallet-option-row wallet-currency-row">
                    Currency
                    <FiatDropdown value={excelFiatCurrency} onChange={setExcelFiatCurrency} />
                  </label>
                )}
              </div>

              {cachedCount > 0 && cachedCount < selectedKeys.length && (
                <p className="subtle">
                  {selectedKeys.length - cachedCount} sheet(s) will be fetched.{" "}
                  {cachedCount} stored, will be probed for updates first.
                </p>
              )}
              {cachedCount === selectedKeys.length && selectedKeys.length > 0 && (
                <p className="subtle">All sheets stored. Will probe for updates before building.</p>
              )}

              <div className="export-btn-wrapper">
                <span className="export-limit-notice">Max 1 export per day.</span>
                <button
                  className="btn-primary btn-primary-large"
                  disabled={loading || selectedKeys.length === 0}
                  onClick={handleExport}
                >
                  {loading ? "Processing..." : "Build Excel"}
                </button>
              </div>
            </section>
          </>
        )}

        {message ? <div className="message">{message}</div> : null}

        <div className="free-tier-notice">
          This app runs on free-tier services (Cloudflare, CoinGecko, FX Rates API). If a request
          fails due to rate limits, wait a moment and try again, or try again tomorrow.
        </div>

        <DonateSection />
      </main>
    </div>
  );
}

export default App;
