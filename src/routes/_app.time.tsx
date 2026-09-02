import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import {
  Clock, Play, Square, Plus, Trash2, FileSpreadsheet, Users, Briefcase, GraduationCap,
  LifeBuoy, MoreHorizontal, Pause, PlayCircle, Pencil, BarChart3, UsersRound,
} from "lucide-react";
import { exportToExcel, exportToCSV } from "@/lib/export-utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid, LineChart, Line } from "recharts";
import { format, startOfWeek, addDays, eachDayOfInterval, subDays, startOfMonth, subMonths, subWeeks, isWithinInterval } from "date-fns";
import { ar } from "date-fns/locale";

export const Route = createFileRoute("/_app/time")({
  component: TimeTrackingPage,
});

const SESSION_TYPES = [
  { value: "work", label: "عمل", icon: Briefcase, color: "hsl(var(--primary))" },
  { value: "meeting", label: "اجتماع", icon: Users, color: "hsl(var(--info))" },
  { value: "support", label: "دعم", icon: LifeBuoy, color: "hsl(var(--warning))" },
  { value: "training", label: "تدريب", icon: GraduationCap, color: "hsl(var(--success))" },
  { value: "other", label: "أخرى", icon: MoreHorizontal, color: "hsl(var(--muted-foreground))" },
] as const;

type SessionType = typeof SESSION_TYPES[number]["value"];
const sessionLabel = (v: string | null | undefined) =>
  SESSION_TYPES.find((s) => s.value === v)?.label ?? "عمل";
const sessionColor = (v: string | null | undefined) =>
  SESSION_TYPES.find((s) => s.value === v)?.color ?? "hsl(var(--primary))";

interface Entry {
  id: string;
  user_id: string;
  task_id: string | null;
  project_id: string | null;
  description: string | null;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  session_type: string | null;
  is_paused?: boolean;
  paused_at?: string | null;
  paused_total_seconds?: number;
  is_billable?: boolean;
  hourly_rate?: number | null;
  currency?: string | null;
  task: { title: string } | null;
  project: { name: string } | null;
}


interface TaskOpt { id: string; title: string; project_id: string | null; status?: string; start_at?: string }
interface ProjectOpt { id: string; name: string }
interface TeamEntry extends Entry { profile?: { full_name: string | null; email: string | null } | null }

const REMIND_AFTER_HOURS = 4;

