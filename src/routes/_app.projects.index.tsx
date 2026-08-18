import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, lazy, Suspense, type FormEvent } from "react";
import { LayoutGrid, KanbanSquare, GanttChart, BarChart3 } from "lucide-react";
const ProjectKanbanBoard = lazy(() => import("@/components/projects/ProjectKanbanBoard").then(m => ({ default: m.ProjectKanbanBoard })));
const ProjectTimelineView = lazy(() => import("@/components/projects/ProjectTimelineView").then(m => ({ default: m.ProjectTimelineView })));
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, FolderKanban, Loader2, User, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BulkImportDialog, type BulkImportColumn } from "@/components/BulkImportDialog";
import { bulkImportProjects } from "@/lib/bulk-import.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectModulesManager } from "@/components/projects/ProjectModulesManager";
import { BulkLinkProjectsToModuleDialog } from "@/components/projects/BulkLinkProjectsToModuleDialog";
import { BulkUnlinkModuleFromProjectsDialog } from "@/components/projects/BulkUnlinkModuleFromProjectsDialog";
import { Layers, Unlink } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const PROJECT_IMPORT_COLUMNS: BulkImportColumn[] = [
  { key: "name", header: "اسم المشروع", example: "مشروع أ", required: true },
  { key: "description", header: "الوصف", example: "وصف موجز" },
  { key: "owner_email", header: "بريد المسؤول", example: "owner@example.com", note: "موظف موجود مسبقًا" },
  { key: "country", header: "الدولة", example: "السعودية" },
  { key: "address", header: "العنوان", example: "الرياض" },
  { key: "contact_email", header: "بريد التواصل", example: "info@client.com" },
  { key: "contact_phone", header: "هاتف التواصل", example: "+9665xxxxxxxx" },
  { key: "contract_number", header: "رقم العقد", example: "C-2025-001" },
  { key: "contract_value", header: "قيمة العقد", example: 100000 },
  { key: "currency", header: "العملة", example: "SAR" },
  { key: "contract_start_date", header: "بداية العقد", example: "2025-01-01", note: "YYYY-MM-DD" },
  { key: "contract_end_date", header: "نهاية العقد", example: "2025-12-31", note: "YYYY-MM-DD" },
  { key: "notes", header: "ملاحظات" },
];

export const Route = createFileRoute("/_app/projects/")({
  component: ProjectsPage,
});

interface Employee {
  id: string;
  full_name: string;
  is_active: boolean;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  owner_id: string | null;
  health_status?: string;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
}

const UNASSIGNED = "__none__";

