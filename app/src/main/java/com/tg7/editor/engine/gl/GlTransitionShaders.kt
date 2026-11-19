package com.tg7.editor.engine.gl

/**
 * OpenGL ES 2.0 (#version 100) GLSL shaders adapted from gl-transitions (MIT License).
 * Single uber-shader executes all 12 transition shader families (225 presets) at 60fps
 * across both ExoPlayer live preview and Media3 Transformer hardware export.
 */
object GlTransitionShaders {

    const val VERTEX_SHADER_GLSL: String = """
        attribute vec4 aFramePosition;
        varying vec2 vUv;
        void main() {
            gl_Position = aFramePosition;
            vUv = aFramePosition.xy * 0.5 + 0.5;
        }
    """

    const val COPY_FRAGMENT_SHADER_GLSL: String = """
        precision mediump float;
        varying vec2 vUv;
        uniform sampler2D uTexSampler;
        void main() {
            gl_FragColor = texture2D(uTexSampler, vUv);
        }
    """

    const val TRANSITION_FRAGMENT_SHADER_GLSL: String = """
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uToTex;
        uniform sampler2D uFromTex;
        uniform float uProgress;
        uniform int uFamily;
        uniform int uMode;
        uniform float uParamA;
        uniform float uParamB;
        uniform int uHasFrom;

        const float PI = 3.14159265;

        float rand2(vec2 co) {
            return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
        }

        vec4 sampleFrom(vec2 uv) {
            return texture2D(uFromTex, clamp(uv, 0.0, 1.0));
        }

        vec4 sampleTo(vec2 uv) {
            return texture2D(uToTex, clamp(uv, 0.0, 1.0));
        }

        float luma(vec4 c) {
            return dot(c.rgb, vec3(0.299, 0.587, 0.114));
        }

        vec2 zoomUv(vec2 uv, float amount) {
            return 0.5 + (uv - 0.5) * amount;
        }

        vec4 evalFade(vec2 uv, float p) {
            vec4 a = sampleFrom(uv);
            vec4 b = sampleTo(uv);
            if (uMode == 1) {
                vec4 black = vec4(0.0, 0.0, 0.0, 1.0);
                return mix(mix(a, black, smoothstep(0.0, 0.5, p)), b, smoothstep(0.5, 1.0, p));
            } else if (uMode == 2) {
                vec4 white = vec4(1.0, 1.0, 1.0, 1.0);
                return mix(mix(a, white, smoothstep(0.0, 0.5, p)), b, smoothstep(0.5, 1.0, p));
            } else if (uMode == 3) {
                vec4 dip = vec4(uParamA, uParamB * 0.85, 1.0 - uParamA * 0.85, 1.0);
                return mix(mix(a, dip, smoothstep(0.0, 0.5, p)), b, smoothstep(0.5, 1.0, p));
            } else if (uMode == 4) {
                float softness = max(0.15, uParamA);
                float dream = smoothstep(0.0, 1.0, clamp((p - 0.15) / softness, 0.0, 1.0));
                vec4 blurA = (sampleFrom(uv + vec2(0.008 * p, 0.0)) + sampleFrom(uv - vec2(0.008 * p, 0.0))) * 0.5;
                return mix(blurA, b, dream);
            } else if (uMode == 5) {
                float burn = sin(p * PI) * 0.65;
                vec4 warm = vec4(1.0, 0.45, 0.1, 1.0) * burn;
                return clamp(mix(a, b, p) + warm * uParamA, 0.0, 1.0);
            } else {
                float l = luma(mix(a, b, 0.5));
                float cut = smoothstep(l - 0.25, l + 0.25, p * 1.4 - 0.2);
                float mixAmt = (uMode == 0) ? p : mix(p, cut, clamp(uParamB + 0.5, 0.0, 1.0));
                return mix(a, b, mixAmt);
            }
        }

        vec4 evalWipe(vec2 uv, float p) {
            vec4 a = sampleFrom(uv);
            vec4 b = sampleTo(uv);
            float feather = clamp(abs(uParamB) * 0.14 + 0.02, 0.01, 0.25);
            if (uMode == 1) {
                float d = abs(uv.x - 0.5) * 2.0;
                float m = smoothstep(p - feather, p + feather, d);
                return (uParamA >= 0.0) ? mix(b, a, m) : mix(a, b, m);
            } else if (uMode == 2) {
                float d = abs(uv.y - 0.5) * 2.0;
                float m = smoothstep(p - feather, p + feather, d);
                return (uParamA >= 0.0) ? mix(b, a, m) : mix(a, b, m);
            }
            vec2 dir = vec2(uParamA, uParamB);
            float dLen = max(0.001, length(dir));
            dir /= dLen;
            float proj = dot(uv - 0.5, dir) + 0.5;
            float mask = smoothstep(proj - feather, proj + feather, p * 1.2 - 0.1);
            return mix(a, b, mask);
        }

        vec4 evalSlide(vec2 uv, float p) {
            vec2 dir = vec2(uParamA, uParamB);
            if (length(dir) < 0.01) dir = vec2(-1.0, 0.0);
            float ep = p * p * (3.0 - 2.0 * p);
            vec2 pFrom = uv - dir * ep;
            vec2 pTo = uv + dir * (1.0 - ep);
            if (uMode == 0 || uMode == 2) {
                bool inTo = (pTo.x >= 0.0 && pTo.x <= 1.0 && pTo.y >= 0.0 && pTo.y <= 1.0);
                return inTo ? sampleTo(pTo) : sampleFrom(uv);
            }
            bool inFrom = (pFrom.x >= 0.0 && pFrom.x <= 1.0 && pFrom.y >= 0.0 && pFrom.y <= 1.0);
            return inFrom ? sampleFrom(pFrom) : sampleTo(pTo);
        }

        vec4 evalZoom(vec2 uv, float p) {
            float scale = max(0.15, uParamA);
            float q = p * p * (3.0 - 2.0 * p);
            if (uMode == 1) {
                vec2 uA = zoomUv(uv, 1.0 + q * (1.0 - scale));
                vec2 uB = zoomUv(uv, 1.0 - (1.0 - q) * 0.45);
                return mix(sampleFrom(uA), sampleTo(uB), q);
            } else if (uMode == 2) {
                vec4 acc = vec4(0.0);
                float strength = sin(q * PI) * 0.25 * clamp(scale, 0.5, 4.0);
                for (int i = 0; i < 6; i++) {
                    float f = float(i) / 5.0;
                    vec2 zUv = zoomUv(uv, 1.0 - f * strength);
                    acc += mix(sampleFrom(zUv), sampleTo(zUv), q);
                }
                return acc / 6.0;
            } else if (uMode == 3 || uMode == 4) {
                vec2 d = uv - 0.5;
                float r = length(d);
                float warp = 1.0 + sin(q * PI) * uParamB * 0.45 * r * r;
                vec2 wUv = 0.5 + d * warp;
                return mix(sampleFrom(wUv), sampleTo(zoomUv(uv, 1.0 - (1.0 - q) * 0.3)), q);
            }
            vec2 zA = zoomUv(uv, 1.0 - q * 0.55);
            vec2 zB = zoomUv(uv, 1.0 + (1.0 - q) * 0.45);
            return mix(sampleFrom(zA), sampleTo(zB), q);
        }

        vec4 evalGlitch(vec2 uv, float p) {
            float env = sin(p * PI);
            float freq = max(4.0, uParamB);
            float amp = clamp(abs(uParamA), 0.02, 1.6) * env;
            if (uMode == 1) {
                float shift = amp * 0.08;
                vec2 uR = uv + vec2(shift, 0.0);
                vec2 uB = uv - vec2(shift, 0.0);
                vec4 a = vec4(sampleFrom(uR).r, sampleFrom(uv).g, sampleFrom(uB).b, 1.0);
                vec4 b = vec4(sampleTo(uR).r, sampleTo(uv).g, sampleTo(uB).b, 1.0);
                return mix(a, b, p);
            } else if (uMode == 2 || uMode == 3) {
                float band = floor(uv.y * freq);
                float j = (rand2(vec2(band, floor(p * 24.0))) - 0.5) * amp * 0.22;
                vec2 dUv = vec2(fract(uv.x + j), uv.y);
                float scan = 1.0 - 0.18 * env * step(0.5, fract(uv.y * 80.0));
                return mix(sampleFrom(dUv), sampleTo(dUv), smoothstep(0.2, 0.8, p)) * vec4(scan, scan, scan, 1.0);
            } else if (uMode == 4) {
                float n = rand2(floor(uv * freq) + floor(p * 18.0));
                float cut = step(1.0 - p, n);
                return mix(sampleFrom(uv), sampleTo(uv), cut);
            }
            vec2 blk = floor(uv * vec2(8.0, freq)) / vec2(8.0, freq);
            float disp = (rand2(blk + floor(p * 12.0)) - 0.5) * 0.16 * env;
            vec2 rUv = uv + vec2(disp + 0.02 * env, 0.0);
            vec2 bUv = uv - vec2(disp + 0.02 * env, 0.0);
            vec4 colA = vec4(sampleFrom(rUv).r, sampleFrom(uv).g, sampleFrom(bUv).b, 1.0);
            vec4 colB = vec4(sampleTo(rUv).r, sampleTo(uv).g, sampleTo(bUv).b, 1.0);
            return mix(colA, colB, smoothstep(0.15, 0.85, p));
        }

        vec4 evalCube3D(vec2 uv, float p) {
            float ep = p * p * (3.0 - 2.0 * p);
            if (uMode == 1) {
                bool horiz = abs(uParamA) >= abs(uParamB);
                float s = horiz ? abs(cos(ep * PI)) : 1.0;
                float sy = !horiz ? abs(cos(ep * PI)) : 1.0;
                vec2 cUv = (uv - 0.5) / vec2(max(0.02, s), max(0.02, sy)) + 0.5;
                if (cUv.x < 0.0 || cUv.x > 1.0 || cUv.y < 0.0 || cUv.y > 1.0) {
                    return vec4(0.02, 0.03, 0.06, 1.0);
                }
                return (ep < 0.5) ? sampleFrom(cUv) : sampleTo(cUv);
            } else if (uMode == 2) {
                float gap = (uParamA >= 0.0) ? ep * 0.5 : (1.0 - ep) * 0.5;
                if (abs(uv.x - 0.5) < gap) {
                    return (uParamA >= 0.0) ? sampleTo(uv) : sampleFrom(uv);
                }
                vec2 sUv = uv;
                sUv.x = (uv.x < 0.5) ? uv.x / max(0.05, 1.0 - gap * 2.0) : 1.0 - (1.0 - uv.x) / max(0.05, 1.0 - gap * 2.0);
                return (uParamA >= 0.0) ? sampleFrom(sUv) : sampleTo(sUv);
            }
            bool vertical = abs(uParamB) > abs(uParamA);
            float dir = vertical ? sign(uParamB) : sign(uParamA);
            if (dir == 0.0) dir = 1.0;
            float coord = vertical ? uv.y : uv.x;
            float split = (dir > 0.0) ? ep : (1.0 - ep);
            float persp = 1.0 + 0.28 * sin(ep * PI);
            if ((dir > 0.0 && coord < split) || (dir < 0.0 && coord > split)) {
                vec2 tUv = uv;
                if (vertical) {
                    tUv.y = (dir > 0.0) ? (coord / max(0.001, split)) : ((coord - split) / max(0.001, 1.0 - split));
                    tUv.x = 0.5 + (uv.x - 0.5) * mix(persp, 1.0, ep);
                } else {
                    tUv.x = (dir > 0.0) ? (coord / max(0.001, split)) : ((coord - split) / max(0.001, 1.0 - split));
                    tUv.y = 0.5 + (uv.y - 0.5) * mix(persp, 1.0, ep);
                }
                return (dir > 0.0) ? sampleTo(tUv) : sampleTo(tUv);
            } else {
                vec2 fUv = uv;
                if (vertical) {
                    fUv.y = (dir > 0.0) ? ((coord - split) / max(0.001, 1.0 - split)) : (coord / max(0.001, split));
                    fUv.x = 0.5 + (uv.x - 0.5) * mix(1.0, persp, ep);
                } else {
                    fUv.x = (dir > 0.0) ? ((coord - split) / max(0.001, 1.0 - split)) : (coord / max(0.001, split));
                    fUv.y = 0.5 + (uv.y - 0.5) * mix(1.0, persp, ep);
                }
                return sampleFrom(fUv);
            }
        }

        vec4 evalSwirlRipple(vec2 uv, float p) {
            vec2 dir = uv - 0.5;
            float dist = length(dir);
            if (uMode == 2) {
                float angle = sin(p * PI) * uParamA * max(0.0, 1.0 - dist * 1.4);
                float c = cos(angle);
                float s = sin(angle);
                vec2 rUv = vec2(dir.x * c - dir.y * s, dir.x * s + dir.y * c) + 0.5;
                return mix(sampleFrom(rUv), sampleTo(rUv), p);
            } else if (uMode == 3) {
                float amp = sin(p * PI) * abs(uParamB) * 0.45;
                vec2 wUv = uv + vec2(sin(uv.y * uParamA + p * 8.0) * amp, cos(uv.x * uParamA + p * 8.0) * amp * 0.5);
                return mix(sampleFrom(wUv), sampleTo(wUv), p);
            }
            float freq = max(6.0, uParamA);
            float amp = sin(p * PI) * clamp(abs(uParamB), 0.02, 0.2);
            vec2 offset = (dist > 0.0001) ? (dir / dist) * sin(dist * freq - p * 12.0) * amp : vec2(0.0);
            return mix(sampleFrom(uv + offset), sampleTo(uv - offset * 0.4), smoothstep(0.15, 0.85, p));
        }

        vec4 evalRadialPinwheel(vec2 uv, float p) {
            vec2 d = uv - 0.5;
            float feather = clamp(abs(uParamB), 0.01, 0.28);
            if (uMode == 0) {
                float ang = atan(d.y, d.x + 0.0001);
                float normAng = fract((ang * uParamA + PI) / (2.0 * PI));
                float m = smoothstep(normAng - feather, normAng + feather, p * 1.1 - 0.05);
                return mix(sampleFrom(uv), sampleTo(uv), m);
            } else if (uMode == 2 || uMode == 3) {
                float blades = max(2.0, abs(uParamA));
                float ang = atan(d.y, d.x + 0.0001) + p * 1.2;
                float sector = fract((ang / (2.0 * PI)) * blades);
                float m = smoothstep(sector - 0.08, sector + 0.08, p * 1.15 - 0.07);
                return mix(sampleFrom(uv), sampleTo(uv), m);
            }
            float r = length(d) * 1.42;
            float th = (uParamA >= 0.0) ? smoothstep(r - feather, r + feather, p * 1.15 - 0.05)
                                      : 1.0 - smoothstep(r - feather, r + feather, (1.0 - p) * 1.15 - 0.05);
            return mix(sampleFrom(uv), sampleTo(uv), th);
        }

        vec4 evalLightFlash(vec2 uv, float p) {
            vec4 a = sampleFrom(uv);
            vec4 b = sampleTo(uv);
            float peak = pow(sin(p * PI), 1.6);
            vec3 tint = (uMode == 1) ? vec3(uParamA, uParamB, 1.0 - uParamA * 0.7)
                      : ((uMode == 2) ? vec3(1.0, uParamB, 0.25)
                                      : vec3(1.0, 1.0, 1.0));
            if (uMode == 3) {
                float beam = exp(-abs((uv.x - p * 1.4 + 0.2)) * 12.0) * peak;
                return clamp(mix(a, b, smoothstep(0.25, 0.75, p)) + vec4(tint * beam * 1.4, 0.0), 0.0, 1.0);
            }
            float strength = clamp(abs(uParamA) + 0.6, 0.8, 2.2);
            vec4 base = (p < 0.5) ? a : b;
            return clamp(mix(base, vec4(tint, 1.0), peak * 0.85) + vec4(tint * peak * 0.35 * strength, 0.0), 0.0, 1.0);
        }

        vec4 evalMosaicGrid(vec2 uv, float p) {
            float cells = clamp(uParamA, 3.0, 48.0);
            if (uMode == 0) {
                float curCells = mix(cells * 4.0, 2.0, sin(p * PI)) + 2.0;
                vec2 pUv = (floor(uv * curCells) + 0.5) / curCells;
                return mix(sampleFrom(pUv), sampleTo(pUv), p);
            } else if (uMode == 1) {
                vec2 c = floor(uv * cells);
                float delay = mod(c.x + c.y, 2.0) * 0.35 + (c.x / cells) * 0.25;
                float m = smoothstep(delay, delay + 0.4, p);
                return mix(sampleFrom(uv), sampleTo(uv), m);
            }
            vec2 cell = floor(uv * cells);
            float threshold = rand2(cell);
            float m = smoothstep(threshold - 0.15, threshold + 0.15, p * 1.3 - 0.15);
            return mix(sampleFrom(uv), sampleTo(uv), m);
        }

        vec4 evalBlurWhip(vec2 uv, float p) {
            float env = sin(p * PI);
            if (uMode == 2 || uMode == 3) {
                vec2 d = uv - 0.5;
                vec4 acc = vec4(0.0);
                for (int i = 0; i < 6; i++) {
                    float f = (float(i) - 2.5) * 0.025 * env;
                    vec2 sUv = (uMode == 2) ? (0.5 + d * (1.0 - f * 2.0))
                                            : vec2(d.x * cos(f * 3.0) - d.y * sin(f * 3.0), d.x * sin(f * 3.0) + d.y * cos(f * 3.0)) + 0.5;
                    acc += mix(sampleFrom(sUv), sampleTo(sUv), smoothstep(0.2, 0.8, p));
                }
                return acc / 6.0;
            }
            vec2 dir = vec2(uParamA, uParamB);
            if (length(dir) < 0.01) dir = vec2(1.0, 0.0);
            float slide = (uMode == 1) ? p : 0.0;
            vec4 acc = vec4(0.0);
            for (int i = 0; i < 6; i++) {
                float k = (float(i) - 2.5) * 0.022 * env;
                vec2 aUv = fract(uv - dir * (slide * 0.5 + k));
                vec2 bUv = fract(uv + dir * ((1.0 - slide) * 0.5 + k));
                acc += mix(sampleFrom(aUv), sampleTo(bUv), smoothstep(0.25, 0.75, p));
            }
            return acc / 6.0;
        }

        vec4 evalKaleidoShape(vec2 uv, float p) {
            if (uMode == 0) {
                float d = abs(uv.x - 0.5) + abs(uv.y - 0.5);
                float m = (uParamA >= 0.0) ? smoothstep(d - 0.06, d + 0.06, p * 1.15 - 0.05)
                                           : 1.0 - smoothstep(d - 0.06, d + 0.06, (1.0 - p) * 1.15 - 0.05);
                return mix(sampleFrom(uv), sampleTo(uv), m);
            } else if (uMode == 2) {
                float bar = abs(uv.y - 0.5) * 2.0;
                float m = (uParamA >= 0.0) ? step(bar, p) : 1.0 - step(bar, 1.0 - p);
                return mix(sampleFrom(uv), sampleTo(uv), m);
            } else if (uMode == 3) {
                float streak = exp(-abs(uv.y - 0.5) * 14.0) * sin(p * PI);
                return clamp(mix(sampleFrom(uv), sampleTo(uv), p) + vec4(0.0, 0.85, 1.0, 1.0) * streak * 0.75, 0.0, 1.0);
            }
            vec2 d = uv - 0.5;
            float r = length(d);
            float folds = max(3.0, abs(uParamA));
            float ang = atan(d.y, d.x + 0.0001) + p * uParamB;
            float seg = 2.0 * PI / folds;
            ang = abs(mod(ang, seg) - seg * 0.5);
            vec2 kUv = 0.5 + vec2(cos(ang), sin(ang)) * r;
            vec2 mixUv = mix(uv, kUv, sin(p * PI));
            return mix(sampleFrom(mixUv), sampleTo(mixUv), smoothstep(0.15, 0.85, p));
        }

        void main() {
            if (uHasFrom == 0) {
                gl_FragColor = sampleTo(vUv);
                return;
            }
            float p = clamp(uProgress, 0.0, 1.0);
            if (uFamily == 0) {
                gl_FragColor = evalFade(vUv, p);
            } else if (uFamily == 1) {
                gl_FragColor = evalWipe(vUv, p);
            } else if (uFamily == 2) {
                gl_FragColor = evalSlide(vUv, p);
            } else if (uFamily == 3) {
                gl_FragColor = evalZoom(vUv, p);
            } else if (uFamily == 4) {
                gl_FragColor = evalGlitch(vUv, p);
            } else if (uFamily == 5) {
                gl_FragColor = evalCube3D(vUv, p);
            } else if (uFamily == 6) {
                gl_FragColor = evalSwirlRipple(vUv, p);
            } else if (uFamily == 7) {
                gl_FragColor = evalRadialPinwheel(vUv, p);
            } else if (uFamily == 8) {
                gl_FragColor = evalLightFlash(vUv, p);
            } else if (uFamily == 9) {
                gl_FragColor = evalMosaicGrid(vUv, p);
            } else if (uFamily == 10) {
                gl_FragColor = evalBlurWhip(vUv, p);
            } else {
                gl_FragColor = evalKaleidoShape(vUv, p);
            }
        }
    """
}
