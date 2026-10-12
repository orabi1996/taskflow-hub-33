// ════════════════════════════════════════════════════════════════════════════
//  LiveGateway — Configuration Constants
//  Tweak these to adjust the look, feel, and performance of the living world.
// ════════════════════════════════════════════════════════════════════════════

export type QualityTier = "HIGH" | "MEDIUM" | "LOW" | "STATIC";

export interface QualitySettings {
  /** Resolution scale relative to CSS pixels (1.0 = native DPR, capped at maxDPR) */
  resScale: number;
  /** Number of firefly motes on desktop */
  moteCount: number;
  /** Number of parallax skyline SVG layers */
  skylineLayers: number;
  /** Enable subtle 3D card tilt on fine-pointer devices */
  enableTilt: boolean;
  /** Enable the interactive mouse cursor glow in the WebGL canvas */
  enableCursorGlow: boolean;
  /** Enable particle constellation lines */
  enableConstellation: boolean;
}

export const QUALITY_SETTINGS: Record<QualityTier, QualitySettings> = {
  HIGH: {
    resScale: 1.0,
    moteCount: 120,
    skylineLayers: 3,
    enableTilt: true,
    enableCursorGlow: true,
    enableConstellation: true,
  },
  MEDIUM: {
    resScale: 0.75,
    moteCount: 80,
    skylineLayers: 2,
    enableTilt: true,
    enableCursorGlow: true,
    enableConstellation: false,
  },
  LOW: {
    resScale: 0.5,
    moteCount: 40,
    skylineLayers: 2,
    enableTilt: false,
    enableCursorGlow: false,
    enableConstellation: false,
  },
  STATIC: {
    resScale: 0.25,
    moteCount: 0,
    skylineLayers: 1,
    enableTilt: false,
    enableCursorGlow: false,
    enableConstellation: false,
  },
};

// ── Performance FPS Thresholds ───────────────────────────────────────────────
export const FPS_THRESHOLDS = {
  /** FPS below which HIGH downgrades to MEDIUM */
  downToMedium: 50,
  /** FPS below which MEDIUM downgrades to LOW */
  downToLow: 40,
  /** FPS below which LOW downgrades to STATIC */
  downToStatic: 30,
  /** Number of frames to measure before making a quality decision */
  probeFrames: 90,
} as const;

// ── Timing ───────────────────────────────────────────────────────────────────
export const TIMINGS = {
  /** Total entrance animation in milliseconds */
  entranceMs: 1600,
  /**
   * Success navigation delay in ms.
   * The redirect is held this long so the success animation can play.
   * Only applied when scene === "live" and prefers-reduced-motion is off.
   */
  successNavigationDelayMs: 900,
  /** Fallback redirect delay (ms) — must be > successNavigationDelayMs */
  fallbackRedirectDelayMs: 1600,
} as const;

// ── Interaction Energy ────────────────────────────────────────────────────────
export const ENERGY = {
  /** Energy added per keystroke (0–1 scale) */
  perKeystroke: 0.2,
  /** Multiplicative decay per rAF frame */
  decayPerFrame: 0.965,
  /** Maximum energy level */
  max: 1.0,
} as const;

// ── Mote (Firefly Particle) Physics ──────────────────────────────────────────
export const MOTES = {
  baseSpeed: 0.45,           // px/frame baseline velocity
  flockStrength: 0.007,      // pull toward centroid
  cursorAttractDist: 220,    // px — within this range motes are attracted
  cursorAttractForce: 0.011, // force magnitude for attract
  cursorScatterDist: 80,     // px — within this range they scatter
  cursorScatterForce: 3.0,   // impulse magnitude for scatter
  minSize: 1.8,
  maxSize: 4.2,
  glowMultiplier: 5.0,       // glow radius as multiple of core size
  minAlpha: 0.25,
  maxAlpha: 0.90,
  pulseSpeedMin: 0.022,
  pulseSpeedMax: 0.055,
} as const;

// ── Arabesque Geometry ────────────────────────────────────────────────────────
export const ARABESQUE = {
  /** Base outer radius in px; scales to 38% of min(vw, vh) */
  radiusFraction: 0.38,
  /** Slow clockwise rotation — radians per second */
  rotateSpeedRad: 0.028,
  /** Pulse phase advance per second */
  pulseSpeed: 0.55,
  lineWidth: 1.15,
  /** Number of symmetry arms */
  starPoints: 8,
  /** Ratio of inner/outer radius for star vertices */
  innerRatio: 0.38,
  /** Opacity of the outer ring */
  outerRingOpacity: 0.18,
  /** Pulse brightness multiplier at peak */
  pulseAmplitude: 0.35,
} as const;

// ── Comet / Shooting Star ─────────────────────────────────────────────────────
export const COMETS = {
  minIntervalMs: 7000,
  maxIntervalMs: 13000,
  lengthPx: 190,
  speedPxPerFrame: 20,
  thickness: 2.2,
} as const;

// ── Card Tilt ─────────────────────────────────────────────────────────────────
export const TILT = {
  /** Maximum tilt in degrees */
  maxDeg: 4,
  /** Spring-damp lerp factor per frame */
  lerpFactor: 0.08,
  /** Scale-up on tilt */
  hoverScale: 1.006,
} as const;

// ── General ───────────────────────────────────────────────────────────────────
export const MAX_DPR = 2;

export const LIVE_WORLD_CONFIG = {
  MAX_DPR,
  QUALITY_SETTINGS,
  FPS_THRESHOLDS,
  TIMINGS,
  ENERGY,
  MOTES,
  ARABESQUE,
  COMETS,
  TILT,
} as const;

export default LIVE_WORLD_CONFIG;
