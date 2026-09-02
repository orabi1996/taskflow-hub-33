import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Mail,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  KeyRound,
} from "lucide-react";
import { logError } from "@/lib/log-error";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/email-provider")({
  head: () => ({
    meta: [
      { title: "إعداد مزود البريد — لوحة التحكم" },
      { name: "description", content: "إدارة دومين البريد ومراقبة سجل الإيميلات المرسلة." },
    ],
  }),
  component: EmailProviderPage,
});

interface EmailLog {
  id: string;
  message_id: string | null;
  template_name: string | null;
  recipient_email: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  sent: number;
  failed: number;
  suppressed: number;
}

function EmailProviderPage() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, sent: 0, failed: 0, suppressed: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tableExists, setTableExists] = useState(true);
  const [rbacChecking, setRbacChecking] = useState(false);
  const [rbacResult, setRbacResult] = useState<null | {
    ok: boolean;
    canReadProfiles: boolean;
    canReadRoles: boolean;
    canReadEmailLogs: boolean;
    message: string;
  }>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const roles = (data ?? []).map((r: any) => r.role as string);
      setUserRoles(roles);
      const allowed = roles.some((r) => ["admin", "general_manager"].includes(r));
      setIsAdmin(allowed);
    })();
  }, [user]);

  const runRbacCheck = async () => {
    if (!user) return;
    setRbacChecking(true);
    setRbacResult(null);
    try {
      const [profilesRes, rolesRes, emailRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("id", { count: "exact", head: true }),
        (supabase as any)
          .from("email_send_log")
          .select("id", { count: "exact", head: true }),
      ]);
      const canReadProfiles = !profilesRes.error;
      const canReadRoles = !rolesRes.error;
      const canReadEmailLogs =
        !emailRes.error ||
        emailRes.error.code === "42P01" ||
        /does not exist/i.test(emailRes.error.message ?? "");
      const ok = canReadProfiles && canReadRoles && canReadEmailLogs;
      setRbacResult({
        ok,
        canReadProfiles,
        canReadRoles,
        canReadEmailLogs,
        message: ok
          ? "حساب الادمن يعمل بشكل صحيح وله جميع الصلاحيات اللازمة."
          : "تم العثور على قيود في صلاحيات الحساب.",
      });
      if (ok) toast.success("اختبار RBAC ناجح");
      else toast.error("اختبار RBAC: توجد قيود");
    } catch (e: any) {
      logError(e, { scope: "rbacCheck" });
      setRbacResult({
        ok: false,
        canReadProfiles: false,
        canReadRoles: false,
        canReadEmailLogs: false,
        message: e?.message ?? "فشل الاختبار",
      });
      toast.error("فشل اختبار RBAC");
    } finally {
      setRbacChecking(false);
    }
  };


  const loadLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("email_send_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        if (error.code === "42P01" || /does not exist/i.test(error.message)) {
          setTableExists(false);
        } else {
          throw error;
        }
        setLogs([]);
        setStats({ total: 0, sent: 0, failed: 0, suppressed: 0 });
        return;
      }

      setTableExists(true);
      // Deduplicate by message_id
      const seen = new Set<string>();
      const deduped: EmailLog[] = [];
      for (const row of (data ?? []) as EmailLog[]) {
        const key = row.message_id ?? row.id;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(row);
      }

      const s: Stats = { total: deduped.length, sent: 0, failed: 0, suppressed: 0 };
      for (const r of deduped) {
        if (r.status === "sent") s.sent++;
        else if (r.status === "dlq" || r.status === "failed" || r.status === "bounced")
          s.failed++;
        else if (r.status === "suppressed" || r.status === "complained") s.suppressed++;
      }
      setStats(s);
      setLogs(deduped);
    } catch (e) {
      logError(e, { scope: "loadEmailLogs" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadLogs();
  }, [isAdmin]);

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
            هذه الصفحة متاحة للمدير العام والإدارة فقط.
          </p>
        </Card>
      </div>
    );
  }

  const filteredLogs = logs.filter((l) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "failed")
      return ["dlq", "failed", "bounced"].includes(l.status);
    if (statusFilter === "suppressed")
      return ["suppressed", "complained"].includes(l.status);
    return l.status === statusFilter;
  });

  const statusBadge = (s: string) => {
    if (s === "sent")
      return (
        <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/20 border-green-500/30">
          <CheckCircle2 className="h-3 w-3 me-1" />
          مُرسل
        </Badge>
      );
    if (["dlq", "failed", "bounced"].includes(s))
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 me-1" />
          فشل
        </Badge>
      );
    if (["suppressed", "complained"].includes(s))
      return (
        <Badge className="bg-yellow-500/15 text-yellow-700 hover:bg-yellow-500/20 border-yellow-500/30">
          محظور
        </Badge>
      );
    return (
      <Badge variant="secondary">
        <Clock className="h-3 w-3 me-1" />
        {s}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            عودة للوحة التحكم
          </Link>
          <PageHeader
            icon={Mail}
            title="إعداد مزود البريد الإلكتروني"
            description="إدارة دومين الإرسال والتحقق من DNS ومراقبة سجل الإيميلات."
          />

        </div>
        <Button variant="outline" onClick={loadLogs} disabled={loading}>
          <RefreshCw className={`h-4 w-4 me-2 ${loading ? "animate-spin" : ""}`} />
          تحديث
        </Button>
      </div>

      {/* Provider setup card */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2 flex-1 min-w-[260px]">
            <h2 className="text-lg font-semibold">دومين الإرسال</h2>
            <p className="text-sm text-muted-foreground">
              لإرسال الإيميلات من اسم نطاقك الخاص (مثل{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                notify@yourdomain.com
              </code>
              ) يجب إعداد الدومين والتحقق من سجلات DNS. يتم ذلك عبر إعدادات Lovable
              Cloud.
            </p>
            <ul className="text-sm text-muted-foreground list-disc ps-5 space-y-1 mt-2">
              <li>أدخل اسم الدومين الذي تملكه.</li>
              <li>سيظهر لك سجلات DNS (NS) لإضافتها لدى مزود الدومين.</li>
              <li>بعد التحقق (قد يستغرق حتى 72 ساعة)، يبدأ الإرسال تلقائياً.</li>
            </ul>
          </div>
          <div className="flex flex-col gap-2 min-w-[200px]">
            <Button
              onClick={() => {
                // Trigger Lovable Cloud email setup dialog
                window.dispatchEvent(new CustomEvent("lovable:open-email-setup"));
              }}
            >
              <Mail className="h-4 w-4 me-2" />
              إعداد دومين البريد
            </Button>
            <Button variant="outline" asChild>
              <a
                href="https://docs.lovable.dev/features/cloud"
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="h-4 w-4 me-2" />
                دليل الإعداد
              </a>
            </Button>
          </div>
        </div>
      </Card>

      {/* RBAC test card */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2 flex-1 min-w-[260px]">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              اختبار صلاحيات الادمن (RBAC)
            </h2>
            <p className="text-sm text-muted-foreground">
              تأكد من أن حسابك الحالي يصل بشكل صحيح للجداول المحمية بسياسات RLS.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="text-xs text-muted-foreground">الأدوار الحالية:</span>
              {userRoles.length === 0 ? (
                <Badge variant="outline">لا توجد أدوار</Badge>
              ) : (
                userRoles.map((r) => (
                  <Badge key={r} variant="secondary">
                    {r}
                  </Badge>
                ))
              )}
            </div>
            {rbacResult && (
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  {rbacResult.canReadProfiles ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span>قراءة جدول profiles</span>
                </div>
                <div className="flex items-center gap-2">
                  {rbacResult.canReadRoles ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span>قراءة جدول user_roles</span>
                </div>
                <div className="flex items-center gap-2">
                  {rbacResult.canReadEmailLogs ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span>قراءة سجل الإيميلات</span>
                </div>
                <p
                  className={`mt-2 font-medium ${
                    rbacResult.ok ? "text-green-600" : "text-destructive"
                  }`}
                >
                  {rbacResult.message}
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 min-w-[200px]">
            <Button onClick={runRbacCheck} disabled={rbacChecking}>
              {rbacChecking ? (
                <Loader2 className="h-4 w-4 me-2 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4 me-2" />
              )}
              اختبار وصول الادمن
            </Button>
            <Button variant="outline" asChild>
              <Link to="/admin/roles">
                <KeyRound className="h-4 w-4 me-2" />
                إدارة الأدوار
              </Link>
            </Button>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">إجمالي الإيميلات</p>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">مُرسل بنجاح</p>
          <p className="text-2xl font-bold mt-1 text-green-600">{stats.sent}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">فشل</p>
          <p className="text-2xl font-bold mt-1 text-destructive">{stats.failed}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">محظور / شكوى</p>
          <p className="text-2xl font-bold mt-1 text-yellow-600">{stats.suppressed}</p>
        </Card>
      </div>

      {/* Logs table */}
      <Card className="p-4 md:p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="text-lg font-semibold">سجل الإيميلات (آخر 200)</h2>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="sent">مُرسل</SelectItem>
              <SelectItem value="failed">فشل</SelectItem>
              <SelectItem value="suppressed">محظور</SelectItem>
              <SelectItem value="pending">في الانتظار</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {!tableExists ? (
          <div className="text-center py-12 text-muted-foreground">
            <Mail className="mx-auto h-10 w-10 mb-3 opacity-50" />
            <p className="font-medium">لم يتم تفعيل البنية التحتية للبريد بعد.</p>
            <p className="text-sm mt-1">
              قم أولاً بإعداد دومين الإرسال من الزر بالأعلى.
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>لا توجد إيميلات مطابقة للفلتر الحالي.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>القالب</TableHead>
                  <TableHead>المستلم</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الخطأ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">
                      {log.template_name ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm">{log.recipient_email ?? "-"}</TableCell>
                    <TableCell>{statusBadge(log.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("ar-EG")}
                    </TableCell>
                    <TableCell className="text-xs text-destructive max-w-[280px] truncate">
                      {log.error_message ?? "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
