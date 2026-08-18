import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  Paperclip,
  X,
  Clock,
  Users,
  Check,
  ChevronDown,
  Briefcase,
  Users2,
  LifeBuoy,
  GraduationCap,
  MoreHorizontal,
  FileText,
  ClipboardList,
  Building2,
  Tag,
  Flag,
  CalendarClock,
  UploadCloud,
  Image as ImageIcon,
  File as FileIcon,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Project { id: string; name: string }
interface ClientOpt { id: string; name: string; project_id: string }
interface ModuleOpt { id: string; name: string; color: string | null; parent_id: string | null }
type AppRole = "admin" | "general_manager" | "manager" | "employee";
interface Colleague {
  id: string;
  full_name: string;
  job_title: string | null;
  department: string | null;
  roles: AppRole[];
}

const SESSION_TYPES = [
  { value: "work", label: "عمل", icon: Briefcase, color: "text-blue-500" },
  { value: "meeting", label: "اجتماع", icon: Users2, color: "text-purple-500" },
  { value: "support", label: "دعم", icon: LifeBuoy, color: "text-emerald-500" },
  { value: "training", label: "تدريب", icon: GraduationCap, color: "text-amber-500" },
  { value: "other", label: "أخرى", icon: MoreHorizontal, color: "text-slate-500" },
] as const;

const PRIORITIES = [
  { value: "low", label: "منخفضة", color: "bg-slate-500" },
  { value: "normal", label: "عادية", color: "bg-blue-500" },
  { value: "high", label: "عالية", color: "bg-amber-500" },
  { value: "urgent", label: "عاجلة", color: "bg-red-500" },
] as const;

const schema = z.object({
  title: z.string().trim().min(2, "اسم المهمة قصير جدًا").max(200),
  details: z.string().trim().max(2000).optional(),
  project_id: z.string().uuid().optional().nullable(),
  status: z.enum(["completed", "pending", "postponed", "cancelled"]),
  session_type: z.enum(["work", "meeting", "support", "training", "other"]),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  start_at: z.string().min(1, "حدد وقت البداية"),
  end_at: z.string().optional(),
});

