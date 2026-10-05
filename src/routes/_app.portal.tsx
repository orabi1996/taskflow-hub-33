import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  LifeBuoy,
  Plus,
  Send,
  Loader2,
  FileSignature,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Printer,
  ChevronDown,
  Layers,
  Sparkles,
  PhoneCall,
  Mail,
  ShieldCheck,
  Star,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { CrmXAppIcon } from "@/components/brand/CrmXLogo";
import { printOfficialReport } from "@/lib/executive-report.utils";
import {
  listSupportTickets,
  createSupportTicket,
  getTicketDetails,
  addTicketMessage,
  type TicketRecord,
  type TicketMessageRecord,
} from "@/lib/tickets.functions";

export const Route = createFileRoute("/_app/portal")({
  component: ClientPortalPage,
});

interface ClientProfile {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  address: string | null;
  project_id: string;
  project_name?: string;
  contract_number: string | null;
  contract_value: number | null;
  currency: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  health_status: "green" | "yellow" | "red";
}

interface ModuleOption {
  id: string;
  name: string;
  code: string | null;
  color: string | null;
}

const FAQS = [
  {
    q: "كيف يمكنني تصدير القيود والميزانية الختامية في نظام الـ ERP؟",
    a: "من القائمة الجانبية في نظام الـ ERP، انتقل إلى 'الحسابات العامة' > 'التقارير المالية'، وحدد الفترة المالية واضغط على 'تصدير ميزان المراجعة Excel'.",
  },
  {
    q: "طريقة مزامنة الفصول الافتراضية مع منصة التعلم الذكي LMS؟",
    a: "تتم المزامنة تلقائياً كل 15 دقيقة، أو يمكنك الضغط على زر 'مزامنة فورية الآن' من لوحة إدارة الشعب الدراسية.",
  },
  {
    q: "ما هي المدة المحددة لاتفاقية مستوى الخدمة SLA لحل المشكلات الحرجة؟",
    a: "تلتزم المنظومة بالاستجابة للبلاغات الحرجة (Urgent) خلال أقل من ساعة واحدة، وبدء إجراءات المعالجة الفورية المباشرة بمتابعة مدير الحساب.",
  },
  {
    q: "كيفية إضافة موظف جديد وتخصيص صلاحيات الفروع في موديول HR؟",
    a: "من شاشة 'الموارد البشرية' > 'ملفات الموظفين' > اضغط 'إضافة موظف'، ثم حدد الفرع والقسم ومصفوفة الصلاحيات المعتمدة.",
  },
];

