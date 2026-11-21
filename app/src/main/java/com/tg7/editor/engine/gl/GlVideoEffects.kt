package com.tg7.editor.engine.gl

/**
 * OpenGL ES 2.0 (#version 100) GPU shader pipeline for TG7 Editor Phase 5.
 * Executes all 60 manifest VFX & LUTs (7 shader families), 5-channel color grading,
 * and YCbCr Chroma Key with spill suppression at 60fps in both live ExoPlayer preview
 * and Media3 Transformer hardware MP4 export.
 */
object GlVideoEffects {

    const val VERTEX_SHADER_GLSL: String = """
        attribute vec4 aFramePosition;
        varying vec2 vUv;
        void main() {
            gl_Position = aFramePosition;
            vUv = aFramePosition.xy * 0.5 + 0.5;
        }
    """

    const val EFFECTS_FRAGMENT_SHADER_GLSL: String = """
        precision highp float;
        varying vec2 vUv;

        uniform sampler2D uTexSampler;
        uniform float uTimeSec;
        uniform float uResolutionX;
        uniform float uResolutionY;

        uniform int uFamily;
        uniform int uMode;
        uniform float uIntensity;
        uniform float uParamA;
        uniform float uParamB;
        uniform float uParamC;

        uniform float uBrightness;
        uniform float uContrast;
        uniform float uSaturation;
        uniform float uTemperature;
        uniform float uVignette;

        uniform int uChromaEnabled;
        uniform float uChromaR;
        uniform float uChromaG;
        uniform float uChromaB;
        uniform float uChromaSimilarity;
        uniform float uChromaSmoothness;

        uniform float uPanX;
        uniform float uPanY;
        uniform float uScale;
        uniform float uRotationRad;
        uniform int uFlipH;
        uniform int uFlipV;
        uniform float uOpacity;
        uniform int uBlendMode;

        const float PI = 3.14159265;

        float rand1(vec2 co) {
            return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
        }

        float luma(vec3 c) {
            return dot(c, vec3(0.299, 0.587, 0.114));
        }

        vec3 sampleRgb(vec2 uv) {
            return texture2D(uTexSampler, clamp(uv, 0.0, 1.0)).rgb;
        }

        vec2 applyTransformUv(vec2 uv) {
            vec2 p = uv - 0.5;
            if (uFlipH == 1) {
                p.x = -p.x;
            }
            if (uFlipV == 1) {
                p.y = -p.y;
            }
            p.x -= uPanX;
            p.y += uPanY;
            float aspect = max(uResolutionX, 1.0) / max(uResolutionY, 1.0);
            p.x *= aspect;
            float invScale = 1.0 / max(uScale, 0.1);
            p *= invScale;
            float cs = cos(-uRotationRad);
            float sn = sin(-uRotationRad);
            vec2 rot = vec2(p.x * cs - p.y * sn, p.x * sn + p.y * cs);
            rot.x /= aspect;
            return rot + 0.5;
        }

        vec3 applyBlendCurve(vec3 col) {
            if (uBlendMode == 1) {
                // Screen lift
                return 1.0 - (1.0 - col) * (1.0 - col * 0.45);
            } else if (uBlendMode == 2) {
                // Linear Add glow
                return clamp(col * 1.38, 0.0, 1.0);
            } else if (uBlendMode == 3) {
                // Multiply deepen
                return clamp(col * col * 1.15, 0.0, 1.0);
            } else if (uBlendMode == 4) {
                // Overlay S-curve
                return clamp(mix(2.0 * col * col, 1.0 - 2.0 * (1.0 - col) * (1.0 - col), step(0.5, luma(col))), 0.0, 1.0);
            }
            return col;
        }

        vec2 computeWarpedUv(vec2 uv) {
            vec2 w = uv;
            float inten = clamp(uIntensity, 0.0, 1.0);
            if (inten <= 0.001 || uFamily == 0) {
                return w;
            }

            if (uFamily == 3) {
                // GLITCH_CYBER geometric warps
                if (uMode == 0) {
                    // VHS tracking tear
                    float band = sin(uv.y * uParamA + uTimeSec * 9.0);
                    float jitter = (rand1(vec2(floor(uv.y * 42.0), floor(uTimeSec * 24.0))) - 0.5) * 2.0;
                    float bar = smoothstep(0.86, 0.99, sin(uv.y * 5.0 - uTimeSec * 1.4));
                    w.x += (band * uParamB * 0.45 + jitter * uParamB * 0.55 + bar * 0.03) * inten;
                } else if (uMode == 4) {
                    // Signal sine wave
                    w.x += sin(uv.y * uParamA + uTimeSec * uParamC) * uParamB * inten;
                } else if (uMode == 5) {
                    // Datamosh macro-block shift
                    float cell = max(uParamA, 4.0);
                    vec2 blockId = floor(uv * cell);
                    float trig = step(0.62, rand1(blockId + floor(uTimeSec * 8.0)));
                    vec2 shift = vec2(
                        rand1(blockId + 11.3) - 0.5,
                        rand1(blockId + 37.7) - 0.5
                    ) * uParamB * 2.2 * trig * inten;
                    w += shift;
                }
            } else if (uFamily == 4) {
                // LENS_OPTICAL geometric warps
                if (uMode == 0) {
                    // Fisheye / Barrel distortion
                    vec2 p = uv - 0.5;
                    float r = length(p);
                    float k = uParamA * inten;
                    float nr = r * (1.0 + k * (r * r * 2.4 - 0.35));
                    float scale = (r > 0.0001) ? (nr / r) : 1.0;
                    w = 0.5 + p * scale;
                } else if (uMode == 4) {
                    // Kaleidoscope mirror (4x / 6x)
                    vec2 p = uv - 0.5;
                    float segs = max(uParamA, 3.0);
                    float ang = atan(p.y, p.x) + uTimeSec * uParamB * 0.25;
                    float rad = length(p);
                    float stepA = (2.0 * PI) / segs;
                    float ma = mod(abs(ang), stepA);
                    if (ma > stepA * 0.5) {
                        ma = stepA - ma;
                    }
                    vec2 kUv = 0.5 + vec2(cos(ma), sin(ma)) * rad;
                    w = mix(uv, kUv, inten);
                } else if (uMode == 5) {
                    // Horizontal / Vertical mirror split
                    vec2 mUv = uv;
                    if (uParamA > 0.5) {
                        mUv.x = (uv.x > 0.5) ? (1.0 - uv.x) : uv.x;
                    }
                    if (uParamB > 0.5) {
                        mUv.y = (uv.y > 0.5) ? (1.0 - uv.y) : uv.y;
                    }
                    w = mix(uv, mUv, inten);
                }
            } else if (uFamily == 5) {
                // MOTION_PULSE geometric warps
                if (uMode == 0 || uMode == 2) {
                    // Beat zoom pulse / Heartbeat pump
                    float pulse = 0.5 + 0.5 * sin(uTimeSec * uParamA * 2.0 * PI);
                    float zoom = 1.0 - (pulse * pulse) * uParamB * inten;
                    w = 0.5 + (uv - 0.5) * zoom;
                } else if (uMode == 1) {
                    // Camera shake / Quake / Handheld drift
                    float sx = sin(uTimeSec * uParamA * 6.2831 + 1.1) * cos(uTimeSec * 4.3);
                    float sy = cos(uTimeSec * uParamA * 5.13 + 2.4) * sin(uTimeSec * 3.7);
                    w += vec2(sx, sy) * uParamB * inten;
                } else if (uMode == 5) {
                    // Vortex swirl spin
                    vec2 p = uv - 0.5;
                    float r = length(p);
                    float swirlAmt = max(0.0, 1.0 - r * 1.45) * uParamA * inten * sin(uTimeSec * uParamB);
                    float cs = cos(swirlAmt);
                    float sn = sin(swirlAmt);
                    vec2 rot = vec2(p.x * cs - p.y * sn, p.x * sn + p.y * cs);
                    w = 0.5 + rot;
                }
            } else if (uFamily == 6 && uMode == 0) {
                // ARTISTIC_RETRO pixelate mosaic
                float grid = mix(320.0, max(uParamA, 8.0), inten);
                w = (floor(uv * grid) + 0.5) / grid;
            }
            return clamp(w, 0.0, 1.0);
        }

        vec3 applyLutTone(vec3 base) {
            float y = luma(base);
            if (uMode == 0) {
                // Split tone (Teal & Orange, Golden Hour, Arctic Frost)
                vec3 warm = vec3(1.0 + uParamA, 1.0 + uParamA * 0.25, 1.0 - uParamA * 0.75);
                vec3 cool = vec3(1.0 - uParamC, 1.0 + uParamC * 0.35, 1.0 + uParamC * 0.9);
                vec3 shadow = base * mix(cool, warm, step(0.0, uParamB) * 0.5);
                vec3 highlight = base * warm;
                vec3 graded = mix(shadow, highlight, smoothstep(0.18, 0.82, y));
                return clamp((graded - 0.5) * 1.12 + 0.5, 0.0, 1.0);
            } else if (uMode == 1) {
                // Tint blend (Cyberpunk, Emerald Matrix, Blood Cinema)
                vec3 tint = vec3(uParamA, uParamB, uParamC);
                vec3 tinted = mix(base, base * tint * 1.45 + tint * 0.08, 0.65);
                return clamp((tinted - 0.5) * 1.18 + 0.5, 0.0, 1.0);
            } else if (uMode == 2) {
                // Noir / Bleach Bypass
                vec3 mono = vec3(y);
                vec3 c = mix(mono, base, clamp(uParamB, 0.0, 1.0));
                return clamp((c - 0.5) * max(uParamA, 0.5) + 0.5, 0.0, 1.0);
            } else if (uMode == 3) {
                // Moody dark film
                vec3 c = (base - 0.5) * max(uParamB, 0.5) + 0.5 + uParamA;
                float cy = luma(c);
                return clamp(mix(vec3(cy), c, clamp(uParamC, 0.0, 1.5)), 0.0, 1.0);
            } else if (uMode == 4) {
                // Film stock curve (Fuji / Kodak)
                vec3 c = (base - 0.5) * max(uParamB, 0.5) + 0.5;
                float cy = luma(c);
                c = mix(vec3(cy), c, 1.24);
                c += vec3(uParamA * 0.16, 0.02, uParamC * 0.14);
                return clamp(c, 0.0, 1.0);
            } else {
                // Vintage Sepia
                vec3 sep = vec3(
                    dot(base, vec3(0.393, 0.769, 0.189)),
                    dot(base, vec3(0.349, 0.686, 0.168)),
                    dot(base, vec3(0.272, 0.534, 0.131))
                );
                return clamp(mix(base, sep, uParamA), 0.0, 1.0);
            }
        }

        vec3 applyGlowBloom(vec3 base, vec2 uv) {
            float off = (uMode == 0 || uMode == 2) ? max(uParamB, 0.005) : 0.011;
            vec3 acc = sampleRgb(uv + vec2(off, 0.0))
                     + sampleRgb(uv - vec2(off, 0.0))
                     + sampleRgb(uv + vec2(0.0, off))
                     + sampleRgb(uv - vec2(0.0, off))
                     + sampleRgb(uv + vec2(off, off))
                     + sampleRgb(uv - vec2(off, off))
                     + sampleRgb(uv + vec2(off, -off))
                     + sampleRgb(uv - vec2(off, -off));
            vec3 blurCol = acc * 0.125;
            if (uMode == 0) {
                // Soft Pro Bloom / Star Glow
                vec3 bright = max(blurCol - vec3(0.55), vec3(0.0)) * 2.2;
                return clamp(base + bright * uParamA, 0.0, 1.0);
            } else if (uMode == 1) {
                // Neon halo / Vaporwave haze
                vec3 tint = vec3(uParamA, uParamB, uParamC);
                float mask = smoothstep(0.45, 0.95, luma(blurCol));
                return clamp(base + blurCol * tint * mask * 0.85, 0.0, 1.0);
            } else if (uMode == 2) {
                // Angelic mist
                return clamp(mix(base, max(base, blurCol), clamp(uParamA, 0.0, 1.0)) + blurCol * 0.18, 0.0, 1.0);
            } else if (uMode == 3 || uMode == 4) {
                // Sunset Halation / Amber Light Leak
                float sweep = smoothstep(0.25, 1.0, 1.0 - length(uv - vec2(0.15 + 0.7 * fract(uTimeSec * 0.18), 0.25)));
                vec3 tint = vec3(uParamA, uParamB, uParamC);
                return clamp(base + blurCol * tint * 0.42 + tint * sweep * 0.48, 0.0, 1.0);
            } else {
                // Anamorphic horizontal streak
                vec3 streak = (sampleRgb(uv + vec2(0.03, 0.0)) + sampleRgb(uv - vec2(0.03, 0.0))
                             + sampleRgb(uv + vec2(0.06, 0.0)) + sampleRgb(uv - vec2(0.06, 0.0))) * 0.25;
                float hi = smoothstep(0.62, 0.96, luma(streak));
                vec3 tint = vec3(uParamA, uParamB, uParamC);
                return clamp(base + tint * hi * 0.75, 0.0, 1.0);
            }
        }

        vec3 applyGlitchColor(vec3 base, vec2 uv) {
            if (uMode == 0) {
                // VHS chromatic bleed
                float shift = max(uParamB * 0.45, 0.005);
                float r = sampleRgb(uv + vec2(shift, 0.0)).r;
                float b = sampleRgb(uv - vec2(shift, 0.0)).b;
                return vec3(r, base.g, b);
            } else if (uMode == 1) {
                // RGB Chromatic Split / Diagonal RGB Tear
                vec2 dir = vec2(max(uParamA, 0.004), uParamB);
                float r = sampleRgb(uv + dir).r;
                float g = base.g;
                float b = sampleRgb(uv - dir).b;
                return vec3(r, g, b);
            } else if (uMode == 2) {
                // CRT Scanlines / HUD Radar Scan
                float scan = 0.5 + 0.5 * sin(uv.y * max(uParamA, 20.0) * PI + uTimeSec * 4.0);
                float dark = 1.0 - clamp(uParamB, 0.0, 0.85) * (1.0 - scan);
                vec3 col = base * dark;
                if (uParamC > 0.5) {
                    float radar = smoothstep(0.96, 1.0, sin(uv.y * 4.0 - uTimeSec * 2.5));
                    col += vec3(0.0, 0.94, 1.0) * radar * 0.35;
                }
                return clamp(col, 0.0, 1.0);
            } else if (uMode == 3) {
                // Analog Film Grain / TV Static Pop
                float n = (rand1(uv * vec2(uResolutionX, uResolutionY) * 0.25 + fract(uTimeSec * 19.0)) - 0.5) * 2.0;
                return clamp(base + vec3(n) * uParamA, 0.0, 1.0);
            } else {
                // Wave / Datamosh subtle edge chroma
                float r = sampleRgb(uv + vec2(0.006, 0.0)).r;
                float b = sampleRgb(uv - vec2(0.006, 0.0)).b;
                return vec3(r, base.g, b);
            }
        }

        vec3 applyLensColor(vec3 base, vec2 uv) {
            if (uMode == 1) {
                // Heavy Cinema Vignette
                float d = length((uv - 0.5) * vec2(1.0, max(uResolutionY, 1.0) / max(uResolutionX, 1.0)));
                float mask = smoothstep(uParamB, uParamB + 0.55, d);
                return base * (1.0 - mask * clamp(uParamA, 0.0, 1.0));
            } else if (uMode == 2) {
                // Radial speed blur or Prism double vision
                if (uParamB > 0.5) {
                    vec3 a = sampleRgb(uv + vec2(uParamA, -uParamA * 0.5));
                    vec3 b = sampleRgb(uv - vec2(uParamA, -uParamA * 0.5));
                    return clamp(mix(base, (a + b) * 0.5, 0.55), 0.0, 1.0);
                } else {
                    vec2 dir = (uv - 0.5) * uParamA;
                    vec3 acc = base;
                    acc += sampleRgb(uv - dir * 0.5);
                    acc += sampleRgb(uv - dir);
                    acc += sampleRgb(uv - dir * 1.5);
                    return acc * 0.25;
                }
            } else if (uMode == 3) {
                // Miniature Tilt-Shift blur outside center horizontal band
                float distY = abs(uv.y - 0.5);
                float blurWeight = smoothstep(uParamB * 0.5, uParamB + 0.28, distY);
                float off = max(uParamA, 0.004) * blurWeight;
                vec3 blurred = (sampleRgb(uv + vec2(off, 0.0))
                              + sampleRgb(uv - vec2(off, 0.0))
                              + sampleRgb(uv + vec2(0.0, off))
                              + sampleRgb(uv - vec2(0.0, off))) * 0.25;
                vec3 sat = mix(vec3(luma(blurred)), blurred, 1.25);
                return clamp(mix(base, sat, blurWeight), 0.0, 1.0);
            }
            return base;
        }

        vec3 applyMotionColor(vec3 base, vec2 uv) {
            if (uMode == 2) {
                // Heartbeat edge red pulse
                float pulse = pow(0.5 + 0.5 * sin(uTimeSec * uParamA * 2.0 * PI), 2.0);
                float edge = smoothstep(0.3, 0.85, length(uv - 0.5));
                return clamp(base + vec3(0.95, 0.08, 0.18) * pulse * edge * uParamB, 0.0, 1.0);
            } else if (uMode == 3) {
                // Club strobe flash
                float flash = smoothstep(0.65, 1.0, sin(uTimeSec * uParamA * 2.0 * PI));
                return clamp(base + vec3(flash * uParamB * 0.65), 0.0, 1.0);
            } else if (uMode == 4) {
                // Directional H/V motion blur
                vec2 d = vec2(uParamA, uParamB);
                vec3 acc = base
                         + sampleRgb(uv + d)
                         + sampleRgb(uv - d)
                         + sampleRgb(uv + d * 2.0)
                         + sampleRgb(uv - d * 2.0);
                return acc * 0.2;
            }
            return base;
        }

        vec3 applyArtisticColor(vec3 base, vec2 uv) {
            if (uMode == 1) {
                // Posterize Pop
                float steps = max(uParamA, 2.0);
                return floor(base * steps + 0.5) / steps;
            } else if (uMode == 2) {
                // Comic Halftone dot grid
                float freq = max(uParamA, 16.0);
                float aspect = max(uResolutionX, 1.0) / max(uResolutionY, 1.0);
                vec2 cell = fract(uv * vec2(freq * aspect, freq)) - 0.5;
                float y = luma(base);
                float rad = sqrt(clamp(1.0 - y, 0.0, 1.0)) * 0.48;
                float dotMask = smoothstep(rad + 0.06, rad - 0.06, length(cell));
                return mix(base * 1.15, vec3(0.04, 0.05, 0.09), dotMask * 0.72);
            } else if (uMode == 3) {
                // Thermal Predator Heatmap
                float y = clamp(luma(base), 0.0, 1.0);
                vec3 c0 = vec3(0.05, 0.05, 0.45);
                vec3 c1 = vec3(0.0, 0.85, 0.95);
                vec3 c2 = vec3(1.0, 0.85, 0.0);
                vec3 c3 = vec3(1.0, 0.06, 0.16);
                vec3 heat = (y < 0.33)
                    ? mix(c0, c1, y / 0.33)
                    : ((y < 0.66) ? mix(c1, c2, (y - 0.33) / 0.33) : mix(c2, c3, (y - 0.66) / 0.34));
                return heat;
            } else if (uMode == 4) {
                // Night Vision NVG Green
                float y = luma(base);
                float scan = 0.92 + 0.08 * sin(uv.y * 140.0);
                float grain = (rand1(uv * 240.0 + fract(uTimeSec * 12.0)) - 0.5) * uParamB;
                float vig = 1.0 - smoothstep(0.42, 0.82, length(uv - 0.5));
                vec3 nvg = vec3(0.12, clamp(y * uParamA + 0.08, 0.0, 1.0), 0.22) * scan * vig + vec3(0.0, grain, 0.0);
                return clamp(nvg, 0.0, 1.0);
            }
            return base;
        }

        vec3 applyDuotoneEdge(vec3 base, vec2 uv) {
            if (uMode == 0) {
                // X-Ray negative
                return vec3(1.0 - luma(base)) * vec3(0.75, 0.95, 1.0);
            } else if (uMode == 1) {
                // Sobel neon / crimson edge outline
                float dx = 1.8 / max(uResolutionX, 1.0);
                float dy = 1.8 / max(uResolutionY, 1.0);
                float tl = luma(sampleRgb(uv + vec2(-dx, dy)));
                float tr = luma(sampleRgb(uv + vec2(dx, dy)));
                float bl = luma(sampleRgb(uv + vec2(-dx, -dy)));
                float br = luma(sampleRgb(uv + vec2(dx, -dy)));
                float gx = (tr + br) - (tl + bl);
                float gy = (tl + tr) - (bl + br);
                float edge = smoothstep(0.12, 0.55, sqrt(gx * gx + gy * gy));
                vec3 edgeCol = vec3(uParamA, uParamB, uParamC);
                return clamp(base * 0.22 + edgeCol * edge * 1.4, 0.0, 1.0);
            } else {
                // Duotone Cyan / Red
                float y = luma(base);
                return mix(vec3(0.06, 0.02, 0.08), vec3(0.0, 0.94, 1.0), smoothstep(0.15, 0.65, y))
                     + vec3(1.0, 0.06, 0.19) * smoothstep(0.65, 1.0, y) * 0.6;
            }
        }

        vec3 applyColorGrading(vec3 col) {
            // Exposure / Brightness
            vec3 c = col + vec3(uBrightness);
            // Contrast around mid-gray
            c = (c - 0.5) * uContrast + 0.5;
            // Temperature (warm vs cool)
            c.r += uTemperature * 0.16;
            c.b -= uTemperature * 0.16;
            // Saturation
            float y = luma(clamp(c, 0.0, 1.0));
            c = mix(vec3(y), c, uSaturation);
            // Optical Vignette
            if (uVignette > 0.001) {
                float d = length((vUv - 0.5) * vec2(1.0, max(uResolutionY, 1.0) / max(uResolutionX, 1.0)));
                float vig = smoothstep(0.32, 0.85, d);
                c *= (1.0 - vig * uVignette * 0.92);
            }
            return clamp(c, 0.0, 1.0);
        }

        vec2 rgbToCbCr(vec3 rgb) {
            float cb = -0.168736 * rgb.r - 0.331264 * rgb.g + 0.5 * rgb.b;
            float cr =  0.5 * rgb.r - 0.418688 * rgb.g - 0.081312 * rgb.b;
            return vec2(cb, cr);
        }

        vec3 applyChromaKey(vec3 col) {
            if (uChromaEnabled == 0) return col;
            vec3 keyRgb = vec3(uChromaR, uChromaG, uChromaB);
            vec2 keyCbCr = rgbToCbCr(keyRgb);
            vec2 pixCbCr = rgbToCbCr(col);
            float dist = distance(pixCbCr, keyCbCr);
            float sim = clamp(uChromaSimilarity, 0.02, 0.85);
            float sm = max(uChromaSmoothness, 0.01);
            float alpha = smoothstep(sim, sim + sm, dist);

            // Spill suppression toward key dominant channel
            vec3 despilled = col;
            if (keyRgb.g >= keyRgb.r && keyRgb.g >= keyRgb.b) {
                float maxRb = max(col.r, col.b);
                despilled.g = min(col.g, mix(col.g, maxRb, (1.0 - alpha) * 0.78));
            } else if (keyRgb.b >= keyRgb.r && keyRgb.b >= keyRgb.g) {
                float maxRg = max(col.r, col.g);
                despilled.b = min(col.b, mix(col.b, maxRg, (1.0 - alpha) * 0.78));
            } else {
                float maxGb = max(col.g, col.b);
                despilled.r = min(col.r, mix(col.r, maxGb, (1.0 - alpha) * 0.78));
            }

            // Studio OLED matte grid backdrop for clean keyed preview & compositing
            vec2 gridUv = floor(vUv * vec2(18.0, 32.0));
            float checker = mod(gridUv.x + gridUv.y, 2.0);
            vec3 backdrop = mix(vec3(0.02, 0.03, 0.05), vec3(0.04, 0.07, 0.11), checker);
            return mix(backdrop, despilled, alpha);
        }

        void main() {
            vec2 txUv = applyTransformUv(vUv);
            float inside = step(0.0, txUv.x) * step(txUv.x, 1.0) * step(0.0, txUv.y) * step(txUv.y, 1.0);
            vec2 safeTxUv = clamp(txUv, 0.0, 1.0);
            vec2 workUv = computeWarpedUv(safeTxUv);
            vec3 orig = sampleRgb(safeTxUv);
            vec3 base = sampleRgb(workUv);
            vec3 fxColor = base;

            if (uFamily == 1) {
                fxColor = applyLutTone(base);
            } else if (uFamily == 2) {
                fxColor = applyGlowBloom(base, workUv);
            } else if (uFamily == 3) {
                fxColor = applyGlitchColor(base, workUv);
            } else if (uFamily == 4) {
                fxColor = applyLensColor(base, workUv);
            } else if (uFamily == 5) {
                fxColor = applyMotionColor(base, workUv);
            } else if (uFamily == 6) {
                fxColor = applyArtisticColor(base, workUv);
            } else if (uFamily == 7) {
                fxColor = applyDuotoneEdge(base, workUv);
            }

            vec3 blended = (uFamily == 0) ? orig : mix(orig, fxColor, clamp(uIntensity, 0.0, 1.0));
            vec3 graded = applyColorGrading(blended);
            vec3 styled = applyBlendCurve(graded);
            vec3 keyed = applyChromaKey(styled);
            vec3 finalRgb = keyed * inside * clamp(uOpacity, 0.0, 1.0);
            gl_FragColor = vec4(clamp(finalRgb, 0.0, 1.0), 1.0);
        }
    """
}
