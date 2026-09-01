import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Loader2, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowRight,
} from "lucide-react";
import brandLogoAsset from "@/assets/classera-smarx-logo.png.asset.json";

const brandLogo = brandLogoAsset.url;

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

const schema = z
  .object({
    password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "كلمتا المرور غير متطابقتين",
    path: ["confirm"],
  });

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}

const STRENGTH_LABEL = ["ضعيفة جداً", "ضعيفة", "متوسطة", "جيدة", "قوية"];
const STRENGTH_COLOR = ["var(--destructive)", "var(--destructive)", "var(--warning)", "var(--info)", "var(--success)"];

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [show, setShow] = useState(false);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase places a recovery session via the URL hash; onAuthStateChange picks it up.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) {
        setHasSession(true);
      }
      setReady(true);
    });
    // also check existing session in case the listener already fired
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasSession(true);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    const parsed = schema.safeParse({ password: pw, confirm });
    if (!parsed.success) {
      setErr(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => navigate({ to: "/dashboard" }), 1500);
  };

  const s = strength(pw);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-br from-background via-background to-primary/5">
      <Card className="w-full max-w-md p-8 shadow-xl">
        <div className="flex justify-center mb-6">
          <img src={brandLogo} alt="Classera | C-SmarX" className="h-10" />
        </div>
        <h1 className="text-2xl font-bold text-center mb-2">إعادة تعيين كلمة المرور</h1>
        <p className="text-center text-sm text-muted-foreground mb-6">
          اختر كلمة مرور جديدة وقوية لحسابك
        </p>

        {!ready ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !hasSession ? (
          <div className="text-center space-y-4">
            <div className="rounded-lg bg-destructive/10 text-destructive p-4 text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="text-start">
                الرابط غير صالح أو منتهي الصلاحية. اطلب رابط استرداد جديد من شاشة تسجيل الدخول.
              </div>
            </div>
            <Link to="/auth">
              <Button variant="outline" className="w-full gap-2">
                <ArrowRight className="h-4 w-4" /> العودة لتسجيل الدخول
              </Button>
            </Link>
          </div>
        ) : done ? (
          <div className="text-center space-y-3 py-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-success/15 text-success flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div className="font-semibold">تم تغيير كلمة المرور بنجاح</div>
            <p className="text-sm text-muted-foreground">جاري تحويلك...</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {err && (
              <div className="rounded-lg bg-destructive/10 text-destructive p-3 text-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>{err}</div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="pw" className="text-xs font-semibold">كلمة المرور الجديدة</Label>
              <div className="rounded-xl border bg-muted/30 flex items-center px-3 focus-within:ring-2 focus-within:ring-primary/30 transition">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="pw"
                  type={show ? "text" : "password"}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  required
                  dir="ltr"
                  autoComplete="new-password"
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-11"
                  placeholder="8 أحرف على الأقل"
                />
                <button type="button" onClick={() => setShow((v) => !v)} className="text-muted-foreground hover:text-foreground p-1">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {pw && (
                <div className="space-y-1 pt-1">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-1 flex-1 rounded-full transition-all duration-300"
                        style={{ background: i < s ? STRENGTH_COLOR[s] : "var(--muted)" }}
                      />
                    ))}
                  </div>
                  <div className="text-[11px]" style={{ color: STRENGTH_COLOR[s] }}>
                    {STRENGTH_LABEL[s]}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cf" className="text-xs font-semibold">تأكيد كلمة المرور</Label>
              <div className="rounded-xl border bg-muted/30 flex items-center px-3 focus-within:ring-2 focus-within:ring-primary/30 transition">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="cf"
                  type={show ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  dir="ltr"
                  autoComplete="new-password"
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-11"
                  placeholder="أعد كتابة كلمة المرور"
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl font-semibold">
              {loading && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
              تحديث كلمة المرور
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
