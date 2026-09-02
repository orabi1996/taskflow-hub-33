import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ACCESS_RULES, evaluateRule, type AccessRule } from "@/lib/access-rules";
import { Stethoscope, ArrowLeft, Loader2, Check, Lock, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";

export const Route = createFileRoute("/_app/admin/permissions-diagnose")({
  head: () => ({
    meta: [
      { title: "تشخيص الصلاحيات | لماذا تُحجب الشاشات" },
      { name: "description", content: "أداة للمسؤول لمعرفة سبب إخفاء أي شاشة أو إعداد عن أي مستخدم داخل النظام." },
      { property: "og:title", content: "تشخيص الصلاحيات" },
      { property: "og:description", content: "اعرف سبب حجب أي شاشة أو إعداد عن أي مستخدم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DiagnosePage,
});

interface Row {
  id: string;
  full_name: string;
  email: string | null;
  roles: string[];
}

function DiagnosePage() {
  const { roles: myRoles } = useAuth();
  const isAdmin = myRoles.includes("admin");
  const [users, setUsers] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    (async () => {
      const [{ data: profs }, { data: roleRows }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const map = new Map<string, string[]>();
      (roleRows ?? []).forEach((r: any) => {
        map.set(r.user_id, [...(map.get(r.user_id) ?? []), r.role]);
      });
      const rows = (profs ?? []).map((p: any) => ({
        id: p.id, full_name: p.full_name, email: p.email, roles: map.get(p.id) ?? [],
      }));
      setUsers(rows);
      setSelected((s) => s ?? rows[0]?.id ?? null);
      setLoading(false);
    })();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return users;
    return users.filter((u) => u.full_name?.toLowerCase().includes(t) || u.email?.toLowerCase().includes(t));
  }, [users, q]);

  const current = users.find((u) => u.id === selected) ?? null;

  const groups = useMemo(() => {
    const g: Record<string, AccessRule[]> = {};
    ACCESS_RULES.forEach((r) => { (g[r.group] ??= []).push(r); });
    return g;
  }, []);

  if (!isAdmin) {
    return (
      <Card className="p-8 text-center max-w-md mx-auto">
        <ShieldAlert className="h-10 w-10 mx-auto text-destructive mb-3" />
        <div className="font-semibold mb-1">صلاحيات غير كافية</div>
        <div className="text-sm text-muted-foreground">صفحة تشخيص الصلاحيات متاحة للإداري فقط.</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <PageHeader title="تشخيص الصلاحيات" description="اختر مستخدمًا لمعرفة كل شاشة/إعداد يظهر له أو يُحجب عنه، مع سبب الحجب بالتفصيل." icon={Stethoscope} />
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/permissions-check">
              <ArrowLeft className="h-4 w-4 ms-1" />
              فحص الصلاحيات
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/roles">إدارة الأدوار</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Card className="p-3 space-y-2 h-fit">
          <Input placeholder="ابحث بالاسم أو البريد..." value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="max-h-[520px] overflow-y-auto space-y-1">
            {loading && <div className="p-6 text-center"><Loader2 className="h-4 w-4 mx-auto animate-spin" /></div>}
            {!loading && filtered.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">لا توجد نتائج</div>
            )}
            {filtered.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelected(u.id)}
                className={`w-full text-start px-3 py-2 rounded-md text-sm transition-colors ${
                  selected === u.id ? "bg-primary text-primary-foreground" : "hover:bg-accent/40"
                }`}
              >
                <div className="font-medium truncate">{u.full_name || "بدون اسم"}</div>
                <div className={`text-xs truncate ${selected === u.id ? "opacity-80" : "text-muted-foreground"}`}>
                  {u.email || "—"}
                </div>
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          {current && (
            <Card className="p-4 space-y-2">
              <div className="font-semibold">{current.full_name}</div>
              <div className="text-sm text-muted-foreground">{current.email}</div>
              <div className="flex gap-1.5 flex-wrap items-center pt-1">
                <span className="text-sm text-muted-foreground">الأدوار:</span>
                {current.roles.length === 0
                  ? <Badge variant="destructive">لا توجد أدوار — لذلك تُحجب معظم الشاشات</Badge>
                  : current.roles.map((r) => <Badge key={r}>{r}</Badge>)}
              </div>
            </Card>
          )}

          {current && Object.entries(groups).map(([group, rules]) => (
            <Card key={group} className="overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/40 font-semibold text-sm">{group}</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/20">
                    <tr>
                      <th className="text-start px-3 py-2 font-semibold w-24">الحالة</th>
                      <th className="text-start px-3 py-2 font-semibold">الشاشة</th>
                      <th className="text-start px-3 py-2 font-semibold">القاعدة</th>
                      <th className="text-start px-3 py-2 font-semibold">التشخيص</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((r) => {
                      const { allowed, reason } = evaluateRule(r, current.roles);
                      return (
                        <tr key={r.key} className="border-t align-top">
                          <td className="px-3 py-2">
                            {allowed ? (
                              <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1"><Check className="h-3 w-3" />ظاهر</Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1 text-destructive border-destructive/40"><Lock className="h-3 w-3" />محجوب</Badge>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{r.label}</div>
                            <div className="text-xs text-muted-foreground font-mono">{r.path}</div>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{r.rule}</td>
                          <td className={`px-3 py-2 ${allowed ? "text-muted-foreground" : "text-destructive"}`}>{reason}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
