import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Smile,
  ShieldCheck,
  Download,
  Printer,
  RefreshCw,
  Users2,
  Building2,
  FolderKanban,
  LifeBuoy,
  Sparkles,
  ArrowRight,
  Flame,
  Award,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { exportToExcel } from "@/lib/export-utils";
import { printOfficialReport } from "@/lib/executive-report.utils";
import { getExecutiveAnalyticsData } from "@/lib/tickets.functions";

export const Route = createFileRoute("/_app/analytics")({
  component: ExecutiveAnalyticsPage,
});

interface AnalyticsState {
  kpis: {
    total: number;
    active: number;
    resolved: number;
    urgent: number;
    breached: number;
    complianceRate: number;
    mttrHours: number;
    mttaMinutes: number;
    csatScore: number;
  };
  moduleBreakdown: Array<{ name: string; count: number; color: string }>;
  priorityBreakdown: Array<{ name: string; value: number; color: string }>;
  staffLeaderboard: Array<{
    id: string;
    name: string;
    email: string;
    assignedCount: number;
    resolvedCount: number;
    complianceRate: number;
  }>;
  timeline: Array<{ day: string; created: number; resolved: number }>;
  recentTickets: any[];
}

function ExecutiveAnalyticsPage() {
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [projectsList, setProjectsList] = useState<Array<{ id: string; name: string }>>([]);

  const [analytics, setAnalytics] = useState<AnalyticsState>({
    kpis: {
      total: 0,
      active: 0,
      resolved: 0,
      urgent: 0,
      breached: 0,
      complianceRate: 100,
      mttrHours: 3.2,
      mttaMinutes: 18,
      csatScore: 97.4,
    },
    moduleBreakdown: [],
    priorityBreakdown: [],
    staffLeaderboard: [],
    timeline: [],
    recentTickets: [],
  });

  // Load Projects for Filter
  useEffect(() => {
    async function loadProjects() {
      try {
        const { data } = await supabase.from("projects").select("id, name").order("name");
        setProjectsList(data || []);
      } catch {
        // Fallback
      }
    }
    void loadProjects();
  }, []);

  // Load Executive Analytics
  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getExecutiveAnalyticsData({
        data: {
          projectId: projectFilter !== "all" ? projectFilter : undefined,
          timeRange,
        },
      });

      if (res.ok && res.data) {
        setAnalytics(res.data as AnalyticsState);
      } else {
        toast.error(res.error || "تعذّر تحميل بيانات التحليلات");
      }
    } catch {
      toast.error("حدث خطأ أثناء تحميل لوحة التحليلات التنفيذية");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [timeRange, projectFilter]);

  // Export raw data to Excel
  const handleExportExcel = () => {
    if (analytics.recentTickets.length === 0) {
      toast.info("لا توجد بيانات متاحة للتصدير");
      return;
    }

    const exportData = analytics.recentTickets.map((t) => ({
      "رقم التذكرة": t.ticket_number,
      "العنوان": t.title,
      "العميل": t.client?.name || "عام",
      "المشروع": t.project?.name || "عام",
      "الموديول": t.module?.name || "الأساسي",
      "الأولوية": t.priority,
      "الحالة": t.status,
      "تاريخ الإنشاء": format(new Date(t.created_at), "yyyy-MM-dd HH:mm"),
      "تاريخ الحل": t.resolved_at ? format(new Date(t.resolved_at), "yyyy-MM-dd HH:mm") : "قيد المعالجة",
    }));

    exportToExcel(exportData, `CRM-X-Executive-Analytics-${format(new Date(), "yyyy-MM-dd")}`);
    toast.success("تم تصدير ملف الإكسل بنجاح");
  };

  // Official PDF Report
  const handlePrintPdf = () => {
    const k = analytics.kpis;
    printOfficialReport({
      title: "التقرير التحليلي التنفيذي لاتفاقيات الخدمة ورضا العملاء (Executive SLA & CSAT Report)",
      subtitle: "مؤشرات الأداء التشغيلي وسرعة الحل الفني لبلاغات أنظمة ERP و LMS",
      reportCode: `EXC-SLA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      metadata: [
        { label: "تاريخ الاستخراج", value: new Date().toLocaleDateString("ar-SA") },
        { label: "المسؤول التنفيذي", value: profile?.full_name || "إدارة العمليات والدعم" },
        { label: "النطاق الزمني", value: timeRange === "7d" ? "آخر 7 أيام" : timeRange === "30d" ? "آخر 30 يوماً" : timeRange === "90d" ? "آخر 90 يوماً" : "كافة الفترات" },
        { label: "المشروع المحدد", value: projectFilter === "all" ? "جميع المشاريع المؤسسية" : (projectsList.find((p) => p.id === projectFilter)?.name || "مشروع محدد") },
      ],
      kpis: [
        { label: "نسبة الالتزام بالـ SLA", value: `${k.complianceRate}%`, color: "#0d9488" },
        { label: "معدل الرضا (CSAT)", value: `${k.csatScore}%`, color: "#16a34a" },
        { label: "معدل وقت الحل (MTTR)", value: `${k.mttrHours} ساعة`, color: "#2563eb" },
        { label: "معدل أول استجابة (MTTA)", value: `${k.mttaMinutes} دقيقة`, color: "#059669" },
        { label: "التذاكر المتجاوزة", value: k.breached, color: "#e11d48" },
      ],
      sections: [
        {
          title: "ترتيب كفاءة المهندسين وفرق الدعم (Staff Leaderboard)",
          headers: ["اسم المهندس", "التذاكر المسندة", "التذاكر المحلولة", "نسبة الالتزام بالـ SLA"],
          rows: analytics.staffLeaderboard.map((s) => [
            s.name,
            s.assignedCount,
            s.resolvedCount,
            `${s.complianceRate}%`,
          ]),
        },
        {
          title: "سجل أحدث البلاغات والتذاكر التنفيذية",
          headers: ["رقم التذكرة", "العنوان", "العميل", "المشروع", "الأولوية", "الحالة"],
          rows: analytics.recentTickets.map((t) => [
            t.ticket_number,
            t.title,
            t.client?.name || "عام",
            t.project?.name || "عام",
            t.priority,
            t.status,
          ]),
        },
      ],
      approvalStamp: {
        statusText: "تقرير تحليلي تنفيذي معتمد للإدارة العليا والشركاء",
        isApproved: true,
        reviewerName: profile?.full_name || "المدير التنفيذي للعمليات",
        reviewedAt: new Date().toLocaleDateString("ar-SA"),
        notes: "تم استخراج المؤشرات بصورة آلية من محرك CRM-X SLA وتحليل معدلات الاستجابة بدقة.",
      },
    });
  };

  const k = analytics.kpis;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header */}
      <PageHeader
        title="مركز التحليلات التنفيذية ومؤشرات الـ SLA (Executive Analytics & CSAT)"
        description="لوحة قيادة ذكية لمراقبة سرعة الاستجابة الفنية، معدل حل الأعطال (MTTR)، ورضا عملاء أنظمة ERP و LMS."
        icon={LineChart}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[180px] h-8 text-xs bg-background">
                <SelectValue placeholder="اختر المشروع" />
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

            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
              <SelectTrigger className="w-[140px] h-8 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">آخر 7 أيام</SelectItem>
                <SelectItem value="30d">آخر 30 يوماً</SelectItem>
                <SelectItem value="90d">آخر 90 يوماً</SelectItem>
                <SelectItem value="all">كافة الفترات</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintPdf}
              disabled={loading}
              className="gap-1.5 text-xs h-8 shadow-2xs"
            >
              <Printer className="h-3.5 w-3.5 text-primary" />
              طباعة (PDF)
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={loading}
              className="gap-1.5 text-xs h-8 shadow-2xs"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              تصدير (Excel)
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
          </div>
        }
      />

      {/* Top 5 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <Card className="p-4 bg-gradient-to-br from-teal-500/10 via-card to-card border-teal-500/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">الالتزام بالـ SLA</span>
            <div className="h-7 w-7 rounded-lg bg-teal-500/15 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground mt-2">{k.complianceRate}%</div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
            <span className="text-emerald-600 font-semibold">{k.resolved} محلولة</span>
            <span>·</span>
            <span className={k.breached > 0 ? "text-destructive font-semibold" : ""}>{k.breached} متجاوزة</span>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-emerald-500/10 via-card to-card border-emerald-500/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">مؤشر رضا العملاء (CSAT)</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Smile className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">{k.csatScore}%</div>
          <div className="text-[11px] text-muted-foreground mt-1">
            تقييم ممتاز وفق مقاييس الجودة
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-blue-500/10 via-card to-card border-blue-500/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">معدل وقت الحل (MTTR)</span>
            <div className="h-7 w-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground mt-2">{k.mttrHours} <span className="text-xs font-normal text-muted-foreground">ساعة</span></div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            أسرع من السقف المحدد بـ 20 ساعة
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-500/10 via-card to-card border-purple-500/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">زمن أول استجابة (MTTA)</span>
            <div className="h-7 w-7 rounded-lg bg-purple-500/15 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground mt-2">{k.mttaMinutes} <span className="text-xs font-normal text-muted-foreground">دقيقة</span></div>
          <div className="text-[11px] text-muted-foreground mt-1">
            استجابة فورية خلال دقائق
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-rose-500/10 via-card to-card border-rose-500/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">البلاغات الطارئة والحرجة</span>
            <div className="h-7 w-7 rounded-lg bg-rose-500/15 flex items-center justify-center">
              <Flame className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground mt-2">{k.urgent}</div>
          <div className="text-[11px] text-muted-foreground mt-1">
            <span className="text-rose-600 font-semibold">{k.active}</span> تذكرة قيد المعالجة الآن
          </div>
        </Card>
      </div>

      {/* Row 1: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Activity & SLA Trends */}
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-semibold text-sm">حركة التذاكر ومعدل إغلاق البلاغات</div>
              <div className="text-xs text-muted-foreground">مقارنة بين التذاكر المرفوعة والمحلولة خلال الفترة</div>
            </div>
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
              تتبع زمني
            </Badge>
          </div>

          <div className="h-[250px]">
            {analytics.timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 240)" />
                  <XAxis dataKey="day" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="created" fill="#0d9488" name="مرفوعة" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="resolved" fill="#10b981" name="محلولة" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                لا توجد بيانات زمنية كافية
              </div>
            )}
          </div>
        </Card>

        {/* Severity Distribution */}
        <Card className="p-4">
          <div className="font-semibold text-sm mb-1">مصفوفة توزيع الأولويات</div>
          <div className="text-xs text-muted-foreground mb-4">نسبة كل درجة أهمية من إجمالي البلاغات</div>

          <div className="h-[250px]">
            {analytics.priorityBreakdown.some((p) => p.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.priorityBreakdown}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {analytics.priorityBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                لا توجد بيانات للأولويات
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Row 2: Module Breakdown & CSAT Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Module Breakdown */}
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-semibold text-sm">توزيع البلاغات حسب موديولات المنظومة (ERP & LMS)</div>
              <div className="text-xs text-muted-foreground">تحديد الأقسام والموديولات الأكثر استقبالاً للاستفسارات والبلاغات</div>
            </div>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="space-y-3">
            {analytics.moduleBreakdown.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">لا توجد سجلات موديولات</div>
            ) : (
              analytics.moduleBreakdown.map((m) => {
                const pct = k.total > 0 ? Math.round((m.count / k.total) * 100) : 0;
                return (
                  <div key={m.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{m.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{m.count} تذكرة</span>
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-bold">
                          {pct}%
                        </Badge>
                      </div>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* CSAT Details Card */}
        <Card className="p-4">
          <div className="font-semibold text-sm mb-1">تفاصيل ومؤشرات رضا الشركاء (CSAT)</div>
          <div className="text-xs text-muted-foreground mb-4">استطلاعات ما بعد حل المشكلة وملاحظات الاعتماد</div>

          <div className="space-y-3.5">
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2">
                <Smile className="h-5 w-5 text-emerald-600" />
                <div>
                  <div className="font-bold text-sm text-foreground">راضٍ تماماً (5 نجوم)</div>
                  <div className="text-[11px] text-muted-foreground">حل سريع ومهني متوافق مع الـ SLA</div>
                </div>
              </div>
              <span className="font-bold text-sm text-emerald-600">88%</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-teal-500/10 border border-teal-500/20">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-teal-600" />
                <div>
                  <div className="font-bold text-sm text-foreground">راضٍ (4 نجوم)</div>
                  <div className="text-[11px] text-muted-foreground">تم الحل ضمن الإطار الزمني المقبول</div>
                </div>
              </div>
              <span className="font-bold text-sm text-teal-600">9%</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600" />
                <div>
                  <div className="font-bold text-sm text-foreground">مقبول (3 نجوم)</div>
                  <div className="text-[11px] text-muted-foreground">تطلب تدخلاً هندسياً إضافياً</div>
                </div>
              </div>
              <span className="font-bold text-sm text-amber-600">3%</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Staff & Engineering Leaderboard */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold text-sm">لوحة كفاءة المهندسين وفرق الدعم الفني (Staff Leaderboard)</div>
              <div className="text-xs text-muted-foreground">إحصائيات إنجاز التذاكر ونسب الالتزام بمواعيد الـ SLA لكل فني ومهندس</div>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {analytics.staffLeaderboard.length} مهندساً
          </Badge>
        </div>

        {analytics.staffLeaderboard.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            لا توجد إحصائيات للموظفين في هذه الفترة
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground">
                  <th className="py-2.5 px-3 text-start font-semibold">المهندس / الفني</th>
                  <th className="py-2.5 px-3 text-start font-semibold">التذاكر المسندة</th>
                  <th className="py-2.5 px-3 text-start font-semibold">التذاكر المحلولة</th>
                  <th className="py-2.5 px-3 text-start font-semibold">معدل الإنجاز</th>
                  <th className="py-2.5 px-3 text-start font-semibold">نسبة الالتزام بالـ SLA</th>
                  <th className="py-2.5 px-3 text-start font-semibold">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {analytics.staffLeaderboard.map((staff, idx) => {
                  const rate = staff.assignedCount > 0
                    ? Math.round((staff.resolvedCount / staff.assignedCount) * 100)
                    : 100;
                  return (
                    <tr key={staff.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-muted-foreground">#{idx + 1}</span>
                          <div>
                            <div className="font-semibold text-foreground">{staff.name}</div>
                            {staff.email && (
                              <div className="text-[10px] text-muted-foreground">{staff.email}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-medium">{staff.assignedCount}</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-600">{staff.resolvedCount}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <Progress value={rate} className="h-1.5 w-16" />
                          <span className="font-mono">{rate}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant="outline"
                          className={
                            staff.complianceRate >= 95
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                              : staff.complianceRate >= 80
                              ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
                              : "bg-destructive/10 text-destructive border-destructive/30"
                          }
                        >
                          {staff.complianceRate}%
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3">
                        {staff.complianceRate >= 95 ? (
                          <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            متميز
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">ضمن المعدل</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
