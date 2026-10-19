import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as Sentry from "@sentry/react";
import { decodeJwt } from "@/lib/http";
import { LOCAL_STORAGE_KEY_SYNC_ALIAS, LOCAL_STORAGE_KEY_SYNC_TOKEN } from "@/lib/storage-keys";
import type { AuthUser } from "../types";

/**
 * Decodes the JWT client-side into a user (alias falls back through username, name, email, id);
 * null if invalid or expired.
 */
function loginWithToken(token: string): AuthUser | null {
  const decoded = decodeJwt(token);
  if (!decoded || typeof decoded !== "object") return null;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (decoded.exp && nowSeconds >= decoded.exp) return null;

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
  handleManualTokenSync: (token: string) => void;
  handleLogout: () => void;
}

function getCachedToken(): string {
  return sessionStorage.getItem(LOCAL_STORAGE_KEY_SYNC_TOKEN) || "";
}

/**
 * Holds the sync token from session storage, manual entry, or the extension (polled every second while logged out).
 * Auto-logs out shortly before the token expires and when the API reports an expired session.
 */
export function useAuth(onMessage: (message: string) => void): UseAuthReturn {
  const { t } = useTranslation();
  const [storedToken, setStoredToken] = useState<string>("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [syncedAlias] = useState<string>(() =>
    (localStorage.getItem(LOCAL_STORAGE_KEY_SYNC_ALIAS) || "").trim(),
  );
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearExpiryTimer = useCallback(() => {
    if (expiryTimer.current) {
      clearTimeout(expiryTimer.current);
      expiryTimer.current = null;
    }
  }, []);

  const performLogout = useCallback(
    (message: string) => {
      clearExpiryTimer();
      sessionStorage.removeItem(LOCAL_STORAGE_KEY_SYNC_TOKEN);
      setUser(null);
      setStoredToken("");
      onMessage(message);
    },
    [clearExpiryTimer, onMessage],
  );

  /** Schedules logout 30s before the JWT expires to avoid an auth failure mid-export. */
  const scheduleExpiry = useCallback(
    (expiresAtSeconds: number | null) => {
      clearExpiryTimer();
      if (!expiresAtSeconds) return;
      const millisecondsUntilExpiry = expiresAtSeconds * 1000 - Date.now() - 30_000;
      if (millisecondsUntilExpiry <= 0) return;
      expiryTimer.current = setTimeout(
        () => performLogout(t("auth.sessionExpired")),
        millisecondsUntilExpiry,
      );
    },
    [clearExpiryTimer, performLogout, t],
  );

  const applyToken = useCallback(
    (token: string, message?: string): boolean => {
      const userData = loginWithToken(token);
      if (!userData) return false;
      const storedAlias = localStorage.getItem(LOCAL_STORAGE_KEY_SYNC_ALIAS)?.trim() ?? null;
      if (storedAlias) userData.alias = storedAlias;
      sessionStorage.setItem(LOCAL_STORAGE_KEY_SYNC_TOKEN, token);
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
    const handleStorage = (event: StorageEvent): void => {
      if (event.key !== LOCAL_STORAGE_KEY_SYNC_TOKEN || !event.newValue) return;
      applyToken(event.newValue, t("auth.sessionRefreshed"));
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [applyToken, t]);

  useEffect(() => {
    const handleApiExpiry = () => performLogout(t("auth.sessionExpired"));
    window.addEventListener("rt:session-expired", handleApiExpiry);
    return () => window.removeEventListener("rt:session-expired", handleApiExpiry);
  }, [performLogout, t]);

  useEffect(() => {
    if (user) return;
    const interval = setInterval(() => {
      const token = getCachedToken();
      if (token) applyToken(token, t("auth.sessionSynced"));
    }, 1000);
    return () => clearInterval(interval);
  }, [user, applyToken, t]);

  const handleManualTokenSync = useCallback(
    (token: string): void => {
      const normalized = token.trim();
      if (!normalized) {
        onMessage(t("auth.noToken"));
        return;
      }

      const success = applyToken(normalized);
      if (success) {
        Sentry.logger.info("User synced via manual token input");
        onMessage(t("auth.syncedSuccessfully"));
      } else {
        Sentry.logger.warn("Manual token invalid or expired");
        onMessage(t("auth.tokenInvalid"));
      }
    },
    [applyToken, onMessage, t],
  );

  const handleLogout = useCallback((): void => {
    Sentry.logger.info("User logged out");
    performLogout(t("auth.loggedOut"));
  }, [performLogout, t]);

  return { storedToken, user, syncedAlias, handleManualTokenSync, handleLogout };
}
