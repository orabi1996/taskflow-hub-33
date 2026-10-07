import { supabase } from "@/integrations/supabase/client";

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  platform: "slack" | "discord" | "teams" | "whatsapp" | "custom";
  events: string[];
  is_active: boolean;
  last_triggered_at?: string | null;
  created_at: string;
}

export interface OrganizationSettings {
  id?: string;
  company_name: string;
  brand_tagline: string;
  commercial_registry: string;
  support_email: string;
  support_phone: string;
  currency: string;
  timezone: string;
  address: string;
  report_footer: string;
  official_seal_text: string;
  working_hours: string;
  webhooks: WebhookConfig[];
  updated_at?: string;
}

export const DEFAULT_ORG_SETTINGS: OrganizationSettings = {
  company_name: "منظومة CRM-X Enterprise",
  brand_tagline: "People · Pipelines · Possibilities",
  commercial_registry: "CR-4030198274",
  support_email: "support@crm-x.internal",
  support_phone: "+966 11 800 2769",
  currency: "SAR",
  timezone: "Asia/Riyadh",
  address: "الرياض - طريق الملك فهد - برج الابتكار السحابي",
  report_footer: "وثيقة رسمية صادرة عن منظومة CRM-X Enterprise. سرية ومخصصة للاستخدام المصرح به.",
  official_seal_text: "CRM-X QA معتمد",
  working_hours: "الأحد - الخميس (08:00 ص - 05:00 م)",
  webhooks: [
    {
      id: "wh-1",
      name: "قناة بلاغات الدعم العاجلة (Slack)",
      url: "https://example.com/api/webhooks/slack-channel",
      platform: "slack",
      events: ["ticket_sla_response_breach", "ticket_sla_resolve_breach"],
      is_active: true,
      last_triggered_at: null,
      created_at: new Date().toISOString(),
    },
    {
      id: "wh-2",
      name: "تنبيهات العقود وتجديد التراخيص (Discord)",
      url: "https://example.com/api/webhooks/discord-channel",
      platform: "discord",
      events: ["contract_expiring"],
      is_active: true,
      last_triggered_at: null,
      created_at: new Date().toISOString(),
    },
  ],
};

const LS_KEY = "crm_x_organization_settings_v1";

/**
 * Loads organization settings with fallback to localStorage and defaults.
 */
export async function getOrganizationSettings(): Promise<OrganizationSettings> {
  // 1. Try reading from database if available
  try {
    const { data, error } = await supabase
      // This optional table is not included in the generated database schema.
      .from("organization_settings" as never)
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .overrideTypes<OrganizationSettings | null, { merge: false }>();

    if (!error && data && data.company_name) {
      return {
        id: data.id,
        company_name: data.company_name || DEFAULT_ORG_SETTINGS.company_name,
        brand_tagline: data.brand_tagline ?? DEFAULT_ORG_SETTINGS.brand_tagline,
        commercial_registry: data.commercial_registry ?? DEFAULT_ORG_SETTINGS.commercial_registry,
        support_email: data.support_email ?? DEFAULT_ORG_SETTINGS.support_email,
        support_phone: data.support_phone ?? DEFAULT_ORG_SETTINGS.support_phone,
        currency: data.currency || DEFAULT_ORG_SETTINGS.currency,
        timezone: data.timezone || DEFAULT_ORG_SETTINGS.timezone,
        address: data.address ?? DEFAULT_ORG_SETTINGS.address,
        report_footer: data.report_footer ?? DEFAULT_ORG_SETTINGS.report_footer,
        official_seal_text: data.official_seal_text ?? DEFAULT_ORG_SETTINGS.official_seal_text,
        working_hours: data.working_hours ?? DEFAULT_ORG_SETTINGS.working_hours,
        webhooks: Array.isArray(data.webhooks)
          ? (data.webhooks as unknown as WebhookConfig[])
          : DEFAULT_ORG_SETTINGS.webhooks,
        updated_at: data.updated_at,
      };
    }
  } catch {
    // Database table might not be provisioned yet; fallback to local storage
  }

  // 2. Fallback to localStorage
  if (typeof window !== "undefined") {
    try {
      const local = window.localStorage.getItem(LS_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        return {
          ...DEFAULT_ORG_SETTINGS,
          ...parsed,
          webhooks: Array.isArray(parsed.webhooks) ? parsed.webhooks : DEFAULT_ORG_SETTINGS.webhooks,
        };
      }
    } catch {
      // JSON parse or storage failure
    }
  }

  return DEFAULT_ORG_SETTINGS;
}

/**
 * Saves organization settings to database (if available) and localStorage.
 */
export async function saveOrganizationSettings(
  settings: OrganizationSettings
): Promise<{ success: boolean; error?: string }> {
  const payload: OrganizationSettings = {
    ...settings,
    updated_at: new Date().toISOString(),
  };

  // Always persist locally
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(payload));
    } catch (err: any) {
      console.warn("[OrgSettings] Local storage persist warning:", err);
    }
  }

  // Attempt database upsert
  try {
    const { error } = await supabase
      .from("organization_settings" as never)
      .upsert(payload as never, { onConflict: "id" });

    if (error) {
      console.warn("[OrgSettings] Supabase save returned warning:", error.message);
    }
  } catch (err: any) {
    // Gracefully handle if table does not exist
    console.warn("[OrgSettings] Supabase save error:", err?.message || err);
  }

  return { success: true };
}

/**
 * Triggers a test ping to a configured webhook.
 */
export async function sendWebhookTestPing(webhook: WebhookConfig): Promise<{ success: boolean; message: string }> {
  if (!webhook.url || !webhook.url.startsWith("http")) {
    return { success: false, message: "رابط Webhook غير صالح" };
  }

  const payload = {
    text: `🔔 [CRM-X Enterprise Test Ping]\nتم إرسال هذا الإشعار التجريبي بنجاح من منظومة CRM-X لقناة: ${webhook.name}`,
    content: `🔔 **CRM-X Enterprise Test**: اختبار اتصال ناجح لقناة ${webhook.name}`,
    timestamp: new Date().toISOString(),
    event: "test_ping",
    organization: DEFAULT_ORG_SETTINGS.company_name,
  };

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      mode: "no-cors", // Allow sending to third party webhook endpoints without CORS block
    });

    return {
      success: true,
      message: `تم إرسال إشعار الاختبار بنجاح لقناة ${webhook.name}`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "فشل الاتصال برابط الـ Webhook",
    };
  }
}
