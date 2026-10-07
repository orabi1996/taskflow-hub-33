import React from "react";
import logoAsset from "@/assets/sysmarkx-logo.png.asset.json";

interface CrmXLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  size?: number | string;
  className?: string;
}

/**
 * Sysmarkx Brand Emblem — the official uploaded logo mark.
 */
export function CrmXEmblem({ size = 48, className = "", ...props }: CrmXLogoProps) {
  return (
    <img
      src={logoAsset.url}
      alt="Sysmarkx"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: "contain" }}
      className={`shrink-0 ${className}`}
      {...props}
    />
  );
}

/**
 * Sysmarkx App Icon (Rounded Square with the official emblem)
 */
export function CrmXAppIcon({ size = 48, className = "", rounded = "rounded-2xl" }: { size?: number | string; className?: string; rounded?: string }) {
  return (
    <div
      style={{ width: size, height: size, backgroundColor: "#1A1A1A" }}
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
 * Full Sysmarkx Corporate Brand Logo Component
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
