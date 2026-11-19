export type AspectRatio = '16:9' | '9:16' | '1:1';

export type TrackType = 'video' | 'overlay' | 'audio';

export type ClipSourceType =
  | 'demo-arena'
  | 'demo-clutch'
  | 'demo-chroma'
  | 'demo-text'
  | 'demo-audio'
  | 'stock-clip'
  | 'meme-clip'
  | 'meme-sfx'
  | 'svg-sticker'
  | 'local-video'
  | 'local-image'
  | 'local-audio';

export type SpeedPreset =
  | 'normal'
  | 'montage-hero'
  | 'velocity-jump'
  | 'slow-mo-ease'
  | 'flash-out';

export type VideoEffectType =
  | 'none'
  | 'rgb-split-pro'
  | 'anime-speedlines'
  | 'light-leak-flare'
  | 'film-burn-halation'
  | 'sparkle-bling'
  | 'cyber-hud-scan'
  | 'manga-ink'
  | 'dreamy-glow'
  | 'chrome-liquid'
  | 'vhs-camcorder'
  | 'rgb-glitch'
  | 'chromatic-aberration'
  | 'crt-scanlines'
  | 'data-mosh'
  | 'tv-static'
  | 'cyber-matrix'
  | 'motion-blur-zoom'
  | 'radial-blur'
  | 'whiplash-pan'
  | 'shake-impact'
  | 'heartbeat-pump'
  | 'zoom-pulse'
  | 'kaleidoscope'
  | 'kaleido-8'
  | 'bulge-fisheye'
  | 'pinch-warp'
  | 'swirl-vortex'
  | 'mirror-split'
  | 'mirror-quad'
  | 'wave-ripple'
  | 'cyber-prism'
  | 'vhs-retro'
  | 'neon-edges'
  | 'halftone-pixel'
  | 'mosaic-blur'
  | 'neon-flash'
  | 'bloom-aura'
  | 'thermal-heat'
  | 'xray-invert'
  | 'solarize'
  | 'laser-grid'
  | 'edge-glow'
  | 'cinematic-teal'
  | 'vignette'
  | 'bw-contrast'
  | 'warm-gold'
  | 'cyberpunk-pink'
  | 'emerald-matrix'
  | 'sepia-vintage'
  | 'night-vision'
  | 'sunset-glow'
  | 'deep-contrast'
  | 'fade-film';

// Real gl-transitions shader names (225+ GLSL shaders) or 'none'
export type TransitionType = 'none' | (string & {});

export type TextAnimationType =
  | 'none'
  | 'bounceIn'
  | 'rubberBand'
  | 'tada'
  | 'jello'
  | 'jackInTheBox'
  | 'backInUp'
  | 'zoomInDown'
  | 'flipInX'
  | 'lightSpeedInRight'
  | 'typewriter'
  | 'glitch-flicker';

export type TextStylePreset =
  | 'clean'
  | 'outline'
  | 'neon-glow'
  | 'cyber-box'
  | 'gradient-fire'
  | '3d-pop';

export type WorkspaceView = 'projects' | 'studio' | 'apk-build';

export interface MediaAsset {
  id: string;
  name: string;
  kind: 'video' | 'image' | 'audio';
  url: string;
  durationSec: number;
  thumbnails?: string[];
  waveform?: number[];
}

export interface Keyframe {
  id: string;
  timeOffset: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

export interface SpeedPoint {
  position: number;
  speed: number;
}

export interface ChromaKeyConfig {
  enabled: boolean;
  targetHex: string;
  similarity: number;
  smoothness: number;
}

export interface ClipCrop {
  top: number;
  bottom: number;
  left: number;
  right: number;
  fitMode?: 'contain' | 'cover';
}

export interface Clip {
  id: string;
  trackId: string;
  name: string;
  sourceType: ClipSourceType;
  mediaUrl?: string;
  assetId?: string;
  thumbnails?: string[];
  waveform?: number[];
  textContent?: string;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  textStyle?: TextStylePreset;
  textAnimation?: TextAnimationType;
  // Full Creator Typography Controls (editable anytime after creation)
  textGradientEnabled?: boolean;
  textGradientColor1?: string;
  textGradientColor2?: string;
  textGradientAngle?: number;
  textStrokeColor?: string;
  textStrokeWidth?: number;
  textShadowColor?: string;
  textShadowBlur?: number;
  textShadowOffsetX?: number;
  textShadowOffsetY?: number;
  textBgEnabled?: boolean;
  textBgColor?: string;
  textBgRadius?: number;
  textUppercase?: boolean;
  textLetterSpacing?: number;

  svgMarkup?: string;
  svgAccent?: string;
  effect?: {
    type: VideoEffectType;
    intensity: number; // 0 to 100
  };
  transitionIn?: {
    type: TransitionType;
    durationSec: number;
  };
  crop?: ClipCrop;
  stockVariant?: string;
  memeId?: string;
  memeTopText?: string;
  memeBottomText?: string;
  memeAccent?: string;
  sfxId?: string;
  startSec: number;
  durationSec: number;
  trimStartSec: number;
  keyframes: Keyframe[];
  chromaKey: ChromaKeyConfig;
  speedRamp: {
    preset: SpeedPreset;
    points: SpeedPoint[];
  };
  volume: number;
}

export interface Track {
  id: string;
  label: string;
  type: TrackType;
  muted: boolean;
  locked: boolean;
  hidden: boolean;
}

export interface ProjectState {
  id: string;
  name: string;
  updatedAt: number;
  aspectRatio: AspectRatio;
  fps: 30 | 60;
  playheadSec: number;
  isPlaying: boolean;
  zoomPxPerSec: number;
  tracks: Track[];
  clips: Clip[];
  selectedClipId: string | null;
}
