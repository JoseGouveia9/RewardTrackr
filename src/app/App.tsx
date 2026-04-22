import { useCallback, useEffect, useRef, useMemo, useState, type KeyboardEvent } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router";
import { AppNotice } from "@/components/app-notice/app-notice";
import { loadAllCacheEntries } from "@/features/export/utils/cache";
import { AuthPanel, HeaderUserMenu, useAuth } from "@/features/auth";
import { SupportButton } from "@/components/support-button/support-button";
import { SheetSelector, ExportOptions, useExport, useExportConfig } from "@/features/export";
import type { CacheState, RewardKey } from "@/features/export";
import { AnnouncementBanner } from "@/components/announcement-banner/announcement-banner";
import { ReferralButton } from "@/components/referral-button/referral-button";
import { DataViewerButton, DataViewer } from "@/features/data-viewer";
import { ShareModal, CommunityPage } from "@/features/shared";
import { ErrorBoundary } from "@/components/error-boundary/error-boundary";
import { useTheme } from "./theme-context";
import { MessageBanner } from "@/components/message-banner/message-banner";
import { useNotices } from "./hooks/use-notices";
import { useAccountSwitch } from "./hooks/use-account-switch";
import { SharedView } from "./routes/shared-view";
import { LS_KEY_REWARD_PREFIX } from "@/lib/storage-keys";
import logo from "/logo.webp";
import "./App.css";

const LAYOUT_SPRING = { layout: { type: "spring" as const, stiffness: 220, damping: 28 } };

