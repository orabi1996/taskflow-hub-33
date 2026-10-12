// ════════════════════════════════════════════════════════════════════════════
//  LiveGateway — WebGL Shader Strings
//  WebGL2 (GLSL ES 3.00) primary; WebGL1 (GLSL ES 1.00) fallback.
// ════════════════════════════════════════════════════════════════════════════

// ── Vertex Shaders ────────────────────────────────────────────────────────────

/** WebGL2 vertex shader — single fullscreen triangle */
export const VERT_GL2 = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

/** WebGL1 vertex shader — single fullscreen triangle */
export const VERT_GL1 = /* glsl */ `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

// ── WebGL2 Fragment Shader (Full Quality) ─────────────────────────────────────

export const FRAG_GL2 = /* glsl */ `#version 300 es
precision mediump float;

uniform float uTime;    // seconds
uniform vec2  uRes;     // canvas resolution in pixels
uniform vec2  uMouse;   // normalised mouse (0..1), y-up
uniform float uEnergy;  // 0..1 typing energy
uniform float uState;   // 0=idle, 1=loading, 2=success, 3=error
uniform float uDark;    // 0=light, 1=dark
uniform float uHour;    // 0..23 local hour
uniform vec3  uPal0;    // primary colour
uniform vec3  uPal1;    // glow / secondary colour
uniform vec3  uPal2;    // accent / gold
uniform vec3  uPal3;    // background colour

out vec4 fragColor;

// ── Utilities ────────────────────────────────────────────────────────────────

float h21(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 17.5);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = h21(i);
  float b = h21(i + vec2(1.0, 0.0));
  float c = h21(i + vec2(0.0, 1.0));
  float d = h21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// 4-octave FBM (primary field)
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  v += a * noise(p); p *= 2.0; a *= 0.5;
  v += a * noise(p); p *= 2.0; a *= 0.5;
  v += a * noise(p); p *= 2.0; a *= 0.5;
  v += a * noise(p);
  return v;
}

// 3-octave FBM (warp / aurora, slightly cheaper)
float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  v += a * noise(p); p *= 2.0; a *= 0.5;
  v += a * noise(p); p *= 2.0; a *= 0.5;
  v += a * noise(p);
  return v;
}

// ── Main ─────────────────────────────────────────────────────────────────────

