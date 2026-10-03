import { useEffect, useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
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
  CheckCircle2,
  AlertCircle,
  Send,
  ShieldCheck,
  Loader2,
  MessageSquare,
  FileText,
  RotateCcw,
  Printer,
} from "lucide-react";
import { exportToExcel } from "@/lib/export-utils";
import { printOfficialReport } from "@/lib/executive-report.utils";
import { useAuth } from "@/lib/auth-context";
import {
  getJournalSubmission,
  submitDailyJournal,
  reviewDailyJournal,
  type JournalSubmissionRecord,
} from "@/lib/daily-journal.functions";
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
  userId?: string;
  initialDateStr?: string;
  isModal?: boolean;
  onSubmissionChanged?: () => void;
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

export function DailyJournalView({
  tasks,
  userName,
  userId,
  initialDateStr,
  isModal = false,
  onSubmissionChanged,
}: DailyJournalViewProps) {
  const { user, roles } = useAuth();
  const isManager = roles.some((r) => ["admin", "general_manager", "manager"].includes(r));
  const effectiveUserId = userId || user?.id;
  const isViewingOwn = user?.id === effectiveUserId;

  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    () => initialDateStr || new Date().toISOString().slice(0, 10)
  );
  const [copied, setCopied] = useState(false);

  // Submission & Review states
  const [submission, setSubmission] = useState<JournalSubmissionRecord | null>(null);
  const [loadingSubmission, setLoadingSubmission] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [employeeNotes, setEmployeeNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [managerNotes, setManagerNotes] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);

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

  // Load submission record
  const fetchSubmission = async () => {
    if (!effectiveUserId) return;
    setLoadingSubmission(true);
    try {
      const res = await getJournalSubmission({
        data: {
          userId: effectiveUserId,
          date: selectedDateStr,
        },
      });
      if (res.ok) {
        setSubmission(res.submission || null);
        if (res.submission?.manager_notes) {
          setManagerNotes(res.submission.manager_notes);
        }
      }
    } catch (e) {
      console.warn("[DailyJournalView] Failed to fetch submission:", e);
    } finally {
      setLoadingSubmission(false);
    }
  };

  useEffect(() => {
    fetchSubmission();
  }, [effectiveUserId, selectedDateStr]);

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

  const handlePrintPdf = () => {
    if (dayTasks.length === 0) {
      toast.info("لا توجد مهام مسجلة للطباعة");
      return;
    }

    const dateFormatted = format(selectedDate, "EEEE d MMMM yyyy", { locale: ar });

    printOfficialReport({
      title: "تقرير يومية العمل المعتمدة",
      subtitle: "سجل توثيق إنجاز المهام وساعات العمل اليومية للموظف",
      reportCode: `JRN-${selectedDateStr.replace(/-/g, "")}-${(effectiveUserId || "emp").slice(0, 4).toUpperCase()}`,
      metadata: [
        {
          label: "اسم الموظف",
          value: userName || dayTasks.find((t) => t.owner?.full_name)?.owner?.full_name || "موظف المنظومة",
        },
        { label: "تاريخ اليومية", value: dateFormatted },
        {
          label: "حالة الاعتماد",
          value:
            submission?.status === "approved"
              ? "معتمدة رسمياً ✅"
              : submission?.status === "submitted"
              ? "مُرسلة للاعتماد ⏳"
              : submission?.status === "revision_requested"
              ? "مطلوب تعديل ⚠️"
              : "مسودة غير مرسلة",
        },
        { label: "المشاريع المنفذة", value: stats.projectsList.join("، ") || "عام" },
      ],
      kpis: [
        { label: "إجمالي المهام", value: stats.totalTasks },
        { label: "المهام المنجزة", value: stats.completed, color: "#16a34a" },
        { label: "ساعات العمل الموثقة", value: formatMinutes(stats.totalMinutes), color: "#2563eb" },
        { label: "نسبة الإنجاز", value: `${stats.completionRate}%`, color: "#16a34a" },
      ],
      sections: [
        {
          title: "جدول المهام اليومية المنجزة",
          headers: ["م", "عنوان المهمة", "المشروع", "وقت البدء", "وقت الانتهاء", "المدة", "الحالة", "التفاصيل"],
          rows: dayTasks.map((t, idx) => [
            idx + 1,
            t.title,
            t.project?.name || "عام",
            format(new Date(t.start_at), "hh:mm a", { locale: ar }),
            t.end_at ? format(new Date(t.end_at), "hh:mm a", { locale: ar }) : "مستمرة",
            formatMinutes(calculateDurationMinutes(t.start_at, t.end_at)),
            STATUS_LABELS[t.status]?.label || t.status,
            t.details || "—",
          ]),
        },
      ],
      approvalStamp: {
        statusText:
          submission?.status === "approved"
            ? "معتمدة رسمياً وموثقة من الإدارة"
            : submission?.status === "submitted"
            ? "بانتظار توقيع واعتماد الإدارة"
            : "مسودة عمل يومية غير معتمدة",
        isApproved: submission?.status === "approved",
        reviewerName: submission?.reviewer_name || (submission?.status === "approved" ? "المدير المباشر" : null),
        reviewedAt: submission?.reviewed_at
          ? format(new Date(submission.reviewed_at), "yyyy/MM/dd - hh:mm a", { locale: ar })
          : null,
        notes: submission?.manager_notes,
      },
    });
  };

  const handleSubmitJournal = async () => {
    if (dayTasks.length === 0) {
      toast.error("لا يمكن إرسال يومية فارغة. يرجى تسجيل مهام اليوم أولاً.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await submitDailyJournal({
        data: {
          date: selectedDateStr,
          totalTasks: stats.totalTasks,
          completedTasks: stats.completed,
          totalMinutes: stats.totalMinutes,
          employeeNotes: employeeNotes.trim() || undefined,
        },
      });

      if (res.ok) {
        toast.success(res.message || "تم إرسال اليومية بنجاح للاعتماد!");
        setSubmission(res.submission || null);
        setShowSubmitDialog(false);
        setEmployeeNotes("");
        onSubmissionChanged?.();
      } else {
        toast.error(res.error || "تعذّر إرسال اليومية");
      }
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ في الاتصال بالخادم");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReview = async (status: "approved" | "revision_requested") => {
    if (!submission?.id) return;
    setIsReviewing(true);
    try {
      const res = await reviewDailyJournal({
        data: {
          submissionId: submission.id,
          status,
          managerNotes: managerNotes.trim() || undefined,
        },
      });

      if (res.ok) {
        toast.success(res.message || "تم تحديث حالة الاعتماد بنجاح");
        setSubmission(res.submission || null);
        onSubmissionChanged?.();
      } else {
        toast.error(res.error || "تعذّر اعتماد اليومية");
      }
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ أثناء الاعتماد");
    } finally {
      setIsReviewing(false);
    }
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
            استعراض ومراجعة وتوثيق ساعات العمل والمهام المنفذة واعتمادها من الإدارة.
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

      {/* Date Display and Quick Jumps */}
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

      {/* Official Approval Status Banner */}
      {loadingSubmission ? (
        <Card className="p-3 border bg-muted/20 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          جاري التحقق من حالة اعتماد اليومية...
        </Card>
      ) : submission?.status === "approved" ? (
        <Card className="p-4 border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-semibold text-sm text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              تم اعتماد يومية العمل رسمياً
              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[11px] py-0">
                معتمدة ✅
              </Badge>
            </div>
            <p className="text-xs text-emerald-700/90 dark:text-emerald-300/80">
              اعتمدها: <span className="font-medium">{submission.reviewer_name || "المدير المباشر"}</span>
              {submission.reviewed_at && (
                <span> • {format(new Date(submission.reviewed_at), "yyyy/MM/dd - hh:mm a", { locale: ar })}</span>
              )}
            </p>
            {submission.manager_notes && (
              <div className="text-xs bg-emerald-500/15 p-2 rounded border border-emerald-500/20 mt-1">
                💬 <span className="font-medium">ملاحظات المدير:</span> {submission.manager_notes}
              </div>
            )}
          </div>

          <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 shrink-0 text-xs">
            سجل موثق
          </Badge>
        </Card>
      ) : submission?.status === "revision_requested" ? (
        <Card className="p-4 border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-semibold text-sm text-amber-800 dark:text-amber-300">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              مطلوب مراجعة وتعديل مهام اليومية
              <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300 text-[11px] py-0">
                مطلوب تعديل ⚠️
              </Badge>
            </div>
            {submission.manager_notes ? (
              <div className="text-xs bg-amber-500/15 p-2 rounded border border-amber-500/20 mt-1">
                💬 <span className="font-medium">توجيهات المدير:</span> {submission.manager_notes}
              </div>
            ) : (
              <p className="text-xs text-amber-700/90 dark:text-amber-300/80">
                يرجى مراجعة المهام المسجلة لليوم وتحديث الساعات أو التفاصيل ثم إعادة الإرسال.
              </p>
            )}
          </div>

          {isViewingOwn && (
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 gap-1.5 text-xs"
              onClick={() => setShowSubmitDialog(true)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              إعادة الإرسال بعد التعديل
            </Button>
          )}
        </Card>
      ) : submission?.status === "submitted" ? (
        <Card className="p-4 border-blue-500/30 bg-blue-500/10 text-blue-950 dark:text-blue-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-semibold text-sm text-blue-800 dark:text-blue-300">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              اليومية مُرسلة وبانتظار اعتماد المدير
              <Badge variant="outline" className="border-blue-500 text-blue-700 dark:text-blue-300 text-[11px] py-0">
                قيد المراجعة ⏳
              </Badge>
            </div>
            <p className="text-xs text-blue-700/90 dark:text-blue-300/80">
              تم إرسالها في {format(new Date(submission.updated_at), "yyyy/MM/dd - hh:mm a", { locale: ar })}
              {submission.employee_notes && ` • ملاحظة الموظف: "${submission.employee_notes}"`}
            </p>
          </div>

          {isViewingOwn && (
            <Button
              variant="outline"
              size="sm"
              className="border-blue-500/40 text-blue-800 dark:text-blue-200 shrink-0 gap-1.5 text-xs"
              onClick={() => setShowSubmitDialog(true)}
            >
              تحديث الملاحظات / إعادة الإرسال
            </Button>
          )}
        </Card>
      ) : (
        <Card className="p-3 border-dashed bg-muted/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="h-4 w-4 text-muted-foreground/70" />
            <span>مسودة يومية لم تُرسل للاعتماد بعد.</span>
          </div>

          {isViewingOwn && dayTasks.length > 0 && (
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 gap-1.5 text-xs"
              onClick={() => setShowSubmitDialog(true)}
            >
              <Send className="h-3.5 w-3.5" />
              إرسال تقرير اليومية للاعتماد
            </Button>
          )}
        </Card>
      )}

      {/* Employee Submission Modal/Dialog */}
      {showSubmitDialog && (
        <Card className="p-4 border-primary/30 bg-primary/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-sm flex items-center gap-1.5">
              <Send className="h-4 w-4 text-primary" />
              إرسال تقرير يومية العمل للمدير المباشر
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground"
              onClick={() => setShowSubmitDialog(false)}
            >
              ✕
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            ملخص التقرير المرفوع: <span className="font-bold text-foreground">{stats.totalTasks} مهام</span> •{" "}
            <span className="font-bold text-foreground">{formatMinutes(stats.totalMinutes)} عمل</span> •{" "}
            <span className="font-bold text-foreground">نسبة إنجاز {stats.completionRate}%</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
              ملاحظات أو توضيحات إضافية للمدير (اختياري):
            </label>
            <Textarea
              placeholder="مثال: تم إنجاز ربط الفوترة الإلكترونية بنجاح وحل مشكلة ترحيل القيود لفرع الرياض..."
              value={employeeNotes}
              onChange={(e) => setEmployeeNotes(e.target.value)}
              className="h-20 text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSubmitDialog(false)}
              disabled={isSubmitting}
              className="h-8 text-xs"
            >
              إلغاء
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitJournal}
              disabled={isSubmitting}
              className="h-8 gap-1.5 text-xs"
            >
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              تأكيد وإرسال للاعتماد
            </Button>
          </div>
        </Card>
      )}

      {/* Manager Review Action Box */}
      {isManager && submission && submission.status !== "approved" && (
        <Card className="p-4 border-primary/40 bg-card shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="font-semibold text-sm flex items-center gap-2 text-primary">
              <ShieldCheck className="h-4 w-4" />
              لوحة قرار المدير لاعتماد اليومية
            </div>
            <Badge variant="outline" className="text-xs font-normal">
              صلاحية مدير
            </Badge>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              ملاحظات المدير أو التوجيهات للموظف:
            </label>
            <Textarea
              placeholder="اكتب ملاحظاتك هنا في حال الرغبة في توجيه الموظف أو تبرير طلب التعديل..."
              value={managerNotes}
              onChange={(e) => setManagerNotes(e.target.value)}
              className="h-16 text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleReview("revision_requested")}
              disabled={isReviewing}
              className="border-amber-500/40 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20 h-8 gap-1.5 text-xs"
            >
              <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
              طلب تعديل ⚠️
            </Button>

            <Button
              size="sm"
              onClick={() => handleReview("approved")}
              disabled={isReviewing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 gap-1.5 text-xs"
            >
              {isReviewing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              اعتماد اليومية رسمياً ✅
            </Button>
          </div>
        </Card>
      )}

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

          <Button
            variant="default"
            size="sm"
            className="h-8 gap-1.5 text-xs bg-primary text-primary-foreground shadow-xs"
            onClick={handlePrintPdf}
          >
            <Printer className="h-3.5 w-3.5" />
            طباعة / تصدير PDF
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

export function DailyJournalDialog({
  tasks,
  userName,
  userId,
  initialDateStr,
  trigger,
  onSubmissionChanged,
}: {
  tasks: JournalTask[];
  userName?: string;
  userId?: string;
  initialDateStr?: string;
  trigger?: React.ReactNode;
  onSubmissionChanged?: () => void;
}) {
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
        <DailyJournalView
          tasks={tasks}
          userName={userName}
          userId={userId}
          initialDateStr={initialDateStr}
          isModal={true}
          onSubmissionChanged={onSubmissionChanged}
        />
      </DialogContent>
    </Dialog>
  );
}
