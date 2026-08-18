import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Cron-triggered endpoint that scans active automation rules and applies actions.
// Called by pg_cron via /api/public/* (auth bypassed; we still gate via service role usage).
export const Route = createFileRoute("/api/public/hooks/automation-tick")({
  server: {
    handlers: {
      POST: async () => {
        const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !serviceKey) {
          return Response.json({ error: "missing service credentials" }, { status: 500 });
        }
        const sb = createClient(url, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: rules, error: rulesErr } = await sb
          .from("automation_rules")
          .select("*")
          .eq("is_active", true);

        if (rulesErr) return Response.json({ error: rulesErr.message }, { status: 500 });

        const results: Array<Record<string, unknown>> = [];

        for (const rule of rules ?? []) {
          try {
            let affected = 0;
            const now = new Date();

            if (rule.trigger_type === "task_overdue") {
              const { data: tasks } = await sb
                .from("tasks")
                .select("id, title, user_id, end_at, project_id")
                .lt("end_at", now.toISOString())
                .in("status", ["pending", "postponed"])
                .limit(500);
              for (const t of tasks ?? []) {
                const targets = await resolveTargets(sb, rule, t.user_id);
                for (const uid of targets) {
                  await sb.from("notifications").insert({
                    user_id: uid,
                    type: "automation",
                    title: "مهمة متأخرة",
                    body: `المهمة "${t.title}" تجاوزت موعد الانتهاء`,
                    link: "/dashboard",
                    project_id: t.project_id,
                    metadata: { rule_id: rule.id, task_id: t.id },
                  });
                  affected++;
                }
              }
            } else if (rule.trigger_type === "task_due_soon") {
              const hours = Number((rule.trigger_config as { hours?: number })?.hours ?? 24);
              const horizon = new Date(now.getTime() + hours * 3600_000).toISOString();
              const { data: tasks } = await sb
                .from("tasks")
                .select("id, title, user_id, end_at, project_id")
                .gte("end_at", now.toISOString())
                .lte("end_at", horizon)
                .eq("status", "pending")
                .limit(500);
              for (const t of tasks ?? []) {
                const targets = await resolveTargets(sb, rule, t.user_id);
                for (const uid of targets) {
                  await sb.from("notifications").insert({
                    user_id: uid,
                    type: "automation",
                    title: "تذكير: موعد قريب",
                    body: `المهمة "${t.title}" تنتهي خلال ${hours} ساعة`,
                    link: "/dashboard",
                    project_id: t.project_id,
                    metadata: { rule_id: rule.id, task_id: t.id },
                  });
                  affected++;
                }
              }
            } else if (rule.trigger_type === "contract_expiring") {
              const days = Number((rule.trigger_config as { days?: number })?.days ?? 30);
              const horizon = new Date(now.getTime() + days * 86400_000).toISOString().slice(0, 10);
              const today = now.toISOString().slice(0, 10);
              const { data: projects } = await sb
                .from("projects")
                .select("id, name, owner_id, contract_end_date")
                .gte("contract_end_date", today)
                .lte("contract_end_date", horizon);
              for (const p of projects ?? []) {
                const targets = await resolveTargets(sb, rule, p.owner_id);
                for (const uid of targets) {
                  await sb.from("notifications").insert({
                    user_id: uid,
                    type: "contract_alert",
                    title: "عقد سينتهي قريباً",
                    body: `عقد المشروع "${p.name}" ينتهي في ${p.contract_end_date}`,
                    link: "/projects",
                    project_id: p.id,
                    metadata: { rule_id: rule.id },
                  });
                  affected++;
                }
              }
            }

            await sb.from("automation_logs").insert({
              rule_id: rule.id,
              status: "success",
              affected_count: affected,
              message: `Processed ${affected} notifications`,
            });
            await sb.from("automation_rules").update({ last_run_at: now.toISOString() }).eq("id", rule.id);
            results.push({ rule_id: rule.id, affected });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await sb.from("automation_logs").insert({
              rule_id: rule.id,
              status: "error",
              affected_count: 0,
              message: msg,
            });
            results.push({ rule_id: rule.id, error: msg });
          }
        }

        return Response.json({ ok: true, processed: results.length, results });
      },
    },
  },
});

async function resolveTargets(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  rule: { action_type: string; action_config: unknown },
  ownerId: string | null
): Promise<string[]> {
  const action = rule.action_type;
  if (action === "notify_user" && ownerId) return [ownerId];
  if (action === "notify_manager" && ownerId) {
    const { data } = await sb.from("profiles").select("manager_id").eq("id", ownerId).maybeSingle();
    const mid = (data as { manager_id: string | null } | null)?.manager_id;
    return mid ? [mid] : [];
  }
  if (action === "notify_admins") {
    const { data } = await sb.from("user_roles").select("user_id").in("role", ["admin", "general_manager"]);
    return ((data as { user_id: string }[] | null) ?? []).map((r) => r.user_id);
  }
  return [];
}
