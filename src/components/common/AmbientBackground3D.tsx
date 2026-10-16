import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useReducedMotion, usePointerCapability } from "@/motion";

/**
 * Checks whether WebGL is safely available in the current browser environment.
 */
function isWebGLAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

/**
 * Creates a circular glowing particle texture with soft radial falloff
 */
function createParticleTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  try {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const gradient = ctx.createRadialGradient(
        size / 2, size / 2, 0,
        size / 2, size / 2, size / 2
      );
      gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
      gradient.addColorStop(0.25, "rgba(255, 255, 255, 0.85)");
      gradient.addColorStop(0.6, "rgba(255, 255, 255, 0.2)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  } catch {
    return null;
  }
}

export interface AmbientBackground3DProps {
  className?: string;
  opacity?: number;
}

/**
 * AmbientBackground3D
 * Enterprise-grade, lightweight Three.js ambient network canvas that lives behind the main layout.
 * Features:
 * - Dynamic constellation nodes & neural connection lines with CRM brand teal/mint palette.
 * - Smooth damped mouse parallax.
 * - Theme-reactive (dark / light adjustments).
 * - Zero CPU waste: auto-pauses when tab is hidden or reduced motion is preferred.
 * - Full memory lifecycle cleanup (geometry, material, texture, WebGL context).
 * - Rock-solid safeguards: silently gracefully no-ops if WebGL is unavailable.
 */
