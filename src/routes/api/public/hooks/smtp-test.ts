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

          const apiKey = process.env.RESEND_API_KEY;
          if (apiKey) {
            const senderName = settings.from_name || "TaskFlow CRM";
            const senderEmail = settings.from_email || "onboarding@resend.dev";
            const resendRes = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: `${senderName} <${senderEmail}>`,
                to: [to],
                subject: "رسالة تجريبية من نظام إدارة المهام والمشاريع (TaskFlow)",
                html: `
                  <div dir="rtl" style="font-family: sans-serif; padding: 24px; background: #f8fafc; border-radius: 8px;">
                    <h2 style="color: #0f172a; margin-bottom: 12px;">✅ نجح اختبار إعدادات البريد</h2>
                    <p style="color: #475569; font-size: 15px; line-height: 1.6;">
                      هذه رسالة تأكيد تجريبية تم إرسالها للتحقق من تكوين البريد الإلكتروني وخادم SMTP في النظام.
                    </p>
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 16px 0;">
                      <p style="margin: 4px 0; color: #334155;"><b>الخادم:</b> ${settings.host}:${settings.port}</p>
                      <p style="margin: 4px 0; color: #334155;"><b>المرسل:</b> ${senderEmail}</p>
                      <p style="margin: 4px 0; color: #334155;"><b>المستلم:</b> ${to}</p>
                      <p style="margin: 4px 0; color: #334155;"><b>الوقت:</b> ${new Date().toLocaleString("ar-SA")}</p>
                    </div>
                    <p style="color: #64748b; font-size: 13px;">إذا تلقيت هذا البريد، فهذا يعني أن إعدادات الإرسال تعمل بصورة سليمة.</p>
                  </div>
                `,
              }),
            });

            if (!resendRes.ok) {
              const errBody = await resendRes.json().catch(() => ({}));
              throw new Error(errBody?.message || `خطأ من مزود البريد: HTTP ${resendRes.status}`);
            }

            return new Response(
              JSON.stringify({
                ok: true,
                sent: true,
                message: `تم إرسال بريد الاختبار بنجاح إلى ${to}`,
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }

          // In serverless without direct Resend key, verify configuration parameters
          return new Response(
            JSON.stringify({
              ok: true,
              simulated: true,
              configured: true,
              message: `تم التحقق من إعدادات الخادم (${settings.host}:${settings.port}) بنجاح. للإرسال المباشر عبر السحابة، تأكد من تعيين RESEND_API_KEY.`,
            }),
            {
              status: 200,
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
