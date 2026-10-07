import { useEffect, useState, useMemo } from "react";

export type MascotFocusField = "email" | "password" | "forgot" | null;

export interface AuthAiRobotMascotProps {
  focusedField: MascotFocusField;
  emailLength?: number;
  isEmailValid?: boolean;
  showPassword?: boolean;
  capsLock?: boolean;
  isLoading?: boolean;
  isSuccess?: boolean;
  isError?: boolean;
  mode?: "signin" | "forgot";
  greeting?: string;
  className?: string;
}

export function AuthAiRobotMascot({
  focusedField,
  emailLength = 0,
  isEmailValid = false,
  showPassword = false,
  capsLock = false,
  isLoading = false,
  isSuccess = false,
  isError = false,
  mode = "signin",
  greeting = "أهلاً بك",
  className = "",
}: AuthAiRobotMascotProps) {
  // Blinking cycle when idle
  const [isBlinking, setIsBlinking] = useState(false);
  // Head tilt on idle
  const [headTilt, setHeadTilt] = useState(0);

  // Idle blinking interval
  useEffect(() => {
    if (focusedField === "password" || isLoading || isSuccess) return;
    const interval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 220);
    }, 3800);
    return () => clearInterval(interval);
  }, [focusedField, isLoading, isSuccess]);

  // Subtle natural idle head tilt
  useEffect(() => {
    if (focusedField !== null) return;
    const interval = setInterval(() => {
      setHeadTilt((prev) => (prev === 0 ? (Math.random() > 0.5 ? 2.5 : -2.5) : 0));
    }, 4500);
    return () => clearInterval(interval);
  }, [focusedField]);

  // Dynamic pupil offset tracking email typing (LTR text input)
  // Max text length ~ 30 chars -> pupil moves smoothly horizontally
  const pupilTracking = useMemo(() => {
    if (focusedField === "email") {
      const clamped = Math.min(Math.max(emailLength, 0), 28);
      // Map 0..28 to -7px .. +7px
      const x = ((clamped / 28) - 0.5) * 14;
      const y = 3; // Look slightly downwards towards input
      return { x, y };
    }
    if (focusedField === "forgot") {
      return { x: 0, y: 4 };
    }
    return { x: 0, y: 0 };
  }, [focusedField, emailLength]);

  // Mascot expressive speech bubble message
  const speechText = useMemo(() => {
    if (isSuccess) return "تم التحقق بنجاح! مرحباً بعودتك 🚀";
    if (isError) return "بيانات الاعتماد غير متطابقة، حاول مجدداً 🤔";
    if (isLoading) return "جارٍ فحص البصمة وتأمين الدخول... ⚡";
    if (capsLock) return "انتبه: زر Caps Lock مفعّل حالياً ⚠️";

    if (mode === "forgot") {
      return "لا بأس! سنساعدك في استعادة حسابك 🛡️";
    }

    if (focusedField === "password") {
      if (showPassword) {
        return "نظرة سريعة للتأكد؟ لن أنظر، أعدك! 👀";
      }
      return "سأغمض عينيّ للحفاظ على خصوصيتك 🙈";
    }

    if (focusedField === "email") {
      if (isEmailValid) {
        return "صيغة البريد صحيحة ومعتمدة ✨";
      }
      if (emailLength > 0) {
        return "أتابع كتابتك للبريد المؤسسي ✍️";
      }
      return "اكتب بريدك الإلكتروني للبدء 📧";
    }

    return `${greeting}! أنا رفيقك الذكي في CRM-X 👋`;
  }, [
    isSuccess,
    isError,
    isLoading,
    capsLock,
    mode,
    focusedField,
    showPassword,
    isEmailValid,
    emailLength,
    greeting,
  ]);

  // Theme status colors
  const statusGlow = useMemo(() => {
    if (isSuccess) return "rgba(16, 185, 129, 0.85)"; // Emerald
    if (isError) return "rgba(239, 68, 68, 0.85)"; // Red
    if (isLoading) return "rgba(56, 189, 248, 0.85)"; // Cyan blue
    if (focusedField === "password") return "rgba(168, 85, 247, 0.75)"; // Purple
    if (focusedField === "email") return "rgba(20, 184, 166, 0.85)"; // Teal
    return "rgba(13, 148, 136, 0.65)"; // Teal brand
  }, [isSuccess, isError, isLoading, focusedField]);

  // Arm positions:
  // In password mode: hands slide up to cover eyes!
  // In peek mode: right hand peeks to the side
  const isCoveringEyes = focusedField === "password";
  const isPeeking = isCoveringEyes && showPassword;

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      {/* Interactive Floating Speech Bubble */}
      <div
        className="mb-2 max-w-[270px] px-3.5 py-1.5 rounded-2xl text-[11.5px] font-medium leading-snug text-center transition-all duration-300 shadow-md backdrop-blur-md border"
        style={{
          background: "color-mix(in oklab, var(--card, white) 88%, transparent)",
          borderColor: isError
            ? "color-mix(in oklab, var(--destructive) 40%, transparent)"
            : isSuccess
            ? "color-mix(in oklab, #10b981 40%, transparent)"
            : isCoveringEyes
            ? "color-mix(in oklab, #a855f7 40%, transparent)"
            : "color-mix(in oklab, var(--primary) 35%, transparent)",
          color: isError
            ? "var(--destructive)"
            : isSuccess
            ? "#059669"
            : "var(--foreground)",
          boxShadow: `0 6px 18px -6px ${statusGlow}`,
          transform: isCoveringEyes ? "translateY(-2px) scale(1.02)" : "translateY(0) scale(1)",
        }}
      >
        <span>{speechText}</span>
        {/* Small Tail */}
        <div
          className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-b border-r bg-inherit"
          style={{
            borderColor: isError
              ? "color-mix(in oklab, var(--destructive) 40%, transparent)"
              : isSuccess
              ? "color-mix(in oklab, #10b981 40%, transparent)"
              : isCoveringEyes
              ? "color-mix(in oklab, #a855f7 40%, transparent)"
              : "color-mix(in oklab, var(--primary) 35%, transparent)",
          }}
        />
      </div>

      {/* SVG AI Robot Mascot */}
      <div className="relative w-36 h-32 flex items-center justify-center">
        <svg
          viewBox="0 0 220 180"
          className="w-full h-full overflow-visible transition-transform duration-300 ease-out"
          style={{
            transform: `rotate(${headTilt}deg)`,
            filter: "drop-shadow(0 12px 20px rgba(0,0,0,0.12))",
          }}
          aria-hidden="true"
        >
          <defs>
            {/* Robot Body Ceramic Gradient */}
            <linearGradient id="robotBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="60%" stopColor="#f1f5f9" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>

            {/* Dark Metallic Shading */}
            <linearGradient id="robotMetalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#64748b" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>

            {/* High-Gloss Obsidian Glass Visor */}
            <linearGradient id="visorGlassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#031d1c" />
              <stop offset="50%" stopColor="#062e2a" />
              <stop offset="100%" stopColor="#0b3b36" />
            </linearGradient>

            {/* Visor Glare Reflection */}
            <linearGradient id="visorGlareGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
              <stop offset="45%" stopColor="#ffffff" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>

            {/* Glowing LED Eyes Teal / Cyan Gradient */}
            <radialGradient id="cyanEyeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#67e8f9" />
              <stop offset="65%" stopColor="#14b8a6" />
              <stop offset="100%" stopColor="#0d9488" />
            </radialGradient>

            {/* Pulsing Eye Glow Filter */}
            <filter id="neonGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Floating Shadow Below Mascot */}
          <ellipse
            cx="110"
            cy="172"
            rx={isCoveringEyes ? "40" : "48"}
            ry="7"
            fill="black"
            opacity="0.16"
            className="transition-all duration-300"
          />

          {/* ================= ANTENNA ================= */}
          <g>
            {/* Antenna Stem */}
            <path
              d="M 110 36 L 110 18"
              stroke="#64748b"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Antenna Pulsing Orb */}
            <circle
              cx="110"
              cy="16"
              r="7"
              fill={statusGlow}
              filter="url(#neonGlow)"
              className={isLoading ? "animate-ping" : ""}
            />
            <circle cx="110" cy="16" r="4" fill="#ffffff" />
            {/* Thinking / Active rings */}
            {(isLoading || focusedField === "email") && (
              <circle
                cx="110"
                cy="16"
                r="11"
                fill="none"
                stroke={statusGlow}
                strokeWidth="1.5"
                opacity="0.6"
                className="animate-pulse"
              />
            )}
          </g>

          {/* ================= ROBOT TORSO / COLLAR ================= */}
          <g>
            <path
              d="M 75 125 C 75 122, 145 122, 145 125 L 158 160 C 158 166, 62 166, 62 160 Z"
              fill="url(#robotBodyGrad)"
              stroke="#cbd5e1"
              strokeWidth="2"
            />
            {/* Collar Trim */}
            <path
              d="M 86 128 C 96 132, 124 132, 134 128"
              fill="none"
              stroke="#0d9488"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.8"
            />
            {/* Chest Core Indicator Light */}
            <circle
              cx="110"
              cy="148"
              r="4"
              fill={statusGlow}
              filter="url(#neonGlow)"
            />
          </g>

          {/* ================= ROBOT HEAD ================= */}
          <g id="robot-head">
            {/* Head Body Shell */}
            <rect
              x="54"
              y="34"
              width="112"
              height="94"
              rx="34"
              ry="34"
              fill="url(#robotBodyGrad)"
              stroke="#94a3b8"
              strokeWidth="2"
            />

            {/* Left Ear Sensor */}
            <rect
              x="44"
              y="68"
              width="12"
              height="26"
              rx="5"
              fill="url(#robotMetalGrad)"
              stroke="#64748b"
              strokeWidth="1"
            />
            <circle
              cx="48"
              cy="81"
              r="2.5"
              fill={focusedField ? "#14b8a6" : "#94a3b8"}
            />

            {/* Right Ear Sensor */}
            <rect
              x="164"
              y="68"
              width="12"
              height="26"
              rx="5"
              fill="url(#robotMetalGrad)"
              stroke="#64748b"
              strokeWidth="1"
            />
            <circle
              cx="172"
              cy="81"
              r="2.5"
              fill={focusedField ? "#14b8a6" : "#94a3b8"}
            />

            {/* ================= VISOR (FACE SCREEN) ================= */}
            <rect
              x="67"
              y="48"
              width="86"
              height="58"
              rx="22"
              ry="22"
              fill="url(#visorGlassGrad)"
              stroke="#0f766e"
              strokeWidth="1.5"
            />

            {/* Visor Glare Top-Left */}
            <path
              d="M 72 62 C 72 54, 82 50, 94 50 L 126 50 C 104 52, 76 60, 72 74 Z"
              fill="url(#visorGlareGrad)"
            />

            {/* ================= EYES & EXPRESSIONS ================= */}
            {/* 1. Loading Scanner Line */}
            {isLoading ? (
              <g>
                <line
                  x1="76"
                  y1="76"
                  x2="144"
                  y2="76"
                  stroke="#38bdf8"
                  strokeWidth="3"
                  filter="url(#neonGlow)"
                  strokeLinecap="round"
                  className="animate-pulse"
                />
              </g>
            ) : isSuccess ? (
              /* 2. Success Happy Arched Eyes (^ ^) */
              <g filter="url(#neonGlow)">
                <path
                  d="M 80 80 Q 91 66 102 80"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />
                <path
                  d="M 118 80 Q 129 66 140 80"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />
                {/* Cheerful blush dots */}
                <ellipse cx="78" cy="88" rx="4" ry="2" fill="#34d399" opacity="0.6" />
                <ellipse cx="142" cy="88" rx="4" ry="2" fill="#34d399" opacity="0.6" />
              </g>
            ) : isError ? (
              /* 3. Error / Confused Expression (o_O) */
              <g filter="url(#neonGlow)">
                {/* Left eye small circle */}
                <circle cx="91" cy="77" r="6" fill="#f87171" />
                {/* Right eye big wide circle */}
                <circle cx="129" cy="75" r="9" fill="#ef4444" />
                <circle cx="131" cy="74" r="3" fill="#ffffff" />
                {/* Digital sweat drop on corner */}
                <path
                  d="M 144 54 C 144 50, 148 46, 148 46 C 148 46, 152 50, 152 54 C 152 57, 148 59, 144 54 Z"
                  fill="#38bdf8"
                />
              </g>
            ) : isCoveringEyes && !isPeeking ? (
              /* 4. Eyes Closed / Hidden Behind Hands */
              <g opacity="0.45">
                <path
                  d="M 82 78 Q 91 84 100 78"
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <path
                  d="M 120 78 Q 129 84 138 78"
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </g>
            ) : (
              /* 5. Standard Interactive Eyes (Track cursor or peek) */
              <g
                style={{
                  transform: isBlinking ? "scaleY(0.1)" : "scaleY(1)",
                  transformOrigin: "110px 77px",
                  transition: "transform 0.12s ease",
                }}
              >
                {/* LEFT EYE */}
                <g
                  style={{
                    transform: `translate(${pupilTracking.x}px, ${pupilTracking.y}px)`,
                    transition: "transform 0.18s cubic-bezier(0.2, 0.9, 0.4, 1.2)",
                  }}
                >
                  <ellipse
                    cx="91"
                    cy="77"
                    rx={isEmailValid ? "9.5" : "9"}
                    ry={isEmailValid ? "10.5" : "10"}
                    fill="url(#cyanEyeGlow)"
                    filter="url(#neonGlow)"
                  />
                  {/* Catchlight sparkle */}
                  <circle cx="89" cy="74" r="3" fill="#ffffff" />
                  <circle cx="94" cy="79" r="1.5" fill="#ffffff" opacity="0.8" />
                </g>

                {/* RIGHT EYE */}
                <g
                  style={{
                    transform: isPeeking
                      ? "translate(4px, 2px)"
                      : `translate(${pupilTracking.x}px, ${pupilTracking.y}px)`,
                    transition: "transform 0.18s cubic-bezier(0.2, 0.9, 0.4, 1.2)",
                  }}
                >
                  <ellipse
                    cx="129"
                    cy="77"
                    rx={isEmailValid ? "9.5" : "9"}
                    ry={isEmailValid ? "10.5" : "10"}
                    fill="url(#cyanEyeGlow)"
                    filter="url(#neonGlow)"
                  />
                  {/* Catchlight sparkle */}
                  <circle cx="127" cy="74" r="3" fill="#ffffff" />
                  <circle cx="132" cy="79" r="1.5" fill="#ffffff" opacity="0.8" />
                </g>
              </g>
            )}

            {/* Small Friendly Mouth / Digital Beam */}
            <g>
              {isSuccess ? (
                <path
                  d="M 103 94 Q 110 99 117 94"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              ) : isError ? (
                <path
                  d="M 104 96 Q 110 92 116 96"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M 104 94 Q 110 97 116 94"
                  fill="none"
                  stroke="#14b8a6"
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.85"
                />
              )}
            </g>
          </g>

          {/* ================= ARTICULATED ROBOTIC ARMS & HANDS ================= */}
          {/* LEFT ARM & HAND (Covers Left Eye in Password Mode) */}
          <g
            style={{
              transform: isCoveringEyes
                ? "translate(34px, -46px) rotate(42deg)"
                : focusedField === "email"
                ? "translate(6px, -4px) rotate(8deg)"
                : "translate(0px, 0px) rotate(0deg)",
              transformOrigin: "52px 142px",
              transition: "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            {/* Left Arm Limb */}
            <path
              d="M 54 136 C 42 138, 38 126, 46 112"
              fill="none"
              stroke="#64748b"
              strokeWidth="6"
              strokeLinecap="round"
            />
            {/* Left Hand / Cute Robotic Paw */}
            <rect
              x="36"
              y="98"
              width="24"
              height="20"
              rx="9"
              fill="url(#robotBodyGrad)"
              stroke="#94a3b8"
              strokeWidth="1.8"
            />
            {/* Paw Fingers / Sensor Gripper */}
            <circle cx="43" cy="99" r="2.5" fill="#0d9488" />
            <circle cx="49" cy="98" r="2.5" fill="#0d9488" />
            <circle cx="55" cy="99" r="2.5" fill="#0d9488" />
          </g>

          {/* RIGHT ARM & HAND (Covers Right Eye in Password Mode, or Peeks) */}
          <g
            style={{
              transform: isPeeking
                ? "translate(-14px, -32px) rotate(-16deg)" // Peeking: hand dropped slightly to reveal eye!
                : isCoveringEyes
                ? "translate(-34px, -46px) rotate(-42deg)" // Fully covering right eye!
                : focusedField === "email"
                ? "translate(-6px, -4px) rotate(-8deg)"
                : "translate(0px, 0px) rotate(0deg)",
              transformOrigin: "168px 142px",
              transition: "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            {/* Right Arm Limb */}
            <path
              d="M 166 136 C 178 138, 182 126, 174 112"
              fill="none"
              stroke="#64748b"
              strokeWidth="6"
              strokeLinecap="round"
            />
            {/* Right Hand / Cute Robotic Paw */}
            <rect
              x="160"
              y="98"
              width="24"
              height="20"
              rx="9"
              fill="url(#robotBodyGrad)"
              stroke="#94a3b8"
              strokeWidth="1.8"
            />
            {/* Paw Fingers / Sensor Gripper */}
            <circle cx="165" cy="99" r="2.5" fill="#0d9488" />
            <circle cx="171" cy="98" r="2.5" fill="#0d9488" />
            <circle cx="177" cy="99" r="2.5" fill="#0d9488" />
          </g>
        </svg>
      </div>
    </div>
  );
}
