import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { listAuditEvents, getAuditStats } from "@/lib/audit.functions";
import { exportToCSV, exportToExcel } from "@/lib/export-utils";
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Loader2,
  Search,
  Download,
  FileSpreadsheet,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Activity,
  Copy,
  Check,
  Filter,
  Layers,
  KeyRound,
  FileText,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings/audit")({
  component: AuditPage,
});

interface AuditRow {
  id: string;
  created_at: string;
  actor_email: string | null;
  event_type: string;
  severity: "info" | "warn" | "critical" | string;
  resource_type: string | null;
  resource_id: string | null;
  ip: string | null;
  metadata: Record<string, unknown> | null;
  old_value: unknown;
  new_value: unknown;
  user_agent: string | null;
}

interface AuditStats {
  total: number;
  critical: number;
  warn: number;
  last24h: number;
}

const SEV_CONFIG: Record<
  string,
  { label: string; badgeClass: string; rowBorderClass: string; icon: React.ElementType }
> = {
  critical: {
    label: "حرج جداً",
    badgeClass: "bg-destructive/15 text-destructive border-destructive/30",
    rowBorderClass: "border-s-4 border-s-destructive",
    icon: AlertOctagon,
  },
  warn: {
    label: "تحذير أمني",
    badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    rowBorderClass: "border-s-4 border-s-amber-500",
    icon: AlertTriangle,
  },
  info: {
    label: "معلومة",
    badgeClass: "bg-muted text-muted-foreground border-border",
    rowBorderClass: "border-s-4 border-s-transparent",
    icon: Activity,
  },
};

const PAGE_SIZE = 50;