function formatDuration(ms: number): string {
  if (ms <= 0) return "0 دقيقة";
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} دقيقة`;
  if (m === 0) return `${h} ساعة`;
  return `${h} ساعة و ${m} دقيقة`;
}

function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export function TaskForm({ onSuccess }: { onSuccess: () => void }) {
  const { user, profile, roles } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [modules, setModules] = useState<ModuleOpt[]>([]);
  const [projectModuleIds, setProjectModuleIds] = useState<Set<string> | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>("__none__");
  const [selectedClient, setSelectedClient] = useState<string>("__none__");
  const [selectedModule, setSelectedModule] = useState<string>("__none__");
  const [sessionType, setSessionType] = useState<typeof SESSION_TYPES[number]["value"]>("work");
  const [priority, setPriority] = useState<typeof PRIORITIES[number]["value"]>("normal");
  const [status, setStatus] = useState<"completed" | "pending" | "postponed" | "cancelled">("pending");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [collabOpen, setCollabOpen] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const now = new Date();
  const localISO = (d: Date) => {
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
  };
  const [startAt, setStartAt] = useState<string>(localISO(now));
  const [endAt, setEndAt] = useState<string>("");

  useEffect(() => {
    supabase.from("projects").select("id, name").eq("is_active", true).order("name")
      .then(({ data }) => setProjects(data ?? []));
    supabase.from("clients").select("id, name, project_id").order("name")
      .then(({ data }) => setClients(data ?? []));
    supabase.from("company_modules").select("id, name, color, parent_id").eq("is_active", true).order("sort_order")
      .then(({ data }) => setModules((data ?? []) as ModuleOpt[]));

    // preselect user's primary module
    if (user?.id) {
      supabase
        .from("employee_modules")
        .select("module_id, is_primary")
        .eq("user_id", user.id)
        .eq("is_primary", true)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.module_id) setSelectedModule(data.module_id as string);
        });
    }

    (async () => {
      const [{ data: profs }, { data: roleRows }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, job_title, department").eq("is_active", true).order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const rolesByUser = new Map<string, AppRole[]>();
      (roleRows ?? []).forEach((r: any) => {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role as AppRole);
        rolesByUser.set(r.user_id, arr);
      });
      setColleagues((profs ?? []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        job_title: p.job_title,
        department: p.department,
        roles: rolesByUser.get(p.id) ?? [],
      })));
    })();
  }, [user?.id]);

  // Restrict module choices to those linked to the selected project.
  useEffect(() => {
    if (selectedProject === "__none__") { setProjectModuleIds(null); return; }
    let cancelled = false;
    supabase.from("project_modules").select("module_id").eq("project_id", selectedProject)
      .then(({ data }) => {
        if (cancelled) return;
        const ids = new Set((data ?? []).map((r: any) => r.module_id as string));
        setProjectModuleIds(ids);
        // If currently selected module is no longer allowed, reset.
        if (selectedModule !== "__none__" && !ids.has(selectedModule)) {
          setSelectedModule("__none__");
        }
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject]);

  const visibleModules = useMemo(
    () => projectModuleIds ? modules.filter((m) => projectModuleIds.has(m.id)) : modules,
    [modules, projectModuleIds],
  );

  const duration = useMemo(() => {
    if (!startAt || !endAt) return null;
    const s = new Date(startAt).getTime();
    const e = new Date(endAt).getTime();
    if (Number.isNaN(s) || Number.isNaN(e)) return null;
    return e - s;
  }, [startAt, endAt]);

  const isAdminOrGM = roles.includes("admin") || roles.includes("general_manager");
  const isManager = roles.includes("manager");
  const myDept = profile?.department ?? null;

  const isAllowedRole = (r: AppRole[]): boolean => {
    if (isAdminOrGM) return true;
    if (isManager) return r.includes("employee") || r.includes("manager");
    return r.length === 0 || r.includes("employee");
  };

  const collabList = useMemo(
    () => colleagues.filter((c) => {
      if (c.id === user?.id) return false;
      if (!isAdminOrGM) {
        if (!myDept || (c.department ?? null) !== myDept) return false;
      }
      return isAllowedRole(c.roles);
    }),
    [colleagues, user?.id, isAdminOrGM, isManager, myDept],
  );

  const toggleCollaborator = (id: string) =>
    setCollaborators((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const addTag = (raw: string) => {
    const v = raw.trim().replace(/,$/, "");
    if (!v) return;
    if (tags.includes(v)) return;
    if (tags.length >= 8) { toast.warning("الحد الأقصى 8 وسوم"); return; }
    setTags([...tags, v]);
    setTagInput("");
  };

  const acceptFiles = (incoming: File[]) => {
    const valid = incoming.filter((f) => f.size <= MAX_FILE_SIZE);
    if (valid.length < incoming.length) toast.warning("بعض الملفات تجاوزت 20MB وتم تجاهلها");
    setFiles((prev) => {
      const merged = [...prev, ...valid];
      if (merged.length > MAX_FILES) toast.warning(`الحد الأقصى ${MAX_FILES} ملفات`);
      return merged.slice(0, MAX_FILES);
    });
  };

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    acceptFiles(list);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const list = Array.from(e.dataTransfer.files ?? []);
    acceptFiles(list);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      title: fd.get("title"),
      details: fd.get("details") || undefined,
      project_id: selectedProject !== "__none__" ? selectedProject : null,
      status,
      session_type: sessionType,
      priority,
      start_at: startAt,
      end_at: endAt || undefined,
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (parsed.data.end_at) {
      const s = new Date(parsed.data.start_at).getTime();
      const e2 = new Date(parsed.data.end_at).getTime();
      if (e2 < s) { toast.error("وقت النهاية يجب أن يكون بعد البداية"); return; }
    }

    setSubmitting(true);
    setUploadProgress(0);

    const { data: inserted, error } = await supabase
      .from("tasks")
      .insert({
        user_id: user.id,
        title: parsed.data.title,
        details: parsed.data.details ?? null,
        project_id: parsed.data.project_id ?? null,
        client_id: selectedClient !== "__none__" ? selectedClient : null,
        module_id: selectedModule !== "__none__" ? selectedModule : null,
        session_type: parsed.data.session_type,
        priority: parsed.data.priority,
        tags,
        status: parsed.data.status,
        start_at: new Date(parsed.data.start_at).toISOString(),
        end_at: parsed.data.end_at ? new Date(parsed.data.end_at).toISOString() : null,
      } as any)
      .select("id")
      .single();

    if (error || !inserted) {
      setSubmitting(false);
      toast.error(error?.message ?? "فشل حفظ المهمة");
      return;
    }

    if (collaborators.length > 0) {
      const { error: cErr } = await supabase.from("task_collaborators").insert(
        collaborators.map((cid) => ({ task_id: inserted.id, user_id: cid, added_by: user.id })),
      );
      if (cErr) toast.warning(`تعذّر إضافة بعض الزملاء: ${cErr.message}`);
    }

    if (files.length > 0) {
      let done = 0;
      for (const file of files) {
        const safeName = file.name.replace(/[^\w.\-]/g, "_");
        const path = `${user.id}/${inserted.id}/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("task-attachments").upload(path, file, { contentType: file.type });
        if (upErr) { toast.error(`فشل رفع: ${file.name}`); }
        else {
          await supabase.from("task_attachments").insert({
            task_id: inserted.id, file_path: path, file_name: file.name,
            file_size: file.size, mime_type: file.type, uploaded_by: user.id,
          });
        }
        done++;
        setUploadProgress(Math.round((done / files.length) * 100));
      }
    }

    setSubmitting(false);
    toast.success("تمت إضافة المهمة بنجاح");
    onSuccess();
  };

  const selectedColleagues = collabList.filter((c) => collaborators.includes(c.id));
  const currentSession = SESSION_TYPES.find((s) => s.value === sessionType)!;

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pt-4 pb-24">
      {/* Section: Basics */}
      <section className="space-y-4 rounded-xl border bg-card/40 p-4 sm:p-5 shadow-sm">
        <header className="flex items-center gap-2 text-sm font-semibold text-foreground/80 pb-1 border-b border-border/60">
          <ClipboardList className="h-4 w-4 text-primary" />
          <span>المعلومات الأساسية</span>
        </header>

        <div className="space-y-2">
          <Label htmlFor="title">عنوان المهمة *</Label>
          <Input id="title" name="title" required maxLength={200} placeholder="ما الذي عملت عليه؟" className="h-11" />
        </div>

        {/* Session type — segmented */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <currentSession.icon className={cn("h-4 w-4", currentSession.color)} />
            نوع الجلسة *
          </Label>
          <div className="grid grid-cols-5 gap-2">
            {SESSION_TYPES.map((s) => {
              const Icon = s.icon;
              const active = sessionType === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSessionType(s.value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border-2 px-2 py-3 text-xs font-medium transition-all",
                    active
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/50 hover:bg-muted/50",
                  )}
                >
                  <Icon className={cn("h-5 w-5", active ? s.color : "text-muted-foreground")} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Flag className="h-4 w-4 text-muted-foreground" />الأولوية</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <span className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", p.color)} />
                      {p.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>الحالة *</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">قيد التنفيذ</SelectItem>
                <SelectItem value="completed">منتهية</SelectItem>
                <SelectItem value="postponed">مؤجلة</SelectItem>
                <SelectItem value="cancelled">ملغاة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Section: Context */}
      <section className="space-y-4 rounded-xl border bg-card/40 p-4 sm:p-5 shadow-sm">
        <header className="flex items-center gap-2 text-sm font-semibold text-foreground/80 pb-1 border-b border-border/60">
          <Building2 className="h-4 w-4 text-primary" />
          <span>السياق والربط</span>
        </header>

        {selectedProject !== "__none__" && (
          <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground/80 flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
            <div className="flex-1">
              {visibleModules.length === 0 ? (
                <span>هذا المشروع غير مرتبط بأي نظام بعد. اربطه أولًا من شاشة المشاريع لتتمكن من اختيار النظام.</span>
              ) : (
                <span>
                  الأنظمة المسموح بها لهذا المشروع:{" "}
                  <span className="font-semibold">
                    {visibleModules.slice(0, 5).map((m) => m.name).join("، ")}
                    {visibleModules.length > 5 ? ` +${visibleModules.length - 5}` : ""}
                  </span>
                </span>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>النظام / الموديول</Label>
            <Select value={selectedModule} onValueChange={setSelectedModule} disabled={selectedProject !== "__none__" && visibleModules.length === 0}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="__none__">— بدون نظام —</SelectItem>
                {visibleModules.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: m.color || "hsl(var(--primary))" }}
                      />
                      {m.parent_id ? "↳ " : ""}{m.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>المشروع</Label>
            <Select
              value={selectedProject}
              onValueChange={(v) => { setSelectedProject(v); setSelectedClient("__none__"); }}
            >
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— بدون مشروع —</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        </div>
      </section>

      {/* Section: Time */}
      <section className="space-y-4 rounded-xl border bg-card/40 p-4 sm:p-5 shadow-sm">
        <header className="flex items-center gap-2 text-sm font-semibold text-foreground/80 pb-1 border-b border-border/60">
          <CalendarClock className="h-4 w-4 text-primary" />
          <span>التوقيت</span>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start_at">من *</Label>
            <Input id="start_at" name="start_at" type="datetime-local" required
              value={startAt} onChange={(e) => setStartAt(e.target.value)} dir="ltr" className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_at">إلى</Label>
            <Input id="end_at" name="end_at" type="datetime-local"
              value={endAt} onChange={(e) => setEndAt(e.target.value)} dir="ltr" className="h-11" />
          </div>
        </div>

        {/* Quick duration buttons */}
        <div className="flex flex-wrap gap-2">
          {[15, 30, 60, 120].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                if (!startAt) return;
                const s = new Date(startAt);
                setEndAt(localISO(new Date(s.getTime() + m * 60000)));
              }}
              className="text-xs px-3 py-1.5 rounded-full border hover:bg-primary/5 hover:border-primary/40 transition-colors"
            >
              + {m < 60 ? `${m} د` : `${m / 60} س`}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setEndAt(localISO(new Date()))}
            className="text-xs px-3 py-1.5 rounded-full border hover:bg-primary/5 hover:border-primary/40 transition-colors"
          >
            الآن
          </button>
        </div>

        {duration !== null && (
          <div className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm",
            duration < 0
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-primary/30 bg-primary/5 text-primary",
          )}>
            <Clock className="h-4 w-4" />
            {duration < 0
              ? <span>وقت النهاية قبل البداية</span>
              : <span>المدة الإجمالية: <strong>{formatDuration(duration)}</strong></span>}
          </div>
        )}
      </section>

      {/* Section: Collaborators + Tags */}
      <section className="space-y-4 rounded-xl border bg-card/40 p-4 sm:p-5 shadow-sm">
        <header className="flex items-center gap-2 text-sm font-semibold text-foreground/80 pb-1 border-b border-border/60">
          <Users className="h-4 w-4 text-primary" />
          <span>الزملاء والوسوم</span>
        </header>

        <div className="space-y-2">
          <Label className="flex items-center gap-2"><Users className="h-4 w-4" />زملاء شاركوا في المهمة</Label>
          <Popover open={collabOpen} onOpenChange={setCollabOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="w-full justify-between font-normal h-11">
                <span className="truncate">
                  {collaborators.length === 0 ? "اختر زملاء (اختياري)" : `${collaborators.length} زميل محدد`}
                </span>
                <ChevronDown className="h-4 w-4 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command>
                <CommandInput placeholder="بحث بالاسم..." />
                <CommandList>
                  <CommandEmpty>
                    {isAdminOrGM ? "لا يوجد زملاء."
                      : !myDept ? "حدد قسمك في الملف الشخصي لتظهر قائمة الزملاء."
                      : "لا يوجد زملاء مؤهلون في قسمك."}
                  </CommandEmpty>
                  <CommandGroup>
                    {collabList.map((c) => {
                      const checked = collaborators.includes(c.id);
                      return (
                        <CommandItem key={c.id} value={c.full_name}
                          onSelect={() => toggleCollaborator(c.id)} className="cursor-pointer">
                          <div className={cn(
                            "me-2 flex h-4 w-4 items-center justify-center rounded border",
                            checked ? "bg-primary border-primary text-primary-foreground" : "border-input",
                          )}>
                            {checked && <Check className="h-3 w-3" />}
                          </div>
                          <span className="flex-1 truncate">{c.full_name}</span>
                          {c.job_title && (
                            <span className="ms-2 text-xs text-muted-foreground truncate">{c.job_title}</span>
                          )}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {selectedColleagues.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {selectedColleagues.map((c) => (
                <Badge key={c.id} variant="secondary" className="gap-1.5 ps-2.5 pe-1.5 py-1">
                  {c.full_name}
                  <button type="button" onClick={() => toggleCollaborator(c.id)}
                    className="rounded-full hover:bg-background/50">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2"><Tag className="h-4 w-4" />الوسوم (اختياري)</Label>
          <div className="flex flex-wrap gap-1.5 rounded-md border bg-background p-2 min-h-11 focus-within:ring-1 focus-within:ring-ring">
            {tags.map((t) => (
              <Badge key={t} variant="outline" className="gap-1 ps-2.5 pe-1.5 py-1">
                {t}
                <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))}
                  className="rounded-full hover:bg-destructive/10 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <input
              value={tagInput}
              onChange={(e) => {
                const v = e.target.value;
                if (v.endsWith(",") || v.endsWith("،")) addTag(v.slice(0, -1));
                else setTagInput(v);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); }
                else if (e.key === "Backspace" && !tagInput && tags.length) {
                  setTags(tags.slice(0, -1));
                }
              }}
              onBlur={() => addTag(tagInput)}
              placeholder={tags.length === 0 ? "اكتب وسمًا واضغط Enter..." : ""}
              className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </section>

      {/* Section: Details + Attachments */}
      <section className="space-y-4 rounded-xl border bg-card/40 p-4 sm:p-5 shadow-sm">
        <header className="flex items-center gap-2 text-sm font-semibold text-foreground/80 pb-1 border-b border-border/60">
          <FileText className="h-4 w-4 text-primary" />
          <span>التفاصيل والمرفقات</span>
        </header>

        <div className="space-y-2">
          <Label htmlFor="details">التفاصيل</Label>
          <Textarea id="details" name="details" rows={4} maxLength={2000}
            placeholder="أي تفاصيل إضافية عن المهمة..." />
        </div>

        <div className="space-y-2">
          <Label>المرفقات (حتى {MAX_FILES} ملفات، {humanFileSize(MAX_FILE_SIZE)} لكل ملف)</Label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-7 px-4 cursor-pointer transition-all",
              dragOver
                ? "border-primary bg-primary/10 scale-[1.01]"
                : "border-border hover:border-primary/50 hover:bg-muted/40",
            )}
          >
            <UploadCloud className={cn("h-8 w-8", dragOver ? "text-primary" : "text-muted-foreground")} />
            <div className="text-center">
              <p className="text-sm font-medium">
                {dragOver ? "أفلت الملفات هنا" : "اسحب وأفلت الملفات أو انقر للاختيار"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                صور، PDF، مستندات Office والمزيد
              </p>
            </div>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onPickFiles} />
          </div>

          {files.length > 0 && (
            <ul className="space-y-1.5">
              {files.map((f, i) => {
                const isImage = f.type.startsWith("image/");
                const Icon = isImage ? ImageIcon : FileIcon;
                return (
                  <li key={i} className="flex items-center gap-3 bg-muted/40 px-3 py-2 rounded-lg">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-background border">
                      {isImage
                        ? <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover rounded-md" />
                        : <Icon className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{humanFileSize(f.size)}</p>
                    </div>
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); setFiles(files.filter((_, idx) => idx !== i)); }}
                      className="text-muted-foreground hover:text-destructive p-1">
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {submitting && files.length > 0 && (
            <div className="space-y-1">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">جاري رفع المرفقات... {uploadProgress}%</p>
            </div>
          )}
        </div>
      </section>

      <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-background/95 backdrop-blur-md border-t flex items-center gap-3 shadow-[0_-4px_12px_-6px_rgba(0,0,0,0.08)]">
        <Button type="submit" disabled={submitting} className="flex-1 h-12 text-base font-semibold" size="lg">
          {submitting && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
          {submitting ? "جاري الحفظ..." : "حفظ المهمة"}
        </Button>
      </div>
    </form>
  );
}
