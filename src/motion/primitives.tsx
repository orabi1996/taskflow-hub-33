import React, { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { gsap, animateEntrance, animateCounter } from "./gsap";
import { useGsapEffect, useReducedMotion, usePointerCapability, useDirection } from "./useGsap";
import { MOTION_DURATIONS, GSAP_EASES, getRtlVector, MOTION_LEVELS, type MotionLevel } from "./tokens";

/* ============================================================
   1. PageEntrance — Global Subtle Page Entrance (STEP 8)
   Fast, operational-grade entrance: opacity 0->1, y: 10->0, blur 4->0
   Respects route motion level (LEVEL 0 = static, LEVEL 3 = cinematic)
   ============================================================ */
export interface PageEntranceProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  duration?: number;
  delay?: number;
  level?: MotionLevel;
}

export function PageEntrance({
  children,
  className = "",
  duration = MOTION_DURATIONS.normal,
  delay = 0,
  level = MOTION_LEVELS.LEVEL_2_INTERACTIVE,
  ...props
}: PageEntranceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isReduced = useReducedMotion();

  useGsapEffect(() => {
    if (!containerRef.current || isReduced || level === MOTION_LEVELS.LEVEL_0_STATIC) return;

    const animDuration = level === MOTION_LEVELS.LEVEL_3_CINEMATIC ? MOTION_DURATIONS.slow : duration;

    animateEntrance(containerRef.current, {
      duration: animDuration,
      delay,
      y: level === MOTION_LEVELS.LEVEL_1_FUNCTIONAL ? 6 : 10,
      blur: level === MOTION_LEVELS.LEVEL_1_FUNCTIONAL ? 0 : 4,
    });
  }, [duration, delay, isReduced, level]);

  return (
    <div
      ref={containerRef}
      className={`w-full will-change-[opacity,transform] ${className}`}
      data-page-entrance="true"
      {...props}
    >
      {children}
    </div>
  );
}

/* ============================================================
   2. FadeIn — Directional Component Reveal
   RTL-aware: 'start' translates towards right in RTL and left in LTR
   ============================================================ */
export interface FadeInProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  direction?: "up" | "down" | "start" | "end" | "none";
  distance?: number;
  duration?: number;
  delay?: number;
}

export function FadeIn({
  children,
  direction = "up",
  distance = 12,
  duration = MOTION_DURATIONS.fast,
  delay = 0,
  className = "",
  ...props
}: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isReduced = useReducedMotion();
  const dir = useDirection();

  useGsapEffect(() => {
    if (!ref.current || isReduced) return;

    let x = 0;
    let y = 0;

    if (direction === "up") y = distance;
    if (direction === "down") y = -distance;
    if (direction === "start") x = getRtlVector(-distance, dir === "rtl");
    if (direction === "end") x = getRtlVector(distance, dir === "rtl");

    animateEntrance(ref.current, {
      duration,
      delay,
      x,
      y,
      ease: GSAP_EASES.standard,
    });
  }, [direction, distance, duration, delay, isReduced, dir]);

  return (
    <div ref={ref} className={className} {...props}>
      {children}
    </div>
  );
}

/* ============================================================
   3. StaggerGroup — Group Reveal for Cards & List Items (STEP 7)
   ============================================================ */
export interface StaggerGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  selector?: string;
  stagger?: number;
  duration?: number;
  delay?: number;
}

export function StaggerGroup({
  children,
  selector = ":scope > *",
  stagger = 0.04,
  duration = MOTION_DURATIONS.fast,
  delay = 0.05,
  className = "",
  ...props
}: StaggerGroupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isReduced = useReducedMotion();

  useGsapEffect(() => {
    if (!containerRef.current || isReduced) return;

    const items = containerRef.current.querySelectorAll(selector);
    if (!items.length) return;

    gsap.set(items, { opacity: 0, y: 10 });
    gsap.to(items, {
      opacity: 1,
      y: 0,
      duration,
      delay,
      stagger,
      ease: GSAP_EASES.enter,
      clearProps: "transform",
    });
  }, [selector, stagger, duration, delay, isReduced]);

  return (
    <div ref={containerRef} className={className} {...props}>
      {children}
    </div>
  );
}

/* ============================================================
   4. AnimatedCounter — Fluid KPI Metric Counter (STEP 17)
   ============================================================ */
export interface AnimatedCounterProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  formatter?: (val: number) => string;
}

export function AnimatedCounter({
  value,
  duration = MOTION_DURATIONS.slow,
  decimals = 0,
  prefix = "",
  suffix = "",
  className = "",
  formatter,
}: AnimatedCounterProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const isReduced = useReducedMotion();

  useEffect(() => {
    if (!spanRef.current) return;

    if (isReduced) {
      const formatted = value.toLocaleString("ar-SA", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      spanRef.current.textContent = `${prefix}${formatted}${suffix}`;
      return;
    }

    const tween = animateCounter(spanRef.current, value, {
      duration,
      decimals,
      prefix,
      suffix,
      formatter,
    });

    return () => {
      tween?.kill();
    };
  }, [value, duration, decimals, prefix, suffix, isReduced, formatter]);

  return (
    <span
      ref={spanRef}
      className={`tabular-nums font-mono-numbers inline-block ${className}`}
      dir="ltr"
    >
      {prefix}
      {value}
      {suffix}
    </span>
  );
}

/* ============================================================
   5. TiltCard — Restrained 3D Card Hover (STEP 16)
   Desktop & pointer-only; disabled on touch and reduced-motion.
   ============================================================ */
export interface TiltCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  maxTilt?: number;
  perspective?: number;
}

