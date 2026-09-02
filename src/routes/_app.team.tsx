import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users2, Eye, Filter, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { EditTaskDialog, type EditableTask } from "@/components/tasks/EditTaskDialog";
import { useAuth } from "@/lib/auth-context";
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

function TeamPage() {
  const { roles, user } = useAuth();
  const isManagerOrAbove = roles.some((r) => ["admin", "general_manager", "manager"].includes(r));
  const isAdminOrGM = roles.some((r) => ["admin", "general_manager"].includes(r));
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [editing, setEditing] = useState<EditableTask | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("tasks")
      .select("id, title, details, status, start_at, end_at, user_id, project_id, created_at, project:projects(name), owner:profiles!tasks_user_id_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(300);
    // RLS سيُقيّد النتائج إلى مهام الفريق/الكل حسب الدور تلقائيًا
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

  // Realtime: إشعار + تحديث القائمة عند إضافة مهمة جديدة لأي عضو يخص هذا المدير
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
          // أعِد جلب الصف مع علاقاته (RLS ستضمن أنه مرئي لي فعلاً)
          const { data: row } = await supabase
            .from("tasks")
            .select("id, title, details, status, start_at, end_at, user_id, project_id, created_at, project:projects(name), owner:profiles!tasks_user_id_fkey(full_name)")
            .eq("id", newId)
            .maybeSingle();
          if (!row) return; // ليست ضمن نطاق صلاحيتي
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
            prev.map((t) => (t.id === updated.id ? { ...t, ...updated } as TeamTask : t)),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isManagerOrAbove]);

  // Realtime: clients (notifications only)
  useEffect(() => {
    if (!isManagerOrAbove) return;
    const ch = supabase
      .channel("team-clients-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "clients" },
        (payload) => {
          const row = payload.new as { name?: string };
          toast.success("عميل جديد", { description: row.name ?? "" });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "clients" },
        (payload) => {
          const row = payload.new as { name?: string };
          toast.info("تم تعديل بيانات عميل", { description: row.name ?? "" });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
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
    return tasks.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (projectFilter !== "all" && t.project_id !== projectFilter) return false;
      if (employeeFilter !== "all" && t.user_id !== employeeFilter) return false;
      return true;
    });
  }, [tasks, statusFilter, projectFilter, employeeFilter]);

  if (!isManagerOrAbove) {
    return (
      <Card className="p-12 text-center">
        <Users2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground">هذه الصفحة متاحة للمدراء فقط.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="مهام الفريق" description="عرض ومتابعة مهام أعضاء فريقك" icon={Users2} />

      <Card className="p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 min-w-[160px]">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="الحالة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="pending">قيد التنفيذ</SelectItem>
                <SelectItem value="completed">منتهية</SelectItem>
                <SelectItem value="postponed">مؤجلة</SelectItem>
                <SelectItem value="cancelled">ملغاة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger><SelectValue placeholder="المشروع" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المشاريع</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger>
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

      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">المهام ({filtered.length})</h2>
        </div>
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">جارٍ التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">لا توجد مهام مطابقة للفلاتر.</div>
        ) : (
          <ul className="divide-y">
            {filtered.map((t) => (
              <li key={t.id} className="px-6 py-4 hover:bg-muted/40 transition-[var(--transition-smooth)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{t.title}</h3>
                      {isFresh(t.created_at) && (
                        <Badge className="gap-1 bg-primary/15 text-primary border-primary/30 hover:bg-primary/15">
                          <Sparkles className="h-3 w-3" /> جديد
                        </Badge>
                      )}
                      {t.project && <Badge variant="outline">{t.project.name}</Badge>}
                      {t.owner && <Badge variant="secondary">{t.owner.full_name}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      {format(new Date(t.start_at), "d MMM yyyy — HH:mm", { locale: ar })}
                      {t.end_at && ` ← ${format(new Date(t.end_at), "HH:mm", { locale: ar })}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${STATUS_CLS[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                    <Button size="icon" variant="ghost" onClick={() => { setEditing({ ...t }); setOpen(true); }} title="عرض">
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
        canEdit={isAdminOrGM /* المدير المباشر يُحدِّث عبر RLS لكن نقتصر تعديل النموذج هنا على Admin/GM لتفادي اللبس */}
        onSaved={load}
      />
    </div>
  );
}
