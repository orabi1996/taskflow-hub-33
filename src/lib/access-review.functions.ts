// Periodic privileged-access review: who holds admin/GM/manager roles and since when.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PRIVILEGED = ["admin", "general_manager", "manager"] as const;

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("غير مصرح: هذه الشاشة للأدمن فقط");
  return supabaseAdmin;
}

export interface PrivilegedUserRow {
  user_id: string;
  role: string;
  granted_at: string;
  full_name: string;
  email: string | null;
  job_title: string | null;
  department: string | null;
  is_active: boolean;
  last_sign_in_at: string | null;
  days_since_grant: number;
}

export const listPrivilegedAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PrivilegedUserRow[]> => {
    const supabaseAdmin = await assertAdmin(context.userId);

    const { data: roleRows, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role, created_at")
      .in("role", PRIVILEGED as unknown as string[])
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = [...new Set((roleRows ?? []).map((r) => r.user_id))];
    if (ids.length === 0) return [];

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, job_title, department, is_active")
      .in("id", ids);
    const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    // last sign-in per user (best effort)
    const signIn = new Map<string, string | null>();
    try {
      const { data: authList } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      for (const u of authList?.users ?? []) signIn.set(u.id, u.last_sign_in_at ?? null);
    } catch {
      /* ignore */
    }

    const now = Date.now();
    return (roleRows ?? []).map((r) => {
      const p = pMap.get(r.user_id);
      return {
        user_id: r.user_id,
        role: r.role as string,
        granted_at: r.created_at,
        full_name: p?.full_name ?? "—",
        email: p?.email ?? null,
        job_title: p?.job_title ?? null,
        department: p?.department ?? null,
        is_active: p?.is_active ?? true,
        last_sign_in_at: signIn.get(r.user_id) ?? null,
        days_since_grant: Math.floor((now - new Date(r.created_at).getTime()) / 86400000),
      };
    });
  });

const RevokeSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(PRIVILEGED),
});

export const revokePrivilegedRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RevokeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    if (data.user_id === context.userId && data.role === "admin") {
      throw new Error("لا يمكنك سحب دور الأدمن من حسابك الحالي");
    }
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", data.role);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      event_type: "access_review.role_revoked",
      severity: "critical",
      resource_type: "user_roles",
      resource_id: data.user_id,
      old_value: { role: data.role },
      metadata: { source: "access-review" },
    });
    return { ok: true };
  });

const AckSchema = z.object({
  reviewed_count: z.number().int().min(0),
  note: z.string().max(500).optional(),
});

export const acknowledgeAccessReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AckSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      event_type: "access_review.completed",
      severity: "info",
      resource_type: "user_roles",
      new_value: { reviewed_count: data.reviewed_count, note: data.note ?? null },
    });
    return { ok: true, at: new Date().toISOString() };
  });

export const getLastAccessReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("audit_logs")
      .select("created_at, actor_email, new_value")
      .eq("event_type", "access_review.completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  });
