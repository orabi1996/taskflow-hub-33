import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getCommandCenter } from "@/lib/command-center.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Activity, AlertTriangle, BarChart3, Bell, CheckCircle2, FolderKanban,
  Loader2, RefreshCw, ShieldCheck, Target, Users2, Zap,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

export const Route = createFileRoute("/_app/admin/overview")({
  component: CommandCenter,
  head: () => ({
    meta: [
      { title: "مركز القيادة | C-SmarX" },
      { name: "description", content: "لوحة موحّدة لمؤشرات المهام والمشاريع والموظفين والأتمتة عبر كل الأنظمة." },
      { property: "og:title", content: "مركز القيادة | C-SmarX" },
      { property: "og:description", content: "لوحة موحّدة لمؤشرات المهام والمشاريع والموظفين والأتمتة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Data = Awaited<ReturnType<typeof getCommandCenter>>;

function CommandCenter() {
  const { roles } = useAuth();
  const allowed = roles.some((r) => ["admin", "general_manager"].includes(r));
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getCommandCenter());
    } catch (e: any) {
      setError(e?.message || "تعذّر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) void load();
    else setLoading(false);
  }, [allowed]);

  if (!allowed) {
    return (
      <Card className="p-10 text-center">
        <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground">هذه الصفحة متاحة لمدير النظام والمدير العام فقط.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">مركز القيادة</h1>
            <p className="text-sm text-muted-foreground">نظرة موحّدة على كل ما يحدث في النظام</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ms-2">تحديث</span>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link to="/reports">
              <BarChart3 className="h-4 w-4 ms-2" /> التقارير التفصيلية
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <Card className="p-4 border-destructive/40 text-destructive text-sm">{error}</Card>
      )}

      {loading && !data && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              icon={CheckCircle2}
              label="المهام"
              value={data.tasks.total}
              hint={`${data.tasks.completionRate}% مكتملة · ${data.tasks.completedLast30} خلال 30 يومًا`}
            />
            <Kpi
              icon={AlertTriangle}
              label="مهام متأخرة"
              value={data.tasks.overdue}
              hint={`${data.tasks.byStatus.pending ?? 0} قيد التنفيذ · ${data.tasks.byStatus.postponed ?? 0} مؤجلة`}
              tone={data.tasks.overdue > 0 ? "warn" : "ok"}
            />
            <Kpi
              icon={FolderKanban}
              label="المشاريع"
              value={data.projects.total}
              hint={`${data.projects.active} نشط · ${data.projects.atRisk} تحتاج متابعة`}
            />
            <Kpi
              icon={Users2}
              label="الموظفون"
              value={data.people.active}
              hint={`${data.people.disabled} موقوف عن الدخول`}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              icon={Target}
              label={`الأهداف (Q${data.period.quarter})`}
              value={`${data.okrs.avgProgress}%`}
              hint={`${data.okrs.count} هدفًا هذا الربع`}
            />
            <Kpi
              icon={Zap}
              label="الأتمتة"
              value={`${data.automation.active}/${data.automation.total}`}
              hint={data.automation.lastRun ? `آخر تشغيل: ${fmt(data.automation.lastRun)}` : "لم تُشغَّل بعد"}
            />
            <Kpi
              icon={Bell}
              label="إشعارات (24 ساعة)"
              value={data.notificationsLast24}
              hint="عبر التطبيق والبريد والـ Push"
            />
            <Kpi
              icon={ShieldCheck}
              label="التقدير (30 يومًا)"
              value={data.kudosLast30}
              hint="رسائل شكر بين الزملاء"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="font-semibold mb-4">توزيع المهام حسب النظام</h2>
              {data.moduleBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد بيانات.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.moduleBreakdown.slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="total" name="إجمالي" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="completed" name="مكتملة" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="font-semibold mb-4">أعلى الموظفين إنجازًا</h2>
              {data.topPerformers.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد بيانات.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الموظف</TableHead>
                      <TableHead>مكتملة</TableHead>
                      <TableHead>متأخرة</TableHead>
                      <TableHead className="w-32">الإنجاز</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topPerformers.map((p) => (
                      <TableRow key={p.user_id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{p.completed}/{p.total}</TableCell>
                        <TableCell>
                          {p.overdue > 0 ? (
                            <Badge variant="destructive">{p.overdue}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={p.rate} className="h-2" />
                            <span className="text-xs text-muted-foreground w-9">{p.rate}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="font-semibold mb-4">عقود تنتهي خلال 30 يومًا</h2>
              {data.projects.expiringContracts.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد عقود قريبة الانتهاء.</p>
              ) : (
                <ul className="space-y-2">
                  {data.projects.expiringContracts.map((p) => (
                    <li key={p.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                      <Link to="/projects/$projectId" params={{ projectId: p.id }} className="hover:underline">
                        {p.name}
                      </Link>
                      <Badge variant="outline">{p.contract_end_date}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="font-semibold mb-4">آخر الأحداث الأمنية والتشغيلية</h2>
              {data.recentAudit.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد أحداث.</p>
              ) : (
                <ul className="space-y-2">
                  {data.recentAudit.map((a: any) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 text-sm border-b pb-2 last:border-0">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{a.event_type}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {a.actor_email || "النظام"} · {a.resource_type}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">{fmt(a.created_at)}</div>
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild variant="ghost" size="sm" className="mt-3">
                <Link to="/admin/audit">عرض كل السجل</Link>
              </Button>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function fmt(v: string) {
  try {
    return new Date(v).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return v;
  }
}

function Kpi({
  icon: Icon, label, value, hint, tone,
}: {
  icon: typeof Activity;
  label: string;
  value: number | string;
  hint?: string;
  tone?: "ok" | "warn";
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className={`text-3xl font-bold mt-1 ${tone === "warn" ? "text-destructive" : ""}`}>{value}</div>
          {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
        </div>
        <Icon className={`h-5 w-5 ${tone === "warn" ? "text-destructive" : "text-primary"}`} />
      </div>
    </Card>
  );
}
