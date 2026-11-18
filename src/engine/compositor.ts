import { Clip, Keyframe, ProjectState, SpeedPoint, TextAnimationType, VideoEffectType } from '../types/editor';

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
      const x = ((i * 97 + Math.sin(t * 2 + i) * 40) % w + w) % w;
      const y = h - (((t * 75 + i * 45) % (h + 40)));
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

  // Default cyber-grid / glass-prism
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

function drawMemeCard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  clip: Clip,
  localTime: number
): void {
  if (clip.chromaKey.enabled) {
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(0, 0, w, h);
  }

  const pop = localTime < 0.25 ? 0.65 + (localTime / 0.25) * 0.4 : 1.0;
  const accent = clip.memeAccent || '#00CAE0';

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(pop, pop);

  // Punchy Meme Banner Card
  ctx.fillStyle = '#0B0B10';
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(-210, -86, 420, 172, 18);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 38px "Anton", "Outfit", sans-serif';
  ctx.fillText((clip.memeTopText || clip.name).toUpperCase(), 0, -24);

  ctx.fillStyle = accent;
  ctx.font = '700 46px "Bangers", "Outfit", sans-serif';
  ctx.fillText((clip.memeBottomText || 'MEME').toUpperCase(), 0, 30);

  ctx.restore();
}

function drawAnimatedText(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  clip: Clip,
  localTime: number
): void {
  const fullText = clip.textContent || clip.name;
  const anim: TextAnimationType = clip.textAnimation || 'none';
  const fontFam = clip.fontFamily || 'Outfit';
  const color = clip.textColor || '#FFFFFF';

  let visibleText = fullText;
  let offsetY = 0;
  let extraScale = 1;
  let extraAlpha = 1;
  let offsetX = 0;

  if (anim === 'typewriter') {
    const progress = Math.min(1, localTime / Math.min(1.6, clip.durationSec * 0.7));
    const chars = Math.max(1, Math.ceil(fullText.length * progress));
    visibleText = fullText.slice(0, chars);
  } else if (anim === 'pop-bounce') {
    const p = Math.min(1, localTime / 0.35);
    extraScale = p < 0.7 ? (p / 0.7) * 1.22 : 1.22 - ((p - 0.7) / 0.3) * 0.22;
  } else if (anim === 'slide-up') {
    const p = Math.min(1, localTime / 0.4);
    offsetY = (1 - cubicEaseInOut(p)) * 90;
    extraAlpha = p;
  } else if (anim === 'glitch-flicker') {
    if (localTime < 0.45 || Math.floor(localTime * 12) % 9 === 0) {
      offsetX = Math.sin(localTime * 90) * 10;
      extraAlpha = 0.75 + Math.sin(localTime * 60) * 0.25;
    }
  } else if (anim === 'neon-pulse') {
    extraScale = 1 + Math.sin(localTime * 6) * 0.06;
  } else if (anim === 'zoom-reveal') {
    const p = Math.min(1, localTime / 0.5);
    extraScale = 0.3 + cubicEaseInOut(p) * 0.7;
    extraAlpha = p;
  }

  ctx.save();
  ctx.translate(w / 2 + offsetX, h / 2 + offsetY);
  ctx.scale(extraScale, extraScale);
  ctx.globalAlpha = Math.max(0, Math.min(1, extraAlpha));
  ctx.fillStyle = color;
  ctx.font = `700 68px "${fontFam}", "Outfit", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = anim === 'neon-pulse' ? color : 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = anim === 'neon-pulse' ? 28 : 16;
  ctx.fillText(visibleText, 0, 0);
  ctx.restore();
}

function applyVideoEffectPass(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  effectType: VideoEffectType,
  intensity: number,
  timeSec: number
): void {
  if (effectType === 'none') return;
  const strength = Math.max(0.1, intensity / 100);

  if (effectType === 'vhs-retro') {
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${0.22 * strength})`;
    for (let y = 0; y < h; y += 6) {
      ctx.fillRect(0, y, w, 2);
    }
    const barY = ((timeSec * 140) % h);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.12 * strength})`;
    ctx.fillRect(0, barY, w, 14);
    ctx.restore();
  } else if (effectType === 'rgb-glitch') {
    const shift = Math.sin(timeSec * 24) * 14 * strength;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = `rgba(255, 0, 80, ${0.14 * strength})`;
    ctx.fillRect(shift, 0, w, h);
    ctx.fillStyle = `rgba(0, 220, 255, ${0.14 * strength})`;
    ctx.fillRect(-shift, 0, w, h);
    ctx.restore();
  } else if (effectType === 'neon-flash') {
    const beat = Math.pow(Math.abs(Math.sin(timeSec * 8)), 6);
    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 255, ${beat * 0.45 * strength})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  } else if (effectType === 'vignette') {
    const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.72);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${0.85 * strength})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  } else if (effectType === 'warm-gold') {
    ctx.save();
    ctx.fillStyle = `rgba(251, 191, 36, ${0.18 * strength})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  } else if (effectType === 'bw-contrast') {
    ctx.save();
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = 'hsl(0, 0%, 50%)';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  } else if (effectType === 'edge-glow') {
    ctx.save();
    ctx.strokeStyle = `rgba(0, 202, 224, ${0.55 * strength})`;
    ctx.lineWidth = 10 * strength;
    ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.restore();
  }
}

