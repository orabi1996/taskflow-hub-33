import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/smtp-test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
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

          return new Response(JSON.stringify({
            ok: false,
            configured: Boolean(settings),
            error: "اختبار SMTP المباشر غير متاح حاليًا من المعاينة",
          }), {
            status: 501,
            headers: { "Content-Type": "application/json" },
          });
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