export function AmbientBackground3D({ className = "", opacity = 1 }: AmbientBackground3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const isReduced = useReducedMotion();
  const hasHover = usePointerCapability();
  const [isDark, setIsDark] = useState(false);

  // Theme observer
  useEffect(() => {
    const checkDark = () => {
      const dark =
        document.documentElement.classList.contains("dark") ||
        document.documentElement.getAttribute("data-theme") === "slate" ||
        document.documentElement.getAttribute("data-theme") === "night";
      setIsDark(dark);
    };

    checkDark();

    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isReduced || !mountRef.current || !isWebGLAvailable()) return;

    const container = mountRef.current;
    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    let renderer: THREE.WebGLRenderer | null = null;
    let animationFrameId: number | undefined;
    let particleGeometry: THREE.BufferGeometry | null = null;
    let particleMaterial: THREE.PointsMaterial | null = null;
    let particleTexture: THREE.CanvasTexture | null = null;
    let lineGeometry: THREE.BufferGeometry | null = null;
    let lineMaterial: THREE.LineBasicMaterial | null = null;

    let handlePointerMove: ((e: MouseEvent) => void) | undefined;
    let handleResize: (() => void) | undefined;
    let handleVisibilityChange: (() => void) | undefined;

    try {
      // Three.js Scene, Camera, Renderer
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
      camera.position.z = 45;

      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(width, height);
      renderer.setClearColor(0x000000, 0); // fully transparent
      container.appendChild(renderer.domElement);

    // Particle Texture
    particleTexture = createParticleTexture();

    // Node count: balanced for smooth 60fps even on laptops
    const PARTICLE_COUNT = 55;
    const CONNECT_DISTANCE = 14;

    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);

    const tealColor = new THREE.Color("#00A6A6");
    const mintColor = new THREE.Color("#7AE7C7");
    const emeraldColor = new THREE.Color("#2DD4BF");

    const spreadX = 40;
    const spreadY = 24;
    const spreadZ = 20;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * spreadX * 2;
      positions[i3 + 1] = (Math.random() - 0.5) * spreadY * 2;
      positions[i3 + 2] = (Math.random() - 0.5) * spreadZ * 2;

      velocities[i3] = (Math.random() - 0.5) * 0.015;
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.015;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.01;

      const chosenColor = i % 3 === 0 ? tealColor : i % 3 === 1 ? mintColor : emeraldColor;
      colors[i3] = chosenColor.r;
      colors[i3 + 1] = chosenColor.g;
      colors[i3 + 2] = chosenColor.b;
    }

    particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    particleMaterial = new THREE.PointsMaterial({
      size: isDark ? 1.6 : 1.2,
      map: particleTexture ?? undefined,
      transparent: true,
      opacity: isDark ? 0.65 : 0.25,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // Dynamic Connections (Lines)
    const MAX_LINES = PARTICLE_COUNT * 6;
    const linePositions = new Float32Array(MAX_LINES * 2 * 3);
    const lineColors = new Float32Array(MAX_LINES * 2 * 3);

    lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage)
    );
    lineGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(lineColors, 3).setUsage(THREE.DynamicDrawUsage)
    );

    lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: isDark ? 0.18 : 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lines);

    // Mouse Interaction
    let targetMouseX = 0;
    let targetMouseY = 0;
    let mouseX = 0;
    let mouseY = 0;

    const handlePointerMove = (e: MouseEvent) => {
      if (!hasHover) return;
      targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetMouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    window.addEventListener("mousemove", handlePointerMove, { passive: true });

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer) return;
      width = container.clientWidth || window.innerWidth;
      height = container.clientHeight || window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener("resize", handleResize);

    // Animation Loop with Visibility Check
    let animationFrameId: number;
    let isPaused = false;

    const handleVisibilityChange = () => {
      isPaused = document.hidden;
      if (!isPaused) {
        lastTime = performance.now();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(animate);
      if (isPaused || !particleGeometry || !lineGeometry || !renderer) return;

      const delta = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      // Smooth mouse lerp
      mouseX += (targetMouseX - mouseX) * 0.04;
      mouseY += (targetMouseY - mouseY) * 0.04;

      scene.rotation.y = mouseX * 0.08;
      scene.rotation.x = -mouseY * 0.06;

      // Update particle positions
      const posAttr = particleGeometry.getAttribute("position") as THREE.BufferAttribute;
      const posArray = posAttr.array as Float32Array;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        posArray[i3] += velocities[i3] * (delta * 60);
        posArray[i3 + 1] += velocities[i3 + 1] * (delta * 60);
        posArray[i3 + 2] += velocities[i3 + 2] * (delta * 60);

        // Gentle boundary bounce
        if (Math.abs(posArray[i3]) > spreadX) velocities[i3] *= -1;
        if (Math.abs(posArray[i3 + 1]) > spreadY) velocities[i3 + 1] *= -1;
        if (Math.abs(posArray[i3 + 2]) > spreadZ) velocities[i3 + 2] *= -1;
      }
      posAttr.needsUpdate = true;

      // Update line connections
      let lineIndex = 0;
      const linePosArray = lineGeometry.getAttribute("position").array as Float32Array;
      const lineColArray = lineGeometry.getAttribute("color").array as Float32Array;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        for (let j = i + 1; j < PARTICLE_COUNT; j++) {
          const i3 = i * 3;
          const j3 = j * 3;

          const dx = posArray[i3] - posArray[j3];
          const dy = posArray[i3 + 1] - posArray[j3 + 1];
          const dz = posArray[i3 + 2] - posArray[j3 + 2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < CONNECT_DISTANCE && lineIndex < MAX_LINES) {
            const lIdx = lineIndex * 6;
            linePosArray[lIdx] = posArray[i3];
            linePosArray[lIdx + 1] = posArray[i3 + 1];
            linePosArray[lIdx + 2] = posArray[i3 + 2];

            linePosArray[lIdx + 3] = posArray[j3];
            linePosArray[lIdx + 4] = posArray[j3 + 1];
            linePosArray[lIdx + 5] = posArray[j3 + 2];

            const alpha = 1 - dist / CONNECT_DISTANCE;
            const r = tealColor.r * alpha;
            const g = tealColor.g * alpha;
            const b = tealColor.b * alpha;

            lineColArray[lIdx] = r;
            lineColArray[lIdx + 1] = g;
            lineColArray[lIdx + 2] = b;
            lineColArray[lIdx + 3] = r;
            lineColArray[lIdx + 4] = g;
            lineColArray[lIdx + 5] = b;

            lineIndex++;
          }
        }
      }

      lineGeometry.setDrawRange(0, lineIndex * 2);
      (lineGeometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      (lineGeometry.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);
    } catch (err) {
      console.warn("[AmbientBackground3D] Three.js scene initialization error (safely bypassed):", err);
    }

    // Comprehensive Cleanup on Unmount
    return () => {
      try {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (handlePointerMove) window.removeEventListener("mousemove", handlePointerMove);
        if (handleResize) window.removeEventListener("resize", handleResize);
        if (handleVisibilityChange) document.removeEventListener("visibilitychange", handleVisibilityChange);

        if (renderer?.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }

        particleGeometry?.dispose();
        particleMaterial?.dispose();
        particleTexture?.dispose();
        lineGeometry?.dispose();
        lineMaterial?.dispose();
        renderer?.dispose();
      } catch (cleanErr) {
        // Silently ignore cleanup errors
      }
    };
  }, [isReduced, hasHover, isDark]);

  if (isReduced || !isWebGLAvailable()) {
    return null;
  }

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      style={{ opacity }}
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden transition-opacity duration-700 ${className}`}
    />
  );
}
