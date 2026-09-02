import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatErrorMessage } from "@/lib/error-messages";
import { logError } from "@/lib/log-error";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  ShieldCheck,
  Save,
  UserPlus,
  Mail,
  KeyRound,
  Trash2,
  Download,
  MoreVertical,
  Power,
  PowerOff,
  Search,
  
} from "lucide-react";
import { toast } from "sonner";
import {
  createEmployee,
  inviteEmployee,
  resetEmployeePassword,
  setEmployeeActive,
  deleteEmployee,
} from "@/lib/employees.functions";
import { bulkImportEmployees } from "@/lib/bulk-import.functions";
import { OrgStructureManager } from "@/components/org/OrgStructureManager";
import { BulkImportDialog, type BulkImportColumn } from "@/components/BulkImportDialog";

const EMPLOYEE_IMPORT_COLUMNS: BulkImportColumn[] = [
  { key: "full_name", header: "الاسم الكامل", example: "أحمد محمد", required: true },
  { key: "email", header: "البريد الإلكتروني", example: "ahmed@example.com", required: true, note: "يجب أن يكون فريدًا" },
  { key: "password", header: "كلمة السر المؤقتة", example: "Aa12345!", note: "اختياري — لو فاضي سيتم توليد كلمة سر تلقائيًا" },
  { key: "phone", header: "رقم الموبايل", example: "+201234567890" },
  { key: "job_title", header: "المسمى الوظيفي", example: "مهندس برمجيات" },
  { key: "department", header: "القسم", example: "تقنية المعلومات" },
  { key: "hire_date", header: "تاريخ التعيين", example: "2024-01-15", note: "صيغة YYYY-MM-DD" },
  { key: "role", header: "الدور", example: "employee", note: "admin | general_manager | manager | employee" },
  { key: "manager_email", header: "بريد المدير المباشر", example: "manager@example.com", note: "يتم الربط بعد إنشاء كل الحسابات" },
];

export const Route = createFileRoute("/_app/admin/")({
  component: AdminPage,
});

type AppRole = "admin" | "general_manager" | "manager" | "employee";

interface EmployeeRow {
  id: string;
  full_name: string;
  email: string | null;
  job_title: string | null;
  manager_id: string | null;
  phone: string | null;
  department: string | null;
  department_id: string | null;
  job_position_id: string | null;
  hire_date: string | null;
  is_active: boolean;
  roles: AppRole[];
}

interface DepartmentLite { id: string; name: string; parent_id: string | null }
interface JobPositionLite { id: string; title: string; department_id: string; level: number }

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "أدمن",
  general_manager: "مدير عام",
  manager: "مدير",
  employee: "موظف",
};

const ROLE_VARIANT: Record<AppRole, "default" | "secondary" | "outline"> = {
  admin: "default",
  general_manager: "default",
  manager: "secondary",
  employee: "outline",
};

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p + "!9";
}

