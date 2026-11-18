import { VideoEffectType } from '../types/editor';

const VS_SRC = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
  v_uv = a_pos * 0.5 + 0.5;
}
`;

type ShaderEffectKey = Exclude<
  VideoEffectType,
  'none' | 'shake-impact' | 'zoom-pulse' | 'heartbeat-pump' | 'whiplash-pan'
>;

const EFFECT_SHADERS: Record<ShaderEffectKey, string> = {
  'rgb-glitch': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_time;
    uniform float u_intensity;
    float hash(float n) { return fract(sin(n) * 43758.5453); }
    void main() {
      vec2 uv = v_uv;
      float band = floor(uv.y * 18.0);
      float trig = step(0.68, hash(band + floor(u_time * 16.0)));
      float offset = (hash(band * 3.1 + floor(u_time * 24.0)) - 0.5) * 0.14 * u_intensity * trig;
      uv.x += offset;
      float split = 0.018 * u_intensity + abs(offset) * 0.35;
      float r = texture2D(u_tex, clamp(uv + vec2(split, 0.0), 0.0, 1.0)).r;
      float g = texture2D(u_tex, clamp(uv, 0.0, 1.0)).g;
      float b = texture2D(u_tex, clamp(uv - vec2(split, 0.0), 0.0, 1.0)).b;
      float a = texture2D(u_tex, clamp(uv, 0.0, 1.0)).a;
      gl_FragColor = vec4(r, g, b, a);
    }
  `,
  'chromatic-aberration': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_time;
    uniform float u_intensity;
    void main() {
      vec2 dir = (v_uv - 0.5) * (0.045 * u_intensity * (0.75 + 0.25 * sin(u_time * 5.0)));
      float r = texture2D(u_tex, clamp(v_uv + dir, 0.0, 1.0)).r;
      float g = texture2D(u_tex, v_uv).g;
      float b = texture2D(u_tex, clamp(v_uv - dir, 0.0, 1.0)).b;
      float a = texture2D(u_tex, v_uv).a;
      gl_FragColor = vec4(r, g, b, a);
    }
  `,
  'crt-scanlines': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_time;
    uniform float u_intensity;
    void main() {
      vec2 p = v_uv - 0.5;
      p *= 1.0 + dot(p, p) * 0.22 * u_intensity;
      vec2 uv = clamp(p + 0.5, 0.0, 1.0);
      vec4 base = texture2D(u_tex, uv);
      float scan = 0.78 + 0.22 * sin(uv.y * 260.0 + u_time * 12.0);
      float rgbMask = 0.92 + 0.08 * sin(uv.x * 480.0);
      gl_FragColor = vec4(base.rgb * mix(1.0, scan * rgbMask, u_intensity), base.a);
    }
  `,
  'data-mosh': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_time;
    uniform float u_intensity;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec2 cell = floor(v_uv * vec2(16.0, 12.0));
      float h = hash(cell + floor(u_time * 8.0));
      vec2 shift = (h > 0.7) ? vec2((h - 0.85) * 0.25 * u_intensity, 0.0) : vec2(0.0);
      vec4 c = texture2D(u_tex, clamp(v_uv + shift, 0.0, 1.0));
      float tint = step(0.82, h) * u_intensity * 0.35;
      gl_FragColor = vec4(mix(c.rgb, vec3(c.g, c.b, c.r), tint), c.a);
    }
  `,
  'tv-static': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_time;
    uniform float u_intensity;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 base = texture2D(u_tex, v_uv);
      float n = hash(v_uv * 240.0 + vec2(u_time * 37.0, u_time * 19.0));
      gl_FragColor = vec4(mix(base.rgb, vec3(n), u_intensity * 0.42), base.a);
    }
  `,
  'cyber-matrix': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_time;
    uniform float u_intensity;
    float hash(float n) { return fract(sin(n) * 43758.5453); }
    void main() {
      vec4 base = texture2D(u_tex, v_uv);
      float col = floor(v_uv.x * 36.0);
      float speed = 0.6 + hash(col) * 1.4;
      float drop = fract(v_uv.y + u_time * speed + hash(col * 2.3));
      float streak = smoothstep(0.18, 0.0, drop) * step(0.35, hash(col * 7.1));
      vec3 mat = vec3(base.r * 0.35, base.g * 1.2 + streak * 0.8, base.b * 0.45);
      gl_FragColor = vec4(mix(base.rgb, clamp(mat, 0.0, 1.0), u_intensity * 0.8), base.a);
    }
  `,
  'motion-blur-zoom': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_time;
    uniform float u_intensity;
    void main() {
      vec2 dir = v_uv - vec2(0.5);
      float strength = 0.14 * u_intensity * (0.65 + 0.35 * sin(u_time * 5.0));
      vec4 sum = vec4(0.0);
      for (int i = 0; i < 12; i++) {
        float t = float(i) / 11.0;
        vec2 suv = clamp(v_uv - dir * t * strength, 0.0, 1.0);
        sum += texture2D(u_tex, suv);
      }
      gl_FragColor = sum / 12.0;
    }
  `,
  'radial-blur': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_time;
    uniform float u_intensity;
    void main() {
      vec2 p = v_uv - 0.5;
      float angle = 0.06 * u_intensity * sin(u_time * 4.0);
      vec4 acc = vec4(0.0);
      for (int i = -4; i <= 4; i++) {
        float a = float(i) * angle * 0.25;
        mat2 m = mat2(cos(a), -sin(a), sin(a), cos(a));
        acc += texture2D(u_tex, clamp(m * p + 0.5, 0.0, 1.0));
      }
      gl_FragColor = acc / 9.0;
    }
  `,
  kaleidoscope: `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_time;
    uniform float u_intensity;
    void main() {
      vec2 p = v_uv - 0.5;
      float r = length(p);
      float a = atan(p.y, p.x) + u_time * 0.45 * u_intensity;
      float sides = 6.0;
      float tau = 6.2831853;
      a = mod(a, tau / sides);
      a = abs(a - tau / (sides * 2.0));
      vec2 kuv = clamp(vec2(cos(a), sin(a)) * r + 0.5, 0.0, 1.0);
      vec4 orig = texture2D(u_tex, v_uv);
      vec4 kal = texture2D(u_tex, kuv);
      gl_FragColor = mix(orig, kal, min(1.0, u_intensity * 1.1));
    }
  `,
  'kaleido-8': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_time;
    uniform float u_intensity;
    void main() {
      vec2 p = v_uv - 0.5;
      float r = length(p);
      float a = atan(p.y, p.x) - u_time * 0.65 * u_intensity;
      float sides = 8.0;
      float tau = 6.2831853;
      a = mod(a, tau / sides);
      a = abs(a - tau / (sides * 2.0));
      vec2 kuv = clamp(vec2(cos(a), sin(a)) * r + 0.5, 0.0, 1.0);
      gl_FragColor = mix(texture2D(u_tex, v_uv), texture2D(u_tex, kuv), min(1.0, u_intensity * 1.1));
    }
  `,
  'bulge-fisheye': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_time;
    uniform float u_intensity;
    void main() {
      vec2 p = v_uv - 0.5;
      float dist = length(p);
      float radius = 0.55;
      if (dist < radius) {
        float pct = dist / radius;
        float k = 1.0 + u_intensity * 0.85 * (0.8 + 0.2 * sin(u_time * 4.0));
        p *= pow(pct, k - 1.0);
      }
      gl_FragColor = texture2D(u_tex, clamp(p + 0.5, 0.0, 1.0));
    }
  `,
  'pinch-warp': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_time;
    uniform float u_intensity;
    void main() {
      vec2 p = v_uv - 0.5;
      float dist = length(p);
      float radius = 0.55;
      if (dist < radius && dist > 0.001) {
        float pct = dist / radius;
        p *= mix(1.0, pow(pct, -0.45 * u_intensity), 1.0 - pct);
      }
      gl_FragColor = texture2D(u_tex, clamp(p + 0.5, 0.0, 1.0));
    }
  `,
  'swirl-vortex': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_time;
    uniform float u_intensity;
    void main() {
      vec2 p = v_uv - 0.5;
      float dist = length(p);
      float ang = (1.0 - smoothstep(0.0, 0.55, dist)) * 3.2 * u_intensity * sin(u_time * 2.0 + 1.0);
      float s = sin(ang), c = cos(ang);
      vec2 uv = vec2(p.x * c - p.y * s, p.x * s + p.y * c) + 0.5;
      gl_FragColor = texture2D(u_tex, clamp(uv, 0.0, 1.0));
    }
  `,
  'mirror-split': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_intensity;
    void main() {
      vec2 uv = vec2(v_uv.x < 0.5 ? v_uv.x : 1.0 - v_uv.x, v_uv.y);
      gl_FragColor = mix(texture2D(u_tex, v_uv), texture2D(u_tex, uv), u_intensity);
    }
  `,
  'mirror-quad': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_intensity;
    void main() {
      vec2 uv = vec2(abs(v_uv.x - 0.5) * 2.0, abs(v_uv.y - 0.5) * 2.0);
      gl_FragColor = mix(texture2D(u_tex, v_uv), texture2D(u_tex, clamp(uv, 0.0, 1.0)), u_intensity);
    }
  `,
  'wave-ripple': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_time;
    uniform float u_intensity;
    void main() {
      float d = distance(v_uv, vec2(0.5));
      float wave = sin(d * 34.0 - u_time * 8.0) * 0.024 * u_intensity;
      vec2 dir = normalize(v_uv - 0.5 + vec2(0.0001));
      gl_FragColor = texture2D(u_tex, clamp(v_uv + dir * wave, 0.0, 1.0));
    }
  `,
  'cyber-prism': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_time;
    uniform float u_intensity;
    void main() {
      vec4 base = texture2D(u_tex, v_uv);
      float sweep = mod(u_time * 0.45, 1.6) - 0.3;
      float d = abs((v_uv.x * 0.8 + v_uv.y * 0.35) - sweep);
      float beam = smoothstep(0.28, 0.0, d) * u_intensity;
      vec3 prism = vec3(0.0, 0.85, 1.0) * smoothstep(0.28, 0.05, d)
                 + vec3(0.75, 0.35, 1.0) * smoothstep(0.18, 0.0, abs(d - 0.08));
      gl_FragColor = vec4(clamp(base.rgb + prism * beam * 0.85, 0.0, 1.0), base.a);
    }
  `,
  'vhs-retro': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_time;
    uniform float u_intensity;
    void main() {
      float wave = sin(v_uv.y * 28.0 + u_time * 10.0) * 0.004 * u_intensity;
      float track = smoothstep(0.04, 0.0, abs(fract(v_uv.y - u_time * 0.25) - 0.5)) * 0.025 * u_intensity;
      vec2 uv = v_uv + vec2(wave + track, 0.0);
      float r = texture2D(u_tex, clamp(uv + vec2(0.006 * u_intensity, 0.0), 0.0, 1.0)).r;
      float g = texture2D(u_tex, clamp(uv, 0.0, 1.0)).g;
      float b = texture2D(u_tex, clamp(uv - vec2(0.006 * u_intensity, 0.0), 0.0, 1.0)).b;
      float scan = 1.0 - 0.22 * u_intensity * step(0.5, fract(v_uv.y * 120.0));
      gl_FragColor = vec4(vec3(r, g, b) * scan, 1.0);
    }
  `,
  'neon-edges': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform vec2 u_resolution;
    uniform float u_intensity;
    void main() {
      vec2 px = 1.5 / max(u_resolution, vec2(1.0));
      vec3 tl = texture2D(u_tex, v_uv + vec2(-px.x, -px.y)).rgb;
      vec3 tr = texture2D(u_tex, v_uv + vec2( px.x, -px.y)).rgb;
      vec3 bl = texture2D(u_tex, v_uv + vec2(-px.x,  px.y)).rgb;
      vec3 br = texture2D(u_tex, v_uv + vec2( px.x,  px.y)).rgb;
      float edge = length(tl - br) + length(tr - bl);
      vec4 base = texture2D(u_tex, v_uv);
      vec3 neon = vec3(0.0, 0.92, 1.0) * edge * 2.4 * u_intensity;
      gl_FragColor = vec4(clamp(mix(base.rgb, base.rgb * 0.35 + neon, u_intensity), 0.0, 1.0), base.a);
    }
  `,
  'halftone-pixel': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_intensity;
    void main() {
      float blocks = mix(120.0, 22.0, u_intensity);
      vec2 grid = floor(v_uv * blocks) / blocks;
      gl_FragColor = texture2D(u_tex, clamp(grid, 0.0, 1.0));
    }
  `,
  'mosaic-blur': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_intensity;
    void main() {
      float off = 0.008 * u_intensity;
      vec4 s = texture2D(u_tex, v_uv) * 0.25;
      s += texture2D(u_tex, clamp(v_uv + vec2(off, off), 0.0, 1.0)) * 0.1875;
      s += texture2D(u_tex, clamp(v_uv + vec2(-off, off), 0.0, 1.0)) * 0.1875;
      s += texture2D(u_tex, clamp(v_uv + vec2(off, -off), 0.0, 1.0)) * 0.1875;
      s += texture2D(u_tex, clamp(v_uv + vec2(-off, -off), 0.0, 1.0)) * 0.1875;
      gl_FragColor = s;
    }
  `,
  'neon-flash': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_time;
    uniform float u_intensity;
    void main() {
      vec4 base = texture2D(u_tex, v_uv);
      float strobe = pow(abs(sin(u_time * 7.5)), 6.0) * u_intensity * 0.85;
      gl_FragColor = vec4(clamp(base.rgb + vec3(strobe), 0.0, 1.0), base.a);
    }
  `,
  'bloom-aura': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_intensity;
    void main() {
      vec4 base = texture2D(u_tex, v_uv);
      float r = 0.015 * u_intensity;
      vec3 glow = (
        texture2D(u_tex, clamp(v_uv + vec2(r, 0.0), 0.0, 1.0)).rgb +
        texture2D(u_tex, clamp(v_uv - vec2(r, 0.0), 0.0, 1.0)).rgb +
        texture2D(u_tex, clamp(v_uv + vec2(0.0, r), 0.0, 1.0)).rgb +
        texture2D(u_tex, clamp(v_uv - vec2(0.0, r), 0.0, 1.0)).rgb
      ) * 0.25;
      vec3 highlights = max(glow - 0.35, vec3(0.0)) * 1.45 * u_intensity;
      gl_FragColor = vec4(clamp(base.rgb + highlights, 0.0, 1.0), base.a);
    }
  `,
  'thermal-heat': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_intensity;
    void main() {
      vec4 base = texture2D(u_tex, v_uv);
      float lum = dot(base.rgb, vec3(0.299, 0.587, 0.114));
      vec3 cold = vec3(0.1, 0.0, 0.55);
      vec3 mid = vec3(0.92, 0.12, 0.28);
      vec3 hot = vec3(1.0, 0.95, 0.2);
      vec3 therm = lum < 0.5 ? mix(cold, mid, lum * 2.0) : mix(mid, hot, (lum - 0.5) * 2.0);
      gl_FragColor = vec4(mix(base.rgb, therm, u_intensity), base.a);
    }
  `,
  'xray-invert': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_intensity;
    void main() {
      vec4 base = texture2D(u_tex, v_uv);
      vec3 inv = 1.0 - base.rgb;
      gl_FragColor = vec4(mix(base.rgb, inv, u_intensity), base.a);
    }
  `,
  solarize: `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_intensity;
    void main() {
      vec4 base = texture2D(u_tex, v_uv);
      vec3 sol = abs(base.rgb - 0.5) * 2.0;
      gl_FragColor = vec4(mix(base.rgb, sol, u_intensity), base.a);
    }
  `,
  'laser-grid': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_time;
    uniform float u_intensity;
    void main() {
      vec4 base = texture2D(u_tex, v_uv);
      float lineY = smoothstep(0.018, 0.0, abs(v_uv.y - fract(u_time * 0.65)));
      float grid = (step(0.93, fract(v_uv.x * 12.0)) + step(0.93, fract(v_uv.y * 8.0))) * 0.22;
      vec3 add = vec3(0.0, 0.9, 1.0) * (lineY + grid) * u_intensity;
      gl_FragColor = vec4(clamp(base.rgb + add, 0.0, 1.0), base.a);
    }
  `,
  'edge-glow': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_intensity;
    void main() {
      vec4 base = texture2D(u_tex, v_uv);
      float edgeX = min(v_uv.x, 1.0 - v_uv.x);
      float edgeY = min(v_uv.y, 1.0 - v_uv.y);
      float border = smoothstep(0.07, 0.0, min(edgeX, edgeY)) * u_intensity;
      gl_FragColor = vec4(clamp(base.rgb + vec3(0.0, 0.82, 0.96) * border, 0.0, 1.0), base.a);
    }
  `,
  'cinematic-teal': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_intensity;
    void main() {
      vec4 base = texture2D(u_tex, v_uv);
      float luma = dot(base.rgb, vec3(0.299, 0.587, 0.114));
      vec3 teal = vec3(0.05, 0.55, 0.65);
      vec3 orange = vec3(1.0, 0.62, 0.25);
      vec3 graded = mix(base.rgb * teal * 1.35, base.rgb * orange * 1.2, smoothstep(0.25, 0.85, luma));
      gl_FragColor = vec4(mix(base.rgb, graded, u_intensity * 0.78), base.a);
    }
  `,
  vignette: `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_intensity;
    void main() {
      vec4 base = texture2D(u_tex, v_uv);
      float d = distance(v_uv, vec2(0.5));
      float vig = smoothstep(0.78, 0.24, d);
      gl_FragColor = vec4(base.rgb * mix(1.0, vig, u_intensity), base.a);
    }
  `,
  'bw-contrast': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_intensity;
    void main() {
      vec4 base = texture2D(u_tex, v_uv);
      float g = dot(base.rgb, vec3(0.299, 0.587, 0.114));
      g = smoothstep(0.12, 0.88, g);
      gl_FragColor = vec4(mix(base.rgb, vec3(g), u_intensity), base.a);
    }
  `,
  'warm-gold': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_intensity;
    void main() {
      vec4 base = texture2D(u_tex, v_uv);
      vec3 gold = base.rgb * vec3(1.18, 1.03, 0.78) + vec3(0.08, 0.04, 0.0) * u_intensity;
      gl_FragColor = vec4(clamp(mix(base.rgb, gold, u_intensity), 0.0, 1.0), base.a);
    }
  `,
  'cyberpunk-pink': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_intensity;
    void main() {
      vec4 base = texture2D(u_tex, v_uv);
      vec3 tinted = base.rgb * vec3(1.22, 0.72, 1.32) + vec3(0.06, 0.0, 0.12);
      gl_FragColor = vec4(clamp(mix(base.rgb, tinted, u_intensity * 0.85), 0.0, 1.0), base.a);
    }
  `,
  'emerald-matrix': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_intensity;
    void main() {
      vec4 base = texture2D(u_tex, v_uv);
      vec3 g = base.rgb * vec3(0.65, 1.28, 0.78);
      gl_FragColor = vec4(clamp(mix(base.rgb, g, u_intensity), 0.0, 1.0), base.a);
    }
  `,
  'sepia-vintage': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_intensity;
    void main() {
      vec4 base = texture2D(u_tex, v_uv);
      vec3 sep = vec3(
        dot(base.rgb, vec3(0.393, 0.769, 0.189)),
        dot(base.rgb, vec3(0.349, 0.686, 0.168)),
        dot(base.rgb, vec3(0.272, 0.534, 0.131))
      );
      gl_FragColor = vec4(mix(base.rgb, clamp(sep, 0.0, 1.0), u_intensity), base.a);
    }
  `,
  'night-vision': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_time;
    uniform float u_intensity;
    void main() {
      vec4 base = texture2D(u_tex, v_uv);
      float lum = dot(base.rgb, vec3(0.299, 0.587, 0.114));
      float scan = 0.88 + 0.12 * sin(v_uv.y * 220.0 + u_time * 14.0);
      vec3 nv = vec3(0.15, 1.15, 0.3) * lum * scan;
      gl_FragColor = vec4(clamp(mix(base.rgb, nv, u_intensity), 0.0, 1.0), base.a);
    }
  `,
  'sunset-glow': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_intensity;
    void main() {
      vec4 base = texture2D(u_tex, v_uv);
      vec3 sun = mix(vec3(0.95, 0.25, 0.45), vec3(1.0, 0.72, 0.25), 1.0 - v_uv.y);
      gl_FragColor = vec4(clamp(mix(base.rgb, base.rgb * 0.78 + sun * 0.34, u_intensity), 0.0, 1.0), base.a);
    }
  `,
  'deep-contrast': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_intensity;
    void main() {
      vec4 base = texture2D(u_tex, v_uv);
      vec3 c = smoothstep(0.08, 0.92, base.rgb);
      gl_FragColor = vec4(mix(base.rgb, c, u_intensity), base.a);
    }
  `,
  'fade-film': `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_intensity;
    void main() {
      vec4 base = texture2D(u_tex, v_uv);
      vec3 faded = base.rgb * 0.82 + vec3(0.08, 0.075, 0.09);
      gl_FragColor = vec4(mix(base.rgb, faded, u_intensity), base.a);
    }
  `,
};

