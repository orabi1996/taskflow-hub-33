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
        {/* Descending ribbon: Deep Teal -> Bright Teal */}
        <linearGradient id={`crmx-teal-desc-${id}`} x1="30" y1="30" x2="170" y2="170" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0F4C5C" />
          <stop offset="65%" stopColor="#00A6A6" />
          <stop offset="100%" stopColor="#22C8B8" />
        </linearGradient>

        {/* Ascending ribbon: Bright Teal -> Mint Accent -> Bright Teal */}
        <linearGradient id={`crmx-teal-asc-${id}`} x1="30" y1="170" x2="170" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00A6A6" />
          <stop offset="45%" stopColor="#7AE7C7" />
          <stop offset="100%" stopColor="#00A6A6" />
        </linearGradient>

        {/* Overlapping intersection shadow/glow facet */}
        <linearGradient id={`crmx-facet-${id}`} x1="80" y1="80" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0F4C5C" stopOpacity="0.4" />
          <stop offset="50%" stopColor="#7AE7C7" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#00A6A6" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      {/* Descending Arm (Top-Left to Bottom-Right) */}
      <line
        x1="52"
        y1="46"
        x2="148"
        y2="154"
        stroke={`url(#crmx-teal-desc-${id})`}
        strokeWidth="38"
        strokeLinecap="round"
      />

      {/* Ascending Arm (Bottom-Left to Top-Right) with 3D overlapping transparency */}
      <line
        x1="52"
        y1="154"
        x2="148"
        y2="46"
        stroke={`url(#crmx-teal-asc-${id})`}
        strokeWidth="38"
        strokeLinecap="round"
      />

      {/* Intersection Translucent Fold Highlight */}
      <path
        d="M 82 82 L 118 82 L 118 118 L 82 118 Z"
        fill={`url(#crmx-facet-${id})`}
        style={{ mixBlendMode: "screen" }}
        opacity="0.75"
      />
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
