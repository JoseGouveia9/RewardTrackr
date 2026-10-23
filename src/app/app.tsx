import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup } from "framer-motion";
import { Routes, Route, Navigate, useNavigate } from "react-router";
import { AuthPanel, useAuth } from "@/features/auth";
import { useExport } from "@/features/export";
import { BuildScreen, useExportConfig, useLiveMinerWarsSetting } from "@/features/settings";
import { ShareModal } from "@/features/records";
import { FetchFailedModal } from "@/components/fetch-failed-modal/fetch-failed-modal";
import { LanguagePicker } from "@/components/language-picker/language-picker";
import { StatusMessage } from "@/components/status-message/status-message";
import { useTheme } from "./theme-context";
import { useAccountSwitch } from "./hooks/use-account-switch";
import { useAutoResync } from "./hooks/use-auto-resync";
import { useCacheState } from "./hooks/use-cache-state";
import { useLegacyHashRedirect } from "./hooks/use-legacy-hash-redirect";
import { AppFooter } from "./components/app-footer/app-footer";
import { AppHeader } from "./components/app-header/app-header";
import { AppNotices } from "./components/app-notices/app-notices";
import { RecordsPage } from "./routes/records-page";
import "./app.css";

const CommunityPage = lazy(() =>
  import("@/features/community").then((loadedModule) => ({ default: loadedModule.CommunityPage })),
);
const SharedView = lazy(() =>
  import("./routes/shared-view").then((loadedModule) => ({ default: loadedModule.SharedView })),
);
const AboutPage = lazy(() =>
  import("@/features/legal").then((loadedModule) => ({ default: loadedModule.AboutPage })),
);
const PrivacyPage = lazy(() =>
  import("@/features/legal").then((loadedModule) => ({ default: loadedModule.PrivacyPage })),
);
const TermsPage = lazy(() =>
  import("@/features/legal").then((loadedModule) => ({ default: loadedModule.TermsPage })),
);

function App() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const [message, setMessage] = useState<string>("");
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const [liveMinerWarsEnabled, setLiveMinerWarsEnabled] = useLiveMinerWarsSetting();

  const exportConfig = useExportConfig();
  const { selectedKeys, includeWalletFiat, includeExcelFiat, excelFiatCurrency, resetConfig } =
    exportConfig;

  const {
    cache,
    cacheVersion,
    dataVersionWiped,
    setCache,
    setCacheVersion,
    handleCacheUpdate,
    handleTabSeen,
    hasCachedSheets,
    hasNewRecords,
  } = useCacheState(includeWalletFiat);

  const { storedToken, user, syncedAlias, handleManualTokenSync, handleLogout } =
    useAuth(setMessage);

  const isDevHost =
    typeof window !== "undefined" &&
    /^(localhost|127\.0\.0\.1|dev\.rewardtrackr\.com)$/i.test(window.location.hostname);
  const showManualTokenInput = import.meta.env.DEV || isDevHost;

  useAccountSwitch({ user, resetConfig, setCache, setCacheVersion, setMessage });
  useLegacyHashRedirect();

  const {
    loading,
    fetchingKeys,
    minerWarsPrefetching,
    handleExport,
    handleDownloadCachedExport,
    refreshKeys,
    handleClearCache,
  } = useExport({
    storedToken,
    selectedKeys,
    cache,
    includeWalletFiat,
    includeExcelFiat,
    excelFiatCurrency,
    liveMinerWarsEnabled,
    onMessage: setMessage,
    onCacheUpdate: handleCacheUpdate,
    onStarted: useCallback(() => void navigate("/records"), [navigate]),
  });

  useAutoResync({
    dataVersionWiped,
    storedToken,
    selectedKeys,
    handleExport,
    onMessage: setMessage,
  });

  const displayAlias = syncedAlias || user?.alias?.trim() || "User";
  const defaultSignedInPath = hasCachedSheets ? "/records" : "/build";
  const homePath = user ? defaultSignedInPath : "/";

  const previousUserRef = useRef(user);
  useEffect(() => {
    if (previousUserRef.current !== null && user === null) {
      setShareModalOpen(false);
    }
    previousUserRef.current = user;
  }, [user]);

  const closeMessage = () => setMessage("");

  return (
    <div className={`page ${theme === "dark" ? "theme-dark" : "theme-light"}`}>
      <div className="background-shape background-shape-top" />
      <div className="background-shape background-shape-bottom" />

      <main className="container">
        <AppHeader
          user={user}
          displayAlias={displayAlias}
          theme={theme}
          hasCachedSheets={hasCachedSheets}
          hasNewRecords={hasNewRecords}
          homePath={homePath}
          onToggleTheme={toggleTheme}
          onLogout={handleLogout}
          onOpenLanguage={() => setLanguagePickerOpen(true)}
        />

        <AppNotices signedIn={!!user} />

        <LayoutGroup>
          <Suspense fallback={null}>
            <Routes>
              <Route
                path="/community"
                element={<CommunityPage onClose={() => void navigate(homePath)} />}
              />

              <Route
                path="/records"
                element={
                  <RecordsPage
                    cache={cache}
                    cacheVersion={cacheVersion}
                    onTabSeen={handleTabSeen}
                    status={{ message, onClose: closeMessage }}
                    fetchState={{ loading, fetchingKeys, minerWarsPrefetching }}
                    actions={{
                      onRefreshKeys: refreshKeys,
                      onDownloadRecords: handleDownloadCachedExport,
                      onShare: user && hasCachedSheets ? () => setShareModalOpen(true) : undefined,
                    }}
                  />
                }
              />

              <Route path="/view/:id" element={<SharedView />} />

              <Route
                path="/build"
                element={
                  !user ? (
                    <Navigate to="/" replace />
                  ) : (
                    <BuildScreen
                      config={exportConfig}
                      cache={cache}
                      hasCachedSheets={hasCachedSheets}
                      liveMinerWars={{
                        enabled: liveMinerWarsEnabled,
                        onToggle: setLiveMinerWarsEnabled,
                      }}
                      buildFlow={{
                        loading,
                        message,
                        onExport: handleExport,
                        onClearCache: handleClearCache,
                        onCloseMessage: closeMessage,
                      }}
                    />
                  )
                }
              />

              <Route
                path="/"
                element={
                  !user ? (
                    <>
                      <AuthPanel
                        showManualTokenInput={showManualTokenInput}
                        onManualTokenSubmit={handleManualTokenSync}
                      />
                      <StatusMessage
                        message={message}
                        onClose={closeMessage}
                        keyPrefix="auth-message"
                      />
                    </>
                  ) : (
                    <Navigate to={defaultSignedInPath} replace />
                  )
                }
              />

              <Route path="/about" element={<AboutPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>

          <AppFooter />
        </LayoutGroup>
      </main>

      <AnimatePresence>
        {shareModalOpen && (
          <ShareModal
            cache={cache}
            defaultAlias={displayAlias}
            authToken={storedToken}
            onClose={() => setShareModalOpen(false)}
          />
        )}
      </AnimatePresence>

      <LanguagePicker open={languagePickerOpen} onClose={() => setLanguagePickerOpen(false)} />
      <FetchFailedModal />
    </div>
  );
}

export default App;
