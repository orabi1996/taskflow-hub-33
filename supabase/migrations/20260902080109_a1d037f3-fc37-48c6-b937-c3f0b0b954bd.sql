-- Extensions needed for scheduled HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Default automation rules (idempotent by name)
INSERT INTO public.automation_rules (name, description, trigger_type, trigger_config, action_type, action_config, is_active)
SELECT 'تنبيه المهام المتأخرة', 'يُنبّه الموظف عند تجاوز موعد انتهاء المهمة', 'task_overdue',
       '{"cooldown_hours": 24}'::jsonb, 'notify_user', '{}'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM public.automation_rules WHERE name = 'تنبيه المهام المتأخرة');

INSERT INTO public.automation_rules (name, description, trigger_type, trigger_config, action_type, action_config, is_active)
SELECT 'تذكير قبل موعد المهمة', 'تذكير الموظف قبل 24 ساعة من موعد انتهاء المهمة', 'task_due_soon',
       '{"hours": 24, "cooldown_hours": 24}'::jsonb, 'notify_user', '{}'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM public.automation_rules WHERE name = 'تذكير قبل موعد المهمة');

INSERT INTO public.automation_rules (name, description, trigger_type, trigger_config, action_type, action_config, is_active)
SELECT 'تنبيه انتهاء العقود', 'تنبيه الإدارة قبل 30 يومًا من انتهاء عقد المشروع', 'contract_expiring',
       '{"days": 30, "cooldown_hours": 168}'::jsonb, 'notify_admins', '{}'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM public.automation_rules WHERE name = 'تنبيه انتهاء العقود');

-- Hourly scheduled run of the automation engine
DO $$
BEGIN
  PERFORM cron.unschedule('pulse-automation-tick');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'pulse-automation-tick',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://taskflow-hub-33.lovable.app/api/public/hooks/automation-tick',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);