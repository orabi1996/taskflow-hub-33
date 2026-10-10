import React from "react";
import {
  Sun,
  Moon,
  Sunset,
  Compass,
  Palmtree,
  Sparkles,
  Check,
  ImageIcon,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

import skylineDay from "@/assets/hero/skyline-day.jpg";
import skylineNight from "@/assets/hero/skyline-night.jpg";
import skylineSunset1 from "@/assets/hero/skyline-sunset-1.jpg";
import skylineSunset2 from "@/assets/hero/skyline-sunset-2.jpg";
import skylineSunset3 from "@/assets/hero/skyline-sunset-3.jpg";

export type SkylineSceneId = "auto" | "day" | "night" | "sunset-1" | "sunset-2" | "sunset-3";

export interface SkylineSceneItem {
  id: Exclude<SkylineSceneId, "auto">;
  label: string;
  badge: string;
  subtitle: string;
  src: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const SKYLINE_SCENES: SkylineSceneItem[] = [
  {
    id: "day",
    label: "نهار العواصم",
    badge: "مشرق",
    subtitle: "بانوراما نهارية لمعالم الشرق الأوسط المتألقة",
    src: skylineDay,
    icon: Sun,
  },
  {
    id: "night",
    label: "ليل الأضواء",
    badge: "متلألئ",
    subtitle: "أضواء ساحرة لأبراج دبي والخليج مع قلاع مسقط",
    src: skylineNight,
    icon: Moon,
  },
  {
    id: "sunset-1",
    label: "الغروب الذهبي",
    badge: "أصيل",
    subtitle: "شفق ذهبي دافئ يعانق الأهرامات وناطحات السحاب",
    src: skylineSunset1,
    icon: Sunset,
  },
  {
    id: "sunset-2",
    label: "أصيل الأشرعة",
    badge: "تراثي",
    subtitle: "مركب شراعي أصيل في قلب الواجهة البحرية",
    src: skylineSunset2,
    icon: Compass,
  },
  {
    id: "sunset-3",
    label: "شاطئ النخيل",
    badge: "طبيعي",
    subtitle: "بانوراما واسعة تجمع القلاع والبحر وأشجار النخيل",
    src: skylineSunset3,
    icon: Palmtree,
  },
];

const STORAGE_KEY = "crmx_auth_wallpaper_scene";

export function resolveSkylineImage(sceneId: SkylineSceneId, isDarkTheme: boolean): string {
  if (sceneId === "auto") {
    return isDarkTheme ? skylineNight : skylineDay;
  }
  const found = SKYLINE_SCENES.find((s) => s.id === sceneId);
  return found ? found.src : skylineDay;
}

interface AuthSkylineSwitcherProps {
  currentScene: SkylineSceneId;
  onSceneChange: (scene: SkylineSceneId) => void;
  className?: string;
}

export function AuthSkylineSwitcher({
  currentScene,
  onSceneChange,
  className = "",
}: AuthSkylineSwitcherProps) {
  const [open, setOpen] = React.useState(false);

  const activeLabel =
    currentScene === "auto"
      ? "تلقائي"
      : SKYLINE_SCENES.find((s) => s.id === currentScene)?.label || "المشهد";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-9 gap-1.5 px-3 rounded-xl border-white/20 bg-background/80 hover:bg-background/95 backdrop-blur-md shadow-sm text-xs font-medium transition-all ${className}`}
          title="تغيير مشهد خلفية الواجهة"
        >
          <ImageIcon className="h-3.5 w-3.5 text-primary" />
          <span className="hidden sm:inline text-muted-foreground">المشهد:</span>
          <span className="font-semibold text-foreground">{activeLabel}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-84 sm:w-96 p-3 bg-card/95 backdrop-blur-2xl border border-border/80 shadow-2xl rounded-2xl animate-in fade-in-50 zoom-in-95"
      >
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-border/60">
          <div>
            <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>معرض مشاهد الشرق الأوسط</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              اختر المشهد البانورامي المفضل لديك لخلفية الدخول
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              onSceneChange("auto");
              setOpen(false);
            }}
            className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-all ${
              currentScene === "auto"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/70 hover:bg-muted text-muted-foreground"
            }`}
          >
            تلقائي ⚡
          </button>
        </div>

        <div className="space-y-1.5">
          {SKYLINE_SCENES.map((scene) => {
            const isSelected = currentScene === scene.id;
            const IconComp = scene.icon;

            return (
              <button
                key={scene.id}
                type="button"
                onClick={() => {
                  onSceneChange(scene.id);
                  setOpen(false);
                }}
                className={`w-full group flex items-center gap-3 p-2 rounded-xl text-start transition-all ${
                  isSelected
                    ? "bg-primary/10 ring-1 ring-primary/40 shadow-sm"
                    : "hover:bg-muted/60"
                }`}
              >
                {/* Thumbnail Preview */}
                <div className="relative shrink-0 w-16 h-11 rounded-lg overflow-hidden ring-1 ring-border shadow-xs">
                  <img
                    src={scene.src}
                    alt={scene.label}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  <span className="absolute bottom-0.5 end-1 text-[8px] font-bold text-white uppercase drop-shadow-xs">
                    {scene.badge}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-xs text-foreground flex items-center gap-1.5 truncate">
                      <IconComp className="h-3 w-3 text-primary shrink-0" />
                      {scene.label}
                    </span>
                    {isSelected && (
                      <span className="flex items-center justify-center h-4 w-4 rounded-full bg-primary text-primary-foreground shrink-0">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                    {scene.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>يتم حفظ اختيارك تلقائياً في متصفحك</span>
          <span className="text-primary font-medium">CRM-X Skylines</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function useAuthWallpaper() {
  const [scene, setScene] = React.useState<SkylineSceneId>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY) as SkylineSceneId | null;
      if (saved && (saved === "auto" || SKYLINE_SCENES.some((s) => s.id === saved))) {
        return saved;
      }
    }
    return "auto";
  });

  const changeScene = React.useCallback((next: SkylineSceneId) => {
    setScene(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  return { scene, setScene: changeScene };
}
