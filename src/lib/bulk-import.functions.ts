import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const RoleEnum = z.enum(["admin", "general_manager", "manager", "employee"]);

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("غير مصرح: هذه العملية للأدمن فقط");
}

async function assertManagerOrAbove(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "general_manager", "manager"]);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("غير مصرح");
}

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p + "!9";
}

// =============== Bulk import employees ===============
const EmployeeRowSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72).optional().nullable(),
  job_title: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  department: z.string().trim().max(120).optional().nullable(),
  hire_date: z.string().optional().nullable(),
  role: RoleEnum.optional().default("employee"),
  manager_email: z.string().trim().email().optional().nullable(),
});

export const bulkImportEmployees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ rows: z.array(EmployeeRowSchema).min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const results: Array<{ row: number; email: string; status: "created" | "exists" | "error"; message?: string; user_id?: string }> = [];
    const createdByEmail = new Map<string, string>();

    // Pre-load existing users by email
    const { data: existingProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email");
    const existingMap = new Map<string, string>();
    (existingProfiles ?? []).forEach((p) => {
      if (p.email) existingMap.set(p.email.toLowerCase(), p.id);
    });

    // Pass 1: create accounts
    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i];
      const emailLc = row.email.toLowerCase();
      try {
        if (existingMap.has(emailLc)) {
          createdByEmail.set(emailLc, existingMap.get(emailLc)!);
          results.push({ row: i + 2, email: row.email, status: "exists", user_id: existingMap.get(emailLc) });
          continue;
        }
        const pwd = row.password && row.password.length >= 8 ? row.password : randomPassword();
        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email: row.email,
          password: pwd,
          email_confirm: true,
          user_metadata: { full_name: row.full_name },
        });
        if (error || !created.user) throw new Error(error?.message ?? "فشل إنشاء الحساب");
        const newId = created.user.id;
        createdByEmail.set(emailLc, newId);

        await supabaseAdmin
          .from("profiles")
          .update({
            full_name: row.full_name,
            email: row.email,
            job_title: row.job_title ?? null,
            phone: row.phone ?? null,
            department: row.department ?? null,
            hire_date: row.hire_date || null,
            is_active: true,
          })
          .eq("id", newId);

        await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
        await supabaseAdmin.from("user_roles").insert({ user_id: newId, role: row.role });

        results.push({ row: i + 2, email: row.email, status: "created", user_id: newId });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ row: i + 2, email: row.email, status: "error", message: msg });
      }
    }

    // Pass 2: link managers by email
    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i];
      if (!row.manager_email) continue;
      const userId = createdByEmail.get(row.email.toLowerCase());
      const managerId = createdByEmail.get(row.manager_email.toLowerCase()) ?? existingMap.get(row.manager_email.toLowerCase());
      if (userId && managerId) {
        await supabaseAdmin.from("profiles").update({ manager_id: managerId }).eq("id", userId);
      }
    }

    return { results, total: data.rows.length };
  });

// =============== Bulk import projects ===============
const ProjectRowSchema = z.object({
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(2000).optional().nullable(),
  owner_email: z.string().trim().email().optional().nullable(),
  country: z.string().trim().max(120).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  contact_email: z.string().trim().email().max(255).optional().nullable(),
  contact_phone: z.string().trim().max(40).optional().nullable(),
  contract_number: z.string().trim().max(120).optional().nullable(),
  contract_value: z.coerce.number().optional().nullable(),
  currency: z.string().trim().max(10).optional().nullable(),
  contract_start_date: z.string().optional().nullable(),
  contract_end_date: z.string().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const bulkImportProjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ rows: z.array(ProjectRowSchema).min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertManagerOrAbove(context.userId);

    const { data: profs } = await supabaseAdmin.from("profiles").select("id, email");
    const emailToId = new Map<string, string>();
    (profs ?? []).forEach((p) => {
      if (p.email) emailToId.set(p.email.toLowerCase(), p.id);
    });

    const results: Array<{ row: number; name: string; status: "created" | "error"; message?: string; id?: string }> = [];

    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i];
      try {
        const ownerId = row.owner_email ? emailToId.get(row.owner_email.toLowerCase()) ?? null : null;
        const { data: inserted, error } = await supabaseAdmin
          .from("projects")
          .insert({
            name: row.name,
            description: row.description ?? null,
            owner_id: ownerId,
            country: row.country ?? null,
            address: row.address ?? null,
            contact_email: row.contact_email ?? null,
            contact_phone: row.contact_phone ?? null,
            contract_number: row.contract_number ?? null,
            contract_value: row.contract_value ?? null,
            currency: row.currency ?? null,
            contract_start_date: row.contract_start_date || null,
            contract_end_date: row.contract_end_date || null,
            notes: row.notes ?? null,
            created_by: context.userId,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        results.push({ row: i + 2, name: row.name, status: "created", id: inserted.id });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ row: i + 2, name: row.name, status: "error", message: msg });
      }
    }

    return { results, total: data.rows.length };
  });
