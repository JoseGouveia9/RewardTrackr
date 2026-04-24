import { useCallback, useEffect, useRef, useState } from "react";
import * as Sentry from "@sentry/react";
import { decodeJwt } from "@/lib/http";
import { LS_KEY_SYNC_ALIAS, LS_KEY_SYNC_TOKEN } from "@/lib/storage-keys";
import type { AuthUser } from "../types";

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

function getCachedToken(): string {
  return sessionStorage.getItem(LS_KEY_SYNC_TOKEN) || "";
}

export function useAuth(onMessage: (msg: string) => void): UseAuthReturn {
  const [storedToken, setStoredToken] = useState<string>("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [syncedAlias] = useState<string>(() =>
    (localStorage.getItem(LS_KEY_SYNC_ALIAS) || "").trim(),
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
      // Log out 30s before actual expiry to avoid a mid-export auth failure
      const msUntilExpiry = exp * 1000 - Date.now() - 30_000;
      if (msUntilExpiry <= 0) return;
      expiryTimer.current = setTimeout(() => {
        sessionStorage.removeItem(LS_KEY_SYNC_TOKEN);
        setUser(null);
        setStoredToken("");
        onMessage("Session expired. Please sync again via the extension.");
      }, msUntilExpiry);
    },
    [clearExpiryTimer, onMessage],
  );

  const applyToken = useCallback(
    (token: string, message?: string): boolean => {
      const userData = loginWithToken(token);
      if (!userData) return false;
      const storedAlias = localStorage.getItem(LS_KEY_SYNC_ALIAS)?.trim() ?? null;
      if (storedAlias) userData.alias = storedAlias;
      sessionStorage.setItem(LS_KEY_SYNC_TOKEN, token);
      setStoredToken(token);
      setUser(userData);
      scheduleExpiry(userData.exp ?? null);
      if (message) onMessage(message);
      return true;
    },
    [scheduleExpiry, onMessage],
  );

  useEffect(() => {
    const token = getCachedToken();
    if (token) applyToken(token);
    return clearExpiryTimer;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleStorage = (e: StorageEvent): void => {
      if (e.key !== LS_KEY_SYNC_TOKEN || !e.newValue) return;
      applyToken(e.newValue, "Session refreshed from extension.");
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [applyToken]);

  // Polls sessionStorage for a token written by the browser extension (cross-context write)
  useEffect(() => {
    if (user) return;
    const interval = setInterval(() => {
      const token = getCachedToken();
      if (token) applyToken(token, "Session synced from extension.");
    }, 1000);
    return () => clearInterval(interval);
  }, [user, applyToken]);

  const handleCheckSync = useCallback((): void => {
    const syncToken = getCachedToken();
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
    sessionStorage.removeItem(LS_KEY_SYNC_TOKEN);
    setUser(null);
    setStoredToken("");
    Sentry.logger.info("User logged out");
    onMessage("Logged out.");
  }, [clearExpiryTimer, onMessage]);

  return { storedToken, user, syncedAlias, handleCheckSync, handleLogout };
}
