import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Laptop, ServerCog, Settings as SettingsIcon, ShieldAlert, Bot, Boxes, ShieldCheck, Network, UserCog, Grid3X3, SearchCheck, Mail, Stethoscope, Users, Bell } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const isSupport = (roles as string[]).includes("support");
  const canAccess = isAdmin || isSupport;
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!canAccess) {
    return (
      <Card className="p-8 text-center max-w-md mx-auto">
        <ShieldAlert className="h-10 w-10 mx-auto text-destructive mb-3" />
        <div className="font-semibold mb-1">صلاحيات غير كافية</div>
        <div className="text-sm text-muted-foreground">صفحة الإعدادات متاحة للإداري والدعم الفني فقط.</div>
      </Card>
    );
  }

  const tabs = [
    { to: "/settings", label: "نظرة عامة", icon: SettingsIcon, exact: true },
    { to: "/settings/employees", label: "الموظفون والصلاحيات", icon: Users, exact: false },
    { to: "/settings/modules", label: "أنظمة الشركة", icon: Boxes, exact: false },
    { to: "/settings/smtp", label: "SMTP", icon: ServerCog, exact: false },
    { to: "/settings/automation", label: "الأتمتة", icon: Bot, exact: false },
    { to: "/settings/notifications", label: "الإشعارات", icon: Bell, exact: false },
    { to: "/settings/audit", label: "سجل التدقيق", icon: ShieldCheck, exact: false },
    { to: "/settings/security", label: "أمان الجلسة", icon: ShieldAlert, exact: false },
    { to: "/settings/devices", label: "الأجهزة الموثوقة", icon: Laptop, exact: false },
    ...(isAdmin
      ? [{ to: "/settings/access-review", label: "مراجعة الصلاحيات", icon: ShieldCheck, exact: false }]
      : []),
    ...(isAdmin
      ? [
          { to: "/admin/hierarchy", label: "الهيكل التنظيمي", icon: Network, exact: false },
          { to: "/admin/roles", label: "إدارة الأدوار", icon: UserCog, exact: false },
          { to: "/admin/permissions", label: "مصفوفة الصلاحيات", icon: Grid3X3, exact: false },
          { to: "/admin/permissions-check", label: "فحص الصلاحيات", icon: SearchCheck, exact: false },
          { to: "/admin/permissions-diagnose", label: "تشخيص الصلاحيات", icon: Stethoscope, exact: false },
          { to: "/admin/email-provider", label: "مزوّد البريد", icon: Mail, exact: false },
        ]
      : []),
  ];

  const isActive = (to: string, exact: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="space-y-6">
      <PageHeader title="الإعدادات" description="إعدادات الحساب والنظام" icon={SettingsIcon} />

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {tabs.map((t) => {
          const active = isActive(t.to, t.exact);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                active ? "bg-primary text-primary-foreground" : "hover:bg-accent/40"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </div>

      <Outlet />
    </div>
  );
}
