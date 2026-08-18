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
