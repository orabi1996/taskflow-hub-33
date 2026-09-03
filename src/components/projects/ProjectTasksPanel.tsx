import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ListChecks, UserCircle } from "lucide-react";

type Status = "completed" | "pending" | "postponed" | "cancelled";

const STATUS_LABEL: Record<Status, { label: string; cls: string }> = {
  completed: { label: "منتهية", cls: "bg-success/15 text-success border-success/30" },
  pending: { label: "قيد التنفيذ", cls: "bg-info/15 text-info border-info/30" },
  postponed: { label: "مؤجلة", cls: "bg-warning/15 text-warning-foreground border-warning/40" },
  cancelled: { label: "ملغاة", cls: "bg-destructive/10 text-destructive border-destructive/30" },
};

interface Row {
  id: string;
  title: string;
  status: Status;
  priority: string | null;
  start_at: string;
  end_at: string | null;
  user_id: string;
  owner: { full_name: string | null; job_title: string | null } | null;
}

/** Tasks linked to a project + per-employee performance rollup. */
export function ProjectTasksPanel({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("tasks")
      .select("id, title, status, priority, start_at, end_at, user_id, owner:profiles!tasks_user_id_fkey(full_name, job_title)")
      .eq("project_id", projectId)
      .order("start_at", { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        setRows((data ?? []) as unknown as Row[]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const stats = useMemo(() => {
    const now = Date.now();
    const completed = rows.filter((r) => r.status === "completed").length;
    const pending = rows.filter((r) => r.status === "pending").length;
    const overdue = rows.filter(
      (r) => (r.status === "pending" || r.status === "postponed") && r.end_at && new Date(r.end_at).getTime() < now,
    ).length;
    return {
      total: rows.length,
      completed,
      pending,
      overdue,
      rate: rows.length ? Math.round((completed / rows.length) * 100) : 0,
    };
  }, [rows]);

  const perEmployee = useMemo(() => {
    const map = new Map<string, { id: string; name: string; job: string; total: number; completed: number; overdue: number }>();
    const now = Date.now();
    for (const r of rows) {
      if (!map.has(r.user_id)) {
        map.set(r.user_id, {
          id: r.user_id,
          name: r.owner?.full_name || "غير معروف",
          job: r.owner?.job_title || "",
          total: 0,
          completed: 0,
          overdue: 0,
        });
      }
      const e = map.get(r.user_id)!;
      e.total++;
      if (r.status === "completed") e.completed++;
      if ((r.status === "pending" || r.status === "postponed") && r.end_at && new Date(r.end_at).getTime() < now) e.overdue++;
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  if (loading) return <Skeleton className="h-40 w-full" />;

  if (rows.length === 0)
    return <EmptyState icon={ListChecks} title="لا توجد مهام مرتبطة بهذا المشروع" description="أضف مهامًا واربطها بالمشروع لتظهر هنا." />;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          ["إجمالي المهام", stats.total, ""],
          ["قيد التنفيذ", stats.pending, "text-info"],
          ["منتهية", stats.completed, "text-success"],
          ["متأخرة", stats.overdue, "text-destructive"],
          ["نسبة الإنجاز", `${stats.rate}%`, ""],
        ].map(([label, value, cls]) => (
          <Card key={String(label)} className="p-4">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className={`text-lg font-bold mt-1 ${cls}`}>{value}</div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b font-semibold text-sm">أداء الفريق في المشروع</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium text-start">الموظف</th>
                <th className="px-4 py-2 font-medium">المهام</th>
                <th className="px-4 py-2 font-medium">منتهية</th>
                <th className="px-4 py-2 font-medium">متأخرة</th>
                <th className="px-4 py-2 font-medium w-40">نسبة الإنجاز</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {perEmployee.map((e) => {
                const rate = e.total ? Math.round((e.completed / e.total) * 100) : 0;
                return (
                  <tr key={e.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <UserCircle className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{e.name}</div>
                          {e.job && <div className="text-xs text-muted-foreground">{e.job}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">{e.total}</td>
                    <td className="px-4 py-2 text-center text-success">{e.completed}</td>
                    <td className="px-4 py-2 text-center text-destructive">{e.overdue}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Progress value={rate} className="h-2" />
                        <span className="text-xs text-muted-foreground w-9">{rate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b font-semibold text-sm flex items-center gap-2">
          مهام المشروع <Badge variant="secondary">{rows.length}</Badge>
        </div>
        <ul className="divide-y">
          {rows.map((r) => {
            const meta = STATUS_LABEL[r.status];
            const overdue = (r.status === "pending" || r.status === "postponed") && r.end_at && new Date(r.end_at) < new Date();
            return (
              <li key={r.id} className="px-4 py-3 flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-[180px]">
                  <div className="font-medium text-sm">{r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.owner?.full_name || "غير معروف"} · {new Date(r.start_at).toLocaleDateString("ar")}
                  </div>
                </div>
                {overdue && <Badge variant="destructive">متأخرة</Badge>}
                <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
