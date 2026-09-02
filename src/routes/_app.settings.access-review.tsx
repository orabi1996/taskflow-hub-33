import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ListSkeleton } from "@/components/common/ListSkeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { exportToCSV } from "@/lib/export-utils";
import { toast } from "sonner";
import {
  listPrivilegedAccess,
  revokePrivilegedRole,
  acknowledgeAccessReview,
  getLastAccessReview,
  type PrivilegedUserRow,
} from "@/lib/access-review.functions";
import {
  ShieldCheck,
  RefreshCw,
  Download,
  Loader2,
  UserMinus,
  AlertTriangle,
  CheckCircle2,
  Search,
} from "lucide-react";

export const Route = createFileRoute("/_app/settings/access-review")({
  component: AccessReviewPage,
});

const ROLE_LABEL: Record<string, string> = {
  admin: "إداري (Admin)",
  general_manager: "مدير عام",
  manager: "مدير",
};

const STALE_DAYS = 90;

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function AccessReviewPage() {
  const { roles, user } = useAuth();
  const isAdmin = roles.includes("admin");

  const [rows, setRows] = useState<PrivilegedUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("__all__");
  const [lastReview, setLastReview] = useState<{ created_at: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [list, last] = await Promise.all([
        listPrivilegedAccess(),
        getLastAccessReview(),
      ]);
      setRows(list);
      setLastReview(last as { created_at: string } | null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) void load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (roleFilter !== "__all__" && r.role !== roleFilter) return false;
      if (!q) return true;
      return (
        r.full_name.toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.department ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, roleFilter]);

  const stale = filtered.filter(
    (r) => !r.last_sign_in_at || (Date.now() - new Date(r.last_sign_in_at).getTime()) / 86400000 > STALE_DAYS,
  );
  const inactive = filtered.filter((r) => !r.is_active);

  const handleRevoke = async (row: PrivilegedUserRow) => {
    if (!confirm(`سحب دور "${ROLE_LABEL[row.role] ?? row.role}" من ${row.full_name}؟`)) return;
    setBusy(`${row.user_id}:${row.role}`);
    try {
      await revokePrivilegedRole({
        data: { user_id: row.user_id, role: row.role as "admin" | "general_manager" | "manager" },
      });
      toast.success("تم سحب الدور");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر سحب الدور");
    } finally {
      setBusy(null);
    }
  };

  const handleAck = async () => {
    setBusy("ack");
    try {
      await acknowledgeAccessReview({ data: { reviewed_count: rows.length } });
      toast.success("تم تسجيل اكتمال المراجعة في سجل التدقيق");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر تسجيل المراجعة");
    } finally {
      setBusy(null);
    }
  };

  const handleExport = () => {
    exportToCSV(
      filtered.map((r) => ({
        الاسم: r.full_name,
        البريد: r.email ?? "",
        الدور: ROLE_LABEL[r.role] ?? r.role,
        القسم: r.department ?? "",
        "المسمى الوظيفي": r.job_title ?? "",
        "تاريخ المنح": fmt(r.granted_at),
        "منذ (أيام)": r.days_since_grant,
        "آخر دخول": fmt(r.last_sign_in_at),
        "حساب مفعّل": r.is_active ? "نعم" : "لا",
      })),
      "privileged-access-review",
    );
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={ShieldCheck}
          title="مراجعة الصلاحيات الدورية"
          description="مراجعة من يملك صلاحيات عالية في النظام ومنذ متى."
        />
        <EmptyState
          icon={AlertTriangle}
          title="غير مصرح"
          description="هذه الشاشة متاحة للأدمن فقط."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldCheck}
        title="مراجعة الصلاحيات الدورية"
        description={
          lastReview
            ? `آخر مراجعة معتمدة: ${fmt(lastReview.created_at)} — راجع القائمة واسحب أي صلاحية غير مبرّرة.`
            : "لم تُسجَّل أي مراجعة بعد — راجع القائمة ثم اعتمد المراجعة لتسجيلها في سجل التدقيق."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              تحديث
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" />
              تصدير CSV
            </Button>
            <Button size="sm" onClick={() => void handleAck()} disabled={busy === "ack" || loading}>
              {busy === "ack" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              اعتماد المراجعة
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">إجمالي الصلاحيات العالية</p>
          <p className="text-2xl font-bold">{rows.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">خامل أكثر من {STALE_DAYS} يوم</p>
          <p className="text-2xl font-bold text-amber-600">{stale.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">حسابات موقوفة تحمل صلاحية</p>
          <p className="text-2xl font-bold text-destructive">{inactive.length}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pr-9"
              placeholder="بحث بالاسم أو البريد أو القسم…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="كل الأدوار" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">كل الأدوار</SelectItem>
              <SelectItem value="admin">إداري (Admin)</SelectItem>
              <SelectItem value="general_manager">مدير عام</SelectItem>
              <SelectItem value="manager">مدير</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {loading ? (
        <ListSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="لا توجد نتائج"
          description="لا يوجد مستخدمون بصلاحيات عالية مطابقون للفلتر الحالي."
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-right">
              <tr>
                <th className="p-3 font-medium">المستخدم</th>
                <th className="p-3 font-medium">الدور</th>
                <th className="p-3 font-medium">القسم</th>
                <th className="p-3 font-medium">تاريخ المنح</th>
                <th className="p-3 font-medium">آخر دخول</th>
                <th className="p-3 font-medium">الحالة</th>
                <th className="p-3 font-medium">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isStale =
                  !r.last_sign_in_at ||
                  (Date.now() - new Date(r.last_sign_in_at).getTime()) / 86400000 > STALE_DAYS;
                return (
                  <tr key={`${r.user_id}-${r.role}`} className="border-t">
                    <td className="p-3">
                      <div className="font-medium">{r.full_name}</div>
                      <div className="text-xs text-muted-foreground">{r.email ?? "—"}</div>
                    </td>
                    <td className="p-3">
                      <Badge variant={r.role === "admin" ? "destructive" : "secondary"}>
                        {ROLE_LABEL[r.role] ?? r.role}
                      </Badge>
                    </td>
                    <td className="p-3">{r.department ?? "—"}</td>
                    <td className="p-3">
                      {fmt(r.granted_at)}
                      <div className="text-xs text-muted-foreground">منذ {r.days_since_grant} يوم</div>
                    </td>
                    <td className="p-3">{fmt(r.last_sign_in_at)}</td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        {!r.is_active && <Badge variant="destructive">حساب موقوف</Badge>}
                        {isStale && <Badge variant="outline">خامل</Badge>}
                        {r.is_active && !isStale && <Badge variant="secondary">نشط</Badge>}
                      </div>
                    </td>
                    <td className="p-3">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          busy === `${r.user_id}:${r.role}` ||
                          (r.user_id === user?.id && r.role === "admin")
                        }
                        onClick={() => void handleRevoke(r)}
                      >
                        {busy === `${r.user_id}:${r.role}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserMinus className="h-4 w-4" />
                        )}
                        سحب الدور
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
