import React from "react";

interface CrmXLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

/**
 * CRM-X Iconic "X" Ribbon Emblem
 * Exact geometric reproduction of the Modern Teal Brand Exploration emblem.
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
      {...props}
    >
      <defs>
        {/* Swirl Blade Gradient: Vivid Ocean Cyan to Deep Blue */}
        <linearGradient id={`crmx-swirl-grad-${id}`} x1="30" y1="20" x2="170" y2="150" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="45%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#0369A1" />
        </linearGradient>

        {/* Bottom Capsule Pill Gradient */}
        <linearGradient id={`crmx-pill-grad-${id}`} x1="85" y1="150" x2="115" y2="165" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E2E8F0" />
          <stop offset="50%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>
      </defs>

      {/* 3-Blade Vortex Swirl (Symmetric 120-degree Rotations) */}
      <g transform="translate(0, -4)">
        {/* Blade 1 (0 deg) */}
        <path
          d="M 100 24 C 128 24 152 44 150 72 C 148 94 132 110 114 112 C 125 101 130 86 126 70 C 121 54 111 40 100 34 Z"
          fill={`url(#crmx-swirl-grad-${id})`}
          transform="rotate(0, 100, 82)"
        />
        {/* Blade 2 (120 deg) */}
        <path
          d="M 100 24 C 128 24 152 44 150 72 C 148 94 132 110 114 112 C 125 101 130 86 126 70 C 121 54 111 40 100 34 Z"
          fill={`url(#crmx-swirl-grad-${id})`}
          transform="rotate(120, 100, 82)"
        />
        {/* Blade 3 (240 deg) */}
        <path
          d="M 100 24 C 128 24 152 44 150 72 C 148 94 132 110 114 112 C 125 101 130 86 126 70 C 121 54 111 40 100 34 Z"
          fill={`url(#crmx-swirl-grad-${id})`}
          transform="rotate(240, 100, 82)"
        />
      </g>

      {/* Bottom Horizontal Capsule Accent */}
      <rect x="86" y="156" width="28" height="9" rx="4.5" fill={`url(#crmx-pill-grad-${id})`} />
    </svg>
  );
}

/**
 * CRM-X App Icon (Squircle / Rounded Square with Deep Teal background and Glowing X)
 */
export function CrmXAppIcon({ size = 48, className = "", rounded = "rounded-2xl" }: { size?: number | string; className?: string; rounded?: string }) {
  return (
    <div
      style={{ width: size, height: size, backgroundColor: "#0F4C5C" }}
      className={`inline-flex items-center justify-center shadow-md p-1.5 transition-transform hover:scale-105 ${rounded} ${className}`}
    >
      <CrmXEmblem size="82%" className="drop-shadow-sm" />
    </div>
  );
}

interface CrmXFullLogoProps {
  variant?: "horizontal" | "stacked" | "icon-only";
  showTagline?: boolean;
  taglineText?: string;
  className?: string;
  theme?: "light" | "dark" | "auto";
  iconSize?: number;
}

/**
 * Full CRM-X Corporate Brand Logo Component
 * Supports Horizontal Lockup, Stacked Logo, and Taglines.
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
      ? "text-[#0F4C5C]"
      : theme === "dark"
      ? "text-white"
      : "text-[#0F4C5C] dark:text-white";

  const taglineColor =
    theme === "light"
      ? "text-[#00A6A6]/80"
      : theme === "dark"
      ? "text-teal-200/80"
      : "text-[#00A6A6]/80 dark:text-teal-300/80";

  if (variant === "stacked") {
    return (
      <div className={`inline-flex flex-col items-center text-center gap-2 ${className}`}>
        <CrmXEmblem size={iconSize || 64} className="hover:scale-105 transition-transform" />
        <div className="flex flex-col items-center">
          <div className="flex items-center tracking-tight font-black text-2xl font-sans">
            <span className={textColor}>CRM</span>
            <span className="text-[#00A6A6] mx-0.5">-</span>
            <span className="bg-gradient-to-r from-[#00A6A6] to-[#7AE7C7] bg-clip-text text-transparent">X</span>
          </div>
          {showTagline && (
            <span className={`text-[9px] font-semibold tracking-[0.2em] uppercase mt-0.5 ${taglineColor}`}>
              {taglineText}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Default: Horizontal
  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <CrmXEmblem size={iconSize || 42} className="hover:scale-105 transition-transform" />
      <div className="flex flex-col justify-center leading-none">
        <div className="flex items-center tracking-tight font-black text-2xl font-sans">
          <span className={textColor}>CRM</span>
          <span className="text-[#00A6A6] mx-0.5">-</span>
          <span className="bg-gradient-to-r from-[#00A6A6] to-[#7AE7C7] bg-clip-text text-transparent">X</span>
        </div>
        {showTagline && (
          <span className={`text-[8.5px] font-bold tracking-[0.18em] uppercase mt-1 ${taglineColor}`}>
            {taglineText}
          </span>
        )}
      </div>
    </div>
  );
}

export default CrmXLogo;
