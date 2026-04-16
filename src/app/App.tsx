import { useCallback, useEffect, useRef, useMemo, useState, type KeyboardEvent } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { AppNotice } from "@/components/app-notice/app-notice";
import { clearAllCacheEntries, loadAllCacheEntries } from "@/features/export/utils/cache";
import { AuthPanel, HeaderUserMenu, useAuth } from "@/features/auth";
import { SupportButton } from "@/components/support-button/support-button";
import { SheetSelector, ExportOptions, useExport, useExportConfig } from "@/features/export";
import type { CacheState, RewardKey } from "@/features/export";
import { AnnouncementBanner } from "@/components/announcement-banner/announcement-banner";
import { ReferralButton } from "@/components/referral-button/referral-button";
import { DataViewerButton, DataViewer } from "@/features/data-viewer";
import {
  ShareModal,
  SharedBanner,
  CommunityPage,
  fetchSharedProfile,
  fetchAnnouncement,
} from "@/features/shared";
import type { Announcement } from "@/features/shared";
import type { SharedProfile } from "@/features/shared";
import { ErrorBoundary } from "@/components/error-boundary/error-boundary";
import { useTheme } from "./theme-context";
import { MessageBanner } from "@/components/message-banner/message-banner";
import {
  LS_KEY_EXPORT_CONFIG,
  LS_KEY_LAST_SYNC_USER,
  LS_KEY_NOTICE_RATE_LIMITS,
  LS_KEY_NOTICE_UNOFFICIAL,
  LS_KEY_NOTICE_OPENSOURCE,
  LS_KEY_NOTICE_ANNOUNCEMENT_PREFIX,
  LS_KEY_REWARD_PREFIX,
} from "@/lib/storage-keys";
import logo from "/logo.webp";
import "./App.css";

const BASE_LAYOUT_SPRING = { layout: { type: "spring" as const, stiffness: 220, damping: 28 } };

function getInitialRouteState(): {
  view: "main" | "records" | "community";
  shouldLoadShared: boolean;
  sharedId: string | null;
} {
  const hash = window.location.hash;
  if (hash.startsWith("#view=")) {
    const id = hash.slice(6).trim();
    if (id) return { view: "records", shouldLoadShared: true, sharedId: id };
  }
  if (hash === "#community") {
    return { view: "community", shouldLoadShared: false, sharedId: null };
  }
  return { view: "main", shouldLoadShared: false, sharedId: null };
}

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

declare global {
  interface Window {
    kofiWidgetOverlay?: {
      draw: (username: string, options: Record<string, string>) => void;
    };
  }
}