class GlEffectContext {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext | null = null;
  programs = new Map<string, WebGLProgram | null>();
  tex: WebGLTexture | null = null;
  contextLost = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 640;
    this.canvas.height = 360;
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
      this.programs.clear();
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.initGl();
    });
    this.initGl();
  }

  private initGl() {
    this.gl = this.canvas.getContext('webgl', {
      preserveDrawingBuffer: true,
      alpha: true,
      premultipliedAlpha: false,
    });
    if (this.gl) {
      const gl = this.gl;
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );
      this.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
  }

  private compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  private getProgram(effectType: string): WebGLProgram | null {
    const gl = this.gl;
    if (!gl || this.contextLost) return null;
    if (this.programs.has(effectType)) return this.programs.get(effectType) ?? null;

    const fsSrc = EFFECT_SHADERS[effectType as ShaderEffectKey];
    if (!fsSrc) {
      this.programs.set(effectType, null);
      return null;
    }
    const vs = this.compile(gl, gl.VERTEX_SHADER, VS_SRC);
    const fs = this.compile(gl, gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) {
      this.programs.set(effectType, null);
      return null;
    }
    const prog = gl.createProgram();
    if (!prog) return null;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      this.programs.set(effectType, null);
      return null;
    }
    this.programs.set(effectType, prog);
    return prog;
  }

  apply(
    sourceCanvas: HTMLCanvasElement,
    effectType: VideoEffectType,
    intensityPct: number,
    timeSec: number
  ): HTMLCanvasElement | null {
    const gl = this.gl;
    if (!gl || !this.tex || this.contextLost) return null;
    const prog = this.getProgram(effectType);
    if (!prog) return null;

    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    gl.viewport(0, 0, w, h);
    gl.useProgram(prog);

    const posLoc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
    gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);

    const timeLoc = gl.getUniformLocation(prog, 'u_time');
    if (timeLoc) gl.uniform1f(timeLoc, timeSec);
    const intLoc = gl.getUniformLocation(prog, 'u_intensity');
    if (intLoc) gl.uniform1f(intLoc, Math.max(0.1, Math.min(1, intensityPct / 100)));
    const resLoc = gl.getUniformLocation(prog, 'u_resolution');
    if (resLoc) gl.uniform2f(resLoc, w, h);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    return this.canvas;
  }
}

