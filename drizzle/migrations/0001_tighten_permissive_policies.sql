CREATE OR REPLACE FUNCTION public.is_active_employee(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND is_active)
$$;

CREATE OR REPLACE FUNCTION public.can_access_ticket(_user_id uuid, _ticket_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = _ticket_id
      AND (t.created_by = _user_id OR t.assigned_to = _user_id
           OR public.is_manager_or_above(_user_id) OR public.has_role(_user_id, 'support'))
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_objective(_user_id uuid, _objective_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.objectives o
    WHERE o.id = _objective_id
      AND (o.owner_id = _user_id OR o.created_by = _user_id
           OR public.is_manager_or_above(_user_id)
           OR public.is_chain_manager_of(_user_id, o.owner_id)
           OR (o.project_id IS NOT NULL AND public.can_view_project(_user_id, o.project_id)))
  )
$$;

DROP POLICY IF EXISTS "Authenticated read departments" ON public.departments;
CREATE POLICY "Active employees read departments" ON public.departments FOR SELECT TO authenticated
  USING (public.is_active_employee(auth.uid()));

DROP POLICY IF EXISTS "Authenticated read job positions" ON public.job_positions;
CREATE POLICY "Active employees read job positions" ON public.job_positions FOR SELECT TO authenticated
  USING (public.is_active_employee(auth.uid()));

DROP POLICY IF EXISTS "Authenticated read modules" ON public.company_modules;
CREATE POLICY "Active employees read modules" ON public.company_modules FOR SELECT TO authenticated
  USING (public.is_active_employee(auth.uid()));

DROP POLICY IF EXISTS "Authenticated read project modules" ON public.project_modules;
CREATE POLICY "Project viewers read project modules" ON public.project_modules FOR SELECT TO authenticated
  USING (public.is_manager_or_above(auth.uid()) OR public.can_view_project(auth.uid(), project_id));

DROP POLICY IF EXISTS "objectives_select" ON public.objectives;
CREATE POLICY "objectives_select" ON public.objectives FOR SELECT TO authenticated
  USING (public.can_view_objective(auth.uid(), id));

DROP POLICY IF EXISTS "key_results_select" ON public.key_results;
CREATE POLICY "key_results_select" ON public.key_results FOR SELECT TO authenticated
  USING (public.can_view_objective(auth.uid(), objective_id));

DROP POLICY IF EXISTS "Authenticated read tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Authenticated create tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Authenticated update tickets" ON public.support_tickets;
CREATE POLICY "Ticket participants read" ON public.support_tickets FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR assigned_to = auth.uid()
         OR public.is_manager_or_above(auth.uid()) OR public.has_role(auth.uid(), 'support'));
CREATE POLICY "Users create own tickets" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Ticket participants update" ON public.support_tickets FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR assigned_to = auth.uid()
         OR public.is_manager_or_above(auth.uid()) OR public.has_role(auth.uid(), 'support'))
  WITH CHECK (created_by = auth.uid() OR assigned_to = auth.uid()
         OR public.is_manager_or_above(auth.uid()) OR public.has_role(auth.uid(), 'support'));

DROP POLICY IF EXISTS "Authenticated read messages" ON public.ticket_messages;
DROP POLICY IF EXISTS "Authenticated add messages" ON public.ticket_messages;
CREATE POLICY "Ticket participants read messages" ON public.ticket_messages FOR SELECT TO authenticated
  USING (public.can_access_ticket(auth.uid(), ticket_id)
         AND (NOT is_internal_note OR public.is_manager_or_above(auth.uid()) OR public.has_role(auth.uid(), 'support')));
CREATE POLICY "Ticket participants add messages" ON public.ticket_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.can_access_ticket(auth.uid(), ticket_id));