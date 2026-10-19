import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { HeaderUserMenu, type AuthUser } from "@/features/auth";
import { DataViewerButton } from "@/features/records";
import { SupportButton } from "@/components/support-button/support-button";
import { ReferralButton } from "@/components/referral-button/referral-button";
import { HeroTitle } from "./components/hero-title/hero-title";
import { GlobeIcon, UsersIcon } from "@/components/icons";

interface AppHeaderProps {
  user: AuthUser | null;
  displayAlias: string;
  theme: "light" | "dark";
  hasCachedSheets: boolean;
  hasNewRecords: boolean;
  homePath: string;
  onToggleTheme: () => void;
  onLogout: () => void;
  onOpenLanguage: () => void;
}

export function AppHeader({
  user,
  displayAlias,
  theme,
  hasCachedSheets,
  hasNewRecords,
  homePath,
  onToggleTheme,
  onLogout,
  onOpenLanguage,
}: AppHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [referralOpen, setReferralOpen] = useState(false);

  const isRecords = pathname === "/records";
  const isCommunity = pathname === "/community" || pathname.startsWith("/view/");

  return (
    <header className="hero">
      <div className="hero-top">
        <HeroTitle
          signedIn={!!user}
          displayAlias={displayAlias}
          dark={theme === "dark"}
          homePath={homePath}
        />
        {!user && pathname === "/" && <p className="hero-subtitle">{t("app.heroSubtitle")}</p>}
        <div className="hero-actions">
          <SupportButton />
          {!user && (
            <button
              type="button"
              className="community-button language-button"
              onClick={onOpenLanguage}
              aria-label={t("language.selectLanguage")}
            >
              <GlobeIcon />
            </button>
          )}
          <button
            type="button"
            className={`community-button${isCommunity ? " community-button--active" : ""}`}
            onClick={() => void navigate(isCommunity ? homePath : "/community")}
            aria-label={t("app.community")}
          >
            <UsersIcon />
            <span>{t("app.community")}</span>
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
                  onClick={() => void navigate(isRecords ? "/build" : "/records")}
                  hasNew={hasNewRecords}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
          <motion.div
            layout
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`hero-profile-wrapper${hasCachedSheets ? " hero-profile-wrapper--narrow" : ""}`}
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
                onToggleTheme={onToggleTheme}
                onLogout={onLogout}
                onOpenLanguage={onOpenLanguage}
              />
            )}
          </motion.div>
        </div>
      </div>
    </header>
  );
}
