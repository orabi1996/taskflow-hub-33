import { useEffect, useState, useRef, type RefObject } from "react";
import gsap from "gsap";
import { GSAP_EASINGS } from "./tokens";

/**
 * Hook to detect whether user prefers reduced motion
 * Checks both system media query and app data-anim attribute
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const checkMotion = () => {
      const appAttr = document.documentElement.getAttribute("data-anim");
      setReduced(mediaQuery.matches || appAttr === "off");
    };

    checkMotion();
    mediaQuery.addEventListener("change", checkMotion);

    // Watch for changes on <html data-anim="...">
    const observer = new MutationObserver(checkMotion);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-anim"] });

    return () => {
      mediaQuery.removeEventListener("change", checkMotion);
      observer.disconnect();
    };
  }, []);

  return reduced;
}

/**
 * Animated number counter using high-performance RAF easing math
 */
export function useCounterAnimation(
  targetValue: number,
  options?: {
    durationMs?: number;
    delayMs?: number;
    decimals?: number;
  }
): number {
  const [displayValue, setDisplayValue] = useState(0);
  const isReduced = useReducedMotion();
  const duration = options?.durationMs ?? 900;
  const delay = options?.delayMs ?? 0;
  const decimals = options?.decimals ?? 0;

  useEffect(() => {
    if (isReduced) {
      setDisplayValue(targetValue);
      return;
    }

    let startTimestamp: number | null = null;
    let animId: number;
    const startVal = displayValue;
    const diff = targetValue - startVal;

    const timeoutId = setTimeout(() => {
      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);

        // Quintic ease-out curve
        const ease = 1 - Math.pow(1 - progress, 4);
        const current = startVal + diff * ease;

        const factor = Math.pow(10, decimals);
        setDisplayValue(Math.round(current * factor) / factor);

        if (progress < 1) {
          animId = requestAnimationFrame(step);
        } else {
          setDisplayValue(targetValue);
        }
      };

      animId = requestAnimationFrame(step);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      if (animId) cancelAnimationFrame(animId);
    };
  }, [targetValue, duration, delay, decimals, isReduced]);

  return displayValue;
}

/**
 * Magnetic button / element hover hook for desktop fine-pointer devices
 */
export function useMagneticHover<T extends HTMLElement = HTMLElement>(
  strength = 0.28
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const isReduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || isReduced || typeof window === "undefined") return;

    // Only apply on devices with a mouse/trackpad pointer
    if (!window.matchMedia("(pointer: fine)").matches) return;

    let mouseX = 0;
    let mouseY = 0;
    let currentX = 0;
    let currentY = 0;
    let animId: number;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      mouseX = (e.clientX - centerX) * strength;
      mouseY = (e.clientY - centerY) * strength;
    };

    const handleMouseLeave = () => {
      mouseX = 0;
      mouseY = 0;
    };

    const render = () => {
      // Damped spring physics
      currentX += (mouseX - currentX) * 0.15;
      currentY += (mouseY - currentY) * 0.15;

      el.style.transform = `translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0)`;

      if (Math.abs(mouseX - currentX) > 0.05 || Math.abs(mouseY - currentY) > 0.05) {
        animId = requestAnimationFrame(render);
      }
    };

    const startAnim = (e: MouseEvent) => {
      handleMouseMove(e);
      cancelAnimationFrame(animId);
      animId = requestAnimationFrame(render);
    };

    const stopAnim = () => {
      handleMouseLeave();
      cancelAnimationFrame(animId);
      animId = requestAnimationFrame(render);
    };

    el.addEventListener("mousemove", startAnim);
    el.addEventListener("mouseleave", stopAnim);

    return () => {
      el.removeEventListener("mousemove", startAnim);
      el.removeEventListener("mouseleave", stopAnim);
      cancelAnimationFrame(animId);
      if (el) el.style.transform = "";
    };
  }, [strength, isReduced]);

  return ref;
}

/**
 * Word-level Arabic text reveal using GSAP timeline
 * Crucial: Splits by WORDS, NEVER by characters, to prevent breaking Arabic ligatures!
 */
export function useArabicWordReveal(
  containerRef: RefObject<HTMLElement | null>,
  options?: {
    stagger?: number;
    delay?: number;
    duration?: number;
  }
) {
  const isReduced = useReducedMotion();

  useEffect(() => {
    const el = containerRef.current;
    if (!el || isReduced) return;

    const words = el.querySelectorAll<HTMLElement>("[data-reveal-word]");
    if (words.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        words,
        {
          opacity: 0,
          y: 20,
          clipPath: "polygon(0 100%, 100% 100%, 100% 100%, 0 100%)",
        },
        {
          opacity: 1,
          y: 0,
          clipPath: "polygon(0 0%, 100% 0%, 100% 100%, 0 100%)",
          duration: options?.duration ?? 0.65,
          stagger: options?.stagger ?? 0.08,
          delay: options?.delay ?? 0.1,
          ease: GSAP_EASINGS.cinematic,
        }
      );
    }, el);

    return () => ctx.revert();
  }, [containerRef, options?.stagger, options?.delay, options?.duration, isReduced]);
}
