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
  | 'rgb-glitch'
  | 'vhs-retro'
  | 'neon-flash'
  | 'shake-impact'
  | 'vignette'
  | 'bw-contrast'
  | 'warm-gold'
  | 'edge-glow'
  | 'zoom-pulse';

export type TransitionType =
  | 'none'
  | 'dissolve'
  | 'flash-white'
  | 'fade-black'
  | 'zoom-in'
  | 'zoom-out'
  | 'slide-left'
  | 'slide-up'
  | 'spin-cut'
  | 'circle-wipe'
  | 'glitch-cut';

export type TextAnimationType =
  | 'none'
  | 'typewriter'
  | 'pop-bounce'
  | 'slide-up'
  | 'glitch-flicker'
  | 'neon-pulse'
  | 'zoom-reveal';

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
  thumbnails?: string[];
  waveform?: number[];
  textContent?: string;
  textColor?: string;
  fontFamily?: string;
  textAnimation?: TextAnimationType;
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
