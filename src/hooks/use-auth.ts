import { useCallback, useEffect, useState } from "react";
import { decodeJwt } from "@/core/http";
import type { AuthUser } from "@/core/types";

const EXTENSION_SYNC_HASH_KEY = "gm_sync_token";
const EXTENSION_SYNC_ALIAS_HASH_KEY = "gm_sync_alias";
const EXTENSION_SYNC_ALIAS_STORE_KEY = "gm_sync_alias";
const EXTENSION_SYNC_TOKEN_STORE_KEY = "gm_sync_token_stored";

function getSyncPayloadFromHash(): { token: string | null; alias: string | null } {
  const rawHash = window.location.hash || "";
  if (!rawHash.startsWith("#")) return { token: null, alias: null };
  const params = new URLSearchParams(rawHash.slice(1));
  const token = params.get(EXTENSION_SYNC_HASH_KEY);
  const alias = params.get(EXTENSION_SYNC_ALIAS_HASH_KEY);
  return {
    token: token && token.trim() ? token : null,
    alias: alias && alias.trim() ? alias.trim() : null,
  };
}

function clearSyncHash(): void {
  if (!window.location.hash) return;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}

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
  const [syncedAlias, setSyncedAlias] = useState<string>(() =>
    (localStorage.getItem(EXTENSION_SYNC_ALIAS_STORE_KEY) || "").trim(),
  );

  useEffect(() => {
    const { token: syncToken, alias } = getSyncPayloadFromHash();
    if (alias) {
      setSyncedAlias(alias);
      localStorage.setItem(EXTENSION_SYNC_ALIAS_STORE_KEY, alias);
    }
    if (syncToken) {
      const userData = loginWithToken(syncToken);
      if (userData) {
        if (alias) userData.alias = alias;
        localStorage.setItem(EXTENSION_SYNC_TOKEN_STORE_KEY, syncToken);
        setStoredToken(syncToken);
        setUser(userData);
        onMessage("Synced successfully. Welcome!");
      } else {
        onMessage("Extension token is invalid or expired.");
      }
      clearSyncHash();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleStorage = (e: StorageEvent): void => {
      if (e.key !== EXTENSION_SYNC_TOKEN_STORE_KEY || !e.newValue) return;
      const userData = loginWithToken(e.newValue);
      if (!userData) return;
      const storedAlias = localStorage.getItem(EXTENSION_SYNC_ALIAS_STORE_KEY)?.trim() ?? null;
      if (storedAlias) userData.alias = storedAlias;
      setStoredToken(e.newValue);
      setUser(userData);
      onMessage("Session refreshed from extension.");
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user) return;
    const interval = setInterval(() => {
      const token = localStorage.getItem(EXTENSION_SYNC_TOKEN_STORE_KEY);
      if (!token) return;
      const userData = loginWithToken(token);
      if (!userData) return;
      const storedAlias = localStorage.getItem(EXTENSION_SYNC_ALIAS_STORE_KEY)?.trim() ?? null;
      if (storedAlias) userData.alias = storedAlias;
      setStoredToken(token);
      setUser(userData);
      onMessage("Session synced from extension.");
    }, 1000);
    return () => clearInterval(interval);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCheckSync = useCallback((): void => {
    const { token: hashToken, alias } = getSyncPayloadFromHash();
    const syncToken = hashToken ?? localStorage.getItem(EXTENSION_SYNC_TOKEN_STORE_KEY);

    if (alias) {
      setSyncedAlias(alias);
      localStorage.setItem(EXTENSION_SYNC_ALIAS_STORE_KEY, alias);
    }

    if (syncToken) {
      const userData = loginWithToken(syncToken);
      if (userData) {
        const storedAlias =
          alias ?? localStorage.getItem(EXTENSION_SYNC_ALIAS_STORE_KEY)?.trim() ?? null;
        if (storedAlias) userData.alias = storedAlias;
        localStorage.setItem(EXTENSION_SYNC_TOKEN_STORE_KEY, syncToken);
        setStoredToken(syncToken);
        setUser(userData);
        onMessage("Synced successfully. Welcome!");
      } else {
        onMessage("Extension token is invalid or expired.");
      }
      if (hashToken) clearSyncHash();
    } else {
      onMessage("No token found. Please sync via the GoMining extension first.");
    }
  }, [onMessage]);

  const handleLogout = useCallback((): void => {
    localStorage.removeItem(EXTENSION_SYNC_TOKEN_STORE_KEY);
    setUser(null);
    setStoredToken("");
    onMessage("Logged out.");
  }, [onMessage]);

  return { storedToken, user, syncedAlias, handleCheckSync, handleLogout };
}
