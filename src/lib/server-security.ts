import { timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Constant-time string comparison to prevent timing attacks on secrets.
 */
export function safeCompareSecret(provided: string | null | undefined, expected: string | null | undefined): boolean {
  if (!provided || !expected) return false;
  try {
    const a = Buffer.from(provided, "utf-8");
    const b = Buffer.from(expected, "utf-8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Extracts a secret token from Authorization Bearer or custom headers.
 */
export function extractProvidedSecret(request: Request, customHeaderNames: string[] = []): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  const defaultHeaders = ["x-cron-secret", "x-webhook-secret", "x-bootstrap-secret", "x-hook-secret"];
  const allHeaders = [...new Set([...defaultHeaders, ...customHeaderNames.map((h) => h.toLowerCase())])];

  for (const h of allHeaders) {
    const val = request.headers.get(h);
    if (val && val.trim()) return val.trim();
  }

  return null;
}

/**
 * Validates a request against a list of environment variable secret names.
 */
export function validateWebhookOrCronSecret(
  request: Request,
  envSecretNames: string[] = ["CRON_SECRET", "AUTOMATION_WEBHOOK_SECRET"]
): boolean {
  const provided = extractProvidedSecret(request);
  if (!provided) return false;

  for (const envName of envSecretNames) {
    const expected = process.env[envName];
    if (expected && expected.trim() && safeCompareSecret(provided, expected.trim())) {
      return true;
    }
  }

  return false;
}

/**
 * Verifies that the Authorization header contains a valid Supabase user JWT
 * belonging to an authenticated user with an administrative role (admin, general_manager, or support).
 */
export type AppRole = "admin" | "general_manager" | "manager" | "employee" | "support";

export async function verifyAdminOrSupportUser(
  request: Request,
  allowedRoles: AppRole[] = ["admin", "general_manager", "support"]
): Promise<{ authorized: boolean; userId?: string; email?: string; error?: string }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { authorized: false, error: "Missing Bearer authorization header" };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return { authorized: false, error: "Empty token" };
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return { authorized: false, error: "Invalid user session token" };
  }

  const userId = userData.user.id;
  const email = userData.user.email ?? undefined;

  const { data: rolesData, error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", allowedRoles);

  if (rolesError || !rolesData || rolesData.length === 0) {
    return { authorized: false, userId, email, error: "Forbidden: user lacks required administrative role" };
  }

  return { authorized: true, userId, email };
}

/**
 * Helper to record security-related audit log events safely without throwing.
 */
export async function recordSecurityAudit(event: {
  actorId?: string | null;
  actorEmail?: string | null;
  eventType: string;
  severity?: "info" | "warn" | "critical";
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  request?: Request;
}): Promise<void> {
  try {
    const ip =
      event.request?.headers.get("cf-connecting-ip") ||
      event.request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;
    const ua = event.request?.headers.get("user-agent")?.slice(0, 500) || null;

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: event.actorId ?? null,
      actor_email: event.actorEmail ?? null,
      event_type: event.eventType,
      severity: event.severity ?? "info",
      resource_type: event.resourceType ?? null,
      resource_id: event.resourceId ?? null,
      metadata: (event.metadata ?? null) as never,
      ip,
      user_agent: ua,
    });
  } catch (err) {
    console.error("[recordSecurityAudit] Failed to log security event:", err);
  }
}
