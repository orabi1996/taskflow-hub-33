import React from "react";
import { Sparkles, Check, Cpu, Waves, Activity, Zap } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  TECH_ATMOSPHERE_PRESETS,
  type TechAtmosphereId,
  type TechAtmospherePreset,
} from "./ModernTechBackground";

const STORAGE_KEY = "crmx_tech_atmosphere_mode";

interface TechAtmosphereSwitcherProps {
  currentMode: TechAtmosphereId;
  onModeChange: (mode: TechAtmosphereId) => void;
  className?: string;
}

const MODE_ICONS: Record<TechAtmosphereId, React.ComponentType<{ className?: string }>> = {
  aurora: Sparkles,
  neural: Cpu,
  silk: Waves,
  amber: Zap,
};

export function TechAtmosphereSwitcher({
  currentMode,
  onModeChange,
  className = "",
}: TechAtmosphereSwitcherProps) {
  const [open, setOpen] = React.useState(false);

  const activePreset =
    TECH_ATMOSPHERE_PRESETS.find((p) => p.id === currentMode) ||
    TECH_ATMOSPHERE_PRESETS[0];

  const Icon = MODE_ICONS[activePreset.id] || Sparkles;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-9 gap-2 px-3 rounded-2xl border-white/20 bg-background/70 hover:bg-background/90 backdrop-blur-xl shadow-sm text-xs font-medium transition-all ${className}`}
          title="تغيير المظهر التفاعلي للخلفية"
        >
          <span
            className="w-2.5 h-2.5 rounded-full animate-pulse shrink-0"
            style={{
              backgroundColor: activePreset.accentGlow,
              boxShadow: `0 0 10px ${activePreset.accentGlow}`,
            }}
          />
          <span className="hidden sm:inline text-muted-foreground">الخلفية:</span>
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
            {activePreset.label}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-80 p-3 bg-card/95 backdrop-blur-2xl border border-border/80 shadow-2xl rounded-2xl animate-in fade-in-50 zoom-in-95 font-ui"
      >
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
          <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span>أنماط الإضاءة والحركة التفاعلية</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
            WebGL & Canvas
          </span>
        </div>

        <div className="space-y-1.5">
          {TECH_ATMOSPHERE_PRESETS.map((preset) => {
            const isSelected = currentMode === preset.id;
            const PresetIcon = MODE_ICONS[preset.id] || Sparkles;

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  onModeChange(preset.id);
                  setOpen(false);
                }}
                className={`w-full group flex items-center gap-3 p-2.5 rounded-xl text-start transition-all ${
                  isSelected
                    ? "bg-primary/15 ring-1 ring-primary/40 shadow-xs"
                    : "hover:bg-muted/60"
                }`}
              >
                {/* Luminous Glow Avatar */}
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-white/20 transition-transform group-hover:scale-105"
                  style={{
                    background: `linear-gradient(135deg, ${preset.primaryGlow}, ${preset.accentGlow})`,
                    boxShadow: isSelected ? `0 0 16px ${preset.accentGlow}66` : undefined,
                  }}
                >
                  <PresetIcon className="w-4 h-4 text-white" />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-xs text-foreground truncate">
                      {preset.label}
                    </span>
                    <span className="text-[9.5px] px-1.5 py-0.2 rounded-md bg-muted text-muted-foreground font-medium">
                      {preset.badge}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground line-clamp-1 mt-0.5">
                    {preset.subtitle}
                  </p>
                </div>

                {isSelected && (
                  <span className="flex items-center justify-center h-4 w-4 rounded-full bg-primary text-primary-foreground shrink-0">
                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>يتم الحفظ تلقائياً في المتصفح</span>
          <span className="text-primary font-medium">CRM-X Modern Engine</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function useTechAtmosphere() {
  const [mode, setMode] = React.useState<TechAtmosphereId>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY) as TechAtmosphereId | null;
      if (saved && TECH_ATMOSPHERE_PRESETS.some((p) => p.id === saved)) {
        return saved;
      }
    }
    return "aurora";
  });

  const changeMode = React.useCallback((next: TechAtmosphereId) => {
    setMode(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  return { mode, setMode: changeMode };
}
