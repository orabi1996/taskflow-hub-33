import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Unified admin command center: org-wide KPIs aggregated in one round trip.
 * Admin / general_manager only — everything else gets a 403.
 */
export const getCommandCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;

    const { data: myRoles } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (myRoles ?? []).map((r) => r.role as string);
    if (!roles.some((r) => r === "admin" || r === "general_manager")) {
      throw new Error("هذه اللوحة متاحة لمدير النظام والمدير العام فقط.");
    }

    const now = new Date();
    const iso = (d: Date) => d.toISOString();
    const last30 = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    const last24 = new Date(now.getTime() - 24 * 3600 * 1000);
    const quarter = Math.floor(now.getUTCMonth() / 3) + 1;
    const year = now.getUTCFullYear();

    const [
      tasksRes,
      projectsRes,
      profilesRes,
      modulesRes,
      objectivesRes,
      rulesRes,
      notifRes,
      auditRes,
      kudosRes,
    ] = await Promise.all([
      sb.from("tasks").select("id, status, end_at, updated_at, user_id, project_id, module_id"),
      sb.from("projects").select("id, name, is_active, health_status, contract_end_date"),
      sb.from("profiles").select("id, full_name, is_active, department_id"),
      sb.from("company_modules").select("id, name, parent_id"),
      sb.from("objectives").select("id, progress, status").eq("year", year).eq("quarter", quarter),
      sb.from("automation_rules").select("id, name, is_active, last_run_at"),
      sb.from("notifications").select("id, created_at, type").gte("created_at", iso(last24)),
      sb
        .from("audit_logs")
        .select("id, event_type, severity, actor_email, resource_type, created_at")
        .order("created_at", { ascending: false })
        .limit(12),
      sb.from("kudos").select("id, created_at").gte("created_at", iso(last30)),
    ]);

    const tasks = tasksRes.data ?? [];
    const projects = projectsRes.data ?? [];
    const profiles = profilesRes.data ?? [];
    const modules = modulesRes.data ?? [];
    const objectives = objectivesRes.data ?? [];
    const rules = rulesRes.data ?? [];

    const byStatus = { completed: 0, pending: 0, postponed: 0, cancelled: 0 } as Record<string, number>;
    let overdue = 0;
    let completedLast30 = 0;
    const perUser = new Map<string, { total: number; completed: number; overdue: number }>();
    const perModule = new Map<string | null, { total: number; completed: number }>();

    for (const t of tasks) {
      byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
      const isOpen = t.status === "pending" || t.status === "postponed";
      const late = isOpen && t.end_at != null && new Date(t.end_at) < now;
      if (late) overdue++;
      if (t.status === "completed" && t.updated_at && new Date(t.updated_at) >= last30) completedLast30++;

      const u = perUser.get(t.user_id) ?? { total: 0, completed: 0, overdue: 0 };
      u.total++;
      if (t.status === "completed") u.completed++;
      if (late) u.overdue++;
      perUser.set(t.user_id, u);

      const m = perModule.get(t.module_id ?? null) ?? { total: 0, completed: 0 };
      m.total++;
      if (t.status === "completed") m.completed++;
      perModule.set(t.module_id ?? null, m);
    }

    const nameById = new Map(profiles.map((p) => [p.id, p.full_name || "—"]));
    const moduleName = new Map(modules.map((m) => [m.id, m.name]));

    const topPerformers = [...perUser.entries()]
      .map(([user_id, v]) => ({
        user_id,
        name: nameById.get(user_id) ?? "—",
        ...v,
        rate: v.total ? Math.round((v.completed / v.total) * 100) : 0,
      }))
      .filter((p) => p.total > 0)
      .sort((a, b) => b.completed - a.completed || b.rate - a.rate)
      .slice(0, 8);

    const moduleBreakdown = [...perModule.entries()]
      .map(([module_id, v]) => ({
        module_id,
        name: module_id ? (moduleName.get(module_id) ?? "غير معروف") : "بدون نظام",
        ...v,
        rate: v.total ? Math.round((v.completed / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const soon = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    const expiringContracts = projects
      .filter((p) => p.contract_end_date && new Date(p.contract_end_date) <= soon && new Date(p.contract_end_date) >= now)
      .map((p) => ({ id: p.id, name: p.name, contract_end_date: p.contract_end_date }))
      .slice(0, 8);

    const avgObjectiveProgress = objectives.length
      ? Math.round(objectives.reduce((s, o) => s + Number(o.progress ?? 0), 0) / objectives.length)
      : 0;

    const lastRun = rules
      .map((r) => r.last_run_at)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

    return {
      generatedAt: iso(now),
      period: { year, quarter },
      tasks: {
        total: tasks.length,
        byStatus,
        overdue,
        completedLast30,
        completionRate: tasks.length ? Math.round((byStatus.completed / tasks.length) * 100) : 0,
      },
      projects: {
        total: projects.length,
        active: projects.filter((p) => p.is_active !== false).length,
        atRisk: projects.filter((p) => p.health_status && p.health_status !== "green").length,
        expiringContracts,
      },
      people: {
        total: profiles.length,
        active: profiles.filter((p) => p.is_active !== false).length,
        disabled: profiles.filter((p) => p.is_active === false).length,
      },
      okrs: { count: objectives.length, avgProgress: avgObjectiveProgress },
      kudosLast30: (kudosRes.data ?? []).length,
      automation: {
        total: rules.length,
        active: rules.filter((r) => r.is_active).length,
        lastRun,
      },
      notificationsLast24: (notifRes.data ?? []).length,
      topPerformers,
      moduleBreakdown,
      recentAudit: auditRes.data ?? [],
    };
  });
