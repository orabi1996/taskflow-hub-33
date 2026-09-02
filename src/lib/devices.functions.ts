// Trusted devices: admin-wide listing and revocation.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("غير مصرح: هذه العملية للأدمن فقط");
  return supabaseAdmin;
}

export interface TrustedDeviceRow {
  id: string;
  user_id: string;
  label: string | null;
  user_agent: string | null;
  ip: string | null;
  last_seen_at: string;
  created_at: string;
  full_name: string;
  email: string | null;
}

export const listAllTrustedDevices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TrustedDeviceRow[]> => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("trusted_devices")
      .select("id, user_id, label, user_agent, ip, last_seen_at, created_at")
      .order("last_seen_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const ids = [...new Set((data ?? []).map((d) => d.user_id))];
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ids)
      : { data: [] as { id: string; full_name: string; email: string | null }[] };
    const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    return (data ?? []).map((d) => ({
      ...d,
      full_name: pMap.get(d.user_id)?.full_name ?? "—",
      email: pMap.get(d.user_id)?.email ?? null,
    }));
  });

export const revokeTrustedDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { data: row } = await supabaseAdmin
      .from("trusted_devices")
      .select("user_id, label")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabaseAdmin.from("trusted_devices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      event_type: "device.revoked",
      severity: "warning",
      resource_type: "trusted_devices",
      resource_id: data.id,
      old_value: row ?? null,
    });
    return { ok: true };
  });
