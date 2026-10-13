import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { useEffect, useLayoutEffect, useRef } from "react";
import { prefersReducedMotion } from "./tokens";

if (typeof window !== "undefined") {
  gsap.registerPlugin(Flip);
}

export { Flip };

export interface FlipOptions {
  duration?: number;
  ease?: string;
  absolute?: boolean;
  nested?: boolean;
  prune?: boolean;
  fade?: boolean;
  simple?: boolean;
  onComplete?: () => void;
}

/**
 * Execute a state change inside a GSAP Flip transition.
 * Automatically bypassed when prefers-reduced-motion is active.
 */
export function flipTransition(
  targets: gsap.DOMTarget,
  mutate: () => void,
  options: FlipOptions = {}
): gsap.core.Tween | null {
  if (prefersReducedMotion()) {
    mutate();
    options.onComplete?.();
    return null;
  }

  const state = Flip.getState(targets, {
    props: "opacity,transform",
  });

  mutate();

  return Flip.from(state, {
    duration: options.duration ?? 0.3,
    ease: options.ease ?? "power2.out",
    absolute: options.absolute ?? false,
    nested: options.nested ?? false,
    prune: options.prune ?? true,
    fade: options.fade ?? false,
    simple: options.simple ?? true,
    clearProps: "transform",
    onComplete: options.onComplete,
  }) as unknown as gsap.core.Tween;
}

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * React hook to animate layout changes of children or targets using GSAP Flip.
 */
export function useFlipLayout(
  targetsSelector: string,
  deps: any[],
  containerRef?: React.RefObject<HTMLElement | null>,
  options: FlipOptions = {}
) {
  const previousStateRef = useRef<any>(null);

  useIsomorphicLayoutEffect(() => {
    if (prefersReducedMotion()) return;

    const root = containerRef?.current || document;
    const elements = root.querySelectorAll(targetsSelector);
    if (!elements.length) return;

    if (previousStateRef.current) {
      Flip.from(previousStateRef.current, {
        duration: options.duration ?? 0.28,
        ease: options.ease ?? "power2.out",
        absolute: options.absolute ?? false,
        prune: true,
        clearProps: "transform",
        onComplete: options.onComplete,
      });
    }

    // Capture state for next change
    previousStateRef.current = Flip.getState(elements);
  }, deps);
}
