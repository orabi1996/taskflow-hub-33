import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  ShieldCheck,
  ArrowLeft,
  Search,
  UserPlus,
  Trash2,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { logError } from "@/lib/log-error";

export const Route = createFileRoute("/_app/admin/roles")({
  head: () => ({
    meta: [
      { title: "إدارة الأدوار — لوحة التحكم" },
      { name: "description", content: "تعيين وإلغاء أدوار المستخدمين والبحث بالبريد." },
    ],
  }),
  component: RolesPage,
});

const ALL_ROLES = ["admin", "support", "general_manager", "manager", "employee"] as const;
type AppRole = (typeof ALL_ROLES)[number];

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface UserRoleRow {
  id: string;
  user_id: string;
  role: AppRole;
}

function RolesPage() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [assignRole, setAssignRole] = useState<Record<string, AppRole>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // gate access to admin only
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const allowed = (data ?? []).some((r: any) => r.role === "admin");
      setIsAdmin(allowed);
    })();
  }, [user]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [pRes, rRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email")
          .order("full_name", { ascending: true }),
        supabase.from("user_roles").select("id, user_id, role"),
      ]);
      if (pRes.error) throw pRes.error;
      if (rRes.error) throw rRes.error;
      setProfiles((pRes.data ?? []) as Profile[]);
      setRoles((rRes.data ?? []) as UserRoleRow[]);
    } catch (e) {
      logError(e, { scope: "loadRoles" });
      toast.error("فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadAll();
  }, [isAdmin]);

  const rolesByUser = useMemo(() => {
    const map = new Map<string, UserRoleRow[]>();
    for (const r of roles) {
      const arr = map.get(r.user_id) ?? [];
      arr.push(r);
      map.set(r.user_id, arr);
    }
    return map;
  }, [roles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        (p.email ?? "").toLowerCase().includes(q) ||
        (p.full_name ?? "").toLowerCase().includes(q),
    );
  }, [profiles, search]);

  const assign = async (userId: string) => {
    const role = assignRole[userId];
    if (!role) {
      toast.error("اختر دوراً أولاً");
      return;
    }
    const key = `assign-${userId}`;
    setBusyKey(key);
    try {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role });
      if (error) {
        if (error.code === "23505") {
          toast.error("هذا الدور معيّن بالفعل لهذا المستخدم");
        } else {
          throw error;
        }
      } else {
        toast.success("تم تعيين الدور");
        await loadAll();
      }
    } catch (e: any) {
      logError(e, { scope: "assignRole" });
      toast.error(e?.message ?? "فشل تعيين الدور");
    } finally {
      setBusyKey(null);
    }
  };

  const unassign = async (rowId: string, userId: string, role: AppRole) => {
    if (user?.id === userId && role === "admin") {
      const ok = confirm(
        "تحذير: ستقوم بإزالة دور admin من حسابك أنت. هل أنت متأكد؟",
      );
      if (!ok) return;
    }
    const key = `unassign-${rowId}`;
    setBusyKey(key);
    try {
      const { error } = await supabase.from("user_roles").delete().eq("id", rowId);
      if (error) throw error;
      toast.success("تم إلغاء الدور");
      await loadAll();
    } catch (e: any) {
      logError(e, { scope: "unassignRole" });
      toast.error(e?.message ?? "فشل إلغاء الدور");
    } finally {
      setBusyKey(null);
    }
  };

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-8">
        <Card className="p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <h2 className="text-lg font-semibold">صلاحية غير كافية</h2>
          <p className="text-sm text-muted-foreground mt-2">
            هذه الصفحة متاحة لمدير النظام (admin) فقط.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto" dir="rtl">
      <div>
        <Link
          to="/admin"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          عودة للوحة التحكم
        </Link>
        <PageHeader
          icon={KeyRound}
          title="إدارة أدوار المستخدمين"
          description="ابحث عن مستخدم بالبريد أو الاسم، ثم عيّن أو ألغِ دوره."
        />

      </div>

      <Card className="p-4 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالبريد أو الاسم..."
              className="pe-9"
            />
          </div>
          <Button variant="outline" onClick={loadAll} disabled={loading}>
            تحديث
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            لا توجد نتائج مطابقة.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>البريد</TableHead>
                  <TableHead>الأدوار الحالية</TableHead>
                  <TableHead className="min-w-[260px]">تعيين دور</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const userRolesList = rolesByUser.get(p.id) ?? [];
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {p.full_name || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.email || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {userRolesList.length === 0 ? (
                            <Badge variant="outline">لا توجد</Badge>
                          ) : (
                            userRolesList.map((r) => (
                              <Badge
                                key={r.id}
                                variant="secondary"
                                className="flex items-center gap-1"
                              >
                                {r.role}
                                <button
                                  className="ms-1 hover:text-destructive disabled:opacity-50"
                                  onClick={() => unassign(r.id, p.id, r.role)}
                                  disabled={busyKey === `unassign-${r.id}`}
                                  title="إلغاء الدور"
                                >
                                  {busyKey === `unassign-${r.id}` ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3 w-3" />
                                  )}
                                </button>
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Select
                            value={assignRole[p.id] ?? ""}
                            onValueChange={(v) =>
                              setAssignRole((prev) => ({
                                ...prev,
                                [p.id]: v as AppRole,
                              }))
                            }
                          >
                            <SelectTrigger className="w-[160px]">
                              <SelectValue placeholder="اختر دوراً" />
                            </SelectTrigger>
                            <SelectContent>
                              {ALL_ROLES.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            onClick={() => assign(p.id)}
                            disabled={busyKey === `assign-${p.id}`}
                          >
                            {busyKey === `assign-${p.id}` ? (
                              <Loader2 className="h-4 w-4 me-1 animate-spin" />
                            ) : (
                              <UserPlus className="h-4 w-4 me-1" />
                            )}
                            تعيين
                          </Button>
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
    </div>
  );
}