function ProjectsPage() {
  const { roles } = useAuth();
  const isManager = roles.some((r) => ["admin", "general_manager", "manager"].includes(r));
  const canDelete = roles.some((r) => ["admin", "general_manager"].includes(r));
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [ownerId, setOwnerId] = useState<string>(UNASSIGNED);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // edit / delete state
  const [editing, setEditing] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editOwner, setEditOwner] = useState<string>(UNASSIGNED);
  const [editActive, setEditActive] = useState(true);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [view, setView] = useState<"cards" | "kanban" | "timeline">("cards");
  const [searchTerm, setSearchTerm] = useState("");
  const [healthFilter, setHealthFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredProjects = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return projects.filter((p) => {
      if (q) {
        const owner = p.owner_id ? (employees.find((e) => e.id === p.owner_id)?.full_name || "") : "";
        const hay = `${p.name} ${p.description ?? ""} ${owner}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (healthFilter !== "all" && (p.health_status || "green") !== healthFilter) return false;
      if (statusFilter === "active" && !p.is_active) return false;
      if (statusFilter === "inactive" && p.is_active) return false;
      return true;
    });
  }, [projects, employees, searchTerm, healthFilter, statusFilter]);

  const employeeMap = useMemo(() => {
    const m = new Map<string, string>();
    employees.forEach((e) => m.set(e.id, e.full_name));
    return m;
  }, [employees]);

  const load = async () => {
    setLoading(true);
    const [{ data: projData }, { data: empData }] = await Promise.all([
      supabase
        .from("projects")
        .select(
          "id, name, description, is_active, created_at, owner_id, health_status, contract_start_date, contract_end_date",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name, is_active")
        .eq("is_active", true)
        .order("full_name", { ascending: true }),
    ]);
    setProjects(projData ?? []);
    setEmployees(empData ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const description = String(fd.get("description") ?? "").trim() || null;
    if (name.length < 2 || name.length > 150) {
      toast.error("اسم المشروع يجب أن يكون بين 2 و 150 حرفًا");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("projects").insert({
      name,
      description,
      owner_id: ownerId === UNASSIGNED ? null : ownerId,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم إضافة المشروع");
    setOpen(false);
    setOwnerId(UNASSIGNED);
    load();
  };

  const openEdit = (p: Project) => {
    setEditing(p);
    setEditName(p.name);
    setEditDesc(p.description ?? "");
    setEditOwner(p.owner_id ?? UNASSIGNED);
    setEditActive(p.is_active);
  };

  const handleEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    const name = editName.trim();
    if (name.length < 2 || name.length > 150) {
      toast.error("اسم المشروع يجب أن يكون بين 2 و 150 حرفًا");
      return;
    }
    setEditSubmitting(true);
    const { error } = await supabase
      .from("projects")
      .update({
        name,
        description: editDesc.trim() || null,
        owner_id: editOwner === UNASSIGNED ? null : editOwner,
        is_active: editActive,
      })
      .eq("id", editing.id);
    setEditSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم تحديث المشروع");
    setEditing(null);
    load();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteSubmitting(true);
    const { error } = await supabase.from("projects").delete().eq("id", deleting.id);
    setDeleteSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم حذف المشروع");
    setDeleting(null);
    load();
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="projects-list-page">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/dashboard">الرئيسية</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>المشاريع</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">المشاريع</h1>
          <p className="text-muted-foreground mt-1">إدارة قائمة المشاريع المتاحة للموظفين</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/projects/dashboard">
              <BarChart3 className="h-4 w-4 ms-1" /> لوحة التحليلات
            </Link>
          </Button>
          {isManager && (
            <>
              <BulkImportDialog
                title="استيراد مشاريع من Excel"
                description="حمّل القالب وعبّيه، ثم ارفعه ليتم إضافة المشاريع دفعة واحدة."
                templateFileName="projects-template"
                columns={PROJECT_IMPORT_COLUMNS}
                triggerLabel="استيراد Excel"
                onImport={async (rows) => bulkImportProjects({ data: { rows: rows as any } })}
                onDone={load}
              />
              <BulkLinkProjectsToModuleDialog
                onDone={load}
                trigger={
                  <Button variant="outline" className="gap-1.5">
                    <Layers className="h-4 w-4" /> ربط أنظمة بمشاريع
                  </Button>
                }
              />
              <BulkUnlinkModuleFromProjectsDialog
                onDone={load}
                trigger={
                  <Button variant="outline" className="gap-1.5">
                    <Unlink className="h-4 w-4" /> إلغاء ربط دفعي
                  </Button>
                }
              />
            </>
          )}
        </div>
        {isManager && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setOwnerId(UNASSIGNED); }}>
            <DialogTrigger asChild>
              <Button size="lg" className="shadow-[var(--shadow-elegant)]">
                <Plus className="h-4 w-4 ms-1.5" /> مشروع جديد
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>إضافة مشروع</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="p-name">اسم المشروع *</Label>
                  <Input id="p-name" name="name" required maxLength={150} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-desc">الوصف</Label>
                  <Textarea id="p-desc" name="description" rows={3} maxLength={500} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-owner">الموظف المسؤول</Label>
                  <Select value={ownerId} onValueChange={setOwnerId}>
                    <SelectTrigger id="p-owner">
                      <SelectValue placeholder="اختر موظفًا (اختياري)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>بدون مسؤول</SelectItem>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
                  حفظ
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* View switcher */}
      <div className="flex items-center gap-1 border-b">
        <button
          type="button"
          onClick={() => setView("cards")}
          className={`px-3 py-2 text-sm flex items-center gap-1.5 border-b-2 transition-colors ${
            view === "cards" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutGrid className="h-4 w-4" /> بطاقات
        </button>
        <button
          type="button"
          onClick={() => setView("kanban")}
          className={`px-3 py-2 text-sm flex items-center gap-1.5 border-b-2 transition-colors ${
            view === "kanban" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <KanbanSquare className="h-4 w-4" /> Kanban
        </button>
        <button
          type="button"
          onClick={() => setView("timeline")}
          className={`px-3 py-2 text-sm flex items-center gap-1.5 border-b-2 transition-colors ${
            view === "timeline" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <GanttChart className="h-4 w-4" /> الخط الزمني
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="ابحث باسم المشروع أو الوصف أو المسؤول..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 min-w-[220px] max-w-md"
        />
        <Select value={healthFilter} onValueChange={setHealthFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="الحالة الصحية" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="green">صحي</SelectItem>
            <SelectItem value="yellow">تحذير</SelectItem>
            <SelectItem value="red">حرج</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="نشط/معطّل" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="active">نشط فقط</SelectItem>
            <SelectItem value="inactive">معطّل فقط</SelectItem>
          </SelectContent>
        </Select>
        {(searchTerm || healthFilter !== "all" || statusFilter !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(""); setHealthFilter("all"); setStatusFilter("all"); }}>
            مسح
          </Button>
        )}
        <span className="text-xs text-muted-foreground ms-auto">
          {filteredProjects.length} من {projects.length}
        </span>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">جارٍ التحميل...</div>
      ) : projects.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderKanban className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">لا توجد مشاريع بعد.</p>
        </Card>
      ) : filteredProjects.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderKanban className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">لا توجد نتائج تطابق البحث.</p>
        </Card>
      ) : view === "kanban" ? (
        <Suspense fallback={<Card className="p-12 text-center text-muted-foreground">جارٍ التحميل…</Card>}>
          <ProjectKanbanBoard projects={filteredProjects} employeeMap={employeeMap} />
        </Suspense>
      ) : view === "timeline" ? (
        <Suspense fallback={<Card className="p-12 text-center text-muted-foreground">جارٍ التحميل…</Card>}>
          <ProjectTimelineView projects={filteredProjects} />
        </Suspense>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((p) => (
            <Card key={p.id} className="p-5 hover:shadow-[var(--shadow-elegant)] transition-[var(--transition-smooth)]">
              <div className="flex items-start justify-between">
                <Link to="/projects/$projectId" params={{ projectId: p.id }} className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <FolderKanban className="h-5 w-5" />
                </Link>
                {p.is_active ? <Badge variant="secondary">نشط</Badge> : <Badge variant="outline">معطّل</Badge>}
              </div>
              <Link to="/projects/$projectId" params={{ projectId: p.id }} className="block">
                <h3 className="font-semibold mt-3 hover:text-primary transition-colors">{p.name}</h3>
                {p.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{p.description}</p>}
              </Link>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                <span>{p.owner_id ? employeeMap.get(p.owner_id) ?? "موظف غير معروف" : "بدون مسؤول"}</span>
              </div>
              <div className="mt-4 flex items-center gap-2 pt-3 border-t flex-wrap">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/projects/$projectId" params={{ projectId: p.id }}>
                    فتح
                  </Link>
                </Button>
                {isManager && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                      <Pencil className="h-3.5 w-3.5 ms-1" /> تعديل
                    </Button>
                    {canDelete && (
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleting(p)}>
                        <Trash2 className="h-3.5 w-3.5 ms-1" /> حذف
                      </Button>
                    )}
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>تعديل المشروع</DialogTitle></DialogHeader>
          <Tabs defaultValue="details" className="pt-2">
            <TabsList className="w-full">
              <TabsTrigger value="details" className="flex-1">التفاصيل</TabsTrigger>
              <TabsTrigger value="modules" className="flex-1">الأنظمة المرتبطة</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="pt-4">
              <form onSubmit={handleEdit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="e-name">اسم المشروع *</Label>
                  <Input id="e-name" value={editName} onChange={(e) => setEditName(e.target.value)} required maxLength={150} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e-desc">الوصف</Label>
                  <Textarea id="e-desc" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} maxLength={500} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e-owner">الموظف المسؤول</Label>
                  <Select value={editOwner} onValueChange={setEditOwner}>
                    <SelectTrigger id="e-owner">
                      <SelectValue placeholder="اختر موظفًا (اختياري)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>بدون مسؤول</SelectItem>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor="e-active" className="cursor-pointer">المشروع نشط</Label>
                  <Switch id="e-active" checked={editActive} onCheckedChange={setEditActive} />
                </div>
                <Button type="submit" disabled={editSubmitting} className="w-full">
                  {editSubmitting && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
                  حفظ التعديلات
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="modules" className="pt-4">
              {editing && <ProjectModulesManager projectId={editing.id} canMutate={isManager} />}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المشروع</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف "{deleting?.name}"؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubmitting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleteSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSubmitting && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
