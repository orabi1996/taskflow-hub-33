import { createFileRoute, redirect, useNavigate, isRedirect } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo, type FormEvent } from "react";
import { z } from "zod";
import type { Session } from "@supabase/supabase-js";
import { supabase, configureSupabaseClient } from "@/integrations/supabase/client";
import {
  ensureAuthSessionFromCookies,
  getRememberedEmail,
  persistAuthSession,
  purgeSupabaseAuthLocalStorage,
  saveRememberIntent,
  type RememberDuration,
} from "@/lib/auth-session";
import { suggestEmail } from "@/lib/email-suggest";
import { computeDeviceHash } from "@/lib/device-fingerprint";
import { getAuthHeroStats, signInWithLock } from "@/lib/auth-security.functions";
import { recordAuditEvent } from "@/lib/audit.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2, Mail, Lock, User, Briefcase, Eye, EyeOff,
  ShieldCheck, Zap, BarChart3, Users2,
  AlertCircle, CheckCircle2, Info, ArrowLeft, KeyRound, Sparkles,
} from "lucide-react";
import { CrmXLogo, CrmXEmblem } from "@/components/brand/CrmXLogo";
import { AuthAiRobotMascot, type MascotFocusField } from "@/components/auth/AuthAiRobotMascot";
import { ThemeToggle } from "@/components/ThemeToggle";
import { usePreferences } from "@/lib/preferences";
import { ArabicTextReveal, AnimatedCounter, Magnetic } from "@/lib/motion";
import { ModernTechBackground } from "@/components/auth/ModernTechBackground";
import { TechAtmosphereSwitcher, useTechAtmosphere } from "@/components/auth/TechAtmosphereSwitcher";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | CRM-X" },
      { name: "description", content: "بوابة الدخول الذكية إلى CRM-X لإدارة المشاريع وفرق العمل." },
      { property: "og:title", content: "تسجيل الدخول | CRM-X" },
      { property: "og:description", content: "بوابة الدخول الذكية إلى CRM-X لإدارة المشاريع وفرق العمل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: async () => {
    try {
      const session = await ensureAuthSessionFromCookies();
      if (session) throw redirect({ to: "/dashboard" });
    } catch (err) {
      if (isRedirect(err)) throw err;
      console.warn("[auth.beforeLoad] Non-fatal session lookup error:", err);
    }
  },
  component: AuthPage,
});

const signInSchema = z.object({
  email: z.string().trim().email({ message: "البريد الإلكتروني غير صالح" }).max(255),
  password: z.string().min(6, { message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }).max(72),
});

const forgotSchema = z.object({
  email: z.string().trim().email({ message: "البريد الإلكتروني غير صالح" }).max(255),
});

type AlertKind = "error" | "success" | "info";
interface AuthAlert {
  kind: AlertKind;
  title: string;
  description?: string;
}
type Mode = "signin" | "forgot";

const REMEMBER_OPTIONS: { value: RememberDuration; label: string }[] = [
  { value: "session", label: "حتى إغلاق المتصفح" },
  { value: "1d", label: "يوم واحد" },
  { value: "7d", label: "7 أيام" },
  { value: "30d", label: "30 يومًا" },
  { value: "90d", label: "90 يومًا" },
];

const HERO_SLIDES: { title: string; highlight: string; desc: string }[] = [
  {
    title: "حيث تلتقي الأصالة",
    highlight: "بالإدارة الحديثة",
    desc: "منصّة متكاملة تجمع فريقك ومشاريعك وعملاءك في تجربة سلسة، مصمّمة بمعايير عالمية وروح خليجية أصيلة.",
  },
  {
    title: "إدارة مشاريعك",
    highlight: "بذكاء وكفاءة",
    desc: "تابع تقدم الفريق، وزّع المهام، وتلقَّ تنبيهات لحظية تحفظ مواعيدك وتزيد إنتاجيتك يوماً بعد يوم.",
  },
  {
    title: "تقارير حيّة",
    highlight: "وقرارات أسرع",
    desc: "لوحات تحكم تفاعلية، وتحليلات لحظية تُعينك على اتخاذ القرار الصحيح في الوقت الصحيح.",
  },
];

