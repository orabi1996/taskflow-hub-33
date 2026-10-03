import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const seedEnterpriseData = createServerFn({ method: "POST" }).handler(async () => {
  try {
    // 1. Identify primary admin user
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const adminUser =
      userList?.users?.find((u) => (u.email ?? "").toLowerCase() === "ctraining801@gmail.com") ||
      userList?.users?.[0];

    const adminId = adminUser?.id ?? null;

    // 2. Departments Seeding
    const deptsToSeed = [
      { name: "الإدارة العامة والتنفيذية", description: "مجلس الإدارة والقرارات الاستراتيجية", sort_order: 1 },
      { name: "قطاع تطوير الحلول البرمجية", description: "تطوير وصيانة أنظمة الـ ERP والمنصات التعليمية", sort_order: 2 },
      { name: "قطاع الدعم الفني وخدمة العملاء", description: "خدمات ما بعد البيع والدعم الميداني والتقني", sort_order: 3 },
      { name: "إدارة المشاريع وضمان الجودة PMO", description: "مراقبة الإنجاز ومعايير الجودة والـ SLA", sort_order: 4 },
    ];

    const deptMap = new Map<string, string>();
    for (const d of deptsToSeed) {
      const { data: existing } = await supabaseAdmin
        .from("departments")
        .select("id")
        .eq("name", d.name)
        .maybeSingle();

      if (existing) {
        deptMap.set(d.name, existing.id);
      } else {
        const { data: created } = await supabaseAdmin
          .from("departments")
          .insert({
            name: d.name,
            description: d.description,
            sort_order: d.sort_order,
            is_active: true,
          })
          .select("id")
          .single();
        if (created) deptMap.set(d.name, created.id);
      }
    }

    // Sub-departments
    const devParent = deptMap.get("قطاع تطوير الحلول البرمجية");
    if (devParent) {
      for (const sub of [
        { name: "قسم أنظمة تخطيط الموارد ERP", parent_id: devParent, sort_order: 1 },
        { name: "قسم المنصات التعليمية LMS", parent_id: devParent, sort_order: 2 },
      ]) {
        const { data: ex } = await supabaseAdmin.from("departments").select("id").eq("name", sub.name).maybeSingle();
        if (!ex) {
          await supabaseAdmin.from("departments").insert({ ...sub, is_active: true });
        }
      }
    }

    // 3. Company Modules Seeding
    const rootModules = [
      { name: "نظام تخطيط الموارد C-SmarX ERP", code: "ERP-CORE", color: "#2563eb", sort_order: 1, description: "المنظومة المالية والإدارية الشاملة" },
      { name: "منصة التعليم الذكي Classera LMS", code: "LMS-CORE", color: "#059669", sort_order: 2, description: "الفصول الافتراضية والامتحانات وإدارة المدارس" },
      { name: "محرك الدعم الفني وتذاكر الصيانة SLA", code: "SLA-SUPPORT", color: "#d97706", sort_order: 3, description: "إدارة العقود وتذاكر الدعم وسرعة الاستجابة" },
    ];

    const moduleMap = new Map<string, string>();
    for (const m of rootModules) {
      const { data: existing } = await supabaseAdmin
        .from("company_modules")
        .select("id")
        .eq("code", m.code)
        .maybeSingle();

      if (existing) {
        moduleMap.set(m.code, existing.id);
      } else {
        const { data: created } = await supabaseAdmin
          .from("company_modules")
          .insert({
            name: m.name,
            code: m.code,
            color: m.color,
            sort_order: m.sort_order,
            description: m.description,
            is_active: true,
          })
          .select("id")
          .single();
        if (created) moduleMap.set(m.code, created.id);
      }
    }

    // Sub-modules for ERP
    const erpParentId = moduleMap.get("ERP-CORE");
    if (erpParentId) {
      const erpSubs = [
        { name: "المحاسبة والفوترة الإلكترونية (ZATCA)", code: "ERP-FIN", color: "#3b82f6", sort_order: 1, parent_id: erpParentId, description: "الفاتورة الضريبية ونقاط البيع وقيود اليومية" },
        { name: "الموارد البشرية والرواتب (HR)", code: "ERP-HR", color: "#60a5fa", sort_order: 2, parent_id: erpParentId, description: "مسيرات الرواتب والإجازات والحضور والانصراف" },
        { name: "إدارة المستودعات والمشتريات", code: "ERP-INV", color: "#93c5fd", sort_order: 3, parent_id: erpParentId, description: "المخزون والتوريد وأوامر الشراء" },
      ];
      for (const sub of erpSubs) {
        const { data: ex } = await supabaseAdmin.from("company_modules").select("id").eq("code", sub.code).maybeSingle();
        if (!ex) {
          const { data: c } = await supabaseAdmin.from("company_modules").insert({ ...sub, is_active: true }).select("id").single();
          if (c) moduleMap.set(sub.code, c.id);
        } else {
          moduleMap.set(sub.code, ex.id);
        }
      }
    }

    // Sub-modules for LMS
    const lmsParentId = moduleMap.get("LMS-CORE");
    if (lmsParentId) {
      const lmsSubs = [
        { name: "الفصول الافتراضية والتعليم التفاعلي", code: "LMS-VC", color: "#10b981", sort_order: 1, parent_id: lmsParentId, description: "البث المباشر وتسجيل الحصص والمحادثة المباشرة" },
        { name: "نظام الامتحانات وبنوك الأسئلة", code: "LMS-EXAM", color: "#34d399", sort_order: 2, parent_id: lmsParentId, description: "التصحيح التلقائي والاختبارات الدورية" },
        { name: "بوابة الطلاب وأولياء الأمور", code: "LMS-PORTAL", color: "#6ee7b7", sort_order: 3, parent_id: lmsParentId, description: "الواجبات والشهادات ومتابعة الغياب" },
      ];
      for (const sub of lmsSubs) {
        const { data: ex } = await supabaseAdmin.from("company_modules").select("id").eq("code", sub.code).maybeSingle();
        if (!ex) {
          const { data: c } = await supabaseAdmin.from("company_modules").insert({ ...sub, is_active: true }).select("id").single();
          if (c) moduleMap.set(sub.code, c.id);
        } else {
          moduleMap.set(sub.code, ex.id);
        }
      }
    }

    // 4. Sample Projects Seeding
    const now = new Date();
    const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const sampleProjects = [
      {
        name: "تطبيق وتكامل نظام ERP - مجموعة المستقبل القابضة",
        description: "مشروع تطبيق حزمة المحاسبة والفوترة الإلكترونية وإدارة المستودعات وربط فروع المجموعة بالمقر الرئيسي.",
        health_status: "green" as const,
        contract_value: 280000,
        currency: "SAR",
        is_active: true,
        owner_id: adminId,
        contract_start_date: now.toISOString(),
        contract_end_date: oneYearLater,
      },
      {
        name: "منصة التعليم الذكي LMS - مدارس النخبة العالمية",
        description: "إطلاق منظومة الفصول الافتراضية وبوابة أولياء الأمور وتدريب المعلمين وإدارة الامتحانات الرقمية.",
        health_status: "green" as const,
        contract_value: 195000,
        currency: "SAR",
        is_active: true,
        owner_id: adminId,
        contract_start_date: now.toISOString(),
        contract_end_date: oneYearLater,
      },
      {
        name: "عقد الصيانة والدعم السنوي - شركة الأفق للتجارة واللوجستيات",
        description: "دعم فني متواصل على مدار 24/7، فحص سيرفرات الفوترة الإلكترونية وضمان استقرار الأداء والربط الضريبي.",
        health_status: "green" as const,
        contract_value: 75000,
        currency: "SAR",
        is_active: true,
        owner_id: adminId,
        contract_start_date: now.toISOString(),
        contract_end_date: oneYearLater,
      },
    ];

    const projectMap = new Map<string, string>();
    for (const p of sampleProjects) {
      const { data: ex } = await supabaseAdmin.from("projects").select("id").eq("name", p.name).maybeSingle();
      if (ex) {
        projectMap.set(p.name, ex.id);
      } else {
        const { data: created } = await supabaseAdmin.from("projects").insert(p).select("id").single();
        if (created) projectMap.set(p.name, created.id);
      }
    }

    // 5. Sample Clients Seeding
    const p1Id = projectMap.get("تطبيق وتكامل نظام ERP - مجموعة المستقبل القابضة");
    const p2Id = projectMap.get("منصة التعليم الذكي LMS - مدارس النخبة العالمية");
    const p3Id = projectMap.get("عقد الصيانة والدعم السنوي - شركة الأفق للتجارة واللوجستيات");

    const sampleClients = [
      ...(p1Id
        ? [{
            name: "مجموعة المستقبل القابضة",
            company: "شركة المستقبل للاستثمارات التجارية",
            email: "ceo@almustaqbal-group.com",
            phone: "+966114567890",
            project_id: p1Id,
            health_status: "green" as const,
            contract_value: 280000,
            currency: "SAR",
            alert_days_before: 30,
            contract_start_date: now.toISOString(),
            contract_end_date: oneYearLater,
          }]
        : []),
      ...(p2Id
        ? [{
            name: "مدارس النخبة العالمية",
            company: "مؤسسة النخبة للتربية والتعليم",
            email: "principal@al-nokhba-schools.edu.sa",
            phone: "+966126543210",
            project_id: p2Id,
            health_status: "green" as const,
            contract_value: 195000,
            currency: "SAR",
            alert_days_before: 45,
            contract_start_date: now.toISOString(),
            contract_end_date: oneYearLater,
          }]
        : []),
      ...(p3Id
        ? [{
            name: "شركة الأفق للتجارة واللوجستيات",
            company: "الأفق لوجستيكس الدولية",
            email: "operations@alofoq-logistics.com",
            phone: "+966138901234",
            project_id: p3Id,
            health_status: "green" as const,
            contract_value: 75000,
            currency: "SAR",
            alert_days_before: 30,
            contract_start_date: now.toISOString(),
            contract_end_date: oneYearLater,
          }]
        : []),
    ];

    for (const cl of sampleClients) {
      const { data: ex } = await supabaseAdmin.from("clients").select("id").eq("email", cl.email).maybeSingle();
      if (!ex) {
        await supabaseAdmin.from("clients").insert(cl);
      }
    }

    // 6. Sample Daily Tasks Seeding (if adminId exists)
    if (adminId) {
      const sampleTasks = [
        {
          title: "إعداد ربط الفوترة الإلكترونية المرحلة الثانية مع منصة الزكاة",
          details: "تم اختبار واجهات الربط API وتوليد شهادات التشفير CSID بنجاح، وربط نقاط البيع بالمقر الرئيسي.",
          status: "completed" as const,
          priority: "urgent",
          session_type: "daily_work",
          start_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
          end_at: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
          project_id: p1Id ?? null,
          module_id: moduleMap.get("ERP-FIN") ?? erpParentId ?? null,
          user_id: adminId,
          tags: ["ERP", "ZATCA", "فوترة"],
        },
        {
          title: "جلسة تدريب الهيئة التعليمية على الفصول الافتراضية والامتحانات الرقمية",
          details: "تدريب أكثر من 45 معلماً على إدارة البث التفاعلي وجداول الحصص وبنوك الأسئلة الموحدة.",
          status: "completed" as const,
          priority: "high",
          session_type: "training",
          start_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
          end_at: new Date(Date.now() - 3.5 * 3600 * 1000).toISOString(),
          project_id: p2Id ?? null,
          module_id: moduleMap.get("LMS-VC") ?? lmsParentId ?? null,
          user_id: adminId,
          tags: ["LMS", "تدريب", "فصول"],
        },
        {
          title: "معالجة بلاغ دعم فني طارئ: ترحيل قيود ميزان المراجعة لفرع الرياض",
          details: "فحص قيود التسوية اليدوية وإعادة بناء الفهارس بنجاح بدون توقف الخدمة.",
          status: "completed" as const,
          priority: "medium",
          session_type: "support",
          start_at: new Date(Date.now() - 7 * 3600 * 1000).toISOString(),
          end_at: new Date(Date.now() - 6.25 * 3600 * 1000).toISOString(),
          project_id: p3Id ?? null,
          module_id: moduleMap.get("SLA-SUPPORT") ?? null,
          user_id: adminId,
          tags: ["دعم", "ERP", "ترحيل"],
        },
        {
          title: "فحص جاهزية سيرفرات الامتحانات الإلكترونية واختبار ضغط الخوادم",
          details: "محاكاة دخول 5000 طالب متزامن وقياس زمن الاستجابة واستهلاك الذاكرة وقواعد البيانات.",
          status: "pending" as const,
          priority: "high",
          session_type: "qa_testing",
          start_at: new Date().toISOString(),
          end_at: null,
          project_id: p2Id ?? null,
          module_id: moduleMap.get("LMS-EXAM") ?? lmsParentId ?? null,
          user_id: adminId,
          tags: ["LMS", "اختبارات", "جودة"],
        },
      ];

      for (const t of sampleTasks) {
        const { data: ex } = await supabaseAdmin.from("tasks").select("id").eq("title", t.title).maybeSingle();
        if (!ex) {
          await supabaseAdmin.from("tasks").insert(t);
        }
      }
    }

    // 8. Automation Rules Seeding
    const defaultRules = [
      {
        name: "خرق اتفاقية SLA للاستجابة",
        description: "تنبيه الإدارة عند تجاوز تذكرة الدعم الفني مهلة أول استجابة محددة بالاتفاقية",
        trigger_type: "ticket_sla_response_breach",
        trigger_config: { cooldown_hours: 12 },
        action_type: "notify_admins",
        action_config: {},
        is_active: true,
      },
      {
        name: "خرق اتفاقية SLA لحل التذكرة",
        description: "تنبيه الإدارة والمدراء عند تجاوز التذكرة المهلة القصوى للحل النهائي دون إغلاق",
        trigger_type: "ticket_sla_resolve_breach",
        trigger_config: { cooldown_hours: 12 },
        action_type: "notify_admins",
        action_config: {},
        is_active: true,
      },
      {
        name: "تحذير اقتراب انتهاء مهلة حل التذكرة SLA",
        description: "تحذير المسؤول والمدير قبل ساعتين من موعد خرق اتفاقية حل التذكرة",
        trigger_type: "ticket_sla_warning",
        trigger_config: { hours: 2, cooldown_hours: 4 },
        action_type: "notify_manager",
        action_config: {},
        is_active: true,
      },
      {
        name: "تذكير برفع يومية العمل للاعتماد",
        description: "تذكير الموظفين الذين أنجزوا مهام اليوم بإرسال يومية العمل للاعتماد من مديرهم",
        trigger_type: "daily_journal_missing",
        trigger_config: { cooldown_hours: 12 },
        action_type: "notify_user",
        action_config: {},
        is_active: true,
      },
    ];

    for (const r of defaultRules) {
      const { data: ex } = await supabaseAdmin.from("automation_rules").select("id").eq("name", r.name).maybeSingle();
      if (!ex) {
        await supabaseAdmin.from("automation_rules").insert(r);
      }
    }

    return {
      ok: true,
      message: "تم توليد البيانات التأسيسية للمنظومة بنجاح!",
      counts: {
        departments: deptsToSeed.length + 2,
        modules: rootModules.length + 6,
        projects: sampleProjects.length,
        clients: sampleClients.length,
      },
    };
  } catch (err: any) {
    console.error("[seedEnterpriseData] Error:", err);
    return {
      ok: false,
      error: err?.message || "حدث خطأ أثناء توليد البيانات التأسيسية.",
    };
  }
});
