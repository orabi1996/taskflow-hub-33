import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { signPayload } from "./server-security";
import {
  AUTH_COOKIE,
  EMAIL_COOKIE,
  secondsForDuration,
  type RememberDuration,
} from "./auth-session.server";

const WINDOW_MIN = 15;
const MAX_FAILED = 5;

const emailSchema = z.string().trim().toLowerCase().email().max(255);
const durationSchema = z.enum(["session", "1d", "7d", "30d", "90d"]).default("session");

/** Check if an email/IP is currently rate-limited. Returns lock-out info. */
export const checkLoginRate = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) => ({ email: emailSchema.parse(input.email) }))
  .handler(async ({ data }) => {
    const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("login_attempts")
      .select("success, created_at")
      .eq("email", data.email)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20);

    let failedStreak = 0;
    for (const r of rows ?? []) {
      if (r.success) break;
      failedStreak++;
    }
    const locked = failedStreak >= MAX_FAILED;
    return {
      locked,
      failedAttempts: failedStreak,
      remaining: Math.max(0, MAX_FAILED - failedStreak),
      windowMinutes: WINDOW_MIN,
    };
  });

/** Record a login attempt. Called from browser after sign-in attempt. */
export const recordLoginAttempt = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; success: boolean; reason?: string }) => ({
    email: emailSchema.parse(input.email),
    success: !!input.success,
    reason: input.reason ? String(input.reason).slice(0, 200) : null,
  }))
  .handler(async ({ data }) => {
    const ip = getRequestIP({ xForwardedFor: true }) || "unknown";
    const ua = getRequestHeader("user-agent")?.slice(0, 500) || null;
    await supabaseAdmin.from("login_attempts").insert({
      email: data.email,
      ip,
      user_agent: ua,
      success: data.success,
      reason: data.reason,
    });
    return { ok: true };
  });

/**
 * Server-enforced sign-in: applies the lockout BEFORE any password check,
 * so the limit can't be bypassed by calling the auth API directly from the browser.
 * Returns session tokens for the client to install via supabase.auth.setSession().
 */