let sharedFxCtx: GlEffectContext | null = null;
let fxSampleCanvas: HTMLCanvasElement | null = null;

export function applyWebGlEffectPass(
  targetCtx: CanvasRenderingContext2D,
  sourceCanvas: HTMLCanvasElement,
  effectType: VideoEffectType,
  intensityPct: number,
  timeSec: number
): boolean {
  try {
    if (!sharedFxCtx) sharedFxCtx = new GlEffectContext();
    const out = sharedFxCtx.apply(sourceCanvas, effectType, intensityPct, timeSec);
    if (!out) return false;
    targetCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    targetCtx.drawImage(out, 0, 0, sourceCanvas.width, sourceCanvas.height);
    return true;
  } catch {
    return false;
  }
}

function getFxSampleScene(): HTMLCanvasElement {
  if (!fxSampleCanvas) {
    fxSampleCanvas = document.createElement('canvas');
    fxSampleCanvas.width = 160;
    fxSampleCanvas.height = 96;
    const ctx = fxSampleCanvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 160, 96);
      grad.addColorStop(0, '#0F172A');
      grad.addColorStop(0.5, '#1E3A8A');
      grad.addColorStop(1, '#BE185D');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 160, 96);

      ctx.fillStyle = '#00CAE0';
      ctx.beginPath();
      ctx.arc(48, 40, 20, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.moveTo(90, 78);
      ctx.lineTo(118, 22);
      ctx.lineTo(146, 78);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(10, 10, 140, 76);
    }
  }
  return fxSampleCanvas;
}

export function renderGlEffectPreviewToCanvas(
  targetCanvas: HTMLCanvasElement,
  effectType: VideoEffectType,
  timeSec = 1.2
): boolean {
  const sample = getFxSampleScene();
  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return false;
  if (
    effectType === 'none' ||
    effectType === 'shake-impact' ||
    effectType === 'zoom-pulse' ||
    effectType === 'heartbeat-pump' ||
    effectType === 'whiplash-pan'
  ) {
    ctx.drawImage(sample, 0, 0, targetCanvas.width, targetCanvas.height);
    return true;
  }
  try {
    if (!sharedFxCtx) sharedFxCtx = new GlEffectContext();
    const out = sharedFxCtx.apply(sample, effectType, 85, timeSec);
    if (!out) {
      ctx.drawImage(sample, 0, 0, targetCanvas.width, targetCanvas.height);
      return false;
    }
    ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    ctx.drawImage(out, 0, 0, targetCanvas.width, targetCanvas.height);
    return true;
  } catch {
    ctx.drawImage(sample, 0, 0, targetCanvas.width, targetCanvas.height);
    return false;
  }
}
