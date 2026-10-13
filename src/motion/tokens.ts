/**
 * CRM-X Motion & Animation Design Tokens
 * 
 * Standards:
 * - Enterprise, calm, purposeful motion (not gaming/bouncy)
 * - Strict reduced-motion support
 * - RTL-aware directional translations
 * - Level 0 to Level 3 intensity segmentation
 */

export const MOTION_DURATIONS = {
  instant: 0.12,   // 120ms - micro-feedback, state toggles
  fast: 0.18,      // 180ms - buttons, tooltips, list hovers
  normal: 0.3,     // 300ms - dialogs, cards, dropdowns
  slow: 0.5,       // 500ms - page entrance, panel reveals
  cinematic: 0.9,  // 900ms - hero/welcome sequences only
} as const;

export type MotionDurationKey = keyof typeof MOTION_DURATIONS;

export const MOTION_EASINGS = {
  // Material 3 & Apple standard curve: fast acceleration, gentle deceleration
  standard: "cubic-bezier(0.2, 0.0, 0.0, 1.0)",
  enter: "cubic-bezier(0.0, 0.0, 0.2, 1.0)",
  exit: "cubic-bezier(0.4, 0.0, 1.0, 1.0)",
  spring: "cubic-bezier(0.34, 1.4, 0.64, 1.0)",
  softSpring: "cubic-bezier(0.25, 1.15, 0.5, 1.0)",
  cinematic: "cubic-bezier(0.16, 1.0, 0.3, 1.0)",
} as const;

export const GSAP_EASES = {
  standard: "power3.out",
  enter: "power2.out",
  exit: "power2.in",
  spring: "back.out(1.4)",
  softSpring: "back.out(1.1)",
  cinematic: "expo.out",
  linear: "none",
} as const;

/**
 * Motion Intensity Levels (STEP 27)
 * Ensures operational interfaces remain fast while narrative screens can breathe.
 */
export const MOTION_LEVELS = {
  LEVEL_0_STATIC: 0,      // Reports, printing, large data tables (No motion)
  LEVEL_1_FUNCTIONAL: 1,  // Forms, settings, tables, dialogs (Micro-interactions only)
  LEVEL_2_INTERACTIVE: 2, // Dashboard, metrics, sidebar, tabs (Fluid transitions)
  LEVEL_3_CINEMATIC: 3,   // Login, welcome, auth hero (Rich ambient motion)
} as const;

export type MotionLevel = typeof MOTION_LEVELS[keyof typeof MOTION_LEVELS];

/**
 * Directional animation helper (STEP 22: RTL Motion Direction)
 * Automatically inverts horizontal translate vectors when document is in RTL mode.
 */
export function getRtlVector(x: number, isRtl: boolean = true): number {
  return isRtl ? -x : x;
}

/**
 * Checks if current document is RTL.
 */
export function checkIsRtl(): boolean {
  if (typeof document === "undefined") return true;
  return document.documentElement.dir === "rtl" || document.dir === "rtl";
}

/**
 * Checks if user prefers reduced motion (STEP 23).
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Checks if device supports fine pointer and hover (STEP 24).
 */
export function hasHoverCapability(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}
