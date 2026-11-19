import { saveCustomFontBlobToDraftDb } from '../engine/draftStorage';
import { getAvailableGlTransitions } from '../engine/glTransitionRenderer';
import {
  TextAnimationType,
  TextStylePreset,
  TransitionType,
  VideoEffectType,
} from '../types/editor';

export interface FontCatalogItem {
  name: string;
  category: 'Gaming' | 'Meme' | 'Cinematic' | 'Modern';
  googleFamily: string;
  previewText: string;
}

export const GOOGLE_FONT_CATALOG: FontCatalogItem[] = [
  { name: 'Bebas Neue', category: 'Cinematic', googleFamily: 'Bebas+Neue', previewText: 'EPIC INTRO' },
  { name: 'Anton', category: 'Meme', googleFamily: 'Anton', previewText: 'MRBEAST POP' },
  { name: 'Bangers', category: 'Meme', googleFamily: 'Bangers', previewText: 'BOOM!' },
  { name: 'Orbitron', category: 'Gaming', googleFamily: 'Orbitron:wght@700;900', previewText: 'CLUTCH 4K' },
  { name: 'Black Ops One', category: 'Gaming', googleFamily: 'Black+Ops+One', previewText: 'VICTORY' },
  { name: 'Audiowide', category: 'Gaming', googleFamily: 'Audiowide', previewText: 'CYBER RUN' },
  { name: 'Rubik Glitch', category: 'Gaming', googleFamily: 'Rubik+Glitch', previewText: 'GLITCH FX' },
  { name: 'Permanent Marker', category: 'Meme', googleFamily: 'Permanent+Marker', previewText: 'BRUH MOMENT' },
  { name: 'Russo One', category: 'Gaming', googleFamily: 'Russo+One', previewText: 'PRO LEAGUE' },
  { name: 'Chakra Petch', category: 'Gaming', googleFamily: 'Chakra+Petch:wght@700', previewText: 'HUD SYSTEM' },
  { name: 'Bungee', category: 'Meme', googleFamily: 'Bungee', previewText: 'POP STAMP' },
  { name: 'Syne', category: 'Modern', googleFamily: 'Syne:wght@800', previewText: 'AESTHETIC' },
  { name: 'Montserrat', category: 'Modern', googleFamily: 'Montserrat:wght@800;900', previewText: 'BOLD REEL' },
  { name: 'Poppins', category: 'Modern', googleFamily: 'Poppins:wght@700;900', previewText: 'CLEAN CAP' },
  { name: 'Archivo Black', category: 'Cinematic', googleFamily: 'Archivo+Black', previewText: 'HEADLINE' },
  { name: 'Teko', category: 'Cinematic', googleFamily: 'Teko:wght@700', previewText: 'TRAILER' },
  { name: 'Exo 2', category: 'Gaming', googleFamily: 'Exo+2:wght@800', previewText: 'HYPERION' },
  { name: 'Silkscreen', category: 'Gaming', googleFamily: 'Silkscreen:wght@700', previewText: 'PIXEL 8BIT' },
  { name: 'Cinzel', category: 'Cinematic', googleFamily: 'Cinzel:wght@700', previewText: 'CHAPTER I' },
  { name: 'Oswald', category: 'Modern', googleFamily: 'Oswald:wght@600;700', previewText: 'MONTAGE' },
  { name: 'Righteous', category: 'Modern', googleFamily: 'Righteous', previewText: 'VELOCITY' },
  { name: 'Pacifico', category: 'Meme', googleFamily: 'Pacifico', previewText: 'Vibe Check' },
  { name: 'Lobster', category: 'Meme', googleFamily: 'Lobster', previewText: 'Smooth Cut' },
  { name: 'Press Start 2P', category: 'Gaming', googleFamily: 'Press+Start+2P', previewText: 'LEVEL UP' },
];

const loadedFontSet = new Set<string>(['Outfit', 'Plus Jakarta Sans', 'JetBrains Mono']);

