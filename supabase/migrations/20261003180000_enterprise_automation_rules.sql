-- Migration: Add Enterprise Automation Rules for SLA Monitoring and Daily Work Journal Reminders

INSERT INTO public.automation_rules (name, description, trigger_type, trigger_config, action_type, action_config, is_active)
SELECT 'خرق اتفاقية SLA للاستجابة', 'تنبيه الإدارة عند تجاوز تذكرة الدعم الفني مهلة أول استجابة محددة بالاتفاقية', 'ticket_sla_response_breach',
       '{"cooldown_hours": 12}'::jsonb, 'notify_admins', '{}'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM public.automation_rules WHERE name = 'خرق اتفاقية SLA للاستجابة');

INSERT INTO public.automation_rules (name, description, trigger_type, trigger_config, action_type, action_config, is_active)
SELECT 'خرق اتفاقية SLA لحل التذكرة', 'تنبيه الإدارة والمدراء عند تجاوز التذكرة المهلة القصوى للحل النهائي دون إغلاق', 'ticket_sla_resolve_breach',
       '{"cooldown_hours": 12}'::jsonb, 'notify_admins', '{}'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM public.automation_rules WHERE name = 'خرق اتفاقية SLA لحل التذكرة');

INSERT INTO public.automation_rules (name, description, trigger_type, trigger_config, action_type, action_config, is_active)
SELECT 'تحذير اقتراب انتهاء مهلة حل التذكرة SLA', 'تحذير المسؤول والمدير قبل ساعتين من موعد خرق اتفاقية حل التذكرة', 'ticket_sla_warning',
       '{"hours": 2, "cooldown_hours": 4}'::jsonb, 'notify_manager', '{}'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM public.automation_rules WHERE name = 'تحذير اقتراب انتهاء مهلة حل التذكرة SLA');

INSERT INTO public.automation_rules (name, description, trigger_type, trigger_config, action_type, action_config, is_active)
SELECT 'تذكير برفع يومية العمل للاعتماد', 'تذكير الموظفين الذين أنجزوا مهام اليوم بإرسال يومية العمل للاعتماد من مديرهم', 'daily_journal_missing',
       '{"cooldown_hours": 12}'::jsonb, 'notify_user', '{}'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM public.automation_rules WHERE name = 'تذكير برفع يومية العمل للاعتماد');
