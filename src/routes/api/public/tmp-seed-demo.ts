import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// TEMPORARY: seeds demo employees/projects/tasks across Classera & C-SMARX modules.
export const Route = createFileRoute("/api/public/tmp-seed-demo")({
  server: {
    handlers: {
      POST: async () => {
        const url = process.env["SUPABASE_URL"]!;
        const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
        const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

        const CLASSERA = "04e248c9-f4fc-4851-ad38-ef1a08dc6baa";
        const CSMARX = "3dccc214-aefa-4d98-a22d-c1744b9767e2";

        const people = [
          { email: "demo.gm@classera.test", name: "سلمى الحربي", role: "general_manager", module: CLASSERA, mgr: null as string | null },
          { email: "demo.mgr.csmarx@classera.test", name: "خالد العتيبي", role: "manager", module: CSMARX, mgr: null },
          { email: "demo.emp1.csmarx@classera.test", name: "نورة القحطاني", role: "employee", module: CSMARX, mgr: "demo.mgr.csmarx@classera.test" },
          { email: "demo.emp2.csmarx@classera.test", name: "أحمد سالم", role: "employee", module: CSMARX, mgr: "demo.mgr.csmarx@classera.test" },
          { email: "demo.emp.classera@classera.test", name: "ريم الدوسري", role: "employee", module: CLASSERA, mgr: "demo.gm@classera.test" },
        ];

        const ids: Record<string, string> = {};
        for (const p of people) {
          const { data: created, error } = await sb.auth.admin.createUser({
            email: p.email,
            password: "Demo@2026!Classera",
            email_confirm: true,
            user_metadata: { full_name: p.name },
          });
          if (created?.user) {
            ids[p.email] = created.user.id;
          } else {
            const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
            const found = list?.users.find((u) => u.email === p.email);
            if (!found) return Response.json({ step: "createUser", email: p.email, error: error?.message }, { status: 500 });
            ids[p.email] = found.id;
          }
        }

        for (const p of people) {
          const uid = ids[p.email]!;
          const { error: profErr } = await sb.from("profiles").upsert({
            id: uid,
            full_name: p.name,
            email: p.email,
            is_active: true,
            manager_id: p.mgr ? ids[p.mgr] : null,
          }, { onConflict: "id" });
          if (profErr) return Response.json({ step: "profile", email: p.email, error: profErr.message }, { status: 500 });
          await sb.from("user_roles").delete().eq("user_id", uid);
          await sb.from("user_roles").insert({ user_id: uid, role: p.role });
          await sb.from("employee_modules").delete().eq("user_id", uid);
          await sb.from("employee_modules").insert({ user_id: uid, module_id: p.module, is_primary: true });
        }


        const projectDefs = [
          { name: "بوابة Classera التعليمية", module: CLASSERA, owner: "demo.gm@classera.test" },
          { name: "منصة C-SmarX لإدارة الأداء", module: CSMARX, owner: "demo.mgr.csmarx@classera.test" },
        ];
        const projIds: Record<string, string> = {};
        for (const d of projectDefs) {
          const { data: existing } = await sb.from("projects").select("id").eq("name", d.name).maybeSingle();
          let pid = existing?.id as string | undefined;
          if (!pid) {
            const { data: ins, error } = await sb.from("projects").insert({
              name: d.name,
              description: "مشروع تجريبي لاختبار عزل الأنظمة",
              owner_id: ids[d.owner],
              created_by: ids[d.owner],
              is_active: true,
            }).select("id").single();
            if (error) return Response.json({ step: "project", error: error.message }, { status: 500 });
            pid = ins!.id;
          }
          projIds[d.name] = pid!;
          await sb.from("project_modules").delete().eq("project_id", pid);
          await sb.from("project_modules").insert({ project_id: pid, module_id: d.module, scope: "full" });
        }

        const now = Date.now();
        const taskDefs = [
          { title: "مراجعة خطة المناهج الرقمية", user: "demo.emp.classera@classera.test", project: "بوابة Classera التعليمية", days: -3 },
          { title: "تجهيز تقرير الاعتماد الأكاديمي", user: "demo.emp.classera@classera.test", project: "بوابة Classera التعليمية", days: 5 },
          { title: "تصميم لوحة مؤشرات الأداء", user: "demo.emp1.csmarx@classera.test", project: "منصة C-SmarX لإدارة الأداء", days: -1 },
          { title: "ربط تتبع الوقت بالتقارير", user: "demo.emp2.csmarx@classera.test", project: "منصة C-SmarX لإدارة الأداء", days: 7 },
          { title: "اختبار صلاحيات الأنظمة", user: "demo.emp1.csmarx@classera.test", project: "منصة C-SmarX لإدارة الأداء", days: 2 },
        ];
        for (const t of taskDefs) {
          const { data: ex } = await sb.from("tasks").select("id").eq("title", t.title).maybeSingle();
          if (ex) continue;
          const { error } = await sb.from("tasks").insert({
            title: t.title,
            user_id: ids[t.user],
            project_id: projIds[t.project],
            status: t.days < 0 ? "pending" : "pending",
            start_at: new Date(now - 86400000).toISOString(),
            end_at: new Date(now + t.days * 86400000).toISOString(),
            priority: "medium",
          });
          if (error) return Response.json({ step: "task", title: t.title, error: error.message }, { status: 500 });
        }

        return Response.json({ ok: true, users: Object.keys(ids).length, projects: Object.keys(projIds).length });
      },
    },
  },
});
