import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Bot, Plus, Play, Trash2, Pencil, CheckCircle2, AlertCircle, Clock } from "lucide-react";

export const Route = createFileRoute("/_app/settings/automation")({
  component: AutomationPage,
});

interface Rule {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  action_type: string;
  action_config: Record<string, unknown>;
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
}

interface Log {
  id: string;
  rule_id: string | null;
  status: string;
  affected_count: number;
  message: string | null;
  created_at: string;
}

const TRIGGER_LABELS: Record<string, string> = {
  task_overdue: "مهمة متأخرة",
  task_due_soon: "موعد مهمة قريب",
  contract_expiring: "عقد سينتهي قريباً",
  task_assigned: "تم إسناد مهمة",
  task_completed: "تم إنجاز مهمة",
  daily_summary: "ملخص يومي",
};

const ACTION_LABELS: Record<string, string> = {
  notify_user: "تنبيه للموظف",
  notify_manager: "تنبيه للمدير المباشر",
  notify_admins: "تنبيه للإدارة",
  create_task: "إنشاء مهمة",
  send_email: "إرسال إيميل",
};

function AutomationPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("task_overdue");
  const [triggerHours, setTriggerHours] = useState(24);
  const [triggerDays, setTriggerDays] = useState(30);
  const [actionType, setActionType] = useState("notify_user");
  const [isActive, setIsActive] = useState(true);

  const load = async () => {
    setLoading(true);
    const [r, l] = await Promise.all([
      supabase.from("automation_rules").select("*").order("created_at", { ascending: false }),
      supabase.from("automation_logs").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    if (r.error) toast.error(r.error.message);
    if (l.error) toast.error(l.error.message);
    setRules((r.data ?? []) as unknown as Rule[]);
    setLogs((l.data ?? []) as unknown as Log[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setName(""); setDescription(""); setTriggerType("task_overdue");
    setTriggerHours(24); setTriggerDays(30); setActionType("notify_user");
    setIsActive(true); setEditing(null);
  };

  const openEdit = (rule: Rule) => {
    setEditing(rule);
    setName(rule.name);
    setDescription(rule.description ?? "");
    setTriggerType(rule.trigger_type);
    setTriggerHours(Number((rule.trigger_config as { hours?: number })?.hours ?? 24));
    setTriggerDays(Number((rule.trigger_config as { days?: number })?.days ?? 30));
    setActionType(rule.action_type);
    setIsActive(rule.is_active);
    setOpen(true);
  };

  const save = async () => {
    if (!name.trim()) { toast.error("الاسم مطلوب"); return; }
    const trigger_config: Record<string, number> = {};
    if (triggerType === "task_due_soon") trigger_config.hours = triggerHours;
    if (triggerType === "contract_expiring") trigger_config.days = triggerDays;

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      trigger_type: triggerType,
      trigger_config,
      action_type: actionType,
      action_config: {},
      is_active: isActive,
    };

    const { error } = editing
      ? await supabase.from("automation_rules").update(payload).eq("id", editing.id)
      : await supabase.from("automation_rules").insert({ ...payload, created_by: (await supabase.auth.getUser()).data.user?.id });
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "تم التحديث" : "تم إنشاء القاعدة");
    setOpen(false);
    resetForm();
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذه القاعدة؟")) return;
    const { error } = await supabase.from("automation_rules").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("تم الحذف"); load(); }
  };

  const toggle = async (rule: Rule) => {
    const { error } = await supabase.from("automation_rules").update({ is_active: !rule.is_active }).eq("id", rule.id);
    if (error) toast.error(error.message);
    else load();
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/public/hooks/automation-tick", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "فشل التشغيل");
      toast.success(`تم تشغيل ${json.processed} قاعدة`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-semibold">محرك الأتمتة</div>
              <div className="text-sm text-muted-foreground mt-0.5">قواعد تلقائية لتنبيه الفريق وإدارة المهام والعقود.</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={runNow} disabled={running} className="gap-1.5">
              <Play className="h-4 w-4" /> {running ? "جارٍ..." : "تشغيل الآن"}
            </Button>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> قاعدة جديدة</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editing ? "تعديل القاعدة" : "قاعدة أتمتة جديدة"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>الاسم</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: تنبيه المهام المتأخرة" />
                  </div>
                  <div>
                    <Label>الوصف (اختياري)</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                  </div>
                  <div>
                    <Label>المُحفِّز</Label>
                    <Select value={triggerType} onValueChange={setTriggerType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TRIGGER_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {triggerType === "task_due_soon" && (
                    <div>
                      <Label>قبل كم ساعة من الموعد؟</Label>
                      <Input type="number" min={1} value={triggerHours} onChange={(e) => setTriggerHours(Number(e.target.value))} />
                    </div>
                  )}
                  {triggerType === "contract_expiring" && (
                    <div>
                      <Label>قبل كم يوماً من انتهاء العقد؟</Label>
                      <Input type="number" min={1} value={triggerDays} onChange={(e) => setTriggerDays(Number(e.target.value))} />
                    </div>
                  )}
                  <div>
                    <Label>الإجراء</Label>
                    <Select value={actionType} onValueChange={setActionType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(ACTION_LABELS).filter(([v]) => ["notify_user","notify_manager","notify_admins"].includes(v)).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>مفعّلة</Label>
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                  <Button onClick={save}>حفظ</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </Card>

      <Card>
        <div className="px-5 py-3 border-b font-semibold">القواعد</div>
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">جارٍ التحميل...</div>
        ) : rules.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            لا توجد قواعد بعد. أنشئ قاعدتك الأولى لبدء الأتمتة.
          </div>
        ) : (
          <div className="divide-y">
            {rules.map((r) => (
              <div key={r.id} className="px-5 py-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{r.name}</span>
                    <Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "مفعّلة" : "متوقفة"}</Badge>
                    <Badge variant="outline">{TRIGGER_LABELS[r.trigger_type] ?? r.trigger_type}</Badge>
                    <Badge variant="outline">→ {ACTION_LABELS[r.action_type] ?? r.action_type}</Badge>
                  </div>
                  {r.description && <div className="text-sm text-muted-foreground mt-1">{r.description}</div>}
                  {r.last_run_at && (
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> آخر تشغيل: {new Date(r.last_run_at).toLocaleString("ar-EG")}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={r.is_active} onCheckedChange={() => toggle(r)} />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="px-5 py-3 border-b font-semibold">سجل التنفيذ (آخر 20)</div>
        {logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">لا توجد سجلات بعد.</div>
        ) : (
          <div className="divide-y text-sm">
            {logs.map((l) => (
              <div key={l.id} className="px-5 py-3 flex items-center gap-3">
                {l.status === "success" ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="truncate">{l.message ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("ar-EG")}</div>
                </div>
                <Badge variant="secondary">{l.affected_count}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
