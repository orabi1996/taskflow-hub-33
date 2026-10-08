import React from "react";
import logoAsset from "@/assets/sysmarkx-logo.png.asset.json";

interface CrmXLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  size?: number | string;
  className?: string;
}

/**
 * Sysmarkx / CRM-X Brand Emblem — the official uploaded logo mark.
 * Resilient fallback to local /icon-192.png and /favicon.png if proxy is unavailable.
 */
export function CrmXEmblem({ size = 48, className = "", ...props }: CrmXLogoProps) {
  const [imgSrc, setImgSrc] = React.useState<string>(
    (logoAsset as any)?.url || "/icon-192.png"
  );

  return (
    <img
      src={imgSrc}
      alt="CRM-X"
      width={size}
      height={size}
      onError={() => {
        if (imgSrc !== "/icon-192.png") {
          setImgSrc("/icon-192.png");
        } else {
          setImgSrc("/favicon.png");
        }
      }}
      style={{ width: size, height: size, objectFit: "contain" }}
      className={`shrink-0 ${className}`}
      {...props}
    />
  );
}

/**
 * CRM-X App Icon Badge (Deep dark circular badge with official emblem)
 */
export function CrmXAppIcon({
  size = 48,
  className = "",
  rounded = "rounded-full",
}: {
  size?: number | string;
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      style={{ width: size, height: size, backgroundColor: "#042F2E" }}
      className={`inline-flex items-center justify-center shadow-md p-1.5 transition-transform hover:scale-105 shrink-0 ${rounded} ${className}`}
    >
      <CrmXEmblem size="80%" className="drop-shadow-sm" />
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
 * Guaranteed LTR text ordering ("CRM-X", never inverted to "X-CRM" in RTL environments).
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
      ? "text-[#00A6A6]"
      : theme === "dark"
      ? "text-teal-300"
      : "text-[#00A6A6] dark:text-teal-300";

  if (variant === "stacked") {
    return (
      <div className={`inline-flex flex-col items-center text-center gap-2 select-none ${className}`}>
        <CrmXEmblem size={iconSize || 64} className="hover:scale-105 transition-transform" />
        <div className="flex flex-col items-center">
          <div dir="ltr" className="inline-flex items-center tracking-tight font-black text-2xl font-sans">
            <span className={textColor}>CRM</span>
            <span className="text-[#00A6A6] mx-0.5">-</span>
            <span className="bg-gradient-to-r from-[#00A6A6] to-[#7AE7C7] bg-clip-text text-transparent">X</span>
          </div>
          {showTagline && (
            <span className={`text-[9px] font-bold tracking-[0.2em] uppercase mt-0.5 ${taglineColor}`}>
              {taglineText}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Default: Horizontal Lockup
  // Note: dir="ltr" on the text container guarantees "CRM-X" is never inverted to "X-CRM" in RTL mode
  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <CrmXEmblem size={iconSize || 42} className="hover:scale-105 transition-transform" />
      <div className="flex flex-col justify-center leading-none text-start">
        <div dir="ltr" className="inline-flex items-center tracking-tight font-black text-2xl font-sans">
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
