/**
 * Server-only delivery layer for notifications (web push + email).
 * Used by automation hooks and by server functions. Never import from components.
 */
import { buildPushPayload } from "@block65/webcrypto-web-push";

export type DeliverPayload = {
  title: string;
  body: string;
  link?: string | null;
  tag?: string | null;
  type?: string | null;
};

type Sb = {
  from: (t: string) => any;
};

function vapid() {
  const subject = process.env["VAPID_SUBJECT"];
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  if (!subject || !publicKey || !privateKey) return null;
  return { subject, publicKey, privateKey };
}

function inQuietHours(prefs: { quiet_hours_start: number | null; quiet_hours_end: number | null }) {
  const s = prefs.quiet_hours_start;
  const e = prefs.quiet_hours_end;
  if (s == null || e == null || s === e) return false;
  // Riyadh time (UTC+3)
  const hour = new Date(Date.now() + 3 * 3600_000).getUTCHours();
  return s < e ? hour >= s && hour < e : hour >= s || hour < e;
}

async function logDelivery(
  sb: Sb,
  rows: Array<{ user_id: string; channel: string; status: string; error_message?: string | null }>
) {
  if (rows.length === 0) return;
  await sb.from("notification_delivery_log").insert(rows);
}

/** Send a web push message to every registered device of the given users. */
export async function sendPushToUsers(sb: Sb, userIds: string[], payload: DeliverPayload) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return { sent: 0, failed: 0, skipped: 0 };
  const keys = vapid();
  if (!keys) {
    await logDelivery(
      sb,
      ids.map((u) => ({ user_id: u, channel: "push", status: "skipped", error_message: "VAPID غير مُهيأ" }))
    );
    return { sent: 0, failed: 0, skipped: ids.length };
  }

  const { data: prefsRows } = await sb
    .from("notification_prefs")
    .select("user_id, push_enabled, quiet_hours_start, quiet_hours_end, muted_types")
    .in("user_id", ids);
  const prefsMap = new Map<string, any>(((prefsRows ?? []) as any[]).map((p) => [p.user_id, p]));

  const eligible = ids.filter((u) => {
    const p = prefsMap.get(u);
    if (!p) return true; // default: enabled
    if (!p.push_enabled) return false;
    if (payload.type && Array.isArray(p.muted_types) && p.muted_types.includes(payload.type)) return false;
    if (inQuietHours(p)) return false;
    return true;
  });
  const skipped = ids.length - eligible.length;
  if (eligible.length === 0) return { sent: 0, failed: 0, skipped };

  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", eligible);

  let sent = 0;
  let failed = 0;
  const logs: Array<{ user_id: string; channel: string; status: string; error_message?: string | null }> = [];
  const stale: string[] = [];

  for (const sub of ((subs ?? []) as any[])) {
    try {
      const request = await buildPushPayload(
        {
          data: {
            title: payload.title,
            body: payload.body,
            link: payload.link ?? "/dashboard",
            tag: payload.tag ?? undefined,
          },
          options: { urgency: "normal", ttl: 60 * 60 * 24 },
        } as any,
        {
          endpoint: sub.endpoint,
          expirationTime: null,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        keys
      );

      const res = await fetch(sub.endpoint, request as any);
      if (res.ok || res.status === 201 || res.status === 202) {
        sent++;
        logs.push({ user_id: sub.user_id, channel: "push", status: "sent" });
      } else if (res.status === 404 || res.status === 410) {
        stale.push(sub.id);
        failed++;
        logs.push({ user_id: sub.user_id, channel: "push", status: "expired", error_message: `HTTP ${res.status}` });
      } else {
        failed++;
        logs.push({
          user_id: sub.user_id,
          channel: "push",
          status: "failed",
          error_message: `HTTP ${res.status}`,
        });
      }
    } catch (e) {
      failed++;
      logs.push({
        user_id: sub.user_id,
        channel: "push",
        status: "failed",
        error_message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (stale.length > 0) {
    await sb.from("push_subscriptions").delete().in("id", stale);
  }
  await logDelivery(sb, logs);
  return { sent, failed, skipped };
}

/**
 * Send an email through an HTTP email provider (Resend-compatible).
 * SMTP over raw TCP is unavailable in the serverless runtime, so an HTTP API key is required.
 */
export async function sendEmailToUsers(sb: Sb, userIds: string[], payload: DeliverPayload) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return { sent: 0, failed: 0, skipped: 0 };

  const apiKey = process.env["RESEND_API_KEY"];

  const { data: prefsRows } = await sb
    .from("notification_prefs")
    .select("user_id, email_enabled, muted_types")
    .in("user_id", ids);
  const prefsMap = new Map<string, any>(((prefsRows ?? []) as any[]).map((p) => [p.user_id, p]));

  const eligible = ids.filter((u) => {
    const p = prefsMap.get(u);
    if (!p) return true;
    if (!p.email_enabled) return false;
    if (payload.type && Array.isArray(p.muted_types) && p.muted_types.includes(payload.type)) return false;
    return true;
  });
  let skipped = ids.length - eligible.length;
  if (eligible.length === 0) return { sent: 0, failed: 0, skipped };

  const { data: profiles } = await sb.from("profiles").select("id, email, full_name").in("id", eligible);
  const recipients = ((profiles ?? []) as any[]).filter((p) => p.email);

  if (!apiKey) {
    await logDelivery(
      sb,
      recipients.map((p) => ({
        user_id: p.id,
        channel: "email",
        status: "skipped",
        error_message: "لا يوجد مزود بريد عبر HTTP (RESEND_API_KEY)",
      }))
    );
    return { sent: 0, failed: 0, skipped: skipped + recipients.length };
  }

  const { data: smtp } = await sb
    .from("smtp_settings")
    .select("from_email, from_name")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  const from = smtp?.from_email
    ? `${smtp.from_name || "Pulse"} <${smtp.from_email}>`
    : "Pulse <onboarding@resend.dev>";

  let sent = 0;
  let failed = 0;
  const logs: Array<{ user_id: string; channel: string; status: string; error_message?: string | null }> = [];

  for (const p of recipients) {
    const html = renderEmail(payload, p.full_name ?? "");
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [p.email], subject: payload.title, html }),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (res.ok) {
        sent++;
        logs.push({ user_id: p.id, channel: "email", status: "sent" });
        await sb.from("email_send_log").insert({
          message_id: json?.id ?? null,
          template_name: payload.type ?? "notification",
          recipient_email: p.email,
          subject: payload.title,
          status: "sent",
        });
      } else {
        failed++;
        const msg = json?.message ?? `HTTP ${res.status}`;
        logs.push({ user_id: p.id, channel: "email", status: "failed", error_message: msg });
        await sb.from("email_send_log").insert({
          template_name: payload.type ?? "notification",
          recipient_email: p.email,
          subject: payload.title,
          status: "failed",
          error_message: msg,
        });
      }
    } catch (e) {
      failed++;
      logs.push({
        user_id: p.id,
        channel: "email",
        status: "failed",
        error_message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  await logDelivery(sb, logs);
  return { sent, failed, skipped };
}

function renderEmail(payload: DeliverPayload, name: string) {
  const link = payload.link ?? "/dashboard";
  const url = link.startsWith("http") ? link : `https://taskflow-hub-33.lovable.app${link}`;
  return `<!doctype html><html dir="rtl" lang="ar"><body style="margin:0;background:#f4f5fb;font-family:Segoe UI,Tahoma,Arial,sans-serif;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px;border:1px solid #e3e3ec">
    <p style="margin:0 0 8px;color:#5b5b6b;font-size:13px">Pulse — منصة Classera</p>
    <h1 style="margin:0 0 12px;font-size:20px;color:#1b1b22">${escapeHtml(payload.title)}</h1>
    ${name ? `<p style="margin:0 0 8px;color:#44444f">مرحباً ${escapeHtml(name)}،</p>` : ""}
    <p style="margin:0 0 20px;color:#44444f;line-height:1.7">${escapeHtml(payload.body)}</p>
    <a href="${url}" style="display:inline-block;background:#1a56db;color:#fff;text-decoration:none;padding:11px 22px;border-radius:100px;font-size:14px">فتح النظام</a>
    <p style="margin:24px 0 0;color:#8a8a99;font-size:12px">يمكنك تعديل تفضيلات الإشعارات من صفحة الإعدادات.</p>
  </div></body></html>`;
}

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}
