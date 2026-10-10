import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const cwd = process.cwd();

// 1. Transparent Emblem SVG (used directly in CrmXLogo & favicon.svg)
export const EMBLEM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">
  <defs>
    <!-- Descending Ribbon: Deep Teal -> Signature Cyan -> Electric Mint -->
    <linearGradient id="crmx-desc" x1="40" y1="40" x2="160" y2="160" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0F4C5C" />
      <stop offset="50%" stop-color="#00A6A6" />
      <stop offset="100%" stop-color="#2DD4BF" />
    </linearGradient>

    <!-- Ascending Ribbon: Vivid Cerulean -> Vibrant Teal -> Luminous Aqua -->
    <linearGradient id="crmx-asc" x1="40" y1="160" x2="160" y2="40" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0284C7" />
      <stop offset="50%" stop-color="#00A6A6" />
      <stop offset="100%" stop-color="#7AE7C7" />
    </linearGradient>

    <!-- Core Facet Glow -->
    <linearGradient id="crmx-facet" x1="82" y1="82" x2="118" y2="118" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9" />
      <stop offset="50%" stop-color="#7AE7C7" stop-opacity="0.75" />
      <stop offset="100%" stop-color="#00A6A6" stop-opacity="0.2" />
    </linearGradient>

    <!-- Realistic drop shadow for the overlapping ribbon -->
    <filter id="crmx-shadow" x="-20%" y="-20%" width="150%" height="150%">
      <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#042F2E" flood-opacity="0.4" />
    </filter>

    <!-- Soft ambient aura -->
    <radialGradient id="crmx-aura" cx="100" cy="100" r="75" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#00A6A6" stop-opacity="0.25" />
      <stop offset="60%" stop-color="#00A6A6" stop-opacity="0.08" />
      <stop offset="100%" stop-color="#00A6A6" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- Ambient Backlight -->
  <circle cx="100" cy="100" r="70" fill="url(#crmx-aura)" />

  <!-- Descending Ribbon (Passes Underneath) -->
  <line
    x1="50"
    y1="48"
    x2="150"
    y2="152"
    stroke="url(#crmx-desc)"
    stroke-width="36"
    stroke-linecap="round"
  />

  <!-- Ascending Ribbon (Passes Over with 3D drop shadow) -->
  <g filter="url(#crmx-shadow)">
    <line
      x1="50"
      y1="152"
      x2="150"
      y2="48"
      stroke="url(#crmx-asc)"
      stroke-width="36"
      stroke-linecap="round"
    />
  </g>

  <!-- Overlap Intersection Crystal Facet -->
  <path
    d="M 100 82 L 118 100 L 100 118 L 82 100 Z"
    fill="url(#crmx-facet)"
  />

  <!-- Center Specular Highlight -->
  <circle cx="100" cy="100" r="3.5" fill="#FFFFFF" opacity="0.95" />
</svg>`;

// 2. App Icon Badge SVG (used for PWA icons: icon-192, icon-512, and favicon badge)
export const APP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <!-- Luxury Deep Teal Background Gradient -->
    <linearGradient id="badge-bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#031E1D" />
      <stop offset="50%" stop-color="#042F2E" />
      <stop offset="100%" stop-color="#0A3F3B" />
    </linearGradient>

    <!-- Subtle border highlight -->
    <linearGradient id="badge-border" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#2DD4BF" stop-opacity="0.4" />
      <stop offset="100%" stop-color="#00A6A6" stop-opacity="0.1" />
    </linearGradient>

    <!-- Inner Emblem Gradients -->
    <linearGradient id="desc-512" x1="120" y1="120" x2="392" y2="392" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0F4C5C" />
      <stop offset="50%" stop-color="#00A6A6" />
      <stop offset="100%" stop-color="#2DD4BF" />
    </linearGradient>

    <linearGradient id="asc-512" x1="120" y1="392" x2="392" y2="120" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0284C7" />
      <stop offset="50%" stop-color="#00A6A6" />
      <stop offset="100%" stop-color="#7AE7C7" />
    </linearGradient>

    <linearGradient id="facet-512" x1="220" y1="220" x2="292" y2="292" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95" />
      <stop offset="50%" stop-color="#7AE7C7" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#00A6A6" stop-opacity="0.2" />
    </linearGradient>

    <filter id="shadow-512" x="-20%" y="-20%" width="150%" height="150%">
      <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#000000" flood-opacity="0.5" />
    </filter>

    <radialGradient id="aura-512" cx="256" cy="256" r="180" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#00A6A6" stop-opacity="0.35" />
      <stop offset="60%" stop-color="#00A6A6" stop-opacity="0.1" />
      <stop offset="100%" stop-color="#00A6A6" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- Squircle / Rounded Container -->
  <rect x="8" y="8" width="496" height="496" rx="128" fill="url(#badge-bg)" />
  <rect x="8" y="8" width="496" height="496" rx="128" stroke="url(#badge-border)" stroke-width="4" />

  <!-- Ambient Glow -->
  <circle cx="256" cy="256" r="170" fill="url(#aura-512)" />

  <!-- Descending Ribbon -->
  <line
    x1="135"
    y1="130"
    x2="377"
    y2="382"
    stroke="url(#desc-512)"
    stroke-width="88"
    stroke-linecap="round"
  />

  <!-- Ascending Ribbon with Shadow -->
  <g filter="url(#shadow-512)">
    <line
      x1="135"
      y1="382"
      x2="377"
      y2="130"
      stroke="url(#asc-512)"
      stroke-width="88"
      stroke-linecap="round"
    />
  </g>

  <!-- Central Facet -->
  <path
    d="M 256 210 L 302 256 L 256 302 L 210 256 Z"
    fill="url(#facet-512)"
  />

  <!-- Specular Lens Core -->
  <circle cx="256" cy="256" r="9" fill="#FFFFFF" opacity="0.95" />
</svg>`;

async function generate() {
  console.log("Generating brand assets...");

  const publicDir = path.join(cwd, "public");

  // 1. Write public/favicon.svg (pure vector)
  fs.writeFileSync(path.join(publicDir, "favicon.svg"), EMBLEM_SVG, "utf-8");
  console.log("✓ Created public/favicon.svg");

  // 2. Generate public/favicon.png (64x64 transparent emblem)
  await sharp(Buffer.from(EMBLEM_SVG))
    .resize(64, 64)
    .png()
    .toFile(path.join(publicDir, "favicon.png"));
  console.log("✓ Generated public/favicon.png (64x64)");

  // 3. Generate public/icon-192.png (192x192 PWA badge)
  await sharp(Buffer.from(APP_ICON_SVG))
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, "icon-192.png"));
  console.log("✓ Generated public/icon-192.png (192x192)");

  // 4. Generate public/icon-512.png (512x512 PWA badge)
  await sharp(Buffer.from(APP_ICON_SVG))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, "icon-512.png"));
  console.log("✓ Generated public/icon-512.png (512x512)");

  console.log("All brand assets successfully updated!");
}

generate().catch((err) => {
  console.error("Error generating brand assets:", err);
  process.exit(1);
});