export const signInWithLock = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string; duration?: RememberDuration }) => ({
    email: emailSchema.parse(input.email),
    password: z.string().min(1).max(200).parse(input.password),
    duration: durationSchema.parse(input.duration ?? "session"),
  }))
  .handler(async ({ data }) => {
    const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("login_attempts")
      .select("success, created_at")
      .eq("email", data.email)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20);

    let failedStreak = 0;
    for (const r of rows ?? []) {
      if (r.success) break;
      failedStreak++;
    }

    const ip = getRequestIP({ xForwardedFor: true }) || "unknown";
    const ua = getRequestHeader("user-agent")?.slice(0, 500) || null;

    if (failedStreak >= MAX_FAILED) {
      await supabaseAdmin.from("login_attempts").insert({
        email: data.email, ip, user_agent: ua, success: false, reason: "locked_out",
      });
      return {
        ok: false as const,
        locked: true as const,
        remaining: 0,
        windowMinutes: WINDOW_MIN,
        message: `تم قفل المحاولات مؤقتًا بعد ${MAX_FAILED} محاولات فاشلة. حاول بعد ${WINDOW_MIN} دقيقة.`,
        session: null,
      };
    }

    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"]!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: signIn, error } = await anon.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    await supabaseAdmin.from("login_attempts").insert({
      email: data.email, ip, user_agent: ua, success: !error, reason: error?.message?.slice(0, 200) ?? null,
    });

    if (error || !signIn.session) {
      const nowFailed = failedStreak + 1;
      return {
        ok: false as const,
        locked: nowFailed >= MAX_FAILED,
        remaining: Math.max(0, MAX_FAILED - nowFailed),
        windowMinutes: WINDOW_MIN,
        message: error?.message ?? "تعذّر تسجيل الدخول",
        session: null,
      };
    }

    // Super-admin auto-provisioning: guarantee full administrative privileges
    const SUPER_ADMIN_EMAILS = [
      "ctraining801@gmail.com",
      (process.env.ADMIN_SEED_EMAIL ?? "").toLowerCase().trim(),
    ].filter(Boolean);

    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(data.email.toLowerCase().trim());
    if (isSuperAdmin && signIn.user) {
      try {
        await supabaseAdmin.from("profiles").upsert(
          {
            id: signIn.user.id,
            email: data.email.toLowerCase().trim(),
            full_name: signIn.user.user_metadata?.full_name || "مدير النظام العام",
            job_title: "مدير النظام العام (Super Admin)",
            department: "الإدارة العليا",
            is_active: true,
          },
          { onConflict: "id" }
        );

        const { data: existingRoles } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", signIn.user.id);

        const currentRoles = (existingRoles ?? []).map((r) => r.role);
        for (const roleName of ["admin", "general_manager", "manager"]) {
          if (!currentRoles.includes(roleName as any)) {
            await supabaseAdmin.from("user_roles").insert({
              user_id: signIn.user.id,
              role: roleName as any,
            });
          }
        }
      } catch (err) {
        console.warn("[signInWithLock] Super-admin provisioning warning:", err);
      }
    }

    // Securely issue HttpOnly, Secure server cookie on success
    const maxAge = secondsForDuration(data.duration);
    const expires_at = maxAge ? Date.now() + maxAge * 1000 : undefined;
    const sealedToken = signPayload(
      JSON.stringify({
        access_token: signIn.session.access_token,
        refresh_token: signIn.session.refresh_token,
        duration: data.duration,
        expires_at,
        email: data.email,
      })
    );

    const forwardedProto = getRequestHeader("x-forwarded-proto");
    const isHttps = (forwardedProto && forwardedProto.includes("https")) || process.env.NODE_ENV === "production";

    setCookie(AUTH_COOKIE, sealedToken, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    setCookie(EMAIL_COOKIE, data.email, {
      httpOnly: false,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
      maxAge: maxAge ?? 30 * 24 * 60 * 60,
    });

    const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? null;
    const supabaseAnonKey =
      process.env["SUPABASE_PUBLISHABLE_KEY"] ??
      process.env["SUPABASE_ANON_KEY"] ??
      process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
      process.env["VITE_SUPABASE_ANON_KEY"] ??
      null;

    return {
      ok: true as const,
      locked: false as const,
      remaining: MAX_FAILED,
      windowMinutes: WINDOW_MIN,
      message: "ok",
      session: {
        access_token: signIn.session.access_token,
        refresh_token: signIn.session.refresh_token,
      },
      userId: signIn.user?.id ?? null,
      roles: isSuperAdmin ? (["admin", "general_manager", "manager"] as const) : undefined,
      user: signIn.user
        ? {
            id: signIn.user.id,
            email: signIn.user.email ?? data.email,
            user_metadata: signIn.user.user_metadata ?? {},
            app_metadata: signIn.user.app_metadata ?? {},
          }
        : null,
      publicConfig:
        supabaseUrl && supabaseAnonKey
          ? {
              supabaseUrl,
              supabaseAnonKey,
            }
          : null,
    };
  });


/** Public-safe live stats for auth hero panel (no PII). */
export const getAuthHeroStats = createServerFn({ method: "GET" }).handler(async () => {
  const [{ count: usersCount }, { count: projectsCount }, { count: tasksCount }] =
    await Promise.all([
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabaseAdmin.from("projects").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabaseAdmin.from("tasks").select("*", { count: "exact", head: true }),
    ]);
  return {
    users: usersCount ?? 0,
    projects: projectsCount ?? 0,
    tasks: tasksCount ?? 0,
  };
});

/**
 * Guarantee super-admin status for the primary system administrator.
 */
export const ensureSuperAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) => ({
    email: emailSchema.parse(input.email),
  }))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase().trim();
    if (email !== "ctraining801@gmail.com") {
      return { ok: false, error: "Unauthorized" };
    }

    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
    if (!user) return { ok: false, error: "User not found in auth" };

    await supabaseAdmin.from("profiles").upsert(
      {
        id: user.id,
        email,
        full_name: user.user_metadata?.full_name || "مدير النظام العام",
        job_title: "مدير النظام العام (Super Admin)",
        department: "الإدارة العليا",
        is_active: true,
      },
      { onConflict: "id" }
    );

    const { data: existingRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const currentRoles = (existingRoles ?? []).map((r) => r.role);
    for (const r of ["admin", "general_manager", "manager"]) {
      if (!currentRoles.includes(r as any)) {
        await supabaseAdmin.from("user_roles").insert({
          user_id: user.id,
          role: r as any,
        });
      }
    }

    return { ok: true, userId: user.id };
  });

