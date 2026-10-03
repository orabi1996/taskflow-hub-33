import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  LifeBuoy,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  Filter,
  ShieldCheck,
  MessageSquare,
  Lock,
  Send,
  User,
  FolderKanban,
  Building2,
  RefreshCw,
  Loader2,
  RotateCcw,
  Check,
  Printer,
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { printOfficialReport } from "@/lib/executive-report.utils";
import { useAuth } from "@/lib/auth-context";
import {
  listSupportTickets,
  getTicketDetails,
  createSupportTicket,
  updateTicketStatus,
  addTicketMessage,
  getSlaDashboardStats,
  type TicketRecord,
  type TicketMessageRecord,
} from "@/lib/tickets.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/tickets")({
  component: SupportTicketsPage,
});

const PRIORITY_META: Record<string, { label: string; cls: string; slaHours: number }> = {
  urgent: { label: "عاجل وطارئ", cls: "bg-destructive/15 text-destructive border-destructive/40 font-bold animate-pulse", slaHours: 4 },
  high: { label: "أولوية مرتفعة", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40", slaHours: 8 },
  medium: { label: "أولوية متوسطة", cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/40", slaHours: 24 },
  low: { label: "أولوية منخفضة", cls: "bg-muted text-muted-foreground border-muted", slaHours: 48 },
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  open: { label: "مفتوحة", cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  in_progress: { label: "قيد المعالجة", cls: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30" },
  resolved: { label: "تم الحل ✅", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  closed: { label: "مغلقة", cls: "bg-muted text-muted-foreground border-border" },
};

function formatMinutesDuration(min: number): string {
  if (min <= 0) return "منتهي";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} دقيقة`;
  return `${h} س و ${m} د`;
}

function SupportTicketsPage() {
  const { user, profile } = useAuth();

  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    urgentActive: 0,
    breached: 0,
    complianceRate: 100,
  });

  // Filter States
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

  // Auxiliary data for dropdowns
  const [projectsList, setProjectsList] = useState<{ id: string; name: string }[]>([]);
  const [clientsList, setClientsList] = useState<{ id: string; name: string }[]>([]);
  const [modulesList, setModulesList] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [staffList, setStaffList] = useState<{ id: string; full_name: string }[]>([]);

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketDetails, setTicketDetails] = useState<TicketRecord | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessageRecord[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  // New Ticket Form State
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPriority, setFormPriority] = useState<"urgent" | "high" | "medium" | "low">("medium");
  const [formClientId, setFormClientId] = useState<string>("");
  const [formProjectId, setFormProjectId] = useState<string>("");
  const [formModuleId, setFormModuleId] = useState<string>("");
  const [formAssignedTo, setFormAssignedTo] = useState<string>("");
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  // Resolution Notes Modal
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [ticketToResolve, setTicketToResolve] = useState<string | null>(null);

  // Load Auxiliary Data
  const loadDropdowns = async () => {
    try {
      const [{ data: p }, { data: c }, { data: m }, { data: profs }] = await Promise.all([
        supabase.from("projects").select("id, name").order("name"),
        supabase.from("clients").select("id, name").order("name"),
        supabase.from("company_modules").select("id, name, code").order("name"),
        supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
      ]);
      setProjectsList(p || []);
      setClientsList(c || []);
      setModulesList(m || []);
      setStaffList(profs || []);
    } catch (e) {
      console.warn("Failed to load dropdowns", e);
    }
  };

  // Load Tickets and Stats
  const loadData = async () => {
    setLoading(true);
    try {
      const [ticketsRes, statsRes] = await Promise.all([
        listSupportTickets({
          data: {
            status: statusFilter,
            priority: priorityFilter,
            projectId: projectFilter !== "all" ? projectFilter : undefined,
            search,
          },
        }),
        getSlaDashboardStats(),
      ]);

      if (ticketsRes.ok) {
        setTickets(ticketsRes.tickets || []);
      }
      if (statsRes.ok && statsRes.stats) {
        setStats(statsRes.stats);
      }
    } catch (e) {
      console.error("[SupportTicketsPage] Load data error:", e);
      toast.error("تعذّر استرجاع تذاكر الدعم");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDropdowns();
  }, []);

  useEffect(() => {
    void loadData();
  }, [statusFilter, priorityFilter, projectFilter, search]);

  // Open Details Modal
  const openTicketDrawer = async (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setLoadingDetails(true);
    try {
      const res = await getTicketDetails({ data: { ticketId } });
      if (res.ok && res.ticket) {
        setTicketDetails(res.ticket);
        setTicketMessages(res.messages || []);
      } else {
        toast.error(res.error || "تعذّر فتح تفاصيل التذكرة");
      }
    } catch (e) {
      toast.error("حدث خطأ أثناء تحميل التذكرة");
    } finally {
      setLoadingDetails(false);
    }
  };

  // Send Reply
  const handleSendReply = async () => {
    if (!selectedTicketId || !replyText.trim()) return;
    setSendingReply(true);
    try {
      const res = await addTicketMessage({
        data: {
          ticketId: selectedTicketId,
          message: replyText.trim(),
          isInternalNote,
        },
      });

      if (res.ok && res.message) {
        toast.success("تم إرسال الرد بنجاح");
        setTicketMessages((prev) => [
          ...prev,
          {
            ...res.message,
            sender_name: profile?.full_name || "أنت",
          },
        ]);
        setReplyText("");
        setIsInternalNote(false);
        // refresh list to update first_responded_at
        void loadData();
      } else {
        toast.error(res.error || "تعذّر إرسال الرد");
      }
    } catch (e: any) {
      toast.error(e?.message || "حدث خطأ غير متوقع");
    } finally {
      setSendingReply(false);
    }
  };

  // Change Ticket Status
  const handleUpdateStatus = async (
    ticketId: string,
    status: "open" | "in_progress" | "resolved" | "closed",
    notes?: string
  ) => {
    try {
      const res = await updateTicketStatus({
        data: {
          ticketId,
          status,
          resolutionNotes: notes,
        },
      });

      if (res.ok && res.ticket) {
        toast.success(res.message || "تم تحديث حالة التذكرة");
        setTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? { ...t, ...res.ticket } : t))
        );
        if (ticketDetails && ticketDetails.id === ticketId) {
          setTicketDetails((prev) => (prev ? { ...prev, ...res.ticket } : null));
          void openTicketDrawer(ticketId);
        }
        void loadData();
      } else {
        toast.error(res.error || "تعذّر تحديث الحالة");
      }
    } catch (e: any) {
      toast.error(e?.message || "حدث خطأ");
    }
  };

  // Create Ticket
  const handleCreateTicket = async () => {
    if (!formTitle.trim()) {
      toast.error("يرجى إدخال عنوان التذكرة");
      return;
    }
    setIsSubmittingNew(true);
    try {
      const res = await createSupportTicket({
        data: {
          title: formTitle.trim(),
          description: formDesc.trim() || undefined,
          priority: formPriority,
          clientId: formClientId || undefined,
          projectId: formProjectId || undefined,
          moduleId: formModuleId || undefined,
          assignedTo: formAssignedTo || undefined,
        },
      });

      if (res.ok) {
        toast.success(res.message || "تم إنشاء التذكرة بنجاح");
        setCreateOpen(false);
        setFormTitle("");
        setFormDesc("");
        setFormPriority("medium");
        setFormClientId("");
        setFormProjectId("");
        setFormModuleId("");
        setFormAssignedTo("");
        await loadData();
      } else {
        toast.error(res.error || "تعذّر إنشاء التذكرة");
      }
    } catch (e: any) {
      toast.error(e?.message || "حدث خطأ");
    } finally {
      setIsSubmittingNew(false);
    }
  };

  const handlePrintSlaReport = () => {
    if (tickets.length === 0) {
      toast.info("لا توجد تذاكر دعم فني لطباعة التقرير");
      return;
    }

    printOfficialReport({
      title: "تقرير اتفاقيات مستوى الخدمة وبلاغات الدعم الفني (SLA Operations Report)",
      subtitle: "متابعة كفاءة المعالجة الفنية وسرعة الاستجابة لبلاغات أنظمة ERP و LMS",
      reportCode: `SLA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      metadata: [
        { label: "تاريخ استخراج التقرير", value: new Date().toLocaleDateString("ar-SA") },
        { label: "المسؤول المصدر", value: profile?.full_name || "إدارة الدعم الفني والعمليات" },
        { label: "إجمالي التذاكر المسجلة", value: `${stats.total} تذكرة` },
        { label: "نسبة الالتزام بالـ SLA", value: `${stats.complianceRate}%` },
      ],
      kpis: [
        { label: "التذاكر النشطة", value: stats.active, color: "#2563eb" },
        { label: "بلاغات طارئة وحرجة", value: stats.urgentActive, color: "#dc2626" },
        { label: "نسبة الالتزام بالـ SLA", value: `${stats.complianceRate}%`, color: "#16a34a" },
        { label: "تجاوزت وقت الـ SLA", value: stats.breached, color: "#d97706" },
        { label: "تم حلها بنجاح", value: stats.resolved, color: "#16a34a" },
      ],
      sections: [
        {
          title: "سجل بلاغات وتذاكر الدعم الفني الحالية",
          headers: ["رقم التذكرة", "العنوان", "العميل", "المشروع", "الموديول", "الأولوية", "الحالة", "الفني المسؤول", "موقف الـ SLA"],
          rows: tickets.map((t) => [
            t.ticket_number,
            t.title,
            t.client?.name || "عام",
            t.project?.name || "عام",
            t.module?.name || "—",
            PRIORITY_META[t.priority]?.label || t.priority,
            STATUS_META[t.status]?.label || t.status,
            t.assigned?.full_name || "غير مسند",
            t.status === "resolved" || t.status === "closed"
              ? "مكتملة ومغلقة"
              : t.is_sla_breached
              ? "متأخرة عن الـ SLA ⚠️"
              : `متبقي ${formatMinutesDuration(t.sla_remaining_minutes || 0)}`,
          ]),
        },
      ],
      approvalStamp: {
        statusText: "تقرير رسمي معتمد لعمليات الدعم الفني والـ SLA",
        isApproved: true,
        reviewerName: profile?.full_name || "مدير الدعم والعمليات",
        reviewedAt: new Date().toLocaleDateString("ar-SA"),
        notes: "تمت مراجعة مؤشرات الاستجابة والحل الفني لجميع بلاغات العملاء.",
      },
    });
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <PageHeader
        title="تذاكر الدعم الفني واتفاقيات الخدمة (SLA Hub)"
        description="إدارة ومتابعة بلاغات عملاء أنظمة ERP و LMS ومراقبة زمن الاستجابة والحل الفني."
        icon={LifeBuoy}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintSlaReport}
              disabled={tickets.length === 0}
              className="gap-1.5 text-xs shadow-2xs"
            >
              <Printer className="h-3.5 w-3.5 text-primary" />
              طباعة تقرير الـ SLA (PDF)
            </Button>
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-1 text-xs">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              تحديث
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 text-xs bg-primary text-primary-foreground shadow-xs">
                  <Plus className="h-4 w-4" />
                  فتح تذكرة دعم فني جديدة
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <LifeBuoy className="h-5 w-5 text-primary" />
                    فتح تذكرة دعم فني وبلاغ عطل جديد
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">عنوان التذكرة / البلاغ *</label>
                    <Input
                      placeholder="مثال: توقف مزامنة قيود اليومية أو بطء استجابة سيرفر الاختبارات..."
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold">درجة الأولوية ومستوى الخدمة (SLA)</label>
                      <Select
                        value={formPriority}
                        onValueChange={(v: any) => setFormPriority(v)}
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          <SelectItem value="urgent">عاجل وطارئ (SLA: 4 ساعات)</SelectItem>
                          <SelectItem value="high">مرتفع (SLA: 8 ساعات)</SelectItem>
                          <SelectItem value="medium">متوسط (SLA: 24 ساعة)</SelectItem>
                          <SelectItem value="low">منخفض (SLA: 48 ساعة)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold">العميل صاحب البلاغ</label>
                      <Select value={formClientId} onValueChange={setFormClientId}>
                        <SelectTrigger className="text-xs">
                          <SelectValue placeholder="اختر العميل..." />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          {clientsList.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold">المشروع المرتبط</label>
                      <Select value={formProjectId} onValueChange={setFormProjectId}>
                        <SelectTrigger className="text-xs">
                          <SelectValue placeholder="اختر المشروع..." />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          {projectsList.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold">الموديول / النظام المعني</label>
                      <Select value={formModuleId} onValueChange={setFormModuleId}>
                        <SelectTrigger className="text-xs">
                          <SelectValue placeholder="اختر موديول النظام..." />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          {modulesList.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name} {m.code ? `(${m.code})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold">إسناد لفني الدعم أو المهندس المسؤول</label>
                    <Select value={formAssignedTo} onValueChange={setFormAssignedTo}>
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="اختر الفني المسؤول..." />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        {staffList.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold">تفاصيل المشكلة والرسائل الظاهرة</label>
                    <Textarea
                      placeholder="صف الأعطال بدقة، وأي رسائل خطأ أو خطوات لتكرار المشكلة..."
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                      className="h-24 text-xs"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCreateOpen(false)}
                      disabled={isSubmittingNew}
                      className="text-xs"
                    >
                      إلغاء
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCreateTicket}
                      disabled={isSubmittingNew}
                      className="gap-1.5 text-xs"
                    >
                      {isSubmittingNew ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      فتح التذكرة الآن
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-4 bg-card border shadow-2xs">
          <div className="text-xs text-muted-foreground">التذاكر النشطة</div>
          <div className="text-2xl font-bold mt-1 text-primary">{stats.active}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {stats.open} مفتوحة • {stats.inProgress} قيد العمل
          </div>
        </Card>

        <Card className="p-4 bg-card border shadow-2xs">
          <div className="text-xs text-muted-foreground">بلاغات طارئة وحرجة</div>
          <div className="text-2xl font-bold mt-1 text-destructive flex items-center gap-1.5">
            {stats.urgentActive}
            {stats.urgentActive > 0 && <span className="h-2 w-2 rounded-full bg-destructive animate-ping" />}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">SLA أقل من 4 ساعات</div>
        </Card>

        <Card className="p-4 bg-card border shadow-2xs">
          <div className="text-xs text-muted-foreground">نسبة الالتزام بالـ SLA</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
            {stats.complianceRate}%
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">مؤشر سرعة الاستجابة</div>
        </Card>

        <Card className="p-4 bg-card border shadow-2xs">
          <div className="text-xs text-muted-foreground">تجاوزت وقت الـ SLA</div>
          <div className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
            {stats.breached}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">تتطلب تسريع المعالجة</div>
        </Card>

        <Card className="p-4 bg-card border shadow-2xs">
          <div className="text-xs text-muted-foreground">تم حلها وإغلاقها</div>
          <div className="text-2xl font-bold mt-1 text-muted-foreground">{stats.resolved}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">حل مكتمل وموثق</div>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="p-3.5 bg-card border shadow-2xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="البحث برقم التذكرة، العنوان، اسم العميل..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-32 text-xs">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="all">كافة الحالات</SelectItem>
              <SelectItem value="open">مفتوحة</SelectItem>
              <SelectItem value="in_progress">قيد المعالجة</SelectItem>
              <SelectItem value="resolved">تم الحل</SelectItem>
              <SelectItem value="closed">مغلقة</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="h-9 w-32 text-xs">
              <SelectValue placeholder="الأولوية" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="all">كافة الأولويات</SelectItem>
              <SelectItem value="urgent">عاجل وطارئ</SelectItem>
              <SelectItem value="high">مرتفع</SelectItem>
              <SelectItem value="medium">متوسط</SelectItem>
              <SelectItem value="low">منخفض</SelectItem>
            </SelectContent>
          </Select>

          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-9 w-40 text-xs">
              <SelectValue placeholder="المشروع" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="all">كافة المشاريع</SelectItem>
              {projectsList.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Tickets List */}
      {loading ? (
        <Card className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs">جاري تحميل تذاكر الدعم الفني...</span>
        </Card>
      ) : tickets.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground border-dashed">
          <LifeBuoy className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
          <div className="font-semibold text-sm">لا توجد تذاكر دعم فني مطابقة للشروط</div>
          <p className="text-xs text-muted-foreground mt-1">
            يمكنك فتح تذكرة دعم جديدة أو تعديل خيارات التصفية والبحث أعلاه.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => {
            const pMeta = PRIORITY_META[t.priority] || PRIORITY_META.medium;
            const sMeta = STATUS_META[t.status] || STATUS_META.open;
            const isResolved = t.status === "resolved" || t.status === "closed";

            return (
              <Card
                key={t.id}
                className={`p-4 bg-card border transition-all shadow-2xs hover:shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  t.is_sla_breached && !isResolved ? "border-destructive/40 bg-destructive/5" : ""
                }`}
              >
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold bg-muted px-2 py-0.5 rounded text-foreground">
                      {t.ticket_number}
                    </span>
                    <Badge variant="outline" className={pMeta.cls}>
                      {pMeta.label}
                    </Badge>
                    <Badge variant="outline" className={sMeta.cls}>
                      {sMeta.label}
                    </Badge>
                    {t.module?.name && (
                      <Badge variant="outline" className="text-[11px] font-normal py-0">
                        {t.module.name}
                      </Badge>
                    )}
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm leading-tight text-foreground hover:text-primary transition-colors cursor-pointer" onClick={() => openTicketDrawer(t.id)}>
                      {t.title}
                    </h4>
                    {t.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                        {t.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap pt-0.5">
                    {t.client?.name && (
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {t.client.name}
                      </span>
                    )}
                    {t.project?.name && (
                      <span className="flex items-center gap-1">
                        <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
                        {t.project.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      المسؤول: {t.assigned?.full_name || "غير مسند"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {format(new Date(t.created_at), "yyyy/MM/dd - hh:mm a", { locale: ar })}
                    </span>
                  </div>
                </div>

                {/* SLA & Actions */}
                <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end justify-between gap-3 shrink-0 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0">
                  {/* SLA Indicator */}
                  <div>
                    {isResolved ? (
                      <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-xs gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        تم الحل بنجاح
                      </Badge>
                    ) : t.is_sla_breached ? (
                      <Badge variant="outline" className="border-destructive text-destructive text-xs gap-1 animate-pulse">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        تجاوزت وقت الـ SLA ⚠️
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-blue-500/40 text-blue-600 dark:text-blue-400 text-xs gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        متبقي على الـ SLA: {formatMinutesDuration(t.sla_remaining_minutes || 0)}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5 flex-1 sm:flex-none"
                      onClick={() => openTicketDrawer(t.id)}
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-primary" />
                      المحادثة والتفاصيل
                    </Button>

                    {t.status === "open" && (
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                        onClick={() => handleUpdateStatus(t.id, "in_progress")}
                      >
                        بدء المعالجة
                      </Button>
                    )}

                    {t.status === "in_progress" && (
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => {
                          setTicketToResolve(t.id);
                          setResolveDialogOpen(true);
                        }}
                      >
                        حل البلاغ ✅
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Ticket Details & Discussion Modal */}
      <Dialog
        open={Boolean(selectedTicketId)}
        onOpenChange={(open) => !open && setSelectedTicketId(null)}
      >
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto" dir="rtl">
          {loadingDetails || !ticketDetails ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs">جاري تحميل سجل التذكرة والمحادثات...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header */}
              <div className="border-b pb-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded">
                      {ticketDetails.ticket_number}
                    </span>
                    <Badge variant="outline" className={PRIORITY_META[ticketDetails.priority]?.cls}>
                      {PRIORITY_META[ticketDetails.priority]?.label}
                    </Badge>
                    <Badge variant="outline" className={STATUS_META[ticketDetails.status]?.cls}>
                      {STATUS_META[ticketDetails.status]?.label}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {ticketDetails.status !== "resolved" && ticketDetails.status !== "closed" && (
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                        onClick={() => {
                          setTicketToResolve(ticketDetails.id);
                          setResolveDialogOpen(true);
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        اعتماد حل المشكلة
                      </Button>
                    )}

                    {ticketDetails.status === "resolved" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs text-muted-foreground gap-1"
                        onClick={() => handleUpdateStatus(ticketDetails.id, "closed")}
                      >
                        إغلاق نهائي
                      </Button>
                    )}
                  </div>
                </div>

                <h3 className="text-base font-bold text-foreground">
                  {ticketDetails.title}
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground pt-1">
                  <div>
                    <span className="font-semibold text-foreground">العميل:</span>{" "}
                    {ticketDetails.client?.name || "عام"}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">المشروع:</span>{" "}
                    {ticketDetails.project?.name || "عام"}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">الموديول:</span>{" "}
                    {ticketDetails.module?.name || "عام"}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">الفني المسؤول:</span>{" "}
                    {ticketDetails.assigned?.full_name || "غير محدد"}
                  </div>
                </div>

                {ticketDetails.description && (
                  <div className="p-3 rounded-lg bg-muted/40 text-xs leading-relaxed text-foreground mt-2 border">
                    <span className="font-semibold block mb-1">وصف البلاغ الفني:</span>
                    {ticketDetails.description}
                  </div>
                )}

                {ticketDetails.resolution_notes && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs leading-relaxed text-emerald-950 dark:text-emerald-100 mt-2">
                    <span className="font-semibold block mb-1">ملاحظات الحل المعتمد:</span>
                    {ticketDetails.resolution_notes}
                  </div>
                )}
              </div>

              {/* Messages Thread */}
              <div className="space-y-3">
                <div className="font-semibold text-xs flex items-center gap-1.5 text-muted-foreground">
                  <MessageSquare className="h-4 w-4" />
                  سجل التحديثات والمراسلات ({ticketMessages.length})
                </div>

                {ticketMessages.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground border rounded-lg bg-muted/10">
                    لا توجد ردود بعد. أضف رداً أو ملاحظة فنية أدناه.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto p-1">
                    {ticketMessages.map((m) => (
                      <div
                        key={m.id}
                        className={`p-3 rounded-lg border text-xs space-y-1.5 shadow-2xs ${
                          m.is_internal_note
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-100"
                            : "bg-card text-foreground"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-bold">
                            {m.sender_name || "مستخدم"}
                            {m.is_internal_note && (
                              <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-300 text-[10px] py-0 gap-1">
                                <Lock className="h-2.5 w-2.5" />
                                ملاحظة فنية داخلية
                              </Badge>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {format(new Date(m.created_at), "yyyy/MM/dd - hh:mm a", { locale: ar })}
                          </span>
                        </div>

                        <p className="leading-relaxed whitespace-pre-wrap">{m.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Send Reply Box */}
              <div className="pt-2 border-t space-y-2">
                <Textarea
                  placeholder="اكتب ردك أو التوجيه الفني هنا..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="h-20 text-xs"
                />

                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isInternalNote}
                      onChange={(e) => setIsInternalNote(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    <Lock className="h-3.5 w-3.5 text-amber-600" />
                    <span>تسجيل كملاحظة فنية داخلية (خاصة بفريق العمل فقط)</span>
                  </label>

                  <Button
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={handleSendReply}
                    disabled={sendingReply || !replyText.trim()}
                  >
                    {sendingReply ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    إرسال الرد
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Resolution Notes Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              توثيق حل تذكرة الدعم الفني
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground">
              يرجى كتابة الإجراءات والحلول الفنية التي تمت لمعالجة البلاغ لتوثيقها في سجل العميل.
            </p>

            <Textarea
              placeholder="مثال: تم تحديث شهادة الـ CSID على سيرفر الفوترة وإعادة تشغيل خدمة المزامنة مع منصة الزكاة بنجاح..."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              className="h-24 text-xs"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setResolveDialogOpen(false)}
              >
                إلغاء
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs"
                onClick={() => {
                  if (ticketToResolve) {
                    void handleUpdateStatus(ticketToResolve, "resolved", resolutionNotes);
                    setResolveDialogOpen(false);
                    setResolutionNotes("");
                    setTicketToResolve(null);
                  }
                }}
              >
                <Check className="h-3.5 w-3.5" />
                تأكيد الحل وإغلاق البلاغ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
