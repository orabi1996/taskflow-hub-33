import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type RememberDuration = "session" | "1d" | "7d" | "30d" | "90d";

const AUTH_COOKIE = "app-auth-session-v1";
const EMAIL_COOKIE = "app-auth-email-v1";
const INTENT_COOKIE = "app-auth-remember-intent-v1";
const LEGACY_EMAIL_KEY = "auth-remember-email";

const DURATION_SECONDS: Record<Exclude<RememberDuration, "session">, number> = {
  "1d": 24 * 60 * 60,
  "7d": 7 * 24 * 60 * 60,
  "30d": 30 * 24 * 60 * 60,
  "90d": 90 * 24 * 60 * 60,
};

type CookiePayload = {
  access_token: string;
  refresh_token: string;
  duration: RememberDuration;
  remember_until?: number;
  email?: string | null;
};

const canUseDocument = () => typeof document !== "undefined";

function cookieSuffix(maxAgeSeconds?: number) {
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  const age = typeof maxAgeSeconds === "number" ? `; Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}` : "";
  return `; Path=/; SameSite=Lax${secure}${age}`;
}

function setCookie(name: string, value: string, maxAgeSeconds?: number) {
  if (!canUseDocument()) return;
  document.cookie = `${name}=${encodeURIComponent(value)}${cookieSuffix(maxAgeSeconds)}`;
}

function getCookie(name: string) {
  if (!canUseDocument()) return null;
  const prefix = `${name}=`;
  const part = document.cookie.split("; ").find((item) => item.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : null;
}

function deleteCookie(name: string) {
  setCookie(name, "", 0);
}

function encodePayload(payload: CookiePayload) {
  return btoa(JSON.stringify(payload));
}

function decodePayload(value: string | null): CookiePayload | null {
  if (!value) return null;
  try {
    return JSON.parse(atob(value)) as CookiePayload;
  } catch {
    return null;
  }
}

function secondsForDuration(duration: RememberDuration) {
  return duration === "session" ? undefined : DURATION_SECONDS[duration];
}

function rememberUntil(duration: RememberDuration) {
  const seconds = secondsForDuration(duration);
  return seconds ? Date.now() + seconds * 1000 : undefined;
}

export function purgeSupabaseAuthLocalStorage() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LEGACY_EMAIL_KEY);
  } catch {
    // localStorage can be blocked by browser privacy settings.
  }
}

export function saveRememberIntent(duration: RememberDuration) {
  setCookie(INTENT_COOKIE, duration, 10 * 60);
}

export function getRememberedEmail() {
  const email = getCookie(EMAIL_COOKIE);
  if (email) return email;
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(LEGACY_EMAIL_KEY) ?? "" : "";
  } catch {
    return "";
  }
}

export function persistAuthSession(session: Session, duration: RememberDuration, email?: string | null) {
  const maxAge = secondsForDuration(duration);
  const payload: CookiePayload = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    duration,
    remember_until: rememberUntil(duration),
    email: email ?? session.user.email ?? null,
  };

  setCookie(AUTH_COOKIE, encodePayload(payload), maxAge);
  if (payload.email) setCookie(EMAIL_COOKIE, payload.email, maxAge);
  deleteCookie(INTENT_COOKIE);
  purgeSupabaseAuthLocalStorage();
}

export function refreshStoredAuthSession(session: Session) {
  const existing = decodePayload(getCookie(AUTH_COOKIE));
  const intent = getCookie(INTENT_COOKIE) as RememberDuration | null;
  const duration = existing?.duration ?? intent ?? null;
  if (!duration) return;

  const remainingSeconds = existing?.remember_until
    ? Math.max(0, Math.floor((existing.remember_until - Date.now()) / 1000))
    : secondsForDuration(duration);

  if (remainingSeconds === 0) {
    clearAuthSessionCookies();
    return;
  }

  const maxAge = duration === "session" ? undefined : remainingSeconds;
  setCookie(AUTH_COOKIE, encodePayload({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    duration,
    remember_until: existing?.remember_until ?? rememberUntil(duration),
    email: existing?.email ?? session.user.email ?? null,
  }), maxAge);
  if (existing?.email ?? session.user.email) setCookie(EMAIL_COOKIE, existing?.email ?? session.user.email ?? "", maxAge);
  deleteCookie(INTENT_COOKIE);
  purgeSupabaseAuthLocalStorage();
}

export function clearAuthSessionCookies() {
  deleteCookie(AUTH_COOKIE);
  deleteCookie(INTENT_COOKIE);
  deleteCookie(EMAIL_COOKIE);
  purgeSupabaseAuthLocalStorage();
}

export async function ensureAuthSessionFromCookies() {
  if (typeof window === "undefined") return null;
  const existing = await supabase.auth.getSession();
  if (existing.data.session) return existing.data.session;

  const payload = decodePayload(getCookie(AUTH_COOKIE));
  if (!payload?.access_token || !payload.refresh_token) return null;
  if (payload.remember_until && payload.remember_until <= Date.now()) {
    clearAuthSessionCookies();
    return null;
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  });
  if (error || !data.session) {
    clearAuthSessionCookies();
    return null;
  }
  refreshStoredAuthSession(data.session);
  return data.session;
}