import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ListSkeleton } from "@/components/common/ListSkeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { computeDeviceHash } from "@/lib/device-fingerprint";
import { toast } from "sonner";
import {
  listAllTrustedDevices,
  revokeTrustedDevice,
  type TrustedDeviceRow,
} from "@/lib/devices.functions";
import { Laptop, Smartphone, Monitor, RefreshCw, Trash2, Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_app/settings/devices")({
  component: DevicesPage,
});

interface MyDevice {
  id: string;
  device_hash: string;
  label: string | null;
  user_agent: string | null;
  ip: string | null;
  last_seen_at: string;
  created_at: string;
}

function deviceName(ua: string | null) {
  if (!ua) return "جهاز غير معروف";
  const os = /Windows/i.test(ua)
    ? "Windows"
    : /Android/i.test(ua)
      ? "Android"
      : /iPhone|iPad|iOS/i.test(ua)
        ? "iOS"
        : /Mac OS X/i.test(ua)
          ? "macOS"
          : /Linux/i.test(ua)
            ? "Linux"
            : "نظام آخر";
  const br = /Edg\//i.test(ua)
    ? "Edge"
    : /OPR\//i.test(ua)
      ? "Opera"
      : /Chrome\//i.test(ua)
        ? "Chrome"
        : /Safari\//i.test(ua)
          ? "Safari"
          : /Firefox\//i.test(ua)
            ? "Firefox"
            : "متصفح";
  return `${br} — ${os}`;
}

function DeviceIcon({ ua }: { ua: string | null }) {
  if (ua && /Mobile|Android|iPhone/i.test(ua)) return <Smartphone className="h-5 w-5" />;
  if (ua && /Macintosh|Windows|Linux/i.test(ua)) return <Laptop className="h-5 w-5" />;
  return <Monitor className="h-5 w-5" />;
}

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
}

function DevicesPage() {
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin");

  const [mine, setMine] = useState<MyDevice[]>([]);
  const [all, setAll] = useState<TrustedDeviceRow[]>([]);
  const [currentHash, setCurrentHash] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const hash = await computeDeviceHash();
      setCurrentHash(hash);
      if (user?.id) {
        const { data, error } = await supabase
          .from("trusted_devices")
          .select("id, device_hash, label, user_agent, ip, last_seen_at, created_at")
          .eq("user_id", user.id)
          .order("last_seen_at", { ascending: false });
        if (error) throw new Error(error.message);
        setMine((data ?? []) as MyDevice[]);
      }
      if (isAdmin) setAll(await listAllTrustedDevices());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر تحميل الأجهزة");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin]);

  const removeMine = async (d: MyDevice) => {
    if (!confirm("إزالة هذا الجهاز من الأجهزة الموثوقة؟")) return;
    setBusy(d.id);
    try {
      const { error } = await supabase.from("trusted_devices").delete().eq("id", d.id);
      if (error) throw new Error(error.message);
      toast.success("تمت إزالة الجهاز");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّرت الإزالة");
    } finally {
      setBusy(null);
    }
  };

  const removeAny = async (row: TrustedDeviceRow) => {
    if (!confirm(`إزالة جهاز ${row.full_name}؟`)) return;
    setBusy(row.id);
    try {
      await revokeTrustedDevice({ data: { id: row.id } });
      toast.success("تمت إزالة الجهاز");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّرت الإزالة");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldCheck}
        title="الأجهزة الموثوقة"
        description="الأجهزة التي سجّلت الدخول منها — أزل أي جهاز لا تعرفه فورًا."
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            تحديث
          </Button>
        }
      />

      {loading ? (
        <ListSkeleton rows={4} />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="font-semibold">أجهزتي ({mine.length})</h2>
            {mine.length === 0 ? (
              <EmptyState
                icon={Monitor}
                title="لا توجد أجهزة مسجّلة"
                description="سيُسجَّل جهازك تلقائيًا عند تسجيل الدخول التالي."
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {mine.map((d) => (
                  <Card key={d.id} className="p-4 flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <DeviceIcon ua={d.user_agent} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{d.label ?? deviceName(d.user_agent)}</span>
                        {d.device_hash === currentHash && <Badge variant="secondary">هذا الجهاز</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">آخر ظهور: {fmt(d.last_seen_at)}</p>
                      <p className="text-xs text-muted-foreground">أُضيف: {fmt(d.created_at)}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy === d.id}
                      onClick={() => void removeMine(d)}
                    >
                      {busy === d.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      إزالة
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {isAdmin && (
            <section className="space-y-3">
              <h2 className="font-semibold">كل أجهزة المستخدمين ({all.length})</h2>
              {all.length === 0 ? (
                <EmptyState icon={Monitor} title="لا توجد أجهزة" description="لم يُسجَّل أي جهاز بعد." />
              ) : (
                <Card className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-right">
                      <tr>
                        <th className="p-3 font-medium">المستخدم</th>
                        <th className="p-3 font-medium">الجهاز</th>
                        <th className="p-3 font-medium">آخر ظهور</th>
                        <th className="p-3 font-medium">IP</th>
                        <th className="p-3 font-medium">إجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {all.map((r) => (
                        <tr key={r.id} className="border-t">
                          <td className="p-3">
                            <div className="font-medium">{r.full_name}</div>
                            <div className="text-xs text-muted-foreground">{r.email ?? "—"}</div>
                          </td>
                          <td className="p-3">{r.label ?? deviceName(r.user_agent)}</td>
                          <td className="p-3">{fmt(r.last_seen_at)}</td>
                          <td className="p-3">{r.ip ?? "—"}</td>
                          <td className="p-3">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy === r.id}
                              onClick={() => void removeAny(r)}
                            >
                              {busy === r.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                              إزالة
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
