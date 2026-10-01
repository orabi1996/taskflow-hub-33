import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
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
import { ClipboardCheck, Loader2, Plus, Trash2, Download, Star, CheckCircle2, ThumbsUp } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listReviews, upsertReview, deleteReview, listPeopleLite } from "@/lib/performance.functions";
import { exportToExcel } from "@/lib/export-utils";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export const Route = createFileRoute("/_app/performance/reviews")({
  component: ReviewsPage,
});

type Review = {
  id: string;
  employee_id: string;
  reviewer_id: string;
  employee_name: string;
  reviewer_name: string;
  period_start: string;
  period_end: string;
  score_delivery: number | null;
  score_quality: number | null;
  score_collaboration: number | null;
  score_timeliness: number | null;
  strengths: string | null;
  improvements: string | null;
  notes: string | null;
  status: "draft" | "submitted" | "acknowledged";
};
type Person = { id: string; full_name: string };

const STATUS_LABEL: Record<string, string> = {
  draft: "مسودة",
  submitted: "مُرسل",
  acknowledged: "معتمد",
};

const avg = (r: Review) => {
  const s = [r.score_delivery, r.score_quality, r.score_collaboration, r.score_timeliness].filter(
    (x): x is number => typeof x === "number"
  );
  return s.length ? (s.reduce((a, b) => a + b, 0) / s.length).toFixed(1) : "—";
};

