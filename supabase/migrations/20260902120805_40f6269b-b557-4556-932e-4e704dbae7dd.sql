-- ============ OBJECTIVES ============
CREATE TABLE public.objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  module_id uuid REFERENCES public.company_modules(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  quarter smallint NOT NULL DEFAULT 1 CHECK (quarter BETWEEN 1 AND 4),
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','completed','cancelled')),
  progress numeric NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.objectives TO authenticated;
GRANT ALL ON public.objectives TO service_role;
ALTER TABLE public.objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "objectives_select" ON public.objectives FOR SELECT TO authenticated USING (true);
CREATE POLICY "objectives_insert" ON public.objectives FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_manager_or_above(auth.uid()));
CREATE POLICY "objectives_update" ON public.objectives FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_manager_or_above(auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_manager_or_above(auth.uid()));
CREATE POLICY "objectives_delete" ON public.objectives FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin_or_gm(auth.uid()));

CREATE TRIGGER objectives_set_updated_at BEFORE UPDATE ON public.objectives
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ KEY RESULTS ============
CREATE TABLE public.key_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id uuid NOT NULL REFERENCES public.objectives(id) ON DELETE CASCADE,
  title text NOT NULL,
  start_value numeric NOT NULL DEFAULT 0,
  current_value numeric NOT NULL DEFAULT 0,
  target_value numeric NOT NULL DEFAULT 100,
  unit text NOT NULL DEFAULT 'number' CHECK (unit IN ('number','percent','currency')),
  status text NOT NULL DEFAULT 'on_track' CHECK (status IN ('on_track','at_risk','off_track','done')),
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.key_results TO authenticated;
GRANT ALL ON public.key_results TO service_role;
ALTER TABLE public.key_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "key_results_select" ON public.key_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "key_results_write" ON public.key_results FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.objectives o WHERE o.id = objective_id
    AND (o.owner_id = auth.uid() OR public.is_manager_or_above(auth.uid()))));
CREATE POLICY "key_results_update" ON public.key_results FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.objectives o WHERE o.id = objective_id
    AND (o.owner_id = auth.uid() OR public.is_manager_or_above(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.objectives o WHERE o.id = objective_id
    AND (o.owner_id = auth.uid() OR public.is_manager_or_above(auth.uid()))));
CREATE POLICY "key_results_delete" ON public.key_results FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.objectives o WHERE o.id = objective_id
    AND (o.owner_id = auth.uid() OR public.is_admin_or_gm(auth.uid()))));

CREATE TRIGGER key_results_set_updated_at BEFORE UPDATE ON public.key_results
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- auto-recalc objective progress
CREATE OR REPLACE FUNCTION public.recalc_objective_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _obj uuid := COALESCE(NEW.objective_id, OLD.objective_id);
  _p numeric;
BEGIN
  SELECT COALESCE(AVG(
    LEAST(100, GREATEST(0,
      CASE WHEN target_value = start_value THEN 100
      ELSE (current_value - start_value) / NULLIF(target_value - start_value, 0) * 100 END
    ))
  ), 0) INTO _p
  FROM public.key_results WHERE objective_id = _obj;

  UPDATE public.objectives SET progress = ROUND(_p, 2), updated_at = now() WHERE id = _obj;
  RETURN NULL;
END;
$$;

CREATE TRIGGER key_results_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.key_results
FOR EACH ROW EXECUTE FUNCTION public.recalc_objective_progress();

-- ============ PERFORMANCE REVIEWS ============
CREATE TABLE public.performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  score_delivery smallint CHECK (score_delivery BETWEEN 1 AND 5),
  score_quality smallint CHECK (score_quality BETWEEN 1 AND 5),
  score_collaboration smallint CHECK (score_collaboration BETWEEN 1 AND 5),
  score_timeliness smallint CHECK (score_timeliness BETWEEN 1 AND 5),
  strengths text,
  improvements text,
  notes text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','acknowledged')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_reviews TO authenticated;
GRANT ALL ON public.performance_reviews TO service_role;
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_select" ON public.performance_reviews FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid()
    OR reviewer_id = auth.uid()
    OR public.is_admin_or_gm(auth.uid())
    OR public.is_chain_manager_of(auth.uid(), employee_id)
  );
CREATE POLICY "reviews_insert" ON public.performance_reviews FOR INSERT TO authenticated
  WITH CHECK (reviewer_id = auth.uid() AND (public.is_manager_or_above(auth.uid()) OR public.is_admin_or_gm(auth.uid())));
CREATE POLICY "reviews_update" ON public.performance_reviews FOR UPDATE TO authenticated
  USING (reviewer_id = auth.uid() OR public.is_admin_or_gm(auth.uid()))
  WITH CHECK (reviewer_id = auth.uid() OR public.is_admin_or_gm(auth.uid()));
CREATE POLICY "reviews_delete" ON public.performance_reviews FOR DELETE TO authenticated
  USING (public.is_admin_or_gm(auth.uid()));

CREATE TRIGGER reviews_set_updated_at BEFORE UPDATE ON public.performance_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ KUDOS ============
CREATE TABLE public.kudos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'teamwork' CHECK (category IN ('teamwork','ownership','innovation','quality','support')),
  message text NOT NULL,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_user_id <> to_user_id)
);
GRANT SELECT, INSERT, DELETE ON public.kudos TO authenticated;
GRANT ALL ON public.kudos TO service_role;
ALTER TABLE public.kudos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kudos_select" ON public.kudos FOR SELECT TO authenticated
  USING (is_public OR from_user_id = auth.uid() OR to_user_id = auth.uid() OR public.is_admin_or_gm(auth.uid()));
CREATE POLICY "kudos_insert" ON public.kudos FOR INSERT TO authenticated
  WITH CHECK (from_user_id = auth.uid());
CREATE POLICY "kudos_delete" ON public.kudos FOR DELETE TO authenticated
  USING (from_user_id = auth.uid() OR public.is_admin_or_gm(auth.uid()));

CREATE INDEX idx_objectives_owner ON public.objectives(owner_id);
CREATE INDEX idx_objectives_period ON public.objectives(year, quarter);
CREATE INDEX idx_key_results_obj ON public.key_results(objective_id);
CREATE INDEX idx_reviews_employee ON public.performance_reviews(employee_id);
CREATE INDEX idx_kudos_to ON public.kudos(to_user_id);
