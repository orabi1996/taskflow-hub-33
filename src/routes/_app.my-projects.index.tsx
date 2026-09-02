import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  FolderKanban, Pencil, Loader2, Users, AlertTriangle, Paperclip, Upload, X,
  Globe, FileSignature, Lock, History,
  FolderHeart,
} from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { ar } from "date-fns/locale";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB

export const Route = createFileRoute("/_app/my-projects/")({
  component: MyProjectsPage,
});

type Health = "green" | "yellow" | "red";

interface Project {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  country: string | null;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  secondary_email: string | null;
  secondary_phone: string | null;
  contract_number: string | null;
  contract_value: number | null;
  currency: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  alert_days_before: number;
  health_status: Health;
  notes: string | null;
  owner_id: string | null;
}

interface Attachment {
  id: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

const HEALTH_LABEL: Record<Health, string> = { green: "جيد", yellow: "متوسط", red: "حرج" };
const HEALTH_DOT: Record<Health, string> = {
  green: "bg-emerald-500", yellow: "bg-amber-500", red: "bg-red-500",
};
const HEALTH_BADGE: Record<Health, string> = {
  green: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  yellow: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  red: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
};

function getAlert(p: Project) {
  if (!p.contract_end_date) return { level: "ok" as const, days: null };
  const days = differenceInDays(new Date(p.contract_end_date), new Date());
  if (days < 0) return { level: "expired" as const, days };
  if (days <= (p.alert_days_before ?? 30)) return { level: "soon" as const, days };
  return { level: "ok" as const, days };
}

function MyProjectsPage() {
  const { user, roles } = useAuth();
  const isPrivileged = roles.some((r) => ["admin", "general_manager", "manager"].includes(r));
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<Project | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [history, setHistory] = useState<Array<{ id: string; action: string; field_name: string | null; old_value: string | null; new_value: string | null; created_at: string; changed_by: string | null }>>([]);
  const [activeTab, setActiveTab] = useState<"info" | "contract" | "files" | "history">("info");

  // Owner of currently editing project may always edit contract too
  const canEditContract = !!editing && (isPrivileged || editing.owner_id === user?.id);
  const canEditAttachments = canEditContract;

  // form
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [active, setActive] = useState(true);
  const [country, setCountry] = useState("");
  const [address, setAddress] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [secondaryPhone, setSecondaryPhone] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [contractValue, setContractValue] = useState("");
  const [currency, setCurrency] = useState("SAR");
  const [contractStart, setContractStart] = useState("");
  const [contractEnd, setContractEnd] = useState("");
  const [alertDays, setAlertDays] = useState("30");
  const [health, setHealth] = useState<Health>("green");
  const [notes, setNotes] = useState("");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setProjects((data ?? []) as Project[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const loadAttachments = async (projectId: string) => {
    const { data } = await supabase
      .from("project_attachments")
      .select("id, file_path, file_name, file_size, mime_type, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setAttachments((data ?? []) as Attachment[]);
  };

  const loadHistory = async (projectId: string) => {
    const { data } = await supabase
      .from("project_history" as any)
      .select("id, action, field_name, old_value, new_value, created_at, changed_by")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(100);
    setHistory((data ?? []) as any);
  };

  const openEdit = async (p: Project) => {
    setEditing(p);
    setActiveTab("info");
    setName(p.name);
    setDesc(p.description ?? "");
    setActive(p.is_active);
    setCountry(p.country ?? "");
    setAddress(p.address ?? "");
    setContactEmail(p.contact_email ?? "");
    setContactPhone(p.contact_phone ?? "");
    setSecondaryEmail(p.secondary_email ?? "");
    setSecondaryPhone(p.secondary_phone ?? "");
    setContractNumber(p.contract_number ?? "");
    setContractValue(p.contract_value != null ? String(p.contract_value) : "");
    setCurrency(p.currency ?? "SAR");
    setContractStart(p.contract_start_date ?? "");
    setContractEnd(p.contract_end_date ?? "");
    setAlertDays(String(p.alert_days_before ?? 30));
    setHealth(p.health_status ?? "green");
    setNotes(p.notes ?? "");
    setPendingFiles([]);
    await Promise.all([loadAttachments(p.id), loadHistory(p.id)]);
  };

  const closeDialog = () => {
    setEditing(null);
    setAttachments([]);
    setPendingFiles([]);
    setHistory([]);
  };

  const onPickFiles = (files: File[]) => {
    const valid: File[] = [];
    for (const f of files) {
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`${f.name}: الحجم يتجاوز 25MB`);
        continue;
      }
      valid.push(f);
    }
    setPendingFiles(valid);
  };

  const uploadFiles = async (projectId: string, files: File[]) => {
    if (!user || files.length === 0) return;
    for (const f of files) {
      const path = `${projectId}/${Date.now()}-${f.name}`;
      const { error: upErr } = await supabase.storage.from("project-attachments").upload(path, f);
      if (upErr) { toast.error(`فشل رفع ${f.name}: ${upErr.message}`); continue; }
      const { error: dbErr } = await supabase.from("project_attachments").insert({
        project_id: projectId, file_path: path, file_name: f.name,
        file_size: f.size, mime_type: f.type || null, uploaded_by: user.id,
      });
      if (dbErr) toast.error(dbErr.message);
    }
  };


  const downloadAtt = async (att: Attachment) => {
    const { data, error } = await supabase.storage.from("project-attachments").createSignedUrl(att.file_path, 60);
    if (error || !data) { toast.error("تعذر تحميل الملف"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const deleteAtt = async (att: Attachment) => {
    if (!editing) return;
    await supabase.storage.from("project-attachments").remove([att.file_path]);
    await supabase.from("project_attachments").delete().eq("id", att.id);
    await loadAttachments(editing.id);
    toast.success("تم حذف المرفق");
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    if (name.trim().length < 2) { toast.error("الاسم قصير جدًا"); return; }
    setSubmitting(true);
    const { error } = await supabase
      .from("projects")
      .update({
        name: name.trim(),
        description: desc.trim() || null,
        is_active: active,
        country: country.trim() || null,
        address: address.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        secondary_email: secondaryEmail.trim() || null,
        secondary_phone: secondaryPhone.trim() || null,
        contract_number: contractNumber.trim() || null,
        contract_value: contractValue.trim() ? Number(contractValue) : null,
        currency: currency.trim() || null,
        contract_start_date: contractStart || null,
        contract_end_date: contractEnd || null,
        alert_days_before: Number(alertDays) || 30,
        health_status: health,
        notes: notes.trim() || null,
      })
      .eq("id", editing.id);
    if (error) { setSubmitting(false); toast.error(error.message); return; }
    if (pendingFiles.length > 0) await uploadFiles(editing.id, pendingFiles);
    setSubmitting(false);
    toast.success("تم تحديث المشروع");
    closeDialog();
    load();
  };

  const alerts = useMemo(
    () => projects.map((p) => ({ p, a: getAlert(p) })).filter((x) => x.a.level !== "ok"),
    [projects]
  );

  const visibleProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) =>
      [p.name, p.description, p.country, p.contract_number, p.contact_email]
        .some((v) => (v ?? "").toString().toLowerCase().includes(q))
    );
  }, [projects, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader title="مشاريعي" description="المشاريع التي تم تعيينك مسؤولاً عنها" icon={FolderHeart} />
        <div className="relative w-full sm:w-80">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث في المشاريع (اسم، دولة، رقم عقد...)"
          />
        </div>
      </div>


      {alerts.length > 0 && (
        <Card className="p-4 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold">تنبيهات العقود ({alerts.length})</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {alerts.map(({ p, a }) => (
              <button
                key={p.id}
                onClick={() => openEdit(p)}
                className="text-start rounded-md border bg-background p-2.5 hover:bg-accent transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{p.name}</span>
                  <Badge variant={a.level === "expired" ? "destructive" : "secondary"} className="shrink-0 text-[10px]">
                    {a.level === "expired" ? `منتهي منذ ${Math.abs(a.days!)} يوم` : `${a.days} يوم`}
                  </Badge>
                </div>
                {p.contract_end_date && (
                  <div className="text-xs text-muted-foreground mt-1">
                    ينتهي: {format(new Date(p.contract_end_date), "d MMM yyyy", { locale: ar })}
                  </div>
                )}
              </button>
            ))}
          </div>
        </Card>
      )}

      {loading ? (
        <div className="text-center text-muted-foreground py-12">جارٍ التحميل...</div>
      ) : visibleProjects.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderKanban className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">
            {projects.length === 0 ? "لا يوجد مشاريع مسندة إليك بعد." : "لا توجد نتائج مطابقة للبحث."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleProjects.map((p) => {

            const a = getAlert(p);
            return (
              <Card key={p.id} className="p-5 hover:shadow-[var(--shadow-elegant)] transition-[var(--transition-smooth)]">
                <div className="flex items-start justify-between">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <FolderKanban className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${HEALTH_DOT[p.health_status]}`} title={HEALTH_LABEL[p.health_status]} />
                    {p.is_active ? <Badge variant="secondary">نشط</Badge> : <Badge variant="outline">معطّل</Badge>}
                  </div>
                </div>
                <h3 className="font-semibold mt-3">{p.name}</h3>
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  <Badge variant="outline" className={`text-[10px] ${HEALTH_BADGE[p.health_status]}`}>
                    {HEALTH_LABEL[p.health_status]}
                  </Badge>
                  {a.level === "expired" && <Badge variant="destructive" className="text-[10px]">عقد منتهي</Badge>}
                  {a.level === "soon" && (
                    <Badge variant="outline" className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                      ينتهي خلال {a.days} يوم
                    </Badge>
                  )}
                </div>
                {p.country && (
                  <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Globe className="h-3 w-3" /> {p.country}
                  </div>
                )}
                {p.contract_number && (
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <FileSignature className="h-3 w-3" /> #{p.contract_number}
                    {p.contract_value != null && <span> • {p.contract_value.toLocaleString()} {p.currency ?? ""}</span>}
                  </div>
                )}
                {p.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{p.description}</p>}
                <div className="mt-4 flex items-center gap-2 pt-3 border-t">
                  <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5 ms-1" /> تعديل
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/my-projects/$projectId/clients" params={{ projectId: p.id }}>
                      <Users className="h-3.5 w-3.5 ms-1" /> العملاء
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              تعديل المشروع
              {!canEditContract && (
                <Badge variant="outline" className="text-[10px]">
                  <Lock className="h-3 w-3 ms-1" /> قراءة جزئية
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="pt-2">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="info">البيانات</TabsTrigger>
              <TabsTrigger value="contract">التعاقد</TabsTrigger>
              <TabsTrigger value="files">المرفقات ({attachments.length})</TabsTrigger>
              <TabsTrigger value="history"><History className="h-3.5 w-3.5 ms-1" />السجل</TabsTrigger>
            </TabsList>

            <form onSubmit={handleSave} className="space-y-5 pt-4">
              <TabsContent value="info" className="space-y-4 mt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="m-name">اسم المشروع *</Label>
                    <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={150} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="m-country">الدولة</Label>
                    <Input id="m-country" value={country} onChange={(e) => setCountry(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="m-health">حالة المشروع</Label>
                    <Select value={health} onValueChange={(v) => setHealth(v as Health)}>
                      <SelectTrigger id="m-health"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="green">جيد</SelectItem>
                        <SelectItem value="yellow">متوسط</SelectItem>
                        <SelectItem value="red">حرج</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label htmlFor="m-active" className="cursor-pointer">نشط</Label>
                    <Switch id="m-active" checked={active} onCheckedChange={setActive} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>الوصف</Label>
                  <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} maxLength={500} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>البريد الأساسي</Label><Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></div>
                  <div className="space-y-2"><Label>الهاتف الأساسي</Label><Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></div>
                  <div className="space-y-2"><Label>بريد إضافي</Label><Input type="email" value={secondaryEmail} onChange={(e) => setSecondaryEmail(e.target.value)} /></div>
                  <div className="space-y-2"><Label>هاتف إضافي</Label><Input value={secondaryPhone} onChange={(e) => setSecondaryPhone(e.target.value)} /></div>
                  <div className="sm:col-span-2 space-y-2"><Label>العنوان</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
                </div>
                <div className="space-y-2">
                  <Label>ملاحظات</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={1000} />
                </div>
              </TabsContent>

              <TabsContent value="contract" className="space-y-4 mt-0">
                {!canEditContract && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5" /> ليس لديك صلاحية تعديل بيانات التعاقد. العرض فقط.
                  </div>
                )}
                <fieldset disabled={!canEditContract} className="space-y-4 disabled:opacity-70">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-2"><Label>رقم العقد</Label><Input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} /></div>
                    <div className="space-y-2"><Label>قيمة العقد</Label><Input type="number" min="0" step="0.01" value={contractValue} onChange={(e) => setContractValue(e.target.value)} /></div>
                    <div className="space-y-2">
                      <Label>العملة</Label>
                      <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["SAR","AED","USD","EUR","EGP","KWD","QAR"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>بداية العقد</Label><Input type="date" value={contractStart} onChange={(e) => setContractStart(e.target.value)} /></div>
                    <div className="space-y-2"><Label>نهاية العقد</Label><Input type="date" value={contractEnd} onChange={(e) => setContractEnd(e.target.value)} /></div>
                    <div className="space-y-2"><Label>تنبيه قبل (أيام)</Label><Input type="number" min="1" max="365" value={alertDays} onChange={(e) => setAlertDays(e.target.value)} /></div>
                  </div>
                </fieldset>
              </TabsContent>

              <TabsContent value="files" className="space-y-3 mt-0">
                {!canEditAttachments ? (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5" /> العرض فقط. لا يمكنك رفع/حذف المرفقات.
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="m-files" className="cursor-pointer inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent">
                      <Upload className="h-4 w-4" /> اختر ملفات (حد 25MB)
                    </Label>
                    <input id="m-files" type="file" multiple className="hidden" onChange={(e) => onPickFiles(Array.from(e.target.files ?? []))} />
                    <span className="text-xs text-muted-foreground">
                      {pendingFiles.length > 0 ? `${pendingFiles.length} جاهزة للرفع` : `${attachments.length} ملف موجود`}
                    </span>
                  </div>
                )}
                {pendingFiles.length > 0 && (
                  <ul className="divide-y border rounded-md bg-muted/30">
                    {pendingFiles.map((f, i) => (
                      <li key={i} className="px-3 py-2 flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">{f.name} <span className="text-xs text-muted-foreground">({Math.round(f.size/1024)} KB)</span></span>
                        <Button type="button" variant="ghost" size="icon" onClick={() => setPendingFiles(pendingFiles.filter((_, idx) => idx !== i))}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                {attachments.length > 0 && (
                  <ul className="divide-y border rounded-md">
                    {attachments.map((att) => (
                      <li key={att.id} className="px-3 py-2 flex items-center justify-between gap-2">
                        <button type="button" onClick={() => downloadAtt(att)} className="min-w-0 flex items-center gap-2 text-start hover:text-primary">
                          <Paperclip className="h-4 w-4 shrink-0" />
                          <span className="truncate text-sm">{att.file_name}</span>
                          {att.file_size != null && <span className="text-xs text-muted-foreground shrink-0">({Math.round(att.file_size / 1024)} KB)</span>}
                        </button>
                        {canEditAttachments && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => deleteAtt(att)} className="text-destructive">
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-0">
                {history.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-6">لا يوجد سجل تعديلات بعد.</div>
                ) : (
                  <ul className="divide-y border rounded-md max-h-80 overflow-y-auto">
                    {history.map((h) => (
                      <li key={h.id} className="px-3 py-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">
                            {h.action === "attachment_added" ? "📎 إضافة مرفق" : h.action === "attachment_removed" ? "🗑️ حذف مرفق" : `✏️ ${h.field_name}`}
                          </span>
                          <span className="text-muted-foreground">{format(new Date(h.created_at), "d MMM HH:mm", { locale: ar })}</span>
                        </div>
                        {h.action === "updated" && (
                          <div className="text-muted-foreground mt-1 truncate">
                            <span className="line-through opacity-60">{h.old_value ?? "—"}</span> → <span className="text-foreground">{h.new_value ?? "—"}</span>
                          </div>
                        )}
                        {h.action !== "updated" && <div className="text-muted-foreground mt-1">{h.new_value ?? h.old_value}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
                حفظ التعديلات
              </Button>
            </form>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
