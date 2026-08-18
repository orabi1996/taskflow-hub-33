import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ArrowLeft, RefreshCw, Loader2, Check, X } from "lucide-react";

export const Route = createFileRoute("/_app/admin/permissions-check")({
  head: () => ({ meta: [{ title: "فحص الصلاحيات الفعلية" }] }),
  component: PermissionsCheckPage,
});

interface CheckResult {
  label: string;
  description: string;
  ok: boolean | null;
  count?: number;
  error?: string;
}

function PermissionsCheckPage() {
  const { roles, user, profile, refresh } = useAuth();
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);

  const checks = async (): Promise<CheckResult[]> => {
    const out: CheckResult[] = [];
    const probe = async (label: string, description: string, fn: () => Promise<{ count?: number; error?: string }>) => {
      try {
        const r = await fn();
        out.push({ label, description, ok: !r.error, count: r.count, error: r.error });
      } catch (e: any) {
        out.push({ label, description, ok: false, error: e?.message ?? String(e) });
      }
    };

    await probe("user_roles (own)", "قراءة أدوار المستخدم الحالي", async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role", { count: "exact", head: false })
        .eq("user_id", user!.id);
      return { count: data?.length, error: error?.message };
    });
    await probe("profiles", "قراءة جدول البروفايلات", async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true });
      return { count: count ?? 0, error: error?.message };
    });
    await probe("projects", "قراءة جدول المشاريع", async () => {
      const { count, error } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true });
      return { count: count ?? 0, error: error?.message };
    });
    await probe("tasks", "قراءة جدول المهام", async () => {
      const { count, error } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true });
      return { count: count ?? 0, error: error?.message };
    });
    await probe("audit_logs", "قراءة سجل التدقيق (يحتاج admin/general_manager)", async () => {
      const { count, error } = await supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true });
      return { count: count ?? 0, error: error?.message };
    });
    await probe("departments", "قراءة الأقسام", async () => {
      const { count, error } = await supabase
        .from("departments")
        .select("id", { count: "exact", head: true });
      return { count: count ?? 0, error: error?.message };
    });
    await probe("notifications (own)", "قراءة الإشعارات الخاصة", async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id);
      return { count: count ?? 0, error: error?.message };
    });
    // Settings page backings
    await probe("smtp_settings", "إعدادات البريد (admin/support)", async () => {
      const { count, error } = await supabase
        .from("smtp_settings").select("id", { count: "exact", head: true });
      return { count: count ?? 0, error: error?.message };
    });
    await probe("automation_rules", "قواعد الأتمتة (admin/support)", async () => {
      const { count, error } = await supabase
        .from("automation_rules").select("id", { count: "exact", head: true });
      return { count: count ?? 0, error: error?.message };
    });
    await probe("company_modules", "أنظمة الشركة (الإعدادات)", async () => {
      const { count, error } = await supabase
        .from("company_modules").select("id", { count: "exact", head: true });
      return { count: count ?? 0, error: error?.message };
    });
    // Reports page backings
    await probe("time_entries", "قراءة سجلات الوقت (التقارير)", async () => {
      const { count, error } = await supabase
        .from("time_entries").select("id", { count: "exact", head: true });
      return { count: count ?? 0, error: error?.message };
    });
    // Employees / Team page backings
    await probe("user_roles (all)", "قراءة أدوار كل المستخدمين (admin/GM)", async () => {
      const { count, error } = await supabase
        .from("user_roles").select("user_id", { count: "exact", head: true });
      return { count: count ?? 0, error: error?.message };
    });
    await probe("job_positions", "المسميات الوظيفية (الموظفين)", async () => {
      const { count, error } = await supabase
        .from("job_positions").select("id", { count: "exact", head: true });
      return { count: count ?? 0, error: error?.message };
    });
    await probe("login_attempts", "محاولات الدخول (admin/GM)", async () => {
      const { count, error } = await supabase
        .from("login_attempts").select("id", { count: "exact", head: true });
      return { count: count ?? 0, error: error?.message };
    });
    return out;
  };

  // Expected sidebar links per role
  const isAdmin = roles.includes("admin");
  const isGM = roles.includes("general_manager");
  const isMgrPlus = isAdmin || isGM || roles.includes("manager");
  const isSupport = (roles as string[]).includes("support");
  const navExpectations: { label: string; path: string; visible: boolean }[] = [
    { label: "لوحة التحكم", path: "/dashboard", visible: true },
    { label: "مهامي", path: "/dashboard", visible: true },
    { label: "الوقت", path: "/time", visible: true },
    { label: "المشاريع (إدارة)", path: "/projects", visible: isMgrPlus },
    { label: "مشاريعي", path: "/my-projects", visible: true },
    { label: "الفريق", path: "/team", visible: isMgrPlus },
    { label: "التقارير", path: "/reports", visible: isMgrPlus },
    { label: "التنبيهات", path: "/alerts", visible: isMgrPlus },
    { label: "الإعدادات", path: "/settings", visible: isAdmin || isSupport },
    { label: "إدارة الموظفين", path: "/admin", visible: isAdmin },
    { label: "إدارة الأدوار", path: "/admin/roles", visible: isAdmin },
    { label: "سجل التدقيق", path: "/settings/audit", visible: isAdmin || isGM },
  ];

  const run = async () => {
    setRunning(true);
    await refresh(); // reload roles first
    setResults(await checks());
    setRunning(false);
  };

  useEffect(() => {
    if (user) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">فحص الصلاحيات الفعلية</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            يعرض الأدوار المفعّلة ويختبر القراءات الأساسية على قاعدة البيانات.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={run} disabled={running} size="sm">
            {running ? <Loader2 className="h-4 w-4 ms-1 animate-spin" /> : <RefreshCw className="h-4 w-4 ms-1" />}
            إعادة الفحص
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/permissions">
              <ArrowLeft className="h-4 w-4 ms-1" />
              مصفوفة الصلاحيات
            </Link>
          </Button>
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div className="font-semibold">الأدوار الحالية</div>
        </div>
        <div className="text-sm space-y-1">
          <div>
            <span className="text-muted-foreground">المستخدم:</span>{" "}
            <span className="font-medium">{profile?.full_name || user?.email}</span>
          </div>
          <div>
            <span className="text-muted-foreground">UID:</span>{" "}
            <span className="font-mono text-xs">{user?.id}</span>
          </div>
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="text-muted-foreground">الأدوار:</span>
            {roles.length === 0 ? (
              <Badge variant="destructive">لا توجد أدوار</Badge>
            ) : (
              roles.map((r) => <Badge key={r}>{r}</Badge>)
            )}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-start px-3 py-3 font-semibold w-12">الحالة</th>
                <th className="text-start px-3 py-3 font-semibold">الفحص</th>
                <th className="text-start px-3 py-3 font-semibold">الوصف</th>
                <th className="text-start px-3 py-3 font-semibold">العدد</th>
                <th className="text-start px-3 py-3 font-semibold">الخطأ</th>
              </tr>
            </thead>
            <tbody>
              {running && results.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 mx-auto animate-spin" />
                  </td>
                </tr>
              )}
              {results.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2">
                    {r.ok ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <X className="h-4 w-4 text-destructive" />
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.label}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.description}</td>
                  <td className="px-3 py-2">
                    {typeof r.count === "number" ? (
                      <Badge variant="outline">{r.count}</Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-destructive">{r.error ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div className="font-semibold">الروابط المتوقع ظهورها لدورك الحالي</div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {navExpectations.map((n) => (
            <div
              key={n.path}
              className="flex items-center justify-between border rounded px-3 py-2 text-sm"
            >
              <div>
                <div className="font-medium">{n.label}</div>
                <div className="text-xs text-muted-foreground font-mono">{n.path}</div>
              </div>
              {n.visible ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600">ظاهر</Badge>
              ) : (
                <Badge variant="outline">مخفي</Badge>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
