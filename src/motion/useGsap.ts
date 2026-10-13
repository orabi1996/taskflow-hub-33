import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { gsap } from "./gsap";
import { prefersReducedMotion, hasHoverCapability, checkIsRtl } from "./tokens";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Memory-safe GSAP effect hook.
 * Uses gsap.context() to automatically revert/clean up all tweens & timelines on unmount.
 */
export function useGsapEffect(
  effect: (context: gsap.Context) => void | (() => void),
  deps: any[] = [],
  scope?: RefObject<HTMLElement | null>
) {
  useIsomorphicLayoutEffect(() => {
    const ctx = gsap.context((self) => {
      effect(self);
    }, scope?.current || undefined);

    return () => {
      ctx.revert(); // clean up all GSAP tweens created in context
    };
  }, deps);
}

/**
 * Reactive hook for prefers-reduced-motion.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => prefersReducedMotion());

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");

    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return reduced;
}

/**
 * Reactive hook for fine pointer and hover capability (desktop vs touch).
 */
export function usePointerCapability(): boolean {
  const [hasHover, setHasHover] = useState(() => hasHoverCapability());

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(hover: hover) and (pointer: fine)");

    const handler = (e: MediaQueryListEvent) => setHasHover(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return hasHover;
}

/**
 * Reactive hook for document layout direction (RTL vs LTR).
 */
export function useDirection(): "rtl" | "ltr" {
  const [direction, setDirection] = useState<"rtl" | "ltr">(() =>
    checkIsRtl() ? "rtl" : "ltr"
  );

  useEffect(() => {
    if (typeof document === "undefined") return;

    const observer = new MutationObserver(() => {
      setDirection(checkIsRtl() ? "rtl" : "ltr");
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["dir"],
    });

    return () => observer.disconnect();
  }, []);

  return direction;
}
