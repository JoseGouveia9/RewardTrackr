import { memo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useOutsideClick } from "@/hooks/use-outside-click";
import type { AuthUser } from "../../types";
import "./header-user-menu.css";
import {
  ChevronIcon,
  GlobeIcon,
  HashIcon,
  LogOutIcon,
  MailIcon,
  MoonIcon,
  SunIcon,
  UserIcon,
} from "@/components/icons";

const dropdownMotion = {
  initial: { opacity: 0, y: -10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.14, ease: "easeOut" as const, delay: 0.05 },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.08, ease: "easeIn" as const },
  },
};

interface HeaderUserMenuProps {
  user: AuthUser;
  displayAlias: string;
  theme: string;
  onToggleTheme: () => void;
  onLogout: () => void;
  onOpenLanguage: () => void;
}

export const HeaderUserMenu = memo(function HeaderUserMenu({
  user,
  displayAlias,
  theme,
  onToggleTheme,
  onLogout,
  onOpenLanguage,
}: HeaderUserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useOutsideClick(ref, () => setOpen(false), open);

  return (
    <div className="user-menu-wrapper" ref={ref}>
      <button
        type="button"
        className="user-menu-button"
        onClick={() => setOpen((isOpen) => !isOpen)}
        aria-expanded={open}
      >
        <span className="user-menu-avatar" aria-hidden="true">
          <UserIcon />
        </span>
        <span className="user-menu-alias">{displayAlias}</span>
        <span className="user-menu-chevron" aria-hidden="true">
          <ChevronIcon direction={open ? "up" : "down"} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="user-menu-dropdown"
            role="menu"
            initial={dropdownMotion.initial}
            animate={dropdownMotion.animate}
            exit={dropdownMotion.exit}
          >
            <div className="user-menu-info-row">
              <span className="user-menu-info-icon" aria-hidden="true">
                <HashIcon />
              </span>
              <span className="user-menu-info-label">{t("auth.userId")}</span>
              <span className="user-menu-info-value">{user.id || "n/a"}</span>
            </div>
            <div className="user-menu-info-row">
              <span className="user-menu-info-icon" aria-hidden="true">
                <MailIcon />
              </span>
              <span className="user-menu-info-label">{t("auth.email")}</span>
              <span className="user-menu-info-value">{user.email || "n/a"}</span>
            </div>

            <div className="user-menu-divider" />

            <button
              type="button"
              className="user-menu-action"
              role="menuitem"
              onClick={onToggleTheme}
            >
              <span className="user-menu-action-icon" aria-hidden="true">
                {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              </span>
              {theme === "dark" ? t("auth.lightMode") : t("auth.darkMode")}
            </button>

            <button
              type="button"
              className="user-menu-action"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onOpenLanguage();
              }}
            >
              <span className="user-menu-action-icon" aria-hidden="true">
                <GlobeIcon />
              </span>
              {t("auth.language")}
            </button>

            <button
              type="button"
              className="user-menu-action user-menu-logout"
              role="menuitem"
              onClick={() => {
                onLogout();
                setOpen(false);
              }}
            >
              <span className="user-menu-action-icon" aria-hidden="true">
                <LogOutIcon />
              </span>
              {t("auth.logout")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
