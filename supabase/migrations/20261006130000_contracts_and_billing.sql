-- Contracts & Invoicing Engine Migration
-- Enterprise contract milestones, payment schedule, and tax invoices for ERP/LMS projects

CREATE TABLE IF NOT EXISTS public.project_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number text NOT NULL UNIQUE,
  title text NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  total_amount numeric(15, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'terminated')),
  terms text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contract_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  contract_id uuid REFERENCES public.project_contracts(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  milestone_title text NOT NULL,
  amount numeric(15, 2) NOT NULL DEFAULT 0,
  tax_amount numeric(15, 2) NOT NULL DEFAULT 0,
  total_with_tax numeric(15, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  due_date date NOT NULL,
  paid_at timestamptz,
  payment_method text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contracts_project ON public.project_contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_contracts_client ON public.project_contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contract ON public.contract_invoices(contract_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.contract_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.contract_invoices(due_date);

-- Enable RLS
ALTER TABLE public.project_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_invoices ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "project_contracts_select" ON public.project_contracts;
CREATE POLICY "project_contracts_select" ON public.project_contracts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "project_contracts_all" ON public.project_contracts;
CREATE POLICY "project_contracts_all" ON public.project_contracts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "contract_invoices_select" ON public.contract_invoices;
CREATE POLICY "contract_invoices_select" ON public.contract_invoices FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "contract_invoices_all" ON public.contract_invoices;
CREATE POLICY "contract_invoices_all" ON public.contract_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable Realtime
ALTER TABLE public.project_contracts REPLICA IDENTITY FULL;
ALTER TABLE public.contract_invoices REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'project_contracts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_contracts;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'contract_invoices') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contract_invoices;
  END IF;
END $$;

-- Seed enterprise contracts and invoices linked to existing projects
DO $$
DECLARE
  p_csmarx uuid;
  p_classera uuid;
  c_csmarx uuid;
  c_classera uuid;
  cnt_csmarx uuid;
  cnt_classera uuid;
BEGIN
  SELECT id INTO p_csmarx FROM public.projects WHERE name LIKE '%C-SMARX%' LIMIT 1;
  SELECT id INTO p_classera FROM public.projects WHERE name LIKE '%Classera%' LIMIT 1;
  SELECT id INTO c_csmarx FROM public.clients WHERE name LIKE '%مجموعة الفنار%' OR company LIKE '%الفنار%' LIMIT 1;
  SELECT id INTO c_classera FROM public.clients WHERE name LIKE '%شركة تطوير%' OR company LIKE '%تطوير%' LIMIT 1;

  IF p_csmarx IS NOT NULL THEN
    INSERT INTO public.project_contracts (
      contract_number, title, project_id, client_id, total_amount, currency, start_date, end_date, status, terms
    ) VALUES (
      'CNT-2026-001',
      'عقد تطبيق ورخصة منظومة C-SMARX ERP للمجموعة الصناعية',
      p_csmarx,
      c_csmarx,
      350000.00,
      'SAR',
      CURRENT_DATE - INTERVAL '60 days',
      CURRENT_DATE + INTERVAL '305 days',
      'active',
      'يشمل تطبيق موديولات المالية، المشتريات، المستودعات، والموارد البشرية مع دعم فني 24/7 لمدة عام.'
    ) RETURNING id INTO cnt_csmarx;

    -- Invoices for C-SMARX
    INSERT INTO public.contract_invoices (
      invoice_number, contract_id, project_id, client_id, milestone_title, amount, tax_amount, total_with_tax, currency, status, due_date, paid_at, payment_method, notes
    ) VALUES 
    (
      'INV-2026-0101',
      cnt_csmarx,
      p_csmarx,
      c_csmarx,
      'الدفعة الأولى: مقدم توقيع العقد وبدء دراسة الفجوات (Gap Analysis)',
      105000.00,
      15750.00,
      120750.00,
      'SAR',
      'paid',
      CURRENT_DATE - INTERVAL '45 days',
      CURRENT_DATE - INTERVAL '42 days',
      'تحويل بنكي مصرف الراجحي',
      'تم اعتماد التحويل وتأكيد السداد في حساب الشركة.'
    ),
    (
      'INV-2026-0102',
      cnt_csmarx,
      p_csmarx,
      c_csmarx,
      'الدفعة الثانية: اعتماد التصميم واختبارات قبول المستخدم (UAT)',
      140000.00,
      21000.00,
      161000.00,
      'SAR',
      'pending',
      CURRENT_DATE + INTERVAL '25 days',
      NULL,
      NULL,
      'مستحقة فور اجتياز سيناريوهات اختبارات UAT في موديول المالية.'
    ),
    (
      'INV-2026-0103',
      cnt_csmarx,
      p_csmarx,
      c_csmarx,
      'الدفعة الختامية: الإطلاق الحي للإنتاج (Go-Live) وبدء الضمان',
      105000.00,
      15750.00,
      120750.00,
      'SAR',
      'pending',
      CURRENT_DATE + INTERVAL '90 days',
      NULL,
      NULL,
      'مستحقة بعد 30 يوماً من استقرار الإطلاق الحي.'
    );
  END IF;

  IF p_classera IS NOT NULL THEN
    INSERT INTO public.project_contracts (
      contract_number, title, project_id, client_id, total_amount, currency, start_date, end_date, status, terms
    ) VALUES (
      'CNT-2026-002',
      'اتفاقية تشغيل ورخص منصة التعلم الذكي Classera LMS للمدارس',
      p_classera,
      c_classera,
      240000.00,
      'SAR',
      CURRENT_DATE - INTERVAL '90 days',
      CURRENT_DATE + INTERVAL '275 days',
      'active',
      'رخص استيعاب 25 ألف طالب ومعلم، وتكامل بوابة مايكروسوفت والذكاء الاصطناعي التوليدي.'
    ) RETURNING id INTO cnt_classera;

    -- Invoices for Classera
    INSERT INTO public.contract_invoices (
      invoice_number, contract_id, project_id, client_id, milestone_title, amount, tax_amount, total_with_tax, currency, status, due_date, paid_at, payment_method, notes
    ) VALUES 
    (
      'INV-2026-0201',
      cnt_classera,
      p_classera,
      c_classera,
      'الدفعة السنوية الأولى: ترقية البنية التحتية وتهيئة منصة التعلم',
      120000.00,
      18000.00,
      138000.00,
      'SAR',
      'paid',
      CURRENT_DATE - INTERVAL '70 days',
      CURRENT_DATE - INTERVAL '65 days',
      'سداد إلكتروني عبر بطاقة الشركات',
      'تم سداد الرسوم السنوية مقدماً للرخص.'
    ),
    (
      'INV-2026-0202',
      cnt_classera,
      p_classera,
      c_classera,
      'الدفعة النصف سنوية: دعم التدريب الفني واختبارات نهاية الفصل الأول',
      120000.00,
      18000.00,
      138000.00,
      'SAR',
      'overdue',
      CURRENT_DATE - INTERVAL '5 days',
      NULL,
      NULL,
      'تم إرسال تذكير للمسؤول المالي للجهة لتسريع السداد.'
    );
  END IF;
END $$;