function TimeTrackingPage() {
  const { user, roles } = useAuth();
  const isMgr = (roles as string[]).some((r) => ["admin", "general_manager", "manager"].includes(r));

  const [entries, setEntries] = useState<Entry[]>([]);
  const [tasks, setTasks] = useState<TaskOpt[]>([]);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Entry | null>(null);
  const [, setTick] = useState(0);

  const [open, setOpen] = useState(false);
  const [taskId, setTaskId] = useState<string>("none");
  const [projectId, setProjectId] = useState<string>("none");
  const [description, setDescription] = useState("");
  const [sessionType, setSessionType] = useState<SessionType>("work");
  const [filterType, setFilterType] = useState<string>("all");

  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const reminderRef = useRef(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [e, t, p] = await Promise.all([
      supabase.from("time_entries")
        .select("*, task:tasks(title), project:projects(name)")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(200),
      supabase.from("tasks").select("id, title, project_id, status, start_at").eq("user_id", user.id).order("start_at", { ascending: false }).limit(50),
      supabase.from("projects").select("id, name").eq("is_active", true).limit(100),
    ]);
    if (e.error) toast.error(e.error.message);
    const list = ((e.data ?? []) as unknown) as Entry[];
    setEntries(list);
    setActive(list.find((x) => !x.ended_at) ?? null);
    setTasks(((t.data ?? []) as unknown) as TaskOpt[]);
    setProjects(((p.data ?? []) as unknown) as ProjectOpt[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  // ticking clock for active session
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  // long-running reminder
  useEffect(() => {
    if (!active || active.is_paused) { reminderRef.current = false; return; }
    const check = () => {
      const elapsed = Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000) - (active.paused_total_seconds ?? 0);
      if (elapsed > REMIND_AFTER_HOURS * 3600 && !reminderRef.current) {
        reminderRef.current = true;
        toast.warning(`المؤقت يعمل منذ أكثر من ${REMIND_AFTER_HOURS} ساعات. هل نسيت إيقافه؟`, { duration: 10000 });
      }
    };
    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [active]);

  // Auto-default to current in-progress task
  useEffect(() => {
    if (open && taskId === "none") {
      const inProgress = tasks.find((t) => t.status === "pending");
      if (inProgress) {
        setTaskId(inProgress.id);
        if (inProgress.project_id) setProjectId(inProgress.project_id);
      }
    }
  }, [open, tasks]);

  const startTimer = async () => {
    if (!user) return;
    if (active) { toast.error("هناك مؤقت يعمل بالفعل"); return; }
    const payload = {
      user_id: user.id,
      task_id: taskId !== "none" ? taskId : null,
      project_id: projectId !== "none" ? projectId : (taskId !== "none" ? tasks.find((t) => t.id === taskId)?.project_id ?? null : null),
      description: description.trim() || null,
      started_at: new Date().toISOString(),
      session_type: sessionType,
    };
    const { error } = await supabase.from("time_entries").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("بدأ المؤقت");
    setOpen(false);
    setDescription(""); setSessionType("work"); setTaskId("none"); setProjectId("none");
    load();
  };

  const pauseTimer = async () => {
    if (!active || active.is_paused) return;
    const { error } = await supabase.from("time_entries")
      .update({ is_paused: true, paused_at: new Date().toISOString() })
      .eq("id", active.id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الإيقاف المؤقت");
    load();
  };

  const resumeTimer = async () => {
    if (!active || !active.is_paused || !active.paused_at) return;
    const addSec = Math.floor((Date.now() - new Date(active.paused_at).getTime()) / 1000);
    const { error } = await supabase.from("time_entries")
      .update({
        is_paused: false,
        paused_at: null,
        paused_total_seconds: (active.paused_total_seconds ?? 0) + addSec,
      })
      .eq("id", active.id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الاستئناف");
    load();
  };

  const stopTimer = async () => {
    if (!active) return;
    let extraPaused = 0;
    if (active.is_paused && active.paused_at) {
      extraPaused = Math.floor((Date.now() - new Date(active.paused_at).getTime()) / 1000);
    }
    const { error } = await supabase.from("time_entries")
      .update({
        ended_at: new Date().toISOString(),
        is_paused: false,
        paused_at: null,
        paused_total_seconds: (active.paused_total_seconds ?? 0) + extraPaused,
      })
      .eq("id", active.id);
    if (error) { toast.error(error.message); return; }
    toast.success("توقف المؤقت");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذا السجل؟")) return;
    const { error } = await supabase.from("time_entries").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("تم الحذف"); load(); }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) return;
      if (!e.altKey) return;
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (active) stopTimer(); else setOpen(true);
      } else if (e.key.toLowerCase() === "p") {
        e.preventDefault();
        if (active && !active.is_paused) pauseTimer();
        else if (active && active.is_paused) resumeTimer();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  const elapsedSeconds = useMemo(() => {
    if (!active) return 0;
    const base = Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000);
    let paused = active.paused_total_seconds ?? 0;
    if (active.is_paused && active.paused_at) {
      paused += Math.floor((Date.now() - new Date(active.paused_at).getTime()) / 1000);
    }
    return Math.max(0, base - paused);
  }, [active, useTickValue()]);

  const visibleEntries = useMemo(
    () => (filterType === "all" ? entries : entries.filter((e) => (e.session_type ?? "work") === filterType)),
    [entries, filterType]
  );

  const totals = useMemo(() => {
    const completed = visibleEntries.filter((e) => e.ended_at);
    const minutes = completed.reduce((acc, e) => acc + (e.duration_minutes ?? 0), 0);
    const meetingMinutes = completed.filter((e) => e.session_type === "meeting").reduce((acc, e) => acc + (e.duration_minutes ?? 0), 0);
    const supportMinutes = completed.filter((e) => e.session_type === "support").reduce((acc, e) => acc + (e.duration_minutes ?? 0), 0);
    return { minutes, meetingMinutes, supportMinutes, count: completed.length };
  }, [visibleEntries]);

  // كشف التعارضات: جلستان متداخلتان في نفس الوقت
  const conflicts = useMemo(() => {
    const done = entries
      .filter((e) => e.ended_at)
      .map((e) => ({ ...e, s: new Date(e.started_at).getTime(), t: new Date(e.ended_at!).getTime() }))
      .sort((a, b) => a.s - b.s);
    const pairs: { a: Entry; b: Entry }[] = [];
    for (let i = 1; i < done.length; i++) {
      const prev = done[i - 1];
      const cur = done[i];
      if (cur.s < prev.t) pairs.push({ a: prev, b: cur });
    }
    return pairs;
  }, [entries]);

  const toggleBillable = async (e: Entry) => {
    const next = !e.is_billable;
    setEntries((list) => list.map((x) => (x.id === e.id ? { ...x, is_billable: next } : x)));
    const { error } = await supabase.from("time_entries").update({ is_billable: next }).eq("id", e.id);
    if (error) { toast.error(error.message); load(); }
  };



  const fmtHrs = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h}س ${m}د`;
  };

  const fmtElapsed = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const exportData = () => {
    const data = visibleEntries.filter((e) => e.ended_at).map((e) => ({
      "التاريخ": new Date(e.started_at).toLocaleDateString("ar-EG"),
      "البداية": new Date(e.started_at).toLocaleTimeString("ar-EG"),
      "النهاية": e.ended_at ? new Date(e.ended_at).toLocaleTimeString("ar-EG") : "",
      "الدقائق": e.duration_minutes ?? 0,
      "النوع": sessionLabel(e.session_type),
      "المهمة": e.task?.title ?? "",
      "المشروع": e.project?.name ?? "",
      "الوصف": e.description ?? "",
    }));
    if (data.length === 0) { toast.error("لا توجد سجلات"); return; }
    exportToExcel(data, `time-tracking-${new Date().toISOString().slice(0, 10)}`, "سجل الوقت");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="flex-1 min-w-0">
          <PageHeader
            title="تتبّع الوقت"
            icon={Clock}
            description="سجّل ساعات عملك وصنّف الجلسات · Alt+S للبدء/الإيقاف · Alt+P للإيقاف المؤقت"
          />
        </div>

        <div className="flex gap-2">
          <div className="w-40">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-9"><SelectValue placeholder="كل الأنواع" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                {SESSION_TYPES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    <div className="flex items-center gap-2"><s.icon className="h-4 w-4" /> {s.label}</div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={exportData} className="gap-1.5"><FileSpreadsheet className="h-4 w-4" /> تصدير</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5" disabled={!!active}><Plus className="h-4 w-4" /> بدء مؤقت</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>بدء جلسة عمل جديدة</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>نوع الجلسة</Label>
                  <Select value={sessionType} onValueChange={(v) => setSessionType(v as SessionType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SESSION_TYPES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          <div className="flex items-center gap-2"><s.icon className="h-4 w-4" /> {s.label}</div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>المهمة (اختياري)</Label>
                  <Select value={taskId} onValueChange={(v) => {
                    setTaskId(v);
                    const t = tasks.find((x) => x.id === v);
                    if (t?.project_id) setProjectId(t.project_id);
                  }}>
                    <SelectTrigger><SelectValue placeholder="اختر مهمة" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون مهمة محددة</SelectItem>
                      {tasks.map((t) => (<SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>المشروع (اختياري)</Label>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger><SelectValue placeholder="اختر مشروع" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون مشروع</SelectItem>
                      {projects.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>الوصف</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="ماذا تعمل؟" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                <Button onClick={startTimer}><Play className="h-4 w-4 mr-1.5" /> بدء</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {active && (
        <Card className={`p-5 border-2 ${active.is_paused ? "border-warning/40 bg-warning/5" : "border-primary/40 bg-primary/5"}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${active.is_paused ? "bg-warning" : "bg-success animate-pulse"}`} />
              <div>
                <div className="font-semibold flex items-center gap-2 flex-wrap">
                  {active.description || active.task?.title || "جلسة جارية"}
                  <Badge variant="outline">{sessionLabel(active.session_type)}</Badge>
                  {active.is_paused && <Badge variant="secondary">متوقفة مؤقتاً</Badge>}
                </div>
                <div className="text-sm text-muted-foreground">
                  {active.project?.name ?? "بدون مشروع"} · بدأت {new Date(active.started_at).toLocaleTimeString("ar-EG")}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-2xl font-mono font-bold tabular-nums">{fmtElapsed(elapsedSeconds)}</div>
              {active.is_paused ? (
                <Button variant="default" size="sm" onClick={resumeTimer} className="gap-1.5"><PlayCircle className="h-4 w-4" /> استئناف</Button>
              ) : (
                <Button variant="outline" size="sm" onClick={pauseTimer} className="gap-1.5"><Pause className="h-4 w-4" /> إيقاف مؤقت</Button>
              )}
              <Button variant="destructive" size="sm" onClick={stopTimer} className="gap-1.5"><Square className="h-4 w-4" /> إنهاء</Button>
            </div>
          </div>
        </Card>
      )}

      {conflicts.length > 0 && (
        <Card className="p-4 border-warning/50 bg-warning/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold">تعارض في الجلسات ({conflicts.length})</div>
              <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                {conflicts.slice(0, 3).map(({ a, b }) => (
                  <li key={`${a.id}-${b.id}`} className="truncate">
                    «{a.description || a.task?.title || "جلسة"}» تتداخل مع «{b.description || b.task?.title || "جلسة"}» يوم{" "}
                    {new Date(b.started_at).toLocaleDateString("ar-EG")}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sessions" className="gap-1.5"><Clock className="h-4 w-4" /> الجلسات</TabsTrigger>
          <TabsTrigger value="billing" className="gap-1.5"><Receipt className="h-4 w-4" /> الفوترة</TabsTrigger>

          <TabsTrigger value="reports" className="gap-1.5"><BarChart3 className="h-4 w-4" /> التقارير</TabsTrigger>
          {isMgr && <TabsTrigger value="team" className="gap-1.5"><UsersRound className="h-4 w-4" /> الفريق</TabsTrigger>}
        </TabsList>

        <TabsContent value="sessions" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-muted-foreground">عدد الجلسات</div><div className="text-2xl font-bold mt-1">{totals.count}</div></Card>
            <Card className="p-4"><div className="text-xs text-muted-foreground">الإجمالي</div><div className="text-2xl font-bold mt-1">{fmtHrs(totals.minutes)}</div></Card>
            <Card className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> الاجتماعات</div><div className="text-2xl font-bold mt-1">{fmtHrs(totals.meetingMinutes)}</div></Card>
            <Card className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><LifeBuoy className="h-3 w-3" /> الدعم</div><div className="text-2xl font-bold mt-1">{fmtHrs(totals.supportMinutes)}</div></Card>
          </div>

          <Card className="overflow-hidden">
            <div className="px-5 py-3 border-b font-semibold">سجل الجلسات</div>
            {loading ? (
              <div className="p-12 text-center text-muted-foreground">جارٍ التحميل...</div>
            ) : visibleEntries.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">لا توجد جلسات بعد. ابدأ مؤقتاً لتسجيل وقتك.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-start px-4 py-3">الوصف</th>
                      <th className="text-start px-4 py-3">النوع</th>
                      <th className="text-start px-4 py-3">المشروع</th>
                      <th className="text-start px-4 py-3">البداية</th>
                      <th className="text-start px-4 py-3">المدة</th>
                      <th className="text-start px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEntries.map((e) => (
                      <tr key={e.id} className="border-t">
                        <td className="px-4 py-3 font-medium">{e.description || e.task?.title || "—"}</td>
                        <td className="px-4 py-3"><Badge variant="secondary">{sessionLabel(e.session_type)}</Badge></td>
                        <td className="px-4 py-3 text-muted-foreground">{e.project?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{new Date(e.started_at).toLocaleString("ar-EG")}</td>
                        <td className="px-4 py-3">
                          {e.ended_at ? fmtHrs(e.duration_minutes ?? 0) : <Badge variant="default" className="animate-pulse">جارية</Badge>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {e.ended_at && (
                              <Button variant="ghost" size="icon" onClick={() => setEditEntry(e)} title="تعديل">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => remove(e.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <ReportsTab entries={entries} />
        </TabsContent>

        {isMgr && (
          <TabsContent value="team">
            <TeamTab />
          </TabsContent>
        )}
      </Tabs>

      <EditEntryDialog entry={editEntry} onClose={() => setEditEntry(null)} onSaved={load} />
    </div>
  );
}

// Helper to make elapsedSeconds reactive: subscribe to a 1s tick
function useTickValue() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setV((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return v;
}

function EditEntryDialog({ entry, onClose, onSaved }: { entry: Entry | null; onClose: () => void; onSaved: () => void }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState<SessionType>("work");

  useEffect(() => {
    if (!entry) return;
    setStart(toLocalInput(entry.started_at));
    setEnd(entry.ended_at ? toLocalInput(entry.ended_at) : "");
    setDesc(entry.description ?? "");
    setType((entry.session_type as SessionType) ?? "work");
  }, [entry]);

  const save = async () => {
    if (!entry) return;
    const startedAt = new Date(start);
    const endedAt = end ? new Date(end) : null;
    if (endedAt && endedAt <= startedAt) { toast.error("وقت النهاية يجب أن يكون بعد البداية"); return; }
    const { error } = await supabase.from("time_entries").update({
      started_at: startedAt.toISOString(),
      ended_at: endedAt?.toISOString() ?? null,
      description: desc.trim() || null,
      session_type: type,
      paused_total_seconds: 0,
    }).eq("id", entry.id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حفظ التعديل");
    onClose();
    onSaved();
  };

  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>تعديل الجلسة</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>البداية</Label>
            <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <Label>النهاية</Label>
            <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div>
            <Label>النوع</Label>
            <Select value={type} onValueChange={(v) => setType(v as SessionType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SESSION_TYPES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>الوصف</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={save}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const tz = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tz * 60000);
  return local.toISOString().slice(0, 16);
}

function ReportsTab({ entries }: { entries: Entry[] }) {
  const [range, setRange] = useState<"7" | "30" | "90" | "custom">("7");
  const [customStart, setCustomStart] = useState<string>(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [customEnd, setCustomEnd] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [compareMode, setCompareMode] = useState<"weeks4" | "months6" | "none">("weeks4");

  const { startDate, endDate, days } = useMemo(() => {
    if (range === "custom") {
      const s = new Date(customStart);
      const e = new Date(customEnd);
      const d = Math.max(1, Math.ceil((e.getTime() - s.getTime()) / 86400000) + 1);
      return { startDate: s, endDate: e, days: d };
    }
    const d = parseInt(range);
    return { startDate: subDays(new Date(), d - 1), endDate: new Date(), days: d };
  }, [range, customStart, customEnd]);

  const inRange = useMemo(
    () => entries.filter((e) => e.ended_at && isWithinInterval(new Date(e.started_at), { start: startDate, end: endDate })),
    [entries, startDate, endDate],
  );

  const byDay = useMemo(() => {
    const buckets = eachDayOfInterval({ start: startDate, end: endDate }).map((d) => ({
      date: format(d, "d/M", { locale: ar }),
      key: format(d, "yyyy-MM-dd"),
      minutes: 0,
    }));
    const map = new Map(buckets.map((b) => [b.key, b]));
    for (const e of inRange) {
      const k = format(new Date(e.started_at), "yyyy-MM-dd");
      const b = map.get(k);
      if (b) b.minutes += e.duration_minutes ?? 0;
    }
    return Array.from(map.values()).map((b) => ({ ...b, hours: +(b.minutes / 60).toFixed(2) }));
  }, [inRange, startDate, endDate]);

  const byType = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const e of inRange) {
      const t = e.session_type ?? "work";
      totals[t] = (totals[t] ?? 0) + (e.duration_minutes ?? 0);
    }
    return Object.entries(totals).map(([k, v]) => ({
      key: k, name: sessionLabel(k), value: +(v / 60).toFixed(2), color: sessionColor(k),
    }));
  }, [inRange]);

  const byProject = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const e of inRange) {
      const k = e.project?.name ?? "بدون مشروع";
      totals[k] = (totals[k] ?? 0) + (e.duration_minutes ?? 0);
    }
    return Object.entries(totals)
      .map(([name, v]) => ({ name, hours: +(v / 60).toFixed(2), minutes: v }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10);
  }, [inRange]);

  // Period comparison
  const comparison = useMemo(() => {
    if (compareMode === "none") return [];
    const buckets: { label: string; start: Date; end: Date }[] = [];
    const now = new Date();
    if (compareMode === "weeks4") {
      for (let i = 3; i >= 0; i--) {
        const ws = startOfWeek(subWeeks(now, i), { weekStartsOn: 6 });
        const we = addDays(ws, 6);
        buckets.push({ label: `أسبوع ${format(ws, "d/M", { locale: ar })}`, start: ws, end: we });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const ms = startOfMonth(subMonths(now, i));
        const me = subDays(startOfMonth(subMonths(now, i - 1)), 0);
        buckets.push({ label: format(ms, "MMM yyyy", { locale: ar }), start: ms, end: me });
      }
    }
    return buckets.map((b) => {
      const mins = entries
        .filter((e) => e.ended_at && isWithinInterval(new Date(e.started_at), { start: b.start, end: b.end }))
        .reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
      return { name: b.label, hours: +(mins / 60).toFixed(2) };
    });
  }, [entries, compareMode]);

  const totalHours = byDay.reduce((s, b) => s + b.hours, 0);
  const avgPerDay = totalHours / Math.max(1, days);

  // CSV exports
  const exportDailyCSV = () => {
    if (byDay.length === 0) { toast.error("لا توجد بيانات"); return; }
    exportToCSV(byDay.map((b) => ({ "اليوم": b.key, "الساعات": b.hours, "الدقائق": b.minutes })), `daily-hours-${format(new Date(), "yyyy-MM-dd")}`);
  };
  const exportTypeCSV = () => {
    if (byType.length === 0) { toast.error("لا توجد بيانات"); return; }
    exportToCSV(byType.map((t) => ({ "النوع": t.name, "الساعات": t.value })), `session-types-${format(new Date(), "yyyy-MM-dd")}`);
  };
  const exportProjectsCSV = () => {
    if (byProject.length === 0) { toast.error("لا توجد بيانات"); return; }
    exportToCSV(byProject.map((p) => ({ "المشروع": p.name, "الساعات": p.hours, "الدقائق": p.minutes })), `top-projects-${format(new Date(), "yyyy-MM-dd")}`);
  };
  const exportComparisonCSV = () => {
    if (comparison.length === 0) { toast.error("لا توجد بيانات"); return; }
    exportToCSV(comparison.map((c) => ({ "الفترة": c.name, "الساعات": c.hours })), `period-comparison-${format(new Date(), "yyyy-MM-dd")}`);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">آخر 7 أيام</SelectItem>
              <SelectItem value="30">آخر 30 يوم</SelectItem>
              <SelectItem value="90">آخر 90 يوم</SelectItem>
              <SelectItem value="custom">تاريخ مخصص</SelectItem>
            </SelectContent>
          </Select>
          {range === "custom" && (
            <>
              <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-40" />
              <span className="text-muted-foreground text-sm">إلى</span>
              <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-40" />
            </>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">إجمالي الفترة</div><div className="text-2xl font-bold mt-1">{totalHours.toFixed(1)}س</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">المتوسط اليومي</div><div className="text-2xl font-bold mt-1">{avgPerDay.toFixed(1)}س</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">عدد الأيام النشطة</div><div className="text-2xl font-bold mt-1">{byDay.filter((b) => b.hours > 0).length}</div></Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">الساعات اليومية</div>
          <Button variant="outline" size="sm" onClick={exportDailyCSV} className="gap-1.5"><FileSpreadsheet className="h-4 w-4" /> CSV</Button>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={byDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
            <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">حسب نوع الجلسة</div>
            <Button variant="outline" size="sm" onClick={exportTypeCSV} className="gap-1.5"><FileSpreadsheet className="h-4 w-4" /> CSV</Button>
          </div>
          {byType.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">لا توجد بيانات</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={byType} dataKey="value" nameKey="name" outerRadius={90} label={(d) => `${d.name}: ${d.value}س`}>
                  {byType.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Legend />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">أكثر المشاريع وقتاً</div>
            <Button variant="outline" size="sm" onClick={exportProjectsCSV} className="gap-1.5"><FileSpreadsheet className="h-4 w-4" /> CSV</Button>
          </div>
          {byProject.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">لا توجد بيانات</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byProject} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={100} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="hours" fill="hsl(var(--info))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="font-semibold">المقارنة بين الفترات</div>
          <div className="flex items-center gap-2">
            <Select value={compareMode} onValueChange={(v) => setCompareMode(v as typeof compareMode)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weeks4">آخر 4 أسابيع</SelectItem>
                <SelectItem value="months6">آخر 6 أشهر</SelectItem>
                <SelectItem value="none">إيقاف</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportComparisonCSV} className="gap-1.5"><FileSpreadsheet className="h-4 w-4" /> CSV</Button>
          </div>
        </div>
        {comparison.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">المقارنة معطّلة</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={comparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Line type="monotone" dataKey="hours" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
            {comparison.length >= 2 && (() => {
              const last = comparison[comparison.length - 1].hours;
              const prev = comparison[comparison.length - 2].hours;
              const diff = last - prev;
              const pct = prev > 0 ? (diff / prev) * 100 : 0;
              return (
                <div className="mt-3 text-sm text-muted-foreground">
                  مقارنة بالفترة السابقة: <span className={diff >= 0 ? "text-success font-semibold" : "text-destructive font-semibold"}>
                    {diff >= 0 ? "+" : ""}{diff.toFixed(1)}س ({pct >= 0 ? "+" : ""}{pct.toFixed(1)}%)
                  </span>
                </div>
              );
            })()}
          </>
        )}
      </Card>
    </div>
  );
}

function TeamTab() {
  const [list, setList] = useState<TeamEntry[]>([]);
  const [activeTimers, setActiveTimers] = useState<TeamEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<"7" | "30">("7");
  const tick = useTickValue();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const since = subDays(new Date(), parseInt(days)).toISOString();
      const [r, a] = await Promise.all([
        supabase
          .from("time_entries")
          .select("*, task:tasks(title), project:projects(name)")
          .gte("started_at", since)
          .order("started_at", { ascending: false })
          .limit(500),
        supabase
          .from("time_entries")
          .select("*, task:tasks(title), project:projects(name)")
          .is("ended_at", null)
          .order("started_at", { ascending: false })
          .limit(200),
      ]);
      if (r.error) toast.error(r.error.message);
      const rows = ((r.data ?? []) as unknown) as Entry[];
      const activeRows = ((a.data ?? []) as unknown) as Entry[];
      const ids = Array.from(new Set([...rows.map((e) => e.user_id), ...activeRows.map((e) => e.user_id)]));
      const profs = ids.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
        : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
      const pmap = new Map(((profs.data ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => [p.id, p]));
      setList(rows.map((e) => ({ ...e, profile: pmap.get(e.user_id) ?? null })));
      setActiveTimers(activeRows.map((e) => ({ ...e, profile: pmap.get(e.user_id) ?? null })));
      setLoading(false);
    };
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [days]);

  const byUser = useMemo(() => {
    const map = new Map<string, { name: string; minutes: number; count: number }>();
    for (const e of list) {
      if (!e.ended_at) continue;
      const name = e.profile?.full_name || e.profile?.email || e.user_id.slice(0, 8);
      const cur = map.get(e.user_id) ?? { name, minutes: 0, count: 0 };
      cur.minutes += e.duration_minutes ?? 0;
      cur.count += 1;
      map.set(e.user_id, cur);
    }
    return Array.from(map.values()).map((u) => ({ name: u.name, hours: +(u.minutes / 60).toFixed(2), count: u.count })).sort((a, b) => b.hours - a.hours);
  }, [list]);

  const teamRows = () => list.filter((e) => e.ended_at).map((e) => ({
    "الموظف": e.profile?.full_name ?? e.profile?.email ?? e.user_id,
    "التاريخ": new Date(e.started_at).toLocaleDateString("ar-EG"),
    "الدقائق": e.duration_minutes ?? 0,
    "النوع": sessionLabel(e.session_type),
    "المشروع": e.project?.name ?? "",
    "الوصف": e.description ?? "",
  }));

  const exportTeam = () => {
    const data = teamRows();
    if (!data.length) { toast.error("لا توجد بيانات"); return; }
    exportToExcel(data, `team-time-${new Date().toISOString().slice(0, 10)}`, "وقت الفريق");
  };
  const exportTeamCSV = () => {
    const data = teamRows();
    if (!data.length) { toast.error("لا توجد بيانات"); return; }
    exportToCSV(data, `team-time-${new Date().toISOString().slice(0, 10)}`);
  };

  const fmtElapsed = (e: Entry) => {
    void tick;
    const start = new Date(e.started_at).getTime();
    let pausedMs = (e.paused_total_seconds ?? 0) * 1000;
    if (e.is_paused && e.paused_at) pausedMs += Date.now() - new Date(e.paused_at).getTime();
    const total = Math.max(0, Date.now() - start - pausedMs);
    const h = Math.floor(total / 3600000);
    const m = Math.floor((total % 3600000) / 60000);
    const s = Math.floor((total % 60000) / 1000);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <div className="font-semibold flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success"></span>
            </span>
            مؤقتات نشطة الآن ({activeTimers.length})
          </div>
        </div>
        {activeTimers.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 text-sm">لا توجد مؤقتات نشطة حالياً</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-start px-4 py-3">الموظف</th>
                  <th className="text-start px-4 py-3">المهمة / الوصف</th>
                  <th className="text-start px-4 py-3">المشروع</th>
                  <th className="text-start px-4 py-3">بدأ في</th>
                  <th className="text-start px-4 py-3">المدة الحالية</th>
                  <th className="text-start px-4 py-3">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {activeTimers.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{e.profile?.full_name ?? e.profile?.email ?? e.user_id.slice(0, 8)}</td>
                    <td className="px-4 py-3">{e.description || e.task?.title || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.project?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(e.started_at).toLocaleString("ar-EG")}</td>
                    <td className="px-4 py-3 font-mono font-semibold">{fmtElapsed(e)}</td>
                    <td className="px-4 py-3">
                      {e.is_paused
                        ? <Badge variant="outline" className="gap-1"><Pause className="h-3 w-3" /> متوقف</Badge>
                        : <Badge className="gap-1 bg-success/15 text-success border-success/30 hover:bg-success/15"><PlayCircle className="h-3 w-3" /> يعمل</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">إجمالي جلسات الفريق المسجَّلة في الفترة</div>
        <div className="flex gap-2">
          <Select value={days} onValueChange={(v) => setDays(v as "7" | "30")}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">آخر 7 أيام</SelectItem>
              <SelectItem value="30">آخر 30 يوم</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportTeamCSV} className="gap-1.5"><FileSpreadsheet className="h-4 w-4" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={exportTeam} className="gap-1.5"><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="font-semibold mb-3">إجمالي الساعات لكل موظف</div>
        {byUser.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">{loading ? "جارٍ التحميل..." : "لا توجد بيانات"}</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(260, byUser.length * 36)}>
            <BarChart data={byUser} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={120} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b font-semibold">آخر جلسات الفريق</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-start px-4 py-3">الموظف</th>
                <th className="text-start px-4 py-3">الوصف</th>
                <th className="text-start px-4 py-3">المشروع</th>
                <th className="text-start px-4 py-3">البداية</th>
                <th className="text-start px-4 py-3">المدة</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 50).map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{e.profile?.full_name ?? e.profile?.email ?? e.user_id.slice(0, 8)}</td>
                  <td className="px-4 py-3">{e.description || e.task?.title || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.project?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(e.started_at).toLocaleString("ar-EG")}</td>
                  <td className="px-4 py-3">{e.ended_at ? `${Math.round((e.duration_minutes ?? 0) / 60 * 10) / 10}س` : <Badge>جارية</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

