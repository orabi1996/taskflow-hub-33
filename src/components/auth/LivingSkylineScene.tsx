import React, { useEffect, useRef, useMemo, useState } from "react";
import { resolveSkylineImage, resolveSkylineMobileImage, type SkylineSceneId } from "./AuthSkylineSwitcher";
import { ThreeLivingAtmosphere } from "./ThreeLivingAtmosphere";

interface LivingSkylineSceneProps {
  scene: SkylineSceneId;
  isDarkTheme?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rich, Vibrant Color Schemes Per Scene
// ─────────────────────────────────────────────────────────────────────────────
interface ScenePalette {
  sunX: number;
  sunY: number;
  sunColor: string;
  sunHalo: string;
  aurora: [string, string, string];
  particleGlow: string;
  particleCore: string;
  rayColor: string;
  waterColor: string;
  waterHighlight: string;
  cursorGlow: string;
  skyTint: string;
}

function getPalette(isNight: boolean, scene: SkylineSceneId): ScenePalette {
  if (isNight || scene === "night") {
    return {
      sunX: 0.74,
      sunY: 0.12,
      sunColor: "rgba(224, 242, 254, 0.95)",
      sunHalo: "rgba(56, 189, 248, 0.35)",
      aurora: [
        "rgba(56, 189, 248, 0.28)",  // Sky blue
        "rgba(99, 102, 241, 0.24)",  // Indigo
        "rgba(16, 185, 129, 0.20)",  // Emerald
      ],
      particleGlow: "rgba(56, 189, 248, 0.65)",
      particleCore: "#ffffff",
      rayColor: "rgba(186, 230, 253, 0.22)",
      waterColor: "rgba(14, 116, 144, 0.25)",
      waterHighlight: "rgba(224, 242, 254, 0.6)",
      cursorGlow: "rgba(56, 189, 248, 0.14)",
      skyTint: "linear-gradient(160deg, rgba(2,10,22,0.45) 0%, rgba(3,18,36,0.25) 50%, rgba(2,8,16,0.65) 100%)",
    };
  }

  if (scene === "sunset-1") {
    // Golden sunset over Cairo pyramids & skyscrapers
    return {
      sunX: 0.12,
      sunY: 0.34,
      sunColor: "rgba(255, 237, 160, 0.98)",
      sunHalo: "rgba(245, 158, 11, 0.45)",
      aurora: [
        "rgba(251, 191, 36, 0.35)",  // Amber
        "rgba(249, 115, 22, 0.28)",  // Orange
        "rgba(236, 72, 153, 0.22)",  // Rose
      ],
      particleGlow: "rgba(251, 191, 36, 0.75)",
      particleCore: "#fffbeb",
      rayColor: "rgba(254, 240, 138, 0.32)",
      waterColor: "rgba(245, 158, 11, 0.3)",
      waterHighlight: "rgba(254, 249, 195, 0.75)",
      cursorGlow: "rgba(251, 191, 36, 0.16)",
      skyTint: "linear-gradient(160deg, rgba(30,12,4,0.3) 0%, rgba(20,8,2,0.15) 50%, rgba(15,5,2,0.5) 100%)",
    };
  }

  if (scene === "sunset-2") {
    // Dhow heritage maritime sunset
    return {
      sunX: 0.18,
      sunY: 0.38,
      sunColor: "rgba(254, 215, 170, 0.98)",
      sunHalo: "rgba(234, 88, 12, 0.42)",
      aurora: [
        "rgba(249, 115, 22, 0.32)",
        "rgba(225, 29, 72, 0.24)",
        "rgba(217, 119, 6, 0.26)",
      ],
      particleGlow: "rgba(253, 186, 116, 0.75)",
      particleCore: "#ffffff",
      rayColor: "rgba(254, 215, 170, 0.30)",
      waterColor: "rgba(234, 88, 12, 0.32)",
      waterHighlight: "rgba(255, 237, 213, 0.8)",
      cursorGlow: "rgba(249, 115, 22, 0.15)",
      skyTint: "linear-gradient(160deg, rgba(28,10,6,0.32) 0%, rgba(18,6,3,0.18) 50%, rgba(12,4,2,0.52) 100%)",
    };
  }

  if (scene === "sunset-3") {
    // Palms coast dusk
    return {
      sunX: 0.15,
      sunY: 0.28,
      sunColor: "rgba(253, 230, 138, 0.98)",
      sunHalo: "rgba(217, 119, 6, 0.40)",
      aurora: [
        "rgba(245, 158, 11, 0.32)",
        "rgba(168, 85, 247, 0.22)",
        "rgba(20, 184, 166, 0.24)",
      ],
      particleGlow: "rgba(253, 224, 71, 0.7)",
      particleCore: "#ffffff",
      rayColor: "rgba(254, 243, 199, 0.28)",
      waterColor: "rgba(20, 184, 166, 0.28)",
      waterHighlight: "rgba(204, 251, 241, 0.75)",
      cursorGlow: "rgba(20, 184, 166, 0.16)",
      skyTint: "linear-gradient(160deg, rgba(20,10,24,0.3) 0%, rgba(12,6,18,0.15) 50%, rgba(8,4,14,0.5) 100%)",
    };
  }

  // Day Capital ("نهار العواصم")
  return {
    sunX: 0.16,
    sunY: 0.18,
    sunColor: "rgba(255, 255, 255, 1)",
    sunHalo: "rgba(56, 189, 248, 0.45)",
    aurora: [
      "rgba(14, 165, 233, 0.28)",  // Sky blue
      "rgba(20, 184, 166, 0.24)",  // Teal
      "rgba(245, 158, 11, 0.20)",  // Gold
    ],
    particleGlow: "rgba(56, 189, 248, 0.65)",
    particleCore: "#ffffff",
    rayColor: "rgba(255, 255, 255, 0.28)",
    waterColor: "rgba(14, 165, 233, 0.26)",
    waterHighlight: "rgba(240, 249, 255, 0.85)",
    cursorGlow: "rgba(14, 165, 233, 0.15)",
    skyTint: "linear-gradient(160deg, rgba(6,32,54,0.25) 0%, rgba(4,22,38,0.12) 50%, rgba(2,14,26,0.45) 100%)",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseSize: number;
  size: number;
  alpha: number;
  pulsePhase: number;
  pulseSpeed: number;
  colorType: number; // 0 = core/gold, 1 = brand/teal, 2 = white
}

interface Meteor {
  x: number;
  y: number;
  len: number;
  speed: number;
  angle: number;
  alpha: number;
  active: boolean;
  thickness: number;
}

interface Star {
  x: number;
  y: number;
  r: number;
  alpha: number;
  twinklePhase: number;
  twinkleSpeed: number;
  hasSpikes: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Master Living Scene Component
// ─────────────────────────────────────────────────────────────────────────────
export function LivingSkylineScene({ scene, isDarkTheme = false }: LivingSkylineSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isNight = scene === "night" || (scene === "auto" && isDarkTheme);
  const pal = useMemo(() => getPalette(isNight, scene), [isNight, scene]);

  const activeWallpaper = useMemo(() => resolveSkylineImage(scene, isDarkTheme), [scene, isDarkTheme]);
  const activeMobileWallpaper = useMemo(() => resolveSkylineMobileImage(scene, isDarkTheme), [scene, isDarkTheme]);

  // Smooth mouse coordinates for 3D parallax & interactive glow
  const mouseRef = useRef({ x: 0.5, y: 0.5, currentX: 0.5, currentY: 0.5, active: false });

  // Parallax transform state for wallpaper
  const [parallaxStyle, setParallaxStyle] = useState({
    transform: "scale(1.08) translate3d(0px, 0px, 0)",
  });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX / window.innerWidth;
      mouseRef.current.y = e.clientY / window.innerHeight;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
      mouseRef.current.x = 0.5;
      mouseRef.current.y = 0.5;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // Canvas Animation Engine
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animId = 0;
    let W = 0;
    let H = 0;
    const isMobile = window.innerWidth < 1024;
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);

    const reduceMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Entities
    let particles: Particle[] = [];
    let stars: Star[] = [];
    let meteors: Meteor[] = [];

    const initEntities = () => {
      const pCount = isMobile ? 26 : 60;
      particles = Array.from({ length: pCount }, () => {
        const size = 1.8 + Math.random() * 3.4;
        return {
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -0.25 - Math.random() * 0.55,
          baseSize: size,
          size,
          alpha: 0.35 + Math.random() * 0.55,
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.025 + Math.random() * 0.045,
          colorType: Math.random() > 0.65 ? 1 : Math.random() > 0.3 ? 0 : 2,
        };
      });

      if (isNight) {
        const starCount = isMobile ? 65 : 140;
        stars = Array.from({ length: starCount }, () => {
          const r = 0.6 + Math.random() * 1.8;
          return {
            x: Math.random() * W,
            y: Math.random() * H * 0.62,
            r,
            alpha: 0.3 + Math.random() * 0.7,
            twinklePhase: Math.random() * Math.PI * 2,
            twinkleSpeed: 0.03 + Math.random() * 0.06,
            hasSpikes: r > 1.8 && Math.random() > 0.4,
          };
        });

        meteors = [
          { x: 0, y: 0, len: 140, speed: 12, angle: Math.PI * 0.78, alpha: 0, active: false, thickness: 2.2 },
          { x: 0, y: 0, len: 100, speed: 15, angle: Math.PI * 0.75, alpha: 0, active: false, thickness: 1.8 },
        ];
      } else {
        stars = [];
        meteors = [];
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initEntities();
    };

    resize();
    window.addEventListener("resize", resize);

    let t = 0;
    let lastTime = performance.now();
    let meteorCooldown = 120; // frames before first shooting star

    // ─────────────────────────────────────────────────────────────────────────
    // Render Loop
    // ─────────────────────────────────────────────────────────────────────────
    const render = (now: number) => {
      const dt = Math.min((now - lastTime) / 16.67, 2.5);
      lastTime = now;
      if (!reduceMotion) t += dt;

      // Smooth mouse lerp
      const mouse = mouseRef.current;
      mouse.currentX += (mouse.x - mouse.currentX) * 0.045;
      mouse.currentY += (mouse.y - mouse.currentY) * 0.045;

      // Update wallpaper parallax
      const pOffsetX = (mouse.currentX - 0.5) * -22;
      const pOffsetY = (mouse.currentY - 0.5) * -16;
      setParallaxStyle({
        transform: `scale(1.09) translate3d(${pOffsetX.toFixed(1)}px, ${pOffsetY.toFixed(1)}px, 0)`,
      });

      ctx.clearRect(0, 0, W, H);

      // 1. ── ATMOSPHERIC AURORA / LIGHT RIBBONS ──
      ctx.save();
      ctx.globalCompositeOperation = "screen";

      const waves = isMobile ? 3 : 5;
      for (let w = 0; w < waves; w++) {
        const speed = 0.012 + w * 0.006;
        const phase = t * speed + (w * Math.PI) / 2.5;
        const waveY = H * (0.16 + w * 0.09) + Math.sin(phase * 0.7) * 20;
        const amp = H * (isMobile ? 0.045 : 0.075) * (1 + Math.sin(t * 0.008 + w) * 0.25);
        const col = pal.aurora[w % pal.aurora.length];

        const grad = ctx.createLinearGradient(0, waveY - amp * 2, 0, waveY + amp * 3);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(0.3, col);
        grad.addColorStop(0.65, col);
        grad.addColorStop(1, "rgba(0,0,0,0)");

        ctx.beginPath();
        const step = isMobile ? 32 : 18;
        ctx.moveTo(0, waveY);
        for (let x = 0; x <= W; x += step) {
          const y =
            waveY +
            Math.sin(x * 0.0035 + phase) * amp +
            Math.cos(x * 0.007 + phase * 1.3) * (amp * 0.45);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W, waveY + amp * 2.5);
        ctx.lineTo(0, waveY + amp * 2.5);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }
      ctx.restore();

      // 2. ── VOLUMETRIC CREPUSCULAR / GOD RAYS ──
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const sunScreenX = (pal.sunX + (mouse.currentX - 0.5) * 0.04) * W;
      const sunScreenY = (pal.sunY + (mouse.currentY - 0.5) * 0.03) * H;
      const rayCount = isMobile ? 7 : 12;

      for (let r = 0; r < rayCount; r++) {
        const baseAngle = -Math.PI * 0.15 + (r / rayCount) * Math.PI * 1.3;
        const angle = baseAngle + Math.sin(t * 0.006 + r * 0.8) * 0.06;
        const rayLen = W * (0.75 + Math.sin(t * 0.01 + r) * 0.18);
        const rayAlpha = (0.045 + Math.sin(t * 0.014 + r * 1.2) * 0.03) * (isNight ? 0.7 : 1.2);

        const endX = sunScreenX + Math.cos(angle) * rayLen;
        const endY = sunScreenY + Math.sin(angle) * rayLen;

        const rayGrad = ctx.createLinearGradient(sunScreenX, sunScreenY, endX, endY);
        rayGrad.addColorStop(0, pal.rayColor);
        rayGrad.addColorStop(0.35, pal.rayColor.replace(/[\d\.]+\)$/, `${(rayAlpha * 2).toFixed(3)})`));
        rayGrad.addColorStop(1, "rgba(0,0,0,0)");

        const rayWidth = isMobile ? 16 + r * 3 : 26 + r * 6;
        const nx = Math.sin(angle);
        const ny = -Math.cos(angle);

        ctx.beginPath();
        ctx.moveTo(sunScreenX - nx * 3, sunScreenY - ny * 3);
        ctx.lineTo(sunScreenX + nx * 3, sunScreenY + ny * 3);
        ctx.lineTo(endX + nx * rayWidth, endY + ny * rayWidth);
        ctx.lineTo(endX - nx * rayWidth, endY - ny * rayWidth);
        ctx.closePath();
        ctx.fillStyle = rayGrad;
        ctx.fill();
      }

      // Sun / Moon Glowing Orb & Corona
      const glowRadius = isNight ? 55 : 85;
      const sunCorona = ctx.createRadialGradient(
        sunScreenX,
        sunScreenY,
        0,
        sunScreenX,
        sunScreenY,
        glowRadius * 1.8,
      );
      sunCorona.addColorStop(0, pal.sunColor);
      sunCorona.addColorStop(0.2, pal.sunHalo);
      sunCorona.addColorStop(0.6, pal.sunHalo.replace(/[\d\.]+\)$/, "0.08)"));
      sunCorona.addColorStop(1, "rgba(0,0,0,0)");

      ctx.beginPath();
      ctx.arc(sunScreenX, sunScreenY, glowRadius * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = sunCorona;
      ctx.fill();

      // Sun core
      ctx.beginPath();
      ctx.arc(sunScreenX, sunScreenY, isNight ? 12 : 22, 0, Math.PI * 2);
      ctx.fillStyle = pal.sunColor;
      ctx.fill();
      ctx.restore();

      // 3. ── WATER SPECULAR WAVES & REFLECTIONS ──
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const waterHorizon = H * 0.58;
      const waveLines = isMobile ? 9 : 16;

      for (let i = 0; i < waveLines; i++) {
        const prog = i / waveLines;
        const waveY = waterHorizon + prog * H * 0.41;
        const waveAmp = 1.5 + prog * 4.2;
        const waveFreq = 0.012 - prog * 0.004;
        const waveSpeed = 0.025 + prog * 0.015;
        const lineAlpha = (0.12 + prog * 0.35) * (0.7 + Math.sin(t * 0.03 + i) * 0.3);

        const waveGrad = ctx.createLinearGradient(0, waveY, W, waveY);
        waveGrad.addColorStop(0, "rgba(0,0,0,0)");
        waveGrad.addColorStop(0.25, pal.waterHighlight.replace(/[\d\.]+\)$/, `${(lineAlpha * 0.6).toFixed(3)})`));
        waveGrad.addColorStop(0.5, pal.waterHighlight.replace(/[\d\.]+\)$/, `${lineAlpha.toFixed(3)})`));
        waveGrad.addColorStop(0.75, pal.waterHighlight.replace(/[\d\.]+\)$/, `${(lineAlpha * 0.6).toFixed(3)})`));
        waveGrad.addColorStop(1, "rgba(0,0,0,0)");

        ctx.beginPath();
        const step = isMobile ? 22 : 14;
        for (let x = 0; x <= W; x += step) {
          const y =
            waveY +
            Math.sin(x * waveFreq + t * waveSpeed) * waveAmp +
            Math.cos(x * 0.022 + t * waveSpeed * 0.8) * (waveAmp * 0.4);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = waveGrad;
        ctx.lineWidth = 1.2 + prog * 2.2;
        ctx.stroke();
      }
      ctx.restore();

      // 4. ── TWINKLING STARS & METEORS (NIGHT ONLY) ──
      if (isNight) {
        ctx.save();
        stars.forEach((s) => {
          s.twinklePhase += s.twinkleSpeed * dt;
          const currentAlpha = Math.max(0.15, s.alpha + Math.sin(s.twinklePhase) * 0.45);

          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${currentAlpha.toFixed(3)})`;
          ctx.fill();

          // Diffraction spikes on bright stars
          if (s.hasSpikes && currentAlpha > 0.65) {
            ctx.strokeStyle = `rgba(224, 242, 254, ${(currentAlpha * 0.5).toFixed(3)})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(s.x - s.r * 4.5, s.y);
            ctx.lineTo(s.x + s.r * 4.5, s.y);
            ctx.moveTo(s.x, s.y - s.r * 4.5);
            ctx.lineTo(s.x, s.y + s.r * 4.5);
            ctx.stroke();
          }
        });

