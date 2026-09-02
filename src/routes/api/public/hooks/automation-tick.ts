import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type Rule = {
  id: string;
  trigger_type: string;
  trigger_config: unknown;
  action_type: string;
  action_config: unknown;
};

type Notif = {
  user_id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  project_id: string | null;
  metadata: Record<string, unknown>;
};

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

        for (const rule of (rules ?? []) as Rule[]) {
          try {
            const now = new Date();
            const cfg = (rule.trigger_config ?? {}) as Record<string, unknown>;
            const cooldownHours = Number(cfg["cooldown_hours"] ?? 24);
            const sent = await recentlyNotified(sb, rule.id, cooldownHours);
            const queue: Notif[] = [];

            const push = async (entityId: string, ownerId: string | null, n: Omit<Notif, "user_id" | "metadata">) => {
              const targets = await resolveTargets(sb, rule, ownerId);
              for (const uid of targets) {
                const key = `${uid}|${entityId}`;
                if (sent.has(key)) continue;
                sent.add(key);
                queue.push({ ...n, user_id: uid, metadata: { rule_id: rule.id, entity_id: entityId } });
              }
            };

            if (rule.trigger_type === "task_overdue") {
              const { data: tasks } = await sb
                .from("tasks")
                .select("id, title, user_id, end_at, project_id")
                .lt("end_at", now.toISOString())
                .in("status", ["pending", "postponed"])
                .limit(500);
              for (const t of tasks ?? []) {
                await push(t.id, t.user_id, {
                  type: "automation",
                  title: "مهمة متأخرة",
                  body: `المهمة "${t.title}" تجاوزت موعد الانتهاء`,
                  link: "/dashboard",
                  project_id: t.project_id,
                });
              }
            } else if (rule.trigger_type === "task_due_soon") {
              const hours = Number(cfg["hours"] ?? 24);
              const horizon = new Date(now.getTime() + hours * 3600_000).toISOString();
              const { data: tasks } = await sb
                .from("tasks")
                .select("id, title, user_id, end_at, project_id")
                .gte("end_at", now.toISOString())
                .lte("end_at", horizon)
                .eq("status", "pending")
                .limit(500);
              for (const t of tasks ?? []) {
                await push(t.id, t.user_id, {
                  type: "automation",
                  title: "تذكير: موعد قريب",
                  body: `المهمة "${t.title}" تنتهي خلال ${hours} ساعة`,
                  link: "/dashboard",
                  project_id: t.project_id,
                });
              }
            } else if (rule.trigger_type === "contract_expiring") {
              const days = Number(cfg["days"] ?? 30);
              const horizon = new Date(now.getTime() + days * 86400_000).toISOString().slice(0, 10);
              const today = now.toISOString().slice(0, 10);
              const { data: projects } = await sb
                .from("projects")
                .select("id, name, owner_id, contract_end_date")
                .gte("contract_end_date", today)
                .lte("contract_end_date", horizon);
              for (const p of projects ?? []) {
                await push(p.id, p.owner_id, {
                  type: "contract_alert",
                  title: "عقد سينتهي قريباً",
                  body: `عقد المشروع "${p.name}" ينتهي في ${p.contract_end_date}`,
                  link: "/projects",
                  project_id: p.id,
                });
              }
            } else if (rule.trigger_type === "project_inactive") {
              const days = Number(cfg["days"] ?? 14);
              const cutoff = new Date(now.getTime() - days * 86400_000).toISOString();
              const { data: projects } = await sb
                .from("projects")
                .select("id, name, owner_id")
                .eq("is_active", true)
                .limit(300);
              for (const p of projects ?? []) {
                const { data: recent } = await sb
                  .from("tasks")
                  .select("id")
                  .eq("project_id", p.id)
                  .gte("updated_at", cutoff)
                  .limit(1);
                if ((recent ?? []).length > 0) continue;
                await push(p.id, p.owner_id, {
                  type: "automation",
                  title: "مشروع بلا نشاط",
                  body: `لا يوجد أي تحديث على مشروع "${p.name}" منذ ${days} يومًا`,
                  link: `/projects/${p.id}`,
                  project_id: p.id,
                });
              }
            }

            if (queue.length > 0) {
              const { error: insErr } = await sb.from("notifications").insert(queue);
              if (insErr) throw new Error(insErr.message);
            }

            await sb.from("automation_logs").insert({
              rule_id: rule.id,
              status: "success",
              affected_count: queue.length,
              message: `تم إرسال ${queue.length} إشعارًا`,
            });
            await sb.from("automation_rules").update({ last_run_at: now.toISOString() }).eq("id", rule.id);
            results.push({ rule_id: rule.id, affected: queue.length });
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

/** Build a set of "userId|entityId" already notified by this rule inside the cooldown window. */
async function recentlyNotified(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  ruleId: string,
  cooldownHours: number,
): Promise<Set<string>> {
  const since = new Date(Date.now() - Math.max(1, cooldownHours) * 3600_000).toISOString();
  const { data } = await sb
    .from("notifications")
    .select("user_id, metadata")
    .gte("created_at", since)
    .contains("metadata", { rule_id: ruleId })
    .limit(2000);
  const set = new Set<string>();
  for (const row of (data ?? []) as { user_id: string; metadata: Record<string, unknown> | null }[]) {
    const meta = row.metadata ?? {};
    const entity = (meta["entity_id"] ?? meta["task_id"] ?? meta["project_id"]) as string | undefined;
    if (entity) set.add(`${row.user_id}|${entity}`);
  }
  return set;
}

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