function AuditPage() {
  const { roles } = useAuth();
  const isAllowed = roles.includes("admin") || roles.includes("general_manager");
  const canExport = roles.includes("admin");

  const [rows, setRows] = useState<AuditRow[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<string>("__all__");
  const [eventType, setEventType] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [quickPreset, setQuickPreset] = useState<string>("all");
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const buildFilters = useCallback(() => ({
    severity: severity === "__all__" ? undefined : (severity as any),
    eventType: eventType || undefined,
    resourceType: resourceType || undefined,
    resourceId: resourceId || undefined,
    search: search || undefined,
    startDate: startDate ? new Date(startDate).toISOString() : undefined,
    endDate: endDate ? new Date(endDate + "T23:59:59").toISOString() : undefined,
  }), [severity, eventType, resourceType, resourceId, search, startDate, endDate]);

  const loadStats = useCallback(async () => {
    try {
      const res = await getAuditStats({});
      setStats(res as AuditStats);
    } catch {
      // non-blocking
    }
  }, []);

  const loadPage = useCallback(async (targetPage: number, refreshCount = false) => {
    setLoading(true);
    try {
      const res = await listAuditEvents({
        data: {
          limit: PAGE_SIZE,
          offset: targetPage * PAGE_SIZE,
          withCount: refreshCount || totalCount === null,
          ...buildFilters(),
        },
      });
      setRows(res.rows as AuditRow[]);
      if (res.count !== null && res.count !== undefined) setTotalCount(res.count);
      setPage(targetPage);
    } catch {
      toast.error("تعذّر جلب سجلات التدقيق");
    } finally {
      setLoading(false);
    }
  }, [buildFilters, totalCount]);

  useEffect(() => {
    if (isAllowed) {
      loadStats();
      loadPage(0, true);
    }
  }, [isAllowed, loadStats, loadPage]);

  const applyFilters = () => {
    setTotalCount(null);
    loadPage(0, true);
  };

  const handleQuickPreset = (preset: string) => {
    setQuickPreset(preset);
    setSearch("");
    setStartDate("");
    setEndDate("");
    setResourceType("");
    setResourceId("");

    if (preset === "all") {
      setSeverity("__all__");
      setEventType("");
    } else if (preset === "critical") {
      setSeverity("critical");
      setEventType("");
    } else if (preset === "warn") {
      setSeverity("warn");
      setEventType("");
    } else if (preset === "auth") {
      setSeverity("__all__");
      setEventType("auth");
    } else if (preset === "contract") {
      setSeverity("__all__");
      setEventType("contract");
    } else if (preset === "roles") {
      setSeverity("__all__");
      setEventType("role");
    }
    setTotalCount(null);
    setTimeout(() => {
      loadPage(0, true);
    }, 50);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("تم النسخ للحافظة");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const exportData = async (format: "csv" | "xlsx") => {
    if (!canExport) return;
    setExporting(true);
    try {
      const all: AuditRow[] = [];
      let offset = 0;
      while (true) {
        const res = await listAuditEvents({
          data: { limit: 500, offset, ...buildFilters() },
        });
        const batch = res.rows as AuditRow[];
        all.push(...batch);
        if (batch.length < 500 || all.length >= 10000) break;
        offset += 500;
      }
      const data = all.map((r) => ({
        التاريخ: new Date(r.created_at).toLocaleString("ar-EG"),
        المستخدم: r.actor_email ?? "",
        الحدث: r.event_type,
        الخطورة: r.severity,
        نوع_المورد: r.resource_type ?? "",
        معرف_المورد: r.resource_id ?? "",
        IP: r.ip ?? "",
        Metadata: r.metadata ? JSON.stringify(r.metadata) : "",
      }));
      const fname = `security-audit-report-${new Date().toISOString().slice(0, 10)}`;
      if (format === "csv") exportToCSV(data, fname);
      else exportToExcel(data, fname, "AuditLog");
      toast.success("تم تصدير تقرير التدقيق بنجاح");
    } finally {
      setExporting(false);
    }
  };

  const totalPages = totalCount !== null ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) : null;
  const rangeStart = totalCount === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = page * PAGE_SIZE + rows.length;

  if (!isAllowed) {
    return (
      <Card className="p-12 text-center">
        <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground">هذه الصفحة متاحة للأدمن والمدير العام فقط.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <PageHeader
          icon={ShieldAlert}
          title="مركز مراقبة الأمان وسجل التدقيق"
          description="رصد استباقي للعمليات الحساسة في النظام: تسجيل الدخول، العقود، تغيير الصلاحيات، والتعديلات الإدارية."
        />

        <div className="flex flex-wrap items-center gap-2">
          {canExport && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportData("csv")}
                disabled={exporting || loading}
                title="تصدير CSV"
                className="gap-1.5 text-xs h-8"
              >
                {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportData("xlsx")}
                disabled={exporting || loading}
                title="تصدير Excel"
                className="gap-1.5 text-xs h-8"
              >
                {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                Excel
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadStats();
              loadPage(page, true);
            }}
            disabled={loading}
            className="gap-1.5 text-xs h-8"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            تحديث السجلات
          </Button>
        </div>
      </div>

      {/* KPI Security Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-ui">إجمالي العمليات الموثقة</p>
              <p className="text-xl font-bold font-display text-foreground">
                {stats ? stats.total.toLocaleString("ar-EG") : "—"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
              <AlertOctagon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-ui">عمليات حرجة</p>
              <p className="text-xl font-bold font-display text-destructive">
                {stats ? stats.critical.toLocaleString("ar-EG") : "—"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-ui">تحذيرات أمنية</p>
              <p className="text-xl font-bold font-display text-amber-600 dark:text-amber-400">
                {stats ? stats.warn.toLocaleString("ar-EG") : "—"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-ui">النشاط (آخر 24 ساعة)</p>
              <p className="text-xl font-bold font-display text-foreground">
                {stats ? stats.last24h.toLocaleString("ar-EG") : "—"}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Filter Presets */}
      <div className="flex items-center gap-1.5 flex-wrap p-1.5 bg-muted/40 rounded-xl border border-border/60 text-xs">
        <span className="text-muted-foreground px-2 font-medium flex items-center gap-1">
          <Filter className="h-3.5 w-3.5" />
          تصفية سريعة:
        </span>
        <Button
          variant={quickPreset === "all" ? "default" : "ghost"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => handleQuickPreset("all")}
        >
          كافة الأحداث
        </Button>
        <Button
          variant={quickPreset === "critical" ? "default" : "ghost"}
          size="sm"
          className="h-7 text-xs text-destructive data-[state=active]:text-destructive-foreground"
          onClick={() => handleQuickPreset("critical")}
        >
          أحداث حرجة
        </Button>
        <Button
          variant={quickPreset === "warn" ? "default" : "ghost"}
          size="sm"
          className="h-7 text-xs text-amber-600 dark:text-amber-400"
          onClick={() => handleQuickPreset("warn")}
        >
          تحذيرات
        </Button>
        <Button
          variant={quickPreset === "auth" ? "default" : "ghost"}
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => handleQuickPreset("auth")}
        >
          <KeyRound className="h-3 w-3" />
          تسجيل الدخول والمصادقة
        </Button>
        <Button
          variant={quickPreset === "contract" ? "default" : "ghost"}
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => handleQuickPreset("contract")}
        >
          <FileText className="h-3 w-3" />
          العقود والفوترة
        </Button>
        <Button
          variant={quickPreset === "roles" ? "default" : "ghost"}
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => handleQuickPreset("roles")}
        >
          <UserCheck className="h-3 w-3" />
          الصلاحيات والهيكل
        </Button>
      </div>

      {/* Detailed Filters Panel */}
      <Card className="p-4 border border-border/70">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالبريد، الحدث، المورد..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9 text-xs h-8"
            />
          </div>

          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger className="text-xs h-8">
              <SelectValue placeholder="مستوى الخطورة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__" className="text-xs">كل المستويات</SelectItem>
              <SelectItem value="info" className="text-xs">معلومة (Info)</SelectItem>
              <SelectItem value="warn" className="text-xs">تحذير (Warn)</SelectItem>
              <SelectItem value="critical" className="text-xs">حرج (Critical)</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="نوع الحدث (مثال: auth.login)..."
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="text-xs h-8"
          />

          <Input
            placeholder="نوع المورد (مثال: project.contract)..."
            value={resourceType}
            onChange={(e) => setResourceType(e.target.value)}
            className="text-xs h-8"
          />

          <Input
            placeholder="معرف المورد (UUID)..."
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
            className="text-xs h-8"
          />

          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-xs h-8"
            placeholder="من تاريخ"
          />

          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="text-xs h-8"
            placeholder="إلى تاريخ"
          />

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs flex-1"
              onClick={() => {
                setSearch("");
                setSeverity("__all__");
                setEventType("");
                setResourceType("");
                setResourceId("");
                setStartDate("");
                setEndDate("");
                setQuickPreset("all");
              }}
            >
              مسح الفلاتر
            </Button>
            <Button size="sm" onClick={applyFilters} disabled={loading} className="h-8 text-xs flex-1">
              تطبيق
            </Button>
          </div>
        </div>
      </Card>

      {/* Counter bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>
          {loading && totalCount === null ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> جارٍ حساب الإجمالي...
            </span>
          ) : totalCount !== null ? (
            <span>
              عرض <strong className="text-foreground">{rangeStart}</strong> إلى{" "}
              <strong className="text-foreground">{rangeEnd}</strong> من إجمالي{" "}
              <strong className="text-foreground">{totalCount.toLocaleString("ar-EG")}</strong> عملية مسجلة
            </span>
          ) : null}
        </div>
      </div>

      {/* Log Table */}
      <Card className="overflow-hidden border border-border/80">
        {loading ? (
          <div className="p-16 text-center text-muted-foreground">
            <Loader2 className="h-7 w-7 mx-auto animate-spin mb-2 text-primary" />
            جارٍ فحص وتحميل السجلات الأمنية...
          </div>
        ) : rows.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">
            <ShieldCheck className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
            لا توجد أحداث مطابقة لمعايير البحث الحالية.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-start px-3 py-3 font-semibold">التاريخ والتوقيت</th>
                  <th className="text-start px-3 py-3 font-semibold">المستخدم / الفاعل</th>
                  <th className="text-start px-3 py-3 font-semibold">نوع الحدث</th>
                  <th className="text-start px-3 py-3 font-semibold">الخطورة</th>
                  <th className="text-start px-3 py-3 font-semibold">المورد المتأثر</th>
                  <th className="text-start px-3 py-3 font-semibold">عنوان IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((r) => {
                  const conf = SEV_CONFIG[r.severity] ?? SEV_CONFIG.info;
                  const Icon = conf.icon;

                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-muted/40 cursor-pointer transition-colors ${conf.rowBorderClass}`}
                      onClick={() => setSelected(r)}
                    >
                      <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground font-mono">
                        {new Date(r.created_at).toLocaleString("ar-EG")}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-foreground">
                        {r.actor_email || "النظام الآلي (System)"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-[11px] bg-muted/60 px-1.5 py-0.5 rounded border border-border/60">
                          {r.event_type}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline" className={`text-[10px] py-0 gap-1 border ${conf.badgeClass}`}>
                          <Icon className="h-3 w-3" />
                          {conf.label}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {r.resource_type ? (
                          <span>
                            {r.resource_type}
                            {r.resource_id && (
                              <span className="font-mono text-[10px] text-muted-foreground/70 ms-1">
                                ({r.resource_id.slice(0, 8)}…)
                              </span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                        {r.ip || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages !== null && totalPages > 1 && (
          <div className="p-3 border-t flex items-center justify-between gap-2 flex-wrap bg-muted/20">
            <div className="text-xs text-muted-foreground">
              صفحة <strong>{page + 1}</strong> من <strong>{totalPages}</strong>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadPage(page - 1)}
                disabled={page === 0 || loading}
                className="h-7 text-xs"
              >
                <ChevronRight className="h-3.5 w-3.5 ms-1" />
                السابق
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadPage(page + 1)}
                disabled={page + 1 >= totalPages || loading}
                className="h-7 text-xs"
              >
                التالي
                <ChevronLeft className="h-3.5 w-3.5 me-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Detailed Event Inspection Modal */}
      <Dialog open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" />
              فحص تفاصيل الحدث الأمني
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 text-xs py-2">
              <DetailRow label="تاريخ وساعة الحدث" value={new Date(selected.created_at).toLocaleString("ar-EG")} />
              <DetailRow label="المستخدم الفاعل" value={selected.actor_email || "النظام الآلي (System Engine)"} />
              <DetailRow
                label="نوع الحدث"
                value={<span className="font-mono bg-muted/60 px-2 py-0.5 rounded border">{selected.event_type}</span>}
              />
              <DetailRow
                label="مستوى الخطورة"
                value={
                  <Badge
                    variant="outline"
                    className={`text-xs border ${SEV_CONFIG[selected.severity]?.badgeClass ?? ""}`}
                  >
                    {SEV_CONFIG[selected.severity]?.label ?? selected.severity}
                  </Badge>
                }
              />
              <DetailRow label="نوع المورد" value={selected.resource_type || "—"} />
              <DetailRow
                label="معرف المورد"
                value={
                  selected.resource_id ? (
                    <div className="flex items-center gap-2 font-mono break-all">
                      <span>{selected.resource_id}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => copyToClipboard(selected.resource_id!, "res_id")}
                      >
                        {copiedKey === "res_id" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  ) : (
                    "—"
                  )
                }
              />
              <DetailRow
                label="عنوان IP"
                value={
                  selected.ip ? (
                    <div className="flex items-center gap-2 font-mono">
                      <span>{selected.ip}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => copyToClipboard(selected.ip!, "ip")}
                      >
                        {copiedKey === "ip" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  ) : (
                    "—"
                  )
                }
              />
              <DetailRow label="User Agent" value={<span className="break-all font-mono text-[11px]">{selected.user_agent || "—"}</span>} />

              {selected.metadata && Object.keys(selected.metadata).length > 0 && (
                <div>
                  <div className="font-semibold text-foreground mb-1">البيانات الوصفية الإضافية (Metadata):</div>
                  <pre className="bg-muted/50 rounded-lg p-3 text-[11px] font-mono overflow-x-auto border">
                    {JSON.stringify(selected.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {selected.old_value !== null && selected.old_value !== undefined && (
                <div>
                  <div className="font-semibold text-destructive mb-1">القيمة السابقة (Before):</div>
                  <pre className="bg-destructive/5 text-destructive rounded-lg p-3 text-[11px] font-mono overflow-x-auto border border-destructive/20">
                    {JSON.stringify(selected.old_value, null, 2)}
                  </pre>
                </div>
              )}

              {selected.new_value !== null && selected.new_value !== undefined && (
                <div>
                  <div className="font-semibold text-emerald-600 dark:text-emerald-400 mb-1">القيمة الجديدة (After):</div>
                  <pre className="bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 rounded-lg p-3 text-[11px] font-mono overflow-x-auto border border-emerald-500/20">
                    {JSON.stringify(selected.new_value, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start border-b border-border/50 pb-2">
      <div className="w-32 shrink-0 text-muted-foreground font-medium">{label}</div>
      <div className="flex-1 text-foreground">{value}</div>
    </div>
  );
}
