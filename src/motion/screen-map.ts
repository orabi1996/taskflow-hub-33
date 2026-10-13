import { MOTION_LEVELS, type MotionLevel } from "./tokens";

/**
 * Enterprise Screen Motion Classification (STEP 2)
 *
 * LEVEL 0: Static / Reports / Print / Heavy tables
 * LEVEL 1: Functional / Forms / Settings / Employee management
 * LEVEL 2: Interactive / Dashboard / Requests / Notifications
 * LEVEL 3: Cinematic / Login / Welcome / Onboarding
 */
export const SCREEN_MOTION_MAP: Record<string, MotionLevel> = {
  // Level 3 — Cinematic
  "/auth": MOTION_LEVELS.LEVEL_3_CINEMATIC,
  "/reset-password": MOTION_LEVELS.LEVEL_3_CINEMATIC,

  // Level 2 — Interactive
  "/dashboard": MOTION_LEVELS.LEVEL_2_INTERACTIVE,
  "/analytics": MOTION_LEVELS.LEVEL_2_INTERACTIVE,
  "/tickets": MOTION_LEVELS.LEVEL_2_INTERACTIVE,
  "/clients": MOTION_LEVELS.LEVEL_2_INTERACTIVE,
  "/team": MOTION_LEVELS.LEVEL_2_INTERACTIVE,
  "/my-projects": MOTION_LEVELS.LEVEL_2_INTERACTIVE,
  "/portal": MOTION_LEVELS.LEVEL_2_INTERACTIVE,
  "/performance": MOTION_LEVELS.LEVEL_2_INTERACTIVE,
  "/projects": MOTION_LEVELS.LEVEL_2_INTERACTIVE,

  // Level 1 — Functional
  "/settings": MOTION_LEVELS.LEVEL_1_FUNCTIONAL,
  "/admin": MOTION_LEVELS.LEVEL_1_FUNCTIONAL,
  "/time": MOTION_LEVELS.LEVEL_1_FUNCTIONAL,
  "/billing": MOTION_LEVELS.LEVEL_1_FUNCTIONAL,
  "/profile": MOTION_LEVELS.LEVEL_1_FUNCTIONAL,

  // Level 0 — Static / Heavy Reports / Audit
  "/reports": MOTION_LEVELS.LEVEL_0_STATIC,
  "/admin/audit": MOTION_LEVELS.LEVEL_0_STATIC,
  "/settings/audit": MOTION_LEVELS.LEVEL_0_STATIC,
  "/settings/access-review": MOTION_LEVELS.LEVEL_0_STATIC,
};

/**
 * Resolves the motion level for a given pathname.
 * Defaults to LEVEL_1_FUNCTIONAL if not explicitly matched.
 */
export function getRouteMotionLevel(pathname: string): MotionLevel {
  if (!pathname) return MOTION_LEVELS.LEVEL_1_FUNCTIONAL;

  // Exact match
  if (SCREEN_MOTION_MAP[pathname] !== undefined) {
    return SCREEN_MOTION_MAP[pathname];
  }

  // Prefix match (longest matching route prefix)
  const matchingKey = Object.keys(SCREEN_MOTION_MAP)
    .filter((route) => pathname.startsWith(route))
    .sort((a, b) => b.length - a.length)[0];

  if (matchingKey) {
    return SCREEN_MOTION_MAP[matchingKey];
  }

  return MOTION_LEVELS.LEVEL_1_FUNCTIONAL;
}