function AdminPage() {
  const { roles, user } = useAuth();
  const isAdmin = roles.includes("admin");
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentLite[]>([]);
  const [positions, setPositions] = useState<JobPositionLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modules, setModules] = useState<Array<{ id: string; name: string; parent_id: string | null }>>([]);
  const [empModules, setEmpModules] = useState<Array<{ user_id: string; module_id: string }>>([]);
  const [moduleFilter, setModuleFilter] = useState<string>("all");

  const [savingId, setSavingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: profs }, { data: rolesData }, { data: depts }, { data: poss }, { data: mods }, { data: emods }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, job_title, manager_id, phone, department, department_id, job_position_id, hire_date, is_active")
        .order("full_name"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("departments").select("id, name, parent_id").eq("is_active", true).order("name"),
      supabase.from("job_positions").select("id, title, department_id, level").eq("is_active", true).order("level"),
      supabase.from("company_modules").select("id, name, parent_id").eq("is_active", true).order("sort_order"),
      supabase.from("employee_modules").select("user_id, module_id"),
    ]);
    setModules((mods ?? []) as Array<{ id: string; name: string; parent_id: string | null }>);
    setEmpModules((emods ?? []) as Array<{ user_id: string; module_id: string }>);

    const rolesMap = new Map<string, AppRole[]>();
    (rolesData ?? []).forEach((r) => {
      const arr = rolesMap.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      rolesMap.set(r.user_id, arr);
    });
    const list: EmployeeRow[] = (profs ?? []).map((p: any) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      job_title: p.job_title,
      manager_id: p.manager_id,
      phone: p.phone ?? null,
      department: p.department ?? null,
      department_id: p.department_id ?? null,
      job_position_id: p.job_position_id ?? null,
      hire_date: p.hire_date ?? null,
      is_active: p.is_active ?? true,
      roles: rolesMap.get(p.id) ?? [],
    }));
    setRows(list);
    setDepartments((depts ?? []) as DepartmentLite[]);
    setPositions((poss ?? []) as JobPositionLite[]);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <Card className="p-12 text-center">
        <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground">هذه الصفحة متاحة للأدمن فقط.</p>
      </Card>
    );
  }

  const update = (id: string, patch: Partial<EmployeeRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const saveRow = async (row: EmployeeRow) => {
    setSavingId(row.id);
    const { error: pErr } = await supabase
      .from("profiles")
      .update({
        full_name: row.full_name,
        job_title: row.job_title,
        manager_id: row.manager_id,
        phone: row.phone,
        department: row.department,
        department_id: row.department_id,
        job_position_id: row.job_position_id,
        hire_date: row.hire_date,
      })
      .eq("id", row.id);
    if (pErr) {
      toast.error(pErr.message);
      setSavingId(null);
      return;
    }
    const primary = row.roles[0] ?? "employee";
    await supabase.from("user_roles").delete().eq("user_id", row.id);
    const { error: rErr } = await supabase.from("user_roles").insert({ user_id: row.id, role: primary });
    setSavingId(null);
    if (rErr) {
      toast.error(rErr.message);
      return;
    }
    toast.success("تم حفظ التعديلات");
    load();
  };

  // module scope: selecting a parent system includes its sub-systems
  const moduleScope = (id: string): Set<string> => {
    const set = new Set<string>([id]);
    let added = true;
    while (added) {
      added = false;
      modules.forEach((m) => {
        if (m.parent_id && set.has(m.parent_id) && !set.has(m.id)) {
          set.add(m.id);
          added = true;
        }
      });
    }
    return set;
  };

  const filtered = rows.filter((r) => {
    if (moduleFilter !== "all") {
      const mine = empModules.filter((e) => e.user_id === r.id).map((e) => e.module_id);
      if (moduleFilter === "none") {
        if (mine.length > 0) return false;
      } else {
        const scope = moduleScope(moduleFilter);
        if (!mine.some((m) => scope.has(m))) return false;
      }
    }
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.full_name.toLowerCase().includes(q) ||
      (r.email ?? "").toLowerCase().includes(q) ||
      (r.job_title ?? "").toLowerCase().includes(q) ||
      (r.department ?? "").toLowerCase().includes(q)
    );
  });


  const exportCsv = () => {
    const header = ["الاسم", "البريد", "الهاتف", "المسمى", "القسم", "تاريخ التعيين", "الدور", "المدير", "الحالة"];
    const managerName = (id: string | null) => rows.find((m) => m.id === id)?.full_name ?? "";
    const lines = [header.join(",")];
    filtered.forEach((r) => {
      const cells = [
        r.full_name,
        r.email ?? "",
        r.phone ?? "",
        r.job_title ?? "",
        r.department ?? "",
        r.hire_date ?? "",
        ROLE_LABEL[r.roles[0] ?? "employee"],
        managerName(r.manager_id),
        r.is_active ? "نشط" : "معطل",
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
      lines.push(cells.join(","));
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `employees-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">إدارة الموظفين</h1>
          <p className="text-muted-foreground mt-1">إضافة موظفين، تعيين الأدوار، وربطهم بمدرائهم</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9 max-w-xs"
            />
          </div>
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="كل الأنظمة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأنظمة</SelectItem>
              {modules.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.parent_id ? `— ${m.name}` : m.name}</SelectItem>
              ))}
              <SelectItem value="none">بدون نظام</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4 ms-1.5" />
            تصدير CSV
          </Button>
          <BulkImportDialog
            title="استيراد موظفين من Excel"
            description="حمّل القالب وعبّيه، ثم ارفعه ليتم إنشاء الحسابات."
            templateFileName="employees-template"
            columns={EMPLOYEE_IMPORT_COLUMNS}
            triggerLabel="استيراد Excel"
            onImport={async (rows) => bulkImportEmployees({ data: { rows: rows as any } })}
            onDone={load}
          />
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 ms-1.5" />
                إضافة موظف
              </Button>
            </DialogTrigger>
            <AddEmployeeDialog
              managers={rows.filter((m) => m.roles.some((rr) => ["admin", "general_manager", "manager"].includes(rr)))}
              departments={departments}
              positions={positions}
              onDone={() => {
                setAddOpen(false);
                load();
              }}
            />
          </Dialog>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/roles">إدارة الأدوار</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/permissions">مصفوفة الصلاحيات</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/permissions-check">فحص الصلاحيات</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/settings/audit">سجل التدقيق</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/hierarchy">الهيكل التنظيمي</Link>
        </Button>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">قائمة الموظفين</TabsTrigger>
          <TabsTrigger value="org">الهيكل التنظيمي</TabsTrigger>
          <TabsTrigger value="structure">السلم الوظيفي</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <Card className="overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-muted-foreground">جارٍ التحميل...</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">لا توجد نتائج.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-start px-3 py-3 font-semibold">الاسم</th>
                      <th className="text-start px-3 py-3 font-semibold">البريد</th>
                      <th className="text-start px-3 py-3 font-semibold">الهاتف</th>
                      <th className="text-start px-3 py-3 font-semibold">المسمى</th>
                      <th className="text-start px-3 py-3 font-semibold">القسم</th>
                      <th className="text-start px-3 py-3 font-semibold">المنصب الوظيفي</th>
                      <th className="text-start px-3 py-3 font-semibold">التعيين</th>
                      <th className="text-start px-3 py-3 font-semibold">الدور</th>
                      <th className="text-start px-3 py-3 font-semibold">المدير</th>
                      <th className="text-start px-3 py-3 font-semibold">الحالة</th>
                      <th className="text-start px-3 py-3 font-semibold w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id} className="border-t hover:bg-muted/30">
                        <td className="px-3 py-2 min-w-[160px]">
                          <Input
                            value={r.full_name}
                            onChange={(e) => update(r.id, { full_name: e.target.value })}
                            className="h-8"
                          />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r.email ?? "—"}</td>
                        <td className="px-3 py-2 min-w-[130px]">
                          <Input
                            value={r.phone ?? ""}
                            onChange={(e) => update(r.id, { phone: e.target.value })}
                            className="h-8"
                            placeholder="—"
                          />
                        </td>
                        <td className="px-3 py-2 min-w-[140px]">
                          <Input
                            value={r.job_title ?? ""}
                            onChange={(e) => update(r.id, { job_title: e.target.value })}
                            className="h-8"
                            placeholder="—"
                          />
                        </td>
                        <td className="px-3 py-2 min-w-[160px]">
                          <Select
                            value={r.department_id ?? "__none__"}
                            onValueChange={(v) => update(r.id, {
                              department_id: v === "__none__" ? null : v,
                              // reset position if it doesn't belong to the new department
                              job_position_id:
                                v === "__none__" ||
                                positions.find((p) => p.id === r.job_position_id)?.department_id !== v
                                  ? null
                                  : r.job_position_id,
                            })}
                          >
                            <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— بدون —</SelectItem>
                              {departments.map((d) => (
                                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2 min-w-[160px]">
                          <Select
                            value={r.job_position_id ?? "__none__"}
                            onValueChange={(v) => update(r.id, { job_position_id: v === "__none__" ? null : v })}
                            disabled={!r.department_id}
                          >
                            <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— بدون —</SelectItem>
                              {positions.filter((p) => p.department_id === r.department_id).map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.title} (مستوى {p.level})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2 min-w-[140px]">
                          <Input
                            type="date"
                            value={r.hire_date ?? ""}
                            onChange={(e) => update(r.id, { hire_date: e.target.value || null })}
                            className="h-8"
                          />
                        </td>
                        <td className="px-3 py-2 min-w-[130px]">
                          <Select
                            value={r.roles[0] ?? "employee"}
                            onValueChange={(v) => update(r.id, { roles: [v as AppRole] })}
                          >
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(["admin", "general_manager", "manager", "employee"] as AppRole[]).map((role) => (
                                <SelectItem key={role} value={role}>{ROLE_LABEL[role]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2 min-w-[160px]">
                          <Select
                            value={r.manager_id ?? "__none__"}
                            onValueChange={(v) => update(r.id, { manager_id: v === "__none__" ? null : v })}
                          >
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— بدون —</SelectItem>
                              {rows
                                .filter((m) => m.id !== r.id && m.roles.some((rr) => ["admin", "general_manager", "manager"].includes(rr)))
                                .map((m) => (
                                  <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2">
                          {r.is_active ? (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-600/40">نشط</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">معطل</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <Button size="sm" onClick={() => saveRow(r)} disabled={savingId === r.id} title="حفظ">
                              {savingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            </Button>
                            <RowActions row={r} currentUserId={user?.id} onDone={load} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="org" className="mt-4">
          <OrgChart rows={rows} />
        </TabsContent>

        <TabsContent value="structure" className="mt-4">
          <OrgStructureManager canManage={true} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============== Add Employee Dialog ==============
function AddEmployeeDialog({
  managers,
  departments,
  positions,
  onDone,
}: {
  managers: EmployeeRow[];
  departments: DepartmentLite[];
  positions: JobPositionLite[];
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"create" | "invite">("create");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: randomPassword(),
    job_title: "",
    phone: "",
    department: "",
    department_id: "__none__",
    job_position_id: "__none__",
    hire_date: "",
    manager_id: "__none__",
    role: "employee" as AppRole,
  });

  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.full_name.trim() || !form.email.trim()) {
      toast.error("الاسم والبريد مطلوبان");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        job_title: form.job_title.trim() || null,
        phone: form.phone.trim() || null,
        department: form.department.trim() || null,
        department_id: form.department_id === "__none__" ? null : form.department_id,
        job_position_id: form.job_position_id === "__none__" ? null : form.job_position_id,
        hire_date: form.hire_date || null,
        manager_id: form.manager_id === "__none__" ? null : form.manager_id,
        role: form.role,
      };
      if (mode === "create") {
        if (!form.password || form.password.length < 8) {
          toast.error("كلمة السر يجب أن تكون 8 أحرف على الأقل");
          setSubmitting(false);
          return;
        }
        await createEmployee({ data: { ...payload, password: form.password } });
        toast.success("تم إنشاء الحساب — احفظ كلمة السر المؤقتة");
      } else {
        await inviteEmployee({
          data: { ...payload, redirect_to: `${window.location.origin}/auth` },
        });
        toast.success("تم إرسال دعوة بالإيميل");
      }
      onDone();
    } catch (e: unknown) {
      const msg = logError(e, {
        scope: mode === "create" ? "createEmployee" : "inviteEmployee",
        context: {
          email: form.email,
          full_name: form.full_name,
          role: form.role,
          manager_id: form.manager_id,
          password: mode === "create" ? form.password : undefined,
        },
        fallback: "فشلت العملية",
      });
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>إضافة موظف جديد</DialogTitle>
        <DialogDescription>
          أنشئ حساباً مباشرة بكلمة سر مؤقتة، أو أرسل دعوة بالإيميل ليعمل المستخدم كلمة السر بنفسه.
        </DialogDescription>
      </DialogHeader>

      <Tabs value={mode} onValueChange={(v) => setMode(v as "create" | "invite")}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="create">
            <KeyRound className="h-4 w-4 ms-1.5" />
            إنشاء حساب بكلمة سر
          </TabsTrigger>
          <TabsTrigger value="invite">
            <Mail className="h-4 w-4 ms-1.5" />
            دعوة بالإيميل
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        <div className="space-y-1.5">
          <Label>الاسم الكامل *</Label>
          <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>البريد الإلكتروني *</Label>
          <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} dir="ltr" />
        </div>
        {mode === "create" && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label>كلمة السر المؤقتة *</Label>
            <div className="flex gap-2">
              <Input value={form.password} onChange={(e) => set("password", e.target.value)} dir="ltr" />
              <Button type="button" variant="outline" onClick={() => set("password", randomPassword())}>
                توليد
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">احفظها وأرسلها للموظف ليغيّرها بعد الدخول.</p>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>المسمى الوظيفي</Label>
          <Input value={form.job_title} onChange={(e) => set("job_title", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>رقم الموبايل</Label>
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} dir="ltr" />
        </div>
        <div className="space-y-1.5">
          <Label>القسم (من السلم الوظيفي)</Label>
          <Select
            value={form.department_id}
            onValueChange={(v) => {
              setForm((p) => ({
                ...p,
                department_id: v,
                // reset position when department changes
                job_position_id: "__none__",
                // also keep free-text department in sync for legacy display
                department: v === "__none__" ? p.department : (departments.find((d) => d.id === v)?.name ?? p.department),
              }));
            }}
          >
            <SelectTrigger><SelectValue placeholder="اختر القسم" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— بدون —</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>المنصب الوظيفي</Label>
          <Select
            value={form.job_position_id}
            onValueChange={(v) => set("job_position_id", v)}
            disabled={form.department_id === "__none__"}
          >
            <SelectTrigger>
              <SelectValue placeholder={form.department_id === "__none__" ? "اختر القسم أولاً" : "اختر المنصب"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— بدون —</SelectItem>
              {positions
                .filter((p) => p.department_id === form.department_id)
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.title} (مستوى {p.level})</SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>تاريخ التعيين</Label>
          <Input type="date" value={form.hire_date} onChange={(e) => set("hire_date", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>الدور / الصلاحية</Label>
          <Select value={form.role} onValueChange={(v) => set("role", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["admin", "general_manager", "manager", "employee"] as AppRole[]).map((role) => (
                <SelectItem key={role} value={role}>{ROLE_LABEL[role]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>المدير المباشر</Label>
          <Select value={form.manager_id} onValueChange={(v) => set("manager_id", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— بدون —</SelectItem>
              {managers.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button onClick={submit} disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin ms-1.5" />}
          {mode === "create" ? "إنشاء الحساب" : "إرسال الدعوة"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ============== Row Actions ==============
function RowActions({
  row,
  currentUserId,
  onDone,
}: {
  row: EmployeeRow;
  currentUserId?: string;
  onDone: () => void;
}) {
  const [resetOpen, setResetOpen] = useState(false);
  const [newPwd, setNewPwd] = useState(randomPassword());
  const [busy, setBusy] = useState(false);
  const isSelf = row.id === currentUserId;

  const toggleActive = async () => {
    setBusy(true);
    try {
      await setEmployeeActive({ data: { user_id: row.id, is_active: !row.is_active } });
      toast.success(row.is_active ? "تم تعطيل الموظف" : "تم تفعيل الموظف");
      onDone();
    } catch (e: unknown) {
      toast.error(
        logError(e, {
          scope: "setEmployeeActive",
          context: { user_id: row.id, email: row.email, target_state: !row.is_active },
          fallback: "فشل تغيير حالة الحساب",
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await deleteEmployee({ data: { user_id: row.id } });
      toast.success("تم الحذف");
      onDone();
    } catch (e: unknown) {
      toast.error(
        logError(e, {
          scope: "deleteEmployee",
          context: { user_id: row.id, email: row.email, full_name: row.full_name },
          fallback: "فشل الحذف",
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  const doReset = async () => {
    setBusy(true);
    try {
      await resetEmployeePassword({ data: { user_id: row.id, new_password: newPwd } });
      toast.success("تم تغيير كلمة السر");
      setResetOpen(false);
    } catch (e: unknown) {
      toast.error(
        logError(e, {
          scope: "resetEmployeePassword",
          context: { user_id: row.id, email: row.email, new_password: newPwd },
          fallback: "فشل تغيير كلمة السر",
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" disabled={busy}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => { setNewPwd(randomPassword()); setResetOpen(true); }}>
            <KeyRound className="h-3.5 w-3.5 ms-2" />
            إعادة تعيين كلمة السر
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleActive}>
            {row.is_active ? (
              <><PowerOff className="h-3.5 w-3.5 ms-2" />تعطيل الحساب</>
            ) : (
              <><Power className="h-3.5 w-3.5 ms-2" />تفعيل الحساب</>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                disabled={isSelf}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 ms-2" />
                حذف نهائي
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>حذف {row.full_name}؟</AlertDialogTitle>
                <AlertDialogDescription>
                  سيتم حذف الحساب نهائياً ولن يمكن استعادته. يفضّل التعطيل بدل الحذف.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  حذف
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إعادة تعيين كلمة السر</DialogTitle>
            <DialogDescription>{row.full_name} — {row.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>كلمة السر الجديدة</Label>
            <div className="flex gap-2">
              <Input value={newPwd} onChange={(e) => setNewPwd(e.target.value)} dir="ltr" />
              <Button type="button" variant="outline" onClick={() => setNewPwd(randomPassword())}>توليد</Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={doReset} disabled={busy || newPwd.length < 8}>
              {busy && <Loader2 className="h-4 w-4 animate-spin ms-1.5" />}
              تأكيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============== Org Chart ==============
function OrgChart({ rows }: { rows: EmployeeRow[] }) {
  const tree = useMemo(() => {
    const byManager = new Map<string | null, EmployeeRow[]>();
    rows.forEach((r) => {
      const k = r.manager_id ?? null;
      const arr = byManager.get(k) ?? [];
      arr.push(r);
      byManager.set(k, arr);
    });
    return byManager;
  }, [rows]);

  const roots = tree.get(null) ?? [];

  const renderNode = (node: EmployeeRow, depth: number): React.ReactNode => {
    const children = tree.get(node.id) ?? [];
    return (
      <div key={node.id} className="space-y-2">
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition">
          <div className="h-9 w-9 rounded-full bg-[image:var(--gradient-primary)] flex items-center justify-center text-primary-foreground font-bold">
            {node.full_name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{node.full_name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {node.job_title || "—"}{node.department ? ` · ${node.department}` : ""}
            </div>
          </div>
          <Badge variant={ROLE_VARIANT[node.roles[0] ?? "employee"]}>
            {ROLE_LABEL[node.roles[0] ?? "employee"]}
          </Badge>
          {!node.is_active && <Badge variant="outline" className="text-muted-foreground">معطل</Badge>}
        </div>
        {children.length > 0 && (
          <div className="ms-6 ps-4 border-s-2 border-dashed space-y-2">
            {children.map((c) => renderNode(c, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (rows.length === 0) {
    return <Card className="p-12 text-center text-muted-foreground">لا يوجد موظفون.</Card>;
  }

  return (
    <Card className="p-6 space-y-3">
      {roots.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">لا يوجد موظفون بدون مدير. عيّن المدير الأعلى من قائمة الموظفين.</p>
      ) : (
        roots.map((r) => renderNode(r, 0))
      )}
    </Card>
  );
}
