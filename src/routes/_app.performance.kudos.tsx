import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Award, Loader2, Plus, Trash2, Heart, Zap, Star, Shield,
  Search, Users, Download, Filter, Trophy,
} from "lucide-react";
import { listKudos, sendKudos, deleteKudos, listPeopleLite } from "@/lib/performance.functions";
import { exportToExcel } from "@/lib/export-utils";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

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

const CATEGORIES: { value: string; label: string; icon: React.ElementType; color: string; bg: string }[] = [
  { value: "teamwork",   label: "روح الفريق",         icon: Users,  color: "text-blue-600",    bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800" },
  { value: "ownership",  label: "المبادرة",            icon: Shield, color: "text-purple-600",  bg: "bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:border-purple-800" },
  { value: "innovation", label: "الابتكار",            icon: Zap,    color: "text-amber-600",   bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800" },
  { value: "quality",    label: "جودة العمل",          icon: Star,   color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800" },
  { value: "support",    label: "المساندة",             icon: Heart,  color: "text-rose-600",    bg: "bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800" },
];
const catMeta = (v: string) => CATEGORIES.find((c) => c.value === v) ?? CATEGORIES[0];
const catLabel = (v: string) => catMeta(v).label;

function KudosPage() {
  const fetchKudos = useServerFn(listKudos);
  const fetchPeople = useServerFn(listPeopleLite);
  const send = useServerFn(sendKudos);
  const remove = useServerFn(deleteKudos);

  const [items, setItems] = useState<Kudo[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  const reload = async () => setItems((await fetchKudos({})) as Kudo[]);

  useEffect(() => {
    reload().catch((e) => toast.error(e?.message ?? "تعذر التحميل"));
    fetchPeople({}).then((p) => setPeople(p as Person[])).catch(() => void 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((k) => {
      if (catFilter !== "all" && k.category !== catFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!k.from_name.toLowerCase().includes(q) && !k.to_name.toLowerCase().includes(q) && !k.message.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, catFilter, search]);

  const leaderboard = useMemo(() => {
    if (!items) return [];
    const map = new Map<string, number>();
    items.forEach((k) => map.set(k.to_name, (map.get(k.to_name) ?? 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [items]);

  const exportKudos = () => {
    exportToExcel(
      (items ?? []).map((k) => ({
        "المُرسِل": k.from_name,
        "المُستَقبِل": k.to_name,
        "الفئة": catMeta(k.category).label,
        "الرسالة": k.message,
        "عام": k.is_public ? "نعم" : "لا",
        "التاريخ": format(new Date(k.created_at), "yyyy-MM-dd HH:mm"),
      })),
      `kudos-${format(new Date(), "yyyy-MM-dd")}`,
      "التقدير"
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <span className="font-semibold text-lg">لوحة التقدير</span>
          {items !== null && <Badge variant="secondary">{items.length} تقدير</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportKudos} disabled={!items?.length}>
            <Download className="h-4 w-4 ms-1" /> تصدير
          </Button>
          <KudosDialog
            people={people}
            onSend={async (payload) => {
              await send({ data: payload });
              toast.success("تم إرسال التقدير 🎉");
              await reload();
            }}
          />
        </div>
      </div>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Award className="h-5 w-5 text-amber-500" />
            <h2 className="font-semibold">الأكثر تقديرًا</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {leaderboard.map(([name, count], idx) => (
              <div key={name} className="flex items-center gap-2 rounded-xl border px-4 py-2.5 bg-card shadow-sm">
                <span className={`text-lg font-bold ${idx === 0 ? "text-amber-500" : idx === 1 ? "text-slate-400" : idx === 2 ? "text-amber-700" : "text-muted-foreground"}`}>
                  {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                </span>
                <div>
                  <div className="font-medium text-sm">{name}</div>
                  <div className="text-xs text-muted-foreground">{count} تقدير</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Category quick stats */}
      {items && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon as React.ElementType<{ className?: string }>;
            const cnt = items.filter((k) => k.category === cat.value).length;
            return (
              <button
                key={cat.value}
                onClick={() => setCatFilter(catFilter === cat.value ? "all" : cat.value)}
                className={`rounded-xl border p-3 text-start transition-all hover:shadow-sm ${
                  catFilter === cat.value ? cat.bg + " ring-2 ring-primary/30" : "bg-card border-border"
                }`}
              >
                <Icon className={`h-5 w-5 mb-2 ${cat.color}`} />
                <div className="text-lg font-bold">{cnt}</div>
                <div className="text-xs text-muted-foreground truncate">{cat.label}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="ابحث في التقديرات..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="sm:w-[200px]">
            <Filter className="h-4 w-4 ms-1 text-muted-foreground" />
            <SelectValue placeholder="الفئة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الفئات</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {items === null ? (
        <Card className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          <Award className="h-10 w-10 mx-auto mb-3 opacity-30" />
          {items.length === 0 ? "لا توجد رسائل تقدير بعد — كن أول من يرسل واحدة." : "لا توجد نتائج للفلاتر الحالية."}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((k) => {
            const meta = catMeta(k.category);
            const Icon = meta.icon as React.ElementType<{ className?: string }>;
            return (
              <Card key={k.id} className={`p-4 border transition-all hover:shadow-md ${meta.bg}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-background/60">
                      <Icon className={`h-5 w-5 ${meta.color}`} />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-sm">
                        <span className="font-semibold">{k.from_name}</span>
                        <span className="text-muted-foreground text-xs">→</span>
                        <span className="font-semibold">{k.to_name}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] py-0">{meta.label}</Badge>
                    </div>
                  </div>
                  {k.mine && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                      onClick={async () => {
                        try { await remove({ data: { id: k.id } }); toast.success("تم الحذف"); await reload(); }
                        catch (e) { toast.error(e instanceof Error ? e.message : "تعذر الحذف"); }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
                <p className="text-sm mt-3 text-foreground/80 leading-relaxed">{k.message}</p>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/40">
                  <span className="text-xs text-muted-foreground">{format(new Date(k.created_at), "d MMM yyyy", { locale: ar })}</span>
                  {!k.is_public && <Badge variant="secondary" className="text-[10px] py-0">خاص</Badge>}
                </div>
              </Card>
            );
          })}
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

  const selectedMeta = catMeta(category);
  const SelIcon = selectedMeta.icon as React.ElementType<{ className?: string }>;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 ms-1.5" /> إرسال تقدير</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            إرسال تقدير لزميل
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>إلى *</Label>
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger><SelectValue placeholder="اختر زميلًا" /></SelectTrigger>
              <SelectContent>
                {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>الفئة *</Label>
            <div className="grid grid-cols-5 gap-1.5">
              {CATEGORIES.map((cat) => {
                const CatIcon = cat.icon as React.ElementType<{ className?: string }>;
                const active = category === cat.value;
                return (
                  <button key={cat.value} type="button"
                    onClick={() => setCategory(cat.value as typeof category)}
                    className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2 text-[10px] font-medium transition-all ${
                      active ? `border-primary ${cat.bg}` : "border-border hover:border-primary/50"
                    }`}
                  >
                    <CatIcon className={`h-4 w-4 ${active ? cat.color : "text-muted-foreground"}`} />
                    <span className="truncate w-full text-center leading-tight">{cat.label.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>
            <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${selectedMeta.bg}`}>
              <SelIcon className={`h-4 w-4 ${selectedMeta.color}`} />
              <span className="font-medium">{selectedMeta.label}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>الرسالة * <span className="text-xs text-muted-foreground">({message.length}/300)</span></Label>
            <Textarea rows={3} value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 300))}
              placeholder="اكتب رسالة تقدير صادقة ومحددة..." />
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <div>
              <div className="text-sm font-medium">إظهار التقدير للجميع</div>
              <div className="text-xs text-muted-foreground">سيظهر للفريق كله في لوحة التقدير</div>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>

          <Button className="w-full" disabled={saving || !to || message.trim().length < 2}
            onClick={async () => {
              setSaving(true);
              try {
                await onSend({ to_user_id: to, category, message: message.trim(), is_public: isPublic });
                setMessage(""); setTo(""); setOpen(false);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "تعذر الإرسال");
              } finally { setSaving(false); }
            }}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
            إرسال التقدير 🎉
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
