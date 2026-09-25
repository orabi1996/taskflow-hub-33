import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  saveServerSession,
  clearServerSession,
  getStoredServerSession,
  type RememberDuration,
  EMAIL_COOKIE,
  INTENT_COOKIE,
} from "./auth-session.server";

export type { RememberDuration };

const LEGACY_AUTH_COOKIE = "app-auth-session-v1";
const LEGACY_EMAIL_KEY = "auth-remember-email";

const canUseDocument = () => typeof document !== "undefined";

function getCookie(name: string): string | null {
  if (!canUseDocument()) return null;
  const prefix = `${name}=`;
  const part = document.cookie.split("; ").find((item) => item.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : null;
}

function deleteClientCookie(name: string) {
  if (!canUseDocument()) return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function setClientCookie(name: string, value: string, maxAgeSeconds?: number) {
  if (!canUseDocument()) return;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  const age = typeof maxAgeSeconds === "number" ? `; Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}` : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax${secure}${age}`;
}

/**
 * Purges legacy JavaScript-accessible token storage to ensure tokens are never read from document.cookie or localStorage.
 */
export function purgeLegacyAuthStorage() {
  if (!canUseDocument()) return;
  deleteClientCookie(LEGACY_AUTH_COOKIE);
  try {
    localStorage.removeItem(LEGACY_EMAIL_KEY);
    // Also remove any direct supabase token caches from localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes("supabase.auth.token") || key.includes("app-auth"))) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore localStorage privacy blocks
  }
}

export function purgeSupabaseAuthLocalStorage() {
  purgeLegacyAuthStorage();
}

export function saveRememberIntent(duration: RememberDuration) {
  setClientCookie(INTENT_COOKIE, duration, 10 * 60);
}

export function getRememberedEmail(): string {
  const email = getCookie(EMAIL_COOKIE);
  if (email) return email;
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(LEGACY_EMAIL_KEY) ?? "" : "";
  } catch {
    return "";
  }
}

/**
 * Securely persists the auth session via an HttpOnly, Secure server cookie.
 * No access or refresh tokens are written to document.cookie.
 */
export async function persistAuthSession(
  session: Session,
  duration: RememberDuration,
  email?: string | null
): Promise<void> {
  purgeLegacyAuthStorage();
  deleteClientCookie(INTENT_COOKIE);

  try {
    await saveServerSession({
      data: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        duration,
        email: email ?? session.user.email ?? null,
      },
    });
  } catch (err) {
    console.error("[persistAuthSession] Failed to set HttpOnly session cookie:", err);
  }
}

/**
 * Keeps the server-managed HttpOnly cookie updated when the client session is refreshed.
 */
export async function refreshStoredAuthSession(session: Session): Promise<void> {
  purgeLegacyAuthStorage();
  const intent = (getCookie(INTENT_COOKIE) as RememberDuration | null) ?? "session";

  try {
    await saveServerSession({
      data: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        duration: intent,
        email: session.user.email ?? null,
      },
    });
  } catch (err) {
    console.error("[refreshStoredAuthSession] Failed to update HttpOnly session cookie:", err);
  }
}

/**
 * Clears the session on the server (deleting the HttpOnly cookie) and client.
 */
export async function clearAuthSessionCookies(): Promise<void> {
  purgeLegacyAuthStorage();
  deleteClientCookie(INTENT_COOKIE);
  deleteClientCookie(EMAIL_COOKIE);

  try {
    await clearServerSession();
  } catch (err) {
    console.error("[clearAuthSessionCookies] Failed to clear server session:", err);
  }
}

/**
 * Restores or verifies an authenticated session.
 * Reads the HttpOnly cookie via the server function and initializes the in-memory Supabase client session.
 */
export async function ensureAuthSessionFromCookies(): Promise<Session | null> {
  if (typeof window === "undefined") return null;

  // 1. Check in-memory / active client session
  const inMemory = await supabase.auth.getSession();
  if (inMemory.data.session) {
    return inMemory.data.session;
  }

  // 2. Fetch tokens from the secure HttpOnly server cookie
  try {
    const res = await getStoredServerSession();
    if (!res.session?.access_token || !res.session?.refresh_token) {
      return null;
    }

    const { data, error } = await supabase.auth.setSession({
      access_token: res.session.access_token,
      refresh_token: res.session.refresh_token,
    });

    if (error || !data.session) {
      await clearAuthSessionCookies();
      return null;
    }

    return data.session;
  } catch (err) {
    console.error("[ensureAuthSessionFromCookies] Error restoring server session:", err);
    return null;
  }
}