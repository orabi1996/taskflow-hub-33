-- Ensure ctraining801@gmail.com has complete administrator & general manager rights
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(trim(email)) = 'ctraining801@gmail.com'
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Ensure profile exists and is active as super admin
    INSERT INTO public.profiles (id, full_name, email, job_title, department, is_active)
    VALUES (
      v_user_id,
      'مدير النظام العام',
      'ctraining801@gmail.com',
      'مدير النظام العام (Super Admin)',
      'الإدارة العليا',
      true
    )
    ON CONFLICT (id) DO UPDATE SET
      job_title = 'مدير النظام العام (Super Admin)',
      department = 'الإدارة العليا',
      is_active = true;

    -- Ensure 'admin' role
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_user_id AND role = 'admin') THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'admin');
    END IF;

    -- Ensure 'general_manager' role
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_user_id AND role = 'general_manager') THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'general_manager');
    END IF;

    -- Ensure 'manager' role
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_user_id AND role = 'manager') THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'manager');
    END IF;
  END IF;
END $$;
