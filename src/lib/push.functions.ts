import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Public VAPID key needed by the browser to subscribe. */
export const getPushPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: process.env["VAPID_PUBLIC_KEY"] ?? null };
});

const SubSchema = z.object({
  endpoint: z.string().url().max(2000),
  p256dh: z.string().min(10).max(500),
  auth: z.string().min(5).max(500),
  user_agent: z.string().max(400).optional().nullable(),
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SubSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.user_agent ?? null,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ endpoint: z.string().url().max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("push_subscriptions")
      .select("id, endpoint, user_agent, created_at, last_used_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMyNotificationPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notification_prefs")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (
      data ?? {
        user_id: context.userId,
        push_enabled: true,
        email_enabled: true,
        in_app_enabled: true,
        quiet_hours_start: null,
        quiet_hours_end: null,
        muted_types: [] as string[],
      }
    );
  });

const PrefsSchema = z.object({
  push_enabled: z.boolean(),
  email_enabled: z.boolean(),
  in_app_enabled: z.boolean(),
  quiet_hours_start: z.number().int().min(0).max(23).nullable(),
  quiet_hours_end: z.number().int().min(0).max(23).nullable(),
  muted_types: z.array(z.string().max(50)).max(20),
});

export const updateMyNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PrefsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notification_prefs")
      .upsert({ ...data, user_id: context.userId }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Send a test notification (push + email) to the current user. */
export const sendTestNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendPushToUsers, sendEmailToUsers } = await import("./notify.server");
    const payload = {
      title: "إشعار تجريبي من Pulse",
      body: "إذا وصلك هذا الإشعار فإن قناة الإشعارات تعمل بنجاح.",
      link: "/settings/notifications",
      type: "test",
    };
    const push = await sendPushToUsers(supabaseAdmin as never, [context.userId], payload);
    const email = await sendEmailToUsers(supabaseAdmin as never, [context.userId], payload);
    await supabaseAdmin.from("notifications").insert({
      user_id: context.userId,
      type: "test",
      title: payload.title,
      body: payload.body,
      link: payload.link,
    } as never);
    return { push, email };
  });
