import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Receipt,
  FileText,
  DollarSign,
  CreditCard,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  Printer,
  RefreshCw,
  Building2,
  FolderKanban,
  Check,
  Calendar,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { exportToExcel } from "@/lib/export-utils";
import { printOfficialReport } from "@/lib/executive-report.utils";
import {
  listContractsAndInvoices,
  createProjectContract,
  createContractInvoice,
  recordInvoicePayment,
  type ProjectContractRecord,
  type ContractInvoiceRecord,
} from "@/lib/billing.functions";

export const Route = createFileRoute("/_app/billing")({
  component: BillingAndContractsPage,
});

function formatMoney(amount: number, curr = "SAR"): string {
  return `${Number(amount || 0).toLocaleString("ar-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${curr}`;
}

function BillingAndContractsPage() {
  const { profile } = useAuth();

  const [contracts, setContracts] = useState<ProjectContractRecord[]>([]);
  const [invoices, setInvoices] = useState<ContractInvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Projects & Clients dropdowns
  const [projectsList, setProjectsList] = useState<Array<{ id: string; name: string }>>([]);
  const [clientsList, setClientsList] = useState<Array<{ id: string; name: string; project_id?: string }>>([]);

  // New Contract Dialog State
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [newContractTitle, setNewContractTitle] = useState("");
  const [newContractProjectId, setNewContractProjectId] = useState("");
  const [newContractClientId, setNewContractClientId] = useState("");
  const [newContractAmount, setNewContractAmount] = useState<string>("");
  const [newContractTerms, setNewContractTerms] = useState("");
  const [creatingContract, setCreatingContract] = useState(false);

  // New Invoice Dialog State
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [selectedContractForInvoice, setSelectedContractForInvoice] = useState("");
  const [newInvoiceMilestone, setNewInvoiceMilestone] = useState("");
  const [newInvoiceAmount, setNewInvoiceAmount] = useState<string>("");
  const [newInvoiceDueDate, setNewInvoiceDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [newInvoiceNotes, setNewInvoiceNotes] = useState("");
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  // Mark Payment Dialog State
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [invoiceToPay, setInvoiceToPay] = useState<ContractInvoiceRecord | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("تحويل بنكي");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Load Dropdowns
  useEffect(() => {
    async function loadAux() {
      try {
        const [{ data: p }, { data: c }] = await Promise.all([
          supabase.from("projects").select("id, name").order("name"),
          supabase.from("clients").select("id, name, project_id").order("name"),
        ]);
        setProjectsList(p || []);
        setClientsList(c || []);
      } catch {
        // Fallback
      }
    }
    void loadAux();
  }, []);

  // Load Contracts & Invoices
  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listContractsAndInvoices({
        data: {
          projectId: projectFilter !== "all" ? projectFilter : undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          search: search.trim() || undefined,
        },
      });

      if (res.ok) {
        setContracts(res.contracts || []);
        setInvoices(res.invoices || []);
      } else {
        toast.error(res.error || "تعذّر تحميل البيانات المالية");
      }
    } catch {
      toast.error("حدث خطأ أثناء تحميل العقود والفواتير");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [projectFilter, statusFilter, search]);

  // Realtime live sync for contracts & invoices
  useEffect(() => {
    const channel = supabase
      .channel("crm-x-billing-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contract_invoices" },
        () => void loadData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_contracts" },
        () => void loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalContractValue = contracts.reduce((sum, c) => sum + Number(c.total_amount || 0), 0);
    const totalCollected = invoices
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + Number(i.total_with_tax || 0), 0);
    const totalPending = invoices
      .filter((i) => i.status === "pending")
      .reduce((sum, i) => sum + Number(i.total_with_tax || 0), 0);
    const totalOverdue = invoices
      .filter((i) => i.status === "overdue")
      .reduce((sum, i) => sum + Number(i.total_with_tax || 0), 0);

    const collectionRate = totalContractValue > 0
      ? Math.min(100, Math.round((totalCollected / totalContractValue) * 100))
      : 0;

    return {
      totalContractValue,
      totalCollected,
      totalPending,
      totalOverdue,
      collectionRate,
      paidCount: invoices.filter((i) => i.status === "paid").length,
      overdueCount: invoices.filter((i) => i.status === "overdue").length,
    };
  }, [contracts, invoices]);

  // Handle Create Contract
  const handleCreateContract = async () => {
    if (!newContractTitle.trim() || !newContractProjectId || !newContractAmount) {
      toast.error("يرجى إكمال عنوان العقد، المشروع، والقيمة الإجمالية");
      return;
    }

    setCreatingContract(true);
    try {
      const res = (await createProjectContract({
        data: {
          title: newContractTitle.trim(),
          projectId: newContractProjectId,
          clientId: newContractClientId || null,
          totalAmount: parseFloat(newContractAmount),
          terms: newContractTerms.trim() || null,
        },
      })) as any;

      if (res.ok) {
        toast.success("تم إنشاء العقد بنجاح");
        setContractDialogOpen(false);
        setNewContractTitle("");
        setNewContractAmount("");
        setNewContractTerms("");
        void loadData();
      } else {
        toast.error(res.error || "تعذّر حفظ العقد");
      }
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ غير متوقع");
    } finally {
      setCreatingContract(false);
    }
  };

  // Handle Create Invoice
  const handleCreateInvoice = async () => {
    if (!selectedContractForInvoice || !newInvoiceMilestone.trim() || !newInvoiceAmount || !newInvoiceDueDate) {
      toast.error("يرجى تحديد العقد ومسمى الدفعة والقيمة وتاريخ الاستحقاق");
      return;
    }

    setCreatingInvoice(true);
    try {
      const res = (await createContractInvoice({
        data: {
          contractId: selectedContractForInvoice,
          milestoneTitle: newInvoiceMilestone.trim(),
          amount: parseFloat(newInvoiceAmount),
          dueDate: newInvoiceDueDate,
          notes: newInvoiceNotes.trim() || null,
        },
      })) as any;

      if (res.ok) {
        toast.success("تم تسجيل الفاتورة بنجاح");
        setInvoiceDialogOpen(false);
        setNewInvoiceMilestone("");
        setNewInvoiceAmount("");
        setNewInvoiceNotes("");
        void loadData();
      } else {
        toast.error(res.error || "تعذّر تسجيل الفاتورة");
      }
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ");
    } finally {
      setCreatingInvoice(false);
    }
  };

  // Handle Record Payment
  const handleRecordPayment = async () => {
    if (!invoiceToPay) return;
    setSubmittingPayment(true);
    try {
      const res = (await recordInvoicePayment({
        data: {
          invoiceId: invoiceToPay.id,
          paymentMethod,
          notes: paymentNotes.trim() || null,
        },
      })) as any;

      if (res.ok) {
        toast.success(`تم تأكيد سداد الفاتورة #${invoiceToPay.invoice_number}`);
        setPaymentDialogOpen(false);
        setInvoiceToPay(null);
        setPaymentNotes("");
        void loadData();
      } else {
        toast.error(res.error || "تعذّر تأكيد السداد");
      }
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ أثناء السداد");
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Print Tax Invoice PDF (ZATCA style compliant)
  const handlePrintTaxInvoice = (inv: ContractInvoiceRecord) => {
    printOfficialReport({
      title: `فاتورة ضريبية رسمية (Tax Invoice #${inv.invoice_number})`,
      subtitle: `مطالبة مالية لمشروع ${inv.project?.name || "المنظومة"} — ${inv.client?.name || "العميل"}`,
      reportCode: inv.invoice_number,
      metadata: [
        { label: "رقم الفاتورة الضريبية", value: inv.invoice_number },
        { label: "الرقم المرجعي للعقد", value: inv.contract?.contract_number || "CNT-GENERAL" },
        { label: "تاريخ الإصدار والاستحقاق", value: inv.due_date },
        { label: "العميل المستفيد", value: `${inv.client?.name || "—"} (${inv.client?.company || "مؤسسة"})` },
        { label: "المشروع المعتمد", value: inv.project?.name || "عام" },
        { label: "حالة السداد", value: inv.status === "paid" ? `مدفوعة بالكامل (${inv.payment_method || "بنكي"})` : inv.status === "overdue" ? "متأخرة السداد" : "مستحقة" },
      ],
      kpis: [
        { label: "المبلغ الأساسي", value: `${formatMoney(inv.amount, inv.currency)}`, color: "#0d9488" },
        { label: "ضريبة القيمة المضافة (15%)", value: `${formatMoney(inv.tax_amount, inv.currency)}`, color: "#64748b" },
        { label: "الإجمالي شامل الضريبة", value: `${formatMoney(inv.total_with_tax, inv.currency)}`, color: "#16a34a" },
      ],
      sections: [
        {
          title: "تفاصيل بنود الدفعة والمرحلة التعاقدية",
          headers: ["البند والمرحلة", "تاريخ الاستحقاق", "القيمة الخاضعة للضريبة", "مبلغ الضريبة (15%)", "الإجمالي"],
          rows: [
            [
              inv.milestone_title,
              inv.due_date,
              formatMoney(inv.amount, inv.currency),
              formatMoney(inv.tax_amount, inv.currency),
              formatMoney(inv.total_with_tax, inv.currency),
            ],
          ],
        },
      ],
      approvalStamp: {
        statusText: inv.status === "paid" ? "تم سداد الفاتورة واعتمادها في الحساب البنكي" : "فاتورة ضريبية مستحقة للسداد",
        isApproved: inv.status === "paid",
        reviewerName: profile?.full_name || "المدير المالي والمحاسبي",
        reviewedAt: inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("ar-SA") : new Date().toLocaleDateString("ar-SA"),
        notes: inv.notes || "فاتورة إلكترونية معتمدة صادرة من منظومة CRM-X Enterprise.",
      },
    });
  };

  // Export Invoices to Excel
  const handleExportInvoicesExcel = () => {
    if (invoices.length === 0) {
      toast.info("لا توجد فواتير لتصديرها");
      return;
    }

    const exportRows = invoices.map((inv) => ({
      "رقم الفاتورة": inv.invoice_number,
      "رقم العقد": inv.contract?.contract_number || "—",
      "المشروع": inv.project?.name || "—",
      "العميل": inv.client?.name || "—",
      "المرحلة / الدفعة": inv.milestone_title,
      "المبلغ قبل الضريبة": inv.amount,
      "الضريبة (15%)": inv.tax_amount,
      "الإجمالي": inv.total_with_tax,
      "العملة": inv.currency,
      "الحالة": inv.status,
      "تاريخ الاستحقاق": inv.due_date,
      "تاريخ السداد": inv.paid_at ? inv.paid_at.slice(0, 10) : "—",
      "طريقة السداد": inv.payment_method || "—",
    }));

    exportToExcel(exportRows, `CRM-X-Invoices-${format(new Date(), "yyyy-MM-dd")}`);
    toast.success("تم تصدير ملف الإكسل بنجاح");
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header */}
      <PageHeader
        title="إدارة العقود والفواتير والمستحقات (Contracts & Invoicing Hub)"
        description="متابعة دفعات ومراحل عقود مشاريع ERP و LMS، إصدار الفواتير الضريبية، ومراقبة نسب التحصيل المالي."
        icon={Receipt}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportInvoicesExcel}
              disabled={invoices.length === 0}
              className="gap-1.5 text-xs h-8 shadow-2xs"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              تصدير الفواتير (Excel)
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="gap-1 text-xs h-8"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              تحديث
            </Button>

            {/* Dialog: New Contract */}
            <Dialog open={contractDialogOpen} onOpenChange={setContractDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 border-primary/30 text-primary">
                  <FileText className="h-3.5 w-3.5" />
                  عقد جديد
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg" dir="rtl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-primary" />
                    تسجيل عقد مشروع جديد
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-3 py-2 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold">عنوان العقد أو الاتفاقية *</label>
                    <Input
                      value={newContractTitle}
                      onChange={(e) => setNewContractTitle(e.target.value)}
                      placeholder="مثال: عقد ترخيص وتطبيق منظومة C-SMARX ERP"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="font-semibold">المشروع المرتبط *</label>
                      <Select value={newContractProjectId} onValueChange={setNewContractProjectId}>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر المشروع" />
                        </SelectTrigger>
                        <SelectContent>
                          {projectsList.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold">العميل المستفيد</label>
                      <Select value={newContractClientId} onValueChange={setNewContractClientId}>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر العميل" />
                        </SelectTrigger>
                        <SelectContent>
                          {clientsList.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold">القيمة الإجمالية للعقد (ر.س) *</label>
                    <Input
                      type="number"
                      value={newContractAmount}
                      onChange={(e) => setNewContractAmount(e.target.value)}
                      placeholder="350000"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold">الشروط والأحكام ومجال العمل</label>
                    <Textarea
                      rows={3}
                      value={newContractTerms}
                      onChange={(e) => setNewContractTerms(e.target.value)}
                      placeholder="بنود الدفعات ومسؤوليات الصيانة والدعم الفني..."
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setContractDialogOpen(false)} disabled={creatingContract}>
                    إلغاء
                  </Button>
                  <Button onClick={handleCreateContract} disabled={creatingContract} className="gap-1.5">
                    {creatingContract ? "جاري الحفظ..." : "حفظ العقد"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Dialog: New Invoice */}
            <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 text-xs h-8 bg-primary text-primary-foreground">
                  <Plus className="h-3.5 w-3.5" />
                  إصدار فاتورة مرحلية
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg" dir="rtl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-sm">
                    <Receipt className="h-4 w-4 text-primary" />
                    إصدار فاتورة دفعة تعاقدية جديدة
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-3 py-2 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold">العقد المستحق عليه *</label>
                    <Select value={selectedContractForInvoice} onValueChange={setSelectedContractForInvoice}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر العقد" />
                      </SelectTrigger>
                      <SelectContent>
                        {contracts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.contract_number} — {c.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold">مسمى الدفعة / المرحلة *</label>
                    <Input
                      value={newInvoiceMilestone}
                      onChange={(e) => setNewInvoiceMilestone(e.target.value)}
                      placeholder="مثال: الدفعة الثانية - اعتماد اختبارات UAT والتكامل"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="font-semibold">المبلغ قبل الضريبة (ر.س) *</label>
                      <Input
                        type="number"
                        value={newInvoiceAmount}
                        onChange={(e) => setNewInvoiceAmount(e.target.value)}
                        placeholder="100000"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold">تاريخ الاستحقاق *</label>
                      <Input
                        type="date"
                        value={newInvoiceDueDate}
                        onChange={(e) => setNewInvoiceDueDate(e.target.value)}
                      />
                    </div>
                  </div>

                  {newInvoiceAmount && !isNaN(parseFloat(newInvoiceAmount)) && (
                    <div className="p-2.5 rounded-lg bg-muted/40 border space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span>المبلغ الخاضع للضريبة:</span>
                        <span className="font-mono">{formatMoney(parseFloat(newInvoiceAmount))}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>ضريبة القيمة المضافة (15%):</span>
                        <span className="font-mono">{formatMoney(parseFloat(newInvoiceAmount) * 0.15)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-foreground border-t pt-1">
                        <span>الإجمالي المطلوب سداده:</span>
                        <span className="font-mono text-emerald-600">{formatMoney(parseFloat(newInvoiceAmount) * 1.15)}</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="font-semibold">ملاحظات الفاتورة</label>
                    <Textarea
                      rows={2}
                      value={newInvoiceNotes}
                      onChange={(e) => setNewInvoiceNotes(e.target.value)}
                      placeholder="تعليمات التحويل أو متطلبات الاعتماد الفني..."
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setInvoiceDialogOpen(false)} disabled={creatingInvoice}>
                    إلغاء
                  </Button>
                  <Button onClick={handleCreateInvoice} disabled={creatingInvoice} className="gap-1.5">
                    {creatingInvoice ? "جاري الإصدار..." : "إصدار الفاتورة"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="p-4 bg-gradient-to-br from-teal-500/10 via-card to-card border-teal-500/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">إجمالي قيمة العقود النشطة</span>
            <div className="h-7 w-7 rounded-lg bg-teal-500/15 flex items-center justify-center">
              <FileText className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            </div>
          </div>
          <div className="text-xl font-bold text-foreground mt-2 font-mono">
            {formatMoney(metrics.totalContractValue)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {contracts.length} عقود معتمدة
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-emerald-500/10 via-card to-card border-emerald-500/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">المحصّل فعلياً في الحساب</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
            {formatMoney(metrics.totalCollected)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
            <span>نسبة التحصيل:</span>
            <span className="font-bold text-emerald-600">{metrics.collectionRate}%</span>
            <span>({metrics.paidCount} دفعات)</span>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-blue-500/10 via-card to-card border-blue-500/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">المطالبات المستحقة القادمة</span>
            <div className="h-7 w-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="text-xl font-bold text-foreground mt-2 font-mono">
            {formatMoney(metrics.totalPending)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            مستحقة وفق مراحل الإنجاز التعاقدية
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-rose-500/10 via-card to-card border-rose-500/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">فواتير متأخرة السداد</span>
            <div className="h-7 w-7 rounded-lg bg-rose-500/15 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            </div>
          </div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-2 font-mono">
            {formatMoney(metrics.totalOverdue)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {metrics.overdueCount > 0 ? `${metrics.overdueCount} فواتير تجاوزت موعد الاستحقاق` : "لا توجد متأخرات"}
          </div>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="invoices" className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3">
          <TabsList>
            <TabsTrigger value="invoices" className="gap-2 text-xs">
              <Receipt className="h-3.5 w-3.5" />
              <span>الفواتير والمطالبات ({invoices.length})</span>
            </TabsTrigger>
            <TabsTrigger value="contracts" className="gap-2 text-xs">
              <FileText className="h-3.5 w-3.5" />
              <span>العقود والمراحل ({contracts.length})</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
            <div className="relative flex-1 sm:w-60">
              <Search className="absolute start-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="بحث برقم الفاتورة أو العميل..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-8 h-8 text-xs"
              />
            </div>

            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue placeholder="المشروع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كافة المشاريع</SelectItem>
                {projectsList.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tab 1: Invoices */}
        <TabsContent value="invoices" className="space-y-3">
          <Card className="overflow-hidden">
            {invoices.length === 0 ? (
              <div className="text-center py-12 text-xs text-muted-foreground">
                لا توجد فواتير مسجلة مطابقة لخيارات البحث
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="border-b bg-muted/40 text-muted-foreground">
                      <th className="py-2.5 px-3 text-start font-semibold">رقم الفاتورة</th>
                      <th className="py-2.5 px-3 text-start font-semibold">الدفعة / المرحلة</th>
                      <th className="py-2.5 px-3 text-start font-semibold">العميل والمشروع</th>
                      <th className="py-2.5 px-3 text-start font-semibold">المبلغ الخاضع</th>
                      <th className="py-2.5 px-3 text-start font-semibold">الضريبة (15%)</th>
                      <th className="py-2.5 px-3 text-start font-semibold">الإجمالي</th>
                      <th className="py-2.5 px-3 text-start font-semibold">الاستحقاق</th>
                      <th className="py-2.5 px-3 text-start font-semibold">الحالة</th>
                      <th className="py-2.5 px-3 text-start font-semibold">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-primary">
                          {inv.invoice_number}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-foreground max-w-[200px] truncate" title={inv.milestone_title}>
                            {inv.milestone_title}
                          </div>
                          {inv.contract && (
                            <div className="text-[10px] text-muted-foreground">
                              {inv.contract.contract_number}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-foreground">{inv.client?.name || "عام"}</div>
                          <div className="text-[10px] text-muted-foreground">{inv.project?.name || "عام"}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono">{formatMoney(inv.amount, inv.currency)}</td>
                        <td className="py-2.5 px-3 font-mono text-muted-foreground">{formatMoney(inv.tax_amount, inv.currency)}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                          {formatMoney(inv.total_with_tax, inv.currency)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-muted-foreground">
                          {inv.due_date}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant="outline"
                            className={
                              inv.status === "paid"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                : inv.status === "overdue"
                                ? "bg-rose-500/10 text-rose-600 border-rose-500/30"
                                : "bg-blue-500/10 text-blue-600 border-blue-500/30"
                            }
                          >
                            {inv.status === "paid"
                              ? "مدفوعة ✅"
                              : inv.status === "overdue"
                              ? "متأخرة ⚠️"
                              : "مستحقة"}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePrintTaxInvoice(inv)}
                              className="h-7 text-[11px] gap-1 px-2"
                              title="طباعة الفاتورة الضريبية الرسمية"
                            >
                              <Printer className="h-3 w-3 text-primary" />
                              <span>فاتورة</span>
                            </Button>

                            {inv.status !== "paid" && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setInvoiceToPay(inv);
                                  setPaymentDialogOpen(true);
                                }}
                                className="h-7 text-[11px] gap-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <Check className="h-3 w-3" />
                                <span>سداد</span>
                              </Button>
                            )}
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

        {/* Tab 2: Contracts */}
        <TabsContent value="contracts" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contracts.map((c) => (
              <Card key={c.id} className="p-4 space-y-3 hover:shadow-xs transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary">{c.contract_number}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {c.status === "active" ? "نشط" : c.status}
                      </Badge>
                    </div>
                    <h3 className="font-bold text-sm text-foreground mt-1">{c.title}</h3>
                  </div>
                  <div className="text-end">
                    <div className="text-base font-bold text-foreground font-mono">
                      {formatMoney(c.total_amount, c.currency)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">القيمة الإجمالية</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-muted/20 p-2.5 rounded-lg">
                  <div>
                    <span className="font-medium text-foreground">العميل: </span>
                    {c.client?.name || "غير محدد"}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">المشروع: </span>
                    {c.project?.name || "عام"}
                  </div>
                </div>

                {/* Collection Progress */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">نسبة التحصيل الفعلي:</span>
                    <span className="font-bold text-emerald-600">
                      {c.collection_rate || 0}% ({formatMoney(c.paid_amount || 0, c.currency)})
                    </span>
                  </div>
                  <Progress value={c.collection_rate || 0} className="h-2" />
                </div>

                {c.terms && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {c.terms}
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t text-xs">
                  <span className="text-muted-foreground">
                    الفواتير المسجلة: <strong className="text-foreground">{c.invoices_count || 0}</strong>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedContractForInvoice(c.id);
                      setInvoiceDialogOpen(true);
                    }}
                    className="h-7 text-xs gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    إصدار دفعة جديدة
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog: Record Payment */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              تأكيد سداد الفاتورة #{invoiceToPay?.invoice_number}
            </DialogTitle>
          </DialogHeader>

          {invoiceToPay && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <div className="text-muted-foreground">المبلغ المستحق سداده:</div>
                <div className="text-xl font-bold font-mono text-emerald-600">
                  {formatMoney(invoiceToPay.total_with_tax, invoiceToPay.currency)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  شامل ضريبة القيمة المضافة 15%
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold">طريقة السداد والتحويل *</label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="تحويل بنكي مصرف الراجحي">تحويل بنكي - مصرف الراجحي</SelectItem>
                    <SelectItem value="تحويل بنكي البنك الأهلي">تحويل بنكي - البنك الأهلي السعودي</SelectItem>
                    <SelectItem value="سداد إلكتروني (بطاقة شركات)">سداد إلكتروني (بطاقة الشركات / مدى)</SelectItem>
                    <SelectItem value="شيك مصرفي معتمد">شيك مصرفي معتمد</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold">ملاحظات ورقم إشعار التحويل</label>
                <Input
                  value={paymentNotes}
                  onChange={(e) => setNewInvoiceNotes(e.target.value)}
                  placeholder="مثال: رقم الحوالة TRN-99812738"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)} disabled={submittingPayment}>
              إلغاء
            </Button>
            <Button
              onClick={handleRecordPayment}
              disabled={submittingPayment}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submittingPayment ? "جاري الاعتماد..." : "تأكيد السداد في الحساب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
