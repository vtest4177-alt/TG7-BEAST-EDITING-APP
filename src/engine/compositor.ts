import {
  Clip,
  Keyframe,
  ProjectState,
  SpeedPoint,
  TextAnimationType,
  TextStylePreset,
  VideoEffectType,
} from '../types/editor';
import { svgMarkupToDataUrl } from '../data/svgStickers';
import { applyWebGlEffectPass } from './glEffectRenderer';
import { renderGlTransitionFrame } from './glTransitionRenderer';

export interface InterpolatedTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

let cachedFastCanvas: HTMLCanvasElement | null = null;
let cachedFastCtx: CanvasRenderingContext2D | null = null;
let cachedChromaCanvas: HTMLCanvasElement | null = null;
let cachedChromaCtx: CanvasRenderingContext2D | null = null;
let cachedTransFromCanvas: HTMLCanvasElement | null = null;
let cachedTransFromCtx: CanvasRenderingContext2D | null = null;
let cachedTransToCanvas: HTMLCanvasElement | null = null;
let cachedTransToCtx: CanvasRenderingContext2D | null = null;
const svgImageCache = new Map<string, HTMLImageElement>();
const videoLastFrameCache = new Map<string, HTMLCanvasElement>();

function updateCachedVideoFrame(
  key: string,
  el: HTMLVideoElement,
  fitMode: 'contain' | 'cover',
  width: number,
  height: number
): void {
  let cache = videoLastFrameCache.get(key);
  if (!cache) {
    cache = document.createElement('canvas');
    videoLastFrameCache.set(key, cache);
  }
  if (cache.width !== width || cache.height !== height) {
    cache.width = width;
    cache.height = height;
  }
  const cctx = cache.getContext('2d');
  if (!cctx) return;
  const mediaW = el.videoWidth || width;
  const mediaH = el.videoHeight || height;
  const fitScale =
    fitMode === 'cover'
      ? Math.max(width / mediaW, height / mediaH)
      : Math.min(width / mediaW, height / mediaH);
  const drawW = mediaW * fitScale;
  const drawH = mediaH * fitScale;
  cctx.clearRect(0, 0, width, height);
  cctx.drawImage(el, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
}

function getOffscreenTarget(
  width: number,
  height: number,
  needsPixelRead: boolean
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null } {
  if (needsPixelRead) {
    if (!cachedChromaCanvas) {
      cachedChromaCanvas = document.createElement('canvas');
      cachedChromaCtx = cachedChromaCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (cachedChromaCanvas.width !== width || cachedChromaCanvas.height !== height) {
      cachedChromaCanvas.width = width;
      cachedChromaCanvas.height = height;
    }
    return { canvas: cachedChromaCanvas, ctx: cachedChromaCtx };
  }
  if (!cachedFastCanvas) {
    cachedFastCanvas = document.createElement('canvas');
    cachedFastCtx = cachedFastCanvas.getContext('2d');
  }
  if (cachedFastCanvas.width !== width || cachedFastCanvas.height !== height) {
    cachedFastCanvas.width = width;
    cachedFastCanvas.height = height;
  }
  return { canvas: cachedFastCanvas, ctx: cachedFastCtx };
}

function getTransitionBuffers(width: number, height: number) {
  if (!cachedTransFromCanvas) {
    cachedTransFromCanvas = document.createElement('canvas');
    cachedTransFromCtx = cachedTransFromCanvas.getContext('2d');
  }
  if (!cachedTransToCanvas) {
    cachedTransToCanvas = document.createElement('canvas');
    cachedTransToCtx = cachedTransToCanvas.getContext('2d');
  }
  if (cachedTransFromCanvas.width !== width || cachedTransFromCanvas.height !== height) {
    cachedTransFromCanvas.width = width;
    cachedTransFromCanvas.height = height;
  }
  if (cachedTransToCanvas.width !== width || cachedTransToCanvas.height !== height) {
    cachedTransToCanvas.width = width;
    cachedTransToCanvas.height = height;
  }
  return {
    fromCanvas: cachedTransFromCanvas,
    fromCtx: cachedTransFromCtx,
    toCanvas: cachedTransToCanvas,
    toCtx: cachedTransToCtx,
  };
}

export function formatTimecode(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const hundredths = Math.floor((safe % 1) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

export function getProjectDuration(project: ProjectState): number {
  if (project.clips.length === 0) return 10;
  const maxEnd = Math.max(...project.clips.map((c) => c.startSec + c.durationSec));
  return Math.max(4, Math.ceil(maxEnd * 10) / 10);
}

function cubicEaseInOut(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

export function interpolateTransform(clip: Clip, localTime: number): InterpolatedTransform {
  const kfs = [...clip.keyframes].sort((a, b) => a.timeOffset - b.timeOffset);
  if (kfs.length === 0) {
    return { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };
  }
  if (localTime <= kfs[0].timeOffset) {
    const k = kfs[0];
    return { x: k.x, y: k.y, scale: k.scale, rotation: k.rotation, opacity: k.opacity };
  }
  if (localTime >= kfs[kfs.length - 1].timeOffset) {
    const k = kfs[kfs.length - 1];
    return { x: k.x, y: k.y, scale: k.scale, rotation: k.rotation, opacity: k.opacity };
  }

  for (let i = 0; i < kfs.length - 1; i++) {
    const a: Keyframe = kfs[i];
    const b: Keyframe = kfs[i + 1];
    if (localTime >= a.timeOffset && localTime <= b.timeOffset) {
      const span = Math.max(0.0001, b.timeOffset - a.timeOffset);
      const eased = cubicEaseInOut((localTime - a.timeOffset) / span);
      return {
        x: a.x + (b.x - a.x) * eased,
        y: a.y + (b.y - a.y) * eased,
        scale: a.scale + (b.scale - a.scale) * eased,
        rotation: a.rotation + (b.rotation - a.rotation) * eased,
        opacity: a.opacity + (b.opacity - a.opacity) * eased,
      };
    }
  }
  return { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };
}

export function evaluateSpeedAt(points: SpeedPoint[], normalizedPos: number): number {
  if (!points || points.length === 0) return 1;
  const sorted = [...points].sort((a, b) => a.position - b.position);
  const p = Math.max(0, Math.min(1, normalizedPos));
  if (p <= sorted[0].position) return sorted[0].speed;
  if (p >= sorted[sorted.length - 1].position) return sorted[sorted.length - 1].speed;

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (p >= a.position && p <= b.position) {
      const span = Math.max(0.0001, b.position - a.position);
      const t = cubicEaseInOut((p - a.position) / span);
      return a.speed + (b.speed - a.speed) * t;
    }
  }
  return 1;
}

export function computeRemappedSourceTime(clip: Clip, localTime: number): number {
  const duration = Math.max(0.1, clip.durationSec);
  const steps = 16;
  const targetRatio = Math.max(0, Math.min(1, localTime / duration));
  const dt = (targetRatio * duration) / steps;
  let accumulated = 0;
  for (let i = 0; i < steps; i++) {
    const midPos = ((i + 0.5) / steps) * targetRatio;
    accumulated += evaluateSpeedAt(clip.speedRamp.points, midPos) * dt;
  }
  return clip.trimStartSec + accumulated;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [0, 255, 0];
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function applyChromaKeyBuffer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  targetHex: string,
  similarity: number,
  smoothness: number
): void {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const [tr, tg, tb] = hexToRgb(targetHex);

  const threshold = (similarity / 100) * 255;
  const feather = Math.max(4, (smoothness / 100) * 140);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const alpha = data[i + 3];
    if (alpha === 0) continue;

    const dr = r - tr;
    const dg = g - tg;
    const db = b - tb;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);

    if (dist < threshold) {
      data[i + 3] = 0;
    } else if (dist < threshold + feather) {
      const factor = (dist - threshold) / feather;
      data[i + 3] = Math.round(alpha * factor);
      if (tg > tr && tg > tb && data[i + 1] > Math.max(r, b)) {
        data[i + 1] = Math.round(data[i + 1] * (0.72 + 0.28 * factor));
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

function drawStockScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  variant: string,
  t: number
): void {
  if (variant === 'hyper-warp') {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w * 0.7);
    grad.addColorStop(0, '#2E1065');
    grad.addColorStop(0.6, '#110C22');
    grad.addColorStop(1, '#050508');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 2;
      const r1 = ((t * 180 + i * 25) % (w * 0.55)) + 20;
      const r2 = r1 + 65;
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(167,139,250,0.75)' : 'rgba(0,202,224,0.6)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(w / 2 + Math.cos(angle) * r1, h / 2 + Math.sin(angle) * r1);
      ctx.lineTo(w / 2 + Math.cos(angle) * r2, h / 2 + Math.sin(angle) * r2);
      ctx.stroke();
    }
    return;
  }

  if (variant === 'digital-rain') {
    ctx.fillStyle = '#04120E';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(52, 211, 153, 0.65)';
    ctx.font = '600 18px "JetBrains Mono", monospace';
    for (let col = 0; col < 24; col++) {
      const x = (col / 24) * w + 12;
      const y = ((t * (120 + (col % 5) * 40) + col * 60) % (h + 120)) - 60;
      ctx.fillText(col % 2 === 0 ? '01' : '10', x, y);
      ctx.fillText('7', x, y - 28);
    }
    return;
  }

  if (variant === 'synth-horizon') {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1B0B2E');
    grad.addColorStop(0.55, '#4A1249');
    grad.addColorStop(1, '#0B0812');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    const sunGrad = ctx.createLinearGradient(0, h * 0.2, 0, h * 0.55);
    sunGrad.addColorStop(0, '#FBBF24');
    sunGrad.addColorStop(1, '#F472B6');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.44, Math.min(w, h) * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0B0812';
    ctx.fillRect(0, h * 0.55, w, h * 0.45);
    ctx.strokeStyle = 'rgba(244, 114, 182, 0.35)';
    ctx.lineWidth = 1.5;
    for (let i = -6; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + i * 26, h * 0.55);
      ctx.lineTo(w / 2 + i * 160, h);
      ctx.stroke();
    }
    return;
  }

  if (variant === 'ember-dust') {
    ctx.fillStyle = '#120A05';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 32; i++) {
      const x = (((i * 97 + Math.sin(t * 2 + i) * 40) % w) + w) % w;
      const y = h - ((t * 75 + i * 45) % (h + 40));
      ctx.fillStyle = i % 2 === 0 ? 'rgba(251,191,36,0.75)' : 'rgba(249,115,22,0.65)';
      ctx.beginPath();
      ctx.arc(x, y, 2 + (i % 4), 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  if (variant === 'countdown') {
    ctx.fillStyle = '#09090B';
    ctx.fillRect(0, 0, w, h);
    const num = Math.max(1, 3 - Math.floor(t % 3));
    const frac = t % 1;
    ctx.strokeStyle = '#00CAE0';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 110, -Math.PI / 2, -Math.PI / 2 + (1 - frac) * Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 110px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(num), w / 2, h / 2);
    return;
  }

  if (variant === 'cinema-bars') {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#141720');
    grad.addColorStop(1, '#07080B');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    const barH = Math.min(h * 0.14, 70);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, barH);
    ctx.fillRect(0, h - barH, w, barH);
    return;
  }

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#0F172A');
  grad.addColorStop(0.55, '#1E293B');
  grad.addColorStop(1, '#090D16');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.strokeStyle = 'rgba(0, 202, 224, 0.26)';
  ctx.lineWidth = 1.5;
  const horizonY = h * 0.56;
  const scroll = (t * 80) % 60;
  for (let i = -8; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(w / 2 + i * 24, horizonY);
    ctx.lineTo(w / 2 + i * 190, h);
    ctx.stroke();
  }
  for (let row = 0; row < 10; row++) {
    const p = ((row * 60 + scroll) % 600) / 600;
    const y = horizonY + Math.pow(p, 1.8) * (h - horizonY);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
}

export function generateStockThumbnailDataUrl(variant: string): string {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 90;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  drawStockScene(ctx, 160, 90, variant, 1.2);
  return c.toDataURL('image/jpeg', 0.72);
}

function drawProceduralClutch(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  remappedTime: number,
  speedNow: number
): void {
  const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 40, w * 0.5, h * 0.5, w * 0.7);
  grad.addColorStop(0, '#1E1B4B');
  grad.addColorStop(0.55, '#111827');
  grad.addColorStop(1, '#09090B');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  for (let i = 0; i < 16; i++) {
    const progress = (remappedTime * (1.1 + (i % 4) * 0.35) + i * 0.19) % 1;
    const x = progress * (w + 300) - 150;
    const y = ((i * 73) % (h - 80)) + 40;
    const len = 60 + speedNow * 50;
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(0, 202, 224, 0.65)' : 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = i % 3 === 0 ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - len, y + 14);
    ctx.stroke();
  }
  ctx.restore();
}

function drawProceduralChromaBadge(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  remappedTime: number
): void {
  ctx.fillStyle = '#00FF00';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#111827';
  ctx.strokeStyle = '#00CAE0';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(-160, -70, 320, 140, 16);
  ctx.fill();
  ctx.stroke();
  const barW = 140 + Math.sin(remappedTime * 4) * 35;
  ctx.fillStyle = '#00CAE0';
  ctx.fillRect(-barW / 2, 32, barW, 4);
  ctx.fillStyle = '#F8FAFC';
  ctx.font = '700 40px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TG7 LAYER', 0, -10);
  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 15px "JetBrains Mono", monospace';
  ctx.fillText('CHROMA KEY DEMO', 0, 18);
  ctx.restore();
}

function drawSvgSticker(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  clip: Clip,
  localTime: number
): void {
  const markup = clip.svgMarkup;
  if (!markup) return;
  const accent = clip.svgAccent || '#00CAE0';
  const cacheKey = `${accent}::${markup}`;
  let img = svgImageCache.get(cacheKey);
  if (!img) {
    img = new Image();
    img.src = svgMarkupToDataUrl(markup, accent);
    svgImageCache.set(cacheKey, img);
  }
  if (!img.complete || img.naturalWidth === 0) return;

  const pop = localTime < 0.22 ? 0.55 + (localTime / 0.22) * 0.45 : 1.0;
  const targetBox = Math.min(w, h) * 0.44 * pop;
  const aspect = img.naturalWidth / Math.max(1, img.naturalHeight);
  const drawW = aspect >= 1 ? targetBox : targetBox * aspect;
  const drawH = aspect >= 1 ? targetBox / aspect : targetBox;

  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 18;
  ctx.drawImage(img, (w - drawW) / 2, (h - drawH) / 2, drawW, drawH);
  ctx.restore();
}

function buildLinearGradientForText(
  ctx: CanvasRenderingContext2D,
  boxW: number,
  boxH: number,
  angleDeg: number,
  c1: string,
  c2: string
): CanvasGradient {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const halfLen = Math.max(boxW, boxH) * 0.55;
  const dx = Math.cos(rad) * halfLen;
  const dy = Math.sin(rad) * halfLen;
  const grad = ctx.createLinearGradient(-dx, -dy, dx, dy);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  return grad;
}

function drawSpacedLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  letterSpacing: number,
  mode: 'fill' | 'stroke'
): void {
  if (letterSpacing === 0 || text.length <= 1) {
    if (mode === 'stroke') ctx.strokeText(text, 0, y);
    else ctx.fillText(text, 0, y);
    return;
  }
  const chars = Array.from(text);
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const totalW = widths.reduce((a, b) => a + b, 0) + letterSpacing * (chars.length - 1);
  let cursorX = -totalW / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  for (let i = 0; i < chars.length; i++) {
    if (mode === 'stroke') ctx.strokeText(chars[i], cursorX, y);
    else ctx.fillText(chars[i], cursorX, y);
    cursorX += widths[i] + letterSpacing;
  }
  ctx.textAlign = prevAlign;
}

function measureSpacedLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  letterSpacing: number
): number {
  if (letterSpacing === 0 || text.length <= 1) {
    return ctx.measureText(text).width;
  }
  const chars = Array.from(text);
  const base = chars.reduce((acc, ch) => acc + ctx.measureText(ch).width, 0);
  return base + letterSpacing * (chars.length - 1);
}

function drawAnimatedText(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  clip: Clip,
  localTime: number
): void {
  const rawText = clip.textContent || clip.name || 'TEXT';
  const fullText = clip.textUppercase ? rawText.toUpperCase() : rawText;
  const anim: TextAnimationType = clip.textAnimation || 'none';
  const stylePreset: TextStylePreset = clip.textStyle || 'outline';
  const fontFam = clip.fontFamily || 'Outfit';
  const fontSize = Math.max(24, Math.min(160, clip.fontSize || 74));
  const color = clip.textColor || '#FFFFFF';
  const letterSpacing = clip.textLetterSpacing ?? 0;

  let visibleText = fullText;
  let offsetX = 0;
  let offsetY = 0;
  let scaleX = 1;
  let scaleY = 1;
  let extraRot = 0;
  let skewX = 0;
  let extraAlpha = 1;

  // Execute authentic Animate.css keyframe motion curves on canvas
  const tNorm = Math.min(1, localTime / 0.75);

  if (anim === 'typewriter') {
    const progress = Math.min(1, localTime / Math.min(1.6, clip.durationSec * 0.7));
    const chars = Math.max(1, Math.ceil(fullText.length * progress));
    visibleText = fullText.slice(0, chars);
  } else if (anim === 'bounceIn') {
    if (tNorm < 0.2) {
      const s = 0.3 + (tNorm / 0.2) * 0.82;
      scaleX = scaleY = s;
      extraAlpha = tNorm / 0.2;
    } else if (tNorm < 0.45) {
      const s = 1.12 - ((tNorm - 0.2) / 0.25) * 0.22;
      scaleX = scaleY = s;
    } else if (tNorm < 0.7) {
      const s = 0.9 + ((tNorm - 0.45) / 0.25) * 0.14;
      scaleX = scaleY = s;
    } else {
      const s = 1.04 - ((tNorm - 0.7) / 0.3) * 0.04;
      scaleX = scaleY = s;
    }
  } else if (anim === 'rubberBand') {
    if (tNorm < 0.3) {
      const p = tNorm / 0.3;
      scaleX = 1 + 0.28 * p;
      scaleY = 1 - 0.25 * p;
    } else if (tNorm < 0.5) {
      const p = (tNorm - 0.3) / 0.2;
      scaleX = 1.28 - 0.48 * p;
      scaleY = 0.75 + 0.42 * p;
    } else if (tNorm < 0.75) {
      const p = (tNorm - 0.5) / 0.25;
      scaleX = 0.8 + 0.28 * p;
      scaleY = 1.17 - 0.22 * p;
    } else {
      const p = (tNorm - 0.75) / 0.25;
      scaleX = 1.08 - 0.08 * p;
      scaleY = 0.95 + 0.05 * p;
    }
  } else if (anim === 'tada') {
    if (localTime < 0.9) {
      const p = localTime / 0.9;
      scaleX = scaleY = p < 0.2 ? 0.9 : 1 + Math.sin(p * Math.PI) * 0.14;
      extraRot = Math.sin(p * Math.PI * 6) * (p < 0.2 ? 3 : 5) * (1 - p * 0.5);
    }
  } else if (anim === 'jello') {
    if (localTime < 0.9) {
      const p = localTime / 0.9;
      skewX = Math.sin(p * Math.PI * 5) * 0.28 * (1 - p);
    }
  } else if (anim === 'jackInTheBox') {
    const p = Math.min(1, localTime / 0.7);
    extraAlpha = p;
    scaleX = scaleY = 0.15 + cubicEaseInOut(p) * 0.85;
    extraRot = p < 0.5 ? 25 * (1 - p * 2) : -8 * (1 - p);
  } else if (anim === 'backInUp') {
    const p = Math.min(1, localTime / 0.65);
    extraAlpha = Math.min(1, p * 1.4);
    offsetY = (1 - cubicEaseInOut(p)) * (h * 0.36);
    scaleX = scaleY = p < 0.8 ? 0.72 + (p / 0.8) * 0.28 : 1;
  } else if (anim === 'zoomInDown') {
    const p = Math.min(1, localTime / 0.65);
    extraAlpha = p;
    scaleX = scaleY = 0.2 + cubicEaseInOut(p) * 0.8;
    offsetY = (1 - cubicEaseInOut(p)) * -(h * 0.34);
  } else if (anim === 'flipInX') {
    const p = Math.min(1, localTime / 0.6);
    extraAlpha = Math.min(1, p * 1.5);
    scaleY = Math.max(0.05, Math.abs(Math.cos((1 - p) * (Math.PI / 2))));
  } else if (anim === 'lightSpeedInRight') {
    const p = Math.min(1, localTime / 0.55);
    const e = cubicEaseInOut(p);
    extraAlpha = p;
    offsetX = (1 - e) * (w * 0.55);
    skewX = -0.35 * (1 - e);
  } else if (anim === 'glitch-flicker') {
    if (localTime < 0.55 || Math.floor(localTime * 12) % 9 === 0) {
      offsetX = Math.sin(localTime * 95) * 14;
      extraAlpha = 0.78 + Math.sin(localTime * 60) * 0.22;
    }
  }

  const lines = visibleText.split(/\r?\n/);
  const lineHeight = fontSize * 1.18;
  const totalBlockH = lines.length * lineHeight;

  ctx.save();
  ctx.translate(w / 2 + offsetX, h / 2 + offsetY);
  if (extraRot !== 0) ctx.rotate((extraRot * Math.PI) / 180);
  if (skewX !== 0) ctx.transform(1, 0, skewX, 1, 0, 0);
  ctx.scale(scaleX, scaleY);
  ctx.globalAlpha = Math.max(0, Math.min(1, extraAlpha));
  ctx.font = `800 ${fontSize}px "${fontFam}", "Outfit", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const maxLineWidth = Math.max(
    40,
    ...lines.map((line) => measureSpacedLine(ctx, line, letterSpacing))
  );

  // Determine effective styling (explicit overrides take precedence over preset defaults)
  const useBgBox = clip.textBgEnabled ?? stylePreset === 'cyber-box';
  const bgColor = clip.textBgColor || 'rgba(8, 10, 15, 0.88)';
  const bgRadius = clip.textBgRadius ?? 14;

  const defaultStrokeW =
    stylePreset === 'outline' || stylePreset === 'gradient-fire'
      ? Math.max(7, Math.round(fontSize * 0.14))
      : stylePreset === '3d-pop'
        ? Math.max(5, Math.round(fontSize * 0.1))
        : stylePreset === 'neon-glow'
          ? 4
          : 0;
  const strokeWidth = clip.textStrokeWidth ?? defaultStrokeW;
  const strokeColor =
    clip.textStrokeColor ||
    (stylePreset === 'neon-glow' ? (color === '#FFFFFF' ? '#00CAE0' : color) : '#000000');

  const shadowColor =
    clip.textShadowColor ??
    (stylePreset === 'neon-glow'
      ? color === '#FFFFFF'
        ? '#00CAE0'
        : color
      : 'rgba(0,0,0,0.85)');
  const shadowBlur =
    clip.textShadowBlur ??
    (stylePreset === 'neon-glow' ? 30 : stylePreset === 'clean' || stylePreset === 'outline' ? 14 : 0);
  const shadowOffX = clip.textShadowOffsetX ?? 0;
  const shadowOffY = clip.textShadowOffsetY ?? 0;

  const useGradient =
    clip.textGradientEnabled ?? stylePreset === 'gradient-fire';
  const gradC1 = clip.textGradientColor1 || '#00CAE0';
  const gradC2 =
    clip.textGradientColor2 || (color === '#FFFFFF' ? '#34D399' : color);
  const gradAngle = clip.textGradientAngle ?? 90;

  // 1. Optional Background Caption Box
  if (useBgBox) {
    const padX = Math.max(20, fontSize * 0.36);
    const padY = Math.max(12, fontSize * 0.2);
    const boxW = maxLineWidth + padX * 2;
    const boxH = totalBlockH + padY;
    ctx.save();
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, bgRadius);
    ctx.fill();
    if (stylePreset === 'cyber-box') {
      ctx.strokeStyle = color === '#FFFFFF' ? '#00CAE0' : color;
      ctx.lineWidth = 3.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  const fillPaint: string | CanvasGradient = useGradient
    ? buildLinearGradientForText(ctx, maxLineWidth, totalBlockH, gradAngle, gradC1, gradC2)
    : stylePreset === 'neon-glow' && !clip.textColor
      ? '#FFFFFF'
      : color;

  // 2. Render each line with 3D Extrude / Shadow / Stroke / Fill
  lines.forEach((line, lineIdx) => {
    const y = (lineIdx - (lines.length - 1) / 2) * lineHeight;

    // 3D Extrude depth stack
    if (stylePreset === '3d-pop') {
      const depth = Math.max(4, Math.round(fontSize * 0.09));
      ctx.save();
      ctx.fillStyle = '#0B0F1A';
      for (let d = depth; d >= 1; d--) {
        drawSpacedLine(ctx, line, y + d * 1.2, letterSpacing, 'fill');
      }
      ctx.restore();
    }

    // Shadow / Neon Glow + Stroke pass
    if (strokeWidth > 0) {
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = shadowBlur;
      ctx.shadowOffsetX = shadowOffX;
      ctx.shadowOffsetY = shadowOffY;
      drawSpacedLine(ctx, line, y, letterSpacing, 'stroke');
      ctx.restore();
    } else if (shadowBlur > 0 || shadowOffX !== 0 || shadowOffY !== 0) {
      ctx.save();
      ctx.fillStyle = fillPaint;
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = shadowBlur;
      ctx.shadowOffsetX = shadowOffX;
      ctx.shadowOffsetY = shadowOffY;
      drawSpacedLine(ctx, line, y, letterSpacing, 'fill');
      ctx.restore();
    }

    // Crisp Fill pass on top
    ctx.save();
    ctx.fillStyle = fillPaint;
    drawSpacedLine(ctx, line, y, letterSpacing, 'fill');
    ctx.restore();
  });

  ctx.restore();
}

function apply2dFallbackEffect(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  effectType: VideoEffectType,
  intensity: number,
  timeSec: number
): void {
  if (
    effectType === 'none' ||
    effectType === 'shake-impact' ||
    effectType === 'zoom-pulse' ||
    effectType === 'heartbeat-pump' ||
    effectType === 'whiplash-pan'
  ) {
    return;
  }
  const strength = Math.max(0.1, intensity / 100);
  if (effectType === 'vignette') {
    const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.22, w / 2, h / 2, w * 0.7);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${0.88 * strength})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  } else if (effectType === 'neon-flash') {
    const beat = Math.pow(Math.abs(Math.sin(timeSec * 8)), 5);
    ctx.fillStyle = `rgba(255, 255, 255, ${beat * 0.55 * strength})`;
    ctx.fillRect(0, 0, w, h);
  }
}

function renderClipRawToCanvas(
  targetCtx: CanvasRenderingContext2D,
  targetCanvas: HTMLCanvasElement,
  width: number,
  height: number,
  clip: Clip,
  mediaElements: Map<string, HTMLVideoElement | HTMLImageElement | HTMLAudioElement>,
  timeSec: number
): {
  localTime: number;
  transform: InterpolatedTransform;
  shakeX: number;
  shakeY: number;
  pulseScale: number;
  hasCrop: boolean;
  cropLeft: number;
  cropTop: number;
  cropRight: number;
  cropBottom: number;
} {
  const localTime = Math.max(0, timeSec - clip.startSec);
  const normPos = localTime / Math.max(0.1, clip.durationSec);
  const speedNow = evaluateSpeedAt(clip.speedRamp.points, normPos);
  const remappedTime = computeRemappedSourceTime(clip, localTime);
  const transform = interpolateTransform(clip, localTime);

  targetCtx.clearRect(0, 0, width, height);

  try {
    if (clip.sourceType === 'demo-arena') {
      drawStockScene(targetCtx, width, height, 'cyber-grid', remappedTime);
    } else if (clip.sourceType === 'demo-clutch') {
      drawProceduralClutch(targetCtx, width, height, remappedTime, speedNow);
    } else if (clip.sourceType === 'demo-chroma') {
      drawProceduralChromaBadge(targetCtx, width, height, remappedTime);
    } else if (clip.sourceType === 'stock-clip') {
      drawStockScene(targetCtx, width, height, clip.stockVariant || 'cyber-grid', remappedTime);
    } else if (clip.sourceType === 'svg-sticker') {
      drawSvgSticker(targetCtx, width, height, clip, localTime);
    } else if (clip.sourceType === 'demo-text') {
      drawAnimatedText(targetCtx, width, height, clip, localTime);
    } else if (clip.sourceType === 'local-video' || clip.sourceType === 'local-image') {
      const el = mediaElements.get(clip.id);
      if (el && el instanceof HTMLVideoElement) {
        const fitMode = clip.crop?.fitMode === 'cover' ? 'cover' : 'contain';
        const primaryKey = clip.id;
        const fallbackKey = clip.assetId || clip.mediaUrl || clip.id;
        if (el.readyState >= 2 && el.videoWidth > 0) {
          const mediaW = el.videoWidth || width;
          const mediaH = el.videoHeight || height;
          const fitScale =
            fitMode === 'cover'
              ? Math.max(width / mediaW, height / mediaH)
              : Math.min(width / mediaW, height / mediaH);
          const drawW = mediaW * fitScale;
          const drawH = mediaH * fitScale;
          targetCtx.drawImage(el, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
          // Cache latest decoded frame unless mid-seek so buffering past 6s never shows black
          if (!el.seeking) {
            try {
              updateCachedVideoFrame(primaryKey, el, fitMode, width, height);
            } catch {
              // ignore tainted canvas cache
            }
          }
        } else {
          const cachedFrame =
            videoLastFrameCache.get(primaryKey) ?? videoLastFrameCache.get(fallbackKey);
          if (cachedFrame && cachedFrame.width > 0 && cachedFrame.height > 0) {
            targetCtx.drawImage(cachedFrame, 0, 0, width, height);
          }
        }
      } else if (el && el instanceof HTMLImageElement) {
        if (el.complete && el.naturalWidth > 0) {
          const mediaW = el.naturalWidth || width;
          const mediaH = el.naturalHeight || height;
          const isCover = clip.crop?.fitMode === 'cover';
          const fitScale = isCover
            ? Math.max(width / mediaW, height / mediaH)
            : Math.min(width / mediaW, height / mediaH);
          const drawW = mediaW * fitScale;
          const drawH = mediaH * fitScale;
          targetCtx.drawImage(el, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
        }
      }
    }
  } catch {
    // Isolate any broken media draw cleanly without crashing studio loop
  }

  if (clip.chromaKey.enabled) {
    try {
      applyChromaKeyBuffer(
        targetCtx,
        width,
        height,
        clip.chromaKey.targetHex,
        clip.chromaKey.similarity,
        clip.chromaKey.smoothness
      );
    } catch {
      // ignore if CORS-tainted external image
    }
  }

  if (clip.effect && clip.effect.type !== 'none') {
    let appliedGl = false;
    try {
      appliedGl = applyWebGlEffectPass(
        targetCtx,
        targetCanvas,
        clip.effect.type,
        clip.effect.intensity,
        localTime
      );
    } catch {
      appliedGl = false;
    }
    if (!appliedGl) {
      apply2dFallbackEffect(
        targetCtx,
        width,
        height,
        clip.effect.type,
        clip.effect.intensity,
        localTime
      );
    }
  }

  let shakeX = 0;
  let shakeY = 0;
  let pulseScale = 1;
  if (clip.effect?.type === 'shake-impact') {
    const s = (clip.effect.intensity / 100) * 22;
    shakeX = Math.sin(localTime * 46) * s;
    shakeY = Math.cos(localTime * 41) * s;
  } else if (clip.effect?.type === 'zoom-pulse') {
    pulseScale = 1 + Math.abs(Math.sin(localTime * 6)) * 0.16 * (clip.effect.intensity / 100);
  } else if (clip.effect?.type === 'motion-blur-zoom') {
    pulseScale = 1 + ((localTime * 1.4) % 1) * 0.14 * (clip.effect.intensity / 100);
  } else if (clip.effect?.type === 'heartbeat-pump') {
    const beat = Math.pow(Math.abs(Math.sin(localTime * 4.5)), 6);
    pulseScale = 1 + beat * 0.22 * (clip.effect.intensity / 100);
  } else if (clip.effect?.type === 'whiplash-pan') {
    const s = (clip.effect.intensity / 100) * 28;
    shakeX = Math.sin(localTime * 3.4) * s;
    shakeY = Math.cos(localTime * 2.1) * (s * 0.45);
    pulseScale = 1.06;
  }

  const cropLeft = ((clip.crop?.left ?? 0) / 100) * width;
  const cropRight = ((clip.crop?.right ?? 0) / 100) * width;
  const cropTop = ((clip.crop?.top ?? 0) / 100) * height;
  const cropBottom = ((clip.crop?.bottom ?? 0) / 100) * height;
  const hasCrop = cropLeft > 0 || cropRight > 0 || cropTop > 0 || cropBottom > 0;

  return {
    localTime,
    transform,
    shakeX,
    shakeY,
    pulseScale,
    hasCrop,
    cropLeft,
    cropTop,
    cropRight,
    cropBottom,
  };
}

function drawTransformedBuffer(
  destCtx: CanvasRenderingContext2D,
  srcCanvas: HTMLCanvasElement,
  width: number,
  height: number,
  info: ReturnType<typeof renderClipRawToCanvas>,
  alphaOverride = 1
) {
  destCtx.save();
  destCtx.globalAlpha = Math.max(0, Math.min(1, info.transform.opacity * alphaOverride));
  destCtx.translate(
    width / 2 + (info.transform.x / 100) * width + info.shakeX,
    height / 2 + (info.transform.y / 100) * height + info.shakeY
  );
  destCtx.rotate((info.transform.rotation * Math.PI) / 180);
  destCtx.scale(info.transform.scale * info.pulseScale, info.transform.scale * info.pulseScale);

  if (info.hasCrop) {
    const cw = Math.max(8, width - info.cropLeft - info.cropRight);
    const ch = Math.max(8, height - info.cropTop - info.cropBottom);
    destCtx.beginPath();
    destCtx.rect(-width / 2 + info.cropLeft, -height / 2 + info.cropTop, cw, ch);
    destCtx.clip();
  }

  destCtx.drawImage(srcCanvas, -width / 2, -height / 2, width, height);
  destCtx.restore();
}

export function renderCompositeFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  project: ProjectState,
  mediaElements: Map<string, HTMLVideoElement | HTMLImageElement | HTMLAudioElement>,
  timeSec: number
): void {
  try {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#060608';
    ctx.fillRect(0, 0, width, height);

    const visualTracks = project.tracks.filter((t) => t.type !== 'audio' && !t.hidden);

    for (const track of visualTracks) {
      const trackClips = project.clips
        .filter((c) => c.trackId === track.id)
        .sort((a, b) => a.startSec - b.startSec);

      const activeClips = trackClips.filter(
        (c) => timeSec >= c.startSec && timeSec <= c.startSec + c.durationSec
      );

      for (const clip of activeClips) {
        try {
          const { canvas: offscreen, ctx: offCtx } = getOffscreenTarget(
            width,
            height,
            clip.chromaKey.enabled
          );
          if (!offCtx) continue;

          const info = renderClipRawToCanvas(
            offCtx,
            offscreen,
            width,
            height,
            clip,
            mediaElements,
            timeSec
          );

          // Check real GitHub gl-transitions GLSL cut shader
          const hasGlTrans =
            clip.transitionIn &&
            clip.transitionIn.type !== 'none' &&
            info.localTime < Math.max(0.15, clip.transitionIn.durationSec);

          if (hasGlTrans && clip.transitionIn) {
            const dur = Math.max(0.15, clip.transitionIn.durationSec);
            const progress = cubicEaseInOut(info.localTime / dur);
            const { fromCanvas, fromCtx, toCanvas, toCtx } = getTransitionBuffers(width, height);

            if (fromCtx && toCtx) {
              fromCtx.clearRect(0, 0, width, height);
              if (track.type === 'video') {
                fromCtx.fillStyle = '#060608';
                fromCtx.fillRect(0, 0, width, height);
                const idx = trackClips.findIndex((c) => c.id === clip.id);
                const prevClip = idx > 0 ? trackClips[idx - 1] : null;
                if (prevClip) {
                  const prevInfo = renderClipRawToCanvas(
                    offCtx,
                    offscreen,
                    width,
                    height,
                    prevClip,
                    mediaElements,
                    prevClip.startSec + Math.max(0, prevClip.durationSec - 0.03)
                  );
                  drawTransformedBuffer(fromCtx, offscreen, width, height, prevInfo);
                  // Re-render current clip into offscreen cleanly
                  renderClipRawToCanvas(
                    offCtx,
                    offscreen,
                    width,
                    height,
                    clip,
                    mediaElements,
                    timeSec
                  );
                }
              }

              toCtx.clearRect(0, 0, width, height);
              if (track.type === 'video') {
                toCtx.fillStyle = '#060608';
                toCtx.fillRect(0, 0, width, height);
              }
              drawTransformedBuffer(toCtx, offscreen, width, height, info);

              let glOut: HTMLCanvasElement | null = null;
              try {
                glOut = renderGlTransitionFrame(
                  clip.transitionIn.type,
                  fromCanvas,
                  toCanvas,
                  progress,
                  width,
                  height
                );
              } catch {
                glOut = null;
              }

              if (glOut) {
                ctx.drawImage(glOut, 0, 0, width, height);
                continue;
              } else {
                drawTransformedBuffer(ctx, offscreen, width, height, info, progress);
                continue;
              }
            }
          }

          drawTransformedBuffer(ctx, offscreen, width, height, info);
        } catch {
          // Single-clip error isolation: keep rendering remaining layers
        }
      }
    }
  } catch {
    // Master safety catch so animation frame loop never terminates
  }
}
