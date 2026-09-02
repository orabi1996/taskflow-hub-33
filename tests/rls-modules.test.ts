/**
 * اختبارات دوال RLS الحرجة وعزل البيانات بين Classera و C-SMARX.
 * تعمل مقابل قاعدة البيانات الفعلية باستخدام مفتاح الخدمة (service role)
 * لاستدعاء الدوال مباشرة — لا تعدّل أي بيانات.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, test } from "vitest";

const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const enabled = Boolean(url && key);
const d = enabled ? describe : describe.skip;

let sb: SupabaseClient;
const users = new Map<string, string>(); // full_name -> id
const projects = new Map<string, string>(); // name -> id
const modules = new Map<string, string>(); // name -> id

async function rpc(fn: string, args: Record<string, unknown>) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
}

d("RLS: تسلسل الأنظمة وعزل البيانات", () => {
  beforeAll(async () => {
    sb = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: profs } = await sb.from("profiles").select("id, full_name");
    (profs ?? []).forEach((p) => users.set(p.full_name as string, p.id as string));

    const { data: projs } = await sb.from("projects").select("id, name");
    (projs ?? []).forEach((p) => projects.set(p.name as string, p.id as string));

    const { data: mods } = await sb.from("company_modules").select("id, name");
    (mods ?? []).forEach((m) => modules.set(m.name as string, m.id as string));
  });

  test("بيانات الاختبار متوفرة (موظفو Classera و C-SMARX ومشروعان)", () => {
    expect(users.get("سلمى الحربي"), "المدير العام (Classera)").toBeTruthy();
    expect(users.get("خالد العتيبي"), "المدير (C-SMARX)").toBeTruthy();
    expect(users.get("نورة القحطاني"), "موظفة C-SMARX").toBeTruthy();
    expect(users.get("ريم الدوسري"), "موظفة Classera").toBeTruthy();
    expect(modules.get("Classera")).toBeTruthy();
    expect(modules.get("C-SMARX")).toBeTruthy();
  });

  test("شجرة الأنظمة: C-SMARX ابن مباشر لـ Classera", async () => {
    const { data } = await sb
      .from("company_modules")
      .select("name, parent_id")
      .eq("name", "C-SMARX")
      .maybeSingle();
    expect(data?.parent_id).toBe(modules.get("Classera"));
  });

  test("is_direct_manager_of: المدير المباشر فقط", async () => {
    const mgr = users.get("خالد العتيبي")!;
    const emp = users.get("نورة القحطاني")!;
    const other = users.get("ريم الدوسري")!;
    expect(await rpc("is_direct_manager_of", { _manager_id: mgr, _employee_id: emp })).toBe(true);
    expect(await rpc("is_direct_manager_of", { _manager_id: mgr, _employee_id: other })).toBe(false);
    expect(await rpc("is_direct_manager_of", { _manager_id: emp, _employee_id: mgr })).toBe(false);
  });

  test("is_chain_manager_of: يشمل السلسلة الأعلى ولا يعكسها", async () => {
    const mgr = users.get("خالد العتيبي")!;
    const emp = users.get("نورة القحطاني")!;
    expect(await rpc("is_chain_manager_of", { _manager_id: mgr, _employee_id: emp })).toBe(true);
    expect(await rpc("is_chain_manager_of", { _manager_id: emp, _employee_id: mgr })).toBe(false);
  });

  test("is_module_linked_to_project: الربط الفعلي بين المشروع والنظام", async () => {
    const classeraProject = projects.get("بوابة Classera التعليمية")!;
    const csmarxProject = projects.get("منصة C-SmarX لإدارة الأداء")!;
    expect(
      await rpc("is_module_linked_to_project", {
        _project_id: classeraProject,
        _module_id: modules.get("Classera"),
      }),
    ).toBe(true);
    expect(
      await rpc("is_module_linked_to_project", {
        _project_id: classeraProject,
        _module_id: modules.get("C-SMARX"),
      }),
    ).toBe(false);
    expect(
      await rpc("is_module_linked_to_project", {
        _project_id: csmarxProject,
        _module_id: modules.get("C-SMARX"),
      }),
    ).toBe(true);
  });

  test("is_project_member: العضوية الفعلية فقط", async () => {
    const csmarxProject = projects.get("منصة C-SmarX لإدارة الأداء")!;
    const { data: members } = await sb
      .from("project_members")
      .select("user_id")
      .eq("project_id", csmarxProject);
    const memberIds = (members ?? []).map((m) => m.user_id as string);
    for (const uid of memberIds) {
      expect(await rpc("is_project_member", { _user_id: uid, _project_id: csmarxProject })).toBe(true);
    }
    const stranger = users.get("ريم الدوسري")!;
    if (!memberIds.includes(stranger)) {
      expect(await rpc("is_project_member", { _user_id: stranger, _project_id: csmarxProject })).toBe(false);
    }
  });

  test("can_manage_project: الأدمن/المدير العام نعم، الموظف لا", async () => {
    const project = projects.get("منصة C-SmarX لإدارة الأداء")!;
    const gm = users.get("سلمى الحربي")!;
    const emp = users.get("نورة القحطاني")!;
    expect(await rpc("can_manage_project", { _user_id: gm, _project_id: project })).toBe(true);
    expect(await rpc("can_manage_project", { _user_id: emp, _project_id: project })).toBe(false);
  });

  test("تسريب البيانات: موظف C-SMARX لا يرى مشروع Classera", async () => {
    const classeraProject = projects.get("بوابة Classera التعليمية")!;
    const csmarxProject = projects.get("منصة C-SmarX لإدارة الأداء")!;
    const csmarxEmp = users.get("نورة القحطاني")!;

    expect(
      await rpc("can_view_project_v3", { _user_id: csmarxEmp, _project_id: classeraProject }),
      "موظف C-SMARX يجب أن يُحجب عن مشاريع Classera",
    ).toBe(false);
    expect(
      await rpc("can_view_project_v3", { _user_id: csmarxEmp, _project_id: csmarxProject }),
      "موظف C-SMARX يجب أن يرى مشاريع نظامه",
    ).toBe(true);
  });

  test("التوريث للأسفل: موظف Classera يرى مشاريع C-SMARX", async () => {
    const classeraProject = projects.get("بوابة Classera التعليمية")!;
    const csmarxProject = projects.get("منصة C-SmarX لإدارة الأداء")!;
    const classeraEmp = users.get("ريم الدوسري")!;
    expect(await rpc("can_view_project_v3", { _user_id: classeraEmp, _project_id: classeraProject })).toBe(true);
    expect(await rpc("can_view_project_v3", { _user_id: classeraEmp, _project_id: csmarxProject })).toBe(true);
  });

  test("مدير C-SMARX لا يتجاوز حدود نظامه", async () => {
    const classeraProject = projects.get("بوابة Classera التعليمية")!;
    const mgr = users.get("خالد العتيبي")!;
    expect(await rpc("can_view_project_v3", { _user_id: mgr, _project_id: classeraProject })).toBe(false);
  });
});
