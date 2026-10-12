import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { type SkylineSceneId } from "./AuthSkylineSwitcher";
import { useReducedMotion } from "@/lib/motion";

interface ThreeLivingAtmosphereProps {
  scene: SkylineSceneId;
  isDarkTheme?: boolean;
}

/**
 * Procedural circular glow texture for soft 3D particle motes
 * Avoids any external network requests and produces crisp alpha blending
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
  gradient.addColorStop(0.25, "rgba(255, 255, 255, 0.7)");
  gradient.addColorStop(0.55, "rgba(255, 255, 255, 0.2)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function ThreeLivingAtmosphere({ scene, isDarkTheme }: ThreeLivingAtmosphereProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const isReduced = useReducedMotion();

  // Color theme parameters based on active skyline scene
  const sceneColors = React.useMemo(() => {
    const isNight = isDarkTheme || scene === "night";
    if (isNight) {
      return {
        particleColor: new THREE.Color("#38bdf8"), // Sky cyan
        ambientColor: new THREE.Color("#0f172a"),
        accentColor: new THREE.Color("#2dd4bf"),  // Mint
        crystalColor: new THREE.Color("#0284c7"),
        particleCount: 140,
      };
    }
    if (scene.startsWith("sunset")) {
      return {
        particleColor: new THREE.Color("#f59e0b"), // Golden amber
        ambientColor: new THREE.Color("#1c1917"),
        accentColor: new THREE.Color("#f97316"),  // Orange
        crystalColor: new THREE.Color("#fbbf24"),
        particleCount: 130,
      };
    }
    return {
      particleColor: new THREE.Color("#0d9488"),   // Teal
      ambientColor: new THREE.Color("#f8fafc"),
      accentColor: new THREE.Color("#14b8a6"),
      crystalColor: new THREE.Color("#0f766e"),
      particleCount: 110,
    };
  }, [scene, isDarkTheme]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container || typeof window === "undefined") return;

    // 1. Scene, Camera, Renderer Setup
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const sceneObj = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
    camera.position.z = 24;

    const renderer = new THREE.WebGLRenderer({
      powerPreference: "high-performance",
      antialias: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // 2. Texture & Particle System
    const particleTex = createParticleTexture();
    const particleCount = sceneColors.particleCount;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);
    const velocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 24;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 16;

      scales[i] = Math.random() * 0.8 + 0.3;

      velocities[i * 3] = (Math.random() - 0.5) * 0.003;
      velocities[i * 3 + 1] = Math.random() * 0.004 + 0.002; // Gentle upward drift
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.002;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("scale", new THREE.BufferAttribute(scales, 1));

    const particleMaterial = new THREE.PointsMaterial({
      color: sceneColors.particleColor,
      size: 1.2,
      map: particleTex,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, particleMaterial);
    sceneObj.add(particles);

    // 3. Floating Crystalline Geometric Facet Shapes (Arabesque Motif)
    const crystalGeo = new THREE.OctahedronGeometry(0.85, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: sceneColors.crystalColor,
      roughness: 0.2,
      metalness: 0.85,
      transparent: true,
      opacity: 0.45,
      wireframe: true,
    });

    const crystalCount = 8;
    const crystals: THREE.Mesh[] = [];
    for (let i = 0; i < crystalCount; i++) {
      const mesh = new THREE.Mesh(crystalGeo, crystalMat);
      mesh.position.set(
        (Math.random() - 0.5) * 32,
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 10
      );
      mesh.scale.setScalar(Math.random() * 0.8 + 0.5);
      sceneObj.add(mesh);
      crystals.push(mesh);
    }

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(sceneColors.ambientColor, 1.2);
    sceneObj.add(ambientLight);

    const pointLight = new THREE.PointLight(sceneColors.accentColor, 2.5, 40);
    pointLight.position.set(5, 5, 8);
    sceneObj.add(pointLight);

    // 5. Parallax Cursor Tracking
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    const onMouseMove = (e: MouseEvent) => {
      targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetMouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    if (window.matchMedia("(pointer: fine)").matches) {
      window.addEventListener("mousemove", onMouseMove, { passive: true });
    }

    // 6. Resize Handling
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // 7. Render Loop with Visibility & Reduced-Motion Checks
    let isVisible = true;
    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting && !document.hidden;
    });
    intersectionObserver.observe(container);

    let clock = new THREE.Clock();

    const animate = () => {
      if (!isVisible) return;

      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      if (!isReduced) {
        // Cursor damping
        currentMouseX += (targetMouseX - currentMouseX) * 0.05;
        currentMouseY += (targetMouseY - currentMouseY) * 0.05;

        camera.position.x = currentMouseX * 1.5;
        camera.position.y = -currentMouseY * 1.2;
        camera.lookAt(0, 0, 0);

        // Particle subtle drift
        const posAttr = geometry.attributes.position;
        const posArr = posAttr.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          posArr[i * 3 + 1] += velocities[i * 3 + 1]; // Move upwards
          posArr[i * 3] += Math.sin(time * 0.5 + i) * 0.003;

          // Wrap boundaries
          if (posArr[i * 3 + 1] > 12) posArr[i * 3 + 1] = -12;
          if (posArr[i * 3] > 20) posArr[i * 3] = -20;
          if (posArr[i * 3] < -20) posArr[i * 3] = 20;
        }
        posAttr.needsUpdate = true;

        // Animate crystals
        for (let i = 0; i < crystals.length; i++) {
          const c = crystals[i];
          c.rotation.x += 0.004 * (i % 2 === 0 ? 1 : -1);
          c.rotation.y += 0.006;
          c.position.y += Math.sin(time * 0.8 + i) * 0.004;
        }
      }

      renderer.render(sceneObj, camera);
    };

    renderer.setAnimationLoop(animate);

    // 8. Cleanup
    return () => {
      renderer.setAnimationLoop(null);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      intersectionObserver.disconnect();

      geometry.dispose();
      particleMaterial.dispose();
      particleTex.dispose();
      crystalGeo.dispose();
      crystalMat.dispose();
      renderer.dispose();

      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, [sceneColors, isReduced]);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className="absolute inset-0 z-[2] pointer-events-none overflow-hidden"
    />
  );
}
