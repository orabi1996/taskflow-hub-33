import { useMemo, useState } from "react";
import { format, isSameDay } from "date-fns";
import { ar } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  ClipboardList,
  Clock,
  Copy,
  Download,
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  FolderKanban,
  Check,
} from "lucide-react";
import { exportToExcel } from "@/lib/export-utils";
import { toast } from "sonner";

export interface JournalTask {
  id: string;
  title: string;
  details?: string | null;
  status: "completed" | "pending" | "postponed" | "cancelled";
  start_at: string;
  end_at: string | null;
  project?: { name: string } | null;
  owner?: { full_name: string | null; job_title?: string | null } | null;
}

export interface DailyJournalViewProps {
  tasks: JournalTask[];
  userName?: string;
  initialDateStr?: string;
  isModal?: boolean;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  completed: { label: "منتهية", cls: "bg-success/15 text-success border-success/30" },
  pending: { label: "قيد التنفيذ", cls: "bg-info/15 text-info border-info/30" },
  postponed: { label: "مؤجلة", cls: "bg-warning/15 text-warning-foreground border-warning/40" },
  cancelled: { label: "ملغاة", cls: "bg-destructive/10 text-destructive border-destructive/30" },
};

function calculateDurationMinutes(start: string, end: string | null): number {
  if (!end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return ms > 0 ? Math.round(ms / 60000) : 0;
}

function formatMinutes(min: number): string {
  if (min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} دقيقة`;
  if (m === 0) return `${h} ساعة`;
  return `${h} س و ${m} د`;
}

export function DailyJournalView({ tasks, userName, initialDateStr, isModal = false }: DailyJournalViewProps) {
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    () => initialDateStr || new Date().toISOString().slice(0, 10)
  );
  const [copied, setCopied] = useState(false);

  const selectedDate = useMemo(() => new Date(selectedDateStr + "T00:00:00"), [selectedDateStr]);

  const dayTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        const taskDate = new Date(t.start_at);
        return isSameDay(taskDate, selectedDate);
      })
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [tasks, selectedDate]);

  const stats = useMemo(() => {
    let totalMinutes = 0;
    let completedCount = 0;
    const projectSet = new Set<string>();

    for (const t of dayTasks) {
      totalMinutes += calculateDurationMinutes(t.start_at, t.end_at);
      if (t.status === "completed") completedCount++;
      if (t.project?.name) projectSet.add(t.project.name);
    }

    const completionRate = dayTasks.length
      ? Math.round((completedCount / dayTasks.length) * 100)
      : 0;

    return {
      totalTasks: dayTasks.length,
      completed: completedCount,
      pending: dayTasks.filter((t) => t.status === "pending").length,
      postponed: dayTasks.filter((t) => t.status === "postponed").length,
      totalMinutes,
      completionRate,
      projectCount: projectSet.size,
      projectsList: Array.from(projectSet),
    };
  }, [dayTasks]);

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDateStr(d.toISOString().slice(0, 10));
  };

  const handleCopySummary = () => {
    if (dayTasks.length === 0) {
      toast.info("لا توجد مهام مسجلة في هذا اليوم لنسخها");
      return;
    }

    const dateFormatted = format(selectedDate, "EEEE d MMMM yyyy", { locale: ar });
    const durationFormatted = formatMinutes(stats.totalMinutes);

    let text = `📋 تقرير يومية العمل — ${dateFormatted}\n`;
    if (userName) text += `👤 الموظف: ${userName}\n`;
    text += `⏱️ إجمالي الساعات: ${durationFormatted}\n`;
    text += `📁 المشاريع: ${stats.projectsList.join("، ") || "عام"}\n`;
    text += `📊 الإنجاز: ${stats.completed}/${stats.totalTasks} (${stats.completionRate}%)\n\n`;

    text += `🔹 تفاصيل المهام اليومية:\n`;
    dayTasks.forEach((t, idx) => {
      const timeStr = t.end_at
        ? `${format(new Date(t.start_at), "hh:mm a", { locale: ar })} - ${format(new Date(t.end_at), "hh:mm a", { locale: ar })}`
        : format(new Date(t.start_at), "hh:mm a", { locale: ar });
      const statusStr = STATUS_LABELS[t.status]?.label || t.status;
      const projStr = t.project?.name ? `[${t.project.name}] ` : "";
      text += `${idx + 1}. ${projStr}${t.title} (${timeStr}) - [${statusStr}]\n`;
      if (t.details) {
        text += `   التفاصيل: ${t.details.trim().slice(0, 150)}\n`;
      }
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("تم نسخ تقرير اليومية بنجاح إلى الحافظة!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleExportExcel = () => {
    if (dayTasks.length === 0) {
      toast.info("لا توجد مهام مسجلة للتصدير");
      return;
    }
    const exportData = dayTasks.map((t, i) => ({
      "م": i + 1,
      "عنوان المهمة": t.title,
      "المشروع": t.project?.name || "عام",
      "الحالة": STATUS_LABELS[t.status]?.label || t.status,
      "وقت البدء": format(new Date(t.start_at), "hh:mm a - yyyy/MM/dd", { locale: ar }),
      "وقت الانتهاء": t.end_at ? format(new Date(t.end_at), "hh:mm a - yyyy/MM/dd", { locale: ar }) : "—",
      "المدة المستغرقة": formatMinutes(calculateDurationMinutes(t.start_at, t.end_at)),
      "التفاصيل": t.details || "",
    }));

    exportToExcel(exportData, `يومية_عمل_${selectedDateStr}`);
    toast.success("تم تصدير اليومية إلى ملف Excel");
  };

  return (
    <div className={`space-y-4 ${isModal ? "" : "p-1"}`} dir="rtl">
      {/* Header and Date Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            سجل يومية العمل (Daily Work Journal)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            استعراض ومراجعة وتوثيق ساعات العمل والمهام المنفذة لكل يوم بدقة.
          </p>
        </div>

        {/* Date Controls */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => shiftDate(-1)}
            title="اليوم السابق"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Input
            type="date"
            value={selectedDateStr}
            onChange={(e) => e.target.value && setSelectedDateStr(e.target.value)}
            className="h-8 w-36 text-xs text-center font-medium"
          />

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => shiftDate(1)}
            title="اليوم التالي"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Date Display and quick jumps */}
      <div className="flex items-center justify-between gap-2 py-1">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">
            {format(selectedDate, "EEEE، d MMMM yyyy", { locale: ar })}
          </span>
          {userName && (
            <Badge variant="outline" className="text-xs font-normal">
              {userName}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant={isSameDay(selectedDate, new Date()) ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => setSelectedDateStr(new Date().toISOString().slice(0, 10))}
          >
            اليوم
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => {
              const y = new Date();
              y.setDate(y.getDate() - 1);
              setSelectedDateStr(y.toISOString().slice(0, 10));
            }}
          >
            أمس
          </Button>
        </div>
      </div>

      {/* Daily Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Card className="p-3 bg-card border">
          <div className="text-xs text-muted-foreground">إجمالي المهام</div>
          <div className="text-xl font-bold mt-0.5">{stats.totalTasks}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {stats.completed} منجزة • {stats.pending} قيد العمل
          </div>
        </Card>

        <Card className="p-3 bg-card border">
          <div className="text-xs text-muted-foreground">ساعات العمل المسجلة</div>
          <div className="text-xl font-bold mt-0.5 text-primary">
            {formatMinutes(stats.totalMinutes)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            من أصل 8 ساعات عمل
          </div>
        </Card>

        <Card className="p-3 bg-card border">
          <div className="text-xs text-muted-foreground">نسبة الإنجاز</div>
          <div className="text-xl font-bold mt-0.5 text-success">
            {stats.completionRate}%
          </div>
          <Progress value={stats.completionRate} className="h-1.5 mt-1" />
        </Card>

        <Card className="p-3 bg-card border">
          <div className="text-xs text-muted-foreground">المشاريع المستهدفة</div>
          <div className="text-xl font-bold mt-0.5 text-info">
            {stats.projectCount}
          </div>
          <div className="text-[11px] text-muted-foreground truncate mt-0.5">
            {stats.projectsList.join("، ") || "لا توجد مشاريع"}
          </div>
        </Card>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between gap-2 pt-1 pb-1">
        <div className="text-xs text-muted-foreground font-medium">
          جدول المهام الزمنية لليوم ({dayTasks.length})
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={handleCopySummary}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "تم النسخ" : "نسخ تقرير اليومية"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={handleExportExcel}
          >
            <Download className="h-3.5 w-3.5" />
            تصدير Excel
          </Button>
        </div>
      </div>

      {/* Tasks Timeline */}
      {dayTasks.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground border border-dashed rounded-lg bg-muted/10">
          <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
          <div className="font-semibold text-sm">لا توجد مهام مسجلة لهذا اليوم</div>
          <div className="text-xs text-muted-foreground mt-1">
            قم بإضافة مهام عبر استمارة إضافة المهمة لتظهر في سجل اليومية.
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {dayTasks.map((t, idx) => {
            const durationMin = calculateDurationMinutes(t.start_at, t.end_at);
            const meta = STATUS_LABELS[t.status] || { label: t.status, cls: "" };
            const startTime = format(new Date(t.start_at), "hh:mm a", { locale: ar });
            const endTime = t.end_at ? format(new Date(t.end_at), "hh:mm a", { locale: ar }) : null;

            return (
              <div
                key={t.id}
                className="flex items-start gap-3 p-3.5 rounded-lg border bg-card hover:bg-muted/10 transition-colors shadow-2xs"
              >
                <div className="h-7 w-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{t.title}</span>
                    {t.project?.name && (
                      <Badge variant="outline" className="text-[11px] gap-1 py-0">
                        <FolderKanban className="h-3 w-3 text-primary" />
                        {t.project.name}
                      </Badge>
                    )}
                  </div>

                  {t.details && (
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {t.details}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
                    <span className="flex items-center gap-1 font-medium">
                      <Clock className="h-3.5 w-3.5" />
                      {startTime} {endTime ? `← ${endTime}` : "(مستمرة)"}
                    </span>

                    {durationMin > 0 && (
                      <span className="bg-muted px-2 py-0.5 rounded text-[11px] font-medium">
                        المدة: {formatMinutes(durationMin)}
                      </span>
                    )}
                  </div>
                </div>

                <Badge variant="outline" className={meta.cls}>
                  {meta.label}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DailyJournalDialog({ tasks, userName, trigger }: { tasks: JournalTask[]; userName?: string; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2 shadow-xs">
            <ClipboardList className="h-4 w-4 text-primary" />
            <span>سجل اليومية</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DailyJournalView tasks={tasks} userName={userName} isModal={true} />
      </DialogContent>
    </Dialog>
  );
}
