import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  extractProvidedSecret,
  safeCompareSecret,
  recordSecurityAudit,
} from "@/lib/server-security";

// One-shot administrative bootstrap endpoint.
// STRICTLY PROTECTED:
// 1. Must be explicitly enabled via ADMIN_BOOTSTRAP_ENABLED="true".
// 2. Must provide matching ADMIN_BOOTSTRAP_SECRET or ADMIN_SEED_SECRET via Authorization header or x-bootstrap-secret.
// 3. Prevents resetting existing admins unless ALLOW_ADMIN_RESET="true" is explicitly set.
// 4. Logs all attempts (success and failure) to audit_logs.

async function handleBootstrap(request: Request) {
  const isEnabled = process.env.ADMIN_BOOTSTRAP_ENABLED === "true";
  const expectedSecret = process.env.ADMIN_BOOTSTRAP_SECRET || process.env.ADMIN_SEED_SECRET;

  if (!isEnabled || !expectedSecret) {
    await recordSecurityAudit({
      eventType: "admin.bootstrap_attempt_blocked",
      severity: "warn",
      resourceType: "auth.admin",
      metadata: { reason: "Endpoint disabled or secret not configured" },
      request,
    });
    return Response.json(
      { ok: false, error: "نقطة التثبيت الإداري معطلة في هذا النظام" },
      { status: 403 }
    );
  }

  const providedSecret = extractProvidedSecret(request, ["x-bootstrap-secret"]);
  if (!providedSecret || !safeCompareSecret(providedSecret, expectedSecret)) {
    await recordSecurityAudit({
      eventType: "admin.bootstrap_unauthorized",
      severity: "critical",
      resourceType: "auth.admin",
      metadata: { reason: "Invalid bootstrap secret provided" },
      request,
    });
    return Response.json(
      { ok: false, error: "رمز المصادقة الخاص بنقطة التثبيت غير صالح" },
      { status: 401 }
    );
  }

  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  const fullName = process.env.ADMIN_SEED_FULL_NAME ?? "System Administrator";

  if (!email || !password) {
    return Response.json(
      { ok: false, error: "ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD غير مضبوطين في البيئة" },
      { status: 400 }
    );
  }

  // Safety check: if an admin account already exists, prevent accidental/malicious overwrite
  const { data: existingAdminRoles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1);

  const adminAlreadyExists = existingAdminRoles && existingAdminRoles.length > 0;
  const allowReset = process.env.ALLOW_ADMIN_RESET === "true";

  if (adminAlreadyExists && !allowReset) {
    await recordSecurityAudit({
      eventType: "admin.bootstrap_rejected_existing_admin",
      severity: "warn",
      resourceType: "auth.admin",
      metadata: { reason: "Admin user already exists and ALLOW_ADMIN_RESET is false" },
      request,
    });
    return Response.json(
      {
        ok: false,
        error: "يوجد مدير نظام مسجل بالفعل. لتعديل البيانات يجب تفعيل ALLOW_ADMIN_RESET صراحة.",
      },
      { status: 409 }
    );
  }

  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) {
    return Response.json({ ok: false, step: "listUsers", error: listErr.message }, { status: 500 });
  }

  let user = list.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());

  if (!user) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) {
      return Response.json({ ok: false, step: "createUser", error: error.message }, { status: 500 });
    }
    user = data.user!;
  } else {
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
  }

  await supabaseAdmin
    .from("profiles")
    .upsert(
      { id: user.id, full_name: fullName, email, job_title: "System Administrator", is_active: true },
      { onConflict: "id" }
    );

  await supabaseAdmin.from("user_roles").delete().eq("user_id", user.id);
  const { error: rErr } = await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: user.id, role: "admin" });

  if (rErr) {
    return Response.json({ ok: false, step: "assignRole", error: rErr.message }, { status: 500 });
  }

  await recordSecurityAudit({
    actorId: user.id,
    actorEmail: email,
    eventType: "admin.bootstrap_provisioned",
    severity: "info",
    resourceType: "auth.admin",
    resourceId: user.id,
    metadata: { email, provisioned_at: new Date().toISOString() },
    request,
  });

  return Response.json({
    ok: true,
    message: "تم تجهيز حساب مدير النظام بنجاح",
    email,
  });
}

export const Route = createFileRoute("/api/public/seed-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => handleBootstrap(request),
      GET: async ({ request }) => handleBootstrap(request),
    },
  },
});
