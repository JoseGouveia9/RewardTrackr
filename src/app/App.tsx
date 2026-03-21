import { useCallback, useMemo, useState } from "react";
import { WALLET_TX_KEYS, ALL_TX_FROM_TYPES } from "@/features/export/config/wallet-types";
import { ALL_REWARD_KEYS } from "@/features/export/config/reward-configs";
import { loadAllCacheEntries } from "@/features/export/utils/cache";
import { AuthPanel, UserPanel, useAuth } from "@/features/auth";
import { SheetSelector, ExportOptions, useExport } from "@/features/export";
import type { CacheState, ExtraFiatCurrency, RewardGroup, RewardKey } from "@/features/export";
import { DonateSection } from "@/components/donate-section";
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

  const handleToggleTxType = useCallback((fromTypes: string[], checked: boolean): void => {
    setSelectedTxFromTypes((prev) =>
      checked
        ? [...new Set([...prev, ...fromTypes])]
        : prev.filter((ft) => !fromTypes.includes(ft)),
    );
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

              <ExportOptions
                selectedKeys={selectedKeys}
                walletSheetsSelected={walletSheetsSelected}
                selectedTxFromTypes={selectedTxFromTypes}
                onToggleTxType={handleToggleTxType}
                includeWalletFiat={includeWalletFiat}
                onToggleWalletFiat={setIncludeWalletFiat}
                includeExcelFiat={includeExcelFiat}
                onToggleExcelFiat={setIncludeExcelFiat}
                excelFiatCurrency={excelFiatCurrency}
                onChangeFiatCurrency={setExcelFiatCurrency}
              />

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