export function renderCompositeFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  project: ProjectState,
  mediaElements: Map<string, HTMLVideoElement | HTMLImageElement | HTMLAudioElement>,
  timeSec: number
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#060608';
  ctx.fillRect(0, 0, width, height);

  const visualTracks = project.tracks.filter((t) => t.type !== 'audio' && !t.hidden);

  for (const track of visualTracks) {
    const activeClips = project.clips.filter(
      (c) =>
        c.trackId === track.id &&
        timeSec >= c.startSec &&
        timeSec <= c.startSec + c.durationSec
    );

    for (const clip of activeClips) {
      const localTime = Math.max(0, timeSec - clip.startSec);
      const normPos = localTime / Math.max(0.1, clip.durationSec);
      const speedNow = evaluateSpeedAt(clip.speedRamp.points, normPos);
      const remappedTime = computeRemappedSourceTime(clip, localTime);
      const transform = interpolateTransform(clip, localTime);

      const { canvas: offscreen, ctx: offCtx } = getOffscreenTarget(
        width,
        height,
        clip.chromaKey.enabled
      );
      if (!offCtx) continue;
      offCtx.clearRect(0, 0, width, height);

      if (clip.sourceType === 'demo-arena') {
        drawStockScene(offCtx, width, height, 'cyber-grid', remappedTime);
      } else if (clip.sourceType === 'demo-clutch') {
        drawProceduralClutch(offCtx, width, height, remappedTime, speedNow);
      } else if (clip.sourceType === 'demo-chroma') {
        drawProceduralChromaBadge(offCtx, width, height, remappedTime);
      } else if (clip.sourceType === 'stock-clip') {
        drawStockScene(offCtx, width, height, clip.stockVariant || 'cyber-grid', remappedTime);
      } else if (clip.sourceType === 'meme-clip') {
        drawMemeCard(offCtx, width, height, clip, localTime);
      } else if (clip.sourceType === 'demo-text') {
        drawAnimatedText(offCtx, width, height, clip, localTime);
      } else if (clip.sourceType === 'local-video' || clip.sourceType === 'local-image') {
        const el = mediaElements.get(clip.id);
        if (el && (el instanceof HTMLVideoElement || el instanceof HTMLImageElement)) {
          const mediaW =
            el instanceof HTMLVideoElement ? el.videoWidth || width : el.naturalWidth || width;
          const mediaH =
            el instanceof HTMLVideoElement ? el.videoHeight || height : el.naturalHeight || height;
          const isCover = clip.crop?.fitMode === 'cover';
          const fitScale = isCover
            ? Math.max(width / mediaW, height / mediaH)
            : Math.min(width / mediaW, height / mediaH);
          const drawW = mediaW * fitScale;
          const drawH = mediaH * fitScale;
          offCtx.drawImage(el, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
        }
      }

      if (clip.chromaKey.enabled) {
        applyChromaKeyBuffer(
          offCtx,
          width,
          height,
          clip.chromaKey.targetHex,
          clip.chromaKey.similarity,
          clip.chromaKey.smoothness
        );
      }

      if (clip.effect && clip.effect.type !== 'none') {
        applyVideoEffectPass(
          offCtx,
          width,
          height,
          clip.effect.type,
          clip.effect.intensity,
          localTime
        );
      }

      // Compute Transition-In Transform & Flash
      let transScale = 1;
      let transX = 0;
      let transY = 0;
      let transRot = 0;
      let transAlpha = 1;
      let flashWhite = 0;
      let fadeBlack = 0;
      let circleClipRadius: number | null = null;

      if (clip.transitionIn && clip.transitionIn.type !== 'none') {
        const dur = Math.max(0.15, clip.transitionIn.durationSec);
        if (localTime < dur) {
          const p = cubicEaseInOut(localTime / dur);
          const tType = clip.transitionIn.type;
          if (tType === 'dissolve') {
            transAlpha = p;
          } else if (tType === 'zoom-in') {
            transScale = 1.65 - p * 0.65;
            transAlpha = p;
          } else if (tType === 'zoom-out') {
            transScale = 0.5 + p * 0.5;
            transAlpha = p;
          } else if (tType === 'slide-left') {
            transX = (1 - p) * width;
          } else if (tType === 'slide-up') {
            transY = (1 - p) * height;
          } else if (tType === 'spin-cut') {
            transRot = (1 - p) * 180;
            transScale = 0.6 + p * 0.4;
            transAlpha = p;
          } else if (tType === 'circle-wipe') {
            circleClipRadius = p * Math.hypot(width / 2, height / 2);
          } else if (tType === 'flash-white') {
            flashWhite = 1 - p;
          } else if (tType === 'fade-black') {
            fadeBlack = 1 - p;
          } else if (tType === 'glitch-cut') {
            transX = Math.sin(localTime * 95) * 28 * (1 - p);
          }
        }
      }

      // Shake / Zoom-Pulse clip-level motion effects
      let shakeX = 0;
      let shakeY = 0;
      let pulseScale = 1;
      if (clip.effect?.type === 'shake-impact') {
        const s = (clip.effect.intensity / 100) * 18;
        shakeX = Math.sin(localTime * 42) * s;
        shakeY = Math.cos(localTime * 37) * s;
      } else if (clip.effect?.type === 'zoom-pulse') {
        pulseScale = 1 + Math.abs(Math.sin(localTime * 6)) * 0.14 * (clip.effect.intensity / 100);
      }

      const cropLeft = ((clip.crop?.left ?? 0) / 100) * width;
      const cropRight = ((clip.crop?.right ?? 0) / 100) * width;
      const cropTop = ((clip.crop?.top ?? 0) / 100) * height;
      const cropBottom = ((clip.crop?.bottom ?? 0) / 100) * height;
      const hasCrop = cropLeft > 0 || cropRight > 0 || cropTop > 0 || cropBottom > 0;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, transform.opacity * transAlpha));
      ctx.translate(
        width / 2 + (transform.x / 100) * width + transX + shakeX,
        height / 2 + (transform.y / 100) * height + transY + shakeY
      );
      ctx.rotate(((transform.rotation + transRot) * Math.PI) / 180);
      ctx.scale(transform.scale * transScale * pulseScale, transform.scale * transScale * pulseScale);

      if (circleClipRadius !== null) {
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(1, circleClipRadius), 0, Math.PI * 2);
        ctx.clip();
      }

      if (hasCrop) {
        const cw = Math.max(8, width - cropLeft - cropRight);
        const ch = Math.max(8, height - cropTop - cropBottom);
        ctx.beginPath();
        ctx.rect(-width / 2 + cropLeft, -height / 2 + cropTop, cw, ch);
        ctx.clip();
      }

      ctx.drawImage(offscreen, -width / 2, -height / 2, width, height);
      ctx.restore();

      if (flashWhite > 0.02) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 255, 255, ${flashWhite})`;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }

      if (fadeBlack > 0.02) {
        ctx.save();
        ctx.fillStyle = `rgba(0, 0, 0, ${fadeBlack})`;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
    }
  }
}