function WarningNoticeIcon() {
  return (
    <svg
      className="app-notice-icon"
      xmlns="http://www.w3.org/2000/svg"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function ShieldNoticeIcon() {
  return (
    <svg
      className="app-notice-icon"
      xmlns="http://www.w3.org/2000/svg"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [message, setMessage] = useState<string>("");
  const [cache, setCache] = useState<CacheState>(() => loadAllCacheEntries());
  const [cacheVersion, setCacheVersion] = useState(0);
  const [referralOpen, setReferralOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const { theme, toggleTheme } = useTheme();
  const notices = useNotices();

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
    resetConfig,
  } = useExportConfig();

  const { storedToken, user, syncedAlias, handleCheckSync, handleLogout } = useAuth(setMessage);

  useAccountSwitch({ user, resetConfig, setCache, setCacheVersion, setMessage });

  const handleCacheUpdate = useCallback((nextCache: CacheState) => {
    setCache(nextCache);
    setCacheVersion((v) => v + 1);
  }, []);

  const { loading, fetchingKeys, handleExport, handleClearCache } = useExport({
    storedToken,
    selectedKeys,
    cache,
    includeWalletFiat,
    includeExcelFiat,
    excelFiatCurrency,
    selectedTxFromTypes,
    onMessage: setMessage,
    onCacheUpdate: handleCacheUpdate,
  });

  const displayAlias = syncedAlias || user?.alias?.trim() || "User";

  const prevUserRef = useRef(user);
  useEffect(() => {
    if (prevUserRef.current !== null && user === null) {
      setShareModalOpen(false);
    }
    prevUserRef.current = user;
  }, [user]);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#view=")) {
      const id = hash.slice(6).trim();
      if (id) void navigate(`/view/${id}`, { replace: true });
    }
  }, [navigate]);

  const cachedCount = useMemo(
    () => selectedKeys.filter((k) => cache[k]).length,
    [selectedKeys, cache],
  );

  const hasCachedSheets = useMemo(() => Object.values(cache).some(Boolean), [cache]);

  const hasNewRecords = useMemo(() => {
    const purchasesNew =
      (cache["purchases"]?.newEntriesCount ?? 0) + (cache["upgrades"]?.newEntriesCount ?? 0);
    return (
      (cache["solo-mining"]?.newEntriesCount ?? 0) > 0 ||
      (cache["minerwars"]?.newEntriesCount ?? 0) > 0 ||
      (cache["bounty"]?.newEntriesCount ?? 0) > 0 ||
      (cache["referrals"]?.newEntriesCount ?? 0) > 0 ||
      (cache["ambassador"]?.newEntriesCount ?? 0) > 0 ||
      (cache["deposits"]?.newEntriesCount ?? 0) > 0 ||
      (cache["withdrawals"]?.newEntriesCount ?? 0) > 0 ||
      purchasesNew > 0 ||
      (cache["simple-earn"]?.newEntriesCount ?? 0) > 0 ||
      (cache["transactions"]?.newEntriesCount ?? 0) > 0
    );
  }, [cache]);

  const handleTabSeen = useCallback((key: RewardKey) => {
    setCache((prev) => {
      const entry = prev[key];
      if (!entry || (entry.newEntriesCount ?? 0) <= 0) return prev;
      const nextEntry = { ...entry, newEntriesCount: 0 };
      try {
        localStorage.setItem(LS_KEY_REWARD_PREFIX + key, JSON.stringify(nextEntry));
        // eslint-disable-next-line no-empty
      } catch {}
      return { ...prev, [key]: nextEntry };
    });
    setCacheVersion((v) => v + 1);
  }, []);

  const isRecords = location.pathname === "/records";
  const isCommunity = location.pathname === "/community" || location.pathname.startsWith("/view/");

  const handleHeroTitleClick = useCallback(() => {
    void navigate("/");
  }, [navigate]);

  const handleHeroTitleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        void navigate("/");
      }
    },
    [navigate],
  );

  return (
    <div className={`page ${theme === "dark" ? "theme-dark" : "theme-light"}`}>
      <div className="background-shape background-shape-top" />
      <div className="background-shape background-shape-bottom" />

      <main className="container">
        <header className="hero">
          <div className="hero-top">
            <div
              className="hero-title-row"
              role="button"
              tabIndex={0}
              onClick={handleHeroTitleClick}
              onKeyDown={handleHeroTitleKeyDown}
              aria-label="Go to main page"
            >
              <img src={logo} alt="RewardTrackr logo" className="hero-logo" />
              <div>
                <motion.span
                  className="hero-label"
                  initial={
                    user
                      ? { fontSize: "0.65rem", letterSpacing: "0.08em", marginBottom: "2px" }
                      : { fontSize: "1.35rem", letterSpacing: "0.06em", marginBottom: "0px" }
                  }
                  animate={
                    user
                      ? { fontSize: "0.65rem", letterSpacing: "0.08em", marginBottom: "2px" }
                      : { fontSize: "1.35rem", letterSpacing: "0.06em", marginBottom: "0px" }
                  }
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <motion.span
                    className="hero-label-main"
                    initial={{ color: user ? "#6d7589" : theme === "dark" ? "#ffffff" : "#22283a" }}
                    animate={{ color: user ? "#6d7589" : theme === "dark" ? "#ffffff" : "#22283a" }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    REWARD
                  </motion.span>
                  <span className="hero-label-accent">TRACKR</span>
                </motion.span>
                <AnimatePresence>
                  {user && (
                    <motion.h1
                      key="greeting"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                    >
                      {`Hello ${displayAlias} 👋`}
                    </motion.h1>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div className="hero-actions">
              <SupportButton />
              <button
                type="button"
                className={`sh-trigger-btn${isCommunity ? " sh-trigger-btn--active" : ""}`}
                onClick={() => void navigate(isCommunity ? "/" : "/community")}
                aria-label="Community"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span>Community</span>
              </button>
              <AnimatePresence initial={false}>
                {hasCachedSheets ? (
                  <motion.div
                    key="records-trigger"
                    className="dv-trigger-wrap"
                    initial={{ opacity: 0, scale: 0.82 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.82 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <DataViewerButton
                      active={isRecords}
                      onClick={() => void navigate(isRecords ? "/" : "/records")}
                      hasNew={hasNewRecords}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>
              <motion.div
                layout
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={`hero-profile-wrap${hasCachedSheets ? " hero-profile-wrap--narrow" : ""}`}
              >
                {!user && (
                  <ReferralButton
                    open={referralOpen}
                    onOpen={() => setReferralOpen(true)}
                    onClose={() => setReferralOpen(false)}
                  />
                )}
                {user && (
                  <HeaderUserMenu
                    user={user}
                    displayAlias={displayAlias}
                    theme={theme}
                    onToggleTheme={toggleTheme}
                    onLogout={handleLogout}
                  />
                )}
              </motion.div>
            </div>
          </div>
          {!user && (
            <p className="hero-subtitle">
              Connect your GoMining session and generate a complete all-rewards Excel report in one
              click. Your token never leaves your browser.
            </p>
          )}
        </header>

        {notices.announcement && (
          <AnnouncementBanner
            visible={!notices.announcementDismissed}
            message={notices.announcement.message}
            onDismiss={notices.dismissAnnouncement}
          />
        )}

        <AppNotice
          visible={!notices.noticeRateLimitsDismissed}
          onDismiss={notices.dismissRateLimits}
          icon={<WarningNoticeIcon />}
        >
          This app currently runs on free-tier services (Cloudflare, CoinGecko, FX Rates API). If a
          request fails due to rate limits, wait a moment and try again, or try again tomorrow.
        </AppNotice>

        <AppNotice
          visible={!notices.noticeUnofficialDismissed}
          className="app-notice-unofficial"
          onDismiss={notices.dismissUnofficial}
          icon={<WarningNoticeIcon />}
        >
          This is an unofficial tool and is not affiliated with, endorsed by, or associated with the
          GoMining team.
        </AppNotice>

        <AppNotice
          visible={!user && !notices.noticeOpenSourceDismissed}
          className="app-notice-opensource"
          onDismiss={notices.dismissOpenSource}
          icon={<ShieldNoticeIcon />}
        >
          This app and extension were built with security and transparency in mind. The full source
          code is open source and accessible to anyone who wants to inspect it before using it.{" "}
          <a
            href="https://github.com/JoseGouveia9/RewardTrackr"
            target="_blank"
            rel="noopener noreferrer"
          >
            Check it here.
          </a>
        </AppNotice>

        <LayoutGroup>
          <Routes>
            <Route
              path="/community"
              element={<CommunityPage onClose={() => void navigate("/")} />}
            />

            <Route
              path="/records"
              element={
                <>
                  <AnimatePresence mode="popLayout">
                    {message ? (
                      <motion.div layout transition={LAYOUT_SPRING}>
                        <MessageBanner message={message} onClose={() => setMessage("")} />
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                  <DataViewer
                    onClose={() => void navigate("/")}
                    isFetching={loading}
                    fetchingKeys={fetchingKeys}
                    cacheVersion={cacheVersion}
                    onTabSeen={handleTabSeen}
                    sharedData={null}
                    title="Records"
                    banner={undefined}
                    onShare={user && hasCachedSheets ? () => setShareModalOpen(true) : undefined}
                    shareDisabled={loading}
                  />
                </>
              }
            />

            <Route path="/view/:id" element={<SharedView />} />

            <Route
              path="/"
              element={
                !user ? (
                  <>
                    <AuthPanel onSync={handleCheckSync} />
                    <AnimatePresence mode="popLayout">
                      {message ? (
                        <motion.div layout transition={LAYOUT_SPRING}>
                          <MessageBanner
                            key={`auth-message-${message.replace(/\b\d+s\b/g, "").replace(/\d+\/\d+/g, "")}`}
                            message={message}
                            onClose={() => setMessage("")}
                          />
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </>
                ) : (
                  <ErrorBoundary>
                    <motion.section className="panel-glass" layout transition={LAYOUT_SPRING}>
                      <div className="actions-header">
                        <h3>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            className="section-icon"
                          >
                            <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
                          </svg>
                          Select Sheets
                        </h3>
                        {hasCachedSheets && (
                          <button
                            className="btn-danger btn-danger-small"
                            onClick={handleClearCache}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M3 6h18" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
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
                    </motion.section>

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

                    <motion.section
                      className="export-section panel-glass"
                      layout
                      transition={LAYOUT_SPRING}
                    >
                      <div className="export-meta-row">
                        {cachedCount > 0 && cachedCount < selectedKeys.length && (
                          <p className="subtle">
                            {selectedKeys.length - cachedCount} sheet(s) will be fetched.{" "}
                            {cachedCount} stored, will be probed for updates first.
                          </p>
                        )}
                        {cachedCount === selectedKeys.length && selectedKeys.length > 0 && (
                          <p className="subtle">
                            All sheets stored. Will probe for updates before building.
                          </p>
                        )}
                        <p className="export-limit-notice">Max 1 export per day.</p>
                      </div>
                      <div className="export-btn-wrapper">
                        <button
                          className="btn-primary btn-primary-large"
                          disabled={loading || selectedKeys.length === 0}
                          onClick={() => {
                            void navigate("/records");
                            void handleExport();
                          }}
                        >
                          {loading ? (
                            "Processing..."
                          ) : (
                            <>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                                className="btn-icon"
                              >
                                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                                <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                                <path d="M8 18v-2" />
                                <path d="M12 18v-4" />
                                <path d="M16 18v-6" />
                              </svg>
                              Build Report
                            </>
                          )}
                        </button>
                      </div>
                    </motion.section>

                    <AnimatePresence mode="popLayout">
                      {message ? (
                        <motion.div layout transition={LAYOUT_SPRING}>
                          <MessageBanner
                            key={`main-message-${message.replace(/\b\d+s\b/g, "").replace(/\d+\/\d+/g, "")}`}
                            message={message}
                            onClose={() => setMessage("")}
                          />
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </ErrorBoundary>
                )
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          <motion.p className="copyright" layout transition={LAYOUT_SPRING}>
            © 2026 José Gouveia · Moustachio ·{" "}
            <a
              className="copyright-link"
              href="https://docs.google.com/forms/d/e/1FAIpQLSe98CKOga2pnoXh2SdXu0uxOBd9OOIDm1JsR6ludeGH5HOoLg/viewform"
              target="_blank"
              rel="noopener noreferrer"
            >
              Feedback &amp; Suggestions
            </a>
          </motion.p>
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
    </div>
  );
}

export default App;
