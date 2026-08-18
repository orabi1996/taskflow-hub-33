import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, User, KeyRound, Palette, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { usePreferences, THEMES } from "@/lib/preferences";

export const Route = createFileRoute("/_app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, refresh } = useAuth();
  const { theme, animations, setTheme, setAnimations } = usePreferences();
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [phoneDb, setPhoneDb] = useState<string>("");

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setJobTitle(profile.job_title ?? "");
    setDepartment(profile.department ?? "");
  }, [profile]);

  // Load phone from profile (not in context)
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        const p = data?.phone ?? "";
        setPhone(p);
        setPhoneDb(p);
      });
  }, [user?.id]);

  const handleSaveProfile = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    if (fullName.trim().length < 2) {
      toast.error("الاسم قصير جدًا");
      return;
    }
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        job_title: jobTitle.trim() || null,
        department: department.trim() || null,
        phone: phone.trim() || null,
      })
      .eq("id", user.id);
    setSavingProfile(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPhoneDb(phone.trim());
    toast.success("تم حفظ البيانات");
    refresh();
  };

  const handleChangePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pwd.length < 8) {
      toast.error("كلمة المرور يجب ألا تقل عن 8 أحرف");
      return;
    }
    if (pwd !== pwd2) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setSavingPwd(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم تحديث كلمة المرور");
    setPwd(""); setPwd2("");
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">ملفي الشخصي</h1>
        <p className="text-muted-foreground mt-1">إدارة بياناتك الشخصية وكلمة المرور</p>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">البيانات الشخصية</h2>
        </div>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full-name">الاسم الكامل *</Label>
              <Input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={150} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input id="email" value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job-title">المسمى الوظيفي</Label>
              <Input id="job-title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">القسم</Label>
              <Input id="department" value={department} onChange={(e) => setDepartment(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="phone">رقم الهاتف</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
              {phoneDb && phoneDb !== phone && (
                <p className="text-xs text-muted-foreground">سيتم استبدال: {phoneDb}</p>
              )}
            </div>
          </div>
          <Button type="submit" disabled={savingProfile}>
            {savingProfile && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
            حفظ التغييرات
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">المظهر والحركة</h2>
        </div>

        <div className="space-y-5">
          <div>
            <Label className="text-sm font-medium mb-3 block">ثيم الواجهة</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {THEMES.map((t) => {
                const active = theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { setTheme(t.id); toast.success(`تم تطبيق ثيم: ${t.label}`); }}
                    className={`relative text-right p-3 rounded-lg border transition-all hover-lift ${
                      active ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="h-12 rounded-md mb-2" style={{ background: t.swatch }} />
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{t.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>
                      </div>
                      {active && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-muted/40 border">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <div className="font-medium text-sm">تفعيل الحركات (Animations)</div>
                <p className="text-xs text-muted-foreground mt-1">
                  إيقافها يحسّن الأداء على الأجهزة الضعيفة. يحترم النظام تلقائيًا تفضيل تقليل الحركة.
                </p>
              </div>
            </div>
            <Switch
              checked={animations}
              onCheckedChange={(v) => {
                setAnimations(v);
                toast.success(v ? "تم تفعيل الحركات" : "تم إيقاف الحركات");
              }}
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">تغيير كلمة المرور</h2>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pwd">كلمة المرور الجديدة *</Label>
              <Input id="pwd" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} required minLength={8} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pwd2">تأكيد كلمة المرور *</Label>
              <Input id="pwd2" type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} required minLength={8} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">8 أحرف على الأقل.</p>
          <Button type="submit" disabled={savingPwd}>
            {savingPwd && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
            تحديث كلمة المرور
          </Button>
        </form>
      </Card>
    </div>
  );
}
