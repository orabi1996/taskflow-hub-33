import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { ShieldCheck, ArrowLeft, Check, X } from "lucide-react";

export const Route = createFileRoute("/_app/admin/permissions")({
  head: () => ({
    meta: [{ title: "مصفوفة الصلاحيات — لوحة التحكم" }],
  }),
  component: PermissionsMatrixPage,
});

type Role = "admin" | "general_manager" | "manager" | "employee" | "support";

const ROLE_LABEL: Record<Role, string> = {
  admin: "أدمن",
  general_manager: "مدير عام",
  manager: "مدير",
  employee: "موظف",
  support: "دعم فني",
};

interface Row {
  area: string;
  action: string;
  perms: Partial<Record<Role, boolean>>;
}

const MATRIX: Row[] = [
  // Dashboards / pages
  { area: "لوحة المهام (مهامي)", action: "عرض المهام الخاصة", perms: { admin: true, general_manager: true, manager: true, employee: true } },
  { area: "لوحة المهام", action: "عرض كل المهام", perms: { admin: true, general_manager: true, manager: true } },
  { area: "صفحة الفريق", action: "الوصول", perms: { admin: true, general_manager: true, manager: true } },
  { area: "صفحة المشاريع (إدارة)", action: "الوصول", perms: { admin: true, general_manager: true, manager: true } },
  { area: "مشاريعي", action: "الوصول لكل مستخدم", perms: { admin: true, general_manager: true, manager: true, employee: true } },
  { area: "التقارير", action: "الوصول", perms: { admin: true, general_manager: true, manager: true } },
  { area: "الإعدادات", action: "الوصول", perms: { admin: true, support: true } },
  { area: "إدارة الموظفين (/admin)", action: "الوصول", perms: { admin: true } },
  { area: "إدارة الأدوار (/admin/roles)", action: "الوصول", perms: { admin: true } },
  { area: "سجل التدقيق (Audit)", action: "العرض", perms: { admin: true, general_manager: true } },
  { area: "سجل التدقيق", action: "تصدير CSV/Excel", perms: { admin: true } },
  // Projects
  { area: "المشاريع", action: "إنشاء", perms: { admin: true, general_manager: true, manager: true } },
  { area: "المشاريع", action: "تعديل", perms: { admin: true, general_manager: true, manager: true } },
  { area: "المشاريع", action: "حذف", perms: { admin: true, general_manager: true } },
  { area: "أعضاء المشروع", action: "إدارة", perms: { admin: true, general_manager: true, manager: true } },
  // Tasks
  { area: "المهام", action: "إنشاء (خاصة)", perms: { admin: true, general_manager: true, manager: true, employee: true } },
  { area: "المهام", action: "تعديل (الخاصة)", perms: { admin: true, general_manager: true, manager: true, employee: true } },
  { area: "المهام", action: "تعديل مهام الفريق", perms: { admin: true, general_manager: true, manager: true } },
  { area: "المهام", action: "حذف", perms: { admin: true } },
  // Clients
  { area: "العملاء", action: "إنشاء/تعديل", perms: { admin: true, general_manager: true, manager: true } },
  { area: "العملاء", action: "حذف", perms: { admin: true, general_manager: true } },
  // Notifications & system
  { area: "إشعارات", action: "إدارة الخاصة", perms: { admin: true, general_manager: true, manager: true, employee: true, support: true } },
  { area: "SMTP / إعدادات البريد", action: "إدارة", perms: { admin: true, support: true } },
  { area: "قواعد الأتمتة", action: "إدارة", perms: { admin: true, support: true } },
];

const ROLES: Role[] = ["admin", "general_manager", "manager", "employee", "support"];

function PermissionsMatrixPage() {
  const { roles } = useAuth();
  const isAllowed = roles.includes("admin") || roles.includes("general_manager");

  if (!isAllowed) {
    return (
      <Card className="p-12 text-center">
        <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground">هذه الصفحة متاحة للأدمن والمدير العام فقط.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">مصفوفة الصلاحيات</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            من يمكنه الوصول لكل صفحة وإجراء داخل النظام.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/permissions-check">
              فحص الصلاحيات الفعلية
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin">
              <ArrowLeft className="h-4 w-4 ms-1" />
              للموظفين
            </Link>
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-start px-3 py-3 font-semibold">المنطقة</th>
                <th className="text-start px-3 py-3 font-semibold">الإجراء</th>
                {ROLES.map((r) => (
                  <th key={r} className="text-center px-3 py-3 font-semibold">
                    {ROLE_LABEL[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((row, i) => (
                <tr key={i} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{row.area}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.action}</td>
                  {ROLES.map((r) => (
                    <td key={r} className="px-3 py-2 text-center">
                      {row.perms[r] ? (
                        <Check className="h-4 w-4 mx-auto text-emerald-600" />
                      ) : (
                        <X className="h-4 w-4 mx-auto text-muted-foreground/30" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4 bg-muted/30 text-xs text-muted-foreground space-y-1">
        <div>
          <Badge variant="outline" className="me-2">ملاحظة</Badge>
          الصلاحيات الفعلية مفروضة على مستوى قاعدة البيانات عبر سياسات RLS وليس فقط من الواجهة.
        </div>
        <p>"مدير" يرى مهام فريقه المباشر فقط. "أدمن" و"مدير عام" يرون كل البيانات.</p>
      </Card>
    </div>
  );
}
