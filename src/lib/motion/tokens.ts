// ════════════════════════════════════════════════════════════════════════════
//  CRM-X Motion Tokens & Architecture
//  Unified timing, easings, and GSAP curve tokens
// ════════════════════════════════════════════════════

export const MOTION_DURATIONS = {
  instant: 0.1,    // 100ms: Checkboxes, toggle switches
  fast: 0.2,       // 200ms: Level 1 Micro-interactions, button hover
  normal: 0.35,    // 350ms: Level 2 Component transitions, dropdowns, tabs
  deliberate: 0.55,// 550ms: Level 3 Section entrances, modals
  cinematic: 1.2,  // 1200ms: Level 4 Cinematic hero & login gateway
} as const;

export const MOTION_EASINGS = {
  standard: "cubic-bezier(0.2, 0.0, 0.0, 1.0)",
  enter: "cubic-bezier(0.0, 0.0, 0.2, 1.0)",
  exit: "cubic-bezier(0.4, 0.0, 1.0, 1.0)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1.0)",
  cinematic: "cubic-bezier(0.16, 1.0, 0.3, 1.0)",
} as const;

/** GSAP equivalent easings */
export const GSAP_EASINGS = {
  standard: "power2.out",
  enter: "power3.out",
  exit: "power2.in",
  spring: "back.out(1.5)",
  cinematic: "expo.out",
  smooth: "sine.inOut",
} as const;
