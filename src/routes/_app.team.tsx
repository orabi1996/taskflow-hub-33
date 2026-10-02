import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users2,
  Eye,
  Filter,
  Sparkles,
  Download,
  CalendarDays,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  UserCheck,
} from "lucide-react";
import { format, isSameDay, subDays } from "date-fns";
import { ar } from "date-fns/locale";
import { EditTaskDialog, type EditableTask } from "@/components/tasks/EditTaskDialog";
import { DailyJournalDialog, type JournalTask } from "@/components/dashboard/DailyJournalDialog";
import { useAuth } from "@/lib/auth-context";
import { exportToExcel } from "@/lib/export-utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/team")({
  component: TeamPage,
});

type TaskStatus = "completed" | "pending" | "postponed" | "cancelled";

interface TeamTask {
  id: string;
  title: string;
  details: string | null;
  status: TaskStatus;
  start_at: string;
  end_at: string | null;
  user_id: string;
  project_id: string | null;
  created_at: string;
  project: { name: string } | null;
  owner: { full_name: string } | null;
}

function isFresh(iso: string) {
  return Date.now() - new Date(iso).getTime() < 24 * 60 * 60 * 1000;
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  completed: "منتهية",
  pending: "قيد التنفيذ",
  postponed: "مؤجلة",
  cancelled: "ملغاة",
};

const STATUS_CLS: Record<TaskStatus, string> = {
  completed: "bg-success/15 text-success border-success/30",
  pending: "bg-info/15 text-info border-info/30",
  postponed: "bg-warning/15 text-warning-foreground border-warning/40",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

function formatHoursAndMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0 س";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} د`;
  if (m === 0) return `${h} س`;
  return `${h} س ${m} د`;
}

