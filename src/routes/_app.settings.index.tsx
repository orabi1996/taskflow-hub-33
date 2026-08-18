import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { ServerCog, ArrowLeft, Bot, Boxes, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_app/settings/")({
  component: SettingsIndex,
});

function SettingsIndex() {
  const items = [
    {
      to: "/settings/modules",
      icon: Boxes,
      title: "أنظمة الشركة (Modules)",
      desc: "خريطة الأنظمة الفرعية للشركة (ERP، المنصة التعليمية، Edumall، Cpay…) وإسناد الموظفين لكل نظام.",
    },
    {
      to: "/settings/smtp",
      icon: ServerCog,
      title: "إعدادات SMTP",
      desc: "إعداد خادم البريد الصادر (Host, Port, Credentials) واختبار الإرسال.",
    },
    {
      to: "/settings/automation",
      icon: Bot,
      title: "محرك الأتمتة",
      desc: "قواعد تلقائية لتنبيه الفريق على المهام المتأخرة، المواعيد القريبة، وانتهاء العقود.",
    },
    {
      to: "/settings/audit",
      icon: ShieldCheck,
      title: "سجل التدقيق الأمني",
      desc: "جميع الأحداث الحساسة في النظام: تسجيل الدخول، تغيير الصلاحيات، التعديلات الإدارية.",
    },
  ];

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
