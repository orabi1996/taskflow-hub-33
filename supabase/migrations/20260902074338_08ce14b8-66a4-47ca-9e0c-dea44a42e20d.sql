-- 1) شجرة الأنظمة: النظام نفسه + كل الأنظمة التابعة له
CREATE OR REPLACE FUNCTION public.module_with_descendants(_module_id uuid)
RETURNS TABLE(module_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE tree AS (
    SELECT id FROM public.company_modules WHERE id = _module_id
    UNION ALL
    SELECT cm.id FROM public.company_modules cm JOIN tree t ON cm.parent_id = t.id
  )
  SELECT id FROM tree;
$$;

-- 2) هل _module منحدر من _ancestor (أو نفسه)؟
CREATE OR REPLACE FUNCTION public.is_module_descendant_of(_ancestor_id uuid, _module_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.module_with_descendants(_ancestor_id) WHERE module_id = _module_id);
$$;

-- 3) كل الأنظمة التي يصل إليها المستخدم (أنظمته + كل ما يتفرع منها)
CREATE OR REPLACE FUNCTION public.user_accessible_modules(_user_id uuid)
RETURNS TABLE(module_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT d.module_id
  FROM public.employee_modules em
  CROSS JOIN LATERAL public.module_with_descendants(em.module_id) d
  WHERE em.user_id = _user_id;
$$;

-- 4) هل يصل المستخدم لهذا المشروع حسب حدود الأنظمة؟
CREATE OR REPLACE FUNCTION public.can_access_project_module(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _project_id IS NULL
    OR public.is_admin_or_gm(_user_id)
    OR NOT EXISTS (SELECT 1 FROM public.project_modules pm WHERE pm.project_id = _project_id)
    OR EXISTS (
      SELECT 1 FROM public.project_modules pm
      JOIN public.user_accessible_modules(_user_id) uam ON uam.module_id = pm.module_id
      WHERE pm.project_id = _project_id
    );
$$;

-- 5) نسخة واعية بالأنظمة من صلاحية العرض
CREATE OR REPLACE FUNCTION public.can_view_project_v3(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_or_gm(_user_id)
      OR (
        public.can_access_project_module(_user_id, _project_id)
        AND (
          EXISTS (SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.owner_id = _user_id)
          OR public.is_project_member(_user_id, _project_id)
          OR public.is_manager_or_above(_user_id)
          OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.project_id = _project_id AND t.user_id = _user_id)
          OR NOT EXISTS (SELECT 1 FROM public.project_modules pm WHERE pm.project_id = _project_id)
        )
      );
$$;

-- 6) تطبيق الحدود على قراءة المشاريع بدل السماح المفتوح
DROP POLICY IF EXISTS "Authenticated read projects" ON public.projects;
CREATE POLICY "Module-aware read projects" ON public.projects
FOR SELECT TO authenticated
USING (public.can_view_project_v3(auth.uid(), id));

-- 7) تقييد رؤية المديرين لمهام الفريق بحدود الأنظمة
DROP POLICY IF EXISTS "Managers view team tasks" ON public.tasks;
CREATE POLICY "Managers view team tasks" ON public.tasks
FOR SELECT TO authenticated
USING (public.is_direct_manager_of(auth.uid(), user_id)
       AND public.can_access_project_module(auth.uid(), project_id));

DROP POLICY IF EXISTS "Chain managers view tasks" ON public.tasks;
CREATE POLICY "Chain managers view tasks" ON public.tasks
FOR SELECT TO authenticated
USING (public.is_chain_manager_of(auth.uid(), user_id)
       AND public.can_access_project_module(auth.uid(), project_id));