function ReviewsPage() {
  const { user, roles } = useAuth();
  const canReview = roles.some((r) => ["admin", "general_manager", "manager"].includes(r));


  const fetchReviews = useServerFn(listReviews);
  const fetchPeople = useServerFn(listPeopleLite);
  const save = useServerFn(upsertReview);
  const remove = useServerFn(deleteReview);

  const [items, setItems] = useState<Review[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");

  const reload = async () => setItems((await fetchReviews({})) as Review[]);

  useEffect(() => {
    reload().catch((e) => toast.error(e?.message ?? "تعذر التحميل"));
    fetchPeople({}).then((p) => setPeople(p as Person[])).catch(() => void 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((r) => statusFilter === "all" || r.status === statusFilter);
  }, [items, statusFilter]);

  const exportReviews = () => {
    exportToExcel(
      (items ?? []).map((r) => ({
        "الموظف": r.employee_name,
        "المُقيّم": r.reviewer_name,
        "من تاريخ": r.period_start,
        "إلى تاريخ": r.period_end,
        "الإنجاز": r.score_delivery ?? "",
        "الجودة": r.score_quality ?? "",
        "التعاون": r.score_collaboration ?? "",
        "الالتزام": r.score_timeliness ?? "",
        "المتوسط": avg(r),
        "الحالة": STATUS_LABEL[r.status],
      })),
      `reviews-${format(new Date(), "yyyy-MM-dd")}`,
      "تقييمات الأداء"
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <span className="font-semibold text-lg">تقييمات الأداء</span>
          {items !== null && <Badge variant="secondary">{items.length} تقييم</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportReviews} disabled={!items?.length}>
            <Download className="h-4 w-4 ms-1" /> تصدير
          </Button>
          {canReview && (
            <ReviewDialog
              people={people}
              onSave={async (payload) => {
                await save({ data: payload });
                toast.success("تم حفظ التقييم");
                await reload();
              }}
            />
          )}
        </div>
      </div>

      {items === null ? (
        <Card className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          <ClipboardCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
          {items.length === 0 ? "لا توجد تقييمات بعد." : "لا توجد تقييمات بهذه الحالة."}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((r) => (
            <Card key={r.id} className="p-5 space-y-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-base">{r.employee_name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    المُقيّم: {r.reviewer_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(r.period_start), "d MMM yyyy", { locale: ar })} ← {format(new Date(r.period_end), "d MMM yyyy", { locale: ar })}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Badge variant={r.status === "acknowledged" ? "default" : r.status === "submitted" ? "secondary" : "outline"}>
                    {r.status === "acknowledged" ? <><CheckCircle2 className="h-3 w-3 me-1" />{STATUS_LABEL[r.status]}</> : STATUS_LABEL[r.status]}
                  </Badge>
                  <div className="text-lg font-bold text-primary">{avg(r)}<span className="text-xs text-muted-foreground font-normal">/5</span></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <StarScoreRow label="الإنجاز" value={r.score_delivery} />
                <StarScoreRow label="الجودة" value={r.score_quality} />
                <StarScoreRow label="التعاون" value={r.score_collaboration} />
                <StarScoreRow label="الالتزام" value={r.score_timeliness} />
              </div>

              {(r.strengths || r.improvements) && (
                <div className="space-y-1.5 pt-2 border-t">
                  {r.strengths && <p className="text-xs"><span className="text-muted-foreground font-medium">نقاط القوة: </span>{r.strengths}</p>}
                  {r.improvements && <p className="text-xs"><span className="text-muted-foreground font-medium">فرص التطوير: </span>{r.improvements}</p>}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                {/* Employee can acknowledge their own review */}
                {r.status === "submitted" && r.employee_id === user?.id && (
                  <Button size="sm" variant="outline" className="gap-1.5 text-success border-success/40 hover:bg-success/10"
                    onClick={async () => {
                      try {
                        await save({ data: { ...r, status: "acknowledged" } });
                        toast.success("تم اعتماد التقييم");
                        await reload();
                      } catch (e) { toast.error(e instanceof Error ? e.message : "تعذر"); }
                    }}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    اعتماد التقييم
                  </Button>
                )}
                <div className="ms-auto">
                  {canReview && (
                    <Button variant="ghost" size="icon" className="h-8 w-8"
                      onClick={async () => {
                        try {
                          await remove({ data: { id: r.id } });
                          toast.success("تم الحذف");
                          await reload();
                        } catch (e) { toast.error(e instanceof Error ? e.message : "تعذر الحذف"); }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


function StarScoreRow({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between rounded-md border px-2 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={`h-3 w-3 ${
              value !== null && n <= value
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function ReviewDialog({
  people,
  onSave,
}: {
  people: Person[];
  onSave: (payload: {
    employee_id: string;
    period_start: string;
    period_end: string;
    score_delivery: number | null;
    score_quality: number | null;
    score_collaboration: number | null;
    score_timeliness: number | null;
    strengths: string | null;
    improvements: string | null;
    notes: string | null;
    status: "draft" | "submitted" | "acknowledged";
  }) => Promise<void>;
}) {
  const today = new Date();
  const firstOfQuarter = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const [open, setOpen] = useState(false);
  const [employee, setEmployee] = useState("");
  const [start, setStart] = useState(iso(firstOfQuarter));
  const [end, setEnd] = useState(iso(today));
  const [scores, setScores] = useState({ delivery: 3, quality: 3, collaboration: 3, timeliness: 3 });
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [status, setStatus] = useState<"draft" | "submitted" | "acknowledged">("submitted");
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 ml-1" /> تقييم جديد</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>تقييم أداء</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>الموظف</Label>
            <Select value={employee} onValueChange={setEmployee}>
              <SelectTrigger><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
              <SelectContent>
                {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>من تاريخ</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>إلى تاريخ</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {([
              ["delivery", "الإنجاز"],
              ["quality", "الجودة"],
              ["collaboration", "التعاون"],
              ["timeliness", "الالتزام بالمواعيد"],
            ] as const).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label>{label}</Label>
                <Select
                  value={String(scores[key])}
                  onValueChange={(v) => setScores((s) => ({ ...s, [key]: Number(v) }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label>نقاط القوة</Label>
            <Textarea rows={2} value={strengths} onChange={(e) => setStrengths(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>فرص التطوير</Label>
            <Textarea rows={2} value={improvements} onChange={(e) => setImprovements(e.target.value)} />
          </div>
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
            disabled={saving || !employee}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({
                  employee_id: employee,
                  period_start: start,
                  period_end: end,
                  score_delivery: scores.delivery,
                  score_quality: scores.quality,
                  score_collaboration: scores.collaboration,
                  score_timeliness: scores.timeliness,
                  strengths: strengths.trim() || null,
                  improvements: improvements.trim() || null,
                  notes: null,
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
