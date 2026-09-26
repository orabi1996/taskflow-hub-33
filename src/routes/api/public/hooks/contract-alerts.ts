import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { validateWebhookOrCronSecret, verifyAdminOrSupportUser, recordSecurityAudit } from "@/lib/server-security";

// Cron endpoint: generates in-app notifications for projects whose contracts are
// expired or expiring within their custom alert_days_before window.
// Protected by CRON_SECRET or CONTRACT_ALERTS_SECRET, or an authenticated Admin/Manager session.
export const Route = createFileRoute("/api/public/hooks/contract-alerts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const hasSecret = validateWebhookOrCronSecret(request, [
          "CRON_SECRET",
          "CONTRACT_ALERTS_SECRET",
        ]);
        const adminAuth = hasSecret ? { authorized: true } : await verifyAdminOrSupportUser(request);

        if (!hasSecret && !adminAuth.authorized) {
          await recordSecurityAudit({
            eventType: "hook.contract_alerts.unauthorized",
            severity: "warn",
            resourceType: "system.contracts",
            metadata: { reason: adminAuth.error ?? "Missing or invalid cron secret" },
            request,
          });
          return Response.json(
            { error: "Unauthorized: Invalid or missing cron secret or admin credentials" },
            { status: 401 }
          );
        }

        const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !serviceKey) {
          return Response.json({ error: "missing service credentials" }, { status: 500 });
        }
        const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

        // 1) get projects with contract_end_date set
        const { data: projects, error: pErr } = await admin
          .from("projects")
          .select("id, name, owner_id, contract_end_date, alert_days_before")
          .not("contract_end_date", "is", null);
        if (pErr) return Response.json({ error: pErr.message }, { status: 500 });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 2) admins / general managers
        const { data: adminRoles } = await admin
          .from("user_roles")
          .select("user_id")
          .in("role", ["admin", "general_manager"]);
        const adminIds = Array.from(new Set((adminRoles ?? []).map((r: any) => r.user_id)));

        let created = 0;
        let skipped = 0;

        for (const p of projects ?? []) {
          if (!p.contract_end_date) continue;
          const end = new Date(p.contract_end_date);
          end.setHours(0, 0, 0, 0);
          const days = Math.ceil((end.getTime() - today.getTime()) / 86400000);
          const threshold = p.alert_days_before ?? 30;
          let level: "expired" | "soon" | null = null;
          if (days < 0) level = "expired";
          else if (days <= threshold) level = "soon";
          if (!level) continue;

          // recipients: owner + admins/GMs
          const recipients = new Set<string>();
          if (p.owner_id) recipients.add(p.owner_id);
          adminIds.forEach((id) => recipients.add(id));

          // Check dismissals — owner-specific (admins still get notified)
          const { data: dismissals } = await admin
            .from("project_alert_dismissals")
            .select("user_id, dismissed_for_end_date")
            .eq("project_id", p.id);
          const dismissedSet = new Set(
            (dismissals ?? [])
              .filter((d: any) => d.dismissed_for_end_date === p.contract_end_date)
              .map((d: any) => d.user_id)
          );

          const title =
            level === "expired"
              ? `عقد المشروع "${p.name}" منتهٍ`
              : `عقد المشروع "${p.name}" قارب الانتهاء`;
          const body =
            level === "expired"
              ? `انتهى منذ ${Math.abs(days)} يوم.`
              : `يتبقى ${days} يوم على انتهاء العقد.`;

          for (const uid of recipients) {
            if (dismissedSet.has(uid)) continue;

            // Idempotency: skip if same notification already exists today
            const since = new Date(today).toISOString();
            const { data: existing } = await admin
              .from("notifications")
              .select("id")
              .eq("user_id", uid)
              .eq("project_id", p.id)
              .eq("type", `contract_${level}`)
              .gte("created_at", since)
              .limit(1);
            if (existing && existing.length > 0) { skipped++; continue; }

            const { error: insErr } = await admin.from("notifications").insert({
              user_id: uid,
              type: `contract_${level}`,
              title,
              body,
              link: "/alerts",
              project_id: p.id,
              metadata: { days, end_date: p.contract_end_date },
            });
            if (!insErr) created++;
          }
        }

        return Response.json({ ok: true, created, skipped, projects: projects?.length ?? 0 });
      },
    },
  },
});