        // Shooting Stars (Meteors)
        meteorCooldown -= dt;
        if (meteorCooldown <= 0) {
          const available = meteors.find((m) => !m.active);
          if (available) {
            available.active = true;
            available.x = W * (0.35 + Math.random() * 0.55);
            available.y = H * (0.02 + Math.random() * 0.15);
            available.alpha = 1.0;
            available.speed = 12 + Math.random() * 8;
            available.len = 120 + Math.random() * 80;
            meteorCooldown = 180 + Math.random() * 220; // 3-6 seconds
          }
        }

        meteors.forEach((m) => {
          if (!m.active) return;
          m.x -= Math.cos(m.angle) * m.speed * dt;
          m.y += Math.sin(m.angle) * m.speed * dt;
          m.alpha -= 0.016 * dt;

          if (m.alpha <= 0 || m.x < -100 || m.y > H) {
            m.active = false;
            return;
          }

          const tailX = m.x + Math.cos(m.angle) * m.len;
          const tailY = m.y - Math.sin(m.angle) * m.len;

          const mGrad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
          mGrad.addColorStop(0, `rgba(255, 255, 255, ${m.alpha})`);
          mGrad.addColorStop(0.3, `rgba(186, 230, 253, ${m.alpha * 0.7})`);
          mGrad.addColorStop(1, "rgba(56, 189, 248, 0)");

          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(tailX, tailY);
          ctx.strokeStyle = mGrad;
          ctx.lineWidth = m.thickness;
          ctx.stroke();

          // Meteor head flash
          ctx.beginPath();
          ctx.arc(m.x, m.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${m.alpha})`;
          ctx.fill();
        });
        ctx.restore();
      }

      // 5. ── LIVING GOLD & TEAL LUMINOUS PARTICLES ──
      ctx.save();
      const mousePixelX = mouse.currentX * W;
      const mousePixelY = mouse.currentY * H;

      particles.forEach((p) => {
        if (!reduceMotion) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.pulsePhase += p.pulseSpeed * dt;

          // Wrap around edges
          if (p.y < -20) {
            p.y = H + 10;
            p.x = Math.random() * W;
          }
          if (p.x < -20) p.x = W + 10;
          if (p.x > W + 20) p.x = -10;

          // Interactive mouse force: particles gently repelled by cursor
          const dx = p.x - mousePixelX;
          const dy = p.y - mousePixelY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 160 && dist > 1) {
            const force = (1 - dist / 160) * 1.8;
            p.x += (dx / dist) * force;
            p.y += (dy / dist) * force;
          }
        }

        const pulse = 0.75 + Math.sin(p.pulsePhase) * 0.35;
        const alpha = Math.min(1, p.alpha * pulse);
        const radius = p.baseSize * pulse;

        // Radial glow aura
        const glowRad = radius * 4.2;
        const pGlow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRad);
        const color = p.colorType === 1 ? "rgba(20, 184, 166," : p.colorType === 0 ? pal.particleGlow : "rgba(255, 255, 255,";

        pGlow.addColorStop(0, color.replace(/,$/, `,${(alpha * 0.9).toFixed(3)})`));
        pGlow.addColorStop(0.4, color.replace(/,$/, `,${(alpha * 0.35).toFixed(3)})`));
        pGlow.addColorStop(1, "rgba(0,0,0,0)");

        ctx.beginPath();
        ctx.arc(p.x, p.y, glowRad, 0, Math.PI * 2);
        ctx.fillStyle = pGlow;
        ctx.fill();

        // Bright sparkling core
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = pal.particleCore;
        ctx.fill();
      });

      // 6. ── CONSTELLATION FILAMENT CONNECTIONS ──
      if (!isMobile && !reduceMotion) {
        ctx.lineWidth = 0.75;
        const maxDist = 95;
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < maxDist) {
              const lineAlpha = (1 - dist / maxDist) * 0.22;
              ctx.strokeStyle = pal.particleGlow.replace(/[\d\.]+\)$/, `${lineAlpha.toFixed(3)})`);
              ctx.beginPath();
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.stroke();
            }
          }
        }
      }
      ctx.restore();

      // 7. ── TACTILE MOUSE SPOTLIGHT / AURA ──
      if (!isMobile && mouse.active) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const spotlight = ctx.createRadialGradient(
          mousePixelX,
          mousePixelY,
          0,
          mousePixelX,
          mousePixelY,
          360,
        );
        spotlight.addColorStop(0, pal.cursorGlow);
        spotlight.addColorStop(0.5, pal.cursorGlow.replace(/[\d\.]+\)$/, "0.04)"));
        spotlight.addColorStop(1, "rgba(0,0,0,0)");

        ctx.fillStyle = spotlight;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [pal, isNight]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        zIndex: 0,
        pointerEvents: "none",
      }}
    >
      {/* ── Layer 1: Wallpaper with Living 3D Parallax & Cinematic Breathing ── */}
      <picture
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          transition: "transform 0.12s cubic-bezier(0.25, 1, 0.5, 1)",
          willChange: "transform",
          ...parallaxStyle,
        }}
      >
        <source media="(max-width: 1023px)" srcSet={activeMobileWallpaper} type="image/webp" />
        <img
          key={activeWallpaper}
          src={activeWallpaper}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "55% 50%",
            filter: isNight
              ? "contrast(1.08) saturate(1.15) brightness(0.92)"
              : "contrast(1.04) saturate(1.12) brightness(1.02)",
            transition: "opacity 0.7s ease",
          }}
        />
      </picture>

      {/* ── Layer 2: Subtle Tint Veil to Balance Legibility & Contrast ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: pal.skyTint,
          transition: "background 0.8s ease",
        }}
      />

      {/* ── Layer 2.5: Three.js Spatial WebGL Particles & Geometric Atmosphere ── */}
      <ThreeLivingAtmosphere scene={scene} isDarkTheme={isDarkTheme} />

      {/* ── Layer 3: High-Resolution Living Canvas Engine ── */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      />

      {/* ── Layer 4: Vignette & Floor Glow ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 115%, rgba(0,0,0,0.45) 0%, transparent 70%), radial-gradient(ellipse at 50% -10%, rgba(0,0,0,0.3) 0%, transparent 60%)",
        }}
      />
    </div>
  );
}

export default LivingSkylineScene;
