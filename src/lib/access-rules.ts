export type AppRoleName = "admin" | "general_manager" | "manager" | "employee" | "support";

export interface AccessRule {
  key: string;
  label: string;
  path: string;
  group: "التنقل الرئيسي" | "الإعدادات" | "الإدارة";
  /** Roles allowed. Empty array = available to everyone signed in. */
  allow: AppRoleName[];
  /** Human readable explanation of the rule. */
  rule: string;
}

export const ACCESS_RULES: AccessRule[] = [
  { key: "dashboard", label: "مهامي", path: "/dashboard", group: "التنقل الرئيسي", allow: [], rule: "متاح لكل مستخدم مسجّل الدخول." },
  { key: "time", label: "الوقت", path: "/time", group: "التنقل الرئيسي", allow: [], rule: "متاح لكل مستخدم مسجّل الدخول." },
  { key: "my-projects", label: "مشاريعي", path: "/my-projects", group: "التنقل الرئيسي", allow: [], rule: "متاح لكل مستخدم مسجّل الدخول." },
  { key: "profile", label: "الملف الشخصي", path: "/profile", group: "التنقل الرئيسي", allow: [], rule: "متاح لكل مستخدم مسجّل الدخول." },
  { key: "team", label: "الفريق", path: "/team", group: "التنقل الرئيسي", allow: ["admin", "general_manager", "manager"], rule: "يتطلب دور مدير أو أعلى (manager / general_manager / admin)." },
  { key: "projects", label: "المشاريع", path: "/projects", group: "التنقل الرئيسي", allow: ["admin", "general_manager", "manager"], rule: "يتطلب دور مدير أو أعلى (manager / general_manager / admin)." },
  { key: "reports", label: "التقارير", path: "/reports", group: "التنقل الرئيسي", allow: ["admin", "general_manager", "manager"], rule: "يتطلب دور مدير أو أعلى (manager / general_manager / admin)." },
  { key: "alerts", label: "التنبيهات", path: "/alerts", group: "التنقل الرئيسي", allow: ["admin", "general_manager", "manager"], rule: "يتطلب دور مدير أو أعلى (manager / general_manager / admin)." },

  { key: "settings", label: "الإعدادات (الصفحة الرئيسية)", path: "/settings", group: "الإعدادات", allow: ["admin", "support"], rule: "قسم الإعدادات متاح للإداري (admin) والدعم الفني (support) فقط." },
  { key: "settings-modules", label: "أنظمة الشركة (Modules)", path: "/settings/modules", group: "الإعدادات", allow: ["admin", "support"], rule: "داخل قسم الإعدادات: admin أو support." },
  { key: "settings-smtp", label: "إعدادات SMTP", path: "/settings/smtp", group: "الإعدادات", allow: ["admin", "support"], rule: "داخل قسم الإعدادات: admin أو support." },
  { key: "settings-automation", label: "محرك الأتمتة", path: "/settings/automation", group: "الإعدادات", allow: ["admin", "support"], rule: "داخل قسم الإعدادات: admin أو support." },
  { key: "settings-audit", label: "سجل التدقيق الأمني", path: "/settings/audit", group: "الإعدادات", allow: ["admin", "support"], rule: "داخل قسم الإعدادات: admin أو support (سياسات RLS تسمح بالقراءة لـ admin/general_manager)." },

  { key: "admin-overview", label: "مركز القيادة", path: "/admin/overview", group: "الإدارة", allow: ["admin", "general_manager"], rule: "يتطلب دور admin أو general_manager." },
  { key: "admin", label: "الموظفون", path: "/admin", group: "الإدارة", allow: ["admin"], rule: "يتطلب دور admin فقط." },
  { key: "admin-hierarchy", label: "الهيكل التنظيمي", path: "/admin/hierarchy", group: "الإدارة", allow: ["admin"], rule: "يتطلب دور admin فقط." },
  { key: "admin-roles", label: "إدارة الأدوار", path: "/admin/roles", group: "الإدارة", allow: ["admin"], rule: "يتطلب دور admin فقط." },
  { key: "admin-permissions", label: "مصفوفة الصلاحيات", path: "/admin/permissions", group: "الإدارة", allow: ["admin"], rule: "يتطلب دور admin فقط." },
  { key: "admin-permissions-check", label: "فحص الصلاحيات", path: "/admin/permissions-check", group: "الإدارة", allow: ["admin"], rule: "يتطلب دور admin فقط." },
  { key: "admin-permissions-diagnose", label: "تشخيص الصلاحيات", path: "/admin/permissions-diagnose", group: "الإدارة", allow: ["admin"], rule: "يتطلب دور admin فقط." },
  { key: "admin-email-provider", label: "مزوّد البريد الإلكتروني", path: "/admin/email-provider", group: "الإدارة", allow: ["admin"], rule: "يتطلب دور admin فقط." },
];

export function evaluateRule(rule: AccessRule, roles: string[]) {
  const allowed = rule.allow.length === 0 || rule.allow.some((r) => roles.includes(r));
  const reason = allowed
    ? rule.allow.length === 0
      ? "مسموح: لا توجد قيود على هذه الشاشة."
      : `مسموح بسبب الدور: ${rule.allow.filter((r) => roles.includes(r)).join("، ")}`
    : roles.length === 0
      ? "محجوب: المستخدم لا يملك أي دور في جدول user_roles."
      : `محجوب: الأدوار الحالية (${roles.join("، ")}) لا تتضمن أيًا من الأدوار المطلوبة (${rule.allow.join("، ")}).`;
  return { allowed, reason };
}
