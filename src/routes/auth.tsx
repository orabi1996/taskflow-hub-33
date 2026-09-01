import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
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
import { checkLoginRate, recordLoginAttempt, getAuthHeroStats } from "@/lib/auth-security.functions";
import { recordAuditEvent } from "@/lib/audit.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2, Mail, Lock, User, Briefcase, Eye, EyeOff,
  ShieldCheck, Zap, BarChart3, Users2,
  AlertCircle, CheckCircle2, Info, ArrowLeft, KeyRound,
} from "lucide-react";
import brandLogoAsset from "@/assets/classera-smarx-logo.png.asset.json";

const brandLogo = brandLogoAsset.url;
import heroPhoto from "@/assets/auth-hero-photo-overlay.jpg";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    const session = await ensureAuthSessionFromCookies();
    if (session) throw redirect({ to: "/dashboard" });
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


function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
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
  const bgRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // Restore remembered email
  useEffect(() => {
    const saved = getRememberedEmail();
    setRememberEmail(saved);
    if (saved) setEmailValue(saved);
    purgeSupabaseAuthLocalStorage();
    setGreeting(greetByHour());
    // Auto-focus first empty field
    setTimeout(() => {
      if (!saved) emailRef.current?.focus();
      else document.getElementById("si-pw")?.focus();
    }, 200);
  }, []);

  // Floating particles (generated once)
  const particles = useMemo(
    () => Array.from({ length: 14 }, (_, i) => ({
      left: `${(i * 73) % 100}%`,
      size: 4 + ((i * 7) % 6),
      delay: (i * 1.3) % 8,
      duration: 14 + ((i * 5) % 10),
      opacity: 0.4 + ((i * 3) % 5) / 10,
    })),
    [],
  );

  // Parallax: track mouse → CSS vars on .auth-bg
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = bgRef.current; if (!el) return;
        const x = (e.clientX / window.innerWidth) * 100;
        const y = (e.clientY / window.innerHeight) * 100;
        el.style.setProperty("--mx", `${x}%`);
        el.style.setProperty("--my", `${y}%`);
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => { window.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, []);

  // Watch session: if user becomes authenticated, push to dashboard automatically
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        navigate({ to: "/dashboard" });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Reset alert when switching modes
  useEffect(() => { setAlert(null); }, [mode]);

  // Email typo detection (debounced)
  useEffect(() => {
    if (!emailValue || !emailValue.includes("@")) { setEmailSuggestion(null); return; }
    const t = setTimeout(() => setEmailSuggestion(suggestEmail(emailValue)), 350);
    return () => clearTimeout(t);
  }, [emailValue]);

  // Fetch live hero stats once
  useEffect(() => {
    getAuthHeroStats().then(setStats).catch(() => {});
  }, []);

  // Auto-rotate hero slides every 6s
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

    // Pre-check rate limit
    try {
      const rate = await checkLoginRate({ data: { email: parsed.data.email } });
      if (rate.locked) {
        setLoading(false);
        setAlert({
          kind: "error",
          title: "تم قفل المحاولات مؤقتًا",
          description: `تم تجاوز عدد المحاولات المسموح بها. يُرجى الانتظار حتى ${rate.windowMinutes} دقيقة قبل المحاولة مجددًا.`,
        });
        return;
      }
    } catch { /* fail-open: don't block legitimate users on rate-check error */ }

    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);

    // Log attempt (fire & forget)
    void recordLoginAttempt({
      data: {
        email: parsed.data.email,
        success: !error,
        reason: error?.message,
      },
    }).catch(() => {});

    // Centralized audit log entry
    void recordAuditEvent({
      data: {
        actorId: data?.user?.id ?? null,
        actorEmail: parsed.data.email,
        eventType: error ? "auth.login_failed" : "auth.login_success",
        severity: error ? "warn" : "info",
        resourceType: "auth.user",
        resourceId: data?.user?.id ?? null,
        metadata: error ? { reason: error.message } : null,
      },
    }).catch(() => {});

    if (error) {
      setAlert({
        kind: "error",
        title: "تعذّر تسجيل الدخول",
        description: error.message === "Invalid login credentials"
          ? "البريد الإلكتروني أو كلمة المرور غير صحيحة. حاول مرة أخرى."
          : error.message.includes("Email not confirmed")
            ? "لم يتم تأكيد البريد بعد. تحقق من صندوق الوارد."
            : error.message,
      });
      return;
    }
    if (data.session) {
      persistAuthSession(data.session, remember ? rememberDuration : "session", parsed.data.email);
      // Register / refresh trusted device (best-effort)
      void (async () => {
        try {
          const deviceHash = await computeDeviceHash();
          await supabase
            .from("trusted_devices")
            .upsert(
              {
                user_id: data.session!.user.id,
                device_hash: deviceHash,
                user_agent: navigator.userAgent.slice(0, 500),
                last_seen_at: new Date().toISOString(),
              },
              { onConflict: "user_id,device_hash" },
            );
        } catch { /* ignore */ }
      })();
    }
    setAlert({ kind: "success", title: "تم تسجيل الدخول بنجاح", description: "جاري تحويلك إلى لوحة التحكم..." });
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
    <div ref={bgRef} className="min-h-screen auth-bg flex items-center justify-center px-4 py-8 relative overflow-hidden">
      <img src={heroPhoto} alt="" className="auth-bg-image" aria-hidden="true" />
      <div className="auth-bg-mesh" aria-hidden="true" />
      <div className="auth-bg-veil" aria-hidden="true" />
      <div className="auth-particles" aria-hidden="true">
        {particles.map((p, i) => (
          <span
            key={i}
            style={{
              left: p.left,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              opacity: p.opacity,
            }}
          />
        ))}
      </div>
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/8 blur-3xl pointer-events-none z-[2]" />
      <div className="absolute -bottom-40 -left-32 w-[28rem] h-[28rem] rounded-full bg-accent/8 blur-3xl pointer-events-none z-[2]" />

      <div className="w-full max-w-6xl mx-auto relative z-10 animate-scale-in">
        <div className="auth-card grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] min-h-[560px] lg:min-h-[640px]">
          {/* HERO SIDE (towers are now in page background) */}
          <div className="auth-hero-photo p-10 lg:p-12 flex flex-col justify-between text-foreground order-1 min-h-[280px] lg:min-h-0">
            <div className="hero-content flex flex-col h-full justify-between gap-8">
              <div className="flex items-center gap-3">
                <div className="bg-white rounded-2xl px-4 py-2.5 md-elev-1 ring-1 ring-border">
                  <img src={brandLogo} alt="Classera | C-SmarX" className="h-10 w-auto" />
                </div>
                <div>
                  <div className="font-bold text-base leading-tight tracking-wide text-foreground">C-SmarX</div>
                  <div className="text-[11px] text-muted-foreground leading-tight">من Classera</div>
                </div>
              </div>

              <div className="space-y-7 max-w-md">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    أهلاً وسهلاً بكم
                  </div>
                  <div key={slideIndex} className="auth-form-fade">
                    <h1 className="text-3xl lg:text-[2.6rem] font-bold leading-[1.15] tracking-tight text-foreground">
                      {HERO_SLIDES[slideIndex].title} <br />
                      <span className="text-primary">
                        {HERO_SLIDES[slideIndex].highlight}
                      </span>
                    </h1>
                    <div className="gold-divider mt-3" />
                    <p className="text-sm lg:text-[0.95rem] text-muted-foreground leading-relaxed font-light mt-3">
                      {HERO_SLIDES[slideIndex].desc}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1" role="tablist" aria-label="شرائح الترحيب">
                    {HERO_SLIDES.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        role="tab"
                        aria-selected={i === slideIndex}
                        aria-label={`الشريحة ${i + 1}`}
                        onClick={() => setSlideIndex(i)}
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: i === slideIndex ? "26px" : "8px",
                          background: i === slideIndex ? "var(--primary)" : "color-mix(in oklab, var(--primary) 25%, transparent)",
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <FeatureCard icon={<Zap className="h-4 w-4" />} title="أداء فائق" desc="تجربة سلسة وسريعة" delay={0.05} />
                  <FeatureCard icon={<ShieldCheck className="h-4 w-4" />} title="حماية عالية" desc="بياناتك بأمان دائم" delay={0.15} />
                  <FeatureCard icon={<BarChart3 className="h-4 w-4" />} title="تقارير لحظية" desc="تحليلات واضحة ومباشرة" delay={0.25} />
                  <FeatureCard icon={<Users2 className="h-4 w-4" />} title="تعاون فوري" desc="تواصل أسرع داخل فريقك" delay={0.35} />
                </div>

                {stats && (
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <StatPill label="موظفون" value={stats.users} />
                    <StatPill label="مشاريع" value={stats.projects} />
                    <StatPill label="مهام" value={stats.tasks} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* FORM SIDE */}
          <div className="auth-form-side p-8 sm:p-10 lg:p-12 flex flex-col justify-center order-2">

            <div key={mode} className="auth-form-fade">
              {isForgot ? (
                <>
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4"
                  >
                    <ArrowLeft className="h-3 w-3" /> العودة لتسجيل الدخول
                  </button>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <KeyRound className="h-5 w-5" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">استرداد كلمة المرور</h2>
                  </div>
                  <p className="text-muted-foreground text-sm mb-5">
                    أدخل بريدك الإلكتروني وسنرسل لك رابطًا لإعادة تعيين كلمة المرور.
                  </p>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-[11px] font-semibold text-primary mb-3">
                    <span className="text-primary">✦</span>
                    {greeting}
                  </div>
                  <h2 className="text-2xl lg:text-3xl font-bold mb-2 tracking-tight">
                    تفضّل بتسجيل الدخول
                  </h2>
                  <div className="gold-divider mb-4" />
                  <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
                    أدخل بياناتك للوصول إلى لوحة التحكم الخاصة بك.
                  </p>
                </>
              )}

              {alert && <AlertBox alert={alert} onClose={() => setAlert(null)} />}


              {isSignIn && (
                <form onSubmit={handleSignIn} className="space-y-4" autoComplete="on">
                  <div className="space-y-1.5">
                    <Label htmlFor="si-email" className="text-xs font-semibold text-foreground/70">
                      البريد الإلكتروني
                    </Label>
                    <div
                      className="auth-input-soft rounded-xl flex items-center px-3"
                      data-invalid={emailTouched && !emailValid}
                    >
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Input
                        id="si-email" name="email" type="email" required dir="ltr"
                        autoComplete="username email"
                        ref={emailRef}
                        value={emailValue}
                        onChange={(e) => setEmailValue(e.target.value)}
                        onBlur={() => setEmailTouched(true)}
                        aria-invalid={emailTouched && !emailValid}
                        className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-11"
                        placeholder="you@example.com"
                      />
                      {emailValue && (
                        emailValid
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-label="صالح" />
                          : emailTouched && <AlertCircle className="h-4 w-4 text-destructive shrink-0" aria-label="غير صالح" />
                      )}
                    </div>
                    {emailTouched && !emailValid && emailValue && (
                      <div className="text-[11px] text-destructive flex items-center gap-1">
                        <Info className="h-3 w-3" /> صيغة البريد غير صحيحة
                      </div>
                    )}
                    {emailSuggestion && (
                      <button
                        type="button"
                        onClick={() => { setEmailValue(emailSuggestion); setEmailSuggestion(null); }}
                        className="text-[11px] text-primary bg-primary/10 border border-primary/20 rounded-md px-2 py-1 inline-flex items-center gap-1 hover:bg-primary/15 transition"
                      >
                        <Info className="h-3 w-3" />
                        هل تقصد <span dir="ltr" className="font-semibold">{emailSuggestion}</span>؟
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="si-pw" className="text-xs font-semibold text-foreground/70">
                        كلمة المرور
                      </Label>
                      <button type="button" onClick={() => setMode("forgot")} className="text-xs text-primary hover:underline font-medium">
                        نسيت كلمة المرور؟
                      </button>
                    </div>
                    <div
                      className="auth-input-soft rounded-xl flex items-center px-3"
                      data-invalid={pwTouched && !pwValid}
                    >
                      <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Input
                        id="si-pw" name="password" type={showPw ? "text" : "password"}
                        required dir="ltr" autoComplete="current-password"
                        value={pwValue}
                        onChange={(e) => setPwValue(e.target.value)}
                        onBlur={() => setPwTouched(true)}
                        onKeyDown={handleCaps} onKeyUp={handleCaps}
                        aria-invalid={pwTouched && !pwValid}
                        className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-11"
                        placeholder="••••••••"
                      />
                      <button type="button" onClick={() => setShowPw((v) => !v)}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1"
                        aria-label={showPw ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {pwTouched && !pwValid && (
                      <div className="text-[11px] text-destructive flex items-center gap-1">
                        <Info className="h-3 w-3" /> كلمة المرور يجب أن تكون 6 أحرف على الأقل
                      </div>
                    )}
                    {capsOn && (
                      <div className="text-[11px] text-warning-foreground bg-warning/15 rounded-md px-2 py-1 inline-flex items-center gap-1">
                        <Info className="h-3 w-3" /> Caps Lock مفعّل
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        className="rounded accent-primary"
                      />
                      تذكرني على هذا الجهاز باستخدام cookies آمنة
                    </label>
                    {remember && (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {REMEMBER_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setRememberDuration(option.value)}
                            data-active={rememberDuration === option.value}
                            className="rounded-lg border px-2 py-1.5 text-[11px] text-muted-foreground transition-colors data-[active=true]:border-primary data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button type="submit" disabled={loading || !emailValid || !pwValid}
                    className="auth-cta w-full h-12 rounded-xl font-semibold tracking-wide mt-2">
                    {loading && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
                    {loading ? "جارٍ التحقق من بياناتك…" : "تسجيل الدخول"}
                  </Button>

                  <div className="auth-trust">
                    <span><ShieldCheck className="h-3.5 w-3.5" /> اتصال مشفّر TLS</span>
                    <span><Lock className="h-3.5 w-3.5" /> حماية ضد المحاولات المتكررة</span>
                  </div>
                </form>
              )}


              {/* Sign-up disabled — accounts are created by administrators */}

              {isForgot && (
                <form onSubmit={handleForgot} className="space-y-4">
                  <Field id="fg-email" label="البريد الإلكتروني" icon={<Mail className="h-4 w-4 text-muted-foreground shrink-0" />}>
                    <Input id="fg-email" name="email" type="email" required dir="ltr" autoComplete="email"
                      defaultValue={rememberEmail}
                      className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-11"
                      placeholder="you@example.com" />
                  </Field>
                  <Button type="submit" disabled={loading}
                    className="w-full h-11 rounded-xl font-semibold tracking-wide hover-lift mt-2 shadow-lg shadow-primary/20">
                    {loading && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
                    إرسال رابط الاسترداد
                  </Button>
                </form>
              )}
            </div>

            <p className="text-center text-xs text-muted-foreground mt-8">
              © {new Date().getFullYear()} Classera — جميع الحقوق محفوظة
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Helpers ---------- */
function greetByHour(): string {
  const h = new Date().getHours();
  if (h < 12) return "صباح الخير";
  if (h < 17) return "مساء الخير";
  return "مساء النور";
}

function Field({
  id, label, icon, children,
}: { id: string; label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold text-foreground/70">{label}</Label>
      <div className="auth-input-soft rounded-xl flex items-center px-3">
        {icon}
        {children}
      </div>
    </div>
  );
}

function FeatureCard({
  icon, title, desc, delay = 0,
}: { icon: React.ReactNode; title: string; desc: string; delay?: number }) {
  return (
    <div className="feature-card-light" style={{ animationDelay: `${delay}s` }}>
      <div className="fc-icon">{icon}</div>
      <div className="min-w-0">
        <div className="fc-title">{title}</div>
        <div className="fc-desc">{desc}</div>
      </div>
    </div>
  );
}

function AlertBox({ alert, onClose }: { alert: AuthAlert; onClose: () => void }) {
  const Icon = alert.kind === "error" ? AlertCircle : alert.kind === "success" ? CheckCircle2 : Info;
  return (
    <div className={`auth-alert auth-alert-${alert.kind} mb-4`} role="alert">
      <Icon className="aa-icon h-4 w-4" />
      <div className="flex-1 min-w-0">
        <div className="aa-title">{alert.title}</div>
        {alert.description && <div className="opacity-90">{alert.description}</div>}
      </div>
      <button type="button" onClick={onClose} className="opacity-60 hover:opacity-100 text-xs px-1" aria-label="إغلاق">✕</button>
    </div>
  );
}


function StatPill({ label, value }: { label: string; value: number }) {
  const display = value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toLocaleString("ar-EG");
  return (
    <div className="rounded-2xl bg-primary/8 border border-border px-3 py-2 text-center">
      <div className="text-lg font-bold text-foreground leading-tight tabular-nums">{display}</div>
      <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{label}</div>
    </div>
  );
}
