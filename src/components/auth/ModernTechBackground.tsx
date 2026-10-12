import React, { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/motion";

export type TechAtmosphereId = "aurora" | "neural" | "silk" | "amber";

export interface TechAtmospherePreset {
  id: TechAtmosphereId;
  label: string;
  badge: string;
  subtitle: string;
  primaryGlow: string;
  accentGlow: string;
  baseDark: string;
  baseLight: string;
}

export const TECH_ATMOSPHERE_PRESETS: TechAtmospherePreset[] = [
  {
    id: "aurora",
    label: "أورورا السائلة",
    badge: "حيوي ومميز",
    subtitle: "إضاءة سائلة وانسياب لوني فاخر بألوان التيل والزمرد والنيلي",
    primaryGlow: "#0D9488",
    accentGlow: "#2DD4BF",
    baseDark: "#030712",
    baseLight: "#F8FAFC",
  },
  {
    id: "neural",
    label: "شبكة الترابط الذكية",
    badge: "بيانات CRM",
    subtitle: "جسيمات ذكية وعقد اتصال تفاعلية ترمز لإدارة العلاقات والفرق",
    primaryGlow: "#0284C7",
    accentGlow: "#38BDF8",
    baseDark: "#040814",
    baseLight: "#F1F5F9",
  },
  {
    id: "silk",
    label: "أمواج الحرير الرقمي",
    badge: "انسيابي هادئ",
    subtitle: "تموجات حريرية ثلاثية الأبعاد بظلال ناعمة وكاوستيكس راقٍ",
    primaryGlow: "#059669",
    accentGlow: "#34D399",
    baseDark: "#02120E",
    baseLight: "#F0FDF4",
  },
  {
    id: "amber",
    label: "شفق الذهب والأمبر",
    badge: "تنفيذي فاخر",
    subtitle: "دفء تنفيذي فخم بتدرجات الذهب والأمبر الكربوني المعتمد",
    primaryGlow: "#D97706",
    accentGlow: "#FBBF24",
    baseDark: "#0C0A09",
    baseLight: "#FFFBEB",
  },
];

interface ModernTechBackgroundProps {
  mode?: TechAtmosphereId;
  isDarkTheme?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  baseAlpha: number;
  pulsePhase: number;
  pulseSpeed: number;
}

interface NeuralNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

export function ModernTechBackground({
  mode = "aurora",
  isDarkTheme = true,
}: ModernTechBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isReduced = useReducedMotion();
  const mouseRef = useRef({ x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5, isHovering: false });

  // Mouse move handler for smooth organic parallax / spotlight
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = e.clientX / window.innerWidth;
      mouseRef.current.targetY = e.clientY / window.innerHeight;
      mouseRef.current.isHovering = true;
    };
    const handleMouseLeave = () => {
      mouseRef.current.targetX = 0.5;
      mouseRef.current.targetY = 0.5;
      mouseRef.current.isHovering = false;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animId: number;
    let width = 0;
    let height = 0;
    let dpr = 1;

    // Resize function
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });

    // Initialize particles for Aurora & Amber
    const particleCount = width < 768 ? 35 : 65;
    const particles: Particle[] = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -(Math.random() * 0.45 + 0.15), // Gentle float upward
      radius: Math.random() * 1.8 + 0.6,
      alpha: Math.random() * 0.6 + 0.2,
      baseAlpha: Math.random() * 0.5 + 0.2,
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: Math.random() * 0.02 + 0.01,
    }));

    // Initialize Neural Nodes for Neural Mode
    const nodeCount = width < 768 ? 40 : 80;
    const neuralNodes: NeuralNode[] = Array.from({ length: nodeCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: Math.random() * 1.6 + 1.2,
      color: Math.random() > 0.4 ? "#2DD4BF" : "#38BDF8",
    }));

    let time = 0;

    const render = () => {
      // Advance time (respect reduced motion)
      const timeStep = isReduced ? 0.002 : 0.012;
      time += timeStep;

      // Smooth mouse lerp
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      const mx = mouseRef.current.x * width;
      const my = mouseRef.current.y * height;

      // Clear Canvas
      ctx.clearRect(0, 0, width, height);

      // Render Active Mode
      if (mode === "aurora") {
        renderAuroraMode(ctx, width, height, time, mx, my, isDarkTheme, particles);
      } else if (mode === "neural") {
        renderNeuralMode(ctx, width, height, time, mx, my, isDarkTheme, neuralNodes);
      } else if (mode === "silk") {
        renderSilkMode(ctx, width, height, time, mx, my, isDarkTheme);
      } else if (mode === "amber") {
        renderAmberMode(ctx, width, height, time, mx, my, isDarkTheme, particles);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [mode, isDarkTheme, isReduced]);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none select-none overflow-hidden transition-colors duration-1000"
      style={{
        backgroundColor: isDarkTheme
          ? mode === "amber"
            ? "#0C0A09"
            : mode === "silk"
              ? "#02120E"
              : mode === "neural"
                ? "#040814"
                : "#030712"
          : mode === "amber"
            ? "#FFFBEB"
            : mode === "silk"
              ? "#F0FDF4"
              : mode === "neural"
                ? "#F1F5F9"
                : "#F8FAFC",
      }}
    >
      {/* 1. Hardware Accelerated Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />

      {/* 2. Soft Vignette Radial Overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isDarkTheme
            ? "radial-gradient(circle at 50% 50%, transparent 40%, rgba(3, 7, 18, 0.65) 95%)"
            : "radial-gradient(circle at 50% 50%, transparent 50%, rgba(241, 245, 249, 0.45) 95%)",
        }}
      />

      {/* 3. Subtle Film Grain / Paper Texture to prevent color banding */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.032] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODE 1: FLUID AURORA (Stripe / Linear / Apple Luxe)
// ─────────────────────────────────────────────────────────────
function renderAuroraMode(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  mx: number,
  my: number,
  isDark: boolean,
  particles: Particle[]
) {
  ctx.save();
  ctx.globalCompositeOperation = isDark ? "screen" : "multiply";

  const maxDim = Math.max(w, h);

  // 1. Primary Luminous Teal Orb (Top / Center Lissajous orbit)
  const o1X = w * 0.5 + Math.sin(t * 0.7) * (w * 0.22);
  const o1Y = h * 0.3 + Math.cos(t * 0.5) * (h * 0.18);
  const o1R = maxDim * 0.42;
  const g1 = ctx.createRadialGradient(o1X, o1Y, 0, o1X, o1Y, o1R);
  if (isDark) {
    g1.addColorStop(0, "rgba(13, 148, 136, 0.5)");
    g1.addColorStop(0.5, "rgba(13, 148, 136, 0.2)");
    g1.addColorStop(1, "rgba(13, 148, 136, 0)");
  } else {
    g1.addColorStop(0, "rgba(45, 212, 191, 0.25)");
    g1.addColorStop(0.5, "rgba(45, 212, 191, 0.1)");
    g1.addColorStop(1, "rgba(45, 212, 191, 0)");
  }
  ctx.fillStyle = g1;
  ctx.beginPath();
  ctx.arc(o1X, o1Y, o1R, 0, Math.PI * 2);
  ctx.fill();

  // 2. Cyan / Sky Blue Orb (Right / East drift)
  const o2X = w * 0.75 + Math.cos(t * 0.6 + 1.2) * (w * 0.18);
  const o2Y = h * 0.65 + Math.sin(t * 0.8 + 0.8) * (h * 0.2);
  const o2R = maxDim * 0.38;
  const g2 = ctx.createRadialGradient(o2X, o2Y, 0, o2X, o2Y, o2R);
  if (isDark) {
    g2.addColorStop(0, "rgba(6, 182, 212, 0.42)");
    g2.addColorStop(0.5, "rgba(6, 182, 212, 0.15)");
    g2.addColorStop(1, "rgba(6, 182, 212, 0)");
  } else {
    g2.addColorStop(0, "rgba(56, 189, 248, 0.22)");
    g2.addColorStop(0.5, "rgba(56, 189, 248, 0.08)");
    g2.addColorStop(1, "rgba(56, 189, 248, 0)");
  }
  ctx.fillStyle = g2;
  ctx.beginPath();
  ctx.arc(o2X, o2Y, o2R, 0, Math.PI * 2);
  ctx.fill();

  // 3. Deep Emerald / Jade Orb (Bottom-Left / West drift)
  const o3X = w * 0.25 + Math.sin(t * 0.5 + 2.4) * (w * 0.2);
  const o3Y = h * 0.7 + Math.cos(t * 0.7 + 1.5) * (h * 0.18);
  const o3R = maxDim * 0.44;
  const g3 = ctx.createRadialGradient(o3X, o3Y, 0, o3X, o3Y, o3R);
  if (isDark) {
    g3.addColorStop(0, "rgba(16, 185, 129, 0.38)");
    g3.addColorStop(0.5, "rgba(16, 185, 129, 0.14)");
    g3.addColorStop(1, "rgba(16, 185, 129, 0)");
  } else {
    g3.addColorStop(0, "rgba(52, 211, 153, 0.2)");
    g3.addColorStop(0.5, "rgba(52, 211, 153, 0.06)");
    g3.addColorStop(1, "rgba(52, 211, 153, 0)");
  }
  ctx.fillStyle = g3;
  ctx.beginPath();
  ctx.arc(o3X, o3Y, o3R, 0, Math.PI * 2);
  ctx.fill();

  // 4. Midnight Violet / Royal Indigo Depth (Center-North)
  const o4X = w * 0.4 + Math.cos(t * 0.4 + 3.1) * (w * 0.25);
  const o4Y = h * 0.2 + Math.sin(t * 0.45 + 2.0) * (h * 0.15);
  const o4R = maxDim * 0.4;
  const g4 = ctx.createRadialGradient(o4X, o4Y, 0, o4X, o4Y, o4R);
  if (isDark) {
    g4.addColorStop(0, "rgba(79, 70, 229, 0.28)");
    g4.addColorStop(0.5, "rgba(79, 70, 229, 0.1)");
    g4.addColorStop(1, "rgba(79, 70, 229, 0)");
  } else {
    g4.addColorStop(0, "rgba(165, 180, 252, 0.18)");
    g4.addColorStop(0.5, "rgba(165, 180, 252, 0.05)");
    g4.addColorStop(1, "rgba(165, 180, 252, 0)");
  }
  ctx.fillStyle = g4;
  ctx.beginPath();
  ctx.arc(o4X, o4Y, o4R, 0, Math.PI * 2);
  ctx.fill();

  // 5. Interactive Mouse Follower Spotlight (Subtle Caustic Glow)
  const mouseR = maxDim * 0.26;
  const mouseG = ctx.createRadialGradient(mx, my, 0, mx, my, mouseR);
  if (isDark) {
    mouseG.addColorStop(0, "rgba(45, 212, 191, 0.32)");
    mouseG.addColorStop(0.4, "rgba(13, 148, 136, 0.12)");
    mouseG.addColorStop(1, "rgba(13, 148, 136, 0)");
  } else {
    mouseG.addColorStop(0, "rgba(20, 184, 166, 0.16)");
    mouseG.addColorStop(0.4, "rgba(20, 184, 166, 0.05)");
    mouseG.addColorStop(1, "rgba(20, 184, 166, 0)");
  }
  ctx.fillStyle = mouseG;
  ctx.beginPath();
  ctx.arc(mx, my, mouseR, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // 6. Floating Micro-Stardust Particles
  ctx.save();
  particles.forEach((p) => {
    p.y += p.vy;
    p.x += p.vx + Math.sin(t + p.pulsePhase) * 0.15;
    p.pulsePhase += p.pulseSpeed;

    // Wrap around screen
    if (p.y < -10) {
      p.y = h + 10;
      p.x = Math.random() * w;
    }
    if (p.x < -10) p.x = w + 10;
    if (p.x > w + 10) p.x = -10;

    const currentAlpha = p.baseAlpha * (0.65 + 0.35 * Math.sin(p.pulsePhase));
    ctx.fillStyle = isDark
      ? `rgba(204, 251, 241, ${currentAlpha.toFixed(3)})`
      : `rgba(15, 118, 110, ${(currentAlpha * 0.7).toFixed(3)})`;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────
// MODE 2: NEURAL DATA CONSTELLATION (CRM Pipelines & Nodes)
// ─────────────────────────────────────────────────────────────
function renderNeuralMode(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  mx: number,
  my: number,
  isDark: boolean,
  nodes: NeuralNode[]
) {
  // Update node positions
  nodes.forEach((n) => {
    n.x += n.vx;
    n.y += n.vy;

    // Gentle bounce off edges
    if (n.x < 0 || n.x > w) n.vx *= -1;
    if (n.y < 0 || n.y > h) n.vy *= -1;

    // Mouse gentle repulsion / pull
    const dx = mx - n.x;
    const dy = my - n.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 140 && dist > 1) {
      const force = (140 - dist) / 140;
      n.x -= (dx / dist) * force * 0.8;
      n.y -= (dy / dist) * force * 0.8;
    }
  });

  const connectionDist = w < 768 ? 95 : 125;

  // Draw connecting lines between close nodes
  ctx.save();
  ctx.lineWidth = 0.85;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < connectionDist) {
        const alpha = ((1 - dist / connectionDist) * 0.35).toFixed(3);
        ctx.strokeStyle = isDark
          ? `rgba(45, 212, 191, ${alpha})`
          : `rgba(13, 148, 136, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.stroke();
      }
    }

    // Connect to mouse if close
    const mdx = mx - nodes[i].x;
    const mdy = my - nodes[i].y;
    const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
    if (mdist < 150) {
      const malpha = ((1 - mdist / 150) * 0.45).toFixed(3);
      ctx.strokeStyle = isDark
        ? `rgba(56, 189, 248, ${malpha})`
        : `rgba(2, 132, 199, ${malpha})`;
      ctx.beginPath();
      ctx.moveTo(nodes[i].x, nodes[i].y);
      ctx.lineTo(mx, my);
      ctx.stroke();
    }
  }

  // Draw nodes
  nodes.forEach((n) => {
    ctx.fillStyle = isDark ? n.color : "#0F766E";
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
    ctx.fill();

    // Node glow
    if (isDark) {
      ctx.fillStyle = `rgba(45, 212, 191, 0.18)`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius * 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────
// MODE 3: DIGITAL SILK WAVES (Continuous 3D Wave Flow)
// ─────────────────────────────────────────────────────────────
function renderSilkMode(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  mx: number,
  my: number,
  isDark: boolean
) {
  ctx.save();
  const waveLayers = [
    { baseH: h * 0.65, amp: 55, freq: 0.002, speed: 0.8, color: "13, 148, 136" },
    { baseH: h * 0.72, amp: 45, freq: 0.0025, speed: 1.1, color: "5, 150, 105" },
    { baseH: h * 0.8, amp: 65, freq: 0.0018, speed: 0.7, color: "16, 185, 129" },
    { baseH: h * 0.88, amp: 35, freq: 0.003, speed: 1.3, color: "45, 212, 191" },
  ];

  waveLayers.forEach((layer, idx) => {
    ctx.beginPath();
    ctx.moveTo(0, h);

    const step = 8;
    for (let x = 0; x <= w + step; x += step) {
      // Dynamic harmonic sine wave + subtle mouse curvature
      const mouseBend = Math.sin((x / w) * Math.PI) * ((my / h - 0.5) * 35);
      const y =
        layer.baseH +
        Math.sin(x * layer.freq + t * layer.speed + idx * 1.5) * layer.amp +
        Math.cos(x * layer.freq * 0.7 - t * 0.5) * (layer.amp * 0.4) +
        mouseBend;

      if (x === 0) {
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.lineTo(w, h);
    ctx.closePath();

    const alpha = (0.16 + idx * 0.06).toFixed(3);
    const grad = ctx.createLinearGradient(0, layer.baseH - layer.amp, 0, h);
    if (isDark) {
      grad.addColorStop(0, `rgba(${layer.color}, ${alpha})`);
      grad.addColorStop(1, `rgba(${layer.color}, 0.01)`);
    } else {
      grad.addColorStop(0, `rgba(${layer.color}, ${(Number(alpha) * 0.7).toFixed(3)})`);
      grad.addColorStop(1, `rgba(${layer.color}, 0)`);
    }

    ctx.fillStyle = grad;
    ctx.fill();

    // Silky crest line highlight
    ctx.strokeStyle = isDark
      ? `rgba(110, 231, 183, ${(0.3 + idx * 0.1).toFixed(2)})`
      : `rgba(5, 150, 105, 0.25)`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  });

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────
// MODE 4: GOLDEN AMBER (Executive Carbon & Champagne)
// ─────────────────────────────────────────────────────────────
function renderAmberMode(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  mx: number,
  my: number,
  isDark: boolean,
  particles: Particle[]
) {
  ctx.save();
  ctx.globalCompositeOperation = isDark ? "screen" : "multiply";

  const maxDim = Math.max(w, h);

  // Warm Amber Orb
  const a1X = w * 0.55 + Math.sin(t * 0.6) * (w * 0.2);
  const a1Y = h * 0.35 + Math.cos(t * 0.5) * (h * 0.15);
  const a1R = maxDim * 0.45;
  const g1 = ctx.createRadialGradient(a1X, a1Y, 0, a1X, a1Y, a1R);
  if (isDark) {
    g1.addColorStop(0, "rgba(217, 119, 6, 0.45)");
    g1.addColorStop(0.5, "rgba(180, 83, 9, 0.18)");
    g1.addColorStop(1, "rgba(180, 83, 9, 0)");
  } else {
    g1.addColorStop(0, "rgba(245, 158, 11, 0.22)");
    g1.addColorStop(0.5, "rgba(245, 158, 11, 0.08)");
    g1.addColorStop(1, "rgba(245, 158, 11, 0)");
  }
  ctx.fillStyle = g1;
  ctx.beginPath();
  ctx.arc(a1X, a1Y, a1R, 0, Math.PI * 2);
  ctx.fill();

  // Champagne Gold Orb
  const a2X = w * 0.3 + Math.cos(t * 0.5 + 1.5) * (w * 0.2);
  const a2Y = h * 0.7 + Math.sin(t * 0.7 + 1.0) * (h * 0.18);
  const a2R = maxDim * 0.4;
  const g2 = ctx.createRadialGradient(a2X, a2Y, 0, a2X, a2Y, a2R);
  if (isDark) {
    g2.addColorStop(0, "rgba(251, 191, 36, 0.38)");
    g2.addColorStop(0.5, "rgba(217, 119, 6, 0.12)");
    g2.addColorStop(1, "rgba(217, 119, 6, 0)");
  } else {
    g2.addColorStop(0, "rgba(252, 211, 77, 0.18)");
    g2.addColorStop(0.5, "rgba(252, 211, 77, 0.05)");
    g2.addColorStop(1, "rgba(252, 211, 77, 0)");
  }
  ctx.fillStyle = g2;
  ctx.beginPath();
  ctx.arc(a2X, a2Y, a2R, 0, Math.PI * 2);
  ctx.fill();

  // Mouse warmth
  const mR = maxDim * 0.25;
  const mG = ctx.createRadialGradient(mx, my, 0, mx, my, mR);
  mG.addColorStop(0, isDark ? "rgba(245, 158, 11, 0.28)" : "rgba(217, 119, 6, 0.12)");
  mG.addColorStop(1, "rgba(245, 158, 11, 0)");
  ctx.fillStyle = mG;
  ctx.beginPath();
  ctx.arc(mx, my, mR, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Floating Golden Embers
  ctx.save();
  particles.forEach((p) => {
    p.y += p.vy * 1.2;
    p.x += p.vx + Math.sin(t + p.pulsePhase) * 0.2;
    p.pulsePhase += p.pulseSpeed;

    if (p.y < -10) {
      p.y = h + 10;
      p.x = Math.random() * w;
    }

    const currentAlpha = p.baseAlpha * (0.7 + 0.3 * Math.sin(p.pulsePhase));
    ctx.fillStyle = isDark
      ? `rgba(253, 230, 138, ${currentAlpha.toFixed(3)})`
      : `rgba(180, 83, 9, ${(currentAlpha * 0.6).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}
