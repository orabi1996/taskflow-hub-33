// Server functions for auth security: rate limiting, attempt logging, public stats.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const WINDOW_MIN = 15;
const MAX_FAILED = 5;

const emailSchema = z.string().trim().toLowerCase().email().max(255);

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
  .inputValidator((input: { email: string; password: string }) => ({
    email: emailSchema.parse(input.email),
    password: z.string().min(1).max(200).parse(input.password),
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
