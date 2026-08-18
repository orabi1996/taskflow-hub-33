import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, Flag, ListChecks, ChevronDown, ChevronUp, Link2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listMilestones,
  upsertMilestone,
  deleteMilestone,
  listMilestoneTasks,
  assignTaskToMilestone,
  listProjectTasksUnassigned,
} from "@/lib/projects-extended.functions";

interface Milestone {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  sort_order: number;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد الانتظار",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
  cancelled: "ملغي",
};
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  in_progress: "default",
  completed: "secondary",
  cancelled: "destructive",
};

export function ProjectMilestonesManager({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const [items, setItems] = useState<Milestone[]>([]);
  const [progress, setProgress] = useState<Record<string, { total: number; done: number }>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Milestone | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    due_date: "",
    status: "pending" as Milestone["status"],
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await listMilestones({ data: { projectId } });
      setItems(res.milestones as Milestone[]);
      setProgress(res.progress);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [projectId]);

  // realtime refresh when milestones or tasks change
  useEffect(() => {
    const ch = supabase
      .channel(`milestones_${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_milestones", filter: `project_id=eq.${projectId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `project_id=eq.${projectId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId]);

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", description: "", due_date: "", status: "pending" });
    setOpen(true);
  };
  const openEdit = (m: Milestone) => {
    setEditing(m);
    setForm({
      title: m.title,
      description: m.description ?? "",
      due_date: m.due_date ?? "",
      status: m.status as Milestone["status"],
    });
    setOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.title.trim().length < 2) {
      toast.error("العنوان مطلوب");
      return;
    }
    setSubmitting(true);
    try {
      await upsertMilestone({
        data: {
          id: editing?.id,
          project_id: projectId,
          title: form.title.trim(),
          description: form.description.trim() || null,
          due_date: form.due_date || null,
          status: form.status,
          sort_order: editing?.sort_order ?? items.length,
        },
      });
      toast.success(editing ? "تم التحديث" : "تمت الإضافة");
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("حذف المرحلة؟")) return;
    try {
      await deleteMilestone({ data: { id } });
      toast.success("تم الحذف");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">مراحل المشروع</h3>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew} size="sm">
                <Plus className="h-4 w-4 ms-1" /> مرحلة جديدة
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "تعديل مرحلة" : "مرحلة جديدة"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>العنوان *</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                    maxLength={200}
                  />
                </div>
                <div className="space-y-2">
                  <Label>الوصف</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    maxLength={2000}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>تاريخ الاستحقاق</Label>
                    <Input
                      type="date"
                      value={form.due_date}
                      onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الحالة</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
                  حفظ
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-8">جارٍ التحميل...</div>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center">
          <Flag className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-muted-foreground text-sm">لا توجد مراحل بعد</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((m) => {
            const p = progress[m.id] || { total: 0, done: 0 };
            const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
            return (
              <Card key={m.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium">{m.title}</h4>
                      <Badge variant={STATUS_VARIANTS[m.status]}>{STATUS_LABELS[m.status]}</Badge>
                      {m.due_date && (
                        <span className="text-xs text-muted-foreground">يستحق: {m.due_date}</span>
                      )}
                    </div>
                    {m.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{m.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <Progress value={pct} className="flex-1 h-2" />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {p.done}/{p.total} ({pct}%)
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setExpanded(expanded === m.id ? null : m.id)} title="عرض المهام">
                      {expanded === m.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    {canManage && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(m.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {expanded === m.id && (
                  <MilestoneTasksPanel projectId={projectId} milestoneId={m.id} canManage={canManage} onChanged={load} />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface MTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  start_at: string;
  end_at: string | null;
  user_id: string;
}
interface UnTask { id: string; title: string; status: string }

function MilestoneTasksPanel({
  projectId, milestoneId, canManage, onChanged,
}: { projectId: string; milestoneId: string; canManage: boolean; onChanged: () => void }) {
  const [tasks, setTasks] = useState<MTask[]>([]);
  const [unassigned, setUnassigned] = useState<UnTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkId, setLinkId] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [t, u] = await Promise.all([
        listMilestoneTasks({ data: { milestoneId } }),
        listProjectTasksUnassigned({ data: { projectId } }),
      ]);
      setTasks(t.tasks as MTask[]);
      setUnassigned(u.tasks as UnTask[]);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [milestoneId]);

  const link = async () => {
    if (!linkId) return;
    try {
      await assignTaskToMilestone({ data: { task_id: linkId, milestone_id: milestoneId } });
      toast.success("تم الربط");
      setLinkId(""); setLinkOpen(false);
      load(); onChanged();
    } catch (e: any) { toast.error(e.message); }
  };

  const unlink = async (taskId: string) => {
    try {
      await assignTaskToMilestone({ data: { task_id: taskId, milestone_id: null } });
      load(); onChanged();
    } catch (e: any) { toast.error(e.message); }
  };

  const updateStatus = async (taskId: string, status: string) => {
    const { error } = await supabase.from("tasks").update({ status: status as any }).eq("id", taskId);
    if (error) { toast.error(error.message); return; }
    load(); onChanged();
  };

  return (
    <div className="mt-3 pt-3 border-t space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ListChecks className="h-4 w-4" /> مهام المرحلة ({tasks.length})
        </div>
        {canManage && (
          <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Link2 className="h-4 w-4 ms-1" /> ربط مهمة
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>ربط مهمة بهذه المرحلة</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <Label>المهام غير المرتبطة في المشروع</Label>
                <Select value={linkId} onValueChange={setLinkId}>
                  <SelectTrigger><SelectValue placeholder="اختر مهمة..." /></SelectTrigger>
                  <SelectContent>
                    {unassigned.length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground">لا توجد مهام غير مرتبطة</div>
                    ) : unassigned.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={link} disabled={!linkId} className="w-full">ربط</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      {loading ? (
        <div className="text-xs text-muted-foreground">جارٍ التحميل...</div>
      ) : tasks.length === 0 ? (
        <div className="text-xs text-muted-foreground py-3 text-center">لا توجد مهام مرتبطة بعد</div>
      ) : (
        <div className="space-y-1.5">
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-2 text-sm bg-muted/40 rounded p-2">
              <Badge variant={t.status === "completed" ? "secondary" : t.status === "cancelled" ? "destructive" : "outline"} className="text-[10px]">
                {STATUS_LABELS[t.status] || t.status}
              </Badge>
              <span className="flex-1 truncate">{t.title}</span>
              <Select value={t.status} onValueChange={(v) => updateStatus(t.id, v)}>
                <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">قيد التنفيذ</SelectItem>
                  <SelectItem value="completed">مكتملة</SelectItem>
                  <SelectItem value="postponed">مؤجلة</SelectItem>
                  <SelectItem value="cancelled">ملغاة</SelectItem>
                </SelectContent>
              </Select>
              {canManage && (
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => unlink(t.id)} title="إزالة الربط">
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
