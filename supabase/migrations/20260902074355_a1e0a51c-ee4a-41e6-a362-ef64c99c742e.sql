REVOKE ALL ON FUNCTION public.module_with_descendants(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_module_descendant_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_accessible_modules(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_project_module(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_project_v3(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.module_with_descendants(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_module_descendant_of(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_accessible_modules(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_project_module(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_project_v3(uuid, uuid) TO authenticated, service_role;