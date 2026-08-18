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

// ====== Create employee (direct account with temp password) ======
const CreateEmployeeSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  full_name: z.string().trim().min(1).max(120),
  job_title: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  department: z.string().trim().max(120).optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  job_position_id: z.string().uuid().optional().nullable(),
  hire_date: z.string().optional().nullable(), // YYYY-MM-DD
  manager_id: z.string().uuid().optional().nullable(),
  role: RoleEnum,
});

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateEmployeeSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw new Error(error.message);
    const newId = created.user!.id;

    // Update profile (handle_new_user trigger created the basic row)
    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        email: data.email,
        job_title: data.job_title ?? null,
        phone: data.phone ?? null,
        department: data.department ?? null,
        department_id: data.department_id ?? null,
        job_position_id: data.job_position_id ?? null,
        hire_date: data.hire_date || null,
        manager_id: data.manager_id ?? null,
        is_active: true,
      })
      .eq("id", newId);
    if (pErr) throw new Error(pErr.message);

    // Replace default role
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newId, role: data.role });
    if (rErr) throw new Error(rErr.message);

    return { ok: true, userId: newId };
  });

// ====== Invite employee by email ======
const InviteEmployeeSchema = CreateEmployeeSchema.omit({ password: true }).extend({
  redirect_to: z.string().url().optional(),
});

export const inviteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InviteEmployeeSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
      {
        data: { full_name: data.full_name },
        redirectTo: data.redirect_to,
      },
    );
    if (error) throw new Error(error.message);
    const newId = invited.user!.id;

    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        email: data.email,
        job_title: data.job_title ?? null,
        phone: data.phone ?? null,
        department: data.department ?? null,
        department_id: data.department_id ?? null,
        job_position_id: data.job_position_id ?? null,
        hire_date: data.hire_date || null,
        manager_id: data.manager_id ?? null,
        is_active: true,
      })
      .eq("id", newId);
    if (pErr) throw new Error(pErr.message);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newId, role: data.role });
    if (rErr) throw new Error(rErr.message);

    return { ok: true, userId: newId };
  });

// ====== Reset password ======
export const resetEmployeePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid(), new_password: z.string().min(8).max(72) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.new_password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ====== Toggle active ======
export const setEmployeeActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid(), is_active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    // Soft-disable in profiles + ban in auth
    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({ is_active: data.is_active })
      .eq("id", data.user_id);
    if (pErr) throw new Error(pErr.message);

    const { error: aErr } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: data.is_active ? "none" : "876000h", // ~100 years
    });
    if (aErr) throw new Error(aErr.message);
    return { ok: true };
  });

// ====== Delete employee ======
export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.user_id === context.userId) {
      throw new Error("لا يمكن حذف حسابك الحالي");
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
