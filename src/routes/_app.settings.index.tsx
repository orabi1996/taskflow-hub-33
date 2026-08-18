import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import {
  ServerCog,
  ArrowLeft,
  Bot,
  Boxes,
  ShieldCheck,
  Network,
  UserCog,
  Grid3X3,
  SearchCheck,
  Mail,
} from "lucide-react";

export const Route = createFileRoute("/_app/settings/")({
  component: SettingsIndex,
});

function SettingsIndex() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");

  const items = [
    {
      to: "/settings/modules",
      icon: Boxes,
      title: "أنظمة الشركة (Modules)",
      desc: "خريطة الأنظمة الفرعية للشركة (ERP، المنصة التعليمية، Edumall، Cpay…) وإسناد الموظفين لكل نظام.",
      adminOnly: false,
    },
    {
      to: "/settings/smtp",
      icon: ServerCog,
      title: "إعدادات SMTP",
      desc: "إعداد خادم البريد الصادر (Host, Port, Credentials) واختبار الإرسال.",
      adminOnly: false,
    },
    {
      to: "/settings/automation",
      icon: Bot,
      title: "محرك الأتمتة",
      desc: "قواعد تلقائية لتنبيه الفريق على المهام المتأخرة، المواعيد القريبة، وانتهاء العقود.",
      adminOnly: false,
    },
    {
      to: "/settings/audit",
      icon: ShieldCheck,
      title: "سجل التدقيق الأمني",
      desc: "جميع الأحداث الحساسة في النظام: تسجيل الدخول، تغيير الصلاحيات، التعديلات الإدارية.",
      adminOnly: false,
    },
    {
      to: "/admin/hierarchy",
      icon: Network,
      title: "الهيكل التنظيمي",
      desc: "الأقسام، المسميات الوظيفية، وشجرة التبعية الإدارية بين الموظفين.",
      adminOnly: true,
    },
    {
      to: "/admin/roles",
      icon: UserCog,
      title: "إدارة الأدوار",
      desc: "منح وسحب أدوار المستخدمين (إداري، مدير عام، مدير، موظف، دعم فني).",
      adminOnly: true,
    },
    {
      to: "/admin/permissions",
      icon: Grid3X3,
      title: "مصفوفة الصلاحيات",
      desc: "عرض تفصيلي لما يستطيع كل دور فعله داخل كل شاشة في النظام.",
      adminOnly: true,
    },
    {
      to: "/admin/permissions-check",
      icon: SearchCheck,
      title: "فحص الصلاحيات",
      desc: "اختبار صلاحيات مستخدم محدد والتحقق من وصوله للبيانات الحساسة.",
      adminOnly: true,
    },
    {
      to: "/admin/email-provider",
      icon: Mail,
      title: "مزوّد البريد الإلكتروني",
      desc: "إعداد مزوّد إرسال رسائل النظام (الدعوات، إعادة تعيين كلمة المرور، التنبيهات).",
      adminOnly: true,
    },
  ].filter((it) => !it.adminOnly || isAdmin);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => (
        <Link key={it.to} to={it.to}>
          <Card className="p-5 hover:shadow-md transition-all hover:border-primary/40 h-full">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <it.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-semibold mb-1 flex items-center gap-2">
                  {it.title}
                  <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="text-sm text-muted-foreground">{it.desc}</div>
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
