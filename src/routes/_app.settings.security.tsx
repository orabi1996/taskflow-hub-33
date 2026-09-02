import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/PageHeader";
import { ShieldAlert, Save, Timer } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings/security")({
  head: () => ({
    meta: [
      { title: "أمان الجلسة — C-SmarX" },
      { name: "description", content: "التحكم في مدة الخمول قبل تسجيل الخروج التلقائي وإعدادات حماية الجلسة." },
      { property: "og:title", content: "أمان الجلسة — C-SmarX" },
      { property: "og:description", content: "التحكم في مدة الخمول قبل تسجيل الخروج التلقائي وإعدادات حماية الجلسة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SecuritySettings,
});

const PRESETS = [10, 15, 30, 60, 120];

function SecuritySettings() {
  const [minutes, setMinutes] = useState(30);

  useEffect(() => {
    const v = Number(window.localStorage.getItem("security.idleMinutes"));
    if (Number.isFinite(v) && v > 0) setMinutes(v);
  }, []);

  const save = (value: number) => {
    if (!Number.isFinite(value) || value < 1 || value > 480) {
      toast.error("أدخل مدة بين 1 و 480 دقيقة");
      return;
    }
    window.localStorage.setItem("security.idleMinutes", String(value));
    setMinutes(value);
    toast.success(`تم الحفظ — سيتم تسجيل الخروج بعد ${value} دقيقة من الخمول`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldAlert}
        title="أمان الجلسة"
        description="حماية الحساب عند ترك الجهاز دون استخدام."
      />

      <Card className="p-6 space-y-5 max-w-2xl">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">الخروج التلقائي عند الخمول</h2>
          <Badge variant="secondary">{minutes} دقيقة</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          يظهر تنبيه قبل دقيقة من انتهاء المهلة، وأي حركة للفأرة أو الكيبورد تعيد ضبط العدّاد.
        </p>

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p}
              size="sm"
              variant={p === minutes ? "default" : "outline"}
              onClick={() => save(p)}
            >
              {p} دقيقة
            </Button>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="idle">مدة مخصّصة (بالدقائق)</Label>
          <div className="flex gap-2">
            <Input
              id="idle"
              type="number"
              min={1}
              max={480}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="max-w-[160px]"
            />
            <Button onClick={() => save(minutes)} className="gap-1.5">
              <Save className="h-4 w-4" /> حفظ
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">يُطبَّق الإعداد على هذا المتصفح بعد إعادة تحميل الصفحة.</p>
        </div>
      </Card>
    </div>
  );
}
