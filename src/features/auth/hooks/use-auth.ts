import { useCallback, useEffect, useRef, useState } from "react";
import * as Sentry from "@sentry/react";
import { decodeJwt } from "@/lib/http";
import type { AuthUser } from "../types";

const EXTENSION_SYNC_ALIAS_STORE_KEY = "rt_sync_alias";
const EXTENSION_SYNC_TOKEN_STORE_KEY = "rt_sync_token_stored";

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

  return {
    id: decoded.id || decoded.sub || null,
    email: decoded.email || null,
    alias,
    exp: decoded.exp || null,
  };
}

interface UseAuthReturn {
  storedToken: string;
  user: AuthUser | null;
  syncedAlias: string;
  handleCheckSync: () => void;
  handleLogout: () => void;
}

export function useAuth(onMessage: (msg: string) => void): UseAuthReturn {
  const [storedToken, setStoredToken] = useState<string>("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [syncedAlias] = useState<string>(() =>
    (localStorage.getItem(EXTENSION_SYNC_ALIAS_STORE_KEY) || "").trim(),
  );
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearExpiryTimer = useCallback(() => {
    if (expiryTimer.current) {
      clearTimeout(expiryTimer.current);
      expiryTimer.current = null;
    }
  }, []);

  const scheduleExpiry = useCallback(
    (exp: number | null) => {
      clearExpiryTimer();
      if (!exp) return;
      const msUntilExpiry = exp * 1000 - Date.now();
      if (msUntilExpiry <= 0) return;
      expiryTimer.current = setTimeout(() => {
        localStorage.removeItem(EXTENSION_SYNC_TOKEN_STORE_KEY);
        setUser(null);
        setStoredToken("");
      }, msUntilExpiry);
    },
    [clearExpiryTimer],
  );

  const applyToken = useCallback(
    (token: string, message?: string): boolean => {
      const userData = loginWithToken(token);
      if (!userData) return false;
      const storedAlias = localStorage.getItem(EXTENSION_SYNC_ALIAS_STORE_KEY)?.trim() ?? null;
      if (storedAlias) userData.alias = storedAlias;
      localStorage.setItem(EXTENSION_SYNC_TOKEN_STORE_KEY, token);
      setStoredToken(token);
      setUser(userData);
      scheduleExpiry(userData.exp ?? null);
      if (message) onMessage(message);
      return true;
    },
    [scheduleExpiry, onMessage],
  );

  // On mount: restore session from localStorage
  useEffect(() => {
    const token = localStorage.getItem(EXTENSION_SYNC_TOKEN_STORE_KEY);
    if (token) applyToken(token);
    return clearExpiryTimer;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Storage event: extension injected a new token into this tab
  useEffect(() => {
    const handleStorage = (e: StorageEvent): void => {
      if (e.key !== EXTENSION_SYNC_TOKEN_STORE_KEY || !e.newValue) return;
      applyToken(e.newValue, "Session refreshed from extension.");
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [applyToken]);

  // Poll when logged out — fallback to pick up extension re-sync
  useEffect(() => {
    if (user) return;
    const interval = setInterval(() => {
      const token = localStorage.getItem(EXTENSION_SYNC_TOKEN_STORE_KEY);
      if (token) applyToken(token, "Session synced from extension.");
    }, 1000);
    return () => clearInterval(interval);
  }, [user, applyToken]);

  const handleCheckSync = useCallback((): void => {
    const syncToken = localStorage.getItem(EXTENSION_SYNC_TOKEN_STORE_KEY);
    if (syncToken) {
      const success = applyToken(syncToken);
      if (success) {
        Sentry.logger.info("User synced via manual check");
        onMessage("Synced successfully. Welcome!");
      } else {
        Sentry.logger.warn("Extension token invalid or expired on manual check");
        onMessage("Extension token is invalid or expired.");
      }
    } else {
      onMessage("No token found. Please sync via the RewardTrackr extension first.");
    }
  }, [applyToken, onMessage]);

  const handleLogout = useCallback((): void => {
    clearExpiryTimer();
    localStorage.removeItem(EXTENSION_SYNC_TOKEN_STORE_KEY);
    setUser(null);
    setStoredToken("");
    Sentry.logger.info("User logged out");
    onMessage("Logged out.");
  }, [clearExpiryTimer, onMessage]);

  return { storedToken, user, syncedAlias, handleCheckSync, handleLogout };
}