export async function loadGoogleFont(item: FontCatalogItem): Promise<void> {
  if (loadedFontSet.has(item.name)) return;
  const linkId = `gf-${item.name.replace(/\s+/g, '-').toLowerCase()}`;
  if (!document.getElementById(linkId)) {
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${item.googleFamily}&display=swap`;
    document.head.appendChild(link);
  }
  try {
    await document.fonts.load(`700 40px "${item.name}"`);
    loadedFontSet.add(item.name);
  } catch {
    loadedFontSet.add(item.name);
  }
}

export async function installGoogleFontByInput(input: string): Promise<string> {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Enter a Google Font name or link.');

  let cssHref = '';
  let familyName = trimmed;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    cssHref = trimmed;
    const match = trimmed.match(/family=([^:&]+)/);
    familyName = match ? decodeURIComponent(match[1]).replace(/\+/g, ' ') : 'CustomWebFont';
  } else {
    const encoded = trimmed.replace(/\s+/g, '+');
    cssHref = `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;700;900&display=swap`;
  }

  const linkId = `gf-custom-${familyName.replace(/\s+/g, '-').toLowerCase()}`;
  if (!document.getElementById(linkId)) {
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = cssHref;
    document.head.appendChild(link);
  }

  try {
    await document.fonts.load(`700 40px "${familyName}"`);
  } catch {
    await document.fonts.load(`400 40px "${familyName}"`).catch(() => undefined);
  }
  loadedFontSet.add(familyName);
  return familyName;
}

export async function installLocalFontFile(file: File): Promise<string> {
  if (/\.zip$/i.test(file.name)) {
    const { extractFontFromZip } = await import('../engine/zipFontExtractor');
    const extracted = await extractFontFromZip(file);
    const fontFace = new FontFace(extracted.name, extracted.buffer.slice(0));
    const loaded = await fontFace.load();
    document.fonts.add(loaded);
    loadedFontSet.add(extracted.name);
    void saveCustomFontBlobToDraftDb(extracted.name, extracted.buffer.slice(0));
    return extracted.name;
  }

  const cleanName = file.name.replace(/\.(ttf|otf|woff2?|TTF|OTF|WOFF2?)$/, '');
  const buffer = await file.arrayBuffer();
  const fontFace = new FontFace(cleanName, buffer.slice(0));
  const loaded = await fontFace.load();
  document.fonts.add(loaded);
  loadedFontSet.add(cleanName);
  void saveCustomFontBlobToDraftDb(cleanName, buffer.slice(0));
  return cleanName;
}

export const TEXT_STYLE_PRESETS: {
  id: TextStylePreset;
  label: string;
  desc: string;
}[] = [
  { id: 'outline', label: 'Bold Stroke', desc: 'Viral thick outline' },
  { id: 'neon-glow', label: 'Neon Bloom', desc: 'Glowing aura' },
  { id: 'cyber-box', label: 'Caption Card', desc: 'Crisp HUD bar' },
  { id: 'gradient-fire', label: 'Gradient', desc: 'Dual gradient fill' },
  { id: '3d-pop', label: '3D Extrude', desc: 'Depth block pop' },
  { id: 'clean', label: 'Clean Shadow', desc: 'Minimal soft drop' },
];

export interface CreatorTextRecipe {
  id: string;
  label: string;
  previewColor1: string;
  previewColor2: string;
  fontFamily: string;
  patch: {
    textStyle: TextStylePreset;
    textColor: string;
    textGradientEnabled: boolean;
    textGradientColor1: string;
    textGradientColor2: string;
    textGradientAngle: number;
    textStrokeColor: string;
    textStrokeWidth: number;
    textShadowColor: string;
    textShadowBlur: number;
    textShadowOffsetX: number;
    textShadowOffsetY: number;
    textBgEnabled: boolean;
    textBgColor: string;
    textUppercase: boolean;
  };
}

export const CREATOR_TEXT_RECIPES: CreatorTextRecipe[] = [
  {
    id: 'mrbeast-gold',
    label: 'MrBeast Gold',
    previewColor1: '#FFE600',
    previewColor2: '#FF7A00',
    fontFamily: 'Anton',
    patch: {
      textStyle: 'outline',
      textColor: '#FFE600',
      textGradientEnabled: true,
      textGradientColor1: '#FFF04D',
      textGradientColor2: '#FF8A00',
      textGradientAngle: 90,
      textStrokeColor: '#000000',
      textStrokeWidth: 16,
      textShadowColor: 'rgba(0,0,0,0.95)',
      textShadowBlur: 0,
      textShadowOffsetX: 4,
      textShadowOffsetY: 7,
      textBgEnabled: false,
      textBgColor: '#000000',
      textUppercase: true,
    },
  },
  {
    id: 'hormozi-green',
    label: 'Viral Cash',
    previewColor1: '#4ADE80',
    previewColor2: '#00CAE0',
    fontFamily: 'Montserrat',
    patch: {
      textStyle: 'outline',
      textColor: '#34D399',
      textGradientEnabled: true,
      textGradientColor1: '#6EE7B7',
      textGradientColor2: '#00CAE0',
      textGradientAngle: 90,
      textStrokeColor: '#000000',
      textStrokeWidth: 14,
      textShadowColor: 'rgba(0,0,0,0.9)',
      textShadowBlur: 10,
      textShadowOffsetX: 0,
      textShadowOffsetY: 6,
      textBgEnabled: false,
      textBgColor: '#000000',
      textUppercase: true,
    },
  },
  {
    id: 'fire-reel',
    label: 'Hyper Fire',
    previewColor1: '#FF4D4D',
    previewColor2: '#FBBF24',
    fontFamily: 'Bangers',
    patch: {
      textStyle: 'outline',
      textColor: '#FF4D4D',
      textGradientEnabled: true,
      textGradientColor1: '#FFF500',
      textGradientColor2: '#FF2A54',
      textGradientAngle: 90,
      textStrokeColor: '#120309',
      textStrokeWidth: 15,
      textShadowColor: 'rgba(255,42,84,0.65)',
      textShadowBlur: 18,
      textShadowOffsetX: 0,
      textShadowOffsetY: 5,
      textBgEnabled: false,
      textBgColor: '#000000',
      textUppercase: true,
    },
  },
  {
    id: 'cyber-glow',
    label: 'Cyber Neon',
    previewColor1: '#FFFFFF',
    previewColor2: '#00CAE0',
    fontFamily: 'Orbitron',
    patch: {
      textStyle: 'neon-glow',
      textColor: '#00CAE0',
      textGradientEnabled: true,
      textGradientColor1: '#FFFFFF',
      textGradientColor2: '#00CAE0',
      textGradientAngle: 90,
      textStrokeColor: '#003C47',
      textStrokeWidth: 6,
      textShadowColor: '#00CAE0',
      textShadowBlur: 28,
      textShadowOffsetX: 0,
      textShadowOffsetY: 0,
      textBgEnabled: false,
      textBgColor: '#000000',
      textUppercase: true,
    },
  },
  {
    id: 'reel-box',
    label: 'Caption Box',
    previewColor1: '#FFFFFF',
    previewColor2: '#E4E4EA',
    fontFamily: 'Poppins',
    patch: {
      textStyle: 'cyber-box',
      textColor: '#FFFFFF',
      textGradientEnabled: false,
      textGradientColor1: '#FFFFFF',
      textGradientColor2: '#00CAE0',
      textGradientAngle: 90,
      textStrokeColor: '#000000',
      textStrokeWidth: 0,
      textShadowColor: 'rgba(0,0,0,0.45)',
      textShadowBlur: 8,
      textShadowOffsetX: 0,
      textShadowOffsetY: 2,
      textBgEnabled: true,
      textBgColor: '#0B0B10',
      textUppercase: false,
    },
  },
];

export type EffectCategory =
  | 'All'
  | 'Trending Viral'
  | 'Glitch & Cyber'
  | 'Lens & Warp'
  | 'Glow & Neon'
  | 'Motion'
  | 'Film LUTs';

export interface VideoEffectCatalogItem {
  id: VideoEffectType;
  label: string;
  desc: string;
  category: Exclude<EffectCategory, 'All'>;
}

export const VIDEO_EFFECTS: VideoEffectCatalogItem[] = [
  { id: 'none', label: 'Original', desc: 'Raw frame', category: 'Film LUTs' },
  // Trending Viral
  { id: 'rgb-split-pro', label: 'RGB Split Beat', desc: 'Beat zoom prism burst', category: 'Trending Viral' },
  { id: 'anime-speedlines', label: 'Anime Speedlines', desc: 'Manga velocity lines', category: 'Trending Viral' },
  { id: 'light-leak-flare', label: 'Light Leak Flare', desc: 'Anamorphic lens sweep', category: 'Trending Viral' },
  { id: 'film-burn-halation', label: 'Kodak Halation', desc: '35mm red glow + grain', category: 'Trending Viral' },
  { id: 'sparkle-bling', label: 'Bling Sparkle', desc: '4-point highlight stars', category: 'Trending Viral' },
  { id: 'cyber-hud-scan', label: 'Cyber HUD Lock', desc: 'Target reticle scanner', category: 'Trending Viral' },
  { id: 'manga-ink', label: 'Manga Comic Ink', desc: 'Bold anime ink outlines', category: 'Trending Viral' },
  { id: 'dreamy-glow', label: 'Orton Dreamy', desc: 'Pro highlight glow', category: 'Trending Viral' },
  { id: 'chrome-liquid', label: 'Liquid Chrome', desc: 'Metallic foil wave', category: 'Trending Viral' },
  { id: 'vhs-camcorder', label: '90s Camcorder', desc: 'Head switch + grain', category: 'Trending Viral' },
  // Glitch & Cyber
  { id: 'rgb-glitch', label: 'RGB Glitch', desc: 'WebGL tear split', category: 'Glitch & Cyber' },
  { id: 'chromatic-aberration', label: 'RGB Prism Edge', desc: 'Optic fringe', category: 'Glitch & Cyber' },
  { id: 'vhs-retro', label: 'VHS CRT', desc: 'Analog tape wave', category: 'Glitch & Cyber' },
  { id: 'crt-scanlines', label: 'CRT Tube', desc: 'Curved scanline', category: 'Glitch & Cyber' },
  { id: 'data-mosh', label: 'Data Mosh', desc: 'Codec block shift', category: 'Glitch & Cyber' },
  { id: 'tv-static', label: 'TV Static', desc: 'Broadcast snow', category: 'Glitch & Cyber' },
  { id: 'cyber-matrix', label: 'Matrix Rain', desc: 'Digital cascade', category: 'Glitch & Cyber' },
  { id: 'halftone-pixel', label: 'Pixelate 8-Bit', desc: 'Block mosaic', category: 'Glitch & Cyber' },
  // Lens & Warp
  { id: 'kaleidoscope', label: 'Kaleidoscope 6x', desc: '6-fold mirror', category: 'Lens & Warp' },
  { id: 'kaleido-8', label: 'Kaleido 8x', desc: '8-fold crystal', category: 'Lens & Warp' },
  { id: 'bulge-fisheye', label: 'Bulge Fisheye', desc: 'Wide punch lens', category: 'Lens & Warp' },
  { id: 'pinch-warp', label: 'Pinch Warp', desc: 'Suck-in optic', category: 'Lens & Warp' },
  { id: 'swirl-vortex', label: 'Swirl Vortex', desc: 'Spiral twist', category: 'Lens & Warp' },
  { id: 'mirror-split', label: 'Mirror Split', desc: 'Symmetry cut', category: 'Lens & Warp' },
  { id: 'mirror-quad', label: 'Quad Mirror', desc: '4-way prism', category: 'Lens & Warp' },
  { id: 'wave-ripple', label: 'Shockwave', desc: 'Water ripple', category: 'Lens & Warp' },
  { id: 'mosaic-blur', label: 'Dream Blur', desc: 'Soft lens defocus', category: 'Lens & Warp' },
  // Motion
  { id: 'motion-blur-zoom', label: 'Hyper Zoom', desc: '12-tap radial blur', category: 'Motion' },
  { id: 'radial-blur', label: 'Spin Blur', desc: 'Whip rotation blur', category: 'Motion' },
  { id: 'shake-impact', label: 'Shake Cam', desc: 'Bass impact shake', category: 'Motion' },
  { id: 'zoom-pulse', label: 'Beat Pulse', desc: 'Rhythm zoom', category: 'Motion' },
  { id: 'heartbeat-pump', label: 'Bass Pump', desc: 'Sub-drop punch', category: 'Motion' },
  { id: 'whiplash-pan', label: 'Whiplash Sway', desc: 'Camera drift', category: 'Motion' },
  // Glow & Neon
  { id: 'neon-edges', label: 'Neon Edges', desc: 'Sobel edge trace', category: 'Glow & Neon' },
  { id: 'cyber-prism', label: 'Prism Sweep', desc: 'Light leak beam', category: 'Glow & Neon' },
  { id: 'bloom-aura', label: 'Pro Bloom', desc: 'Highlight halo', category: 'Glow & Neon' },
  { id: 'neon-flash', label: 'Beat Flash', desc: 'Strobe exposure', category: 'Glow & Neon' },
  { id: 'laser-grid', label: 'Laser Scanner', desc: 'HUD grid sweep', category: 'Glow & Neon' },
  { id: 'edge-glow', label: 'Cyber Border', desc: 'Cyan edge bloom', category: 'Glow & Neon' },
  { id: 'thermal-heat', label: 'Thermal IR', desc: 'Predator heat', category: 'Glow & Neon' },
  { id: 'xray-invert', label: 'X-Ray Invert', desc: 'Negative shock', category: 'Glow & Neon' },
  { id: 'solarize', label: 'Solarize', desc: 'Metallic invert', category: 'Glow & Neon' },
  // Film LUTs
  { id: 'cinematic-teal', label: 'Teal & Orange', desc: 'Hollywood LUT', category: 'Film LUTs' },
  { id: 'warm-gold', label: 'Golden Hour', desc: 'Warm sunset LUT', category: 'Film LUTs' },
  { id: 'cyberpunk-pink', label: 'Night Neon', desc: 'Violet-pink grade', category: 'Film LUTs' },
  { id: 'emerald-matrix', label: 'Emerald Grade', desc: 'Moody green LUT', category: 'Film LUTs' },
  { id: 'sunset-glow', label: 'Sunset Gradient', desc: 'Amber rose sky', category: 'Film LUTs' },
  { id: 'night-vision', label: 'Night Vision', desc: 'Tactical green', category: 'Film LUTs' },
  { id: 'bw-contrast', label: 'Noir B&W', desc: 'Crisp mono LUT', category: 'Film LUTs' },
  { id: 'deep-contrast', label: 'Punch HDR', desc: 'Creator contrast', category: 'Film LUTs' },
  { id: 'sepia-vintage', label: '90s Vintage', desc: 'Warm sepia film', category: 'Film LUTs' },
  { id: 'fade-film', label: 'Matte Film', desc: 'Lifted shadows', category: 'Film LUTs' },
  { id: 'vignette', label: 'Cinema Vignette', desc: 'Focus edge dark', category: 'Film LUTs' },
];

export type TransitionCategory =
  | 'All'
  | 'Glitch & TV'
  | 'Zoom & Spin'
  | '3D & Flip'
  | 'Wipe & Split'
  | 'Burn & Glow'
  | 'Dissolve';

export interface TransitionCatalogItem {
  id: TransitionType;
  label: string;
  author?: string;
  category: Exclude<TransitionCategory, 'All'>;
}

const formatGlName = (raw: string): string =>
  raw.replace(/([a-z])([A-Z])/g, '$1 $2').trim();

function categorizeGlTransition(name: string): Exclude<TransitionCategory, 'All'> {
  const n = name.toLowerCase();
  if (/glitch|tv|vhs|static|datamosh|ascii|scan|code|pixel/.test(n)) return 'Glitch & TV';
  if (/zoom|spin|whip|swirl|vortex|warp|pinwheel|shake|ripple|shockwave|gravity/.test(n))
    return 'Zoom & Spin';
  if (/cube|flip|fold|page|roll|book|card|door|curtain|domino|tumble|sphere|puzzle/.test(n))
    return '3D & Flip';
  if (/burn|flame|flash|light|flare|glow|bloom|overexposure|ink|vaporize|shatter|melt|smoke/.test(n))
    return 'Burn & Glow';
  if (/wipe|slice|blind|split|cover|slide|chess|grid|comb|honeycomb|iris|heart|star|plus|circle/.test(n))
    return 'Wipe & Split';
  return 'Dissolve';
}

export const CLIP_TRANSITIONS: TransitionCatalogItem[] = [
  { id: 'none', label: 'None', author: 'Cut', category: 'Dissolve' },
  ...getAvailableGlTransitions().map((entry) => ({
    id: entry.name as TransitionType,
    label: formatGlName(entry.name),
    author: entry.author || 'gl-transitions',
    category: categorizeGlTransition(entry.name),
  })),
];

export const TEXT_ANIMATIONS: {
  id: TextAnimationType;
  label: string;
  animateClass: string;
}[] = [
  { id: 'none', label: 'Static', animateClass: '' },
  { id: 'bounceIn', label: 'Bounce In', animateClass: 'animate__bounceIn' },
  { id: 'rubberBand', label: 'Rubber Band', animateClass: 'animate__rubberBand' },
  { id: 'tada', label: 'Tada Pop', animateClass: 'animate__tada' },
  { id: 'jello', label: 'Jello Jelly', animateClass: 'animate__jello' },
  { id: 'jackInTheBox', label: 'Jack In Box', animateClass: 'animate__jackInTheBox' },
  { id: 'backInUp', label: 'Back In Up', animateClass: 'animate__backInUp' },
  { id: 'zoomInDown', label: 'Zoom Drop', animateClass: 'animate__zoomInDown' },
  { id: 'flipInX', label: '3D Flip X', animateClass: 'animate__flipInX' },
  { id: 'lightSpeedInRight', label: 'Light Speed', animateClass: 'animate__lightSpeedInRight' },
  { id: 'typewriter', label: 'Typewriter', animateClass: '' },
  { id: 'glitch-flicker', label: 'Glitch', animateClass: 'animate__headShake' },
];

export interface StockClipPreset {
  id: string;
  name: string;
  variant: string;
  category: 'Gaming' | 'Aesthetic' | 'Transitions';
  durationSec: number;
  bgHex: string;
  accentHex: string;
}

export const STOCK_CLIPS: StockClipPreset[] = [
  { id: 'stk-cyber', name: 'Cyber Grid Loop', variant: 'cyber-grid', category: 'Gaming', durationSec: 4.5, bgHex: '#0F172A', accentHex: '#00CAE0' },
  { id: 'stk-warp', name: 'Hyper Warp Speed', variant: 'hyper-warp', category: 'Gaming', durationSec: 4.0, bgHex: '#1A1033', accentHex: '#A78BFA' },
  { id: 'stk-matrix', name: 'Digital Rain Dark', variant: 'digital-rain', category: 'Gaming', durationSec: 5.0, bgHex: '#071B15', accentHex: '#34D399' },
  { id: 'stk-sunset', name: 'Synthwave Horizon', variant: 'synth-horizon', category: 'Aesthetic', durationSec: 5.0, bgHex: '#230F2B', accentHex: '#F472B6' },
  { id: 'stk-particles', name: 'Ember Particles', variant: 'ember-dust', category: 'Aesthetic', durationSec: 4.5, bgHex: '#1F1209', accentHex: '#FBBF24' },
  { id: 'stk-prism', name: 'Glass Prism Sweep', variant: 'glass-prism', category: 'Aesthetic', durationSec: 4.0, bgHex: '#101827', accentHex: '#38BDF8' },
  { id: 'stk-countdown', name: '3-2-1 Drop Timer', variant: 'countdown', category: 'Transitions', durationSec: 3.0, bgHex: '#09090B', accentHex: '#FFFFFF' },
  { id: 'stk-flash-bars', name: 'Cinematic Bars', variant: 'cinema-bars', category: 'Transitions', durationSec: 4.0, bgHex: '#050507', accentHex: '#E4E4EA' },
];

export interface MemeLibraryItem {
  id: string;
  title: string;
  category: 'Sound FX';
  kind: 'sfx';
  accentHex: string;
  sfxId: string;
  durationSec: number;
}

export const MEME_LIBRARY: MemeLibraryItem[] = [
  { id: 'sfx-vine-boom', title: 'Vine Boom Thud', category: 'Sound FX', kind: 'sfx', accentHex: '#00CAE0', sfxId: 'vine-boom', durationSec: 1.2 },
  { id: 'sfx-airhorn', title: 'MLG Airhorn', category: 'Sound FX', kind: 'sfx', accentHex: '#F59E0B', sfxId: 'airhorn', durationSec: 1.2 },
  { id: 'sfx-bruh-bass', title: 'Bruh Bass Drop', category: 'Sound FX', kind: 'sfx', accentHex: '#A78BFA', sfxId: 'bruh-bass', durationSec: 1.0 },
  { id: 'sfx-anime-wow', title: 'Anime Wow Synth', category: 'Sound FX', kind: 'sfx', accentHex: '#F472B6', sfxId: 'anime-wow', durationSec: 1.0 },
  { id: 'sfx-sad-trombone', title: 'Sad Fail Wah-Wah', category: 'Sound FX', kind: 'sfx', accentHex: '#94A3B8', sfxId: 'sad-trombone', durationSec: 1.8 },
  { id: 'sfx-glitch-zap', title: 'Glitch Transition Zap', category: 'Sound FX', kind: 'sfx', accentHex: '#38BDF8', sfxId: 'glitch-zap', durationSec: 0.8 },
  { id: 'sfx-victory-ding', title: 'Level Up Victory', category: 'Sound FX', kind: 'sfx', accentHex: '#34D399', sfxId: 'victory-ding', durationSec: 1.2 },
  { id: 'sfx-scratch', title: 'Record Scratch Cut', category: 'Sound FX', kind: 'sfx', accentHex: '#FB7185', sfxId: 'record-scratch', durationSec: 0.9 },
];

export interface IntroOutroTemplate {
  id: string;
  kind: 'intro' | 'outro';
  name: string;
  headline: string;
  subline: string;
  stockVariant: string;
  textAnimation: TextAnimationType;
  fontFamily: string;
  colorHex: string;
  durationSec: number;
}

export const INTRO_OUTRO_TEMPLATES: IntroOutroTemplate[] = [
  {
    id: 'tpl-intro-cyber',
    kind: 'intro',
    name: 'Cyber Glitch Intro',
    headline: 'TG7 STUDIO',
    subline: 'PRESENTS',
    stockVariant: 'cyber-grid',
    textAnimation: 'glitch-flicker',
    fontFamily: 'Orbitron',
    colorHex: '#00CAE0',
    durationSec: 3.0,
  },
  {
    id: 'tpl-intro-cinema',
    kind: 'intro',
    name: 'Cinematic Title Intro',
    headline: 'THE MONTAGE',
    subline: 'DIRECTED BY TG7',
    stockVariant: 'cinema-bars',
    textAnimation: 'zoomInDown',
    fontFamily: 'Bebas Neue',
    colorHex: '#FFFFFF',
    durationSec: 3.5,
  },
  {
    id: 'tpl-intro-gaming',
    kind: 'intro',
    name: '3-2-1 Drop Intro',
    headline: 'GET READY',
    subline: 'WATCH THIS',
    stockVariant: 'countdown',
    textAnimation: 'bounceIn',
    fontFamily: 'Black Ops One',
    colorHex: '#FBBF24',
    durationSec: 3.0,
  },
  {
    id: 'tpl-outro-sub',
    kind: 'outro',
    name: 'Follow & Subscribe Outro',
    headline: 'THANKS FOR WATCHING',
    subline: 'LIKE · SHARE · FOLLOW',
    stockVariant: 'synth-horizon',
    textAnimation: 'backInUp',
    fontFamily: 'Bebas Neue',
    colorHex: '#00CAE0',
    durationSec: 3.5,
  },
  {
    id: 'tpl-outro-ember',
    kind: 'outro',
    name: 'Credits Fade Outro',
    headline: 'EDITED WITH TG7',
    subline: 'SEE YOU NEXT VIDEO',
    stockVariant: 'ember-dust',
    textAnimation: 'typewriter',
    fontFamily: 'Cinzel',
    colorHex: '#FBBF24',
    durationSec: 3.5,
  },
];

export interface ResourceWebsiteItem {
  id: string;
  name: string;
  tagline: string;
  category: 'Meme Sounds' | 'Songs & Beats' | 'Meme VFX & Video' | 'Fonts' | 'SVG & Stickers';
  url: string;
  accentHex: string;
}

export const RESOURCE_WEBSITES: ResourceWebsiteItem[] = [
  {
    id: 'site-myinstants',
    name: 'MyInstants',
    tagline: 'Instant meme sound buttons & viral MP3s',
    category: 'Meme Sounds',
    url: 'https://www.myinstants.com/en/index/in/',
    accentHex: '#00CAE0',
  },
  {
    id: 'site-voicy',
    name: 'Voicy Soundboard',
    tagline: 'Gaming, anime & trending meme sounds',
    category: 'Meme Sounds',
    url: 'https://www.voicy.network/',
    accentHex: '#A78BFA',
  },
  {
    id: 'site-pixabay-sfx',
    name: 'Pixabay Sound FX',
    tagline: 'Free SFX downloads without sign-up',
    category: 'Meme Sounds',
    url: 'https://pixabay.com/sound-effects/',
    accentHex: '#34D399',
  },
  {
    id: 'site-mixkit-sfx',
    name: 'Mixkit Free SFX',
    tagline: 'Whooshes, risers, hits & glitch sounds',
    category: 'Meme Sounds',
    url: 'https://mixkit.co/free-sound-effects/',
    accentHex: '#FBBF24',
  },
  {
    id: 'site-pixabay-music',
    name: 'Pixabay Music',
    tagline: 'Copyright-free songs, phonk & vlog beats',
    category: 'Songs & Beats',
    url: 'https://pixabay.com/music/',
    accentHex: '#34D399',
  },
  {
    id: 'site-ncs',
    name: 'NCS Music',
    tagline: 'NoCopyrightSounds for gaming & montages',
    category: 'Songs & Beats',
    url: 'https://ncs.io/music',
    accentHex: '#00CAE0',
  },
  {
    id: 'site-mixkit-music',
    name: 'Mixkit Stock Music',
    tagline: 'Free cinematic, hip-hop & lo-fi tracks',
    category: 'Songs & Beats',
    url: 'https://mixkit.co/free-stock-music/',
    accentHex: '#F472B6',
  },
  {
    id: 'site-mixkit-vfx',
    name: 'Mixkit Video & VFX',
    tagline: 'Free glitch overlays, fire, smoke & transitions',
    category: 'Meme VFX & Video',
    url: 'https://mixkit.co/free-stock-video/',
    accentHex: '#A78BFA',
  },
  {
    id: 'site-pixabay-gs',
    name: 'Pixabay Green Screen',
    tagline: 'Green screen meme overlays & explosions',
    category: 'Meme VFX & Video',
    url: 'https://pixabay.com/videos/search/green%20screen/',
    accentHex: '#34D399',
  },
  {
    id: 'site-pexels-video',
    name: 'Pexels Videos',
    tagline: 'Free 4K & HD stock clips for reels',
    category: 'Meme VFX & Video',
    url: 'https://www.pexels.com/videos/',
    accentHex: '#38BDF8',
  },
  {
    id: 'site-giphy',
    name: 'GIPHY Stickers & Memes',
    tagline: 'Transparent meme stickers & reaction GIFs',
    category: 'Meme VFX & Video',
    url: 'https://giphy.com/',
    accentHex: '#FBBF24',
  },
  {
    id: 'site-svgrepo',
    name: 'SVG Repo',
    tagline: '500k+ free SVG vectors, badges & HUD icons',
    category: 'SVG & Stickers',
    url: 'https://www.svgrepo.com/',
    accentHex: '#00CAE0',
  },
  {
    id: 'site-iconify',
    name: 'Iconify GitHub Sets',
    tagline: '200k+ open-source GitHub vector icons',
    category: 'SVG & Stickers',
    url: 'https://icon-sets.iconify.design/',
    accentHex: '#38BDF8',
  },
  {
    id: 'site-flaticon',
    name: 'Flaticon Stickers',
    tagline: 'Vector gaming badges & creator stickers',
    category: 'SVG & Stickers',
    url: 'https://www.flaticon.com/stickers',
    accentHex: '#34D399',
  },
  {
    id: 'site-google-fonts',
    name: 'Google Fonts',
    tagline: 'Instant web fonts — paste name or link in app',
    category: 'Fonts',
    url: 'https://fonts.google.com/',
    accentHex: '#00CAE0',
  },
  {
    id: 'site-dafont',
    name: 'DaFont (.ZIP Ready)',
    tagline: 'Esports, brush & meme fonts — import .ZIP directly',
    category: 'Fonts',
    url: 'https://www.dafont.com/',
    accentHex: '#F59E0B',
  },
  {
    id: 'site-1001fonts',
    name: '1001 Fonts (.ZIP Ready)',
    tagline: 'Free custom TTF/OTF/ZIP fonts for titles',
    category: 'Fonts',
    url: 'https://www.1001fonts.com/',
    accentHex: '#A78BFA',
  },
];
