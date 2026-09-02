import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Award, Loader2, Plus, Trash2 } from "lucide-react";
import { listKudos, sendKudos, deleteKudos, listPeopleLite } from "@/lib/performance.functions";

export const Route = createFileRoute("/_app/performance/kudos")({
  component: KudosPage,
});

type Kudo = {
  id: string;
  from_name: string;
  to_name: string;
  to_user_id: string;
  category: string;
  message: string;
  is_public: boolean;
  created_at: string;
  mine: boolean;
};
type Person = { id: string; full_name: string };

const CATEGORIES: { value: string; label: string }[] = [
  { value: "teamwork", label: "روح الفريق" },
  { value: "ownership", label: "المبادرة والمسؤولية" },
  { value: "innovation", label: "الابتكار" },
  { value: "quality", label: "جودة العمل" },
  { value: "support", label: "المساندة" },
];
const catLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;

function KudosPage() {
  const fetchKudos = useServerFn(listKudos);
  const fetchPeople = useServerFn(listPeopleLite);
  const send = useServerFn(sendKudos);
  const remove = useServerFn(deleteKudos);

  const [items, setItems] = useState<Kudo[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);

  const reload = async () => setItems((await fetchKudos({})) as Kudo[]);

  useEffect(() => {
    reload().catch((e) => toast.error(e?.message ?? "تعذر التحميل"));
    fetchPeople({}).then((p) => setPeople(p as Person[])).catch(() => void 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leaderboard = Object.entries(
    (items ?? []).reduce<Record<string, number>>((acc, k) => {
      acc[k.to_name] = (acc[k.to_name] ?? 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <KudosDialog
          people={people}
          onSend={async (payload) => {
            await send({ data: payload });
            toast.success("تم إرسال التقدير");
            await reload();
          }}
        />
      </div>

      {leaderboard.length > 0 && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">الأكثر تقديرًا</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {leaderboard.map(([name, count]) => (
              <Badge key={name} variant="secondary" className="gap-1">
                {name} · {count}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {items === null ? (
        <Card className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></Card>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          <Award className="h-8 w-8 mx-auto mb-2 opacity-50" />
          لا توجد رسائل تقدير بعد — كن أول من يرسل واحدة.
        </Card>
      ) : (
        <div className="grid gap-3">
          {items.map((k) => (
            <Card key={k.id} className="p-4 flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{k.from_name}</span>
                  <span className="text-muted-foreground">قدّر</span>
                  <span className="font-medium">{k.to_name}</span>
                  <Badge variant="outline">{catLabel(k.category)}</Badge>
                  {!k.is_public && <Badge variant="secondary">خاص</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{k.message}</p>
                <div className="text-xs text-muted-foreground">
                  {new Date(k.created_at).toLocaleString("ar-EG")}
                </div>
              </div>
              {k.mine && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    await remove({ data: { id: k.id } });
                    await reload();
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function KudosDialog({
  people,
  onSend,
}: {
  people: Person[];
  onSend: (payload: {
    to_user_id: string;
    category: "teamwork" | "ownership" | "innovation" | "quality" | "support";
    message: string;
    is_public: boolean;
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [category, setCategory] = useState<"teamwork" | "ownership" | "innovation" | "quality" | "support">("teamwork");
  const [message, setMessage] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 ml-1" /> إرسال تقدير</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>إرسال تقدير</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>إلى</Label>
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger><SelectValue placeholder="اختر زميلًا" /></SelectTrigger>
              <SelectContent>
                {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>الفئة</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>الرسالة</Label>
            <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="text-sm">إظهار التقدير للجميع</div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
          <Button
            className="w-full"
            disabled={saving || !to || message.trim().length < 2}
            onClick={async () => {
              setSaving(true);
              try {
                await onSend({ to_user_id: to, category, message: message.trim(), is_public: isPublic });
                setMessage("");
                setOpen(false);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "تعذر الإرسال");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin ml-1" />} إرسال
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
