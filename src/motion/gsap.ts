import { gsap } from "gsap";
import {
  MOTION_DURATIONS,
  GSAP_EASES,
  prefersReducedMotion,
  checkIsRtl,
  getRtlVector,
} from "./tokens";

// Performance & clean console settings
if (typeof window !== "undefined") {
  gsap.config({
    autoSleep: 60,
    nullTargetWarn: false,
  });
}

export { gsap };

export interface RevealOptions {
  duration?: number;
  delay?: number;
  ease?: string;
  y?: number;
  x?: number;
  scale?: number;
  blur?: number;
  onComplete?: () => void;
}

/**
 * Performant entrance transition adhering to reduced motion & RTL rules.
 */
export function animateEntrance(
  target: gsap.DOMTarget,
  options: RevealOptions = {}
): gsap.core.Tween | null {
  if (prefersReducedMotion()) {
    gsap.set(target, { opacity: 1, x: 0, y: 0, scale: 1, filter: "none" });
    options.onComplete?.();
    return null;
  }

  const isRtl = checkIsRtl();
  const initialX = options.x !== undefined ? getRtlVector(options.x, isRtl) : 0;
  const initialY = options.y !== undefined ? options.y : 12;
  const initialScale = options.scale !== undefined ? options.scale : 1;
  const initialBlur = options.blur ? `blur(${options.blur}px)` : "none";

  gsap.set(target, {
    opacity: 0,
    x: initialX,
    y: initialY,
    scale: initialScale,
    filter: initialBlur,
  });

  return gsap.to(target, {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    filter: "none",
    duration: options.duration ?? MOTION_DURATIONS.normal,
    delay: options.delay ?? 0,
    ease: options.ease ?? GSAP_EASES.standard,
    clearProps: "transform,filter",
    onComplete: options.onComplete,
  });
}

/**
 * Staggered child reveals for metric grids, list rows, and navigation items.
 */
export function animateStagger(
  targets: gsap.DOMTarget,
  staggerMs: number = 0.05,
  options: RevealOptions = {}
): gsap.core.Tween | null {
  if (prefersReducedMotion()) {
    gsap.set(targets, { opacity: 1, y: 0, scale: 1 });
    options.onComplete?.();
    return null;
  }

  gsap.set(targets, {
    opacity: 0,
    y: options.y ?? 10,
  });

  return gsap.to(targets, {
    opacity: 1,
    y: 0,
    duration: options.duration ?? MOTION_DURATIONS.fast,
    stagger: staggerMs,
    ease: options.ease ?? GSAP_EASES.enter,
    clearProps: "transform",
    onComplete: options.onComplete,
  });
}

/**
 * Animated number counter for dashboard KPI cards.
 */
export function animateCounter(
  element: HTMLElement | null,
  targetValue: number,
  options: {
    duration?: number;
    decimals?: number;
    prefix?: string;
    suffix?: string;
    formatter?: (val: number) => string;
  } = {}
): gsap.core.Tween | null {
  if (!element) return null;

  const decimals = options.decimals ?? 0;
  const duration = prefersReducedMotion()
    ? 0.01
    : options.duration ?? MOTION_DURATIONS.slow;

  const obj = { val: 0 };

  const format = (v: number) => {
    if (options.formatter) return options.formatter(v);
    const formatted = v.toLocaleString("ar-SA", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return `${options.prefix ?? ""}${formatted}${options.suffix ?? ""}`;
  };

  return gsap.to(obj, {
    val: targetValue,
    duration,
    ease: GSAP_EASES.cinematic,
    onUpdate: () => {
      element.textContent = format(obj.val);
    },
    onComplete: () => {
      element.textContent = format(targetValue);
    },
  });
}
