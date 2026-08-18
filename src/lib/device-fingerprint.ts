// Lightweight, stable-ish browser fingerprint (NOT cryptographic; used only as a recognition aid).
export async function computeDeviceHash(): Promise<string> {
  if (typeof window === "undefined") return "ssr";
  const parts = [
    navigator.userAgent,
    navigator.language,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    new Date().getTimezoneOffset().toString(),
    (navigator as Navigator & { hardwareConcurrency?: number }).hardwareConcurrency?.toString() ?? "",
  ];
  const text = parts.join("|");
  if (window.crypto?.subtle) {
    const buf = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback: simple hash
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return `f${(h >>> 0).toString(16)}`;
}
