import React from "react";

export interface CrmXLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

/**
 * CRM-X Iconic "X" Ribbon Emblem
 * World-class vector artwork: aerodynamic crossed ribbons with 3D overlap,
 * ambient aura, and crystalline facet core.
 * Completely transparent background — renders flawlessly on light and dark surfaces.
 */
export function CrmXEmblem({ size = 48, className = "", ...props }: CrmXLogoProps) {
  const id = React.useId().replace(/:/g, "");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-label="CRM-X Emblem"
      {...props}
    >
      <defs>
        {/* Descending Ribbon: Deep Ocean Teal -> Signature Cyan -> Electric Mint */}
        <linearGradient id={`crmx-desc-${id}`} x1="40" y1="40" x2="160" y2="160" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0F4C5C" />
          <stop offset="50%" stopColor="#00A6A6" />
          <stop offset="100%" stopColor="#2DD4BF" />
        </linearGradient>

        {/* Ascending Ribbon: Vivid Cerulean -> Signature Teal -> Luminous Aqua */}
        <linearGradient id={`crmx-asc-${id}`} x1="40" y1="160" x2="160" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0284C7" />
          <stop offset="50%" stopColor="#00A6A6" />
          <stop offset="100%" stopColor="#7AE7C7" />
        </linearGradient>

        {/* Center Intersecting Crystal Facet Highlight */}
        <linearGradient id={`crmx-facet-${id}`} x1="82" y1="82" x2="118" y2="118" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="50%" stopColor="#7AE7C7" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#00A6A6" stopOpacity="0.2" />
        </linearGradient>

        {/* Soft 3D Drop Shadow for the overlapping ribbon */}
        <filter id={`crmx-shadow-${id}`} x="-20%" y="-20%" width="150%" height="150%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#042F2E" floodOpacity="0.4" />
        </filter>

        {/* Soft Ambient Glow */}
        <radialGradient id={`crmx-aura-${id}`} cx="100" cy="100" r="75" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00A6A6" stopOpacity="0.22" />
          <stop offset="60%" stopColor="#00A6A6" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#00A6A6" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ambient Aura */}
      <circle cx="100" cy="100" r="70" fill={`url(#crmx-aura-${id})`} />

      {/* Descending Ribbon (Passes Underneath) */}
      <line
        x1="50"
        y1="48"
        x2="150"
        y2="152"
        stroke={`url(#crmx-desc-${id})`}
        strokeWidth="36"
        strokeLinecap="round"
      />

      {/* Ascending Ribbon (Passes Over with 3D drop shadow) */}
      <g filter={`url(#crmx-shadow-${id})`}>
        <line
          x1="50"
          y1="152"
          x2="150"
          y2="48"
          stroke={`url(#crmx-asc-${id})`}
          strokeWidth="36"
          strokeLinecap="round"
        />
      </g>

      {/* Overlap Intersection Crystal Facet */}
      <path
        d="M 100 82 L 118 100 L 100 118 L 82 100 Z"
        fill={`url(#crmx-facet-${id})`}
      />

      {/* Specular Lens Sparkle */}
      <circle cx="100" cy="100" r="3.5" fill="#FFFFFF" opacity="0.95" />
    </svg>
  );
}

/**
 * CRM-X App Icon Badge (Rounded Squircle / Capsule with Dark Teal background and Glowing Emblem)
 * Ideal for collapsed sidebars, mobile launchers, and PWA representations.
 */
export function CrmXAppIcon({
  size = 48,
  className = "",
  rounded = "rounded-2xl",
}: {
  size?: number | string;
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, #031E1D 0%, #042F2E 50%, #0A3F3B 100%)",
      }}
      className={`inline-flex items-center justify-center shadow-md p-1.5 transition-transform hover:scale-105 shrink-0 border border-teal-500/25 ${rounded} ${className}`}
    >
      <CrmXEmblem size="80%" className="drop-shadow-sm" />
    </div>
  );
}

export interface CrmXFullLogoProps {
  variant?: "horizontal" | "stacked" | "icon-only";
  showTagline?: boolean;
  taglineText?: string;
  className?: string;
  theme?: "light" | "dark" | "auto";
  iconSize?: number;
}

/**
 * Full CRM-X Corporate Brand Logo Component
 * Guaranteed LTR lockup ("CRM-X", never inverted to "X-CRM" even inside RTL pages).
 * Transparent, pixel-perfect, scalable on all displays.
 */
export function CrmXLogo({
  variant = "horizontal",
  showTagline = true,
  taglineText = "PEOPLE · PIPELINES · POSSIBILITIES",
  className = "",
  theme = "auto",
  iconSize,
}: CrmXFullLogoProps) {
  if (variant === "icon-only") {
    return <CrmXEmblem size={iconSize || 42} className={className} />;
  }

  const textColor =
    theme === "light"
      ? "text-slate-900"
      : theme === "dark"
      ? "text-white"
      : "text-slate-900 dark:text-white";

  const taglineColor =
    theme === "light"
      ? "text-[#00A6A6]"
      : theme === "dark"
      ? "text-teal-300"
      : "text-[#00A6A6] dark:text-teal-300";

  if (variant === "stacked") {
    return (
      <div dir="ltr" className={`inline-flex flex-col items-center text-center gap-2 select-none ${className}`}>
        <CrmXEmblem size={iconSize || 56} className="hover:scale-105 transition-transform shrink-0" />
        <div className="flex flex-col items-center">
          <div className="inline-flex items-center tracking-tight font-black text-2xl font-sans">
            <span className={textColor}>CRM</span>
            <span className="text-[#00A6A6] mx-0.5">-</span>
            <span className="bg-gradient-to-r from-[#00A6A6] via-[#20C997] to-[#7AE7C7] bg-clip-text text-transparent">
              X
            </span>
          </div>
          {showTagline && (
            <span className={`text-[8.5px] font-bold tracking-[0.22em] uppercase mt-1 ${taglineColor}`}>
              {taglineText}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Default: Horizontal Lockup
  // dir="ltr" guarantees standard left-to-right order: [Emblem] [CRM-X] in all languages
  return (
    <div dir="ltr" className={`inline-flex items-center gap-3.5 select-none ${className}`}>
      <CrmXEmblem size={iconSize || 40} className="hover:scale-105 transition-transform shrink-0" />
      <div className="flex flex-col justify-center leading-none text-left">
        <div className="inline-flex items-center tracking-tight font-black text-2xl font-sans">
          <span className={textColor}>CRM</span>
          <span className="text-[#00A6A6] mx-0.5">-</span>
          <span className="bg-gradient-to-r from-[#00A6A6] via-[#20C997] to-[#7AE7C7] bg-clip-text text-transparent">
            X
          </span>
        </div>
        {showTagline && (
          <span className={`text-[8px] sm:text-[8.5px] font-bold tracking-[0.22em] uppercase mt-1.5 ${taglineColor}`}>
            {taglineText}
          </span>
        )}
      </div>
    </div>
  );
}

export default CrmXLogo;
