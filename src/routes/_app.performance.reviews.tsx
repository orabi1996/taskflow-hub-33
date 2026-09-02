import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { ClipboardCheck, Loader2, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listReviews, upsertReview, deleteReview, listPeopleLite } from "@/lib/performance.functions";

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
  const { roles } = useAuth();
  const canReview = roles.some((r) => ["admin", "general_manager", "manager"].includes(r));

  const fetchReviews = useServerFn(listReviews);
  const fetchPeople = useServerFn(listPeopleLite);
  const save = useServerFn(upsertReview);
  const remove = useServerFn(deleteReview);

  const [items, setItems] = useState<Review[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);

  const reload = async () => setItems((await fetchReviews({})) as Review[]);

  useEffect(() => {
    reload().catch((e) => toast.error(e?.message ?? "تعذر التحميل"));
    fetchPeople({}).then((p) => setPeople(p as Person[])).catch(() => void 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      {canReview && (
        <div className="flex justify-end">
          <ReviewDialog
            people={people}
            onSave={async (payload) => {
              await save({ data: payload });
              toast.success("تم حفظ التقييم");
              await reload();
            }}
          />
        </div>
      )}

      {items === null ? (
        <Card className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></Card>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
          لا توجد تقييمات بعد.
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((r) => (
            <Card key={r.id} className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{r.employee_name}</div>
                  <div className="text-xs text-muted-foreground">
                    المُقيِّم: {r.reviewer_name} · {r.period_start} ← {r.period_end}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={r.status === "acknowledged" ? "default" : "secondary"}>{STATUS_LABEL[r.status]}</Badge>
                  <Badge variant="outline">{avg(r)} / 5</Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <ScoreRow label="الإنجاز" value={r.score_delivery} />
                <ScoreRow label="الجودة" value={r.score_quality} />
                <ScoreRow label="التعاون" value={r.score_collaboration} />
                <ScoreRow label="الالتزام بالمواعيد" value={r.score_timeliness} />
              </div>

              {r.strengths && <p className="text-sm"><span className="text-muted-foreground">نقاط القوة: </span>{r.strengths}</p>}
              {r.improvements && <p className="text-sm"><span className="text-muted-foreground">فرص التطوير: </span>{r.improvements}</p>}

              {canReview && (
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      try {
                        await remove({ data: { id: r.id } });
                        toast.success("تم الحذف");
                        await reload();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "تعذر الحذف");
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between rounded-md border px-2 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? "—"}</span>
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
