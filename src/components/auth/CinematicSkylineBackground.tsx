import React from "react";
import { ModernTechBackground, type TechAtmosphereId } from "./ModernTechBackground";
import { type SkylineSceneId } from "./AuthSkylineSwitcher";

interface CinematicSkylineBackgroundProps {
  scene?: SkylineSceneId;
  isDarkTheme?: boolean;
}

/**
 * Modern Living Background Adapter
 * Replaces static landscape photography with high-performance fluid aurora & interactive tech canvas
 */
export function CinematicSkylineBackground({
  scene,
  isDarkTheme = true,
}: CinematicSkylineBackgroundProps) {
  // Map legacy scene IDs if any were passed
  let mappedMode: TechAtmosphereId = "aurora";
  if (scene === "night") mappedMode = "neural";
  else if (scene === "sunset-2") mappedMode = "silk";
  else if (scene === "sunset-1" || scene === "sunset-3") mappedMode = "amber";

  return <ModernTechBackground mode={mappedMode} isDarkTheme={isDarkTheme} />;
}
