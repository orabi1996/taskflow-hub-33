import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  BellOff,
  FolderKanban,
  RotateCcw,
  CalendarCheck,
  CalendarDays,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Sparkles,
} from "lucide-react";
import { format, differenceInDays, addMonths, addYears } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ListSkeleton } from "@/components/common/ListSkeleton";

export const Route = createFileRoute("/_app/alerts")({
  component: AlertsPage,
});

interface ProjectRow {
  id: string;
  name: string;
  contract_end_date: string | null;
  alert_days_before: number;
  owner_id: string | null;
  health_status: "green" | "yellow" | "red";
}

interface Dismissal {
  project_id: string;
  dismissed_for_end_date: string | null;
}

type AlertLevel = "expired" | "imminent" | "soon" | "ok";

function AlertsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [dismissals, setDismissals] = useState<Record<string, Dismissal>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "expired" | "imminent" | "soon" | "dismissed">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Renewal Modal State
  const [renewingProject, setRenewingProject] = useState<ProjectRow | null>(null);
  const [newEndDate, setNewEndDate] = useState<string>("");
  const [savingRenewal, setSavingRenewal] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [{ data: ps }, { data: ds }] = await Promise.all([
        supabase
          .from("projects")
          .select("id, name, contract_end_date, alert_days_before, owner_id, health_status")
          .not("contract_end_date", "is", null)
          .order("contract_end_date", { ascending: true }),
        supabase
          .from("project_alert_dismissals" as any)
          .select("project_id, dismissed_for_end_date")
          .eq("user_id", user.id),
      ]);
      setProjects((ps ?? []) as ProjectRow[]);
      const map: Record<string, Dismissal> = {};
      ((ds ?? []) as unknown as Dismissal[]).forEach((d) => {
        map[d.project_id] = d;
      });
      setDismissals(map);
    } catch {
      toast.error("تعذّر تحميل تنبيهات العقود");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    return projects
      .map((p) => {
        if (!p.contract_end_date) return null;
        const days = differenceInDays(new Date(p.contract_end_date), new Date());
        const threshold = p.alert_days_before ?? 30;
        let level: AlertLevel = "ok";

        if (days < 0) level = "expired";
        else if (days <= 7) level = "imminent";
        else if (days <= threshold) level = "soon";

        if (level === "ok") return null;

        const dis = dismissals[p.id];
        const dismissed = Boolean(dis && dis.dismissed_for_end_date === p.contract_end_date);
        return { p, level, days, dismissed };
      })
      .filter(Boolean) as Array<{
      p: ProjectRow;
      level: "expired" | "imminent" | "soon";
      days: number;
      dismissed: boolean;
    }>;
  }, [projects, dismissals]);

  const filtered = useMemo(() => {
    return rows
      .filter((r) => {
        if (filter === "all") return true;
        if (filter === "dismissed") return r.dismissed;
        return r.level === filter;
      })
      .filter((r) => {
        if (!searchQuery.trim()) return true;
        return r.p.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
      })
      .sort((a, b) => a.days - b.days);
  }, [rows, filter, searchQuery]);

  const counts = {
    all: rows.length,
    expired: rows.filter((r) => r.level === "expired").length,
    imminent: rows.filter((r) => r.level === "imminent").length,
    soon: rows.filter((r) => r.level === "soon").length,
    dismissed: rows.filter((r) => r.dismissed).length,
  };

  const dismiss = async (projectId: string, endDate: string | null) => {
    if (!user) return;
    const { error } = await supabase.from("project_alert_dismissals" as any).upsert(
      {
        project_id: projectId,
        user_id: user.id,
        dismissed_for_end_date: endDate,
      },
      { onConflict: "project_id,user_id" }
    );
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم تصفير التنبيه حتى تجديد العقد");
    load();
  };

  const restore = async (projectId: string) => {
    if (!user) return;
    await supabase
      .from("project_alert_dismissals" as any)
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", user.id);
    toast.success("تم إعادة تفعيل التنبيه");
    load();
  };

  const openRenewalModal = (project: ProjectRow) => {
    setRenewingProject(project);
    // Suggest 1 year from current end date or from today if already expired
    const baseDate =
      project.contract_end_date && new Date(project.contract_end_date) > new Date()
        ? new Date(project.contract_end_date)
        : new Date();
    const suggested = addYears(baseDate, 1);
    setNewEndDate(format(suggested, "yyyy-MM-dd"));
  };

  const handleApplyQuickAdd = (months: number) => {
    const baseDate =
      renewingProject?.contract_end_date && new Date(renewingProject.contract_end_date) > new Date()
        ? new Date(renewingProject.contract_end_date)
        : new Date();
    const target = addMonths(baseDate, months);
    setNewEndDate(format(target, "yyyy-MM-dd"));
  };

  const submitRenewal = async () => {
    if (!renewingProject || !newEndDate) return;
    setSavingRenewal(true);
    try {
      // 1. Update project contract_end_date
      const { error: projErr } = await supabase
        .from("projects")
        .update({ contract_end_date: newEndDate })
        .eq("id", renewingProject.id);

      if (projErr) throw projErr;

      // 2. Clear dismissals for this project so fresh alerts can trigger later
      await supabase
        .from("project_alert_dismissals" as any)
        .delete()
        .eq("project_id", renewingProject.id);

      // 3. Record audit event
      if (user) {
        await supabase.from("audit_logs").insert({
          actor_id: user.id,
          actor_email: user.email,
          event_type: "project.contract.renewed",
          severity: "info",
          resource_type: "project.contract",
          resource_id: renewingProject.id,
          old_value: { contract_end_date: renewingProject.contract_end_date },
          new_value: { contract_end_date: newEndDate },
          metadata: { project_name: renewingProject.name },
        });
      }

      toast.success(`تم تجديد عقد المشروع "${renewingProject.name}" بنجاح حتى ${format(new Date(newEndDate), "d MMMM yyyy", { locale: ar })}`);
      setRenewingProject(null);
      await load();
    } catch (err: any) {
      toast.error(err.message || "تعذّر تجديد العقد");
    } finally {
      setSavingRenewal(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <PageHeader
          title="مركز تنبيهات ودورة حياة العقود"
          description="متابعة استباقية لمواعيد انتهاء العقود، سلم تصاعدي للإشعارات، وإمكانية التجديد الفوري."
          icon={AlertTriangle}
        />

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => load()} className="gap-2 text-xs">
            <RotateCcw className="h-3.5 w-3.5" />
            تحديث
          </Button>
          <Link to="/billing">
            <Button variant="outline" size="sm" className="gap-2 text-xs">
              <CalendarCheck className="h-3.5 w-3.5" />
              الفوترة والدفعات
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-ui">عقود منتهية</p>
              <p className="text-xl font-bold font-display text-destructive">{counts.expired}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-ui">عقود حرجة (≤ 7 أيام)</p>
              <p className="text-xl font-bold font-display text-amber-600 dark:text-amber-400">
                {counts.imminent}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-ui">عقود قريبة</p>
              <p className="text-xl font-bold font-display text-foreground">{counts.soon}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0">
              <BellOff className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-ui">تنبيهات مصفّرة</p>
              <p className="text-xl font-bold font-display text-foreground">{counts.dismissed}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/40 p-2 rounded-xl border border-border/60">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-full sm:w-auto">
          <TabsList className="bg-background w-full sm:w-auto overflow-x-auto justify-start">
            <TabsTrigger value="all" className="text-xs">الكل ({counts.all})</TabsTrigger>
            <TabsTrigger value="expired" className="text-xs text-destructive data-[state=active]:text-destructive">
              منتهي ({counts.expired})
            </TabsTrigger>
            <TabsTrigger value="imminent" className="text-xs text-amber-600 dark:text-amber-400">
              حرج ({counts.imminent})
            </TabsTrigger>
            <TabsTrigger value="soon" className="text-xs">قريب ({counts.soon})</TabsTrigger>
            <TabsTrigger value="dismissed" className="text-xs">مصفّر ({counts.dismissed})</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم المشروع..."
            className="h-8 pr-8 text-xs bg-background"
          />
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <Card className="overflow-hidden">
          <ListSkeleton rows={4} />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={BellOff}
            title="لا توجد تنبيهات عقود تطابق هذا الفلتر"
            description="جميع عقود المشاريع في حالة منتظمة ولم تصل لعتبة التنبيه."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(({ p, level, days, dismissed }) => {
            const isExpired = level === "expired";
            const isImminent = level === "imminent";

            return (
              <Card
                key={p.id}
                className={`p-4 border transition-all duration-200 hover:shadow-md ${
                  dismissed ? "opacity-60 bg-muted/20" : "bg-card"
                } ${
                  isExpired
                    ? "border-destructive/30 hover:border-destructive/60"
                    : isImminent
                    ? "border-amber-500/30 hover:border-amber-500/60"
                    : "border-border/80"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isExpired
                          ? "bg-destructive/10 text-destructive"
                          : isImminent
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      <FolderKanban className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-base truncate text-foreground">{p.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>تاريخ الانتهاء:</span>
                        <span className="font-medium text-foreground">
                          {p.contract_end_date &&
                            format(new Date(p.contract_end_date), "d MMMM yyyy", { locale: ar })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Badge
                    variant={isExpired ? "destructive" : isImminent ? "default" : "secondary"}
                    className={`shrink-0 text-[11px] px-2 py-0.5 ${
                      isImminent
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                        : ""
                    }`}
                  >
                    {isExpired
                      ? `منتهي منذ ${Math.abs(days)} يوم`
                      : isImminent
                      ? `حرج: يتبقى ${days} ${days === 1 ? "يوم" : days === 2 ? "يومان" : "أيام"}`
                      : `يتبقى ${days} يوم`}
                  </Badge>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      className="h-8 gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                      onClick={() => openRenewalModal(p)}
                    >
                      <CalendarCheck className="h-3.5 w-3.5" />
                      تجديد العقد
                    </Button>

                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" asChild>
                      <Link to="/my-projects">
                        <ExternalLink className="h-3.5 w-3.5" />
                        المشروع
                      </Link>
                    </Button>
                  </div>

                  <div>
                    {dismissed ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => restore(p.id)}
                      >
                        <RotateCcw className="h-3.5 w-3.5 ms-1" />
                        إعادة التنبيه
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => dismiss(p.id, p.contract_end_date)}
                      >
                        <BellOff className="h-3.5 w-3.5 ms-1" />
                        تصفير مؤقت
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Quick Contract Renewal Modal */}
      <Dialog
        open={Boolean(renewingProject)}
        onOpenChange={(open) => !open && setRenewingProject(null)}
      >
        <DialogContent className="sm:max-w-md text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" />
              تجديد عقد المشروع
            </DialogTitle>
            <DialogDescription>
              تحديث مدة العقد للمشروع:{" "}
              <span className="font-semibold text-foreground">{renewingProject?.name}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border">
              <div>
                تاريخ الانتهاء الحالي:{" "}
                <span className="font-medium text-foreground">
                  {renewingProject?.contract_end_date
                    ? format(new Date(renewingProject.contract_end_date), "d MMMM yyyy", { locale: ar })
                    : "غير محدد"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">تاريخ الانتهاء الجديد:</Label>
              <Input
                type="date"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">خيارات التمديد السريع:</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleApplyQuickAdd(3)}
                >
                  + 3 أشهر
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleApplyQuickAdd(6)}
                >
                  + 6 أشهر
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleApplyQuickAdd(12)}
                >
                  + سنة كاملة
                </Button>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground bg-primary/5 p-2 rounded border border-primary/20">
              💡 عند حفظ التجديد، سيتم تصفير التنبيهات السابقة وإعادة جدولتها تلقائياً حسب التاريخ الجديد مع توثيق العملية في سجل التدقيق الأمني.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRenewingProject(null)}
              disabled={savingRenewal}
            >
              إلغاء
            </Button>
            <Button onClick={submitRenewal} disabled={savingRenewal || !newEndDate} className="gap-2">
              {savingRenewal && <Loader2 className="h-4 w-4 animate-spin" />}
              تأكيد وحفظ التجديد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
