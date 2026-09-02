import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Target, Trash2, Pencil } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  listObjectives,
  upsertObjective,
  deleteObjective,
  upsertKeyResult,
  deleteKeyResult,
  listPeopleLite,
} from "@/lib/performance.functions";

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

  const reload = async () => {
    const data = (await fetchObjectives({
      data: { year, quarter, owner_id: scope === "mine" ? (user?.id ?? null) : null },
    })) as Objective[];
    setItems(data);
  };

  useEffect(() => {
    setItems(null);
    reload().catch((e) => toast.error(e?.message ?? "تعذر التحميل"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, quarter, scope]);

  useEffect(() => {
    fetchPeople({}).then((p) => setPeople(p as Person[])).catch(() => void 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="space-y-5">
      <Card className="p-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label>السنة</Label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>الربع</Label>
          <Select value={String(quarter)} onValueChange={(v) => setQuarter(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((q) => <SelectItem key={q} value={String(q)}>الربع {q}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>النطاق</Label>
          <Select value={scope} onValueChange={(v) => setScope(v as "all" | "mine")}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأهداف</SelectItem>
              <SelectItem value="mine">أهدافي</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="ms-auto">
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
                toast.success("تم الحفظ");
                await reload();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "تعذر الحفظ");
              } finally {
                setBusy(false);
              }
            }}
            trigger={
              <Button disabled={busy}>
                <Plus className="h-4 w-4 ml-1" /> هدف جديد
              </Button>
            }
          />
        </div>
      </Card>

      {items === null ? (
        <Card className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></Card>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
          لا توجد أهداف في هذه الفترة بعد.
        </Card>
      ) : (
        <div className="grid gap-4">
          {items.map((o) => (
            <Card key={o.id} className="p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{o.title}</h3>
                    <Badge variant={o.status === "active" ? "default" : "secondary"}>{STATUS_LABEL[o.status]}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    المسؤول: {o.owner_name} · الربع {o.quarter} / {o.year}
                  </div>
                  {o.description && <p className="text-sm text-muted-foreground">{o.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <ObjectiveDialog
                    people={people}
                    defaultOwner={o.owner_id}
                    year={o.year}
                    quarter={o.quarter}
                    canPickOwner={isManager}
                    initial={o}
                    onSave={async (payload) => {
                      await saveObjective({ data: { ...payload, id: o.id } });
                      toast.success("تم التحديث");
                      await reload();
                    }}
                    trigger={<Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      await removeObjective({ data: { id: o.id } });
                      toast.success("تم الحذف");
                      await reload();
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>نسبة الإنجاز</span>
                  <span>{Number(o.progress).toFixed(0)}%</span>
                </div>
                <Progress value={Number(o.progress)} />
              </div>

              <div className="rounded-md border divide-y">
                {o.key_results.length === 0 && (
                  <div className="p-3 text-sm text-muted-foreground">لا توجد نتائج رئيسية بعد.</div>
                )}
                {o.key_results.map((kr) => (
                  <div key={kr.id} className="p-3 flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate">{kr.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {kr.start_value} ← {kr.target_value} {kr.unit === "percent" ? "%" : ""} · {KR_STATUS_LABEL[kr.status]}
                      </div>
                    </div>
                    <Input
                      type="number"
                      className="w-28"
                      defaultValue={kr.current_value}
                      onBlur={async (e) => {
                        const v = Number(e.target.value);
                        if (v === kr.current_value) return;
                        await saveKr({ data: { ...kr, current_value: v } });
                        await reload();
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        await removeKr({ data: { id: kr.id } });
                        await reload();
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              <KrDialog
                objectiveId={o.id}
                onSave={async (payload) => {
                  await saveKr({ data: payload });
                  toast.success("تمت إضافة النتيجة");
                  await reload();
                }}
              />
            </Card>
          ))}
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
  const [status, setStatus] = useState<"draft" | "active" | "completed" | "cancelled">(initial?.status ?? "active");
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "تعديل الهدف" : "هدف جديد"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>عنوان الهدف</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: رفع رضا العملاء" />
          </div>
          <div className="space-y-1.5">
            <Label>الوصف</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          {canPickOwner && (
            <div className="space-y-1.5">
              <Label>المسؤول</Label>
              <Select value={owner} onValueChange={setOwner}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>الحالة</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full"
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
            {saving && <Loader2 className="h-4 w-4 animate-spin ml-1" />} حفظ
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
        <Button variant="outline" size="sm"><Plus className="h-4 w-4 ml-1" /> نتيجة رئيسية</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>نتيجة رئيسية جديدة</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>العنوان</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>القيمة الابتدائية</Label>
              <Input type="number" value={start} onChange={(e) => setStart(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>القيمة المستهدفة</Label>
              <Input type="number" value={target} onChange={(e) => setTarget(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>وحدة القياس</Label>
            <Select value={unit} onValueChange={(v) => setUnit(v as typeof unit)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">نسبة مئوية</SelectItem>
                <SelectItem value="number">عدد</SelectItem>
                <SelectItem value="currency">مبلغ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full"
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
            {saving && <Loader2 className="h-4 w-4 animate-spin ml-1" />} إضافة
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
