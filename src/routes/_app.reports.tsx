import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart3, Clock, CheckCircle2, PauseCircle, XCircle, Activity,
  Download, FileSpreadsheet, Printer, TrendingUp, TrendingDown,
  Users, Briefcase, Target, Zap, Radio,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ComposedChart, Scatter, ScatterChart, ZAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { exportToExcel, exportToCSV, printSection } from "@/lib/export-utils";
import { exportTableToPDF } from "@/lib/pdf-utils";
import { FileText, Boxes } from "lucide-react";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsPage,
});

type TaskStatus = "completed" | "pending" | "postponed" | "cancelled";

interface Row {
  id: string;
  title: string;
  status: TaskStatus;
  start_at: string;
  end_at: string | null;
  user_id: string;
  project_id: string | null;
  owner: { full_name: string; manager_id: string | null } | null;
  project: { name: string } | null;
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  completed: "منتهية",
  pending: "قيد التنفيذ",
  postponed: "مؤجلة",
  cancelled: "ملغاة",
};

const COLORS = {
  completed: "var(--success)",
  pending: "var(--info)",
  postponed: "var(--warning)",
  cancelled: "var(--destructive)",
  primary: "var(--primary)",
  glow: "var(--primary-glow)",
  info: "var(--info)",
};

const monthOptions = () => {
  const arr: { value: string; label: string }[] = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const value = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    arr.push({ value, label: dt.toLocaleDateString("ar-EG", { year: "numeric", month: "long" }) });
  }
  return arr;
};

const fetchMonth = async (monthStr: string): Promise<Row[]> => {
  const [y, m] = monthStr.split("-").map(Number);
  const start = new Date(y, m - 1, 1).toISOString();
  const end = new Date(y, m, 1).toISOString();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, status, start_at, end_at, user_id, project_id, owner:profiles!tasks_user_id_fkey(full_name, manager_id), project:projects(name)")
    .gte("start_at", start)
    .lt("start_at", end)
    .limit(1000);
  if (error) console.error(error);
  return ((data ?? []) as unknown) as Row[];
};

