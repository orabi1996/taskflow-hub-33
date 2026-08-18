import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowRight, Plus, Pencil, Trash2, Loader2, Users, Mail, Phone, Building2,
  Search, Download, FileText, History, ListChecks, StickyNote, MapPin,
  AlertTriangle, Paperclip, Upload, X, Globe, FileSignature,
} from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { ar } from "date-fns/locale";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_app/my-projects/$projectId/clients")({
  component: ProjectClientsPage,
});

type HealthStatus = "green" | "yellow" | "red";

interface Client {
  id: string;
  project_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  country: string | null;
  address: string | null;
  secondary_email: string | null;
  secondary_phone: string | null;
  contract_number: string | null;
  contract_value: number | null;
  currency: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  alert_days_before: number;
  health_status: HealthStatus;
  created_at: string;
}

interface ClientTask {
  id: string;
  title: string;
  status: string;
  start_at: string;
  end_at: string | null;
}

interface HistoryRow {
  id: string;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  changed_by: string | null;
}

interface Attachment {
  id: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

const FIELD_LABEL: Record<string, string> = {
  name: "الاسم", email: "البريد", phone: "الهاتف", company: "الشركة", notes: "ملاحظات",
  country: "الدولة", address: "العنوان", secondary_email: "بريد إضافي", secondary_phone: "هاتف إضافي",
  contract_number: "رقم العقد", contract_value: "قيمة العقد", currency: "العملة",
  contract_start_date: "بداية العقد", contract_end_date: "نهاية العقد",
  alert_days_before: "أيام التنبيه", health_status: "حالة العميل",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "قيد الانتظار", in_progress: "قيد التنفيذ", completed: "مكتملة", cancelled: "ملغاة",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline", in_progress: "secondary", completed: "default", cancelled: "destructive",
};

const HEALTH_LABEL: Record<HealthStatus, string> = { green: "جيد", yellow: "متوسط", red: "حرج" };
const HEALTH_DOT: Record<HealthStatus, string> = {
  green: "bg-emerald-500", yellow: "bg-amber-500", red: "bg-red-500",
};
const HEALTH_BADGE: Record<HealthStatus, string> = {
  green: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  yellow: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  red: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
};

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function getContractAlert(c: Client): { level: "expired" | "soon" | "ok"; days: number | null } {
  if (!c.contract_end_date) return { level: "ok", days: null };
  const days = differenceInDays(new Date(c.contract_end_date), new Date());
  if (days < 0) return { level: "expired", days };
  if (days <= (c.alert_days_before ?? 30)) return { level: "soon", days };
  return { level: "ok", days };
}

function ProjectClientsPage() {
  const { projectId } = Route.useParams();
  const { roles, user } = useAuth();
  const canDelete = roles.some((r) => ["admin", "general_manager"].includes(r));
  const [project, setProject] = useState<{ name: string } | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // details dialog (tasks/history/attachments)
  const [detailsClient, setDetailsClient] = useState<Client | null>(null);
  const [clientTasks, setClientTasks] = useState<ClientTask[]>([]);
  const [clientHistory, setClientHistory] = useState<HistoryRow[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  // filters
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState<string>("all");
  const [healthFilter, setHealthFilter] = useState<string>("all");
  const [alertFilter, setAlertFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [country, setCountry] = useState("");
  const [address, setAddress] = useState("");
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [secondaryPhone, setSecondaryPhone] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [contractValue, setContractValue] = useState("");
  const [currency, setCurrency] = useState("SAR");
  const [contractStart, setContractStart] = useState("");
  const [contractEnd, setContractEnd] = useState("");
  const [alertDays, setAlertDays] = useState("30");
  const [health, setHealth] = useState<HealthStatus>("green");
  // attachments to upload after creation/edit
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const resetForm = () => {
    setName(""); setEmail(""); setPhone(""); setCompany(""); setNotes("");
    setCountry(""); setAddress(""); setSecondaryEmail(""); setSecondaryPhone("");
    setContractNumber(""); setContractValue(""); setCurrency("SAR");
    setContractStart(""); setContractEnd(""); setAlertDays("30");
    setHealth("green"); setPendingFiles([]);
  };

  const load = async () => {
    setLoading(true);
    const [{ data: proj }, { data: cls, error }] = await Promise.all([
      supabase.from("projects").select("name").eq("id", projectId).maybeSingle(),
      supabase.from("clients").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    ]);
    if (error) toast.error(error.message);
    setProject(proj);
    setClients((cls ?? []) as Client[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  const openEdit = (c: Client) => {
    setEditing(c);
    setName(c.name);
    setEmail(c.email ?? "");
    setPhone(c.phone ?? "");
    setCompany(c.company ?? "");
    setNotes(c.notes ?? "");
    setCountry(c.country ?? "");
    setAddress(c.address ?? "");
    setSecondaryEmail(c.secondary_email ?? "");
    setSecondaryPhone(c.secondary_phone ?? "");
    setContractNumber(c.contract_number ?? "");
    setContractValue(c.contract_value != null ? String(c.contract_value) : "");
    setCurrency(c.currency ?? "SAR");
    setContractStart(c.contract_start_date ?? "");
    setContractEnd(c.contract_end_date ?? "");
    setAlertDays(String(c.alert_days_before ?? 30));
    setHealth(c.health_status ?? "green");
    setPendingFiles([]);
  };

  const loadAttachments = async (clientId: string) => {
    const { data } = await supabase
      .from("client_attachments")
      .select("id, file_path, file_name, file_size, mime_type, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    setAttachments((data ?? []) as Attachment[]);
  };

  const openDetails = async (c: Client) => {
    setDetailsClient(c);
    setClientTasks([]); setClientHistory([]); setAttachments([]);
    const [{ data: tks }, { data: hist }] = await Promise.all([
      supabase.from("tasks").select("id, title, status, start_at, end_at").eq("client_id", c.id).order("start_at", { ascending: false }),
      supabase.from("client_history").select("*").eq("client_id", c.id).order("created_at", { ascending: false }),
    ]);
    setClientTasks((tks ?? []) as ClientTask[]);
    setClientHistory((hist ?? []) as HistoryRow[]);
    await loadAttachments(c.id);
  };

  const uploadFilesFor = async (clientId: string, files: File[]) => {
    if (!user || files.length === 0) return;
    for (const f of files) {
      const path = `${clientId}/${Date.now()}-${f.name}`;
      const { error: upErr } = await supabase.storage.from("client-attachments").upload(path, f);
      if (upErr) { toast.error(`فشل رفع ${f.name}: ${upErr.message}`); continue; }
      const { error: dbErr } = await supabase.from("client_attachments").insert({
        client_id: clientId, file_path: path, file_name: f.name,
        file_size: f.size, mime_type: f.type || null, uploaded_by: user.id,
      });
      if (dbErr) toast.error(dbErr.message);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (name.trim().length < 2) { toast.error("اسم العميل قصير جدًا"); return; }
    setSubmitting(true);
    const payload = {
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      company: company.trim() || null,
      notes: notes.trim() || null,
      country: country.trim() || null,
      address: address.trim() || null,
      secondary_email: secondaryEmail.trim() || null,
      secondary_phone: secondaryPhone.trim() || null,
      contract_number: contractNumber.trim() || null,
      contract_value: contractValue.trim() ? Number(contractValue) : null,
      currency: currency.trim() || null,
      contract_start_date: contractStart || null,
      contract_end_date: contractEnd || null,
      alert_days_before: Number(alertDays) || 30,
      health_status: health,
    };
    let clientId = editing?.id;
    if (editing) {
      const { error } = await supabase.from("clients").update(payload).eq("id", editing.id);
      if (error) { setSubmitting(false); toast.error(error.message); return; }
    } else {
      const { data, error } = await supabase.from("clients").insert({ ...payload, project_id: projectId }).select("id").single();
      if (error || !data) { setSubmitting(false); toast.error(error?.message ?? "فشل الإنشاء"); return; }
      clientId = data.id;
    }
    if (clientId && pendingFiles.length > 0) await uploadFilesFor(clientId, pendingFiles);
    setSubmitting(false);
    toast.success(editing ? "تم التحديث" : "تم إضافة العميل");
    setOpen(false); setEditing(null); resetForm(); load();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSubmitting(true);
    const { error } = await supabase.from("clients").delete().eq("id", deleting.id);
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حذف العميل");
    setDeleting(null); load();
  };

  const handleDetailsUpload = async (files: FileList | null) => {
    if (!files || !detailsClient) return;
    setUploading(true);
    await uploadFilesFor(detailsClient.id, Array.from(files));
    await loadAttachments(detailsClient.id);
    setUploading(false);
    toast.success("تم رفع المرفقات");
  };

  const downloadAttachment = async (att: Attachment) => {
    const { data, error } = await supabase.storage.from("client-attachments").createSignedUrl(att.file_path, 60);
    if (error || !data) { toast.error("تعذر تحميل الملف"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const deleteAttachment = async (att: Attachment) => {
    if (!detailsClient) return;
    await supabase.storage.from("client-attachments").remove([att.file_path]);
    await supabase.from("client_attachments").delete().eq("id", att.id);
    await loadAttachments(detailsClient.id);
    toast.success("تم حذف المرفق");
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() + 86400000 : null;
    return clients.filter((c) => {
      if (q) {
        let hay = "";
        if (searchField === "name") hay = c.name;
        else if (searchField === "email") hay = `${c.email ?? ""} ${c.secondary_email ?? ""}`;
        else if (searchField === "company") hay = c.company ?? "";
        else if (searchField === "country") hay = c.country ?? "";
        else if (searchField === "contract") hay = c.contract_number ?? "";
        else hay = `${c.name} ${c.email ?? ""} ${c.secondary_email ?? ""} ${c.company ?? ""} ${c.phone ?? ""} ${c.country ?? ""} ${c.contract_number ?? ""} ${c.notes ?? ""}`;
        if (!hay.toLowerCase().includes(q)) return false;
      }
      if (healthFilter !== "all" && c.health_status !== healthFilter) return false;
      if (alertFilter !== "all") {
        const a = getContractAlert(c);
        if (alertFilter === "expired" && a.level !== "expired") return false;
        if (alertFilter === "soon" && a.level !== "soon") return false;
        if (alertFilter === "ok" && a.level !== "ok") return false;
      }
      const created = new Date(c.created_at).getTime();
      if (dateRange !== "all" && dateRange !== "custom") {
        const days = dateRange === "7" ? 7 : dateRange === "30" ? 30 : 90;
        if ((now - created) / 86400000 > days) return false;
      }
      if (dateRange === "custom") {
        if (fromTs && created < fromTs) return false;
        if (toTs && created > toTs) return false;
      }
      return true;
    });
  }, [clients, search, searchField, healthFilter, alertFilter, dateRange, dateFrom, dateTo]);

  const alerts = useMemo(() => {
    return clients
      .map((c) => ({ c, a: getContractAlert(c) }))
      .filter((x) => x.a.level === "expired" || x.a.level === "soon")
      .sort((x, y) => (x.a.days ?? 0) - (y.a.days ?? 0));
  }, [clients]);

  const exportCSV = () => {
    const headers = ["الاسم","الشركة","الدولة","البريد","الهاتف","رقم العقد","قيمة العقد","العملة","بداية العقد","نهاية العقد","حالة العميل","ملاحظات","تاريخ الإضافة"];
    const rows = filtered.map((c) => [
      c.name, c.company ?? "", c.country ?? "", c.email ?? "", c.phone ?? "",
      c.contract_number ?? "", c.contract_value ?? "", c.currency ?? "",
      c.contract_start_date ?? "", c.contract_end_date ?? "",
      HEALTH_LABEL[c.health_status], c.notes ?? "",
      format(new Date(c.created_at), "yyyy-MM-dd HH:mm"),
    ]);
    const csv = "\uFEFF" + [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `clients-${project?.name ?? projectId}-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير الملف");
  };

  const exportXLSX = () => {
    const data = filtered.map((c) => ({
      "الاسم": c.name, "الشركة": c.company ?? "", "الدولة": c.country ?? "",
      "البريد": c.email ?? "", "الهاتف": c.phone ?? "",
      "رقم العقد": c.contract_number ?? "", "قيمة العقد": c.contract_value ?? "",
      "العملة": c.currency ?? "",
      "بداية العقد": c.contract_start_date ?? "", "نهاية العقد": c.contract_end_date ?? "",
      "حالة العميل": HEALTH_LABEL[c.health_status],
      "ملاحظات": c.notes ?? "",
      "تاريخ الإضافة": format(new Date(c.created_at), "yyyy-MM-dd HH:mm"),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "العملاء");
    XLSX.writeFile(wb, `clients-${project?.name ?? projectId}-${Date.now()}.xlsx`);
    toast.success("تم تصدير ملف Excel");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/my-projects"><ArrowRight className="h-4 w-4 ms-1" /> العودة</Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">عملاء — {project?.name ?? "..."}</h1>
          <p className="text-muted-foreground mt-1">إدارة بيانات وعقود عملاء هذا المشروع</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportXLSX} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 ms-1.5" /> Excel
          </Button>
          <Button variant="outline" onClick={exportCSV} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 ms-1.5" /> CSV
          </Button>
          <Dialog
            open={open || !!editing}
            onOpenChange={(v) => { if (!v) { setOpen(false); setEditing(null); resetForm(); } }}
          >
            <DialogTrigger asChild>
              <Button size="lg" onClick={() => { resetForm(); setOpen(true); }} className="shadow-[var(--shadow-elegant)]">
                <Plus className="h-4 w-4 ms-1.5" /> عميل جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? "تعديل عميل" : "عميل جديد"}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-5 pt-2">
                {/* Basic */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground/80">البيانات الأساسية</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="c-name">الاسم *</Label>
                      <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={150} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="c-company">الشركة</Label>
                      <Input id="c-company" value={company} onChange={(e) => setCompany(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="c-country">الدولة</Label>
                      <Input id="c-country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="السعودية، الإمارات..." />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="c-health">حالة العميل</Label>
                      <Select value={health} onValueChange={(v) => setHealth(v as HealthStatus)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="green"><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> جيد</span></SelectItem>
                          <SelectItem value="yellow"><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> متوسط</span></SelectItem>
                          <SelectItem value="red"><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> حرج</span></SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Contact */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground/80">بيانات التواصل</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="c-email">البريد الأساسي</Label>
                      <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="c-phone">الهاتف الأساسي</Label>
                      <Input id="c-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="c-email2">بريد إضافي</Label>
                      <Input id="c-email2" type="email" value={secondaryEmail} onChange={(e) => setSecondaryEmail(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="c-phone2">هاتف إضافي</Label>
                      <Input id="c-phone2" value={secondaryPhone} onChange={(e) => setSecondaryPhone(e.target.value)} />
                    </div>
                    <div className="sm:col-span-2 space-y-2">
                      <Label htmlFor="c-address">العنوان</Label>
                      <Input id="c-address" value={address} onChange={(e) => setAddress(e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Contract */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground/80">بيانات التعاقد</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="c-cnum">رقم العقد</Label>
                      <Input id="c-cnum" value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="c-cval">قيمة العقد</Label>
                      <Input id="c-cval" type="number" min="0" step="0.01" value={contractValue} onChange={(e) => setContractValue(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="c-cur">العملة</Label>
                      <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger id="c-cur"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SAR">SAR</SelectItem>
                          <SelectItem value="AED">AED</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="EGP">EGP</SelectItem>
                          <SelectItem value="KWD">KWD</SelectItem>
                          <SelectItem value="QAR">QAR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="c-cstart">بداية العقد</Label>
                      <Input id="c-cstart" type="date" value={contractStart} onChange={(e) => setContractStart(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="c-cend">نهاية العقد</Label>
                      <Input id="c-cend" type="date" value={contractEnd} onChange={(e) => setContractEnd(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="c-alert">تنبيه قبل (أيام)</Label>
                      <Input id="c-alert" type="number" min="1" max="365" value={alertDays} onChange={(e) => setAlertDays(e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="c-notes">ملاحظات</Label>
                  <Textarea id="c-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={1000} />
                </div>

                {/* Attachments */}
                <div className="space-y-2">
                  <Label htmlFor="c-files">مرفقات</Label>
                  <Input id="c-files" type="file" multiple onChange={(e) => setPendingFiles(Array.from(e.target.files ?? []))} />
                  {pendingFiles.length > 0 && (
                    <div className="text-xs text-muted-foreground">{pendingFiles.length} ملف(ات) جاهزة للرفع بعد الحفظ</div>
                  )}
                </div>

                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
                  {editing ? "حفظ التعديلات" : "إضافة"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Alerts dashboard */}
      {alerts.length > 0 && (
        <Card className="p-4 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold">تنبيهات العقود ({alerts.length})</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {alerts.slice(0, 9).map(({ c, a }) => (
              <button
                key={c.id}
                onClick={() => openDetails(c)}
                className="text-start rounded-md border bg-background p-2.5 hover:bg-accent transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{c.name}</span>
                  <Badge variant={a.level === "expired" ? "destructive" : "secondary"} className="shrink-0 text-[10px]">
                    {a.level === "expired" ? `منتهي منذ ${Math.abs(a.days!)} يوم` : `${a.days} يوم`}
                  </Badge>
                </div>
                {c.contract_end_date && (
                  <div className="text-xs text-muted-foreground mt-1">
                    ينتهي: {format(new Date(c.contract_end_date), "d MMM yyyy", { locale: ar })}
                  </div>
                )}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث..." className="pe-9" />
          </div>
          <div className="min-w-[150px]">
            <Select value={searchField} onValueChange={setSearchField}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحقول</SelectItem>
                <SelectItem value="name">الاسم فقط</SelectItem>
                <SelectItem value="email">البريد فقط</SelectItem>
                <SelectItem value="company">الشركة فقط</SelectItem>
                <SelectItem value="country">الدولة فقط</SelectItem>
                <SelectItem value="contract">رقم العقد</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[150px]">
            <Select value={healthFilter} onValueChange={setHealthFilter}>
              <SelectTrigger><SelectValue placeholder="حالة العميل" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="green">جيد</SelectItem>
                <SelectItem value="yellow">متوسط</SelectItem>
                <SelectItem value="red">حرج</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px]">
            <Select value={alertFilter} onValueChange={setAlertFilter}>
              <SelectTrigger><SelectValue placeholder="حالة العقد" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل العقود</SelectItem>
                <SelectItem value="expired">منتهية</SelectItem>
                <SelectItem value="soon">قاربت على الانتهاء</SelectItem>
                <SelectItem value="ok">سارية</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px]">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger><SelectValue placeholder="تاريخ الإضافة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الفترات</SelectItem>
                <SelectItem value="7">آخر 7 أيام</SelectItem>
                <SelectItem value="30">آخر 30 يوم</SelectItem>
                <SelectItem value="90">آخر 90 يوم</SelectItem>
                <SelectItem value="custom">نطاق مخصص</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {dateRange === "custom" && (
          <div className="flex items-center gap-3 flex-wrap pt-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="d-from" className="text-xs text-muted-foreground">من</Label>
              <Input id="d-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="d-to" className="text-xs text-muted-foreground">إلى</Label>
              <Input id="d-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
            </div>
          </div>
        )}
        <div className="text-xs text-muted-foreground">عدد النتائج: {filtered.length} من {clients.length}</div>
      </Card>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">جارٍ التحميل...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">
            {clients.length === 0 ? "لا يوجد عملاء بعد لهذا المشروع." : "لا توجد نتائج مطابقة للفلاتر."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((c) => {
            const alert = getContractAlert(c);
            return (
              <Card key={c.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => openDetails(c)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`h-2.5 w-2.5 rounded-full ${HEALTH_DOT[c.health_status]}`} title={HEALTH_LABEL[c.health_status]} />
                      <h3 className="font-semibold truncate hover:text-primary transition-colors">{c.name}</h3>
                      <Badge variant="outline" className={`text-[10px] ${HEALTH_BADGE[c.health_status]}`}>
                        {HEALTH_LABEL[c.health_status]}
                      </Badge>
                      {alert.level === "expired" && (
                        <Badge variant="destructive" className="text-[10px]">عقد منتهي</Badge>
                      )}
                      {alert.level === "soon" && (
                        <Badge variant="secondary" className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                          ينتهي خلال {alert.days} يوم
                        </Badge>
                      )}
                    </div>
                    {c.company && (
                      <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5" /> {c.company}
                        {c.country && <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" /> {c.country}</span>}
                      </div>
                    )}
                    <div className="mt-2 space-y-1 text-sm">
                      {c.email && <div className="flex items-center gap-1.5 text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {c.email}</div>}
                      {c.phone && <div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {c.phone}</div>}
                      {c.address && <div className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {c.address}</div>}
                      {c.contract_number && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <FileSignature className="h-3.5 w-3.5" /> عقد #{c.contract_number}
                          {c.contract_value != null && <span> • {c.contract_value.toLocaleString()} {c.currency ?? ""}</span>}
                        </div>
                      )}
                      {c.contract_end_date && (
                        <div className="text-xs text-muted-foreground">
                          فترة العقد: {c.contract_start_date ? format(new Date(c.contract_start_date), "d MMM yyyy", { locale: ar }) : "—"} → {format(new Date(c.contract_end_date), "d MMM yyyy", { locale: ar })}
                        </div>
                      )}
                    </div>
                    {c.notes && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2 flex items-start gap-1.5">
                        <StickyNote className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {c.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openDetails(c)} title="تفاصيل">
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)} title="تعديل">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {canDelete && (
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleting(c)} title="حذف">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Details dialog */}
      <Dialog open={!!detailsClient} onOpenChange={(v) => !v && setDetailsClient(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{detailsClient?.name}</DialogTitle></DialogHeader>
          <Tabs defaultValue="info" className="pt-2">
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1"><FileText className="h-4 w-4 ms-1.5" /> البيانات</TabsTrigger>
              <TabsTrigger value="files" className="flex-1"><Paperclip className="h-4 w-4 ms-1.5" /> المرفقات ({attachments.length})</TabsTrigger>
              <TabsTrigger value="tasks" className="flex-1"><ListChecks className="h-4 w-4 ms-1.5" /> المهام ({clientTasks.length})</TabsTrigger>
              <TabsTrigger value="history" className="flex-1"><History className="h-4 w-4 ms-1.5" /> السجل ({clientHistory.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="pt-3 space-y-3 text-sm">
              {detailsClient && (() => {
                const c = detailsClient;
                const a = getContractAlert(c);
                return (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={HEALTH_BADGE[c.health_status]}>
                        حالة: {HEALTH_LABEL[c.health_status]}
                      </Badge>
                      {a.level === "expired" && <Badge variant="destructive">عقد منتهي منذ {Math.abs(a.days!)} يوم</Badge>}
                      {a.level === "soon" && <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" variant="outline">ينتهي خلال {a.days} يوم</Badge>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                      <Field label="الشركة" value={c.company} />
                      <Field label="الدولة" value={c.country} />
                      <Field label="البريد الأساسي" value={c.email} />
                      <Field label="الهاتف الأساسي" value={c.phone} />
                      <Field label="بريد إضافي" value={c.secondary_email} />
                      <Field label="هاتف إضافي" value={c.secondary_phone} />
                      <Field label="العنوان" value={c.address} className="sm:col-span-2" />
                      <Field label="رقم العقد" value={c.contract_number} />
                      <Field label="قيمة العقد" value={c.contract_value != null ? `${c.contract_value.toLocaleString()} ${c.currency ?? ""}` : null} />
                      <Field label="بداية العقد" value={c.contract_start_date ? format(new Date(c.contract_start_date), "d MMM yyyy", { locale: ar }) : null} />
                      <Field label="نهاية العقد" value={c.contract_end_date ? format(new Date(c.contract_end_date), "d MMM yyyy", { locale: ar }) : null} />
                      <Field label="تنبيه قبل" value={`${c.alert_days_before} يوم`} />
                    </div>
                    {c.notes && (
                      <div className="rounded-md border p-3 bg-muted/30">
                        <div className="text-xs font-semibold text-muted-foreground mb-1">ملاحظات</div>
                        <p className="text-sm whitespace-pre-wrap">{c.notes}</p>
                      </div>
                    )}
                  </>
                );
              })()}
            </TabsContent>

            <TabsContent value="files" className="pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="att-up" className="cursor-pointer inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  رفع ملفات
                </Label>
                <input id="att-up" type="file" multiple className="hidden" onChange={(e) => handleDetailsUpload(e.target.files)} />
                <span className="text-xs text-muted-foreground">{attachments.length} ملف</span>
              </div>
              {attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">لا توجد مرفقات.</p>
              ) : (
                <ul className="divide-y">
                  {attachments.map((att) => (
                    <li key={att.id} className="py-2 flex items-center justify-between gap-2">
                      <button onClick={() => downloadAttachment(att)} className="min-w-0 flex items-center gap-2 text-start hover:text-primary">
                        <Paperclip className="h-4 w-4 shrink-0" />
                        <span className="truncate text-sm">{att.file_name}</span>
                        {att.file_size != null && (
                          <span className="text-xs text-muted-foreground shrink-0">({Math.round(att.file_size / 1024)} KB)</span>
                        )}
                      </button>
                      <Button variant="ghost" size="icon" onClick={() => deleteAttachment(att)} className="text-destructive">
                        <X className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="tasks" className="pt-3">
              {clientTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">لا توجد مهام مرتبطة بهذا العميل بعد.</p>
              ) : (
                <ul className="divide-y">
                  {clientTasks.map((t) => (
                    <li key={t.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{t.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>بدء: {format(new Date(t.start_at), "d MMM yyyy — HH:mm", { locale: ar })}</span>
                          {t.end_at && <span>• انتهاء: {format(new Date(t.end_at), "d MMM yyyy — HH:mm", { locale: ar })}</span>}
                        </div>
                      </div>
                      <Badge variant={STATUS_VARIANT[t.status] ?? "outline"}>{STATUS_LABEL[t.status] ?? t.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="history" className="pt-3">
              {clientHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">لا توجد تعديلات مسجلة.</p>
              ) : (
                <ol className="relative border-s ps-5 space-y-4">
                  {clientHistory.map((h) => {
                    const isCreated = h.action === "created";
                    const isDeleted = h.action === "deleted";
                    const fieldLabel = h.field_name ? (FIELD_LABEL[h.field_name] ?? h.field_name) : null;
                    return (
                      <li key={h.id} className="relative">
                        <span className={`absolute -start-[26px] top-1.5 h-3 w-3 rounded-full ring-4 ring-background ${
                          isCreated ? "bg-primary" : isDeleted ? "bg-destructive" : "bg-muted-foreground"
                        }`} />
                        <div className="rounded-lg border p-3 text-sm bg-card">
                          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Badge variant={isCreated ? "default" : isDeleted ? "destructive" : "secondary"}>
                                {isCreated ? "إنشاء" : isDeleted ? "حذف" : "تعديل"}
                              </Badge>
                              {fieldLabel && (
                                <span className="text-xs font-medium text-foreground">
                                  حقل: <span className="text-primary">{fieldLabel}</span>
                                </span>
                              )}
                            </div>
                            <time className="text-xs text-muted-foreground">
                              {format(new Date(h.created_at), "d MMM yyyy — HH:mm", { locale: ar })}
                            </time>
                          </div>
                          {h.action === "updated" && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                              <div className="rounded-md bg-destructive/5 border border-destructive/20 p-2">
                                <div className="text-[10px] uppercase tracking-wide text-destructive/80 mb-1">القيمة القديمة</div>
                                <div className="text-xs text-foreground/80 break-words whitespace-pre-wrap">
                                  {h.old_value || <span className="text-muted-foreground italic">— فارغ —</span>}
                                </div>
                              </div>
                              <div className="rounded-md bg-primary/5 border border-primary/20 p-2">
                                <div className="text-[10px] uppercase tracking-wide text-primary/80 mb-1">القيمة الجديدة</div>
                                <div className="text-xs text-foreground break-words whitespace-pre-wrap">
                                  {h.new_value || <span className="text-muted-foreground italic">— فارغ —</span>}
                                </div>
                              </div>
                            </div>
                          )}
                          {isCreated && (
                            <div className="text-xs text-muted-foreground">
                              تم إنشاء العميل باسم: <span className="text-foreground font-medium">{h.new_value}</span>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف العميل</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف "{deleting?.name}"؟ لا يمكن التراجع.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, value, className }: { label: string; value: string | null | undefined; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value || <span className="text-muted-foreground italic font-normal">—</span>}</div>
    </div>
  );
}
