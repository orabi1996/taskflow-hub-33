import { createFileRoute } from "@tanstack/react-router";
import {
  verifyAdminOrSupportUser,
  validateWebhookOrCronSecret,
  recordSecurityAudit,
} from "@/lib/server-security";

export const Route = createFileRoute("/api/public/hooks/smtp-test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Verify that caller is either an authenticated admin/manager/support OR provides a valid server secret
          const hasSecret = validateWebhookOrCronSecret(request, ["SMTP_TEST_SECRET", "CRON_SECRET"]);
          const adminAuth = hasSecret ? { authorized: true } : await verifyAdminOrSupportUser(request);

          if (!hasSecret && !adminAuth.authorized) {
            await recordSecurityAudit({
              eventType: "smtp.test_unauthorized",
              severity: "warn",
              resourceType: "system.smtp",
              metadata: { reason: adminAuth.error ?? "Unauthorized caller" },
              request,
            });
            return new Response(
              JSON.stringify({ error: "غير مصرح: هذا الإجراء يتطلب حساب مدير مصرح أو مفتاح اختبار صالح" }),
              {
                status: 401,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const body = (await request.json().catch(() => ({}))) as { to?: string };
          const to = (body.to ?? "").trim();
          if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
            return new Response(JSON.stringify({ error: "بريد المستلم غير صالح" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const { data: settings, error: cfgErr } = await supabaseAdmin
            .from("smtp_settings")
            .select("*")
            .eq("is_active", true)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (cfgErr) throw cfgErr;
          if (!settings) {
            return new Response(JSON.stringify({ error: "لم يتم تكوين SMTP بعد" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          await recordSecurityAudit({
            actorId: adminAuth.userId ?? null,
            actorEmail: adminAuth.email ?? null,
            eventType: "smtp.test_attempted",
            severity: "info",
            resourceType: "system.smtp",
            metadata: { target_email: to },
            request,
          });

          return new Response(
            JSON.stringify({
              ok: false,
              configured: Boolean(settings),
              error: "اختبار SMTP المباشر غير متاح حاليًا من المعاينة",
            }),
            {
              status: 501,
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (e: any) {
          console.error("[smtp-test] error", e);
          return new Response(JSON.stringify({ error: e?.message ?? "خطأ غير معروف" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
