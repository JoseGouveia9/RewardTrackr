import { memo, useEffect, useRef, useState } from "react";
import type { AuthUser } from "../types";
import "./header-user-menu.css";

interface HeaderUserMenuProps {
  user: AuthUser;
  displayAlias: string;
  theme: string;
  onToggleTheme: () => void;
  onLogout: () => void;
}

export const HeaderUserMenu = memo(function HeaderUserMenu({
  user,
  displayAlias,
  theme,
  onToggleTheme,
  onLogout,
}: HeaderUserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  return (
    <div className="user-menu-wrapper" ref={ref}>
      <button
        type="button"
        className="user-menu-button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="user-menu-avatar" aria-hidden="true">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        </span>
        <span className="user-menu-alias">{displayAlias}</span>
        <span className="user-menu-chevron" aria-hidden="true">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {open ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
          </svg>
        </span>
      </button>

      {open && (
        <div className="user-menu-dropdown" role="menu">
          <div className="user-menu-info-row">
            <span className="user-menu-info-icon" aria-hidden="true">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="4" x2="20" y1="9" y2="9" />
                <line x1="4" x2="20" y1="15" y2="15" />
                <line x1="10" x2="8" y1="3" y2="21" />
                <line x1="16" x2="14" y1="3" y2="21" />
              </svg>
            </span>
            <span className="user-menu-info-label">User ID:</span>
            <span className="user-menu-info-value">{user.id || "n/a"}</span>
          </div>
          <div className="user-menu-info-row">
            <span className="user-menu-info-icon" aria-hidden="true">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </span>
            <span className="user-menu-info-label">Email:</span>
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
              {theme === "dark" ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </span>
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>

          <button
            type="button"
            className="user-menu-action user-menu-logout"
            style={{ marginTop: "16px" }}
            role="menuitem"
            onClick={() => {
              onLogout();
              setOpen(false);
            }}
          >
            <span className="user-menu-action-icon" aria-hidden="true">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </span>
            Logout
          </button>
        </div>
      )}
    </div>
  );
});
