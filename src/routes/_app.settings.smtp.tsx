import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Save, Send, ShieldCheck, ServerCog } from "lucide-react";
import { toast } from "sonner";
import { logError } from "@/lib/log-error";

export const Route = createFileRoute("/_app/settings/smtp")({
  component: SmtpPage,
});

interface SmtpRow {
  id?: string;
  host: string;
  port: number;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  use_tls: boolean;
  is_active: boolean;
}

const empty: SmtpRow = {
  host: "",
  port: 587,
  username: "",
  password: "",
  from_email: "",
  from_name: "",
  use_tls: true,
  is_active: true,
};

function SmtpPage() {
  const { roles, user } = useAuth();
  const isAdmin = roles.includes("admin");
  const isSupport = (roles as string[]).includes("support");
  const canManage = isAdmin || isSupport;
  const [row, setRow] = useState<SmtpRow>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("smtp_settings")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) setRow({
        ...empty,
        ...data,
        username: data.username ?? "",
        password: data.password ?? "",
        from_name: data.from_name ?? "",
      });
    } catch (e) {
      logError(e, { scope: "loadSmtp" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManage) load();
  }, [canManage]);

  if (!canManage) {
    return (
      <Card className="p-8 text-center max-w-md mx-auto">
        <ShieldCheck className="h-10 w-10 mx-auto text-destructive mb-3" />
        <div className="font-semibold mb-1">صلاحيات غير كافية</div>
        <div className="text-sm text-muted-foreground">
          صفحة إعدادات SMTP متاحة فقط لمستخدمي دور <b>الإداري</b> أو <b>الدعم الفني</b>.
        </div>
      </Card>
    );
  }

  const save = async () => {
    if (!row.host || !row.from_email) {
      toast.error("الخادم وعنوان المرسل حقول إلزامية");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        host: row.host,
        port: row.port,
        username: row.username || null,
        password: row.password || null,
        from_email: row.from_email,
        from_name: row.from_name || null,
        use_tls: row.use_tls,
        is_active: row.is_active,
        updated_by: user?.id ?? null,
      };
      const { error } = row.id
        ? await supabase.from("smtp_settings").update(payload).eq("id", row.id)
        : await supabase.from("smtp_settings").insert(payload);
      if (error) throw error;
      toast.success("تم حفظ إعدادات SMTP");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const testSend = async () => {
    if (!testEmail) {
      toast.error("أدخل بريداً لاختبار الإرسال");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/public/hooks/smtp-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      toast.success("تم إرسال البريد التجريبي بنجاح");
    } catch (e: any) {
      toast.error(`فشل الإرسال: ${e?.message ?? "خطأ غير معروف"}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ServerCog className="h-6 w-6 text-primary" />
            إعدادات SMTP المخصص
          </h1>
          <p className="text-muted-foreground mt-1">
            تكوين خادم SMTP خاص بك (Gmail / Office365 / خادم خاص) لإرسال جميع إيميلات النظام.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin"><Button variant="outline">قائمة الموظفين</Button></Link>
          <Link to="/admin/email-provider"><Button variant="outline">مزود البريد</Button></Link>
        </div>
      </div>

      <Card className="p-6">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            جارٍ التحميل...
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>خادم SMTP (Host) *</Label>
                <Input
                  placeholder="smtp.gmail.com"
                  value={row.host}
                  onChange={(e) => setRow({ ...row, host: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>المنفذ (Port) *</Label>
                <Input
                  type="number"
                  value={row.port}
                  onChange={(e) => setRow({ ...row, port: parseInt(e.target.value) || 587 })}
                />
              </div>
              <div className="space-y-2">
                <Label>اسم المستخدم</Label>
                <Input
                  placeholder="user@example.com"
                  value={row.username}
                  onChange={(e) => setRow({ ...row, username: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>كلمة المرور / App Password</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={row.password}
                  onChange={(e) => setRow({ ...row, password: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>عنوان المرسل (From Email) *</Label>
                <Input
                  placeholder="noreply@example.com"
                  value={row.from_email}
                  onChange={(e) => setRow({ ...row, from_email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>اسم المرسل (From Name)</Label>
                <Input
                  placeholder="نظام إدارة المهام"
                  value={row.from_name}
                  onChange={(e) => setRow({ ...row, from_name: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-6 flex-wrap pt-2">
              <div className="flex items-center gap-2">
                <Switch checked={row.use_tls} onCheckedChange={(v) => setRow({ ...row, use_tls: v })} />
                <Label>تفعيل TLS / STARTTLS</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={row.is_active} onCheckedChange={(v) => setRow({ ...row, is_active: v })} />
                <Label>تفعيل المزود</Label>
              </div>
              {row.is_active ? (
                <Badge variant="default" className="bg-emerald-600">نشط</Badge>
              ) : (
                <Badge variant="outline">معطل</Badge>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 ms-1.5 animate-spin" /> : <Save className="h-4 w-4 ms-1.5" />}
                حفظ الإعدادات
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Send className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">اختبار الإرسال</h2>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            type="email"
            placeholder="بريدك لاختبار الإرسال"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="max-w-md"
          />
          <Button onClick={testSend} disabled={testing} variant="secondary">
            {testing ? <Loader2 className="h-4 w-4 ms-1.5 animate-spin" /> : <Mail className="h-4 w-4 ms-1.5" />}
            إرسال بريد تجريبي
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          سيتم استخدام إعدادات SMTP المحفوظة أعلاه لإرسال رسالة تجريبية.
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
          ملاحظة: اختبار SMTP يعمل فقط على النسخة المنشورة (Published) لأنه يحتاج بيئة Cloudflare Workers.
        </p>
      </Card>

      <Card className="p-4 bg-muted/30 border-dashed text-sm">
        <div className="font-semibold mb-2">نصائح سريعة:</div>
        <ul className="list-disc list-inside text-muted-foreground space-y-1">
          <li><strong>Gmail:</strong> smtp.gmail.com — منفذ 587 — استخدم App Password (وليس كلمة مرور حسابك).</li>
          <li><strong>Office 365:</strong> smtp.office365.com — منفذ 587 — TLS مفعّل.</li>
          <li><strong>SendGrid/Mailgun:</strong> راجع لوحة تحكم المزود لمعلومات الخادم.</li>
        </ul>
      </Card>
    </div>
  );
}
