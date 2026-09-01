import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, ShieldAlert, Users, Trash2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { logError } from "@/lib/log-error";

export const Route = createFileRoute("/_app/settings/employees")({
  head: () => ({
    meta: [
      { title: "إعدادات الموظفين — لوحة التحكم" },
      { name: "description", content: "إدارة بيانات الموظفين، أقسامهم، أدوارهم، وصلاحية الدخول للنظام." },
      { property: "og:title", content: "إعدادات الموظفين" },
      { property: "og:description", content: "إدارة أدوار الموظفين وصلاحية الدخول والأقسام." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmployeesSettings,
});

const ALL_ROLES = ["admin", "general_manager", "manager", "employee", "support"] as const;
type AppRole = (typeof ALL_ROLES)[number];

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "إداري النظام",
  general_manager: "مدير عام",
  manager: "مدير قسم",
  employee: "موظف",
  support: "دعم فني",
};

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  job_title: string | null;
  is_active: boolean;
  department_id: string | null;
  job_position_id: string | null;
  manager_id: string | null;
}
interface Dept { id: string; name: string; parent_id: string | null }
interface Position { id: string; title: string; department_id: string }
interface RoleRow { id: string; user_id: string; role: AppRole }

function EmployeesSettings() {
  const { user, roles: myRoles } = useAuth();
  const isAdmin = myRoles.includes("admin");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [roleRows, setRoleRows] = useState<RoleRow[]>([]);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [addRole, setAddRole] = useState<Record<string, AppRole>>({});

  const load = async () => {
    setLoading(true);
    try {
      const [p, d, jp, r] = await Promise.all([
        supabase.from("profiles")
          .select("id, full_name, email, job_title, is_active, department_id, job_position_id, manager_id")
          .order("full_name"),
        supabase.from("departments").select("id, name, parent_id").order("sort_order"),
        supabase.from("job_positions").select("id, title, department_id").order("sort_order"),
        supabase.from("user_roles").select("id, user_id, role"),
      ]);
      if (p.error) throw p.error;
      setProfiles((p.data ?? []) as Profile[]);
      setDepts((d.data ?? []) as Dept[]);
      setPositions((jp.data ?? []) as Position[]);
      setRoleRows((r.data ?? []) as RoleRow[]);
    } catch (e) {
      logError(e, { scope: "employeesSettings.load" });
      toast.error("فشل تحميل بيانات الموظفين");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const rolesOf = (uid: string) => roleRows.filter((r) => r.user_id === uid);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles.filter((p) => {
      if (q && !(p.full_name ?? "").toLowerCase().includes(q) && !(p.email ?? "").toLowerCase().includes(q)) return false;
      if (deptFilter !== "all" && p.department_id !== deptFilter) return false;
      if (statusFilter === "active" && !p.is_active) return false;
      if (statusFilter === "blocked" && p.is_active) return false;
      return true;
    });
  }, [profiles, search, deptFilter, statusFilter]);

  const patchProfile = async (id: string, patch: Partial<Profile>, key: string) => {
    setBusy(key);
    try {
      const { error } = await supabase.from("profiles").update(patch as never).eq("id", id);
      if (error) throw error;
      setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      toast.success("تم الحفظ");
    } catch (e: unknown) {
      logError(e, { scope: "employeesSettings.patch" });
      toast.error("فشل الحفظ");
    } finally {
      setBusy(null);
    }
  };

  const toggleAccess = (p: Profile) => {
    if (p.id === user?.id && p.is_active) {
      if (!confirm("سيؤدي هذا إلى إيقاف دخولك أنت للنظام. متابعة؟")) return;
    }
    patchProfile(p.id, { is_active: !p.is_active }, `acc-${p.id}`);
  };

  const grantRole = async (uid: string) => {
    const role = addRole[uid];
    if (!role) { toast.error("اختر دوراً أولاً"); return; }
    setBusy(`grant-${uid}`);
    try {
      const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
      if (error) {
        if (error.code === "23505") { toast.error("الدور معيّن بالفعل"); return; }
        throw error;
      }
      toast.success("تم منح الدور");
      await load();
    } catch (e: unknown) {
      logError(e, { scope: "employeesSettings.grant" });
      toast.error("فشل منح الدور");
    } finally { setBusy(null); }
  };

  const revokeRole = async (row: RoleRow) => {
    if (row.user_id === user?.id && row.role === "admin" && !confirm("ستزيل دور admin من حسابك. متابعة؟")) return;
    setBusy(`rev-${row.id}`);
    try {
      const { error } = await supabase.from("user_roles").delete().eq("id", row.id);
      if (error) throw error;
      setRoleRows((prev) => prev.filter((r) => r.id !== row.id));
      toast.success("تم سحب الدور");
    } catch (e: unknown) {
      logError(e, { scope: "employeesSettings.revoke" });
      toast.error("فشل سحب الدور");
    } finally { setBusy(null); }
  };

  if (!isAdmin) {
    return (
      <Card className="p-8 text-center max-w-md mx-auto">
        <ShieldAlert className="h-10 w-10 mx-auto text-destructive mb-3" />
        <div className="font-semibold mb-1">صلاحيات غير كافية</div>
        <div className="text-sm text-muted-foreground">إعدادات الموظفين متاحة لإداري النظام (admin) فقط.</div>
      </Card>
    );
  }

  const activeCount = profiles.filter((p) => p.is_active).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> إعدادات الموظفين
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {profiles.length} موظف · {activeCount} لديهم صلاحية دخول · تعديل القسم، الوظيفة، المدير، الأدوار والدخول.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
          <RefreshCw className="h-4 w-4" /> تحديث
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو البريد..." className="pe-9" />
          </div>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأقسام</SelectItem>
              {depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="active">مسموح بالدخول</SelectItem>
              <SelectItem value="blocked">موقوف</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">لا توجد نتائج مطابقة.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الموظف</TableHead>
                  <TableHead className="min-w-[170px]">القسم</TableHead>
                  <TableHead className="min-w-[170px]">المسمى الوظيفي</TableHead>
                  <TableHead className="min-w-[170px]">المدير المباشر</TableHead>
                  <TableHead className="min-w-[260px]">الأدوار</TableHead>
                  <TableHead className="min-w-[130px]">صلاحية الدخول</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const myPositions = positions.filter((x) => x.department_id === p.department_id);
                  const list = rolesOf(p.id);
                  return (
                    <TableRow key={p.id} className={p.is_active ? "" : "opacity-60"}>
                      <TableCell>
                        <div className="font-medium">{p.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{p.email || "—"}</div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={p.department_id ?? "none"}
                          onValueChange={(v) => patchProfile(p.id, { department_id: v === "none" ? null : v, job_position_id: null }, `d-${p.id}`)}
                        >
                          <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">بدون قسم</SelectItem>
                            {depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={p.job_position_id ?? "none"}
                          onValueChange={(v) => patchProfile(p.id, { job_position_id: v === "none" ? null : v }, `j-${p.id}`)}
                          disabled={!p.department_id}
                        >
                          <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">بدون مسمى</SelectItem>
                            {myPositions.map((x) => <SelectItem key={x.id} value={x.id}>{x.title}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={p.manager_id ?? "none"}
                          onValueChange={(v) => patchProfile(p.id, { manager_id: v === "none" ? null : v }, `m-${p.id}`)}
                        >
                          <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">بدون مدير</SelectItem>
                            {profiles.filter((x) => x.id !== p.id).map((x) => (
                              <SelectItem key={x.id} value={x.id}>{x.full_name || x.email}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {list.length === 0 && <Badge variant="outline">بدون دور</Badge>}
                          {list.map((r) => (
                            <Badge key={r.id} variant="secondary" className="gap-1">
                              {ROLE_LABEL[r.role] ?? r.role}
                              <button onClick={() => revokeRole(r)} disabled={busy === `rev-${r.id}`} title="سحب الدور" className="ms-1 hover:text-destructive">
                                {busy === `rev-${r.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                              </button>
                            </Badge>
                          ))}
                          <div className="flex items-center gap-1">
                            <Select value={addRole[p.id] ?? ""} onValueChange={(v) => setAddRole((s) => ({ ...s, [p.id]: v as AppRole }))}>
                              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="إضافة دور" /></SelectTrigger>
                              <SelectContent>
                                {ALL_ROLES.filter((r) => !list.some((x) => x.role === r)).map((r) => (
                                  <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => grantRole(p.id)} disabled={busy === `grant-${p.id}`}>
                              {busy === `grant-${p.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch checked={p.is_active} onCheckedChange={() => toggleAccess(p)} disabled={busy === `acc-${p.id}`} />
                          <span className={`text-xs ${p.is_active ? "text-success" : "text-destructive"}`}>
                            {p.is_active ? "مسموح" : "موقوف"}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        ملاحظة: إيقاف صلاحية الدخول يمنع الموظف من استخدام النظام ويُخفيه من قوائم الإسناد، ولا يحذف بياناته أو مهامه.
      </p>
    </div>
  );
}

export default EmployeesSettings;
