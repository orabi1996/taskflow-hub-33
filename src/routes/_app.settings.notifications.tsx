import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Bell, BellOff, Mail, MonitorSmartphone, Send, Trash2, Loader2, Moon } from "lucide-react";
import {
  getPushPublicKey,
  savePushSubscription,
  removePushSubscription,
  listMyDevices,
  getMyNotificationPrefs,
  updateMyNotificationPrefs,
  sendTestNotification,
} from "@/lib/push.functions";

export const Route = createFileRoute("/_app/settings/notifications")({
  component: NotificationsSettingsPage,
});

type Prefs = {
  push_enabled: boolean;
  email_enabled: boolean;
  in_app_enabled: boolean;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  muted_types: string[];
};

type Device = {
  id: string;
  endpoint: string;
  user_agent: string | null;
  created_at: string;
  last_used_at: string | null;
};

const TYPES: { value: string; label: string }[] = [
  { value: "automation", label: "تنبيهات الأتمتة" },
  { value: "contract_alert", label: "تنبيهات العقود" },
  { value: "mention", label: "الإشارات في التعليقات" },
  { value: "member_added", label: "الإضافة إلى مشروع" },
];

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function bufToBase64Url(buf: ArrayBuffer | null) {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function NotificationsSettingsPage() {
  const fetchKey = useServerFn(getPushPublicKey);
  const saveSub = useServerFn(savePushSubscription);
  const removeSub = useServerFn(removePushSubscription);
  const fetchDevices = useServerFn(listMyDevices);
  const fetchPrefs = useServerFn(getMyNotificationPrefs);
  const savePrefs = useServerFn(updateMyNotificationPrefs);
  const testNotify = useServerFn(sendTestNotification);

  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);

  const supported =
    typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  const reload = async () => {
    const [p, d, k] = await Promise.all([fetchPrefs({}), fetchDevices({}), fetchKey({})]);
    setPrefs(p as Prefs);
    setDevices(d as Device[]);
    setPublicKey((k as { publicKey: string | null }).publicKey);
  };

  useEffect(() => {
    setPermission(supported ? Notification.permission : "unsupported");
    reload().catch((e) => toast.error(e?.message ?? "تعذر تحميل الإعدادات"));
    if (supported) {
      navigator.serviceWorker.getRegistration().then(async (reg) => {
        const sub = await reg?.pushManager.getSubscription();
        setCurrentEndpoint(sub?.endpoint ?? null);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enablePush = async () => {
    if (!supported) return toast.error("المتصفح لا يدعم إشعارات الويب");
    if (!publicKey) return toast.error("مفاتيح الإشعارات غير مُهيأة على الخادم");
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast.error("تم رفض إذن الإشعارات من المتصفح");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }
      await saveSub({
        data: {
          endpoint: sub.endpoint,
          p256dh: bufToBase64Url(sub.getKey("p256dh")),
          auth: bufToBase64Url(sub.getKey("auth")),
          user_agent: navigator.userAgent.slice(0, 400),
        },
      });
      setCurrentEndpoint(sub.endpoint);
      toast.success("تم تفعيل إشعارات المتصفح على هذا الجهاز");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر تفعيل الإشعارات");
    } finally {
      setBusy(false);
    }
  };

  const disableThisDevice = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removeSub({ data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setCurrentEndpoint(null);
      toast.success("تم إيقاف الإشعارات على هذا الجهاز");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الإيقاف");
    } finally {
      setBusy(false);
    }
  };

  const removeDevice = async (endpoint: string) => {
    await removeSub({ data: { endpoint } });
    if (endpoint === currentEndpoint) setCurrentEndpoint(null);
    toast.success("تم حذف الجهاز");
    await reload();
  };

  const persist = async (next: Prefs) => {
    setPrefs(next);
    setSaving(true);
    try {
      await savePrefs({ data: next });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setBusy(true);
    try {
      const res = (await testNotify({})) as {
        push: { sent: number; failed: number; skipped: number };
        email: { sent: number; failed: number; skipped: number };
      };
      toast.success(
        `تم الإرسال — متصفح: ${res.push.sent} ناجح / ${res.push.failed} فاشل · بريد: ${res.email.sent} ناجح / ${res.email.skipped} متخطى`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الإرسال");
    } finally {
      setBusy(false);
    }
  };

  if (!prefs) {
    return (
      <Card className="p-8 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">قنوات الإشعارات</h2>
          {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <ChannelToggle
            icon={<MonitorSmartphone className="h-4 w-4" />}
            label="إشعارات المتصفح"
            desc="تنبيهات فورية على سطح المكتب والجوال"
            checked={prefs.push_enabled}
            onChange={(v) => persist({ ...prefs, push_enabled: v })}
          />
          <ChannelToggle
            icon={<Mail className="h-4 w-4" />}
            label="البريد الإلكتروني"
            desc="نسخة من التنبيهات المهمة على بريدك"
            checked={prefs.email_enabled}
            onChange={(v) => persist({ ...prefs, email_enabled: v })}
          />
          <ChannelToggle
            icon={<Bell className="h-4 w-4" />}
            label="داخل النظام"
            desc="جرس الإشعارات أعلى الشاشة"
            checked={prefs.in_app_enabled}
            onChange={(v) => persist({ ...prefs, in_app_enabled: v })}
          />
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <MonitorSmartphone className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">أجهزة هذا الحساب</h2>
        </div>

        {!supported ? (
          <div className="text-sm text-muted-foreground">المتصفح الحالي لا يدعم إشعارات الويب.</div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {currentEndpoint ? (
              <>
                <Badge variant="secondary" className="gap-1">
                  <Bell className="h-3 w-3" /> مفعّل على هذا الجهاز
                </Badge>
                <Button variant="outline" size="sm" onClick={disableThisDevice} disabled={busy}>
                  <BellOff className="h-4 w-4 ml-1" /> إيقاف على هذا الجهاز
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={enablePush} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Bell className="h-4 w-4 ml-1" />}
                تفعيل إشعارات المتصفح
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={runTest} disabled={busy}>
              <Send className="h-4 w-4 ml-1" /> إرسال إشعار تجريبي
            </Button>
            {permission === "denied" && (
              <span className="text-xs text-destructive">تم حظر الإشعارات في إعدادات المتصفح لهذا الموقع.</span>
            )}
          </div>
        )}

        <div className="divide-y rounded-md border">
          {devices.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">لا توجد أجهزة مسجلة بعد.</div>
          )}
          {devices.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="text-sm truncate">{d.user_agent ?? "جهاز غير معروف"}</div>
                <div className="text-xs text-muted-foreground">
                  سُجّل في {new Date(d.created_at).toLocaleString("ar-EG")}
                  {d.endpoint === currentEndpoint ? " · هذا الجهاز" : ""}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeDevice(d.endpoint)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Moon className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">ساعات الهدوء وأنواع التنبيهات</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 max-w-xl">
          <div className="space-y-1.5">
            <Label>من الساعة</Label>
            <Select
              value={prefs.quiet_hours_start === null ? "off" : String(prefs.quiet_hours_start)}
              onValueChange={(v) =>
                persist({ ...prefs, quiet_hours_start: v === "off" ? null : Number(v) })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="off">بدون</SelectItem>
                {hours.map((h) => (
                  <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>إلى الساعة</Label>
            <Select
              value={prefs.quiet_hours_end === null ? "off" : String(prefs.quiet_hours_end)}
              onValueChange={(v) => persist({ ...prefs, quiet_hours_end: v === "off" ? null : Number(v) })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="off">بدون</SelectItem>
                {hours.map((h) => (
                  <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          خلال ساعات الهدوء لا تُرسل إشعارات المتصفح (بتوقيت الرياض)، وتبقى الإشعارات داخل النظام كما هي.
        </p>

        <div className="space-y-2">
          <Label>كتم أنواع محددة</Label>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => {
              const muted = prefs.muted_types.includes(t.value);
              return (
                <Button
                  key={t.value}
                  type="button"
                  variant={muted ? "secondary" : "outline"}
                  size="sm"
                  onClick={() =>
                    persist({
                      ...prefs,
                      muted_types: muted
                        ? prefs.muted_types.filter((x) => x !== t.value)
                        : [...prefs.muted_types, t.value],
                    })
                  }
                >
                  {muted ? <BellOff className="h-4 w-4 ml-1" /> : <Bell className="h-4 w-4 ml-1" />}
                  {t.label}
                </Button>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}

function ChannelToggle({
  icon,
  label,
  desc,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border p-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {label}
        </div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
