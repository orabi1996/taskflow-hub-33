import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeName = "aurora" | "mint" | "slate";
export type ColorMode = "light" | "dark" | "system";
export const THEMES: { id: ThemeName; label: string; description: string; swatch: string }[] = [
  { id: "aurora", label: "أورورا", description: "تيل عميق + كهرماني دافئ (الافتراضي)", swatch: "linear-gradient(135deg, oklch(0.45 0.13 230), oklch(0.74 0.14 65))" },
  { id: "mint", label: "نعناع", description: "أخضر هادئ ومنعش", swatch: "linear-gradient(135deg, oklch(0.55 0.12 165), oklch(0.78 0.12 145))" },
  { id: "slate", label: "رصاصي", description: "محايد وأنيق", swatch: "linear-gradient(135deg, oklch(0.4 0.04 260), oklch(0.7 0.05 250))" },
];

type Prefs = {
  theme: ThemeName;
  animations: boolean;
  mode: ColorMode;
  setTheme: (t: ThemeName) => void;
  setAnimations: (v: boolean) => void;
  setMode: (m: ColorMode) => void;
};

const Ctx = createContext<Prefs | null>(null);
const LS_KEY = "ui-prefs-v1";

function readInitial(): { theme: ThemeName; animations: boolean; mode: ColorMode } {
  if (typeof window === "undefined") return { theme: "aurora", animations: true, mode: "system" };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        theme: (["aurora", "mint", "slate"] as ThemeName[]).includes(p.theme) ? p.theme : "aurora",
        animations: typeof p.animations === "boolean" ? p.animations : true,
        mode: (["light", "dark", "system"] as ColorMode[]).includes(p.mode) ? p.mode : "system",
      };
    }
  } catch {}
  return { theme: "aurora", animations: true, mode: "system" };
}

function resolveDark(mode: ColorMode): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function applyToDom(theme: ThemeName, animations: boolean, mode: ColorMode) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.setAttribute("data-anim", animations ? "on" : "off");
  document.documentElement.classList.toggle("dark", resolveDark(mode));
  const conn = (navigator as any).connection;
  const lowEnd = conn?.saveData || ["slow-2g", "2g", "3g"].includes(conn?.effectiveType ?? "");
  document.documentElement.setAttribute("data-perf", lowEnd ? "low" : "auto");
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [{ theme, animations, mode }, setState] = useState(readInitial);

  useEffect(() => {
    applyToDom(theme, animations, mode);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ theme, animations, mode }));
    } catch {}
  }, [theme, animations, mode]);

  // React to system theme changes when in system mode
  useEffect(() => {
    if (mode !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyToDom(theme, animations, mode);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [mode, theme, animations]);

  if (typeof document !== "undefined") {
    const cur = document.documentElement.getAttribute("data-theme");
    if (cur !== theme) applyToDom(theme, animations, mode);
  }

  return (
    <Ctx.Provider
      value={{
        theme,
        animations,
        mode,
        setTheme: (t) => setState((s) => ({ ...s, theme: t })),
        setAnimations: (v) => setState((s) => ({ ...s, animations: v })),
        setMode: (m) => setState((s) => ({ ...s, mode: m })),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function usePreferences() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePreferences must be used inside PreferencesProvider");
  return v;
}
