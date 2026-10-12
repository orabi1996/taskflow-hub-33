import React, { useRef, useMemo } from "react";
import { useCounterAnimation, useMagneticHover, useArabicWordReveal, useReducedMotion } from "./hooks";
import { cn } from "@/lib/utils";

/**
 * ArabicTextReveal
 * Renders an Arabic headline with word-level masking.
 * Guaranteed NOT to break cursive ligatures while providing cinematic stagger.
 */
interface ArabicTextRevealProps {
  text: string;
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span";
  className?: string;
  delay?: number;
  stagger?: number;
}

export function ArabicTextReveal({
  text,
  as: Component = "h1",
  className,
  delay = 0.1,
  stagger = 0.07,
}: ArabicTextRevealProps) {
  const containerRef = useRef<HTMLElement>(null);
  const isReduced = useReducedMotion();

  // Split text into words safely
  const words = useMemo(() => text.trim().split(/\s+/), [text]);

  useArabicWordReveal(containerRef, { delay, stagger });

  if (isReduced) {
    return <Component className={className}>{text}</Component>;
  }

  return (
    // @ts-expect-error dynamic component ref
    <Component ref={containerRef} className={cn("inline-flex flex-wrap gap-x-[0.28em]", className)}>
      {words.map((word, index) => (
        <span
          key={index}
          className="inline-block overflow-hidden pb-1"
        >
          <span
            data-reveal-word
            className="inline-block will-change-transform"
          >
            {word}
          </span>
        </span>
      ))}
    </Component>
  );
}

/**
 * AnimatedCounter
 * Formatted numbers with smooth 60fps roll-up and optional Arabic locale digits.
 */
interface AnimatedCounterProps {
  value: number;
  formatFn?: (val: number) => string;
  className?: string;
  durationMs?: number;
  delayMs?: number;
}

export function AnimatedCounter({
  value,
  formatFn,
  className,
  durationMs = 900,
  delayMs = 0,
}: AnimatedCounterProps) {
  const animatedValue = useCounterAnimation(value, { durationMs, delayMs });

  const formatted = useMemo(() => {
    if (formatFn) return formatFn(animatedValue);
    return animatedValue.toLocaleString("ar-EG");
  }, [animatedValue, formatFn]);

  return <span className={cn("tabular-nums", className)}>{formatted}</span>;
}

/**
 * MagneticButton
 * Interactive tactile desktop button with spring physics
 */
interface MagneticProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  strength?: number;
}

export function Magnetic({ children, strength = 0.28, className, ...props }: MagneticProps) {
  const ref = useMagneticHover<HTMLDivElement>(strength);

  return (
    <div ref={ref} className={cn("inline-block", className)} {...props}>
      {children}
    </div>
  );
}
