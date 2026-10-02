-- Support Tickets & SLA Engine Migration
-- Enterprise support ticketing, SLA monitoring, and technical communication thread

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  category text DEFAULT 'erp_core',
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  module_id uuid REFERENCES public.company_modules(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sla_hours integer NOT NULL DEFAULT 24,
  due_at timestamptz NOT NULL,
  first_responded_at timestamptz,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text NOT NULL,
  is_internal_note boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON public.support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_client ON public.support_tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_tickets_project ON public.support_tickets(project_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON public.support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_due_at ON public.support_tickets(due_at);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON public.ticket_messages(ticket_id);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "support_tickets_select" ON public.support_tickets;
CREATE POLICY "support_tickets_select"
ON public.support_tickets
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "support_tickets_insert" ON public.support_tickets;
CREATE POLICY "support_tickets_insert"
ON public.support_tickets
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "support_tickets_update" ON public.support_tickets;
CREATE POLICY "support_tickets_update"
ON public.support_tickets
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "ticket_messages_select" ON public.ticket_messages;
CREATE POLICY "ticket_messages_select"
ON public.ticket_messages
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "ticket_messages_insert" ON public.ticket_messages;
CREATE POLICY "ticket_messages_insert"
ON public.ticket_messages
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Seed Initial Realistic Support Tickets
DO $$
DECLARE
  v_admin_id uuid;
  v_p_erp uuid;
  v_p_lms uuid;
  v_p_sla uuid;
  v_c_mustaqbal uuid;
  v_c_nokhba uuid;
  v_c_ofoq uuid;
  v_m_fin uuid;
  v_m_vc uuid;
  v_m_sla uuid;
  v_t1_id uuid;
  v_t2_id uuid;
BEGIN
  SELECT id INTO v_admin_id FROM auth.users WHERE lower(trim(email)) = 'ctraining801@gmail.com' LIMIT 1;
  IF v_admin_id IS NULL THEN
    SELECT id INTO v_admin_id FROM auth.users LIMIT 1;
  END IF;

  SELECT id INTO v_p_erp FROM public.projects WHERE name LIKE '%مجموعة المستقبل%' LIMIT 1;
  SELECT id INTO v_p_lms FROM public.projects WHERE name LIKE '%مدارس النخبة%' LIMIT 1;
  SELECT id INTO v_p_sla FROM public.projects WHERE name LIKE '%الأفق%' LIMIT 1;

  SELECT id INTO v_c_mustaqbal FROM public.clients WHERE name LIKE '%المستقبل%' LIMIT 1;
  SELECT id INTO v_c_nokhba FROM public.clients WHERE name LIKE '%النخبة%' LIMIT 1;
  SELECT id INTO v_c_ofoq FROM public.clients WHERE name LIKE '%الأفق%' LIMIT 1;

  SELECT id INTO v_m_fin FROM public.company_modules WHERE code = 'ERP-FIN' LIMIT 1;
  SELECT id INTO v_m_vc FROM public.company_modules WHERE code = 'LMS-VC' LIMIT 1;
  SELECT id INTO v_m_sla FROM public.company_modules WHERE code = 'SLA-SUPPORT' LIMIT 1;

  -- 1. Urgent Ticket: ZATCA Integration Error
  IF NOT EXISTS (SELECT 1 FROM public.support_tickets WHERE ticket_number = 'TK-2026-001') THEN
    INSERT INTO public.support_tickets (
      ticket_number, title, description, status, priority, category,
      client_id, project_id, module_id, assigned_to, created_by,
      sla_hours, due_at, first_responded_at
    ) VALUES (
      'TK-2026-001',
      'فشل الربط اللحظي للفاتورة الإلكترونية مع منصة هيئة الزكاة (ZATCA)',
      'تظهر رسالة خطأ CSID Expired عند إصدار الفاتورة الضريبية في منفذ مبيعات فرع الدمام.',
      'in_progress', 'urgent', 'erp_financial',
      v_c_mustaqbal, v_p_erp, v_m_fin, v_admin_id, v_admin_id,
      4, now() + interval '3 hours', now() - interval '30 minutes'
    ) RETURNING id INTO v_t1_id;

    IF v_t1_id IS NOT NULL THEN
      INSERT INTO public.ticket_messages (ticket_id, sender_id, message, is_internal_note)
      VALUES (v_t1_id, v_admin_id, 'تم استلام البلاغ، وجارٍ فحص مفاتيح التشفير Cryptographic Stamp على خادم الـ API.', false);

      INSERT INTO public.ticket_messages (ticket_id, sender_id, message, is_internal_note)
      VALUES (v_t1_id, v_admin_id, 'ملاحظة فنية: تم تجديد شهادة الـ CSID عبر بيئة المطابقة بنجاح، بانتظار تأكيد العميل.', true);
    END IF;
  END IF;

  -- 2. High Priority Ticket: LMS Virtual Classrooms
  IF NOT EXISTS (SELECT 1 FROM public.support_tickets WHERE ticket_number = 'TK-2026-002') THEN
    INSERT INTO public.support_tickets (
      ticket_number, title, description, status, priority, category,
      client_id, project_id, module_id, assigned_to, created_by,
      sla_hours, due_at
    ) VALUES (
      'TK-2026-002',
      'ضغط متزامن على خوادم البث التفاعلي لامتحانات المرحلة الثانوية',
      'أفادت إدارة المدرسة ببطء تحميل أسئلة بنك الأسئلة أثناء دخول 350 طالب في نفس اللحظة.',
      'open', 'high', 'lms_virtual_class',
      v_c_nokhba, v_p_lms, v_m_vc, v_admin_id, v_admin_id,
      8, now() + interval '6 hours'
    );
  END IF;

  -- 3. Medium Priority Ticket: SLA Maintenance Resolved
  IF NOT EXISTS (SELECT 1 FROM public.support_tickets WHERE ticket_number = 'TK-2026-003') THEN
    INSERT INTO public.support_tickets (
      ticket_number, title, description, status, priority, category,
      client_id, project_id, module_id, assigned_to, created_by,
      sla_hours, due_at, first_responded_at, resolved_at, resolution_notes
    ) VALUES (
      'TK-2026-003',
      'فحص ومزامنة النسخ الاحتياطي السحابي لخوادم إدارة المستودعات',
      'طلب العميل التأكد من اكتمال دورة النسخ الاحتياطي اليومية ومطابقتها لاتفاقية الدعم السنوي.',
      'resolved', 'medium', 'sla_maintenance',
      v_c_ofoq, v_p_sla, v_m_sla, v_admin_id, v_admin_id,
      24, now() - interval '2 hours', now() - interval '10 hours', now() - interval '1 hour',
      'تم فحص كافة قواعد البيانات وتفعيل النسخ التلقائي المشفر بنجاح واختبار استرجاع نقطة فحص.'
    );
  END IF;

END $$;
