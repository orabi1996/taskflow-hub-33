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
          let level: "expired" | "imminent" | "soon" | null = null;
          if (days < 0) level = "expired";
          else if (days <= 7) level = "imminent";
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

          let title = `عقد المشروع "${p.name}" قارب الانتهاء`;
          let body = `يتبقى ${days} يوم على انتهاء العقد.`;

          if (level === "expired") {
            title = `عقد المشروع "${p.name}" منتهٍ`;
            body = `انتهى العقد منذ ${Math.abs(days)} يوم، يرجى اتخاذ إجراء التجديد أو الأرشفة.`;
          } else if (level === "imminent") {
            title = `⚠️ تنبيه حرج: عقد المشروع "${p.name}" ينتهي خلال أيام`;
            body = `يتبقى ${days} ${days === 1 ? "يوم واحد فقط" : days === 2 ? "يومان" : "أيام"} على انتهاء العقد.`;
          }

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
              metadata: { days, end_date: p.contract_end_date, level },
            });
            if (!insErr) created++;
          }

          // Record security/system audit event for expired contracts (once per project per day)
          if (level === "expired" || level === "imminent") {
            try {
              await admin.from("audit_logs").insert({
                event_type: `contract.status.${level}`,
                severity: level === "expired" ? "warn" : "info",
                resource_type: "project.contract",
                resource_id: p.id,
                metadata: { project_name: p.name, days, contract_end_date: p.contract_end_date },
              });
            } catch {
              // Non-blocking audit log insert
            }
          }
        }

        return Response.json({ ok: true, created, skipped, projects: projects?.length ?? 0 });
      },
    },
  },
});
