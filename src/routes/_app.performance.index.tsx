import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Target,
  Trash2,
  Pencil,
  Trophy,
  Download,
  RotateCcw,
  CheckCircle2,
  TrendingUp,
  Award,
  Sparkles,
  ArrowUpRight,
  Minus,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  listObjectives,
  upsertObjective,
  deleteObjective,
  upsertKeyResult,
  deleteKeyResult,
  listPeopleLite,
} from "@/lib/performance.functions";
import { exportToExcel } from "@/lib/export-utils";

export const Route = createFileRoute("/_app/performance/")({
  component: OkrsPage,
});

type Kr = {
  id: string;
  objective_id: string;
  title: string;
  start_value: number;
  current_value: number;
  target_value: number;
  unit: "number" | "percent" | "currency";
  status: "on_track" | "at_risk" | "off_track" | "done";
};

type Objective = {
  id: string;
  title: string;
  description: string | null;
  owner_id: string;
  owner_name: string;
  quarter: number;
  year: number;
  status: "draft" | "active" | "completed" | "cancelled";
  progress: number;
  key_results: Kr[];
};

type Person = { id: string; full_name: string };

const STATUS_LABEL: Record<string, string> = {
  draft: "مسودة",
  active: "نشط",
  completed: "مكتمل",
  cancelled: "ملغي",
};

const KR_STATUS_LABEL: Record<string, string> = {
  on_track: "على المسار",
  at_risk: "معرّض للخطر",
  off_track: "متعثّر",
  done: "منجز",
};

function calculateKrProgress(kr: Kr): number {
  if (kr.target_value === kr.start_value) return 100;
  const ratio = (kr.current_value - kr.start_value) / (kr.target_value - kr.start_value);
  return Math.min(100, Math.max(0, Math.round(ratio * 100)));
}

function calculateObjectiveProgress(o: Objective): number {
  if (!o.key_results || o.key_results.length === 0) {
    return Number(o.progress) || 0;
  }
  const sum = o.key_results.reduce((acc, kr) => acc + calculateKrProgress(kr), 0);
  return Math.round(sum / o.key_results.length);
}