export function TiltCard({
  children,
  maxTilt = 4, // Calm, subtle tilt
  perspective = 1000,
  className = "",
  ...props
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const hasHover = usePointerCapability();
  const isReduced = useReducedMotion();

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || !hasHover || isReduced) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const xPct = (x / rect.width - 0.5) * 2;
    const yPct = (y / rect.height - 0.5) * 2;

    const rotateX = -yPct * maxTilt;
    const rotateY = xPct * maxTilt;

    gsap.to(cardRef.current, {
      rotateX,
      rotateY,
      duration: MOTION_DURATIONS.fast,
      ease: "power1.out",
      transformPerspective: perspective,
    });
  };

  const handleMouseLeave = () => {
    if (!cardRef.current || !hasHover || isReduced) return;
    gsap.to(cardRef.current, {
      rotateX: 0,
      rotateY: 0,
      duration: MOTION_DURATIONS.normal,
      ease: GSAP_EASES.spring,
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`transition-shadow duration-300 transform-gpu ${className}`}
      style={{ transformStyle: "preserve-3d" }}
      {...props}
    >
      {children}
    </div>
  );
}

/* ============================================================
   6. ArabicTextReveal — Cursive-Safe Text Reveal (STEP 21)
   Never breaks Arabic ligatures or letter joins!
   Uses line/mask or word reveal with document.fonts.ready check.
   ============================================================ */
export interface ArabicTextRevealProps {
  children: string;
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span";
  duration?: number;
  delay?: number;
  className?: string;
}

export function ArabicTextReveal({
  children,
  as: Component = "span",
  duration = MOTION_DURATIONS.normal,
  delay = 0,
  className = "",
}: ArabicTextRevealProps) {
  const textRef = useRef<HTMLElement>(null);
  const isReduced = useReducedMotion();

  useEffect(() => {
    if (!textRef.current || isReduced) return;

    // Wait for fonts to load before calculating text metrics
    const startAnimation = () => {
      if (!textRef.current) return;
      gsap.fromTo(
        textRef.current,
        {
          opacity: 0,
          y: 8,
          filter: "blur(2px)",
        },
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          duration,
          delay,
          ease: GSAP_EASES.standard,
        }
      );
    };

    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready.then(startAnimation);
    } else {
      startAnimation();
    }
  }, [children, duration, delay, isReduced]);

  return (
    <Component
      ref={textRef as any}
      className={`inline-block font-display tracking-normal ${className}`}
      style={{ letterSpacing: "normal" }}
    >
      {children}
    </Component>
  );
}

/* ============================================================
   7. MotionEmptyState — Reusable Lightweight Empty State (STEP 20)
   ============================================================ */