// Root application component: wires together auth, export config, cache, and view routing.
function App() {
  const initialRouteState = getInitialRouteState();
  const initialSharedId = initialRouteState.sharedId;
  const [message, setMessage] = useState<string>("");
  const [cache, setCache] = useState<CacheState>(() => loadAllCacheEntries());
  const [supportOpen, setSupportOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const [view, setView] = useState<"main" | "records" | "community">(initialRouteState.view);
  const [disableViewMotion, setDisableViewMotion] = useState(false);
  const [cacheVersion, setCacheVersion] = useState(0);
  const [sharedProfile, setSharedProfile] = useState<SharedProfile | null>(null);
  const [sharedLoading, setSharedLoading] = useState(initialRouteState.shouldLoadShared);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [noticeRateLimitsDismissed, setNoticeRateLimitsDismissed] = useState(
    () => localStorage.getItem(LS_KEY_NOTICE_RATE_LIMITS) === "1",
  );
  const [noticeUnofficialDismissed, setNoticeUnofficialDismissed] = useState(
    () => localStorage.getItem(LS_KEY_NOTICE_UNOFFICIAL) === "1",
  );
  const [noticeOpenSourceDismissed, setNoticeOpenSourceDismissed] = useState(
    () => localStorage.getItem(LS_KEY_NOTICE_OPENSOURCE) === "1",
  );
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);

  useEffect(() => {
    fetchAnnouncement().then((data) => {
      if (!data) return;
      const dismissed = localStorage.getItem(LS_KEY_NOTICE_ANNOUNCEMENT_PREFIX + data.id) === "1";
      setAnnouncementDismissed(dismissed);
      setAnnouncement(data);
    });
  }, []);

  // Persists a notice dismissal to localStorage and updates the local state.
  function dismissNotice(key: string, setter: (v: boolean) => void) {
    localStorage.setItem(key, "1");
    setter(true);
  }

  useEffect(() => {
    if (window.innerWidth <= 640) return;
    const script = document.createElement("script");
    script.src = "https://storage.ko-fi.com/cdn/scripts/overlay-widget.js";
    script.async = true;
    script.onload = () => {
      window.kofiWidgetOverlay?.draw("moustachio", {
        type: "floating-chat",
        "floating-chat.donateButton.text": "Support the project",
        "floating-chat.donateButton.background-color": "#F7931A",
        "floating-chat.donateButton.text-color": "#fff",
      });

      const attachPopupObserver = (): void => {
        const popup = document.querySelector(".floating-chat-kofi-popup-iframe");
        if (!popup) return;
        const observer = new MutationObserver(() => {
          const el = popup as HTMLElement;
          if (el.style.opacity === "1") {
            setSupportOpen(true);
          }
        });
        observer.observe(popup, { attributes: true, attributeFilter: ["style"] });
      };

      setTimeout(attachPopupObserver, 1000);
      setTimeout(attachPopupObserver, 3000);
    };
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

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
    resetConfig,
  } = useExportConfig();

  const { storedToken, user, syncedAlias, handleCheckSync, handleLogout } = useAuth(setMessage);

  const handleCacheUpdate = useCallback((nextCache: CacheState) => {
    setCache(nextCache);
    setCacheVersion((v) => v + 1);
  }, []);

  const { loading, handleExport, handleClearCache } = useExport({
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

  const currentUserIdentity = user?.id
    ? `id:${user.id}`
    : user?.email
      ? `email:${String(user.email).toLowerCase()}`
      : null;

  useEffect(() => {
    if (!currentUserIdentity) return;

    const lastUser = localStorage.getItem(LS_KEY_LAST_SYNC_USER);
    const hasStablePrefix = (value: string) =>
      value.startsWith("id:") || value.startsWith("email:");
    const lastComparable = lastUser && hasStablePrefix(lastUser) ? lastUser : null;

    if (lastComparable && lastComparable !== currentUserIdentity) {
      clearAllCacheEntries();
      localStorage.removeItem(LS_KEY_EXPORT_CONFIG);
      resetConfig();
      setCache(loadAllCacheEntries());
      setCacheVersion((v) => v + 1);
      setMessage("Different account detected. Cache and export options were reset.");
    }

    localStorage.setItem(LS_KEY_LAST_SYNC_USER, currentUserIdentity);
  }, [currentUserIdentity, resetConfig]);

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
      } catch {
        // ignore storage write errors
      }

      return { ...prev, [key]: nextEntry };
    });
    setCacheVersion((v) => v + 1);
  }, []);

  const applyHashRoute = useCallback(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#view=")) {
      const id = hash.slice(6).trim();
      if (!id) {
        setSharedProfile(null);
        setSharedLoading(false);
        setView("main");
        return;
      }
      setSharedLoading(true);
      setSharedProfile(null);
      setView("records");
      fetchSharedProfile(id)
        .then((profile) => setSharedProfile(profile))
        .catch(() => setSharedProfile(null))
        .finally(() => setSharedLoading(false));
    } else if (hash === "#community") {
      setSharedProfile(null);
      setSharedLoading(false);
      setView("community");
    } else {
      setSharedProfile(null);
      setSharedLoading(false);
      setView("main");
    }
  }, []);

  // Load initial shared profile from URL hash without a second route pass.
  useEffect(() => {
    if (!initialSharedId) return;
    setSharedLoading(true);
    fetchSharedProfile(initialSharedId)
      .then((profile) => setSharedProfile(profile))
      .catch(() => setSharedProfile(null))
      .finally(() => setSharedLoading(false));
  }, [initialSharedId]);

  // Handle manual hash edits after initial render.
  useEffect(() => {
    window.addEventListener("hashchange", applyHashRoute);
    return () => window.removeEventListener("hashchange", applyHashRoute);
  }, [applyHashRoute]);

  const layoutSpring = disableViewMotion ? { layout: { duration: 0 } } : BASE_LAYOUT_SPRING;

  const swapView = useCallback((nextView: "main" | "records" | "community") => {
    setDisableViewMotion(true);
    if (nextView !== "records") setSharedProfile(null);
    setView(nextView);
    // Clear hash when navigating away from shared/community views
    if (nextView === "main" && window.location.hash) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    requestAnimationFrame(() => {
      setDisableViewMotion(false);
    });
  }, []);

  const handleToggleRecords = useCallback(() => {
    const isSharedRecordContext =
      view === "records" &&
      (sharedProfile !== null || sharedLoading || window.location.hash.startsWith("#view="));

    if (isSharedRecordContext) {
      setSharedProfile(null);
      setSharedLoading(false);
      if (window.location.hash) {
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      setView("records");
      return;
    }

    swapView(view === "records" ? "main" : "records");
  }, [swapView, view, sharedProfile, sharedLoading]);

  const handleHeroTitleClick = useCallback(() => {
    swapView("main");
  }, [swapView]);

  const handleHeroTitleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        swapView("main");
      }
    },
    [swapView],
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
              <SupportButton
                open={supportOpen}
                onOpen={() => setSupportOpen(true)}
                onClose={() => setSupportOpen(false)}
              />
              <button
                type="button"
                className={`sh-trigger-btn${view === "community" || sharedProfile || sharedLoading ? " sh-trigger-btn--active" : ""}`}
                onClick={() => swapView(view === "community" ? "main" : "community")}
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
                      active={view === "records" && !sharedProfile && !sharedLoading}
                      onClick={handleToggleRecords}
                      hasNew={hasNewRecords}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>
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
            </div>
          </div>
          {!user && (
            <p className="hero-subtitle">
              Connect your GoMining session and generate a complete all-rewards Excel report in one
              click. Your token never leaves your browser.
            </p>
          )}
        </header>

        {announcement && (
          <AnnouncementBanner
            visible={!announcementDismissed}
            message={announcement.message}
            onDismiss={() => {
              localStorage.setItem(LS_KEY_NOTICE_ANNOUNCEMENT_PREFIX + announcement.id, "1");
              setAnnouncementDismissed(true);
            }}
          />
        )}

        <AppNotice
          visible={!noticeRateLimitsDismissed}
          onDismiss={() => dismissNotice(LS_KEY_NOTICE_RATE_LIMITS, setNoticeRateLimitsDismissed)}
          icon={<WarningNoticeIcon />}
        >
          This app currently runs on free-tier services (Cloudflare, CoinGecko, FX Rates API). If a
          request fails due to rate limits, wait a moment and try again, or try again tomorrow.
        </AppNotice>

        <AppNotice
          visible={!noticeUnofficialDismissed}
          className="app-notice-unofficial"
          onDismiss={() => dismissNotice(LS_KEY_NOTICE_UNOFFICIAL, setNoticeUnofficialDismissed)}
          icon={<WarningNoticeIcon />}
        >
          This is an unofficial tool and is not affiliated with, endorsed by, or associated with the
          GoMining team.
        </AppNotice>

        <AppNotice
          visible={!user && !noticeOpenSourceDismissed}
          className="app-notice-opensource"
          onDismiss={() => dismissNotice(LS_KEY_NOTICE_OPENSOURCE, setNoticeOpenSourceDismissed)}
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
          {view === "community" && <CommunityPage onClose={() => swapView("main")} />}

          {view === "records" && (
            <>
              <AnimatePresence mode="popLayout">
                {message && !sharedProfile && !sharedLoading ? (
                  <motion.div layout transition={layoutSpring}>
                    <MessageBanner message={message} onClose={() => setMessage("")} />
                  </motion.div>
                ) : null}
              </AnimatePresence>
              <DataViewer
                onClose={() => swapView("main")}
                isFetching={sharedLoading || (loading && !sharedProfile)}
                cacheVersion={cacheVersion}
                onTabSeen={handleTabSeen}
                sharedData={sharedLoading ? {} : (sharedProfile?.sheets ?? null)}
                title={sharedProfile || sharedLoading ? "Community" : "Records"}
                banner={
                  sharedProfile ? (
                    <SharedBanner
                      profile={sharedProfile}
                      onClose={() => {
                        setSharedProfile(null);
                        swapView("main");
                      }}
                    />
                  ) : undefined
                }
                onShare={
                  user && hasCachedSheets && !sharedProfile && !sharedLoading
                    ? () => setShareModalOpen(true)
                    : undefined
                }
              />
            </>
          )}

          {view === "main" && !user ? (
            <>
              <AuthPanel onSync={handleCheckSync} />
              <AnimatePresence mode="popLayout">
                {message ? (
                  <motion.div layout transition={layoutSpring}>
                    <MessageBanner
                      key={`auth-message-${message}`}
                      message={message}
                      onClose={() => setMessage("")}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </>
          ) : view === "main" ? (
            <>
              <ErrorBoundary>
                <motion.section className="panel-glass" layout transition={layoutSpring}>
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
                      <button className="btn-danger btn-danger-small" onClick={handleClearCache}>
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
                  transition={layoutSpring}
                >
                  <div className="export-meta-row">
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
                    <p className="export-limit-notice">Max 1 export per day.</p>
                  </div>
                  <div className="export-btn-wrapper">
                    <button
                      className="btn-primary btn-primary-large"
                      disabled={loading || selectedKeys.length === 0}
                      onClick={handleExport}
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
                    <motion.div layout transition={layoutSpring}>
                      <MessageBanner
                        key={`main-message-${message}`}
                        message={message}
                        onClose={() => setMessage("")}
                      />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </ErrorBoundary>
            </>
          ) : null}

          <motion.p className="copyright" layout transition={layoutSpring}>
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
