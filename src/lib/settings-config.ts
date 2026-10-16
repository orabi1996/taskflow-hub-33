import {
  Building2,
  Boxes,
  Activity,
  Users,
  Network,
  ShieldCheck,
  UserCog,
  Grid3X3,
  SearchCheck,
  Stethoscope,
  ServerCog,
  Mail,
  Bot,
  Bell,
  ShieldAlert,
  Laptop,
  LucideIcon,
} from "lucide-react";

export interface SettingItem {
  id: string;
  to: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  exact?: boolean;
  adminOnly?: boolean;
  badge?: string;
  tags: string[];
}

export interface SettingCategory {
  id: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  accentColor: string; // for border/glow
  badgeBg: string;
  adminOnly?: boolean;
  items: SettingItem[];
}

export const SETTINGS_CATEGORIES: SettingCategory[] = [
  {
    id: "organization",
    title: "المنشأة والأنظمة",
    desc: "بيانات المنشأة الرسمية، الشعار والختم، العملة، أنظمة ERP و LMS، ومركز القيادة.",
    icon: Building2,
    accentColor: "from-teal-500/20 to-emerald-500/10 border-teal-500/30",
    badgeBg: "bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30",
    items: [
      {
        id: "org-profile",
        to: "/settings/organization",
        label: "هوية المنشأة والـ Webhooks",
        desc: "اسم المؤسسة، الشعار والختم الرقمي، السجل والعملة، وقنوات ربط Slack/Discord/Teams.",
        icon: Building2,
        tags: ["هوية", "شعار", "ختم", "سجل", "webhooks", "slack", "discord", "teams", "شركة"],
      },
      {
        id: "company-modules",
        to: "/settings/modules",
        label: "أنظمة الشركة (Modules)",
        desc: "خريطة الأنظمة والموديولات التابعة (ERP، المنصة التعليمية، Edumall) وإسناد الموظفين.",
        icon: Boxes,
        tags: ["أنظمة", "موديولات", "erp", "lms", "classera", "csmarx", "modules"],
      },
      {
        id: "command-center",
        to: "/admin/overview",
        label: "مركز القيادة الموحد",
        desc: "لوحة موحدة لمؤشرات المهام والمشاريع والموظفين والأتمتة الحية عبر كل الأنظمة.",
        icon: Activity,
        adminOnly: true,
        badge: "إداري",
        tags: ["مركز القيادة", "مؤشرات", "لوحة", "إدارة عليا", "overview", "kpi"],
      },
    ],
  },
  {
    id: "workforce",
    title: "الموظفون والهيكل الإداري",
    desc: "حسابات الموظفين، الأقسام، شجرة التبعية الإدارية، والمراجعة الدورية للصلاحيات.",
    icon: Users,
    accentColor: "from-blue-500/20 to-cyan-500/10 border-blue-500/30",
    badgeBg: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
    adminOnly: true,
    items: [
      {
        id: "employees-management",
        to: "/settings/employees",
        label: "شؤون وحسابات الموظفين",
        desc: "بيانات الموظفين، الأقسام، المسميات الوظيفية، المدير المباشر، وتفعيل أو إيقاف الحسابات.",
        icon: Users,
        adminOnly: true,
        tags: ["موظفين", "أقسام", "حسابات", "إيقاف", "تفعيل", "فريق"],
      },
      {
        id: "org-hierarchy",
        to: "/admin/hierarchy",
        label: "الهيكل التنظيمي",
        desc: "الأقسام والمسميات الوظيفية وشجرة التبعية الإدارية التفاعلية بين الموظفين والمديرين.",
        icon: Network,
        adminOnly: true,
        tags: ["هيكل", "شجرة", "إدارة", "أقسام", "مسميات", "رؤساء"],
      },
      {
        id: "access-review",
        to: "/settings/access-review",
        label: "مراجعة الصلاحيات الدورية",
        desc: "فحص الحسابات ذات الصلاحيات المرتفعة، وكشف الحسابات الخاملة، وسحب الأدوار غير المبررة.",
        icon: ShieldCheck,
        adminOnly: true,
        tags: ["مراجعة", "تدقيق", "صلاحيات دورية", "خاملة", "أمان"],
      },
    ],
  },
  {
    id: "permissions",
    title: "الأدوار ومصفوفة الصلاحيات",
    desc: "منح وسحب أدوار المستخدمين، جدول مصفوفة الصلاحيات، وفحص وتشخيص الوصول.",
    icon: UserCog,
    accentColor: "from-purple-500/20 to-indigo-500/10 border-purple-500/30",
    badgeBg: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
    adminOnly: true,
    items: [
      {
        id: "roles-mgmt",
        to: "/admin/roles",
        label: "إدارة وتعيين الأدوار",
        desc: "منح وسحب أدوار النظام (إداري، مدير عام، مدير قسم، موظف، دعم فني) بدقة وأمان.",
        icon: UserCog,
        adminOnly: true,
        tags: ["أدوار", "منح", "سحب", "admin", "manager", "support"],
      },
      {
        id: "permissions-matrix",
        to: "/admin/permissions",
        label: "مصفوفة الصلاحيات",
        desc: "استعراض تفصيلي ومقارنة لما يملكه كل دور داخل كل شاشة وموديول في النظام.",
        icon: Grid3X3,
        adminOnly: true,
        tags: ["مصفوفة", "جدول صلاحيات", "شاشات", "قراءة", "كتابة"],
      },
      {
        id: "permissions-check",
        to: "/admin/permissions-check",
        label: "فحص صلاحيات مستخدم",
        desc: "محاكاة واختبار صلاحيات موظف معين للتأكد من قدرته على فتح البيانات والشاشات المناسبة.",
        icon: SearchCheck,
        adminOnly: true,
        tags: ["فحص", "مستخدم", "اختبار", "test"],
      },
      {
        id: "permissions-diagnose",
        to: "/admin/permissions-diagnose",
        label: "تشخيص وحل الحجب",
        desc: "أداة ذكية لمعرفة سبب حجب أي شاشة أو إعداد عن أي مستخدم وتوجيه طريقة منحها.",
        icon: Stethoscope,
        adminOnly: true,
        tags: ["تشخيص", "حجب", "لماذا محجوب", "فك حجب", "diagnose"],
      },
    ],
  },
  {
    id: "communications",
    title: "الاتصالات ومحرك الأتمتة",
    desc: "خوادم البريد الصادر، سجلات رسائل النظام، محرك قواعد الأتمتة، وتفضيلات التنبيهات.",
    icon: Bot,
    accentColor: "from-amber-500/20 to-orange-500/10 border-amber-500/30",
    badgeBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    items: [
      {
        id: "smtp-settings",
        to: "/settings/smtp",
        label: "خدمة البريد SMTP",
        desc: "إعداد خادم البريد الصادر (Host, Port, Credentials) وتجربة الإرسال الحي.",
        icon: ServerCog,
        tags: ["smtp", "بريد", "إيميل", "خادم", "إرسال"],
      },
      {
        id: "email-provider-log",
        to: "/admin/email-provider",
        label: "مزوّد وسجل الإيميلات",
        desc: "مراقبة سجل الرسائل المرسلة من النظام، حالات الفشل والنجاح، وتكاملات المزود.",
        icon: Mail,
        adminOnly: true,
        badge: "سجل",
        tags: ["سجل إيميلات", "مزود بريد", "تسليم", "رسائل", "فشل"],
      },
      {
        id: "automation-engine",
        to: "/settings/automation",
        label: "محرك وقواعد الأتمتة",
        desc: "قواعد التنبيهات التلقائية لخروقات الـ SLA، قرب انتهاء العقود، ومطالبات اليومية.",
        icon: Bot,
        tags: ["أتمتة", "قواعد", "sla", "تنبيه آلي", "cron", "عقود"],
      },
      {
        id: "notification-prefs",
        to: "/settings/notifications",
        label: "تفضيلات الإشعارات",
        desc: "إشعارات المتصفح الفورية على الجهاز، قنوات التنبيه، ساعات الهدوء، وتخصيص الأصوات.",
        icon: Bell,
        tags: ["إشعارات", "تنبيهات", "متصفح", "أصوات", "هدوء"],
      },
    ],
  },
  {
    id: "security",
    title: "الأمان وسجل الامتثال",
    desc: "سجل التدقيق الأمني (Audit Logs)، حماية الجلسة عند الخمول، وإدارة الأجهزة الموثوقة.",
    icon: ShieldAlert,
    accentColor: "from-rose-500/20 to-red-500/10 border-rose-500/30",
    badgeBg: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
    items: [
      {
        id: "audit-logs",
        to: "/settings/audit",
        label: "سجل التدقيق الأمني (Audit Logs)",
        desc: "سجل متكامل للأحداث الحساسة: عمليات تسجيل الدخول، تعديل الأدوار، والتغييرات الإدارية.",
        icon: ShieldCheck,
        tags: ["تدقيق", "audit", "أمان", "سجلات", "دخول", "تعديل"],
      },
      {
        id: "session-security",
        to: "/settings/security",
        label: "أمان الجلسة والمهلة",
        desc: "تحديد مدة الخمول المسموحة قبل تسجيل الخروج التلقائي لحماية الحساب عند ترك الجهاز.",
        icon: ShieldAlert,
        tags: ["أمان", "جلسة", "خمول", "تسجيل خروج", "session"],
      },
      {
        id: "trusted-devices",
        to: "/settings/devices",
        label: "الأجهزة الموثوقة",
        desc: "استعراض الأجهزة والمتصفحات المسجلة مع آخر ظهور، وإمكانية إلغاء تفويض أي جهاز غريب.",
        icon: Laptop,
        tags: ["أجهزة", "متصفحات", "جلسات نشطة", "تسجيل خروج أجهزة", "devices"],
      },
    ],
  },
];
