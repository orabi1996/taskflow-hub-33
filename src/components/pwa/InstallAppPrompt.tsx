import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CrmXAppIcon } from "@/components/brand/CrmXLogo";
import { Download, X, Sparkles } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if running in standalone PWA mode
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    setIsStandalone(isStandaloneMode);

    if (isStandaloneMode) return;

    // Check if dismissed in this session
    const dismissed = sessionStorage.getItem("crm_x_pwa_dismissed");
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setShowPrompt(false);
      }
    } catch {
      // Ignored
    } finally {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem("crm_x_pwa_dismissed", "true");
  };

  if (isStandalone || !showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div
      dir="rtl"
      className="fixed bottom-4 start-4 end-4 md:start-auto md:end-6 z-50 max-w-sm rounded-xl border border-primary/30 bg-card/95 p-3.5 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <CrmXAppIcon size={36} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
            <span>تثبيت تطبيق CRM-X Enterprise</span>
            <span className="flex items-center gap-0.5 text-[9px] text-teal-600 dark:text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded-full border border-teal-500/20 font-semibold">
              <Sparkles className="h-2.5 w-2.5" />
              PWA
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
            ثبّت التطبيق على شاشة جهازك للوصول السريع وتلقي التنبيهات المباشرة دون الحاجة لمتصفح.
          </p>

          <div className="flex items-center gap-2 mt-2.5">
            <Button
              size="sm"
              onClick={handleInstallClick}
              className="h-7 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold px-3"
            >
              <Download className="h-3 w-3" />
              <span>تثبيت التطبيق</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
            >
              <span>لاحقاً</span>
            </Button>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="text-muted-foreground/60 hover:text-foreground transition-colors p-1"
          aria-label="إغلاق"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