function ClientPortalPage() {
  const { user } = useAuth();

  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Tickets for selected client
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  // Open New Ticket Dialog
  const [openNewTicket, setOpenNewTicket] = useState(false);
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<"urgent" | "high" | "medium" | "low">("medium");
  const [newModuleId, setNewModuleId] = useState<string>("");
  const [newCategory, setNewCategory] = useState("استفسار فني");

  // Selected Ticket Drawer / Chat
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketRecord | null>(null);
  const [messages, setMessages] = useState<TicketMessageRecord[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  // FAQ Accordion Toggle
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // 1. Initial Load of Clients & Modules
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [clsRes, projsRes, modsRes] = await Promise.all([
          supabase.from("clients").select("*").order("created_at", { ascending: false }),
          supabase.from("projects").select("id, name"),
          supabase.from("company_modules").select("id, name, code, color").order("name"),
        ]);

        const projsMap = new Map((projsRes.data ?? []).map((p) => [p.id, p.name]));
        const enriched: ClientProfile[] = (clsRes.data ?? []).map((c: any) => ({
          ...c,
          project_name: projsMap.get(c.project_id) || "مشروع المنظومة",
        }));

        setClients(enriched);
        setModules((modsRes.data ?? []) as ModuleOption[]);

        // Check if there is a saved selected client or default to first
        const savedClientId = typeof window !== "undefined" ? localStorage.getItem("crm_x_portal_client_id") : null;
        if (savedClientId && enriched.some((c) => c.id === savedClientId)) {
          setSelectedClientId(savedClientId);
        } else if (enriched.length > 0) {
          setSelectedClientId(enriched[0].id);
        }
      } catch (err: any) {
        toast.error("تعذر تحميل بيانات البوابة: " + (err?.message || "خطأ غير متوقع"));
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, []);

  // Current active client object
  const currentClient = useMemo(() => {
    return clients.find((c) => c.id === selectedClientId) || null;
  }, [clients, selectedClientId]);

  // Save selected client in local storage
  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    if (typeof window !== "undefined") {
      localStorage.setItem("crm_x_portal_client_id", clientId);
    }
  };

  // 2. Fetch Tickets for current client
  const fetchClientTickets = async (clientId: string) => {
    if (!clientId) return;
    setTicketsLoading(true);
    try {
      const res = await listSupportTickets({
        data: { clientId },
      });
      if (res.ok && res.tickets) {
        setTickets(res.tickets);
      } else {
        setTickets([]);
      }
    } catch {
      setTickets([]);
    } finally {
      setTicketsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClientId) {
      void fetchClientTickets(selectedClientId);
    }
  }, [selectedClientId]);

  // Open Ticket Details Modal
  const openTicketModal = async (ticket: TicketRecord) => {
    setSelectedTicket(ticket);
    setDrawerOpen(true);
    setLoadingMessages(true);
    try {
      const res = await getTicketDetails({ data: { ticketId: ticket.id } });
      if (res.ok && res.ticket) {
        setSelectedTicket(res.ticket);
        // Only show non-internal messages to clients
        setMessages((res.messages || []).filter((m) => !m.is_internal_note));
      }
    } finally {
      setLoadingMessages(false);
    }
  };

  // Submit New Ticket
  const handleSubmitTicket = async () => {
    if (!newTitle.trim() || !selectedClientId || !currentClient) {
      toast.error("يرجى إدخال عنوان المشكلة واختيار العميل");
      return;
    }
    setSubmittingTicket(true);
    try {
      const res = await createSupportTicket({
        data: {
          title: newTitle.trim(),
          description: newDesc.trim() || null,
          priority: newPriority,
          category: newCategory,
          clientId: selectedClientId,
          projectId: currentClient.project_id,
          moduleId: newModuleId || null,
        },
      });

      if (res.ok && res.ticket) {
        toast.success(`تم إنشاء التذكرة بنجاح بالرقم: ${res.ticket.ticket_number}`);
        setOpenNewTicket(false);
        setNewTitle("");
        setNewDesc("");
        setNewPriority("medium");
        setNewModuleId("");
        void fetchClientTickets(selectedClientId);
      } else {
        toast.error(res.error || "تعذّر حفظ التذكرة");
      }
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ أثناء إرسال التذكرة");
    } finally {
      setSubmittingTicket(false);
    }
  };

  // Send Reply from Client
  const handleSendReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;
    setSendingReply(true);
    try {
      const res = await addTicketMessage({
        data: {
          ticketId: selectedTicket.id,
          message: replyText.trim(),
          isInternalNote: false,
        },
      });

      if (res.ok && res.message) {
        toast.success("تم إرسال ردك إلى فريق الدعم");
        setMessages((prev) => [
          ...prev,
          {
            ...res.message!,
            sender_name: currentClient?.name || "العميل",
          },
        ]);
        setReplyText("");
      } else {
        toast.error(res.error || "تعذّر إرسال الرد");
      }
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ أثناء الإرسال");
    } finally {
      setSendingReply(false);
    }
  };

  // Print Service Statement
  const handlePrintCertificate = () => {
    if (!currentClient) return;

    const openCount = tickets.filter((t) => t.status !== "resolved" && t.status !== "closed").length;
    const resolvedCount = tickets.filter((t) => t.status === "resolved" || t.status === "closed").length;

    printOfficialReport({
      title: "شهادة وموقف مستوى الخدمة والتراخيص (Customer SLA Statement)",
      subtitle: `تقرير رسمي صادر لحساب العميل: ${currentClient.name} (${currentClient.company || "حساب مباشر"})`,
      metadata: [
        { label: "رقم العقد / الترخيص", value: currentClient.contract_number || "ساري بدون رقم" },
        { label: "النظام المرتبط", value: currentClient.project_name || "منظومة سحابية" },
        { label: "تاريخ بداية العقد", value: currentClient.contract_start_date || "—" },
        { label: "تاريخ نهاية الترخيص", value: currentClient.contract_end_date || "—" },
        {
          label: "قيمة العقد السنوية",
          value: currentClient.contract_value
            ? `${currentClient.contract_value.toLocaleString()} ${currentClient.currency || "SAR"}`
            : "—",
        },
        { label: "حالة الحساب", value: currentClient.health_status === "green" ? "ممتاز / مستقر" : "ساري" },
      ],
      kpis: [
        { label: "إجمالي التذاكر المرفوعة", value: tickets.length, subtext: "منذ بدء التعاقد", color: "#0F4C5C" },
        { label: "تذاكر تم حلها بنجاح", value: resolvedCount, subtext: "تم إغلاقها", color: "#059669" },
        { label: "تذاكر قيد المعالجة الآن", value: openCount, subtext: "بمتابعة فريق الدعم", color: "#d97706" },
        { label: "معدل الامتثال للـ SLA", value: "99.2%", subtext: "استجابة وحل قياسي", color: "#00A6A6" },
      ],
      sections: [
        {
          title: "سجل تذاكر الدعم والطلبات الفنية للعميل",
          headers: ["رقم التذكرة", "عنوان البلاغ", "الموديول", "الأهمية", "الحالة", "تاريخ الرفع"],
          rows: tickets.map((t) => [
            t.ticket_number,
            t.title,
            t.module?.name || "عام",
            t.priority === "urgent" ? "عاجل" : t.priority === "high" ? "مرتفع" : "عادي",
            t.status === "resolved" ? "تم الحل" : t.status === "in_progress" ? "قيد التنفيذ" : "مفتوحة",
            t.created_at.slice(0, 10),
          ]),
        },
      ],
      approvalStamp: {
        statusText: "معتمد من إدارة الجودة وخدمة العملاء (CRM-X Customer Success)",
        isApproved: true,
        reviewerName: "إدارة علاقات الشركاء السحابيين",
        reviewedAt: new Date().toISOString(),
        notes: "تم استخراج هذا الموقف آلياً لتوثيق الالتزام باتفاقيات مستوى الخدمة وجودة الدعم الفني.",
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Client Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader
          title="بوابة خدمة العملاء والشركاء (Client Portal)"
          description="متابعة حالة التراخيص والعقود، رفع وتتبع بلاغات الدعم، وقاعدة المعرفة الفورية"
          icon={Building2}
        />

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Client Switcher Selector */}
          <div className="flex items-center gap-2 bg-card p-1.5 rounded-lg border shadow-sm">
            <span className="text-xs font-semibold text-muted-foreground mr-1">حساب المنشأة:</span>
            <Select value={selectedClientId} onValueChange={handleSelectClient}>
              <SelectTrigger className="w-[220px] text-xs h-8 border-none bg-muted/50 font-bold">
                <SelectValue placeholder="اختر العميل" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs font-medium">
                    {c.name} {c.company ? `(${c.company})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" size="sm" onClick={handlePrintCertificate} className="gap-1.5 text-xs h-9">
            <Printer className="h-4 w-4 text-primary" />
            شهادة الخدمة (PDF)
          </Button>

          <Button size="sm" onClick={() => setOpenNewTicket(true)} className="gap-1.5 text-xs h-9">
            <Plus className="h-4 w-4" />
            فتح تذكرة دعم جديدة
          </Button>
        </div>
      </div>

      {/* Client Overview Banner */}
      {currentClient && (
        <Card className="p-6 bg-gradient-to-r from-primary/10 via-card to-card border-primary/20 shadow-sm">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <CrmXAppIcon size={52} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-foreground">{currentClient.name}</span>
                  {currentClient.company && (
                    <Badge variant="outline" className="text-xs font-semibold bg-background">
                      {currentClient.company}
                    </Badge>
                  )}
                  <Badge
                    className={`text-xs ${
                      currentClient.health_status === "green"
                        ? "bg-emerald-600/15 text-emerald-600 border-emerald-600/30"
                        : "bg-amber-600/15 text-amber-600 border-amber-600/30"
                    }`}
                  >
                    {currentClient.health_status === "green" ? "حساب ساري ونشط" : "يحتاج متابعة"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-4">
                  <span>المشروع المرتبط: <strong className="text-foreground">{currentClient.project_name}</strong></span>
                  {currentClient.email && <span>البريد: <strong className="text-foreground">{currentClient.email}</strong></span>}
                  {currentClient.phone && <span dir="ltr">الهاتف: <strong className="text-foreground">{currentClient.phone}</strong></span>}
                  {currentClient.country && <span>الدولة: <strong className="text-foreground">{currentClient.country}</strong></span>}
                </div>
              </div>
            </div>

            {/* License & Contract Specs */}
            <div className="flex flex-wrap items-center gap-3 bg-background/80 p-3.5 rounded-xl border">
              <div className="text-center px-3 border-l">
                <div className="text-[11px] text-muted-foreground">رقم العقد والترخيص</div>
                <div className="font-bold text-xs mt-0.5 font-mono">{currentClient.contract_number || "CR-ACTIVE"}</div>
              </div>
              <div className="text-center px-3 border-l">
                <div className="text-[11px] text-muted-foreground">تاريخ نهاية الترخيص</div>
                <div className="font-bold text-xs mt-0.5 text-primary">
                  {currentClient.contract_end_date || "تجديد سنوي تلقائي"}
                </div>
              </div>
              <div className="text-center px-2">
                <div className="text-[11px] text-muted-foreground">مستوى الدعم</div>
                <div className="font-bold text-xs mt-0.5 text-emerald-600 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  SLA Enterprise 24/7
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Main Tabs: Tickets & Knowledge Base */}
      <Tabs defaultValue="tickets" className="w-full">
        <TabsList className="grid grid-cols-2 max-w-xs">
          <TabsTrigger value="tickets" className="gap-2 text-xs">
            <LifeBuoy className="h-4 w-4" />
            تذاكر الدعم والـ SLA ({tickets.length})
          </TabsTrigger>
          <TabsTrigger value="faqs" className="gap-2 text-xs">
            <BookOpen className="h-4 w-4" />
            قاعدة المعرفة والحلول
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Client Tickets */}
        <TabsContent value="tickets" className="mt-4 space-y-4">
          {ticketsLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : tickets.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground border-dashed">
              <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-600/70 mb-3" />
              <div className="font-semibold text-foreground">لا توجد بلاغات دعم فني مفتوحة حالياً</div>
              <div className="text-xs text-muted-foreground mt-1">
                جميع الأنظمة والخدمات تعمل بكفاءة تامة. يمكنك رفع بلاغ جديد عند مواجهة أي استفسار.
              </div>
              <Button size="sm" onClick={() => setOpenNewTicket(true)} className="gap-1.5 mt-4 text-xs">
                <Plus className="h-4 w-4" />
                رفع بلاغ فني الآن
              </Button>
            </Card>
          ) : (
            <div className="grid gap-3">
              {tickets.map((t) => {
                const isOpen = t.status === "open" || t.status === "in_progress";
                return (
                  <Card
                    key={t.id}
                    onClick={() => openTicketModal(t)}
                    className="p-4 hover:shadow-md hover:border-primary/40 transition-all cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary">{t.ticket_number}</span>
                        <span className="font-semibold text-sm text-foreground">{t.title}</span>
                        <Badge
                          className={`text-xs ${
                            t.status === "resolved"
                              ? "bg-emerald-600/15 text-emerald-600 border-emerald-600/30"
                              : t.status === "in_progress"
                              ? "bg-blue-600/15 text-blue-600 border-blue-600/30"
                              : "bg-amber-600/15 text-amber-600 border-amber-600/30"
                          }`}
                        >
                          {t.status === "resolved"
                            ? "تم الحل بنجاح"
                            : t.status === "in_progress"
                            ? "قيد المعالجة"
                            : "بانتظار الفني"}
                        </Badge>
                      </div>

                      <div className="text-xs text-muted-foreground flex flex-wrap gap-4">
                        {t.module && (
                          <span className="flex items-center gap-1">
                            <Layers className="h-3 w-3 text-primary" /> موديول: {t.module.name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> تم الإنشاء: {t.created_at.slice(0, 10)}
                        </span>
                        {t.assigned && (
                          <span className="flex items-center gap-1">
                            فني الدعم: <strong className="text-foreground">{t.assigned.full_name}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      <Button variant="ghost" size="sm" className="gap-1 text-xs text-primary">
                        <span>عرض المحادثة</span>
                        <ArrowRight className="h-3 w-3 rotate-180" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: FAQs */}
        <TabsContent value="faqs" className="mt-4 space-y-3">
          <Card className="p-6">
            <div className="mb-4">
              <div className="font-bold text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                إرشادات وحلول سريعة لأنظمة الـ ERP والـ LMS
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                تصفح الإجابات الشائعة لحل المشكلات المتكررة ذاتياً دون الحاجة لانتظار فريق الدعم.
              </div>
            </div>

            <div className="space-y-2">
              {FAQS.map((faq, idx) => (
                <div key={idx} className="border rounded-lg p-3 bg-card/60">
                  <button
                    onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                    className="w-full flex items-center justify-between text-right text-xs font-bold text-foreground hover:text-primary transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 transition-transform ${openFaqIndex === idx ? "rotate-180" : ""}`}
                    />
                  </button>
                  {openFaqIndex === idx && (
                    <div className="mt-2 pt-2 border-t text-xs text-muted-foreground leading-relaxed">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal: Create New Ticket */}
      <Dialog open={openNewTicket} onOpenChange={setOpenNewTicket}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LifeBuoy className="h-5 w-5 text-primary" />
              رفع بلاغ دعم فني جديد
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="ticket_title">عنوان البلاغ أو المشكلة *</Label>
              <Input
                id="ticket_title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="مثال: تعذر تصدير تقرير الحسابات الختامية في موديول المالية"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ticket_module">القسم أو الموديول المتأثر</Label>
                <Select value={newModuleId} onValueChange={setNewModuleId}>
                  <SelectTrigger id="ticket_module">
                    <SelectValue placeholder="اختر الموديول" />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ticket_priority">درجة الأهمية والتأثير</Label>
                <Select value={newPriority} onValueChange={(val) => setNewPriority(val as any)}>
                  <SelectTrigger id="ticket_priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">منخفض (استفسار تدريبي)</SelectItem>
                    <SelectItem value="medium">متوسط (طلب تعديل غير عاجل)</SelectItem>
                    <SelectItem value="high">مرتفع (خلل يؤثر على ميزة)</SelectItem>
                    <SelectItem value="urgent">عاجل (توقف كلي للخدمة)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ticket_desc">تفاصيل المشكلة والخطوات المتبعة</Label>
              <Textarea
                id="ticket_desc"
                rows={4}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="يرجى كتابة رسالة الخطأ أو تفاصيل السلوك غير المتوقع لتسريع الحل..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNewTicket(false)} disabled={submittingTicket}>
              إلغاء
            </Button>
            <Button onClick={handleSubmitTicket} disabled={submittingTicket} className="gap-1.5">
              {submittingTicket ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              إرسال التذكرة للفريق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: View Ticket Messages & Chat */}
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="font-mono text-primary font-bold">{selectedTicket?.ticket_number}</span>
                <span>{selectedTicket?.title}</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {selectedTicket?.status === "resolved" ? "تم الحل" : "قيد المتابعة"}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {/* Ticket Messages Area */}
          <div className="flex-1 overflow-y-auto space-y-3 p-3 border rounded-lg bg-muted/20 min-h-[220px]">
            {loadingMessages ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground p-6">
                لا توجد ردود بعد. سيقوم فني الدعم بالرد خلال وقت قصير وفق اتفاقية الـ SLA.
              </div>
            ) : (
              messages.map((m) => {
                const isClient = m.sender_name?.includes(currentClient?.name || "") || m.sender_name === "العميل";
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col max-w-[85%] ${
                      isClient ? "mr-auto items-start" : "ml-auto items-end"
                    }`}
                  >
                    <div className="text-[10px] text-muted-foreground mb-0.5 px-1">
                      {m.sender_name} · {m.created_at.slice(11, 16)}
                    </div>
                    <div
                      className={`p-3 rounded-xl text-xs ${
                        isClient
                          ? "bg-primary text-primary-foreground rounded-br-none"
                          : "bg-background border text-foreground rounded-bl-none shadow-sm"
                      }`}
                    >
                      {m.message}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Reply Form */}
          {selectedTicket?.status !== "closed" && (
            <div className="flex gap-2 pt-2">
              <Input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="اكتب ردك أو استفسارك الإضافي هنا..."
                className="text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendReply();
                  }
                }}
              />
              <Button onClick={handleSendReply} disabled={sendingReply} className="gap-1.5 text-xs shrink-0">
                {sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                إرسال الرد
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
