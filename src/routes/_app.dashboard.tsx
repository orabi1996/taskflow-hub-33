import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus, ListChecks, Clock, CheckCircle2, PauseCircle, Paperclip, Search,
  AlertTriangle, FolderKanban, TrendingUp, KanbanSquare, CalendarDays, List, X,
  LayoutDashboard, Users2, UserCircle, Trash2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ListSkeleton } from "@/components/common/ListSkeleton";
import { TaskForm } from "@/components/tasks/TaskForm";
import { EditTaskDialog, type EditableTask } from "@/components/tasks/EditTaskDialog";
import { KpiCard } from "@/components/dashboard/KpiCards";
import { KanbanBoard, type KanbanTask, type TaskStatus } from "@/components/dashboard/KanbanBoard";
import { CalendarView } from "@/components/dashboard/CalendarView";
import { format, isAfter, isBefore } from "date-fns";
import { ar } from "date-fns/locale";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { toast } from "sonner";


export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  details: string | null;
  status: TaskStatus;
  start_at: string;
  end_at: string | null;
  project_id: string | null;
  project: { name: string } | null;
  owner: { full_name: string | null; job_title: string | null } | null;
  attachments: { count: number }[];
}

const STATUS_META: Record<TaskStatus, { label: string; icon: typeof CheckCircle2; cls: string; color: string }> = {
  completed: { label: "منتهية", icon: CheckCircle2, cls: "bg-success/15 text-success border-success/30", color: "oklch(0.62 0.15 155)" },
  pending:   { label: "قيد التنفيذ", icon: Clock, cls: "bg-info/15 text-info border-info/30", color: "oklch(0.6 0.13 240)" },
  postponed: { label: "مؤجلة", icon: PauseCircle, cls: "bg-warning/15 text-warning-foreground border-warning/40", color: "oklch(0.78 0.16 80)" },
  cancelled: { label: "ملغاة", icon: ListChecks, cls: "bg-destructive/10 text-destructive border-destructive/30", color: "oklch(0.6 0.22 27)" },
};