function OkrsPage() {
  const { user, roles } = useAuth();
  const isManager = roles.some((r) => ["admin", "general_manager", "manager"].includes(r));

  const fetchObjectives = useServerFn(listObjectives);
  const fetchPeople = useServerFn(listPeopleLite);
  const saveObjective = useServerFn(upsertObjective);
  const removeObjective = useServerFn(deleteObjective);
  const saveKr = useServerFn(upsertKeyResult);
  const removeKr = useServerFn(deleteKeyResult);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [scope, setScope] = useState<"all" | "mine">(isManager ? "all" : "mine");
  const [items, setItems] = useState<Objective[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [busy, setBusy] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);

  const reload = useCallback(async () => {
    const data = (await fetchObjectives({
      data: { year, quarter, owner_id: scope === "mine" ? (user?.id ?? null) : null },
    })) as Objective[];
    setItems(data);
  }, [fetchObjectives, year, quarter, scope, user?.id]);

  useEffect(() => {
    setItems(null);
    reload().catch((e) => toast.error(e?.message ?? "تعذر التحميل"));
  }, [reload]);

  useEffect(() => {
    fetchPeople({}).then((p) => setPeople(p as Person[])).catch(() => void 0);
  }, [fetchPeople]);

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  // Analytics & Leaderboard
  const analytics = useMemo(() => {
    if (!items || items.length === 0) {
      return { total: 0, completed: 0, avgProgress: 0, topPerformers: [] };
    }
    const total = items.length;
    const completed = items.filter((o) => o.status === "completed" || calculateObjectiveProgress(o) >= 100).length;
    const avgProgress = Math.round(
      items.reduce((acc, o) => acc + calculateObjectiveProgress(o), 0) / total
    );

    // Group by owner
    const byOwner = new Map<string, { name: string; count: number; totalProgress: number }>();
    items.forEach((o) => {
      const cur = byOwner.get(o.owner_id) ?? { name: o.owner_name, count: 0, totalProgress: 0 };
      cur.count += 1;
      cur.totalProgress += calculateObjectiveProgress(o);
      byOwner.set(o.owner_id, cur);
    });

    const topPerformers = Array.from(byOwner.values())
      .map((p) => ({
        name: p.name,
        avg: Math.round(p.totalProgress / p.count),
        count: p.count,
      }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3);

    return { total, completed, avgProgress, topPerformers };
  }, [items]);

  // Auto-sync calculated progress
  const handleSyncProgress = async (objective: Objective) => {
    const computed = calculateObjectiveProgress(objective);
    setBusy(true);
    try {
      await saveObjective({
        data: {
          id: objective.id,
          title: objective.title,
          description: objective.description,
          owner_id: objective.owner_id,
          quarter: objective.quarter,
          year: objective.year,
          status: computed >= 100 ? "completed" : objective.status,
        },
      });
      toast.success(`تم تحديث نسبة إنجاز "${objective.title}" إلى ${computed}%`);
      await reload();
    } catch {
      toast.error("تعذّر حفظ النسبة المحسوبة");
    } finally {
      setBusy(false);
    }
  };

  // Quick increment/decrement KR value
  const handleQuickAdjustKr = async (kr: Kr, delta: number) => {
    const nextVal = Math.max(kr.start_value, kr.current_value + delta);
    const isDone = nextVal >= kr.target_value;
    const newStatus = isDone ? "done" : nextVal <= kr.start_value ? "off_track" : kr.status;

    try {
      await saveKr({
        data: {
          ...kr,
          current_value: nextVal,
          status: newStatus,
        },
      });
      await reload();
    } catch {
      toast.error("تعذر تحديث القيمة");
    }
  };

  // Export OKRs to Excel
  const handleExport = () => {
    if (!items || items.length === 0) return;
    const exportRows: any[] = [];
    items.forEach((o) => {
      const objProg = calculateObjectiveProgress(o);
      if (o.key_results.length === 0) {
        exportRows.push({
          "الهدف": o.title,
          "الوصف": o.description ?? "",
          "المسؤول": o.owner_name,
          "الربع": `الربع ${o.quarter} / ${o.year}`,
          "حالة الهدف": STATUS_LABEL[o.status] ?? o.status,
          "نسبة الإنجاز": `${objProg}%`,
          "النتيجة الرئيسية": "—",
          "القيمة الحالية": "—",
          "المستهدف": "—",
          "حالة النتيجة": "—",
        });
      } else {
        o.key_results.forEach((kr) => {
          exportRows.push({
            "الهدف": o.title,
            "الوصف": o.description ?? "",
            "المسؤول": o.owner_name,
            "الربع": `الربع ${o.quarter} / ${o.year}`,
            "حالة الهدف": STATUS_LABEL[o.status] ?? o.status,
            "نسبة الإنجاز": `${objProg}%`,
            "النتيجة الرئيسية": kr.title,
            "القيمة الحالية": kr.current_value,
            "المستهدف": kr.target_value,
            "حالة النتيجة": KR_STATUS_LABEL[kr.status] ?? kr.status,
          });
        });
      }
    });

    exportToExcel(exportRows, `OKRs-Q${quarter}-${year}`, `الأهداف-Q${quarter}`);
    toast.success("تم تصدير ملف الأهداف بنجاح");
  };

  return (
    <div className="space-y-6">
      {/* KPI & Honors Leaderboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-ui">إجمالي أهداف الربع</p>
              <p className="text-xl font-bold font-display text-foreground">{analytics.total}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-ui">الأهداف المكتملة</p>
              <p className="text-xl font-bold font-display text-emerald-600 dark:text-emerald-400">
                {analytics.completed}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-ui">متوسط إنجاز الربع</p>
              <p className="text-xl font-bold font-display text-foreground">{analytics.avgProgress}%</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/30">
          <div className="flex items-center gap-2 mb-1.5">
            <Trophy className="h-4 w-4 text-amber-500" />
            <p className="text-xs font-semibold text-foreground font-ui">لوحة شرف إنجاز الربع</p>
          </div>
          {analytics.topPerformers.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا توجد بيانات كافية</p>
          ) : (
            <div className="space-y-1">
              {analytics.topPerformers.map((tp, idx) => (
                <div key={tp.name} className="flex items-center justify-between text-xs">
                  <span className="truncate max-w-[120px] font-medium text-foreground">
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"} {tp.name}
                  </span>
                  <Badge variant="outline" className="text-[10px] py-0 border-amber-500/30">
                    {tp.avg}%
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Filter and Action Bar */}
      <Card className="p-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">السنة</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">الربع</Label>
            <Select value={String(quarter)} onValueChange={(v) => setQuarter(Number(v))}>
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((q) => <SelectItem key={q} value={String(q)}>الربع {q}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">النطاق</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as "all" | "mine")}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأهداف</SelectItem>
                <SelectItem value="mine">أهدافي فقط</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!items || items.length === 0}
            className="h-8 gap-1.5 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            تصدير Excel
          </Button>

          <ObjectiveDialog
            people={people}
            defaultOwner={user?.id ?? ""}
            year={year}
            quarter={quarter}
            canPickOwner={isManager}
            onSave={async (payload) => {
              setBusy(true);
              try {
                await saveObjective({ data: payload });
                toast.success("تم إنشاء الهدف بنجاح");
                await reload();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "تعذر الحفظ");
              } finally {
                setBusy(false);
              }
            }}
            trigger={
              <Button size="sm" className="h-8 gap-1.5 text-xs" disabled={busy}>
                <Plus className="h-3.5 w-3.5" />
                هدف جديد
              </Button>
            }
          />
        </div>
      </Card>

      {/* Objectives List */}
      {items === null ? (
        <Card className="p-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </Card>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          <Target className="h-10 w-10 mx-auto mb-3 opacity-40 text-primary" />
          <p className="font-semibold text-foreground mb-1">لا توجد أهداف مسجلة في هذه الفترة بعد</p>
          <p className="text-xs">ابدأ بإضافة أهداف الربع السنوي ونتائجها الرئيسية لمتابعة مؤشرات الأداء بدقة.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {items.map((o) => {
            const computedProgress = calculateObjectiveProgress(o);

            return (
              <Card key={o.id} className="p-5 space-y-4 border transition-all duration-200 hover:shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base text-foreground">{o.title}</h3>
                      <Badge
                        variant={o.status === "completed" ? "default" : o.status === "active" ? "secondary" : "outline"}
                      >
                        {STATUS_LABEL[o.status] ?? o.status}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        الربع {o.quarter} / {o.year}
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      المسؤول: <span className="font-medium text-foreground">{o.owner_name}</span>
                    </div>

                    {o.description && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{o.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                      onClick={() => handleSyncProgress(o)}
                      disabled={busy}
                      title="مزامنة النسبة المحسوبة تلقائياً"
                    >
                      <RotateCcw className="h-3 w-3" />
                      مزامنة
                    </Button>

                    <ObjectiveDialog
                      people={people}
                      defaultOwner={o.owner_id}
                      year={o.year}
                      quarter={o.quarter}
                      canPickOwner={isManager}
                      initial={o}
                      onSave={async (payload) => {
                        await saveObjective({ data: { ...payload, id: o.id } });
                        toast.success("تم تحديث الهدف");
                        await reload();
                      }}
                      trigger={
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={async () => {
                        await removeObjective({ data: { id: o.id } });
                        toast.success("تم حذف الهدف");
                        await reload();
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5 bg-muted/30 p-2.5 rounded-lg border">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">التقدم الإجمالي المحسوب</span>
                    <span
                      className={`font-bold font-mono ${
                        computedProgress >= 100
                          ? "text-emerald-600 dark:text-emerald-400"
                          : computedProgress >= 70
                          ? "text-blue-600 dark:text-blue-400"
                          : computedProgress >= 40
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {computedProgress}%
                    </span>
                  </div>

                  <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        computedProgress >= 100
                          ? "bg-emerald-500"
                          : computedProgress >= 70
                          ? "bg-blue-500"
                          : computedProgress >= 40
                          ? "bg-amber-500"
                          : "bg-primary"
                      }`}
                      style={{ width: `${Math.min(100, computedProgress)}%` }}
                    />
                  </div>
                </div>

                {/* Key Results */}
                <div className="rounded-xl border divide-y divide-border/60 bg-card overflow-hidden">
                  {o.key_results.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      لا توجد نتائج رئيسية مضافة لهذا الهدف بعد.
                    </div>
                  ) : (
                    o.key_results.map((kr) => {
                      const krProgress = calculateKrProgress(kr);

                      return (
                        <div key={kr.id} className="p-3 flex flex-wrap items-center gap-3 text-xs">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground truncate">{kr.title}</span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] py-0 px-1.5 ${
                                  kr.status === "done"
                                    ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                                    : kr.status === "on_track"
                                    ? "border-blue-500/40 text-blue-600 dark:text-blue-400"
                                    : kr.status === "at_risk"
                                    ? "border-amber-500/40 text-amber-600 dark:text-amber-400"
                                    : "border-destructive/40 text-destructive"
                                }`}
                              >
                                {KR_STATUS_LABEL[kr.status] ?? kr.status}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-200 ${
                                    krProgress >= 100
                                      ? "bg-emerald-500"
                                      : krProgress >= 60
                                      ? "bg-blue-500"
                                      : "bg-amber-500"
                                  }`}
                                  style={{ width: `${krProgress}%` }}
                                />
                              </div>

                              <span className="font-mono text-muted-foreground shrink-0 text-[11px]">
                                {kr.current_value} / {kr.target_value}
                                {kr.unit === "percent" ? "%" : ""} ({krProgress}%)
                              </span>
                            </div>
                          </div>

                          {/* Quick Adjust Buttons */}
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleQuickAdjustKr(kr, -1)}
                              title="إنقاص"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              className="w-20 h-7 text-xs font-mono text-center"
                              defaultValue={kr.current_value}
                              onBlur={async (e) => {
                                const v = Number(e.target.value);
                                if (v === kr.current_value) return;
                                const isDone = v >= kr.target_value;
                                await saveKr({
                                  data: {
                                    ...kr,
                                    current_value: v,
                                    status: isDone ? "done" : kr.status,
                                  },
                                });
                                await reload();
                              }}
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleQuickAdjustKr(kr, 1)}
                              title="زيادة"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={async () => {
                              await removeKr({ data: { id: kr.id } });
                              await reload();
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="pt-1 flex justify-end">
                  <KrDialog
                    objectiveId={o.id}
                    onSave={async (payload) => {
                      await saveKr({ data: payload });
                      toast.success("تمت إضافة النتيجة الرئيسية");
                      await reload();
                    }}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ObjectiveDialog({
  trigger,
  people,
  defaultOwner,
  year,
  quarter,
  canPickOwner,
  initial,
  onSave,
}: {
  trigger: React.ReactNode;
  people: Person[];
  defaultOwner: string;
  year: number;
  quarter: number;
  canPickOwner: boolean;
  initial?: Objective;
  onSave: (payload: {
    title: string;
    description: string | null;
    owner_id: string;
    quarter: number;
    year: number;
    status: "draft" | "active" | "completed" | "cancelled";
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [owner, setOwner] = useState(defaultOwner);
  const [status, setStatus] = useState<"draft" | "active" | "completed" | "cancelled">(
    initial?.status ?? "active"
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && initial) {
      setTitle(initial.title);
      setDescription(initial.description ?? "");
      setOwner(initial.owner_id);
      setStatus(initial.status);
    }
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="text-right" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-display">{initial ? "تعديل الهدف" : "هدف جديد"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">عنوان الهدف</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: رفع رضا العملاء وتوسيع الشراكات"
              className="text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">الوصف والتفاصيل</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="text-xs"
            />
          </div>
          {canPickOwner && (
            <div className="space-y-1.5">
              <Label className="text-xs">المسؤول عن الهدف</Label>
              <Select value={owner} onValueChange={setOwner}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="اختر المسؤول" />
                </SelectTrigger>
                <SelectContent>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">حالة الهدف</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-xs">
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full text-xs"
            disabled={saving || title.trim().length < 2 || !owner}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({
                  title: title.trim(),
                  description: description.trim() || null,
                  owner_id: owner,
                  quarter,
                  year,
                  status,
                });
                setOpen(false);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "تعذر الحفظ");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
            {initial ? "حفظ التعديلات" : "إنشاء الهدف"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function KrDialog({
  objectiveId,
  onSave,
}: {
  objectiveId: string;
  onSave: (payload: {
    objective_id: string;
    title: string;
    start_value: number;
    current_value: number;
    target_value: number;
    unit: "number" | "percent" | "currency";
    status: "on_track" | "at_risk" | "off_track" | "done";
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(0);
  const [target, setTarget] = useState(100);
  const [unit, setUnit] = useState<"number" | "percent" | "currency">("percent");
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          <Plus className="h-3.5 w-3.5" /> نتيجة رئيسية
        </Button>
      </DialogTrigger>
      <DialogContent className="text-right" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-display">نتيجة رئيسية جديدة</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">عنوان النتيجة (Key Result)</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: زيادة عدد العملاء الجدد بنسبة 25%"
              className="text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">القيمة الابتدائية</Label>
              <Input
                type="number"
                value={start}
                onChange={(e) => setStart(Number(e.target.value))}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">القيمة المستهدفة</Label>
              <Input
                type="number"
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
                className="text-xs"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">وحدة القياس</Label>
            <Select value={unit} onValueChange={(v) => setUnit(v as typeof unit)}>
              <SelectTrigger className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent" className="text-xs">نسبة مئوية (%)</SelectItem>
                <SelectItem value="number" className="text-xs">عدد (رقم)</SelectItem>
                <SelectItem value="currency" className="text-xs">مبلغ مالي</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full text-xs"
            disabled={saving || title.trim().length < 2}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({
                  objective_id: objectiveId,
                  title: title.trim(),
                  start_value: start,
                  current_value: start,
                  target_value: target,
                  unit,
                  status: "on_track",
                });
                setTitle("");
                setOpen(false);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "تعذر الحفظ");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
            إضافة النتيجة الرئيسية
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
