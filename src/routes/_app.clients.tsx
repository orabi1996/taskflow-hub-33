import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Building2,
  Search,
  Plus,
  Mail,
  Phone,
  MapPin,
  FileSignature,
  FileSpreadsheet,
  Printer,
  Loader2,
  FolderKanban,
  LifeBuoy,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { printOfficialReport } from "@/lib/executive-report.utils";

export const Route = createFileRoute("/_app/clients")({
  component: EnterpriseClientsPage,
});

type HealthStatus = "green" | "yellow" | "red";

interface Client {
  id: string;
  project_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  country: string | null;
  address: string | null;
  contract_number: string | null;
  contract_value: number | null;
  currency: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  health_status: HealthStatus;
  created_at: string;
  project_name?: string;
  open_tickets_count?: number;
}

interface ProjectOption {
  id: string;
  name: string;
}

const HEALTH_CONFIG: Record<HealthStatus, { label: string; badge: string; dot: string }> = {
  green: {
    label: "ممتاز / مستقر",
    badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  yellow: {
    label: "يحتاج متابعة",
    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    dot: "bg-amber-500",
  },
  red: {
    label: "حرج / مهدد",
    badge: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
    dot: "bg-red-500",
  },
};

function EnterpriseClientsPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const isManager = roles.includes("manager");
  const canManage = isAdmin || isManager;

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState("all");

  // Create Client Dialog
  const [openNew, setOpenNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newCountry, setNewCountry] = useState("المملكة العربية السعودية");
  const [newAddress, setNewAddress] = useState("");
  const [newProjectId, setNewProjectId] = useState("");
  const [newContractNumber, setNewContractNumber] = useState("");
  const [newContractValue, setNewContractValue] = useState("");
  const [newCurrency, setNewCurrency] = useState("SAR");
  const [newContractStart, setNewContractStart] = useState("");
  const [newContractEnd, setNewContractEnd] = useState("");
  const [newHealth, setNewHealth] = useState<HealthStatus>("green");

  const loadData = async () => {
    setLoading(true);
    try {
      const [clsRes, projsRes, ticketsRes] = await Promise.all([
        supabase.from("clients").select("*").order("created_at", { ascending: false }),
        supabase.from("projects").select("id, name").order("name"),
        supabase.from("support_tickets").select("id, client_id, status").in("status", ["open", "in_progress"]),
      ]);

      const projsMap = new Map((projsRes.data ?? []).map((p) => [p.id, p.name]));
      const ticketsCountMap = new Map<string, number>();

      (ticketsRes.data ?? []).forEach((t) => {
        if (t.client_id) {
          ticketsCountMap.set(t.client_id, (ticketsCountMap.get(t.client_id) ?? 0) + 1);
        }
      });

      const enriched: Client[] = (clsRes.data ?? []).map((c: any) => ({
        ...c,
        health_status: (c.health_status as HealthStatus) || "green",
        project_name: projsMap.get(c.project_id) || "مشروع عام",
        open_tickets_count: ticketsCountMap.get(c.id) ?? 0,
      }));

      setClients(enriched);
      setProjects((projsRes.data ?? []) as ProjectOption[]);
      if (projsRes.data && projsRes.data.length > 0 && !newProjectId) {
        setNewProjectId(projsRes.data[0].id);
      }
    } catch (err: any) {
      toast.error("فشل تحميل قائمة العملاء: " + (err?.message || "خطأ غير متوقع"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Distinct Countries
  const distinctCountries = useMemo(() => {
    const s = new Set<string>();
    clients.forEach((c) => {
      if (c.country) s.add(c.country);
    });
    return Array.from(s);
  }, [clients]);

  // Filtered List
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const q = search.trim().toLowerCase();
      if (q) {
        const matchName = c.name?.toLowerCase().includes(q);
        const matchCompany = c.company?.toLowerCase().includes(q);
        const matchEmail = c.email?.toLowerCase().includes(q);
        const matchPhone = c.phone?.toLowerCase().includes(q);
        const matchContract = c.contract_number?.toLowerCase().includes(q);
        if (!matchName && !matchCompany && !matchEmail && !matchPhone && !matchContract) return false;
      }
      if (projectFilter !== "all" && c.project_id !== projectFilter) return false;
      if (healthFilter !== "all" && c.health_status !== healthFilter) return false;
      if (countryFilter !== "all" && c.country !== countryFilter) return false;
      return true;
    });
  }, [clients, search, projectFilter, healthFilter, countryFilter]);

  // KPIs
  const stats = useMemo(() => {
    const total = clients.length;
    const greenCount = clients.filter((c) => c.health_status === "green").length;
    const atRiskCount = clients.filter((c) => c.health_status === "yellow" || c.health_status === "red").length;
    const totalValue = clients.reduce((acc, c) => acc + (Number(c.contract_value) || 0), 0);
    const openTicketsTotal = clients.reduce((acc, c) => acc + (c.open_tickets_count || 0), 0);

    return { total, greenCount, atRiskCount, totalValue, openTicketsTotal };
  }, [clients]);

  const handleCreateClient = async () => {
    if (!newName.trim() || !newProjectId) {
      toast.error("يرجى إدخال اسم العميل وتحديد المشروع التابع له");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: newName.trim(),
        company: newCompany.trim() || null,
        email: newEmail.trim() || null,
        phone: newPhone.trim() || null,
        country: newCountry.trim() || null,
        address: newAddress.trim() || null,
        project_id: newProjectId,
        contract_number: newContractNumber.trim() || null,
        contract_value: newContractValue ? Number(newContractValue) : null,
        currency: newCurrency || "SAR",
        contract_start_date: newContractStart || null,
        contract_end_date: newContractEnd || null,
        health_status: newHealth,
      };

      const { error } = await supabase.from("clients").insert(payload);
      if (error) throw error;

      toast.success("تمت إضافة العميل بنجاح");
      setOpenNew(false);
      // Reset form
      setNewName("");
      setNewCompany("");
      setNewEmail("");
      setNewPhone("");
      setNewAddress("");
      setNewContractNumber("");
      setNewContractValue("");
      setNewContractStart("");
      setNewContractEnd("");
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "فشل حفظ بيانات العميل");
    } finally {
      setSaving(false);
    }
  };

  const exportExcel = () => {
    if (filteredClients.length === 0) {
      toast.info("لا توجد بيانات عملاء لتصديرها");
      return;
    }
    const rows = filteredClients.map((c) => ({
      "اسم العميل": c.name,
      "المؤسسة / الشركة": c.company || "غير محدد",
      "المشروع المرتبط": c.project_name || "",
      "البريد الإلكتروني": c.email || "",
      "رقم الهاتف": c.phone || "",
      "الدولة": c.country || "",
      "حالة العميل (Health)": HEALTH_CONFIG[c.health_status]?.label || c.health_status,
      "رقم العقد": c.contract_number || "بدون",
      "قيمة العقد": c.contract_value ? `${c.contract_value.toLocaleString()} ${c.currency || "SAR"}` : "0",
      "بداية العقد": c.contract_start_date || "-",
      "نهاية العقد": c.contract_end_date || "-",
      "التذاكر المفتوحة": c.open_tickets_count || 0,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "العملاء والشركاء");
    XLSX.writeFile(wb, `CRM-X-Enterprise-Clients-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("تم تصدير ملف الإكسل بنجاح");
  };

  const handlePrintReport = () => {
    printOfficialReport({
      title: "دليل العملاء والشركاء المؤسسي (Enterprise Clients Directory)",
      subtitle: "كشف تحليلي شامل لحسابات العملاء، وحالة العقود، ومؤشرات السلامة وتذاكر الـ SLA",
      kpis: [
        { label: "إجمالي العملاء", value: stats.total, subtext: "عميل مسجل في المنظومة", color: "#0F4C5C" },
        { label: "حسابات مستقرة (Green)", value: stats.greenCount, subtext: "علاقة تعاقدية ممتازة", color: "#059669" },
        { label: "حسابات تحتاج متابعة (At-Risk)", value: stats.atRiskCount, subtext: "تتطلب اهتمام فوري", color: "#d97706" },
        {
          label: "إجمالي القيمة التعاقدية",
          value: `${stats.totalValue.toLocaleString()} SAR`,
          subtext: "عقود سارية ونشطة",
          color: "#00A6A6",
        },
      ],
      sections: [
        {
          title: "بيانات العملاء والعقود السارية",
          headers: ["اسم العميل", "الشركة / المؤسسة", "المشروع", "رقم العقد", "قيمة العقد", "الحالة الصحية", "تذاكر الدعم"],
          rows: filteredClients.map((c) => [
            c.name,
            c.company || "—",
            c.project_name || "عام",
            c.contract_number || "—",
            c.contract_value ? `${c.contract_value.toLocaleString()} ${c.currency || "SAR"}` : "—",
            HEALTH_CONFIG[c.health_status]?.label || c.health_status,
            c.open_tickets_count ? `${c.open_tickets_count} تذكرة مفتوحة` : "لا توجد بلاغات",
          ]),
        },
      ],
      approvalStamp: {
        statusText: "معتمد من إدارة علاقات العملاء (CRM-X)",
        isApproved: true,
        reviewerName: "إدارة الحسابات الاستراتيجية",
        reviewedAt: new Date().toISOString(),
        notes: "تم استخراج التقرير آلياً وفق أحدث بيانات قاعدة العملاء والعقود النشطة.",
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="دليل العملاء والشركاء (Clients & Partners)"
          description="إدارة حسابات عملاء أنظمة الـ ERP والمنصات التعليمية، العقود، ومؤشرات سلامة الحسابات"
          icon={Building2}
        />
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={exportExcel} className="gap-1.5 text-xs">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            تصدير Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrintReport} className="gap-1.5 text-xs">
            <Printer className="h-4 w-4 text-primary" />
            طباعة تقرير معتمد
          </Button>
          {canManage && (
            <Button size="sm" onClick={() => setOpenNew(true)} className="gap-1.5 text-xs">
              <Plus className="h-4 w-4" />
              إضافة عميل جديد
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card className="p-4 bg-gradient-to-br from-primary/5 via-card to-card border-primary/20">
          <div className="text-xs text-muted-foreground">إجمالي العملاء والشركاء</div>
          <div className="text-2xl font-bold mt-1 text-primary">{stats.total}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">عبر جميع مشاريع المنظومة</div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-emerald-500/5 via-card to-card border-emerald-500/20">
          <div className="text-xs text-muted-foreground">حسابات مستقرة (Green)</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600">{stats.greenCount}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">رضا وتجديد مضمون</div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-amber-500/5 via-card to-card border-amber-500/20">
          <div className="text-xs text-muted-foreground">حسابات تحت الملاحظة (At-Risk)</div>
          <div className="text-2xl font-bold mt-1 text-amber-600">{stats.atRiskCount}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">تتطلب تدخلاً استباقياً</div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-[#00A6A6]/5 via-card to-card border-[#00A6A6]/20">
          <div className="text-xs text-muted-foreground">القيمة التعاقدية الإجمالية</div>
          <div className="text-xl font-bold mt-1 text-[#00A6A6]">
            {stats.totalValue.toLocaleString()} <span className="text-xs font-normal">SAR</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {stats.openTicketsTotal > 0 ? `${stats.openTicketsTotal} تذكرة دعم مفتوحة` : "لا توجد بلاغات حرجة"}
          </div>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative">
            <Search className="h-4 w-4 absolute right-3 top-3 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم، المؤسسة، البريد، أو العقد..."
              className="pr-9 text-xs"
            />
          </div>

          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="المشروع التابع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المشاريع</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={healthFilter} onValueChange={setHealthFilter}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="حالة العميل (Health)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات الصحية</SelectItem>
              <SelectItem value="green">ممتاز / مستقر (Green)</SelectItem>
              <SelectItem value="yellow">يحتاج متابعة (Yellow)</SelectItem>
              <SelectItem value="red">حرج / مهدد (Red)</SelectItem>
            </SelectContent>
          </Select>

          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="الدولة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الدول</SelectItem>
              {distinctCountries.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Clients Grid / Table */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredClients.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground border-dashed">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <div className="font-semibold">لا يوجد عملاء مطابقين لخيارات البحث الحالية</div>
          <div className="text-xs mt-1">جرّب مسح الفلاتر أو أضف عميلاً جديداً بالضغط على زر الإضافة أعلاه.</div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => {
            const hConfig = HEALTH_CONFIG[client.health_status] || HEALTH_CONFIG.green;
            return (
              <Card
                key={client.id}
                className="p-5 flex flex-col justify-between hover:shadow-md hover:border-primary/40 transition-all group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-base group-hover:text-primary transition-colors flex items-center gap-1.5">
                        <span className={`h-2.5 w-2.5 rounded-full ${hConfig.dot}`} />
                        {client.name}
                      </div>
                      <div className="text-xs text-muted-foreground font-medium mt-0.5">
                        {client.company || "عميل فردي / مباشر"}
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-xs ${hConfig.badge}`}>
                      {hConfig.label}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground pt-1 border-t">
                    <div className="flex items-center gap-1.5 text-foreground/80 font-medium">
                      <FolderKanban className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>{client.project_name}</span>
                    </div>

                    {client.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{client.email}</span>
                      </div>
                    )}

                    {client.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span dir="ltr">{client.phone}</span>
                      </div>
                    )}

                    {client.country && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>{client.country}</span>
                      </div>
                    )}
                  </div>

                  {/* Contract Badge Info */}
                  <div className="p-2.5 rounded-lg bg-muted/40 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <FileSignature className="h-3 w-3 text-primary" /> العقد:
                      </span>
                      <span className="font-semibold text-foreground">
                        {client.contract_number || "غير مدخل"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">القيمة:</span>
                      <span className="font-bold text-primary">
                        {client.contract_value ? `${client.contract_value.toLocaleString()} ${client.currency || "SAR"}` : "—"}
                      </span>
                    </div>
                    {client.contract_end_date && (
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>ينتهي في:</span>
                        <span>{client.contract_end_date}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t text-xs">
                  {client.open_tickets_count ? (
                    <Badge variant="destructive" className="gap-1 text-[11px] py-0.5">
                      <LifeBuoy className="h-3 w-3" />
                      {client.open_tickets_count} تذكرة مفتوحة
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-[11px]">لا توجد تذاكر معلقة</span>
                  )}

                  <Link
                    to="/my-projects/$projectId/clients"
                    params={{ projectId: client.project_id }}
                    className="text-primary hover:underline font-medium flex items-center gap-1 text-xs shrink-0"
                  >
                    <span>الملف التفصيلي</span>
                    <ArrowRight className="h-3 w-3 rotate-180" />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Client Dialog */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              إضافة عميل أو شريك استراتيجي جديد
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="client_name">اسم المسؤول / العميل *</Label>
                <Input
                  id="client_name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="مثال: د. عبد العزيز الفهد"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client_company">اسم المنشأة / المدرسة / الجامعة</Label>
                <Input
                  id="client_company"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  placeholder="مثال: مدارس الرياض الأهلية"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client_project">المشروع أو النظام المرتبط *</Label>
                <Select value={newProjectId} onValueChange={setNewProjectId}>
                  <SelectTrigger id="client_project">
                    <SelectValue placeholder="اختر المشروع" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client_health">حالة العلاقة (Health Status)</Label>
                <Select value={newHealth} onValueChange={(val) => setNewHealth(val as HealthStatus)}>
                  <SelectTrigger id="client_health">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="green">ممتاز / مستقر (Green)</SelectItem>
                    <SelectItem value="yellow">يحتاج متابعة (Yellow)</SelectItem>
                    <SelectItem value="red">حرج / مهدد (Red)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client_email">البريد الإلكتروني</Label>
                <Input
                  id="client_email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="client@org.sa"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client_phone">رقم الهاتف / واتساب</Label>
                <Input
                  id="client_phone"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+966 50 123 4567"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client_country">الدولة</Label>
                <Input
                  id="client_country"
                  value={newCountry}
                  onChange={(e) => setNewCountry(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client_address">العنوان أو المدينة</Label>
                <Input
                  id="client_address"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="الرياض - حي الملز"
                />
              </div>
            </div>

            {/* Contract Info */}
            <div className="pt-2 border-t space-y-3">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <FileSignature className="h-4 w-4 text-primary" />
                بيانات التعاقد والتراخيص
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="contract_num">رقم العقد / الترخيص</Label>
                  <Input
                    id="contract_num"
                    value={newContractNumber}
                    onChange={(e) => setNewContractNumber(e.target.value)}
                    placeholder="CR-2026-LMS-01"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="contract_val">قيمة العقد السنوية</Label>
                  <div className="flex gap-2">
                    <Input
                      id="contract_val"
                      type="number"
                      value={newContractValue}
                      onChange={(e) => setNewContractValue(e.target.value)}
                      placeholder="150000"
                    />
                    <Select value={newCurrency} onValueChange={setNewCurrency}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SAR">SAR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="AED">AED</SelectItem>
                        <SelectItem value="EGP">EGP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="contract_start">تاريخ بداية العقد</Label>
                  <Input
                    id="contract_start"
                    type="date"
                    value={newContractStart}
                    onChange={(e) => setNewContractStart(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="contract_end">تاريخ نهاية العقد</Label>
                  <Input
                    id="contract_end"
                    type="date"
                    value={newContractEnd}
                    onChange={(e) => setNewContractEnd(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)} disabled={saving}>
              إلغاء
            </Button>
            <Button onClick={handleCreateClient} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              حفظ وإضافة العميل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