function greetByHour(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "صباح الخير والبركة";
  if (h >= 12 && h < 17) return "طاب يومكم بالمسرات";
  if (h >= 17 && h < 22) return "مساء الخير والريادة";
  return "أهلاً بك، طاب مساؤك";
}

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [focusedField, setFocusedField] = useState<MascotFocusField>(null);
  const [showPw, setShowPw] = useState(false);
  const [alert, setAlert] = useState<AuthAlert | null>(null);
  const [capsOn, setCapsOn] = useState(false);
  const [rememberEmail, setRememberEmail] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [pwTouched, setPwTouched] = useState(false);
  const [pwValue, setPwValue] = useState("");
  const [remember, setRemember] = useState(true);
  const [rememberDuration, setRememberDuration] = useState<RememberDuration>("30d");
  const [greeting, setGreeting] = useState<string>("أهلاً بك");
  const [stats, setStats] = useState<{ users: number; projects: number; tasks: number } | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);

  // Dynamic Living Tech Atmosphere state & responsive theme detection
  const { mode: techMode, setMode: setTechMode } = useTechAtmosphere();
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Restore remembered email & auto-focus
  useEffect(() => {
    const saved = getRememberedEmail();
    setRememberEmail(saved);
    if (saved) setEmailValue(saved);
    purgeSupabaseAuthLocalStorage();
    setGreeting(greetByHour());
    setTimeout(() => {
      if (!saved) emailRef.current?.focus();
      else document.getElementById("si-pw")?.focus();
    }, 200);
  }, []);


  // Watch session: if user becomes authenticated, push to dashboard automatically
  useEffect(() => {
    try {
      const res = supabase.auth.onAuthStateChange((event, session) => {
        if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
          navigate({ to: "/dashboard" }).catch(() => {
            window.location.href = "/dashboard";
          });
        }
      });
      return () => {
        res?.data?.subscription?.unsubscribe?.();
      };
    } catch {
      return () => {};
    }
  }, [navigate]);

  useEffect(() => { setAlert(null); }, [mode]);

  useEffect(() => {
    if (!emailValue || !emailValue.includes("@")) { setEmailSuggestion(null); return; }
    const t = setTimeout(() => setEmailSuggestion(suggestEmail(emailValue)), 350);
    return () => clearTimeout(t);
  }, [emailValue]);

  useEffect(() => {
    getAuthHeroStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setSlideIndex((i) => (i + 1) % HERO_SLIDES.length), 6000);
    return () => clearInterval(id);
  }, []);

  const handleCaps = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsOn(e.getModifierState && e.getModifierState("CapsLock"));
  };

  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue), [emailValue]);
  const pwValid = pwValue.length >= 6;

  const handleSignIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAlert(null);
    const fd = new FormData(e.currentTarget);
    const parsed = signInSchema.safeParse({
      email: fd.get("email"),
      password: fd.get("password"),
    });
    if (!parsed.success) {
      setAlert({ kind: "error", title: "تحقق من البيانات", description: parsed.error.issues[0].message });
      return;
    }
    setLoading(true);

    let guard: Awaited<ReturnType<typeof signInWithLock>>;
    try {
      guard = await signInWithLock({
        data: {
          email: parsed.data.email,
          password: parsed.data.password,
          duration: remember ? rememberDuration : "session",
        },
      });
    } catch {
      setLoading(false);
      setAlert({
        kind: "error",
        title: "خدمة تسجيل الدخول غير متاحة",
        description: "تعذّر الاتصال بخدمة التحقق الآمنة. يرجى المحاولة بعد لحظات.",
      });
      return;
    }

    if (!guard.ok) {
      setLoading(false);
      setAlert({
        kind: "error",
        title: guard.locked ? "تم قفل المحاولات مؤقتًا" : "تعذّر تسجيل الدخول",
        description: guard.locked
          ? `تم تجاوز عدد المحاولات المسموح بها. حاول مجددًا بعد ${guard.windowMinutes} دقيقة.`
          : guard.message === "Invalid login credentials"
            ? `البريد الإلكتروني أو كلمة المرور غير صحيحة. المحاولات المتبقية: ${guard.remaining}.`
            : guard.message,
      });
      return;
    }

    if (guard.publicConfig?.supabaseUrl && guard.publicConfig?.supabaseAnonKey) {
      configureSupabaseClient(guard.publicConfig.supabaseUrl, guard.publicConfig.supabaseAnonKey);
    }

    let session: Session | null = null;
    try {
      const res = await supabase.auth.setSession({
        access_token: guard.session!.access_token,
        refresh_token: guard.session!.refresh_token,
      });
      session = res?.data?.session ?? null;
    } catch (sessionErr) {
      console.warn("[Auth] Client setSession fetch error, falling back to server session:", sessionErr);
    }

    if (!session && guard.session) {
      const fallbackUser = (guard.user as any) ?? {
        id: guard.userId ?? "auth-user",
        email: parsed.data.email,
        aud: "authenticated",
        role: "authenticated",
        app_metadata: {},
        user_metadata: {},
        created_at: new Date().toISOString(),
      };
      session = {
        access_token: guard.session.access_token,
        refresh_token: guard.session.refresh_token,
        expires_in: 3600,
        token_type: "bearer",
        user: fallbackUser,
      } as unknown as Session;
    }

    setLoading(false);

    if (!session) {
      setAlert({
        kind: "error",
        title: "تعذّر تهيئة الجلسة",
        description: "حدث خطأ أثناء تهيئة جلسة العمل. يرجى المحاولة مرة أخرى.",
      });
      return;
    }

    void recordAuditEvent({
      data: {
        actorId: session.user.id,
        actorEmail: parsed.data.email,
        eventType: "auth.login_success",
        severity: "info",
        resourceType: "auth.user",
        resourceId: session.user.id,
        metadata: null,
      },
    }).catch(() => {});

    await persistAuthSession(session, remember ? rememberDuration : "session", parsed.data.email);
    void (async () => {
      try {
        const deviceHash = await computeDeviceHash();
        await supabase
          .from("trusted_devices")
          .upsert(
            {
              user_id: session!.user.id,
              device_hash: deviceHash,
              user_agent: navigator.userAgent.slice(0, 500),
              last_seen_at: new Date().toISOString(),
            },
            { onConflict: "user_id,device_hash" },
          );
      } catch { /* ignore */ }
    })();

    setAlert({ kind: "success", title: "تم تسجيل الدخول بنجاح", description: "جاري تحويلك إلى لوحة التحكم..." });

    navigate({ to: "/dashboard" }).catch(() => {
      window.location.href = "/dashboard";
    });
    setTimeout(() => {
      if (typeof window !== "undefined" && window.location.pathname.startsWith("/auth")) {
        window.location.href = "/dashboard";
      }
    }, 400);
  };

  const handleForgot = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAlert(null);
    const fd = new FormData(e.currentTarget);
    const parsed = forgotSchema.safeParse({ email: fd.get("email") });
    if (!parsed.success) {
      setAlert({ kind: "error", title: "تحقق من البيانات", description: parsed.error.issues[0].message });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setAlert({ kind: "error", title: "تعذّر إرسال الرابط", description: error.message });
      return;
    }
    setAlert({
      kind: "success",
      title: "تم إرسال رابط الاسترداد",
      description: "تحقق من بريدك الإلكتروني واتبع الرابط لإعادة تعيين كلمة المرور.",
    });
  };

  const isSignIn = mode === "signin";
  const isForgot = mode === "forgot";

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4 sm:px-6 py-6 sm:py-10 relative overflow-hidden font-ui">
      {/* ── 1. Modern Procedural Tech Atmosphere (Zero Static Landscape Photos) ── */}
      <ModernTechBackground mode={techMode} isDarkTheme={isDark} />

      {/* ── 2. Top Floating Glass Control Bar ── */}
      <header className="absolute top-[max(1rem,env(safe-area-inset-top))] start-[max(1rem,env(safe-area-inset-left))] z-30 flex items-center gap-2">
        <div className="rounded-2xl border border-white/15 bg-background/60 backdrop-blur-xl p-1 shadow-sm">
          <ThemeToggle />
        </div>
        <TechAtmosphereSwitcher currentMode={techMode} onModeChange={setTechMode} />
      </header>

      {/* ── 4. The Monolithic Glassmorphic Luxury Command Center ── */}
      <main className="w-full max-w-5xl mx-auto relative z-10 animate-scale-in">
        <div className="rounded-[28px] border border-white/20 dark:border-white/10 bg-card/85 dark:bg-card/75 backdrop-blur-2xl shadow-[0_24px_70px_-12px_rgba(0,0,0,0.45)] overflow-hidden grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] transition-all duration-500">
          
          {/* ── HERO SIDE (Desktop Architectural Monument) ── */}
          <section aria-label="نبذة عن المنظومة" className="p-8 sm:p-10 lg:p-12 hidden lg:flex flex-col justify-between relative bg-gradient-to-br from-primary/10 via-transparent to-accent/10 border-e border-border/40">
            <div className="flex flex-col h-full justify-between gap-8 relative z-10">
              
              {/* Brand Header */}
              <div className="flex items-center gap-3">
                <div className="rounded-2xl px-4 py-2.5 bg-background/70 backdrop-blur-md border border-white/20 shadow-sm flex items-center gap-3">
                  <CrmXEmblem size={34} />
                  <div className="flex flex-col">
                    <span dir="ltr" className="font-black text-lg tracking-tight text-foreground">
                      CRM<span className="text-primary">-</span><span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">X</span>
                    </span>
                    <span className="text-[7.5px] font-bold text-primary tracking-widest uppercase">
                      People · Pipelines · Possibilities
                    </span>
                  </div>
                </div>
              </div>

              {/* Headline & Arabic Typography Reveal */}
              <div className="space-y-6 max-w-lg">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 border border-primary/30 px-3.5 py-1 text-xs font-semibold text-primary shadow-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>المنظومة المتكاملة للمؤسسات والشركات</span>
                </div>

                <div key={slideIndex} className="space-y-3">
                  <h2 className="text-3xl lg:text-[2.6rem] font-bold font-display leading-[1.22] text-foreground tracking-tight">
                    <ArabicTextReveal
                      text={`${HERO_SLIDES[slideIndex].title} ${HERO_SLIDES[slideIndex].highlight}`}
                      as="span"
                      className="text-foreground"
                    />
                  </h2>
                  <div className="w-20 h-1 bg-gradient-to-r from-primary to-primary-glow rounded-full mt-2" />
                  <p className="text-sm lg:text-base text-muted-foreground font-reading leading-relaxed pt-2">
                    {HERO_SLIDES[slideIndex].desc}
                  </p>
                </div>

                {/* Slide Indicators */}
                <div className="flex items-center gap-1.5 pt-1" role="tablist" aria-label="شرائح التعريف">
                  {HERO_SLIDES.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      role="tab"
                      aria-selected={i === slideIndex}
                      aria-label={`الشريحة ${i + 1}`}
                      onClick={() => setSlideIndex(i)}
                      className="h-1.5 rounded-full transition-all duration-300"
                      style={{
                        width: i === slideIndex ? "28px" : "8px",
                        background: i === slideIndex ? "var(--primary)" : "color-mix(in oklab, var(--primary) 25%, transparent)",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Feature Grid & Live KPI Counters */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-2xl border border-white/10 bg-background/50 backdrop-blur-sm flex items-center gap-2.5 transition-transform hover:scale-102">
                    <div className="p-2 rounded-xl bg-primary/15 text-primary"><Zap className="w-4 h-4" /></div>
                    <div>
                      <div className="text-xs font-bold text-foreground">أداء فائق</div>
                      <div className="text-[11px] text-muted-foreground">سرعة واستجابة فورية</div>
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl border border-white/10 bg-background/50 backdrop-blur-sm flex items-center gap-2.5 transition-transform hover:scale-102">
                    <div className="p-2 rounded-xl bg-primary/15 text-primary"><ShieldCheck className="w-4 h-4" /></div>
                    <div>
                      <div className="text-xs font-bold text-foreground">حماية بنكية</div>
                      <div className="text-[11px] text-muted-foreground">تشفير وأمان معتمد</div>
                    </div>
                  </div>
                </div>

                {stats && (
                  <div className="grid grid-cols-3 gap-2.5 p-3 rounded-2xl bg-primary/5 border border-primary/15 text-center">
                    <div>
                      <div className="text-xl font-bold font-display text-primary">
                        <AnimatedCounter value={stats.users} />
                      </div>
                      <div className="text-[10px] text-muted-foreground">موظف نشط</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold font-display text-primary">
                        <AnimatedCounter value={stats.projects} />
                      </div>
                      <div className="text-[10px] text-muted-foreground">مشروع فعّال</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold font-display text-primary">
                        <AnimatedCounter value={stats.tasks} />
                      </div>
                      <div className="text-[10px] text-muted-foreground">مهمة منجزة</div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </section>

          {/* ── FORM SIDE (The Interactive Gateway) ── */}
          <section aria-label="نموذج تسجيل الدخول" className="p-6 sm:p-9 lg:p-11 flex flex-col justify-center relative bg-card/60 backdrop-blur-xl">
            
            {/* Mobile Brand Emblem Header */}
            <div className="flex justify-center mb-4 lg:hidden">
              <div className="rounded-2xl px-4 py-2 bg-background/80 backdrop-blur-md border border-white/15 shadow-xs flex items-center gap-2.5">
                <CrmXEmblem size={28} />
                <span dir="ltr" className="font-black text-base tracking-tight text-foreground">
                  CRM<span className="text-primary">-</span><span className="text-primary-glow">X</span>
                </span>
              </div>
            </div>

            {/* Interactive AI Mascot Robot */}
            <div className="flex justify-center mb-3">
              <AuthAiRobotMascot
                focusedField={focusedField}
                emailLength={mode === "forgot" ? 0 : emailValue.length}
                isEmailValid={emailValid}
                showPassword={showPw}
                capsLock={capsOn}
                isLoading={loading}
                isSuccess={alert?.kind === "success"}
                isError={alert?.kind === "error"}
                mode={mode}
                greeting={greeting}
              />
            </div>

            <div key={mode} className="animate-fade-in space-y-4">
              {isForgot ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 mb-3 transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> العودة لتسجيل الدخول
                  </button>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                      <KeyRound className="h-5 w-5" />
                    </div>
                    <h1 className="text-2xl font-bold font-display tracking-tight">استرداد كلمة المرور</h1>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed font-reading">
                    أدخل بريدك الإلكتروني المعتمد وسنرسل لك رابطًا لإعادة تعيين كلمة المرور فورًا.
                  </p>
                </div>
              ) : (
                <div className="text-start space-y-1">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-0.5 text-[11px] font-semibold text-primary">
                    <span>✦</span>
                    {greeting}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-foreground">
                    تفضّل بتسجيل الدخول
                  </h1>
                  <p className="text-muted-foreground text-xs font-reading">
                    أدخل بيانات الاعتماد للوصول إلى مساحة العمل الخاصة بك.
                  </p>
                </div>
              )}

              {alert && <AlertBox alert={alert} onClose={() => setAlert(null)} />}

              {isSignIn && (
                <form onSubmit={handleSignIn} className="space-y-4" autoComplete="on">
                  {/* Email Field */}
                  <div className="space-y-1.5">
                    <Label htmlFor="si-email" className="text-xs font-medium text-foreground/80 flex items-center justify-between">
                      <span>البريد الإلكتروني</span>
                      {emailValue && emailValid && (
                        <span className="text-[11px] text-emerald-500 font-semibold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> تم التحقق
                        </span>
                      )}
                    </Label>
                    <div
                      className="flex items-center px-3.5 h-12 rounded-2xl bg-muted/30 border border-input focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-200"
                      data-invalid={emailTouched && !emailValid}
                    >
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0 ms-0.5" />
                      <Input
                        id="si-email"
                        name="email"
                        type="email"
                        required
                        dir="ltr"
                        autoComplete="username email"
                        ref={emailRef}
                        value={emailValue}
                        onChange={(e) => setEmailValue(e.target.value)}
                        onFocus={() => setFocusedField("email")}
                        onBlur={() => { setEmailTouched(true); setFocusedField(null); }}
                        className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-full text-sm text-start"
                        placeholder="you@company.com"
                      />
                      {emailValue && (
                        emailValid
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          : emailTouched && <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                      )}
                    </div>
                    {emailSuggestion && (
                      <button
                        type="button"
                        onClick={() => { setEmailValue(emailSuggestion); setEmailSuggestion(null); }}
                        className="text-[11px] text-primary bg-primary/10 border border-primary/20 rounded-lg px-2.5 py-1 inline-flex items-center gap-1 hover:bg-primary/15 transition"
                      >
                        <Info className="h-3 w-3" />
                        هل تقصد <span dir="ltr" className="font-semibold">{emailSuggestion}</span>؟
                      </button>
                    )}
                  </div>

                  {/* Password Field */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="si-pw" className="text-xs font-medium text-foreground/80">كلمة المرور</Label>
                      <button
                        type="button"
                        onClick={() => setMode("forgot")}
                        className="text-xs text-primary hover:underline transition-colors"
                      >
                        نسيت كلمة المرور؟
                      </button>
                    </div>
                    <div className="flex items-center px-3.5 h-12 rounded-2xl bg-muted/30 border border-input focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-200">
                      <Lock className="h-4 w-4 text-muted-foreground shrink-0 ms-0.5" />
                      <Input
                        id="si-pw"
                        name="password"
                        type={showPw ? "text" : "password"}
                        required
                        dir="ltr"
                        autoComplete="current-password"
                        value={pwValue}
                        onChange={(e) => setPwValue(e.target.value)}
                        onKeyDown={handleCaps}
                        onKeyUp={handleCaps}
                        onFocus={() => setFocusedField("password")}
                        onBlur={() => { setPwTouched(true); setFocusedField(null); }}
                        className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-full text-sm text-start"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        title={showPw ? "إخفاء" : "إظهار"}
                      >
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {capsOn && (
                      <div className="text-[11px] text-amber-500 flex items-center gap-1">
                        <Info className="h-3 w-3" /> تنبيه: Caps Lock مفعّل
                      </div>
                    )}
                  </div>

                  {/* Remember Me Selector */}
                  <div className="rounded-2xl border border-white/10 bg-muted/20 p-3 space-y-2.5">
                    <label className="flex items-center gap-2.5 text-xs text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        className="rounded-md accent-primary h-4 w-4"
                      />
                      <span>تذكرني على هذا الجهاز عبر ملفات تعريف آمنة</span>
                    </label>
                    {remember && (
                      <div className="grid grid-cols-5 gap-1.5 pt-0.5">
                        {REMEMBER_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setRememberDuration(opt.value)}
                            data-active={rememberDuration === opt.value}
                            className="py-1.5 px-1 rounded-xl border text-[10px] font-medium transition-all text-center data-[active=true]:border-primary data-[active=true]:bg-primary/15 data-[active=true]:text-primary text-muted-foreground hover:bg-muted/40"
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Submit CTA with Magnetic Hover */}
                  <Magnetic strength={0.2} className="w-full pt-1">
                    <Button
                      type="submit"
                      disabled={loading || !emailValid || !pwValid}
                      className="w-full h-12 rounded-2xl bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-semibold text-sm shadow-md hover:shadow-primary/30 transition-all duration-300 disabled:opacity-50"
                    >
                      {loading && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
                      <span>{loading ? "جارٍ التحقق والتشفير…" : "تسجيل الدخول إلى المنظومة"}</span>
                    </Button>
                  </Magnetic>

                  {/* Trust Badges */}
                  <div className="pt-2 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> تشفير TLS</span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-primary" /> حماية RLS السحابية</span>
                  </div>
                </form>
              )}

              {isForgot && (
                <form onSubmit={handleForgot} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="fo-email" className="text-xs font-medium text-foreground/80">البريد الإلكتروني</Label>
                    <div className="flex items-center px-3.5 h-12 rounded-2xl bg-muted/30 border border-input focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-200">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0 ms-0.5" />
                      <Input
                        id="fo-email"
                        name="email"
                        type="email"
                        required
                        dir="ltr"
                        value={emailValue}
                        onChange={(e) => setEmailValue(e.target.value)}
                        className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-full text-sm text-start"
                        placeholder="you@company.com"
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={loading || !emailValid} className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold">
                    {loading && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
                    <span>إرسال رابط الاسترداد</span>
                  </Button>
                </form>
              )}
            </div>

            {/* Copyright Footer */}
            <footer className="mt-6 text-center text-[10px] text-muted-foreground/70">
              © {new Date().getFullYear()} CRM-X · TaskFlow Hub — جميع الحقوق محفوظة
            </footer>

          </section>

        </div>
      </main>
    </div>
  );
}

function AlertBox({ alert, onClose }: { alert: AuthAlert; onClose: () => void }) {
  const isErr = alert.kind === "error";
  const isSucc = alert.kind === "success";
  return (
    <div
      role="alert"
      className={`p-3.5 rounded-2xl border text-xs flex items-start gap-3 transition-all ${
        isErr
          ? "bg-destructive/10 border-destructive/30 text-destructive"
          : isSucc
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
            : "bg-primary/10 border-primary/30 text-primary"
      }`}
    >
      {isErr && <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
      {isSucc && <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />}
      {!isErr && !isSucc && <Info className="h-4 w-4 shrink-0 mt-0.5" />}
      <div className="flex-1">
        <div className="font-bold">{alert.title}</div>
        {alert.description && <div className="mt-0.5 text-muted-foreground leading-relaxed">{alert.description}</div>}
      </div>
      <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
    </div>
  );
}
