-- 1) Module tree: Classera (parent) + C-SMARX (child)
INSERT INTO public.company_modules (name, code, description, parent_id, icon, color, sort_order, is_active)
SELECT 'Classera', 'CLASSERA', 'الشركة الأم', NULL, 'building-2', '#1a73e8', 0, true
WHERE NOT EXISTS (SELECT 1 FROM public.company_modules WHERE code = 'CLASSERA');

INSERT INTO public.company_modules (name, code, description, parent_id, icon, color, sort_order, is_active)
SELECT 'C-SMARX', 'CSMARX', 'شركة تابعة لـ Classera', (SELECT id FROM public.company_modules WHERE code = 'CLASSERA'), 'boxes', '#1e88e5', 1, true
WHERE NOT EXISTS (SELECT 1 FROM public.company_modules WHERE code = 'CSMARX');

-- 2) Assign every existing profile to Classera as primary module (idempotent)
INSERT INTO public.employee_modules (user_id, module_id, role, is_primary)
SELECT p.id, (SELECT id FROM public.company_modules WHERE code = 'CLASSERA'), NULL, true
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.employee_modules em WHERE em.user_id = p.id
);

-- 3) Audit logging for roles / module assignments / login access
CREATE OR REPLACE FUNCTION public.audit_log_user_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE actor uuid := auth.uid(); actor_em text;
BEGIN
  SELECT email INTO actor_em FROM public.profiles WHERE id = actor;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs(actor_id, actor_email, event_type, severity, resource_type, resource_id, new_value)
    VALUES (actor, actor_em, 'role.granted', 'warn', 'user_role', NEW.user_id::text, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs(actor_id, actor_email, event_type, severity, resource_type, resource_id, old_value)
    VALUES (actor, actor_em, 'role.revoked', 'warn', 'user_role', OLD.user_id::text, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS audit_user_roles_trg ON public.user_roles;
CREATE TRIGGER audit_user_roles_trg
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_log_user_roles();

CREATE OR REPLACE FUNCTION public.audit_log_employee_modules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE actor uuid := auth.uid(); actor_em text;
BEGIN
  SELECT email INTO actor_em FROM public.profiles WHERE id = actor;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs(actor_id, actor_email, event_type, severity, resource_type, resource_id, new_value)
    VALUES (actor, actor_em, 'module.assigned', 'info', 'employee_module', NEW.user_id::text, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs(actor_id, actor_email, event_type, severity, resource_type, resource_id, old_value, new_value)
    VALUES (actor, actor_em, 'module.updated', 'info', 'employee_module', NEW.user_id::text, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs(actor_id, actor_email, event_type, severity, resource_type, resource_id, old_value)
    VALUES (actor, actor_em, 'module.unassigned', 'warn', 'employee_module', OLD.user_id::text, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS audit_employee_modules_trg ON public.employee_modules;
CREATE TRIGGER audit_employee_modules_trg
AFTER INSERT OR UPDATE OR DELETE ON public.employee_modules
FOR EACH ROW EXECUTE FUNCTION public.audit_log_employee_modules();

CREATE OR REPLACE FUNCTION public.audit_log_profile_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE actor uuid := auth.uid(); actor_em text;
BEGIN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    SELECT email INTO actor_em FROM public.profiles WHERE id = actor;
    INSERT INTO public.audit_logs(actor_id, actor_email, event_type, severity, resource_type, resource_id, old_value, new_value)
    VALUES (actor, actor_em,
      CASE WHEN NEW.is_active THEN 'access.enabled' ELSE 'access.disabled' END,
      'warn', 'profile', NEW.id::text,
      jsonb_build_object('is_active', OLD.is_active),
      jsonb_build_object('is_active', NEW.is_active, 'email', NEW.email));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS audit_profile_access_trg ON public.profiles;
CREATE TRIGGER audit_profile_access_trg
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_log_profile_access();