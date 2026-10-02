-- Enterprise Seed Data for C-SmarX / TaskFlow Hub
-- Departments, Modules, Sample Projects & Sample Clients

DO $$
DECLARE
  v_admin_id uuid;
  v_dept_mgmt uuid;
  v_dept_dev uuid;
  v_dept_erp uuid;
  v_dept_lms uuid;
  v_dept_support uuid;
  v_dept_pmo uuid;

  v_mod_erp uuid;
  v_mod_erp_fin uuid;
  v_mod_erp_hr uuid;
  v_mod_erp_inv uuid;

  v_mod_lms uuid;
  v_mod_lms_vc uuid;
  v_mod_lms_exam uuid;
  v_mod_lms_portal uuid;

  v_mod_sla uuid;

  v_proj_erp uuid;
  v_proj_lms uuid;
  v_proj_sla uuid;
BEGIN
  -- 1. Find primary admin
  SELECT id INTO v_admin_id FROM auth.users WHERE lower(trim(email)) = 'ctraining801@gmail.com' LIMIT 1;
  IF v_admin_id IS NULL THEN
    SELECT id INTO v_admin_id FROM auth.users LIMIT 1;
  END IF;

  -- 2. Departments
  INSERT INTO public.departments (name, description, sort_order, is_active)
  VALUES ('الإدارة العامة والتنفيذية', 'مجلس الإدارة والقرارات الاستراتيجية', 1, true)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.departments (name, description, sort_order, is_active)
  VALUES ('قطاع تطوير الحلول البرمجية', 'تطوير وصيانة أنظمة الـ ERP والمنصات التعليمية', 2, true)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.departments (name, description, sort_order, is_active)
  VALUES ('قطاع الدعم الفني وخدمة العملاء', 'خدمات ما بعد البيع والدعم الميداني والتقني', 3, true)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.departments (name, description, sort_order, is_active)
  VALUES ('إدارة المشاريع وضمان الجودة PMO', 'مراقبة الإنجاز ومعايير الجودة والـ SLA', 4, true)
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_dept_dev FROM public.departments WHERE name = 'قطاع تطوير الحلول البرمجية' LIMIT 1;
  IF v_dept_dev IS NOT NULL THEN
    INSERT INTO public.departments (name, description, parent_id, sort_order, is_active)
    VALUES ('قسم أنظمة تخطيط الموارد ERP', 'تطوير وتكامل المحاسبة والفوترة والمستودعات', v_dept_dev, 1, true)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.departments (name, description, parent_id, sort_order, is_active)
    VALUES ('قسم المنصات التعليمية LMS', 'تطوير الفصول الافتراضية والامتحانات وإدارة المدارس', v_dept_dev, 2, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- 3. Company Modules
  INSERT INTO public.company_modules (name, code, color, sort_order, description, is_active)
  VALUES ('نظام تخطيط الموارد C-SmarX ERP', 'ERP-CORE', '#2563eb', 1, 'المنظومة المالية والإدارية الشاملة', true)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.company_modules (name, code, color, sort_order, description, is_active)
  VALUES ('منصة التعليم الذكي Classera LMS', 'LMS-CORE', '#059669', 2, 'الفصول الافتراضية والامتحانات وإدارة المدارس', true)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.company_modules (name, code, color, sort_order, description, is_active)
  VALUES ('محرك الدعم الفني وتذاكر الصيانة SLA', 'SLA-SUPPORT', '#d97706', 3, 'إدارة العقود وتذاكر الدعم وسرعة الاستجابة', true)
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_mod_erp FROM public.company_modules WHERE code = 'ERP-CORE' LIMIT 1;
  IF v_mod_erp IS NOT NULL THEN
    INSERT INTO public.company_modules (name, code, color, sort_order, parent_id, description, is_active)
    VALUES ('المحاسبة والفوترة الإلكترونية (ZATCA)', 'ERP-FIN', '#3b82f6', 1, v_mod_erp, 'الفاتورة الضريبية ونقاط البيع وقيود اليومية', true)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.company_modules (name, code, color, sort_order, parent_id, description, is_active)
    VALUES ('الموارد البشرية والرواتب (HR)', 'ERP-HR', '#60a5fa', 2, v_mod_erp, 'مسيرات الرواتب والإجازات والحضور والانصراف', true)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.company_modules (name, code, code, parent_id, description, is_active)
    VALUES ('إدارة المستودعات والمشتريات', 'ERP-INV', '#93c5fd', v_mod_erp, 'المخزون والتوريد وأوامر الشراء', true)
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT id INTO v_mod_lms FROM public.company_modules WHERE code = 'LMS-CORE' LIMIT 1;
  IF v_mod_lms IS NOT NULL THEN
    INSERT INTO public.company_modules (name, code, color, sort_order, parent_id, description, is_active)
    VALUES ('الفصول الافتراضية والتعليم التفاعلي', 'LMS-VC', '#10b981', 1, v_mod_lms, 'البث المباشر وتسجيل الحصص والمحادثة المباشرة', true)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.company_modules (name, code, color, sort_order, parent_id, description, is_active)
    VALUES ('نظام الامتحانات وبنوك الأسئلة', 'LMS-EXAM', '#34d399', 2, v_mod_lms, 'التصحيح التلقائي والاختبارات الدورية', true)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.company_modules (name, code, color, sort_order, parent_id, description, is_active)
    VALUES ('بوابة الطلاب وأولياء الأمور', 'LMS-PORTAL', '#6ee7b7', 3, v_mod_lms, 'الواجبات والشهادات ومتابعة الغياب', true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- 4. Projects
  INSERT INTO public.projects (name, description, health_status, contract_value, currency, is_active, owner_id, contract_start_date, contract_end_date)
  VALUES (
    'تطبيق وتكامل نظام ERP - مجموعة المستقبل القابضة',
    'مشروع تطبيق حزمة المحاسبة والفوترة الإلكترونية وإدارة المستودعات وربط فروع المجموعة بالمقر الرئيسي.',
    'green',
    280000,
    'SAR',
    true,
    v_admin_id,
    now(),
    now() + interval '1 year'
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO public.projects (name, description, health_status, contract_value, currency, is_active, owner_id, contract_start_date, contract_end_date)
  VALUES (
    'منصة التعليم الذكي LMS - مدارس النخبة العالمية',
    'إطلاق منظومة الفصول الافتراضية وبوابة أولياء الأمور وتدريب المعلمين وإدارة الامتحانات الرقمية.',
    'green',
    195000,
    'SAR',
    true,
    v_admin_id,
    now(),
    now() + interval '1 year'
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO public.projects (name, description, health_status, contract_value, currency, is_active, owner_id, contract_start_date, contract_end_date)
  VALUES (
    'عقد الصيانة والدعم السنوي - شركة الأفق للتجارة واللوجستيات',
    'دعم فني متواصل على مدار 24/7، فحص سيرفرات الفوترة الإلكترونية وضمان استقرار الأداء والربط الضريبي.',
    'green',
    75000,
    'SAR',
    true,
    v_admin_id,
    now(),
    now() + interval '1 year'
  )
  ON CONFLICT DO NOTHING;

  -- 5. Clients
  SELECT id INTO v_proj_erp FROM public.projects WHERE name = 'تطبيق وتكامل نظام ERP - مجموعة المستقبل القابضة' LIMIT 1;
  IF v_proj_erp IS NOT NULL THEN
    INSERT INTO public.clients (name, company, email, phone, project_id, health_status, contract_value, currency, alert_days_before, contract_start_date, contract_end_date)
    VALUES (
      'مجموعة المستقبل القابضة',
      'شركة المستقبل للاستثمارات التجارية',
      'ceo@almustaqbal-group.com',
      '+966114567890',
      v_proj_erp,
      'green',
      280000,
      'SAR',
      30,
      now(),
      now() + interval '1 year'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT id INTO v_proj_lms FROM public.projects WHERE name = 'منصة التعليم الذكي LMS - مدارس النخبة العالمية' LIMIT 1;
  IF v_proj_lms IS NOT NULL THEN
    INSERT INTO public.clients (name, company, email, phone, project_id, health_status, contract_value, currency, alert_days_before, contract_start_date, contract_end_date)
    VALUES (
      'مدارس النخبة العالمية',
      'مؤسسة النخبة للتربية والتعليم',
      'principal@al-nokhba-schools.edu.sa',
      '+966126543210',
      v_proj_lms,
      'green',
      195000,
      'SAR',
      45,
      now(),
      now() + interval '1 year'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT id INTO v_proj_sla FROM public.projects WHERE name = 'عقد الصيانة والدعم السنوي - شركة الأفق للتجارة واللوجستيات' LIMIT 1;
  IF v_proj_sla IS NOT NULL THEN
    INSERT INTO public.clients (name, company, email, phone, project_id, health_status, contract_value, currency, alert_days_before, contract_start_date, contract_end_date)
    VALUES (
      'شركة الأفق للتجارة واللوجستيات',
      'الأفق لوجستيكس الدولية',
      'operations@alofoq-logistics.com',
      '+966138901234',
      v_proj_sla,
      'green',
      75000,
      'SAR',
      30,
      now(),
      now() + interval '1 year'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- 6. Sample Tasks
  SELECT id INTO v_mod_erp_fin FROM public.company_modules WHERE code = 'ERP-FIN' LIMIT 1;
  SELECT id INTO v_mod_lms_vc FROM public.company_modules WHERE code = 'LMS-VC' LIMIT 1;
  SELECT id INTO v_mod_sla FROM public.company_modules WHERE code = 'SLA-SUPPORT' LIMIT 1;

  IF v_admin_id IS NOT NULL AND v_proj_erp IS NOT NULL THEN
    INSERT INTO public.tasks (title, details, status, priority, session_type, start_at, end_at, project_id, module_id, user_id, tags)
    VALUES (
      'إعداد ربط الفوترة الإلكترونية المرحلة الثانية مع منصة الزكاة',
      'تم اختبار واجهات الربط API وتوليد شهادات التشفير CSID بنجاح، وربط نقاط البيع بالمقر الرئيسي.',
      'completed',
      'urgent',
      'daily_work',
      now() - interval '3 hours',
      now() - interval '1 hour',
      v_proj_erp,
      v_mod_erp_fin,
      v_admin_id,
      ARRAY['ERP', 'ZATCA', 'فوترة']
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_admin_id IS NOT NULL AND v_proj_lms IS NOT NULL THEN
    INSERT INTO public.tasks (title, details, status, priority, session_type, start_at, end_at, project_id, module_id, user_id, tags)
    VALUES (
      'جلسة تدريب الهيئة التعليمية على الفصول الافتراضية والامتحانات الرقمية',
      'تدريب أكثر من 45 معلماً على إدارة البث التفاعلي وجداول الحصص وبنوك الأسئلة الموحدة.',
      'completed',
      'high',
      'training',
      now() - interval '5 hours',
      now() - interval '3 hours 30 minutes',
      v_proj_lms,
      v_mod_lms_vc,
      v_admin_id,
      ARRAY['LMS', 'تدريب', 'فصول']
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_admin_id IS NOT NULL AND v_proj_sla IS NOT NULL THEN
    INSERT INTO public.tasks (title, details, status, priority, session_type, start_at, end_at, project_id, module_id, user_id, tags)
    VALUES (
      'معالجة بلاغ دعم فني طارئ: ترحيل قيود ميزان المراجعة لفرع الرياض',
      'فحص قيود التسوية اليدوية وإعادة بناء الفهارس بنجاح بدون توقف الخدمة.',
      'completed',
      'medium',
      'support',
      now() - interval '7 hours',
      now() - interval '6 hours 15 minutes',
      v_proj_sla,
      v_mod_sla,
      v_admin_id,
      ARRAY['دعم', 'ERP', 'ترحيل']
    )
    ON CONFLICT DO NOTHING;

    INSERT INTO public.tasks (title, details, status, priority, session_type, start_at, end_at, project_id, module_id, user_id, tags)
    VALUES (
      'فحص جاهزية سيرفرات الامتحانات الإلكترونية واختبار ضغط الخوادم',
      'محاكاة دخول 5000 طالب متزامن وقياس زمن الاستجابة واستهلاك الذاكرة وقواعد البيانات.',
      'pending',
      'high',
      'qa_testing',
      now(),
      NULL,
      v_proj_lms,
      v_mod_lms_vc,
      v_admin_id,
      ARRAY['LMS', 'اختبارات', 'جودة']
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
