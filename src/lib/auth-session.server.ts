import { createServerFn } from "@tanstack/react-start";
import { setCookie, deleteCookie, getCookie, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { signPayload, verifyAndUnsealPayload } from "./server-security";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type RememberDuration = "session" | "1d" | "7d" | "30d" | "90d";

export const AUTH_COOKIE = "app-auth-session-v1";
export const EMAIL_COOKIE = "app-auth-email-v1";
export const INTENT_COOKIE = "app-auth-remember-intent-v1";

const DURATION_SECONDS: Record<Exclude<RememberDuration, "session">, number> = {
  "1d": 24 * 60 * 60,
  "7d": 7 * 24 * 60 * 60,
  "30d": 30 * 24 * 60 * 60,
  "90d": 90 * 24 * 60 * 60,
};

export function secondsForDuration(duration: RememberDuration): number | undefined {
  return duration === "session" ? undefined : DURATION_SECONDS[duration];
}

interface StoredSessionPayload {
  access_token: string;
  refresh_token: string;
  duration: RememberDuration;
  expires_at?: number;
  email?: string | null;
}

const saveSessionSchema = z.object({
  access_token: z.string().min(10),
  refresh_token: z.string().min(10),
  duration: z.enum(["session", "1d", "7d", "30d", "90d"]),
  email: z.string().email().optional().nullable(),
});

function isRequestSecure(): boolean {
  const forwardedProto = getRequestHeader("x-forwarded-proto");
  if (forwardedProto && forwardedProto.includes("https")) return true;
  return process.env.NODE_ENV === "production";
}

/**
 * Server function to securely persist session tokens in an HttpOnly, Secure cookie.
 * JavaScript in the browser CANNOT read this cookie, mitigating token theft via XSS.
 */
export const saveServerSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => saveSessionSchema.parse(input))
  .handler(async ({ data }) => {
    const maxAge = secondsForDuration(data.duration);
    const expires_at = maxAge ? Date.now() + maxAge * 1000 : undefined;

    const payload: StoredSessionPayload = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      duration: data.duration,
      expires_at,
      email: data.email ?? null,
    };

    const sealedToken = signPayload(JSON.stringify(payload));
    const secure = isRequestSecure();

    setCookie(AUTH_COOKIE, sealedToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    if (data.email) {
      setCookie(EMAIL_COOKIE, data.email, {
        httpOnly: false, // Email is non-sensitive and used to prefill the login input
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: maxAge ?? 30 * 24 * 60 * 60,
      });
    }

    return { ok: true };
  });

/**
 * Server function to clear the HttpOnly auth session cookie on logout.
 */
export const clearServerSession = createServerFn({ method: "POST" }).handler(async () => {
  const secure = isRequestSecure();

  deleteCookie(AUTH_COOKIE, {
    path: "/",
    httpOnly: true,
    secure,
    sameSite: "lax",
  });

  return { ok: true };
});

export const getPublicSupabaseConfig = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? null;
  const supabaseAnonKey =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["SUPABASE_ANON_KEY"] ??
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["VITE_SUPABASE_ANON_KEY"] ??
    null;

  return {
    supabaseUrl,
    supabaseAnonKey,
  };
});

/**
 * Server function to retrieve session tokens from the HttpOnly cookie.
 * Called during bootstrap / route loading to initialize or restore in-memory Supabase client session.
 */
export const getStoredServerSession = createServerFn({ method: "POST" }).handler(
  async (): Promise<{
    session: { access_token: string; refresh_token: string } | null;
    duration: RememberDuration | null;
    email: string | null;
    publicConfig: { supabaseUrl: string; supabaseAnonKey: string } | null;
    roles?: readonly string[];
  }> => {
    const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? null;
    const supabaseAnonKey =
      process.env["SUPABASE_PUBLISHABLE_KEY"] ??
      process.env["SUPABASE_ANON_KEY"] ??
      process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
      process.env["VITE_SUPABASE_ANON_KEY"] ??
      null;

    const publicConfig =
      supabaseUrl && supabaseAnonKey
        ? {
            supabaseUrl,
            supabaseAnonKey,
          }
        : null;

    const rawCookie = getCookie(AUTH_COOKIE);
    if (!rawCookie) {
      return { session: null, duration: null, email: null, publicConfig };
    }

    const unsealed = verifyAndUnsealPayload(rawCookie);
    if (!unsealed) {
      deleteCookie(AUTH_COOKIE, { path: "/" });
      return { session: null, duration: null, email: null, publicConfig };
    }

    try {
      const payload = JSON.parse(unsealed) as StoredSessionPayload;
      if (!payload.access_token || !payload.refresh_token) {
        deleteCookie(AUTH_COOKIE, { path: "/" });
        return { session: null, duration: null, email: null, publicConfig };
      }

      if (payload.expires_at && payload.expires_at <= Date.now()) {
        deleteCookie(AUTH_COOKIE, { path: "/" });
        return { session: null, duration: null, email: null, publicConfig };
      }

      const SUPER_ADMIN_EMAILS = [
        "ctraining801@gmail.com",
        (process.env.ADMIN_SEED_EMAIL ?? "").toLowerCase().trim(),
      ].filter(Boolean);
      const isSuperAdmin = payload.email ? SUPER_ADMIN_EMAILS.includes(payload.email.toLowerCase().trim()) : false;

      if (isSuperAdmin && payload.email) {
        void (async () => {
          try {
            const { data: userProfile } = await supabaseAdmin
              .from("profiles")
              .select("id")
              .eq("email", payload.email!.toLowerCase().trim())
              .maybeSingle();

            const uid = userProfile?.id;
            if (uid) {
              const { data: existingRoles } = await supabaseAdmin
                .from("user_roles")
                .select("role")
                .eq("user_id", uid);

              const current = new Set((existingRoles ?? []).map((r) => r.role));
              for (const r of ["admin", "general_manager", "manager"]) {
                if (!current.has(r as any)) {
                  await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: r as any });
                }
              }
            }
          } catch {
            // non-fatal background sync
          }
        })();
      }

      return {
        session: {
          access_token: payload.access_token,
          refresh_token: payload.refresh_token,
        },
        duration: payload.duration,
        email: payload.email ?? null,
        publicConfig,
        roles: isSuperAdmin ? (["admin", "general_manager", "manager"] as const) : undefined,
      };
    } catch {
      deleteCookie(AUTH_COOKIE, { path: "/" });
      return { session: null, duration: null, email: null, publicConfig };
    }
  }
);