void main() {
  vec2 uv  = gl_FragCoord.xy / uRes;         // 0..1 (y-up from GL)
  vec2 uvF = vec2(uv.x, 1.0 - uv.y);        // y-down (matches CSS)
  vec2 c   = uv - 0.5;                       // centred
  float t  = uTime * 0.11;

  // ── 1. Domain-Warped FBM field ───────────────────────────────────────────
  vec2 q = vec2(fbm3(uv * 2.1 + vec2(t * 0.32, t * 0.11)),
                fbm3(uv * 2.1 + vec2(t * 0.10, t * 0.27) + 4.4));
  float field = fbm(uv * 1.65 + q * 0.30 + vec2(t * 0.19, t * 0.09));

  // ── 2. Aurora ribbons (4 flowing bands) ──────────────────────────────────
  float aurora = 0.0;
  for (int b = 0; b < 4; b++) {
    float bf   = float(b);
    float band = fbm3(vec2(uv.x * 1.55 + t * (0.07 + bf * 0.032),
                           uv.y * 2.8  + bf * 1.75 + t * (0.04 + bf * 0.022)));
    float yc   = 0.18 + bf * 0.14 + sin(t * 0.5 + bf * 1.2) * 0.08;
    aurora    += smoothstep(0.38, 0.62, band) * exp(-abs(uvF.y - yc) * 8.5);
  }
  aurora = clamp(aurora, 0.0, 1.0) * (0.42 + uEnergy * 0.58);

  // ── 3. Loading vortex ────────────────────────────────────────────────────
  float vt = 0.0;
  if (uState > 0.05) {
    float ang = atan(c.y, c.x) + uTime * 1.35;
    float r   = length(c);
    vt = (sin(ang * 5.0 - r * 14.0 + uTime * 2.6) * 0.5 + 0.5)
         * smoothstep(0.60, 0.0, r) * min(uState, 1.0);
  }

  // ── 4. Success radial bloom ───────────────────────────────────────────────
  float bloom = 0.0;
  if (uState > 1.85) {
    float r    = length(c);
    float prog = clamp(uState - 2.0, 0.0, 1.0);
    bloom = smoothstep(prog + 0.05, prog * 0.4, r) * (1.0 - prog * 0.85);
    bloom = clamp(bloom, 0.0, 1.0);
  }

  // ── 5. Error shockwave ripple ─────────────────────────────────────────────
  float errR = 0.0;
  if (uState > 2.85 && uState < 4.1) {
    float r    = length(c);
    float prog = fract(uTime * 0.62);
    errR = (sin(r * 21.0 - prog * 14.0) * 0.5 + 0.5)
           * exp(-r * 4.5) * (1.0 - prog) * 0.38;
  }

  // ── 6. Colour mixing ─────────────────────────────────────────────────────
  vec3 col;

  if (uDark > 0.5) {
    // Dark: deep teal cosmos — rich, saturated
    vec3 base = mix(uPal3 * 0.2, uPal3 * 0.75, field * 0.9);
    col = base;
    col += uPal0 * aurora * 0.82;
    col += uPal1 * aurora * 0.42;
    // Subtle gold shimmer on bright field peaks
    col += uPal2 * smoothstep(0.62, 0.90, field) * 0.16;
  } else {
    // Light: luminous dawn silk — airy, translucent
    vec3 silk = mix(vec3(0.93, 0.96, 0.99), uPal0 * 0.28 + vec3(0.76, 0.90, 0.97), field * 0.58);
    col = silk;
    col += uPal0  * aurora * 0.30;
    col += uPal2  * aurora * 0.22;
    col += uPal2  * field  * 0.07;
  }

  // ── 7. State overlays ────────────────────────────────────────────────────
  col += uPal2 * vt * 0.40;
  col += mix(uPal2, vec3(0.99, 0.97, 0.86), 0.55) * bloom * 1.1;
  col  = mix(col, col * vec3(0.90, 0.55, 0.52) + vec3(0.09, 0.02, 0.02), errR * 0.70);

  // ── 8. Hour-of-day warm tint ─────────────────────────────────────────────
  float hn    = uHour / 24.0;
  float dawn  = smoothstep(0.03, 0.22, hn) * smoothstep(0.42, 0.25, hn);
  float dusk  = smoothstep(0.71, 0.84, hn) * smoothstep(0.96, 0.84, hn);
  float warm  = (dawn + dusk) * 0.20 * (1.0 - uDark * 0.45);
  col = mix(col, col * vec3(1.06, 0.87, 0.70) + vec3(0.03, 0.01, 0.0), warm);

  // ── 9. Cursor proximity glow ─────────────────────────────────────────────
  float mDist = length(uvF - uMouse);
  col += uPal0 * exp(-mDist * 5.2) * 0.16;

  // ── 10. Film grain ───────────────────────────────────────────────────────
  float grain = (h21(uv * 912.5 + vec2(uTime * 0.67, uTime * 0.43)) - 0.5) * 0.034;
  col += vec3(grain);

  // ── 11. Vignette ─────────────────────────────────────────────────────────
  float vig = 1.0 - dot(c * 1.42, c * 1.42);
  vig = clamp(vig, 0.0, 1.0);
  col *= vig * vig * 0.65 + 0.35;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

// ── WebGL1 Fragment Shader (Simplified, compatible) ───────────────────────────

export const FRAG_GL1 = /* glsl */ `
precision mediump float;

uniform float uTime;
uniform vec2  uRes;
uniform vec2  uMouse;
uniform float uEnergy;
uniform float uState;
uniform float uDark;
uniform float uHour;
uniform vec3  uPal0;
uniform vec3  uPal1;
uniform vec3  uPal2;
uniform vec3  uPal3;

float h21(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 17.5);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0,0.0)), f.x),
             mix(h21(i + vec2(0.0,1.0)), h21(i + vec2(1.0,1.0)), f.x), f.y);
}

float fbm(vec2 p) {
  float v = noise(p) * 0.5 + noise(p * 2.0) * 0.25 + noise(p * 4.0) * 0.125;
  return v;
}

void main() {
  vec2 uv  = gl_FragCoord.xy / uRes;
  vec2 uvF = vec2(uv.x, 1.0 - uv.y);
  vec2 c   = uv - 0.5;
  float t  = uTime * 0.11;

  float field = fbm(uv * 1.8 + vec2(t * 0.22, t * 0.10));

  // Simple aurora (2 bands, no loop for GL1 safety)
  float aur = 0.0;
  float b0  = fbm(vec2(uv.x * 1.5 + t * 0.08, uv.y * 3.0 + t * 0.05));
  aur += smoothstep(0.38, 0.62, b0) * exp(-abs(uvF.y - 0.22) * 9.0);
  float b1  = fbm(vec2(uv.x * 1.5 + t * 0.11 + 2.3, uv.y * 3.0 + 1.75 + t * 0.07));
  aur += smoothstep(0.38, 0.62, b1) * exp(-abs(uvF.y - 0.38) * 9.0);
  aur = clamp(aur, 0.0, 1.0) * (0.42 + uEnergy * 0.58);

  float errR = 0.0;
  if (uState > 2.85) {
    float r = length(c), prog = fract(uTime * 0.62);
    errR = (sin(r * 21.0 - prog * 14.0) * 0.5 + 0.5) * exp(-r * 4.5) * (1.0 - prog) * 0.38;
  }

  vec3 col;
  if (uDark > 0.5) {
    col = mix(uPal3 * 0.2, uPal3 * 0.75, field * 0.9);
    col += uPal0 * aur * 0.82 + uPal1 * aur * 0.42;
  } else {
    vec3 silk = mix(vec3(0.93, 0.96, 0.99), uPal0 * 0.28 + vec3(0.76, 0.90, 0.97), field * 0.58);
    col = silk + uPal0 * aur * 0.30;
  }

  col = mix(col, col * vec3(0.90, 0.55, 0.52) + vec3(0.09, 0.02, 0.02), errR * 0.70);

  float mDist = length(uvF - uMouse);
  col += uPal0 * exp(-mDist * 5.2) * 0.14;

  float grain = (h21(uv * 912.5 + vec2(uTime * 0.67, uTime * 0.43)) - 0.5) * 0.034;
  col += vec3(grain);

  float vig = 1.0 - dot(c * 1.42, c * 1.42);
  col *= clamp(vig, 0.0, 1.0) * 0.65 + 0.35;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
