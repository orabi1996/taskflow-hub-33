import React from "react";
import { Sparkles, Check } from "lucide-react";
import {
  ATMOSPHERE_PRESETS,
  type AtmosphereMode,
  type AtmosphereTheme,
} from "./Masterpiece3DBackground";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface AtmosphereSelectorProps {
  currentMode: AtmosphereMode;
  onModeChange: (mode: AtmosphereMode) => void;
}

export function AtmosphereSelector({ currentMode, onModeChange }: AtmosphereSelectorProps) {
  const activePreset =
    ATMOSPHERE_PRESETS.find((p) => p.id === currentMode) || ATMOSPHERE_PRESETS[0];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-3 rounded-xl border border-white/15 bg-background/60 backdrop-blur-xl hover:bg-background/80 shadow-sm transition-all duration-300 gap-2 font-ui text-xs"
        >
          <span
            className="w-2.5 h-2.5 rounded-full animate-pulse shadow-xs shrink-0"
            style={{ backgroundColor: activePreset.glowColor }}
          />
          <span className="hidden sm:inline font-medium text-foreground">
            {activePreset.name}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
            {activePreset.badge}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 p-2 rounded-2xl border border-white/20 bg-background/90 backdrop-blur-2xl shadow-xl space-y-1 font-ui"
      >
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>المظهر الفضائي ثلاثي الأبعاد</span>
        </div>
        {ATMOSPHERE_PRESETS.map((preset) => {
          const isSelected = preset.id === currentMode;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onModeChange(preset.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all duration-200 text-start ${
                isSelected
                  ? "bg-primary/15 text-primary font-semibold border border-primary/30"
                  : "hover:bg-muted/60 text-foreground"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="w-3 h-3 rounded-full shrink-0 border border-white/30"
                  style={{
                    background: `linear-gradient(135deg, ${preset.primaryColor}, ${preset.glowColor})`,
                  }}
                />
                <span>{preset.name}</span>
              </div>
              {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
