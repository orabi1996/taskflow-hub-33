-- Migration: 20261004040000_organization_settings_and_webhooks.sql
-- Description: Creates organization settings and webhook integrations table for CRM-X Enterprise

CREATE TABLE IF NOT EXISTS public.organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'منظومة CRM-X Enterprise',
  brand_tagline TEXT DEFAULT 'People · Pipelines · Possibilities',
  commercial_registry TEXT DEFAULT 'CR-4030198274',
  support_email TEXT DEFAULT 'support@crm-x.internal',
  support_phone TEXT DEFAULT '+966 11 800 2769',
  currency TEXT DEFAULT 'SAR',
  timezone TEXT DEFAULT 'Asia/Riyadh',
  address TEXT DEFAULT 'الرياض - طريق الملك فهد - برج الابتكار السحابي',
  report_footer TEXT DEFAULT 'وثيقة رسمية صادرة عن منظومة CRM-X Enterprise. سرية ومخصصة للاستخدام المصرح به.',
  official_seal_text TEXT DEFAULT 'CRM-X QA معتمد',
  working_hours TEXT DEFAULT 'الأحد - الخميس (08:00 ص - 05:00 م)',
  webhooks JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

-- 1. Read access for all authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'organization_settings' 
      AND policyname = 'Authenticated users can view organization settings'
  ) THEN
    CREATE POLICY "Authenticated users can view organization settings"
      ON public.organization_settings
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- 2. Modify access for admins and managers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'organization_settings' 
      AND policyname = 'Admins and managers can manage organization settings'
  ) THEN
    CREATE POLICY "Admins and managers can manage organization settings"
      ON public.organization_settings
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'manager')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'manager')
        )
      );
  END IF;
END $$;

-- 3. Seed default organization profile row if table is empty
INSERT INTO public.organization_settings (
  company_name,
  brand_tagline,
  commercial_registry,
  support_email,
  support_phone,
  currency,
  timezone,
  address,
  report_footer,
  official_seal_text,
  working_hours,
  webhooks
)
SELECT
  'منظومة CRM-X Enterprise',
  'People · Pipelines · Possibilities',
  'CR-4030198274',
  'support@crm-x.internal',
  '+966 11 800 2769',
  'SAR',
  'Asia/Riyadh',
  'الرياض - طريق الملك فهد - برج الابتكار السحابي',
  'وثيقة رسمية صادرة عن منظومة CRM-X Enterprise. سرية ومخصصة للاستخدام المصرح به.',
  'CRM-X QA معتمد',
  'الأحد - الخميس (08:00 ص - 05:00 م)',
  '[
    {
      "id": "wh-1",
      "name": "قناة بلاغات الدعم العاجلة (Slack)",
      "url": "https://example.com/api/webhooks/slack-channel",
      "platform": "slack",
      "events": ["ticket_sla_response_breach", "ticket_sla_resolve_breach"],
      "is_active": true,
      "created_at": "2026-10-04T00:00:00.000Z"
    },
    {
      "id": "wh-2",
      "name": "تنبيهات العقود وتجديد التراخيص (Discord)",
      "url": "https://example.com/api/webhooks/discord-channel",
      "platform": "discord",
      "events": ["contract_expiring"],
      "is_active": true,
      "created_at": "2026-10-04T00:00:00.000Z"
    }
  ]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_settings LIMIT 1
);
