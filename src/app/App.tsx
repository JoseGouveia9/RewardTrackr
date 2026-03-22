import { useMemo, useState } from "react";
import { loadAllCacheEntries } from "@/features/export/utils/cache";
import { AuthPanel, UserPanel, useAuth } from "@/features/auth";
import { SheetSelector, ExportOptions, useExport, useExportConfig } from "@/features/export";
import type { CacheState } from "@/features/export";
import { DonateSection } from "@/components/donate-section";
import { ErrorBoundary } from "@/components/error-boundary";
import { useTheme } from "./theme-context";
import logo from "/logo.png";
import "./App.css";

function App() {
  const [message, setMessage] = useState<string>("");
  const [cache, setCache] = useState<CacheState>(() => loadAllCacheEntries());

  const { theme, toggleTheme } = useTheme();

  const {
    selectedKeys,
    selectedTxFromTypes,
    includeWalletFiat,
    includeExcelFiat,
    excelFiatCurrency,
    isGroupSelected,
    walletSheetsSelected,
    toggleGroup,
    toggleAll,
    toggleTxType,
    setIncludeWalletFiat,
    setIncludeExcelFiat,
    setFiatCurrency,
  } = useExportConfig();

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

  const displayAlias = syncedAlias || user?.alias?.trim() || "User";

  const cachedCount = useMemo(
    () => selectedKeys.filter((k) => cache[k]).length,
    [selectedKeys, cache],
  );

  const hasCachedSheets = useMemo(() => Object.values(cache).some(Boolean), [cache]);

  return (
    <div className={`page ${theme === "dark" ? "theme-dark" : "theme-light"}`}>
      <div className="bg-shape shape-a" />
      <div className="bg-shape shape-b" />

      <main className="container">
        <header className="hero">
          <div className="hero-top">
            <div className="hero-title-row">
              <img src={logo} alt="GoMining Exporter logo" className="hero-logo" />
              <div>
                <h1>GoMining Exporter</h1>
                <p className="hero-subtitle">
                  Connect your GoMining session and generate a complete all-rewards Excel report in
                  one click. Your token never leaves your browser.
                </p>
              </div>
            </div>
            <button type="button" className="btn-theme" onClick={toggleTheme}>
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
          </div>
        </header>

        <div className="app-notice">
          This app runs on free-tier services (Cloudflare, CoinGecko, FX Rates API). If a request
          fails due to rate limits, wait a moment and try again, or try again tomorrow.
          <br /> This is an unofficial tool and is not affiliated with, endorsed by, or associated
          with the GoMining team.
        </div>

        {!user ? (
          <AuthPanel onSync={handleCheckSync} />
        ) : (
          <>
            <UserPanel user={user} displayAlias={displayAlias} onLogout={handleLogout} />

            <ErrorBoundary>
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
                  onToggleTxType={toggleTxType}
                  includeWalletFiat={includeWalletFiat}
                  onToggleWalletFiat={setIncludeWalletFiat}
                  includeExcelFiat={includeExcelFiat}
                  onToggleExcelFiat={setIncludeExcelFiat}
                  excelFiatCurrency={excelFiatCurrency}
                  onChangeFiatCurrency={setFiatCurrency}
                />

                {cachedCount > 0 && cachedCount < selectedKeys.length && (
                  <p className="subtle">
                    {selectedKeys.length - cachedCount} sheet(s) will be fetched. {cachedCount}{" "}
                    stored, will be probed for updates first.
                  </p>
                )}
                {cachedCount === selectedKeys.length && selectedKeys.length > 0 && (
                  <p className="subtle">
                    All sheets stored. Will probe for updates before building.
                  </p>
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
            </ErrorBoundary>
          </>
        )}

        {message ? <div className="message">{message}</div> : null}

        <DonateSection />

        <p className="copyright">© 2026 José Gouveia · Moustachio</p>
      </main>
    </div>
  );
}

export default App;
