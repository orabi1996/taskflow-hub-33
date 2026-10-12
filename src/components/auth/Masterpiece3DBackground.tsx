import React, { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { useReducedMotion } from "@/lib/motion";

export type AtmosphereMode = "aurora" | "sunset" | "night" | "emerald";

export interface AtmosphereTheme {
  id: AtmosphereMode;
  name: string;
  badge: string;
  primaryColor: string;
  glowColor: string;
  accentColor: string;
  bgColor: string;
  fogColor: string;
}

export const ATMOSPHERE_PRESETS: AtmosphereTheme[] = [
  {
    id: "aurora",
    name: "أورورا الخليج",
    badge: "حيوي",
    primaryColor: "#00A6A6",
    glowColor: "#7AE7C7",
    accentColor: "#2DD4BF",
    bgColor: "#041B22",
    fogColor: "#021217",
  },
  {
    id: "night",
    name: "سماء العواصم",
    badge: "ساحر",
    primaryColor: "#0284C7",
    glowColor: "#38BDF8",
    accentColor: "#818CF8",
    bgColor: "#030B17",
    fogColor: "#020710",
  },
  {
    id: "sunset",
    name: "شفق الذهب",
    badge: "أصيل",
    primaryColor: "#D97706",
    glowColor: "#FBBF24",
    accentColor: "#F43F5E",
    bgColor: "#1A0B05",
    fogColor: "#120603",
  },
  {
    id: "emerald",
    name: "واحة الزمرد",
    badge: "فاخر",
    primaryColor: "#059669",
    glowColor: "#34D399",
    accentColor: "#6EE7B7",
    bgColor: "#021811",
    fogColor: "#010F0A",
  },
];

interface Masterpiece3DBackgroundProps {
  mode?: AtmosphereMode;
  onModeChange?: (mode: AtmosphereMode) => void;
  typingEnergy?: number;
}

/**
 * Creates a circular glowing particle texture with soft falloff
 */
function createParticleTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2
  );
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.2, "rgba(255, 255, 255, 0.85)");
  gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.25)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function Masterpiece3DBackground({
  mode = "aurora",
  typingEnergy = 0,
}: Masterpiece3DBackgroundProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const isReduced = useReducedMotion();
  const theme = useMemo(() => ATMOSPHERE_PRESETS.find(p => p.id === mode) || ATMOSPHERE_PRESETS[0], [mode]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container || typeof window === "undefined") return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(theme.fogColor, 0.028);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.set(0, 4, 18);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      powerPreference: "high-performance",
      antialias: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    const isMobile = window.innerWidth < 768;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // 2. Wave Surface Particles Grid (The Living Digital Horizon)
    const particleTex = createParticleTexture();
    const gridW = 56;
    const gridH = 40;
    const segX = isMobile ? 55 : 85;
    const segY = isMobile ? 40 : 60;
    const waveGeo = new THREE.PlaneGeometry(gridW, gridH, segX, segY);
    waveGeo.rotateX(-Math.PI * 0.44); // Tilt ground plane back

    const originalPositions = waveGeo.attributes.position.clone();

    // Wave point cloud material
    const waveMat = new THREE.PointsMaterial({
      color: new THREE.Color(theme.primaryColor),
      size: isMobile ? 0.45 : 0.55,
      map: particleTex,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const wavePoints = new THREE.Points(waveGeo, waveMat);
    wavePoints.position.set(0, -3.5, -4);
    scene.add(wavePoints);

    // Translucent wireframe terrain underneath for architectural grid feel
    const wireMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(theme.glowColor),
      wireframe: true,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
    });
    const waveMesh = new THREE.Mesh(waveGeo, wireMat);
    waveMesh.position.copy(wavePoints.position);
    scene.add(waveMesh);

    // 3. Deep Floating Space Nebula Stars
    const starCount = isMobile ? 120 : 250;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starVel = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 50;
      starPos[i * 3 + 1] = Math.random() * 25 - 4;
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 30 - 5;

      starVel[i * 3] = (Math.random() - 0.5) * 0.003;
      starVel[i * 3 + 1] = Math.random() * 0.006 + 0.002;
      starVel[i * 3 + 2] = (Math.random() - 0.5) * 0.003;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));

    const starMat = new THREE.PointsMaterial({
      color: new THREE.Color(theme.glowColor),
      size: 0.8,
      map: particleTex,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const starPoints = new THREE.Points(starGeo, starMat);
    scene.add(starPoints);

    // 4. Floating 3D Geometric Arabian Facet Crystals
    const crystalGeo = new THREE.IcosahedronGeometry(0.9, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(theme.accentColor),
      roughness: 0.15,
      metalness: 0.85,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    });

    const crystals: THREE.Mesh[] = [];
    const crystalCount = isMobile ? 4 : 8;
    for (let i = 0; i < crystalCount; i++) {
      const mesh = new THREE.Mesh(crystalGeo, crystalMat);
      mesh.position.set(
        (Math.random() - 0.5) * 36,
        Math.random() * 16 - 2,
        (Math.random() - 0.5) * 16 - 2
      );
      mesh.scale.setScalar(Math.random() * 0.7 + 0.6);
      scene.add(mesh);
      crystals.push(mesh);
    }

    // 5. Ambient & Point Lighting
    const ambientLight = new THREE.AmbientLight(new THREE.Color(theme.bgColor), 1.6);
    scene.add(ambientLight);

    const keyLight = new THREE.PointLight(new THREE.Color(theme.glowColor), 3.5, 45);
    keyLight.position.set(0, 10, 10);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(new THREE.Color(theme.accentColor), 2.8, 35);
    rimLight.position.set(-15, -4, 5);
    scene.add(rimLight);

    // 6. Mouse Tracking & Parallax
    let mouseX = 0;
    let mouseY = 0;
    let targetCamX = 0;
    let targetCamY = 4;

    const handleMouseMove = (e: MouseEvent) => {
      const normX = (e.clientX / window.innerWidth) * 2 - 1;
      const normY = -(e.clientY / window.innerHeight) * 2 + 1;
      mouseX = normX;
      mouseY = normY;
      targetCamX = normX * 2.8;
      targetCamY = 4 + normY * 1.5;
    };

    if (window.matchMedia("(pointer: fine)").matches) {
      window.addEventListener("mousemove", handleMouseMove, { passive: true });
    }

    // 7. Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // 8. Visibility & Observer Pause Logic
    let isVisible = true;
    const handleVisibility = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting && !document.hidden;
    });
    observer.observe(container);

    // 9. Render Loop
    let clock = new THREE.Clock();
    const posAttr = waveGeo.attributes.position;
    const origPosArr = originalPositions.array as Float32Array;
    const curPosArr = posAttr.array as Float32Array;

    const animate = () => {
      if (!isVisible) return;

      const elapsed = clock.getElapsedTime();
      const speed = isReduced ? 0 : 0.85 + typingEnergy * 1.2;

      if (!isReduced) {
        // Camera smooth dampening
        camera.position.x += (targetCamX - camera.position.x) * 0.04;
        camera.position.y += (targetCamY - camera.position.y) * 0.04;
        camera.rotation.z = -camera.position.x * 0.015;
        camera.lookAt(0, 0, 0);

        // Fluid Wave mathematical displacement
        const vCount = posAttr.count;
        for (let i = 0; i < vCount; i++) {
          const ox = origPosArr[i * 3];
          const oy = origPosArr[i * 3 + 1];

          // Compound harmonic waves with mouse crater influence
          const distToMouse = Math.hypot(ox - mouseX * 20, oy - mouseY * 15);
          const mouseRipple = Math.sin(distToMouse * 0.6 - elapsed * 3) * Math.exp(-distToMouse * 0.12) * 1.2;

          const z =
            Math.sin(ox * 0.22 + elapsed * speed) * 1.6 +
            Math.cos(oy * 0.28 + elapsed * speed * 0.8) * 1.2 +
            Math.sin((ox + oy) * 0.14 + elapsed * speed * 1.2) * 0.7 +
            mouseRipple;

          curPosArr[i * 3 + 2] = z;
        }
        posAttr.needsUpdate = true;

        // Floating stars upward drift
        const sArr = starGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < starCount; i++) {
          sArr[i * 3 + 1] += starVel[i * 3 + 1];
          if (sArr[i * 3 + 1] > 22) sArr[i * 3 + 1] = -5;
        }
        starGeo.attributes.position.needsUpdate = true;

        // Crystals rotation
        for (let i = 0; i < crystals.length; i++) {
          const c = crystals[i];
          c.rotation.x += 0.005 * (i % 2 === 0 ? 1 : -1);
          c.rotation.y += 0.008;
          c.position.y += Math.sin(elapsed * 1.2 + i) * 0.005;
        }
      }

      renderer.render(scene, camera);
    };

    renderer.setAnimationLoop(animate);

    // 10. Memory & Resource Cleanup
    return () => {
      renderer.setAnimationLoop(null);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      observer.disconnect();

      waveGeo.dispose();
      waveMat.dispose();
      wireMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      crystalGeo.dispose();
      crystalMat.dispose();
      particleTex.dispose();
      renderer.dispose();

      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, [theme, isReduced, typingEnergy]);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden transition-colors duration-1000"
      style={{
        background: `radial-gradient(circle at 50% 20%, ${theme.bgColor} 0%, #010609 100%)`,
      }}
    />
  );
}
