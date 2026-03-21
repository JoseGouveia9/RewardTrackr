import { useCallback, useMemo, useState } from "react";
import {
  WALLET_TX_KEYS,
  TX_CHECKBOX_OPTIONS,
  ALL_TX_FROM_TYPES,
} from "@/features/export/config/wallet-types";
import { ALL_REWARD_KEYS } from "@/features/export/config/reward-configs";
import { loadAllCacheEntries } from "@/features/export/utils/cache";
import type {
  CacheState,
  ExtraFiatCurrency,
  RewardGroup,
  RewardKey,
} from "@/features/export/types";
import { AuthPanel } from "@/features/auth/components/auth-panel";
import { FiatDropdown } from "@/features/export/components/fiat-dropdown";
import { DonateSection } from "@/components/donate-section";
import { UserPanel } from "@/features/auth/components/user-panel";
import { SheetSelector } from "@/features/export/components/sheet-selector";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useExport } from "@/features/export/hooks/use-export";
import "./App.css";

const THEME_STORAGE_KEY = "gm_theme";

type ThemeMode = "light" | "dark";

function App() {
  const [message, setMessage] = useState<string>("");
  const [selectedKeys, setSelectedKeys] = useState<RewardKey[]>(() => [...ALL_REWARD_KEYS]);
  const [selectedTxFromTypes, setSelectedTxFromTypes] = useState<string[]>(() => [
    ...ALL_TX_FROM_TYPES,
  ]);
  const [includeWalletFiat, setIncludeWalletFiat] = useState<boolean>(true);
  const [includeExcelFiat, setIncludeExcelFiat] = useState<boolean>(true);
  const [excelFiatCurrency, setExcelFiatCurrency] = useState<ExtraFiatCurrency>("EUR");
  const [cache, setCache] = useState<CacheState>(() => loadAllCacheEntries());
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" ? "light" : "dark";
  });

  const { storedToken, user, syncedAlias, handleCheckSync, handleLogout } = useAuth(setMessage);

  const { loading, handleExport, handleClearCache } = useExport({
    storedToken,
    selectedKeys,
    cache,
    includeWalletFiat,
    includeExcelFiat,
    excelFiatCurrency,
    selectedTxFromTypes,
    onMessage: setMessage,
    onCacheUpdate: setCache,
  });

  const toggleTheme = useCallback((): void => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const isGroupSelected = useCallback(
    (group: RewardGroup): boolean => group.keys.every((k) => selectedKeys.includes(k)),
    [selectedKeys],
  );

  const toggleGroup = useCallback((group: RewardGroup): void => {
    setSelectedKeys((prev) => {
      const allSelected = group.keys.every((k) => prev.includes(k));
      if (allSelected) return prev.filter((k) => !group.keys.includes(k));
      return [...new Set([...prev, ...group.keys])];
    });
  }, []);

  const toggleAll = useCallback((): void => {
    setSelectedKeys((prev) => (prev.length === ALL_REWARD_KEYS.length ? [] : [...ALL_REWARD_KEYS]));
  }, []);

  const walletSheetsSelected = useMemo(
    () => [...WALLET_TX_KEYS].some((k) => selectedKeys.includes(k)),
    [selectedKeys],
  );

  const cachedCount = useMemo(
    () => selectedKeys.filter((k) => cache[k]).length,
    [selectedKeys, cache],
  );

  const displayAlias = syncedAlias || user?.alias?.trim() || "User";
  const hasCachedSheets = useMemo(() => Object.values(cache).some(Boolean), [cache]);

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
            <UserPanel user={user} displayAlias={displayAlias} onLogout={handleLogout} />

            <section className="panel panel-actions">
              <div className="actions-header">
                <h2>Select Sheets</h2>
                {hasCachedSheets && (
                  <button className="btn-danger btn-danger-small" onClick={handleClearCache}>
                    Clear Cache
                  </button>
                )}
              </div>

              <SheetSelector
                cache={cache}
                onToggleGroup={toggleGroup}
                onToggleAll={toggleAll}
                isGroupSelected={isGroupSelected}
              />

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
                  {selectedKeys.length - cachedCount} sheet(s) will be fetched. {cachedCount}{" "}
                  stored, will be probed for updates first.
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
