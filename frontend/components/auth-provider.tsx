"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type AuthUser = {
  id: number;
};

type AuthContextValue = {
  user: AuthUser | null;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const syncFromStorage = () => {
      const token = window.localStorage.getItem("booktown_token");
      if (!token) {
        setUser(null);
        return;
      }
      setUser(decodeTokenUser(token));
    };

    syncFromStorage();
    // "storage" fires when another tab mutates localStorage; "booktown-auth-changed"
    // fires for same-tab mutations (storage events don't fire in the originating tab).
    window.addEventListener("storage", syncFromStorage);
    window.addEventListener("booktown-auth-changed", syncFromStorage as EventListener);
    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener("booktown-auth-changed", syncFromStorage as EventListener);
    };
  }, []);

  async function logout() {
    window.localStorage.removeItem("booktown_token");
    setUser(null);
    window.dispatchEvent(new Event("booktown-auth-changed"));

    await fetch("/api/set-cookie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clear: true }),
    });
  }

  const value = useMemo(
    () => ({
      user,
      logout,
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Reads the user id from the JWT payload without a network round-trip.
// The token is already trusted because it was issued by our own backend.
function decodeTokenUser(token: string): AuthUser | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(parts[1])) as { sub?: string };
    const id = Number.parseInt(payload.sub ?? "", 10);
    if (!Number.isFinite(id) || id <= 0) {
      return null;
    }
    return { id };
  } catch {
    return null;
  }
}

// atob requires standard base64; JWT uses URL-safe base64 (- and _ instead of + and /).
function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}
