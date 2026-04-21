"use client";

/* ------------------------------------------------------------------ */
/*  Lightweight client-side session store                             */
/*  Uses React context + sessionStorage for role persistence.         */
/* ------------------------------------------------------------------ */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { User, UserRole } from "@/types";
import { isStaffRole } from "@/types";

const SESSION_KEY = "hkust_exam_session";
const SESSION_EVENT = "hkust_exam_session_change";
const SERVER_SNAPSHOT: User | null = null;

let cachedSessionRaw: string | null | undefined;
let cachedSessionUser: User | null = null;
let cachedAccessToken: string | null = null;

interface StoredSession {
  user: User;
  accessToken: string | null;
}

interface SessionState {
  user: User | null;
  isAuthenticated: boolean;
}

interface SessionActions {
  login: (user: User, accessToken?: string | null) => void;
  logout: () => void;
}

type SessionContextValue = SessionState & SessionActions;

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

function loadSession(): User | null {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw === cachedSessionRaw) {
      return cachedSessionUser;
    }

    cachedSessionRaw = raw;
    if (!raw) {
      cachedSessionUser = null;
      cachedAccessToken = null;
      return null;
    }

    const parsed = JSON.parse(raw) as User | StoredSession;
    if ("user" in parsed) {
      cachedSessionUser = parsed.user;
      cachedAccessToken = parsed.accessToken ?? null;
    } else {
      cachedSessionUser = parsed;
      cachedAccessToken = null;
    }
    return cachedSessionUser;
  } catch {
    cachedSessionRaw = null;
    cachedSessionUser = null;
    cachedAccessToken = null;
    return null;
  }
}

function saveSession(user: User | null, accessToken?: string | null): void {
  if (typeof window === "undefined") return;
  if (user) {
    const raw = JSON.stringify({
      user,
      accessToken: accessToken ?? null,
    } satisfies StoredSession);
    sessionStorage.setItem(SESSION_KEY, raw);
    cachedSessionRaw = raw;
    cachedSessionUser = user;
    cachedAccessToken = accessToken ?? null;
  } else {
    sessionStorage.removeItem(SESSION_KEY);
    cachedSessionRaw = null;
    cachedSessionUser = null;
    cachedAccessToken = null;
  }
  window.dispatchEvent(new Event(SESSION_EVENT));
}

function subscribeToSession(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = () => callback();
  window.addEventListener("storage", handler);
  window.addEventListener(SESSION_EVENT, handler);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(SESSION_EVENT, handler);
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const user = useSyncExternalStore(subscribeToSession, loadSession, () => SERVER_SNAPSHOT);

  const login = useCallback((u: User, accessToken?: string | null) => {
    saveSession(u, accessToken);
  }, []);

  const logout = useCallback(() => {
    saveSession(null);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      login,
      logout,
    }),
    [user, login, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within <SessionProvider>");
  return ctx;
}

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  if (cachedSessionRaw === undefined) {
    loadSession();
  }
  return cachedAccessToken;
}

/**
 * Return the opposite demo role for the floating role-switch button.
 */
export function oppositeRole(role: UserRole): UserRole {
  if (role === "student") return "instructor";
  return "student";
}

/**
 * Return the dashboard path for a given role.
 */
export function dashboardPath(role: UserRole): string {
  if (role === "administrator") return "/admin";
  if (isStaffRole(role)) return "/staff";
  return "/student";
}
