import { useEffect, useRef } from "react";
import { toast } from "sonner";

const EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "visibilitychange"];

/**
 * تسجيل خروج تلقائي عند الخمول لحماية الجلسة.
 * @param onIdle يُستدعى عند انتهاء المهلة
 * @param minutes مدة الخمول بالدقائق
 * @param warnBeforeSeconds تنبيه قبل الخروج بعدد ثوانٍ
 */
export function useIdleLogout(onIdle: () => void, minutes = 30, warnBeforeSeconds = 60) {
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cb = useRef(onIdle);
  cb.current = onIdle;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (minutes <= 0) return;

    const ms = minutes * 60_000;

    const reset = () => {
      if (idleRef.current) clearTimeout(idleRef.current);
      if (warnRef.current) clearTimeout(warnRef.current);
      warnRef.current = setTimeout(
        () => toast.warning("سيتم تسجيل خروجك تلقائيًا خلال دقيقة بسبب عدم النشاط"),
        Math.max(ms - warnBeforeSeconds * 1000, 1000),
      );
      idleRef.current = setTimeout(() => cb.current(), ms);
    };

    reset();
    EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, reset));
      if (idleRef.current) clearTimeout(idleRef.current);
      if (warnRef.current) clearTimeout(warnRef.current);
    };
  }, [minutes, warnBeforeSeconds]);
}