const prevMonth = (s: string) => {
  const [y, m] = s.split("-").map(Number);
  const dt = new Date(y, m - 2, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
};

function ReportsPage() {
  const { roles } = useAuth();
  const canSee = roles.some((r) => ["admin", "general_manager", "manager"].includes(r));
  const months = useMemo(monthOptions, []);
  const [month, setMonth] = useState(months[0].value);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [prevRows, setPrevRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);
  const [pulse, setPulse] = useState(0);

  // session/module data
  const [sessions, setSessions] = useState<Array<{
    id: string; user_id: string; session_type: string | null; duration_minutes: number | null;
    started_at: string; ended_at: string | null;
  }>>([]);
  const [empModules, setEmpModules] = useState<Array<{ user_id: string; module_id: string; is_primary: boolean }>>([]);
  const [moduleNames, setModuleNames] = useState<Map<string, string>>(new Map());
  const [profileNames, setProfileNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!canSee) return;
    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1).toISOString();
    const end = new Date(y, m, 1).toISOString();
    (async () => {
      const [s, em, mods, profs] = await Promise.all([
        supabase.from("time_entries")
          .select("id, user_id, session_type, duration_minutes, started_at, ended_at")
          .gte("started_at", start).lt("started_at", end).limit(2000),
        supabase.from("employee_modules").select("user_id, module_id, is_primary"),
        supabase.from("company_modules").select("id, name"),
        supabase.from("profiles").select("id, full_name"),
      ]);
      setSessions(((s.data ?? []) as unknown) as typeof sessions);
      setEmpModules(((em.data ?? []) as unknown) as typeof empModules);
      const map = new Map<string, string>();
      ((mods.data ?? []) as Array<{ id: string; name: string }>).forEach((x) => map.set(x.id, x.name));
      setModuleNames(map);
      const pmap = new Map<string, string>();
      ((profs.data ?? []) as Array<{ id: string; full_name: string }>).forEach((x) => pmap.set(x.id, x.full_name));
      setProfileNames(pmap);
    })();
  }, [month, canSee]);


  // initial + month change
  useEffect(() => {
    if (!canSee) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [a, b] = await Promise.all([fetchMonth(month), fetchMonth(prevMonth(month))]);
      if (!cancelled) {
        setRows(a);
        setPrevRows(b);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [month, canSee]);

  // realtime subscription
  useEffect(() => {
    if (!canSee || !live) return;
    const ch = supabase
      .channel("reports-tasks-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, async () => {
        const fresh = await fetchMonth(month);
        setRows(fresh);
        setPulse((p) => p + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [month, canSee, live]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (projectFilter !== "all" && r.project_id !== projectFilter) return false;
    if (employeeFilter !== "all" && r.user_id !== employeeFilter) return false;
    return true;
  }), [rows, projectFilter, employeeFilter]);

  const filteredPrev = useMemo(() => prevRows.filter((r) => {
    if (projectFilter !== "all" && r.project_id !== projectFilter) return false;
    if (employeeFilter !== "all" && r.user_id !== employeeFilter) return false;
    return true;
  }), [prevRows, projectFilter, employeeFilter]);

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => { if (r.project_id && r.project?.name) map.set(r.project_id, r.project.name); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const employeeOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => { if (r.owner?.full_name) map.set(r.user_id, r.owner.full_name); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const computeTotals = (data: Row[]) => {
    const counts = { completed: 0, pending: 0, postponed: 0, cancelled: 0 } as Record<TaskStatus, number>;
    let mins = 0;
    data.forEach((r) => {
      counts[r.status]++;
      if (r.end_at) mins += Math.max(0, (new Date(r.end_at).getTime() - new Date(r.start_at).getTime()) / 60000);
    });
    return { counts, totalMinutes: mins, totalTasks: data.length };
  };

  const totals = useMemo(() => computeTotals(filtered), [filtered]);
  const totalsPrev = useMemo(() => computeTotals(filteredPrev), [filteredPrev]);

  const completionRate = totals.totalTasks ? (totals.counts.completed / totals.totalTasks) * 100 : 0;
  const completionRatePrev = totalsPrev.totalTasks ? (totalsPrev.counts.completed / totalsPrev.totalTasks) * 100 : 0;
  const avgPerTask = totals.counts.completed ? totals.totalMinutes / totals.counts.completed : 0;
  const activeEmployees = useMemo(() => new Set(filtered.map((r) => r.user_id)).size, [filtered]);
  const activeProjects = useMemo(() => new Set(filtered.filter((r) => r.project_id).map((r) => r.project_id)).size, [filtered]);

  const delta = (a: number, b: number) => b === 0 ? (a > 0 ? 100 : 0) : ((a - b) / b) * 100;

  const perEmployee = useMemo(() => {
    const map = new Map<string, { name: string; counts: Record<TaskStatus, number>; minutes: number }>();
    filtered.forEach((r) => {
      const name = r.owner?.full_name ?? "غير معروف";
      const cur = map.get(r.user_id) ?? { name, counts: { completed: 0, pending: 0, postponed: 0, cancelled: 0 }, minutes: 0 };
      cur.counts[r.status]++;
      if (r.end_at) cur.minutes += Math.max(0, (new Date(r.end_at).getTime() - new Date(r.start_at).getTime()) / 60000);
      map.set(r.user_id, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.minutes - a.minutes);
  }, [filtered]);

  const perProject = useMemo(() => {
    const map = new Map<string, { name: string; total: number; completed: number; pending: number; minutes: number }>();
    filtered.forEach((r) => {
      const key = r.project_id ?? "none";
      const name = r.project?.name ?? "بدون مشروع";
      const cur = map.get(key) ?? { name, total: 0, completed: 0, pending: 0, minutes: 0 };
      cur.total++;
      if (r.status === "completed") cur.completed++;
      if (r.status === "pending") cur.pending++;
      if (r.end_at) cur.minutes += Math.max(0, (new Date(r.end_at).getTime() - new Date(r.start_at).getTime()) / 60000);
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [filtered]);

  const dailyTrend = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const days = new Date(y, m, 0).getDate();
    const arr = Array.from({ length: days }, (_, i) => ({
      day: String(i + 1),
      جديدة: 0, مكتملة: 0, ساعات: 0,
    }));
    filtered.forEach((r) => {
      const d = new Date(r.start_at);
      if (d.getFullYear() === y && d.getMonth() + 1 === m) {
        const idx = d.getDate() - 1;
        arr[idx].جديدة++;
        if (r.status === "completed") arr[idx].مكتملة++;
        if (r.end_at) arr[idx].ساعات += (new Date(r.end_at).getTime() - new Date(r.start_at).getTime()) / 3600000;
      }
    });
    return arr.map((x) => ({ ...x, ساعات: Math.round(x.ساعات * 10) / 10 }));
  }, [filtered, month]);

  const cumulativeTrend = useMemo(() => {
    let cumNew = 0, cumDone = 0;
    return dailyTrend.map((d) => {
      cumNew += d.جديدة;
      cumDone += d.مكتملة;
      return { day: d.day, "تراكمي جديد": cumNew, "تراكمي منتهي": cumDone };
    });
  }, [dailyTrend]);

  const statusPie = useMemo(() =>
    (Object.keys(totals.counts) as TaskStatus[])
      .filter((s) => totals.counts[s] > 0)
      .map((s) => ({ name: STATUS_LABEL[s], value: totals.counts[s], color: COLORS[s] })),
    [totals]
  );

  // Heatmap: day-of-week × hour
  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    filtered.forEach((r) => {
      const d = new Date(r.start_at);
      grid[d.getDay()][d.getHours()]++;
    });
    const max = Math.max(1, ...grid.flat());
    return { grid, max };
  }, [filtered]);

  // Radar: top 6 employees by completion across statuses
  const radarData = useMemo(() => {
    const top = perEmployee.slice(0, 6);
    return (["completed", "pending", "postponed", "cancelled"] as TaskStatus[]).map((s) => {
      const o: Record<string, string | number> = { metric: STATUS_LABEL[s] };
      top.forEach((e) => { o[e.name] = e.counts[s]; });
      return o;
    });
  }, [perEmployee]);

  // Period comparison
  const compareData = useMemo(() => ([
    { label: "إجمالي", "الشهر الحالي": totals.totalTasks, "السابق": totalsPrev.totalTasks },
    { label: "منتهية", "الشهر الحالي": totals.counts.completed, "السابق": totalsPrev.counts.completed },
    { label: "قيد التنفيذ", "الشهر الحالي": totals.counts.pending, "السابق": totalsPrev.counts.pending },
    { label: "مؤجلة", "الشهر الحالي": totals.counts.postponed, "السابق": totalsPrev.counts.postponed },
    { label: "ملغاة", "الشهر الحالي": totals.counts.cancelled, "السابق": totalsPrev.counts.cancelled },
  ]), [totals, totalsPrev]);

  // Sessions × employee × module aggregation
  const SESSION_LABEL: Record<string, string> = {
    work: "عمل", meeting: "اجتماع", support: "دعم", training: "تدريب", other: "أخرى",
  };
  const SESSION_KEYS = ["work", "meeting", "support", "training", "other"] as const;

  const userPrimaryModule = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of empModules) {
      if (r.is_primary) m.set(r.user_id, r.module_id);
    }
    for (const r of empModules) {
      if (!m.has(r.user_id)) m.set(r.user_id, r.module_id);
    }
    return m;
  }, [empModules]);

  type SessAgg = {
    user_id: string; userName: string;
    module_id: string | null; moduleName: string;
    counts: Record<string, number>;
    minutes: Record<string, number>;
    totalMinutes: number; totalCount: number;
  };

  const sessionsByEmpModule: SessAgg[] = useMemo(() => {
    const map = new Map<string, SessAgg>();
    const completed = sessions.filter((s) => s.ended_at);
    for (const s of completed) {
      const modId = userPrimaryModule.get(s.user_id) ?? null;
      const key = `${s.user_id}__${modId ?? "none"}`;
      let agg = map.get(key);
      if (!agg) {
        agg = {
          user_id: s.user_id,
          userName: profileNames.get(s.user_id) ?? "—",
          module_id: modId,
          moduleName: modId ? (moduleNames.get(modId) ?? "—") : "بدون نظام",
          counts: { work: 0, meeting: 0, support: 0, training: 0, other: 0 },
          minutes: { work: 0, meeting: 0, support: 0, training: 0, other: 0 },
          totalMinutes: 0, totalCount: 0,
        };
        map.set(key, agg);
      }
      const t = (s.session_type ?? "work") as string;
      const mins = s.duration_minutes ?? 0;
      if (agg.counts[t] === undefined) { agg.counts[t] = 0; agg.minutes[t] = 0; }
      agg.counts[t]++;
      agg.minutes[t] += mins;
      agg.totalCount++;
      agg.totalMinutes += mins;
    }
    return Array.from(map.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [sessions, userPrimaryModule, profileNames, moduleNames]);

  const sessionsExportRows = () => sessionsByEmpModule.map((r) => ({
    "الموظف": r.userName,
    "النظام": r.moduleName,
    "اجتماعات (عدد)": r.counts.meeting,
    "اجتماعات (دقائق)": r.minutes.meeting,
    "عمل (دقائق)": r.minutes.work,
    "دعم (دقائق)": r.minutes.support,
    "تدريب (دقائق)": r.minutes.training,
    "أخرى (دقائق)": r.minutes.other,
    "إجمالي الجلسات": r.totalCount,
    "إجمالي الدقائق": r.totalMinutes,
  }));

  const handleExportSessionsCSV = () => exportToCSV(sessionsExportRows(), `تقرير-الجلسات-${month}`);
  const handleExportSessionsPDF = () => {
    const headers = ["الموظف", "النظام", "اجتماعات (عدد)", "اجتماعات (د)", "عمل (د)", "دعم (د)", "تدريب (د)", "إجمالي (د)"];
    const rows = sessionsByEmpModule.map((r) => [
      r.userName, r.moduleName, r.counts.meeting, r.minutes.meeting,
      r.minutes.work, r.minutes.support, r.minutes.training, r.totalMinutes,
    ]);
    exportTableToPDF({ title: `Sessions Report ${month}`, fileName: `sessions-${month}`, headers, rows });
  };
  const handleExportTasksPDF = () => {
    const headers = ["Title", "Employee", "Project", "Status", "Start", "End", "Mins"];
    const rows = filtered.map((r) => [
      r.title, r.owner?.full_name ?? "", r.project?.name ?? "", STATUS_LABEL[r.status],
      new Date(r.start_at).toLocaleString("en-GB"),
      r.end_at ? new Date(r.end_at).toLocaleString("en-GB") : "",
      r.end_at ? Math.round((new Date(r.end_at).getTime() - new Date(r.start_at).getTime()) / 60000) : 0,
    ]);
    exportTableToPDF({ title: `Tasks Report ${month}`, fileName: `tasks-${month}`, headers, rows });
  };


  if (!canSee) {
    return (
      <Card className="p-12 text-center">
        <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground">هذه الصفحة متاحة للمدراء فقط.</p>
      </Card>
    );
  }

  const fmtHrs = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h} س ${m} د`;
  };

  const handleExportExcel = () => {
    const data = filtered.map((r) => ({
      "العنوان": r.title,
      "الموظف": r.owner?.full_name ?? "",
      "المشروع": r.project?.name ?? "",
      "الحالة": STATUS_LABEL[r.status],
      "البداية": new Date(r.start_at).toLocaleString("ar-EG"),
      "النهاية": r.end_at ? new Date(r.end_at).toLocaleString("ar-EG") : "",
      "الدقائق": r.end_at ? Math.round((new Date(r.end_at).getTime() - new Date(r.start_at).getTime()) / 60000) : 0,
    }));
    exportToExcel(data, `تقرير-${month}`, "المهام");
  };

  const handleExportCSV = () => {
    const data = perEmployee.map((e) => ({
      "الموظف": e.name,
      "المجموع": e.counts.completed + e.counts.pending + e.counts.postponed + e.counts.cancelled,
      "منتهية": e.counts.completed,
      "قيد التنفيذ": e.counts.pending,
      "مؤجلة": e.counts.postponed,
      "ملغاة": e.counts.cancelled,
      "الساعات": fmtHrs(e.minutes),
    }));
    exportToCSV(data, `تقرير-الموظفين-${month}`);
  };

  const days = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const radarColors = ["var(--primary)", "var(--info)", "var(--success)", "var(--warning)", "var(--destructive)", "var(--primary-glow)"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            التقارير والتحليلات
            {live && (
              <span className="inline-flex items-center gap-1.5 text-xs font-normal text-success">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                </span>
                مباشر
              </span>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">
            رؤية شاملة للأداء والإنتاجية {pulse > 0 && <span className="text-xs">· تحديث #{pulse}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={live ? "default" : "outline"}
            size="sm"
            onClick={() => setLive((v) => !v)}
            className="gap-1.5"
          >
            <Radio className="h-4 w-4" /> {live ? "مباشر" : "متوقف"}
          </Button>
          <div className="w-44">
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {months.map((m) => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-44">
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger><SelectValue placeholder="كل المشاريع" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المشاريع</SelectItem>
                {projectOptions.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-44">
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger><SelectValue placeholder="كل الموظفين" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الموظفين</SelectItem>
                {employeeOptions.map((e) => (<SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1.5">
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportTasksPDF} className="gap-1.5">
            <FileText className="h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => printSection("report-area", `تقرير ${month}`)} className="gap-1.5">
            <Printer className="h-4 w-4" /> طباعة
          </Button>
        </div>
      </div>

      <div id="report-area" className="space-y-6">
        {/* KPIs with deltas */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <KpiTile icon={BarChart3} label="إجمالي" value={totals.totalTasks} delta={delta(totals.totalTasks, totalsPrev.totalTasks)} accent="primary" />
          <KpiTile icon={CheckCircle2} label="منتهية" value={totals.counts.completed} delta={delta(totals.counts.completed, totalsPrev.counts.completed)} accent="success" />
          <KpiTile icon={Clock} label="قيد التنفيذ" value={totals.counts.pending} delta={delta(totals.counts.pending, totalsPrev.counts.pending)} accent="info" />
          <KpiTile icon={PauseCircle} label="مؤجلة/ملغاة" value={totals.counts.postponed + totals.counts.cancelled} delta={delta(totals.counts.postponed + totals.counts.cancelled, totalsPrev.counts.postponed + totalsPrev.counts.cancelled)} accent="warning" />
          <KpiTile icon={Target} label="معدل الإنجاز" value={`${completionRate.toFixed(0)}%`} delta={completionRate - completionRatePrev} accent="success" suffix="نقطة" />
          <KpiTile icon={Zap} label="متوسط/مهمة" value={fmtHrs(avgPerTask)} accent="primary" />
          <KpiTile icon={TrendingUp} label="ساعات" value={fmtHrs(totals.totalMinutes)} accent="info" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MiniStat icon={Users} label="موظفون نشطون" value={activeEmployees} />
          <MiniStat icon={Briefcase} label="مشاريع نشطة" value={activeProjects} />
          <MiniStat icon={Activity} label="حالة الاتصال" value={live ? "مباشر · متصل" : "إيقاف مؤقت"} />
        </div>

        <Tabs defaultValue="trend" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="trend">الاتجاه اليومي</TabsTrigger>
            <TabsTrigger value="distribution">توزيع الحالات</TabsTrigger>
            <TabsTrigger value="projects">المشاريع</TabsTrigger>
            <TabsTrigger value="radar">رادار الفريق</TabsTrigger>
            <TabsTrigger value="heatmap">الخريطة الحرارية</TabsTrigger>
            <TabsTrigger value="compare">مقارنة الفترات</TabsTrigger>
            <TabsTrigger value="employees">جدول الموظفين</TabsTrigger>
            <TabsTrigger value="sessions">الجلسات حسب الموظف والنظام</TabsTrigger>
          </TabsList>

          <TabsContent value="trend" className="space-y-4">
            <Card className="p-5">
              <div className="font-semibold mb-3">الاتجاه اليومي للمهام والساعات</div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dailyTrend}>
                    <defs>
                      <linearGradient id="gNew" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.pending} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={COLORS.pending} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gDone" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.completed} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={COLORS.completed} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="day" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                    <Legend />
                    <Area yAxisId="left" type="monotone" dataKey="جديدة" stroke={COLORS.pending} fill="url(#gNew)" strokeWidth={2} />
                    <Area yAxisId="left" type="monotone" dataKey="مكتملة" stroke={COLORS.completed} fill="url(#gDone)" strokeWidth={2} />
                    <Bar yAxisId="right" dataKey="ساعات" fill={COLORS.primary} opacity={0.6} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-5">
              <div className="font-semibold mb-3">التراكم الشهري</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cumulativeTrend}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                    <Legend />
                    <Area type="monotone" dataKey="تراكمي جديد" stroke={COLORS.info} fill={COLORS.info} fillOpacity={0.15} strokeWidth={2} />
                    <Area type="monotone" dataKey="تراكمي منتهي" stroke={COLORS.completed} fill={COLORS.completed} fillOpacity={0.15} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="distribution">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="p-5">
                <div className="font-semibold mb-3">توزيع الحالات</div>
                <div className="h-72">
                  {statusPie.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">لا توجد بيانات</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusPie} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={3} label>
                          {statusPie.map((e, i) => (<Cell key={i} fill={e.color} />))}
                        </Pie>
                        <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>
              <Card className="p-5">
                <div className="font-semibold mb-3">قمع الإنجاز</div>
                <div className="space-y-3 mt-6">
                  {(["pending", "completed", "postponed", "cancelled"] as TaskStatus[]).map((s) => {
                    const v = totals.counts[s];
                    const pct = totals.totalTasks ? (v / totals.totalTasks) * 100 : 0;
                    return (
                      <div key={s}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span>{STATUS_LABEL[s]}</span>
                          <span className="font-medium">{v} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="h-3 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full transition-all duration-500 rounded-full"
                            style={{ width: `${pct}%`, background: COLORS[s] }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="projects">
            <Card className="p-5">
              <div className="font-semibold mb-3">أعلى المشاريع نشاطاً</div>
              <div className="h-80">
                {perProject.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">لا توجد بيانات</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={perProject} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                      <Legend />
                      <Bar dataKey="completed" stackId="a" name="منتهية" fill={COLORS.completed} />
                      <Bar dataKey="pending" stackId="a" name="قيد التنفيذ" fill={COLORS.pending} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="radar">
            <Card className="p-5">
              <div className="font-semibold mb-3">رادار أداء أفضل 6 موظفين</div>
              <div className="h-96">
                {perEmployee.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">لا توجد بيانات</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="metric" />
                      <PolarRadiusAxis />
                      {perEmployee.slice(0, 6).map((e, i) => (
                        <Radar key={e.name} name={e.name} dataKey={e.name} stroke={radarColors[i]} fill={radarColors[i]} fillOpacity={0.2} />
                      ))}
                      <Legend />
                      <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="heatmap">
            <Card className="p-5">
              <div className="font-semibold mb-3">خريطة حرارية: نشاط حسب اليوم والساعة</div>
              <div className="overflow-x-auto">
                <div className="min-w-[700px]">
                  <div className="grid gap-1" style={{ gridTemplateColumns: "80px repeat(24, 1fr)" }}>
                    <div />
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className="text-[10px] text-center text-muted-foreground">{h}</div>
                    ))}
                    {heatmap.grid.map((row, di) => (
                      <>
                        <div key={`l-${di}`} className="text-xs text-muted-foreground self-center">{days[di]}</div>
                        {row.map((v, hi) => {
                          const intensity = v / heatmap.max;
                          return (
                            <div
                              key={`${di}-${hi}`}
                              className="aspect-square rounded transition-all hover:scale-110 cursor-pointer"
                              style={{
                                background: v === 0
                                  ? "var(--muted)"
                                  : `color-mix(in oklab, var(--primary) ${10 + intensity * 90}%, transparent)`,
                              }}
                              title={`${days[di]} ${hi}:00 — ${v} مهمة`}
                            />
                          );
                        })}
                      </>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>أقل</span>
                    {[0.1, 0.3, 0.5, 0.7, 0.9].map((i) => (
                      <div key={i} className="h-3 w-6 rounded" style={{ background: `color-mix(in oklab, var(--primary) ${i * 100}%, transparent)` }} />
                    ))}
                    <span>أكثر</span>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="compare">
            <Card className="p-5">
              <div className="font-semibold mb-3">مقارنة مع الشهر السابق</div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compareData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                    <Legend />
                    <Bar dataKey="السابق" fill={COLORS.primary} opacity={0.4} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="الشهر الحالي" fill={COLORS.primary} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="employees">
            <Card className="overflow-hidden">
              <div className="px-6 py-4 border-b font-semibold">تفاصيل الموظفين</div>
              {loading ? (
                <div className="p-12 text-center text-muted-foreground">جارٍ التحميل...</div>
              ) : perEmployee.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">لا توجد بيانات.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-start px-4 py-3 font-semibold">الموظف</th>
                        <th className="text-start px-4 py-3 font-semibold">المجموع</th>
                        {(["completed", "pending", "postponed", "cancelled"] as TaskStatus[]).map((s) => (
                          <th key={s} className="text-start px-4 py-3 font-semibold">{STATUS_LABEL[s]}</th>
                        ))}
                        <th className="text-start px-4 py-3 font-semibold">معدل الإنجاز</th>
                        <th className="text-start px-4 py-3 font-semibold">الساعات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perEmployee.map((e) => {
                        const total = e.counts.completed + e.counts.pending + e.counts.postponed + e.counts.cancelled;
                        const rate = total ? (e.counts.completed / total) * 100 : 0;
                        return (
                          <tr key={e.name} className="border-t hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium">{e.name}</td>
                            <td className="px-4 py-3"><Badge variant="secondary">{total}</Badge></td>
                            <td className="px-4 py-3">{e.counts.completed}</td>
                            <td className="px-4 py-3">{e.counts.pending}</td>
                            <td className="px-4 py-3">{e.counts.postponed}</td>
                            <td className="px-4 py-3">{e.counts.cancelled}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-20 rounded-full bg-muted overflow-hidden">
                                  <div className="h-full transition-all duration-500" style={{ width: `${rate}%`, background: COLORS.completed }} />
                                </div>
                                <span className="text-xs font-medium">{rate.toFixed(0)}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-medium">{fmtHrs(e.minutes)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </TabsContent>
          <TabsContent value="sessions">
            <Card className="overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center justify-between gap-3 flex-wrap">
                <div className="font-semibold flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-primary" /> الجلسات حسب الموظف والنظام
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleExportSessionsCSV} className="gap-1.5">
                    <Download className="h-4 w-4" /> CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportSessionsPDF} className="gap-1.5">
                    <FileText className="h-4 w-4" /> PDF
                  </Button>
                </div>
              </div>
              {sessionsByEmpModule.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">لا توجد جلسات في هذا الشهر.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-start px-4 py-3 font-semibold">الموظف</th>
                        <th className="text-start px-4 py-3 font-semibold">النظام</th>
                        {SESSION_KEYS.map((k) => (
                          <th key={k} className="text-start px-4 py-3 font-semibold">{SESSION_LABEL[k]}</th>
                        ))}
                        <th className="text-start px-4 py-3 font-semibold">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionsByEmpModule.map((r) => (
                        <tr key={`${r.user_id}-${r.module_id ?? "n"}`} className="border-t hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium">{r.userName}</td>
                          <td className="px-4 py-3"><Badge variant="outline">{r.moduleName}</Badge></td>
                          {SESSION_KEYS.map((k) => (
                            <td key={k} className="px-4 py-3">
                              {r.counts[k] ? (
                                <span>{r.counts[k]} <span className="text-xs text-muted-foreground">({fmtHrs(r.minutes[k])})</span></span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                          ))}
                          <td className="px-4 py-3 font-semibold">{fmtHrs(r.totalMinutes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <p className="text-xs text-muted-foreground no-print">
        ملاحظة: المهام تتحدد وفق صلاحياتك (المدير يرى فريقه، الأدمن/المدير العام يرى الجميع). <XCircle className="inline h-3 w-3" />
      </p>
    </div>
  );
}

function KpiTile({
  icon: Icon, label, value, delta, accent = "primary", suffix,
}: {
  icon: typeof BarChart3;
  label: string;
  value: number | string;
  delta?: number;
  accent?: "primary" | "success" | "info" | "warning" | "destructive";
  suffix?: string;
}) {
  const tone: Record<string, string> = {
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    info: "text-info bg-info/10",
    warning: "text-warning-foreground bg-warning/15",
    destructive: "text-destructive bg-destructive/10",
  };
  const showDelta = typeof delta === "number" && isFinite(delta);
  const positive = (delta ?? 0) >= 0;
  return (
    <Card className="p-4 hover-lift">
      <div className="flex items-start justify-between gap-2">
        <div className={`h-8 w-8 rounded-md flex items-center justify-center ${tone[accent]}`}>
          <Icon className="h-4 w-4" />
        </div>
        {showDelta && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${positive ? "text-success" : "text-destructive"}`}>
            {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(delta!).toFixed(0)}{suffix ? ` ${suffix}` : "%"}
          </span>
        )}
      </div>
      <div className="text-xs text-muted-foreground mt-2">{label}</div>
      <div className="text-xl font-bold mt-0.5 truncate">{value}</div>
    </Card>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string | number }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-semibold truncate">{value}</div>
      </div>
    </Card>
  );
}
