import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import {
  ListChecks,
  UserCircle,
  KanbanSquare,
  List,
  Search,
  Download,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { KanbanBoard, type KanbanTask, type TaskStatus } from "@/components/dashboard/KanbanBoard";
import { exportToExcel } from "@/lib/export-utils";
import { toast } from "sonner";

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

/** Tasks linked to a project + Kanban board + per-employee performance rollup + Excel export. */
export function ProjectTasksPanel({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

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
    const postponed = rows.filter((r) => r.status === "postponed").length;
    const cancelled = rows.filter((r) => r.status === "cancelled").length;
    const overdue = rows.filter(
      (r) => (r.status === "pending" || r.status === "postponed") && r.end_at && new Date(r.end_at).getTime() < now,
    ).length;
    return {
      total: rows.length,
      completed,
      pending,
      postponed,
      cancelled,
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

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = r.title.toLowerCase().includes(q);
        const matchOwner = r.owner?.full_name?.toLowerCase().includes(q);
        if (!matchTitle && !matchOwner) return false;
      }
      return true;
    });
  }, [rows, statusFilter, search]);

  const kanbanTasks: KanbanTask[] = useMemo(() => {
    return filteredRows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status as TaskStatus,
      start_at: r.start_at,
      end_at: r.end_at,
      project: { name: r.owner?.full_name ? `المسؤول: ${r.owner.full_name}` : "" },
    }));
  }, [filteredRows]);

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const prevRows = [...rows];
    setRows((curr) => curr.map((r) => (r.id === taskId ? { ...r, status: newStatus as Status } : r)));

    const { error } = await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);
    if (error) {
      toast.error("فشل تحديث حالة المهمة: " + error.message);
      setRows(prevRows);
    } else {
      toast.success(`تم نقل المهمة إلى: ${STATUS_LABEL[newStatus as Status]?.label ?? newStatus}`);
    }
  };

  const handleExport = () => {
    if (rows.length === 0) return;
    const exportData = rows.map((r) => ({
      "عنوان المهمة": r.title,
      "الحالة": STATUS_LABEL[r.status]?.label || r.status,
      "الأولوية": r.priority || "عادية",
      "المسؤول": r.owner?.full_name || "غير محدد",
      "تاريخ البدء": r.start_at ? new Date(r.start_at).toLocaleDateString("ar-SA") : "",
      "تاريخ الانتهاء": r.end_at ? new Date(r.end_at).toLocaleDateString("ar-SA") : "",
    }));
    exportToExcel(exportData, `مهام_المشروع_${new Date().toISOString().slice(0, 10)}`);
    toast.success("تم تصدير المهام بنجاح");
  };

  if (loading) return <Skeleton className="h-40 w-full" />;

  if (rows.length === 0)
    return <EmptyState icon={ListChecks} title="لا توجد مهام مرتبطة بهذا المشروع" description="أضف مهامًا واربطها بالمشروع لتظهر هنا." />;

  return (
    <div className="space-y-4">
      {/* KPI Stats */}
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

      {/* Control Bar: View Toggle, Search, Filter & Export */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث في مهام المشروع..."
              className="ps-9 h-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: "all", label: "الكل" },
              { id: "pending", label: "قيد التنفيذ" },
              { id: "completed", label: "منتهية" },
              { id: "postponed", label: "مؤجلة" },
              { id: "cancelled", label: "ملغاة" },
            ].map((f) => (
              <Button
                key={f.id}
                variant={statusFilter === f.id ? "default" : "ghost"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setStatusFilter(f.id)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" />
            تصدير Excel
          </Button>

          <div className="flex items-center border rounded-md p-0.5 bg-muted/30">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs gap-1"
              onClick={() => setViewMode("list")}
            >
              <List className="h-3.5 w-3.5" />
              قائمة
            </Button>
            <Button
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs gap-1"
              onClick={() => setViewMode("kanban")}
            >
              <KanbanSquare className="h-3.5 w-3.5" />
              كانبان
            </Button>
          </div>
        </div>
      </div>

      {/* Kanban Board View */}
      {viewMode === "kanban" ? (
        <div className="pt-1">
          <KanbanBoard tasks={kanbanTasks} onStatusChange={handleStatusChange} />
        </div>
      ) : (
        /* List & Team Performance View */
        <div className="space-y-4">
          {/* Per-Employee Performance Table */}
          {perEmployee.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b font-semibold text-sm flex items-center justify-between">
                <span>أداء الفريق في المشروع</span>
                <span className="text-xs text-muted-foreground">{perEmployee.length} أعضاء</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium text-start">الموظف</th>
                      <th className="px-4 py-2 font-medium text-center">المهام</th>
                      <th className="px-4 py-2 font-medium text-center">منتهية</th>
                      <th className="px-4 py-2 font-medium text-center">متأخرة</th>
                      <th className="px-4 py-2 font-medium w-44 text-start">نسبة الإنجاز</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {perEmployee.map((e) => {
                      const rate = e.total ? Math.round((e.completed / e.total) * 100) : 0;
                      return (
                        <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <UserCircle className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <div className="font-medium text-sm">{e.name}</div>
                                {e.job && <div className="text-xs text-muted-foreground">{e.job}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-center font-semibold">{e.total}</td>
                          <td className="px-4 py-2.5 text-center text-success font-semibold">{e.completed}</td>
                          <td className="px-4 py-2.5 text-center text-destructive font-semibold">{e.overdue}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <Progress value={rate} className="h-2 flex-1" />
                              <span className="text-xs font-semibold w-10 text-end">{rate}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Tasks List */}
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b font-semibold text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>مهام المشروع</span>
                <Badge variant="secondary">{filteredRows.length}</Badge>
              </div>
              {filteredRows.length !== rows.length && (
                <span className="text-xs text-muted-foreground">
                  (من إجمالي {rows.length})
                </span>
              )}
            </div>

            {filteredRows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                لا توجد مهام مطابقة للبحث أو الفلتر المحدد.
              </div>
            ) : (
              <ul className="divide-y">
                {filteredRows.map((r) => {
                  const meta = STATUS_LABEL[r.status];
                  const overdue = (r.status === "pending" || r.status === "postponed") && r.end_at && new Date(r.end_at) < new Date();
                  return (
                    <li key={r.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                      <div className="flex-1 min-w-[220px]">
                        <div className="font-medium text-sm flex items-center gap-2">
                          <span>{r.title}</span>
                          {r.priority === "high" || r.priority === "urgent" ? (
                            <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                              عاجلة
                            </Badge>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                          <span>{r.owner?.full_name || "غير محدد"}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(r.start_at).toLocaleDateString("ar-SA")}
                            {r.end_at && ` - ${new Date(r.end_at).toLocaleDateString("ar-SA")}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {overdue && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            متأخرة
                          </Badge>
                        )}
                        <Badge variant="outline" className={meta.cls}>
                          {meta.label}
                        </Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