function formatDuration(startISO: string, endISO: string | null): string | null {
  if (!endISO) return null;
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime();
  if (Number.isNaN(ms) || ms <= 0) return null;
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} د`;
  if (m === 0) return `${h} س`;
  return `${h} س ${m} د`;
}

function Dashboard() {
  const { user, profile, roles } = useAuth();
  const router = useRouter();
  const isManager = roles.some((r) => ["admin", "general_manager", "manager"].includes(r));

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [projectsCount, setProjectsCount] = useState<number>(0);
  const [contractAlerts, setContractAlerts] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EditableTask | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // View preference (list / kanban / calendar) persisted per user.
  const [view, setView] = useState<string>("list");
  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("dashboard-view") : null;
    if (saved) setView(saved);
  }, []);
  const changeView = (v: string) => {
    setView(v);
    if (typeof window !== "undefined") window.localStorage.setItem("dashboard-view", v);
  };

  // Bulk selection
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");

  const isAdminOrGM = roles.some((r) => ["admin", "general_manager"].includes(r));


  const load = async () => {
    if (!user) return;
    setLoading(true);
    const tasksQuery = supabase
      .from("tasks")
      .select("id, user_id, title, details, status, start_at, end_at, project_id, project:projects(name), owner:profiles!tasks_user_id_fkey(full_name, job_title), attachments:task_attachments(count)")
      .order("start_at", { ascending: false })
      .limit(500);
    // Admins/GM see all tasks (RLS allows it). Others see only their own.
    if (!isAdminOrGM) tasksQuery.eq("user_id", user.id);
    const [tasksRes, projectsRes, alertsRes] = await Promise.all([
      tasksQuery,
      supabase.from("projects").select("id", { count: "exact", head: true }).eq("is_active", true),
      isManager
        ? supabase
            .from("clients")
            .select("id, contract_end_date, alert_days_before", { count: "exact" })
            .not("contract_end_date", "is", null)
        : Promise.resolve({ data: [], count: 0 } as any),
    ]);

    setTasks((tasksRes.data ?? []) as unknown as TaskRow[]);
    setProjectsCount(projectsRes.count ?? 0);

    // Compute soon-to-expire contracts
    if (isManager && alertsRes.data) {
      const now = new Date();
      const count = (alertsRes.data as any[]).filter((c) => {
        if (!c.contract_end_date) return false;
        const end = new Date(c.contract_end_date);
        const days = c.alert_days_before ?? 30;
        const threshold = new Date(now.getTime() + days * 86400000);
        return isAfter(end, now) && isBefore(end, threshold);
      }).length;
      setContractAlerts(count);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id, isManager, isAdminOrGM]);

  // Derived
  const projectsList = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tasks) if (t.project_id && t.project?.name) map.set(t.project_id, t.project.name);
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  const employeesList = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tasks) if (t.user_id) map.set(t.user_id, t.owner?.full_name || "غير معروف");
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  const employeeStats = useMemo(() => {
    const map = new Map<string, { id: string; name: string; job: string; total: number; pending: number; completed: number; overdue: number; minutes: number }>();
    const now = new Date();
    for (const t of tasks) {
      const key = t.user_id;
      if (!map.has(key)) {
        map.set(key, { id: key, name: t.owner?.full_name || "غير معروف", job: t.owner?.job_title || "", total: 0, pending: 0, completed: 0, overdue: 0, minutes: 0 });
      }
      const row = map.get(key)!;
      row.total++;
      if (t.status === "pending") row.pending++;
      if (t.status === "completed") row.completed++;
      if (t.status === "pending" && t.end_at && new Date(t.end_at) < now) row.overdue++;
      if (t.end_at) {
        const ms = new Date(t.end_at).getTime() - new Date(t.start_at).getTime();
        if (ms > 0) row.minutes += Math.round(ms / 60000);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (employeeFilter !== "all" && t.user_id !== employeeFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (projectFilter !== "all" && t.project_id !== projectFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !(t.details ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [tasks, statusFilter, projectFilter, search, employeeFilter]);

  const counts = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    postponed: tasks.filter((t) => t.status === "postponed").length,
  };

  const today = new Date();
  const todayStr = today.toDateString();
  const overdueCount = tasks.filter(
    (t) => t.status === "pending" && t.end_at && new Date(t.end_at) < today,
  ).length;
  const todayCount = tasks.filter((t) => new Date(t.start_at).toDateString() === todayStr).length;

  const totalMinutes = tasks.reduce((acc, t) => {
    if (!t.end_at) return acc;
    const ms = new Date(t.end_at).getTime() - new Date(t.start_at).getTime();
    return ms > 0 ? acc + Math.round(ms / 60000) : acc;
  }, 0);
  const totalHoursLabel = `${Math.floor(totalMinutes / 60)} س ${totalMinutes % 60} د`;

  const statusPie = [
    { name: STATUS_META.pending.label, value: counts.pending, color: STATUS_META.pending.color },
    { name: STATUS_META.completed.label, value: counts.completed, color: STATUS_META.completed.color },
    { name: STATUS_META.postponed.label, value: counts.postponed, color: STATUS_META.postponed.color },
  ].filter((d) => d.value > 0);

  // Last 7 days bar chart
  const last7Days = useMemo(() => {
    const days: { day: string; created: number; completed: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const dayStr = d.toDateString();
      const dayLabel = format(d, "EEE", { locale: ar });
      const created = tasks.filter((t) => new Date(t.start_at).toDateString() === dayStr).length;
      const completed = tasks.filter(
        (t) => t.status === "completed" && t.end_at && new Date(t.end_at).toDateString() === dayStr,
      ).length;
      days.push({ day: dayLabel, created, completed });
    }
    return days;
  }, [tasks]);

  const updateStatus = async (taskId: string, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    const { error } = await supabase.from("tasks").update({ status }).eq("id", taskId);
    if (error) {
      toast.error("تعذر تحديث الحالة");
      load();
    } else {
      toast.success("تم تحديث الحالة");
    }
  };

  const openTask = (t: KanbanTask | TaskRow) => {
    const full = tasks.find((x) => x.id === t.id);
    if (!full) return;
    setEditing({
      id: full.id, user_id: full.user_id, title: full.title, details: full.details,
      status: full.status, project_id: full.project_id, start_at: full.start_at, end_at: full.end_at,
    });
    setEditOpen(true);
  };

  const kanbanTasks: KanbanTask[] = filteredTasks.map((t) => ({
    id: t.id, title: t.title, status: t.status, start_at: t.start_at, end_at: t.end_at,
    project: t.project,
  }));

  const clearFilters = () => { setSearch(""); setStatusFilter("all"); setProjectFilter("all"); setEmployeeFilter("all"); };
  const filtersActive = search || statusFilter !== "all" || projectFilter !== "all" || employeeFilter !== "all";

  // ---- Bulk actions ----
  const toggleSelected = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const allVisibleSelected = filteredTasks.length > 0 && filteredTasks.every((t) => selected.includes(t.id));
  const toggleSelectAll = () =>
    setSelected(allVisibleSelected ? [] : filteredTasks.map((t) => t.id));

  const bulkStatus = async (status: TaskStatus) => {
    if (selected.length === 0) return;
    setBulkBusy(true);
    const { error } = await supabase.from("tasks").update({ status }).in("id", selected);
    setBulkBusy(false);
    if (error) toast.error("تعذر تحديث المهام المحددة");
    else {
      toast.success(`تم تحديث ${selected.length} مهمة`);
      setSelected([]);
      load();
    }
  };

  const bulkDelete = async () => {
    if (selected.length === 0) return;
    if (!window.confirm(`سيتم حذف ${selected.length} مهمة نهائيًا. متابعة؟`)) return;
    setBulkBusy(true);
    const { error } = await supabase.from("tasks").delete().in("id", selected);
    setBulkBusy(false);
    if (error) toast.error("تعذر حذف المهام المحددة");
    else {
      toast.success(`تم حذف ${selected.length} مهمة`);
      setSelected([]);
      load();
    }
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {isAdminOrGM
              ? "لوحة التحكم العامة"
              : `مرحبًا، ${profile?.full_name?.split(" ")[0] || "بك"} 👋`}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAdminOrGM
              ? "نظرة شاملة على كل ما يسجّله الموظفون ومدراء الأقسام في النظام"
              : "إليك نظرة شاملة على نشاطك ومهامك"}
          </p>
        </div>
        {!isAdminOrGM && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="shadow-[var(--shadow-elegant)]">
              <Plus className="h-4 w-4 ms-1.5" />
              إضافة مهمة
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl p-0 gap-0 max-h-[92vh] overflow-hidden flex flex-col">
            <DialogHeader className="px-6 py-4 border-b bg-gradient-to-l from-primary/5 to-transparent shrink-0">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Plus className="h-4 w-4" />
                </span>
                إضافة مهمة جديدة
              </DialogTitle>
              <DialogDescription>سجّل ما عملت عليه مع كافة التفاصيل المرتبطة.</DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto px-6 pb-0">
              <TaskForm onSuccess={() => { setOpen(false); load(); router.invalidate(); }} />
            </div>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <KpiCard label="مهام اليوم" value={todayCount} icon={CalendarDays} accent="primary" />
        <KpiCard label="قيد التنفيذ" value={counts.pending} icon={Clock} accent="info" />
        <KpiCard label="منتهية" value={counts.completed} icon={CheckCircle2} accent="success" />
        <KpiCard label="متأخرة" value={overdueCount} icon={AlertTriangle} accent="destructive" hint="تجاوزت موعد الإنهاء" />
        {isAdminOrGM && (
          <KpiCard label="موظفون نشطون" value={employeeStats.length} icon={Users2} accent="info" hint="لديهم مهام مسجّلة" />
        )}
        {isManager ? (
          <>
            <KpiCard label="مشاريع نشطة" value={projectsCount} icon={FolderKanban} accent="primary" />
            <KpiCard label="عقود تنتهي قريبًا" value={contractAlerts} icon={AlertTriangle} accent="warning" />
          </>
        ) : (
          <>
            <KpiCard label="إجمالي المهام" value={counts.total} icon={ListChecks} accent="primary" />
            <KpiCard label="ساعات العمل" value={totalHoursLabel} icon={TrendingUp} accent="info" />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2">
          <div className="font-semibold mb-3">آخر 7 أيام</div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last7Days}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 240)" />
                <XAxis dataKey="day" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Bar dataKey="created" fill="oklch(0.6 0.13 240)" name="منشأة" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" fill="oklch(0.62 0.15 155)" name="منتهية" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <div className="font-semibold mb-3">توزيع الحالات</div>
          <div className="h-[220px]">
            {statusPie.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusPie} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {statusPie.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">لا توجد بيانات</div>
            )}
          </div>
        </Card>
      </div>

      {/* Per-employee overview (admin / GM) */}
      {isAdminOrGM && (
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">أداء الموظفين</h2>
            <Badge variant="secondary" className="ms-auto">{employeeStats.length}</Badge>
          </div>
          {employeeStats.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">لا توجد مهام مسجّلة بعد</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr className="text-end">
                    <th className="px-4 py-2 font-medium text-start">الموظف</th>
                    <th className="px-4 py-2 font-medium">الإجمالي</th>
                    <th className="px-4 py-2 font-medium">قيد التنفيذ</th>
                    <th className="px-4 py-2 font-medium">منتهية</th>
                    <th className="px-4 py-2 font-medium">متأخرة</th>
                    <th className="px-4 py-2 font-medium">ساعات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {employeeStats.map((e) => (
                    <tr
                      key={e.id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => setEmployeeFilter(e.id === employeeFilter ? "all" : e.id)}
                    >
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
                      <td className="px-4 py-2 text-center text-info">{e.pending}</td>
                      <td className="px-4 py-2 text-center text-success">{e.completed}</td>
                      <td className="px-4 py-2 text-center text-destructive">{e.overdue}</td>
                      <td className="px-4 py-2 text-center">{Math.floor(e.minutes / 60)} س</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="ابحث في المهام..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="md:w-[180px]"><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="pending">قيد التنفيذ</SelectItem>
              <SelectItem value="completed">منتهية</SelectItem>
              <SelectItem value="postponed">مؤجلة</SelectItem>
              <SelectItem value="cancelled">ملغاة</SelectItem>
            </SelectContent>
          </Select>
          {isAdminOrGM && (
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger className="md:w-[200px]"><SelectValue placeholder="الموظف" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الموظفين</SelectItem>
                {employeesList.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="md:w-[200px]"><SelectValue placeholder="المشروع" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المشاريع</SelectItem>
              {projectsList.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 ms-1" /> إلغاء الفلاتر
            </Button>
          )}
        </div>
      </Card>

      {/* Tabs: List / Kanban / Calendar */}
      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list"><List className="h-4 w-4 ms-1.5" />قائمة</TabsTrigger>
          <TabsTrigger value="kanban"><KanbanSquare className="h-4 w-4 ms-1.5" />Kanban</TabsTrigger>
          <TabsTrigger value="calendar"><CalendarDays className="h-4 w-4 ms-1.5" />التقويم</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <Card className="overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="font-semibold">المهام</h2>
              <Badge variant="secondary">{filteredTasks.length}</Badge>
            </div>
            {loading ? (
              <div className="p-12 text-center text-muted-foreground">جارٍ التحميل...</div>
            ) : filteredTasks.length === 0 ? (
              <div className="p-12 text-center">
                <ListChecks className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">{filtersActive ? "لا توجد نتائج للفلاتر الحالية" : "لا توجد مهام بعد"}</p>
              </div>
            ) : (
              <ul className="divide-y">
                {filteredTasks.map((t) => {
                  const meta = STATUS_META[t.status];
                  const Icon = meta.icon;
                  const attCount = t.attachments?.[0]?.count ?? 0;
                  return (
                    <li
                      key={t.id}
                      className="px-6 py-4 hover:bg-muted/40 transition-[var(--transition-smooth)] cursor-pointer"
                      onClick={() => openTask(t)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">{t.title}</h3>
                            {isAdminOrGM && (
                              <Badge variant="secondary" className="font-normal gap-1">
                                <UserCircle className="h-3 w-3" />{t.owner?.full_name || "غير معروف"}
                              </Badge>
                            )}
                            {t.project && <Badge variant="outline" className="font-normal">{t.project.name}</Badge>}
                            {attCount > 0 && (
                              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                <Paperclip className="h-3 w-3" /> {attCount}
                              </span>
                            )}
                          </div>
                          {t.details && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{t.details}</p>}
                          <div className="text-xs text-muted-foreground mt-2 flex items-center gap-2 flex-wrap">
                            <span>
                              {format(new Date(t.start_at), "d MMM yyyy — HH:mm", { locale: ar })}
                              {t.end_at && ` ← ${format(new Date(t.end_at), "HH:mm", { locale: ar })}`}
                            </span>
                            {(() => {
                              const dur = formatDuration(t.start_at, t.end_at);
                              return dur ? (
                                <Badge variant="outline" className="gap-1 font-normal text-primary border-primary/30 bg-primary/5">
                                  <Clock className="h-3 w-3" />{dur}
                                </Badge>
                              ) : null;
                            })()}
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${meta.cls}`}>
                          <Icon className="h-3.5 w-3.5" />{meta.label}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="kanban" className="mt-4">
          <KanbanBoard tasks={kanbanTasks} onStatusChange={updateStatus} onTaskClick={openTask} />
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <CalendarView tasks={kanbanTasks} onTaskClick={openTask} />
        </TabsContent>
      </Tabs>

      <EditTaskDialog
        task={editing}
        open={editOpen}
        onOpenChange={setEditOpen}
        canEdit={true}
        onSaved={() => { load(); router.invalidate(); }}
      />
    </div>
  );
}
