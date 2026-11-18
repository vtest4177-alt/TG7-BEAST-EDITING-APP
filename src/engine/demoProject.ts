import { AspectRatio, ProjectState, SpeedPoint, SpeedPreset } from '../types/editor';
import { fallbackWaveform } from './mediaUtils';

export const SPEED_PRESETS: Record<SpeedPreset, { label: string; points: SpeedPoint[] }> = {
  normal: {
    label: 'Normal 1.0x',
    points: [
      { position: 0, speed: 1.0 },
      { position: 0.33, speed: 1.0 },
      { position: 0.66, speed: 1.0 },
      { position: 1, speed: 1.0 },
    ],
  },
  'montage-hero': {
    label: 'Hero Curve',
    points: [
      { position: 0, speed: 2.6 },
      { position: 0.35, speed: 0.45 },
      { position: 0.7, speed: 0.5 },
      { position: 1, speed: 3.1 },
    ],
  },
  'velocity-jump': {
    label: 'Velocity Jump',
    points: [
      { position: 0, speed: 0.7 },
      { position: 0.3, speed: 3.4 },
      { position: 0.65, speed: 0.35 },
      { position: 1, speed: 2.2 },
    ],
  },
  'slow-mo-ease': {
    label: 'Smooth Slow-Mo',
    points: [
      { position: 0, speed: 1.8 },
      { position: 0.4, speed: 0.35 },
      { position: 0.8, speed: 0.4 },
      { position: 1, speed: 1.2 },
    ],
  },
  'flash-out': {
    label: 'Flash Out',
    points: [
      { position: 0, speed: 0.8 },
      { position: 0.45, speed: 1.0 },
      { position: 0.75, speed: 2.8 },
      { position: 1, speed: 3.8 },
    ],
  },
};

export function createBlankProject(
  name = 'Untitled Project',
  aspectRatio: AspectRatio = '9:16',
  fps: 30 | 60 = 60
): ProjectState {
  return {
    id: `proj-${Date.now()}`,
    name,
    updatedAt: Date.now(),
    aspectRatio,
    fps,
    playheadSec: 0,
    isPlaying: false,
    zoomPxPerSec: 96,
    selectedClipId: null,
    tracks: [
      { id: 'track-main', label: 'Main Video', type: 'video', muted: false, locked: false, hidden: false },
      { id: 'track-overlay-1', label: 'Layer 1', type: 'overlay', muted: false, locked: false, hidden: false },
      { id: 'track-audio-1', label: 'Audio 1', type: 'audio', muted: false, locked: false, hidden: false },
    ],
    clips: [],
  };
}

export function createInitialDemoProject(): ProjectState {
  return {
    id: 'proj-demo-tg7',
    name: 'Sample Edit · Multi-Layer',
    updatedAt: Date.now(),
    aspectRatio: '16:9',
    fps: 60,
    playheadSec: 1.5,
    isPlaying: false,
    zoomPxPerSec: 96,
    selectedClipId: 'clip-arena-intro',
    tracks: [
      { id: 'track-main', label: 'Main Video', type: 'video', muted: false, locked: false, hidden: false },
      { id: 'track-overlay-1', label: 'Layer 1', type: 'overlay', muted: false, locked: false, hidden: false },
      { id: 'track-overlay-2', label: 'Layer 2', type: 'overlay', muted: false, locked: false, hidden: false },
      { id: 'track-audio-1', label: 'Audio 1', type: 'audio', muted: false, locked: false, hidden: false },
    ],
    clips: [
      {
        id: 'clip-arena-intro',
        trackId: 'track-main',
        name: 'Cyber Grid Intro',
        sourceType: 'demo-arena',
        startSec: 0,
        durationSec: 4.2,
        trimStartSec: 0,
        volume: 0.8,
        effect: { type: 'none', intensity: 65 },
        transitionIn: { type: 'none', durationSec: 0.5 },
        chromaKey: { enabled: false, targetHex: '#00FF00', similarity: 40, smoothness: 15 },
        speedRamp: {
          preset: 'normal',
          points: SPEED_PRESETS.normal.points.map((p) => ({ ...p })),
        },
        keyframes: [
          { id: 'kf-1', timeOffset: 0, x: 0, y: 0, scale: 1.0, rotation: 0, opacity: 1 },
          { id: 'kf-2', timeOffset: 2.4, x: 0, y: -2, scale: 1.12, rotation: -1.5, opacity: 1 },
        ],
      },
      {
        id: 'clip-clutch-hit',
        trackId: 'track-main',
        name: 'Velocity Clip',
        sourceType: 'demo-clutch',
        startSec: 4.2,
        durationSec: 4.8,
        trimStartSec: 0,
        volume: 0.85,
        effect: { type: 'vignette', intensity: 55 },
        transitionIn: { type: 'flash-white', durationSec: 0.45 },
        chromaKey: { enabled: false, targetHex: '#00FF00', similarity: 40, smoothness: 15 },
        speedRamp: {
          preset: 'montage-hero',
          points: SPEED_PRESETS['montage-hero'].points.map((p) => ({ ...p })),
        },
        keyframes: [
          { id: 'kf-4', timeOffset: 0, x: 0, y: 0, scale: 1.16, rotation: 2, opacity: 1 },
          { id: 'kf-5', timeOffset: 1.8, x: 0, y: 0, scale: 1.0, rotation: 0, opacity: 1 },
        ],
      },
      {
        id: 'clip-text-kill',
        trackId: 'track-overlay-1',
        name: 'Text · TG7 STUDIO',
        sourceType: 'demo-text',
        textContent: 'TG7 STUDIO',
        textColor: '#FFFFFF',
        fontFamily: 'Orbitron',
        textAnimation: 'pop-bounce',
        startSec: 0.8,
        durationSec: 3.2,
        trimStartSec: 0,
        volume: 0,
        chromaKey: { enabled: false, targetHex: '#00FF00', similarity: 40, smoothness: 15 },
        speedRamp: {
          preset: 'normal',
          points: SPEED_PRESETS.normal.points.map((p) => ({ ...p })),
        },
        keyframes: [
          { id: 'kf-t1', timeOffset: 0, x: 0, y: 12, scale: 0.9, rotation: 0, opacity: 1 },
        ],
      },
      {
        id: 'clip-audio-beat',
        trackId: 'track-audio-1',
        name: 'Background Beat Track',
        sourceType: 'demo-audio',
        waveform: fallbackWaveform(60),
        startSec: 0,
        durationSec: 9.0,
        trimStartSec: 0,
        volume: 0.75,
        chromaKey: { enabled: false, targetHex: '#00FF00', similarity: 40, smoothness: 15 },
        speedRamp: {
          preset: 'normal',
          points: SPEED_PRESETS.normal.points.map((p) => ({ ...p })),
        },
        keyframes: [],
      },
    ],
  };
}
