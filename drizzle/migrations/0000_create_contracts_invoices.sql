CREATE TABLE public.project_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number text NOT NULL UNIQUE,
  title text NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','completed','terminated')),
  terms text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.project_contracts TO authenticated;
GRANT ALL ON public.project_contracts TO service_role;
ALTER TABLE public.project_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and managers read contracts" ON public.project_contracts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE TABLE public.contract_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  contract_id uuid NOT NULL REFERENCES public.project_contracts(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  milestone_title text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total_with_tax numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue','cancelled')),
  due_date date NOT NULL,
  paid_at timestamptz,
  payment_method text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.contract_invoices TO authenticated;
GRANT ALL ON public.contract_invoices TO service_role;
ALTER TABLE public.contract_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and managers read invoices" ON public.contract_invoices FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

NOTIFY pgrst, 'reload schema';