function TeamPage() {
  const { roles, user } = useAuth();
  const isManagerOrAbove = roles.some((r) => ["admin", "general_manager", "manager"].includes(r));
  const isAdminOrGM = roles.some((r) => ["admin", "general_manager"].includes(r));
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "yesterday" | "custom">("all");
  const [customDate, setCustomDate] = useState<string>("");

  const [editing, setEditing] = useState<EditableTask | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const q = supabase
      .from("tasks")
      .select("id, title, details, status, start_at, end_at, user_id, project_id, created_at, project:projects(name), owner:profiles!tasks_user_id_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(400);

    const { data, error } = await q;
    if (error) console.error(error);
    setTasks(((data ?? []) as unknown) as TeamTask[]);

    const { data: projs } = await supabase.from("projects").select("id, name").order("name");
    setProjects(projs ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (isManagerOrAbove) load();
  }, [isManagerOrAbove, user?.id]);

  // Realtime updates
  useEffect(() => {
    if (!isManagerOrAbove) return;
    const channel = supabase
      .channel("team-tasks-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tasks" },
        async (payload) => {
          const newId = (payload.new as { id?: string })?.id;
          if (!newId) return;
          const { data: row } = await supabase
            .from("tasks")
            .select("id, title, details, status, start_at, end_at, user_id, project_id, created_at, project:projects(name), owner:profiles!tasks_user_id_fkey(full_name)")
            .eq("id", newId)
            .maybeSingle();
          if (!row) return;
          const typed = row as unknown as TeamTask;
          setTasks((prev) => (prev.some((t) => t.id === typed.id) ? prev : [typed, ...prev]));
          toast.success(`مهمة جديدة من ${typed.owner?.full_name ?? "موظف"}`, {
            description: typed.title,
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks" },
        (payload) => {
          const updated = payload.new as Partial<TeamTask> & { id: string };
          setTasks((prev) =>
            prev.map((t) => (t.id === updated.id ? ({ ...t, ...updated } as TeamTask) : t)),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isManagerOrAbove]);

  const employees = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    tasks.forEach((t) => {
      if (!t.user_id) return;
      const name = t.owner?.full_name ?? "—";
      const cur = map.get(t.user_id);
      if (cur) cur.count += 1;
      else map.set(t.user_id, { id: t.user_id, name, count: 1 });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [tasks]);

  const filtered = useMemo(() => {
    const today = new Date();
    const yesterday = subDays(today, 1);

    return tasks.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (projectFilter !== "all" && t.project_id !== projectFilter) return false;
      if (employeeFilter !== "all" && t.user_id !== employeeFilter) return false;

      if (dateFilter === "today") {
        if (!isSameDay(new Date(t.start_at), today)) return false;
      } else if (dateFilter === "yesterday") {
        if (!isSameDay(new Date(t.start_at), yesterday)) return false;
      } else if (dateFilter === "custom" && customDate) {
        if (!t.start_at.startsWith(customDate)) return false;
      }

      return true;
    });
  }, [tasks, statusFilter, projectFilter, employeeFilter, dateFilter, customDate]);

  // Aggregate stats per employee within filtered scope
  const employeeMetrics = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        totalTasks: number;
        completed: number;
        pending: number;
        totalMinutes: number;
        tasks: TeamTask[];
      }
    >();

    for (const t of filtered) {
      if (!t.user_id) continue;
      const name = t.owner?.full_name || "غير محدد";
      if (!map.has(t.user_id)) {
        map.set(t.user_id, {
          id: t.user_id,
          name,
          totalTasks: 0,
          completed: 0,
          pending: 0,
          totalMinutes: 0,
          tasks: [],
        });
      }
      const item = map.get(t.user_id)!;
      item.totalTasks++;
      item.tasks.push(t);
      if (t.status === "completed") item.completed++;
      if (t.status === "pending") item.pending++;
      if (t.end_at) {
        const ms = new Date(t.end_at).getTime() - new Date(t.start_at).getTime();
        if (ms > 0) item.totalMinutes += Math.round(ms / 60000);
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalTasks - a.totalTasks);
  }, [filtered]);

  const teamTotals = useMemo(() => {
    const completed = filtered.filter((t) => t.status === "completed").length;
    const pending = filtered.filter((t) => t.status === "pending").length;
    const postponed = filtered.filter((t) => t.status === "postponed").length;
    let totalMinutes = 0;
    for (const t of filtered) {
      if (t.end_at) {
        const ms = new Date(t.end_at).getTime() - new Date(t.start_at).getTime();
        if (ms > 0) totalMinutes += Math.round(ms / 60000);
      }
    }
    const rate = filtered.length ? Math.round((completed / filtered.length) * 100) : 0;
    return {
      total: filtered.length,
      completed,
      pending,
      postponed,
      totalMinutes,
      rate,
    };
  }, [filtered]);

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.info("لا توجد مهام لتصديرها");
      return;
    }
    const exportData = filtered.map((t, i) => ({
      "م": i + 1,
      "الموظف": t.owner?.full_name || "غير محدد",
      "المهمة": t.title,
      "المشروع": t.project?.name || "عام",
      "الحالة": STATUS_LABEL[t.status] || t.status,
      "تاريخ البدء": format(new Date(t.start_at), "yyyy/MM/dd - hh:mm a", { locale: ar }),
      "تاريخ الانتهاء": t.end_at ? format(new Date(t.end_at), "yyyy/MM/dd - hh:mm a", { locale: ar }) : "—",
      "التفاصيل": t.details || "",
    }));

    exportToExcel(exportData, `تقرير_مهام_الفريق_${new Date().toISOString().slice(0, 10)}`);
    toast.success("تم تصدير تقرير الفريق إلى ملف Excel بنجاح");
  };

  if (!isManagerOrAbove) {
    return (
      <Card className="p-12 text-center">
        <Users2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground">هذه الصفحة متاحة للمدراء ومسؤولي الفرق فقط.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="إشراف ومتابعة مهام الفريق"
        description="متابعة لحظية ليومية مهام أعضاء الفريق واعتماد ساعات العمل المنجزة."
        icon={Users2}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0} className="gap-1.5 text-xs h-9">
              <Download className="h-4 w-4" />
              تصدير Excel
            </Button>
            <DailyJournalDialog
              tasks={filtered as unknown as JournalTask[]}
              userName={
                employeeFilter !== "all"
                  ? employees.find((e) => e.id === employeeFilter)?.name
                  : "كامل الفريق"
              }
            />
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-4 bg-card border">
          <div className="text-xs text-muted-foreground">إجمالي مهام الفريق</div>
          <div className="text-2xl font-bold mt-1">{teamTotals.total}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{employees.length} أعضاء مسجلين</div>
        </Card>

        <Card className="p-4 bg-card border">
          <div className="text-xs text-muted-foreground">ساعات العمل المنجزة</div>
          <div className="text-2xl font-bold mt-1 text-primary">{formatHoursAndMinutes(teamTotals.totalMinutes)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">موثقة بالوقت</div>
        </Card>

        <Card className="p-4 bg-card border">
          <div className="text-xs text-muted-foreground">المهام المنجزة</div>
          <div className="text-2xl font-bold mt-1 text-success">{teamTotals.completed}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{teamTotals.rate}% نسبة الإنجاز</div>
        </Card>

        <Card className="p-4 bg-card border">
          <div className="text-xs text-muted-foreground">قيد التنفيذ</div>
          <div className="text-2xl font-bold mt-1 text-info">{teamTotals.pending}</div>
          <div className="text-xs text-muted-foreground mt-0.5">جارٍ العمل عليها</div>
        </Card>

        <Card className="p-4 bg-card border">
          <div className="text-xs text-muted-foreground">مؤجلة / ملغاة</div>
          <div className="text-2xl font-bold mt-1 text-warning-foreground">{teamTotals.postponed}</div>
          <div className="text-xs text-muted-foreground mt-0.5">تحتاج مراجعة المدير</div>
        </Card>
      </div>

      {/* Team Member Daily Cards (Progress & Daily Journal shortcut per employee) */}
      {employeeMetrics.length > 0 && (
        <Card className="p-4 bg-muted/20 border-dashed">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary" />
              مؤشرات إنجاز أعضاء الفريق ({employeeMetrics.length})
            </h3>
            <span className="text-xs text-muted-foreground">ضمن الفترة المحددة</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {employeeMetrics.map((emp) => {
              const rate = emp.totalTasks ? Math.round((emp.completed / emp.totalTasks) * 100) : 0;
              return (
                <div key={emp.id} className="p-3 bg-card rounded-lg border shadow-2xs space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm">{emp.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {emp.completed} من {emp.totalTasks} مهمة منجزة • {formatHoursAndMinutes(emp.totalMinutes)}
                      </div>
                    </div>
                    <DailyJournalDialog
                      tasks={emp.tasks as unknown as JournalTask[]}
                      userName={emp.name}
                      trigger={
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary">
                          <ClipboardList className="h-3.5 w-3.5" />
                          اليومية
                        </Button>
                      }
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Progress value={rate} className="h-1.5 flex-1" />
                    <span className="text-xs font-semibold w-8 text-end">{rate}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Filters Bar: Status, Project, Employee, Date */}
      <Card className="p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />

          {/* Date Selector Buttons */}
          <div className="flex items-center border rounded-md p-0.5 bg-muted/30">
            <Button
              variant={dateFilter === "all" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 text-xs px-2.5"
              onClick={() => setDateFilter("all")}
            >
              الكل
            </Button>
            <Button
              variant={dateFilter === "today" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 text-xs px-2.5"
              onClick={() => setDateFilter("today")}
            >
              اليوم
            </Button>
            <Button
              variant={dateFilter === "yesterday" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 text-xs px-2.5"
              onClick={() => setDateFilter("yesterday")}
            >
              أمس
            </Button>
          </div>

          <div className="flex-1 min-w-[150px]">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9"><SelectValue placeholder="الحالة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="pending">قيد التنفيذ</SelectItem>
                <SelectItem value="completed">منتهية</SelectItem>
                <SelectItem value="postponed">مؤجلة</SelectItem>
                <SelectItem value="cancelled">ملغاة</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-9"><SelectValue placeholder="المشروع" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المشاريع</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[170px]">
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="اختر موظفاً" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الموظفين ({employees.length})</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} ({e.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Team Tasks List */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <span>سجل مهام الفريق</span>
            <Badge variant="secondary">{filtered.length}</Badge>
          </h2>
          {filtered.length !== tasks.length && (
            <span className="text-xs text-muted-foreground">
              (من إجمالي {tasks.length} مهمة)
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">جارٍ التحميل ومزامنة المهام...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">لا توجد مهام مطابقة للفلاتر المحددة.</div>
        ) : (
          <ul className="divide-y">
            {filtered.map((t) => (
              <li key={t.id} className="px-6 py-4 hover:bg-muted/40 transition-[var(--transition-smooth)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">{t.title}</h3>
                      {isFresh(t.created_at) && (
                        <Badge className="gap-1 bg-primary/15 text-primary border-primary/30 hover:bg-primary/15 text-[11px] h-5">
                          <Sparkles className="h-3 w-3" /> جديد
                        </Badge>
                      )}
                      {t.project && <Badge variant="outline" className="text-xs">{t.project.name}</Badge>}
                      {t.owner && <Badge variant="secondary" className="text-xs">{t.owner.full_name}</Badge>}
                    </div>

                    {t.details && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                        {t.details}
                      </p>
                    )}

                    <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1 font-medium">
                      <Clock className="h-3.5 w-3.5" />
                      {format(new Date(t.start_at), "d MMM yyyy — HH:mm", { locale: ar })}
                      {t.end_at && ` ← ${format(new Date(t.end_at), "HH:mm", { locale: ar })}`}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${STATUS_CLS[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing({ ...t }); setOpen(true); }} title="عرض تفاصيل المهمة">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <EditTaskDialog
        task={editing}
        open={open}
        onOpenChange={setOpen}
        canEdit={isAdminOrGM}
        onSaved={load}
      />
    </div>
  );
}