export interface MotionEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function MotionEmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: MotionEmptyStateProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isReduced = useReducedMotion();

  useGsapEffect(() => {
    if (!containerRef.current || isReduced) return;
    const iconEl = containerRef.current.querySelector(".empty-icon");
    if (!iconEl) return;

    // Gentle, calm floating animation (enterprise, not bouncing)
    gsap.to(iconEl, {
      y: -5,
      duration: 2.2,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
  }, [isReduced]);

  return (
    <div
      ref={containerRef}
      className={`flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto ${className}`}
    >
      {icon && (
        <div className="empty-icon mb-4 p-4 rounded-2xl bg-primary/5 text-primary">
          {icon}
        </div>
      )}
      <h3 className="font-display text-lg font-bold text-foreground mb-1">
        {title}
      </h3>
      {description && (
        <p className="font-ui text-sm text-muted-foreground mb-4">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ============================================================
   8. Magnetic / MagneticButton — Tactile Pointer Button (STEP 7 & STEP 24)
   Pointer-only; disabled on touch devices and reduced-motion.
   ============================================================ */
export interface MagneticProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  strength?: number;
}

export function Magnetic({
  children,
  strength = 0.25,
  className = "",
  ...props
}: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);
  const hasHover = usePointerCapability();
  const isReduced = useReducedMotion();

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current || !hasHover || isReduced) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - (rect.left + rect.width / 2)) * strength;
    const y = (e.clientY - (rect.top + rect.height / 2)) * strength;

    gsap.to(ref.current, {
      x,
      y,
      duration: MOTION_DURATIONS.fast,
      ease: "power2.out",
    });
  };

  const handleMouseLeave = () => {
    if (!ref.current || !hasHover || isReduced) return;
    gsap.to(ref.current, {
      x: 0,
      y: 0,
      duration: MOTION_DURATIONS.normal,
      ease: GSAP_EASES.spring,
    });
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`inline-block ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export const MagneticButton = Magnetic;

/* ============================================================
   9. MaskReveal — Overflow-Clipped Mask Reveal (STEP 38)
   Useful for page headings, modal titles, and hero statistics.
   ============================================================ */
export interface MaskRevealProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  duration?: number;
  delay?: number;
  yOffset?: string | number;
}

export function MaskReveal({
  children,
  duration = MOTION_DURATIONS.normal,
  delay = 0,
  yOffset = "100%",
  className = "",
  ...props
}: MaskRevealProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const isReduced = useReducedMotion();

  useGsapEffect(() => {
    if (!contentRef.current || isReduced) return;

    gsap.fromTo(
      contentRef.current,
      { y: yOffset, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration,
        delay,
        ease: GSAP_EASES.standard,
        clearProps: "transform",
      }
    );
  }, [duration, delay, yOffset, isReduced]);

  return (
    <div className={`overflow-hidden inline-block ${className}`} {...props}>
      <div ref={contentRef} className="will-change-transform">
        {children}
      </div>
    </div>
  );
}

/* ============================================================
   10. BlurReveal — Fast Subtle Blur + Translate Reveal (STEP 39)
   ============================================================ */
export interface BlurRevealProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  duration?: number;
  delay?: number;
  blur?: number;
  y?: number;
}

export function BlurReveal({
  children,
  duration = MOTION_DURATIONS.fast,
  delay = 0,
  blur = 4,
  y = 8,
  className = "",
  ...props
}: BlurRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isReduced = useReducedMotion();

  useGsapEffect(() => {
    if (!ref.current || isReduced) return;

    gsap.fromTo(
      ref.current,
      { opacity: 0, y, filter: `blur(${blur}px)` },
      {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        duration,
        delay,
        ease: GSAP_EASES.standard,
        clearProps: "transform,filter",
      }
    );
  }, [duration, delay, blur, y, isReduced]);

  return (
    <div ref={ref} className={className} {...props}>
      {children}
    </div>
  );
}

/* ============================================================
   11. LightTrackingCard — Pointer Light Spotlight (STEP 41)
   Updates CSS vars directly on element, zero React state overhead.
   ============================================================ */
export interface LightTrackingCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  glowColor?: string;
}

export function LightTrackingCard({
  children,
  glowColor = "rgba(0, 166, 166, 0.12)",
  className = "",
  ...props
}: LightTrackingCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const hasHover = usePointerCapability();
  const isReduced = useReducedMotion();

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!cardRef.current || !hasHover || isReduced) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    cardRef.current.style.setProperty("--pointer-x", `${x}px`);
    cardRef.current.style.setProperty("--pointer-y", `${y}px`);
  };

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      className={`group relative overflow-hidden transition-all duration-200 ${className}`}
      {...props}
    >
      {hasHover && !isReduced && (
        <div
          className="pointer-events-none absolute -inset-px rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: `radial-gradient(350px circle at var(--pointer-x, 50%) var(--pointer-y, 50%), ${glowColor}, transparent 65%)`,
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/* ============================================================
   12. CopyButton — Tactile Inline Copy Micro-action (STEP 31)
   Morphs Copy -> Check icon with instant tactile feedback.
   ============================================================ */
export interface CopyButtonProps {
  value: string;
  className?: string;
  size?: "sm" | "default";
}

export function CopyButton({ value, className = "", size = "sm" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const isReduced = useReducedMotion();

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "تم النسخ" : "نسخ"}
      aria-label={copied ? "تم النسخ" : "نسخ"}
      className={`inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${className}`}
    >
      {copied ? (
        <Check
          className={`text-success transition-transform duration-200 ${isReduced ? "" : "scale-110"}`}
          size={size === "sm" ? 14 : 16}
        />
      ) : (
        <Copy
          className="transition-transform duration-200 hover:scale-105"
          size={size === "sm" ? 14 : 16}
        />
      )}
    </button>
  );
}

/* ============================================================
   13. Crossfade — Smooth Skeleton to Content Reveal (STEP 23)
   ============================================================ */
export interface CrossfadeProps {
  isLoading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Crossfade({ isLoading, skeleton, children, className = "" }: CrossfadeProps) {
  return (
    <div className={`relative transition-opacity duration-200 ${className}`}>
      {isLoading ? (
        <div className="animate-in fade-in-0 duration-150">{skeleton}</div>
      ) : (
        <div className="animate-in fade-in-0 duration-200">{children}</div>
      )}
    </div>
  );
}

/* ============================================================
   14. AnimatedBorder — Subtle Accent Border Trace (STEP 42)
   ============================================================ */
export interface AnimatedBorderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function AnimatedBorder({ children, className = "", ...props }: AnimatedBorderProps) {
  return (
    <div className={`relative p-[1px] rounded-xl overflow-hidden group ${className}`} {...props}>
      <div className="absolute inset-0 bg-gradient-to-r from-primary/30 via-primary to-primary/30 opacity-40 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative rounded-[inherit] bg-background">{children}</div>
    </div>
  );
}


