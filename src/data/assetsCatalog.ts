import { TextAnimationType, TransitionType, VideoEffectType } from '../types/editor';

export interface FontCatalogItem {
  name: string;
  category: 'Gaming' | 'Meme' | 'Cinematic' | 'Modern';
  googleFamily: string;
  previewText: string;
}

export const GOOGLE_FONT_CATALOG: FontCatalogItem[] = [
  { name: 'Bebas Neue', category: 'Cinematic', googleFamily: 'Bebas+Neue', previewText: 'EPIC INTRO' },
  { name: 'Anton', category: 'Meme', googleFamily: 'Anton', previewText: 'TOP TEXT' },
  { name: 'Bangers', category: 'Meme', googleFamily: 'Bangers', previewText: 'BOOM!' },
  { name: 'Orbitron', category: 'Gaming', googleFamily: 'Orbitron:wght@700;900', previewText: 'CLUTCH 4K' },
  { name: 'Black Ops One', category: 'Gaming', googleFamily: 'Black+Ops+One', previewText: 'VICTORY' },
  { name: 'Audiowide', category: 'Gaming', googleFamily: 'Audiowide', previewText: 'CYBER RUN' },
  { name: 'Rubik Glitch', category: 'Gaming', googleFamily: 'Rubik+Glitch', previewText: 'GLITCH FX' },
  { name: 'Permanent Marker', category: 'Meme', googleFamily: 'Permanent+Marker', previewText: 'BRUH MOMENT' },
  { name: 'Cinzel', category: 'Cinematic', googleFamily: 'Cinzel:wght@700', previewText: 'CHAPTER ONE' },
  { name: 'Oswald', category: 'Modern', googleFamily: 'Oswald:wght@600;700', previewText: 'MONTAGE' },
  { name: 'Righteous', category: 'Modern', googleFamily: 'Righteous', previewText: 'VELOCITY' },
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

export async function installLocalFontFile(file: File): Promise<string> {
  const cleanName = file.name.replace(/\.(ttf|otf|woff2?|TTF|OTF|WOFF2?)$/, '');
  const buffer = await file.arrayBuffer();
  const fontFace = new FontFace(cleanName, buffer);
  const loaded = await fontFace.load();
  document.fonts.add(loaded);
  loadedFontSet.add(cleanName);
  return cleanName;
}

export const VIDEO_EFFECTS: { id: VideoEffectType; label: string; desc: string }[] = [
  { id: 'none', label: 'Original', desc: 'No effect' },
  { id: 'rgb-glitch', label: 'RGB Glitch', desc: 'Chromatic split' },
  { id: 'vhs-retro', label: 'VHS Retro', desc: 'Scanlines & tape' },
  { id: 'neon-flash', label: 'Beat Flash', desc: 'Strobe exposure' },
  { id: 'shake-impact', label: 'Shake Cam', desc: 'Camera impact' },
  { id: 'zoom-pulse', label: 'Beat Zoom', desc: 'Rhythm pulse' },
  { id: 'edge-glow', label: 'Edge Glow', desc: 'High contrast pop' },
  { id: 'vignette', label: 'Dark Vignette', desc: 'Cinematic frame' },
  { id: 'bw-contrast', label: 'Noir B&W', desc: 'High contrast mono' },
  { id: 'warm-gold', label: 'Golden Hour', desc: 'Warm film tone' },
];

export const CLIP_TRANSITIONS: { id: TransitionType; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'dissolve', label: 'Mix Dissolve' },
  { id: 'flash-white', label: 'White Flash' },
  { id: 'fade-black', label: 'Black Fade' },
  { id: 'zoom-in', label: 'Zoom Pull' },
  { id: 'zoom-out', label: 'Zoom Out' },
  { id: 'slide-left', label: 'Slide Left' },
  { id: 'slide-up', label: 'Slide Up' },
  { id: 'spin-cut', label: 'Whip Spin' },
  { id: 'circle-wipe', label: 'Circle Wipe' },
  { id: 'glitch-cut', label: 'Glitch Cut' },
];

export const TEXT_ANIMATIONS: { id: TextAnimationType; label: string }[] = [
  { id: 'none', label: 'Static' },
  { id: 'typewriter', label: 'Typewriter' },
  { id: 'pop-bounce', label: 'Pop Bounce' },
  { id: 'slide-up', label: 'Slide Up' },
  { id: 'glitch-flicker', label: 'Glitch' },
  { id: 'neon-pulse', label: 'Glow Pulse' },
  { id: 'zoom-reveal', label: 'Zoom In' },
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
  category: 'Trending' | 'Gaming' | 'Reaction' | 'Green Screen' | 'Sound FX';
  kind: 'visual' | 'sfx';
  topText?: string;
  bottomText?: string;
  accentHex: string;
  chromaGreen?: boolean;
  sfxId?: string;
  durationSec: number;
}

export const MEME_LIBRARY: MemeLibraryItem[] = [
  // Trending Memes
  { id: 'meme-emotional', title: 'Emotional Damage', category: 'Trending', kind: 'visual', topText: 'EMOTIONAL', bottomText: 'DAMAGE!', accentHex: '#EF4444', durationSec: 2.8 },
  { id: 'meme-let-him-cook', title: 'Let Him Cook', category: 'Trending', kind: 'visual', topText: 'HOLD UP...', bottomText: 'LET HIM COOK', accentHex: '#F59E0B', durationSec: 3.0 },
  { id: 'meme-bro-what', title: 'Bro What??', category: 'Trending', kind: 'visual', topText: 'BRO', bottomText: 'WHAT?!', accentHex: '#38BDF8', durationSec: 2.2 },
  { id: 'meme-mission-failed', title: 'Mission Failed', category: 'Trending', kind: 'visual', topText: 'MISSION FAILED', bottomText: 'NEXT TIME', accentHex: '#94A3B8', durationSec: 3.0 },
  { id: 'meme-to-be-continued', title: 'To Be Continued', category: 'Trending', kind: 'visual', topText: 'TO BE', bottomText: 'CONTINUED ->', accentHex: '#FBBF24', durationSec: 3.2 },
  { id: 'meme-gigachad', title: 'Sigma Aura', category: 'Trending', kind: 'visual', topText: 'SIGMA', bottomText: 'MOMENT', accentHex: '#E4E4EA', durationSec: 2.8 },
  { id: 'meme-skill-issue', title: 'Skill Issue', category: 'Trending', kind: 'visual', topText: 'PURE', bottomText: 'SKILL ISSUE', accentHex: '#F472B6', durationSec: 2.4 },
  { id: 'meme-hold-on', title: 'Wait A Minute', category: 'Trending', kind: 'visual', topText: 'WAIT A', bottomText: 'MINUTE...', accentHex: '#00CAE0', durationSec: 2.5 },

  // Gaming Memes
  { id: 'meme-1hp', title: 'Literally 1 HP', category: 'Gaming', kind: 'visual', topText: 'ENEMY WAS', bottomText: '1 HP!!', accentHex: '#EF4444', durationSec: 2.5 },
  { id: 'meme-clutch-god', title: '1v4 Clutch God', category: 'Gaming', kind: 'visual', topText: '1V4 CLUTCH', bottomText: 'UNSTOPPABLE', accentHex: '#34D399', durationSec: 3.0 },
  { id: 'meme-lag-ping', title: '999ms Ping Spike', category: 'Gaming', kind: 'visual', topText: 'PING: 999MS', bottomText: 'TELEPORTING', accentHex: '#F59E0B', durationSec: 2.6 },
  { id: 'meme-hacker', title: 'Reported Hacking', category: 'Gaming', kind: 'visual', topText: 'AIMBOT?', bottomText: 'NO JUST SKILL', accentHex: '#A78BFA', durationSec: 2.8 },
  { id: 'meme-third-party', title: 'Third Party Alert', category: 'Gaming', kind: 'visual', topText: 'WARNING', bottomText: 'THIRD PARTY!', accentHex: '#FB7185', durationSec: 2.4 },
  { id: 'meme-easy-gg', title: 'GG EZ Clap', category: 'Gaming', kind: 'visual', topText: 'GG', bottomText: 'EZ CLAP', accentHex: '#00CAE0', durationSec: 2.2 },

  // Reaction & Green Screen Overlays
  { id: 'meme-gs-subscribe', title: 'Green Screen Like & Sub', category: 'Green Screen', kind: 'visual', topText: 'LIKE &', bottomText: 'SUBSCRIBE', accentHex: '#EF4444', chromaGreen: true, durationSec: 3.5 },
  { id: 'meme-gs-shock', title: 'Green Screen OMG Stamp', category: 'Green Screen', kind: 'visual', topText: 'OMG!!', bottomText: 'NO WAY', accentHex: '#FBBF24', chromaGreen: true, durationSec: 2.5 },
  { id: 'meme-gs-rec', title: 'Green Screen REC Cam', category: 'Green Screen', kind: 'visual', topText: 'REC', bottomText: 'LIVE CAM', accentHex: '#34D399', chromaGreen: true, durationSec: 4.0 },
  { id: 'meme-gs-wasted', title: 'Green Screen WASTED', category: 'Green Screen', kind: 'visual', topText: 'WASTED', bottomText: 'KO', accentHex: '#F87171', chromaGreen: true, durationSec: 2.8 },

  // Reaction Stickers
  { id: 'meme-react-100', title: '100% Certified', category: 'Reaction', kind: 'visual', topText: '100%', bottomText: 'CERTIFIED', accentHex: '#34D399', durationSec: 2.2 },
  { id: 'meme-react-rip', title: 'RIP Combo', category: 'Reaction', kind: 'visual', topText: 'R.I.P', bottomText: 'RIP BOZO', accentHex: '#94A3B8', durationSec: 2.4 },
  { id: 'meme-react-brain', title: '200 IQ Play', category: 'Reaction', kind: 'visual', topText: '200 IQ', bottomText: 'BIG BRAIN', accentHex: '#38BDF8', durationSec: 2.6 },
  { id: 'meme-react-sus', title: 'Kinda Sus', category: 'Reaction', kind: 'visual', topText: 'THAT WAS', bottomText: 'KINDA SUS', accentHex: '#F43F5E', durationSec: 2.4 },

  // Real Playable Sound FX
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
    textAnimation: 'zoom-reveal',
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
    textAnimation: 'pop-bounce',
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
    textAnimation: 'slide-up',
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
  category: 'Meme Sounds' | 'Songs & Beats' | 'Meme VFX & Video' | 'Fonts';
  url: string;
  accentHex: string;
}

export const RESOURCE_WEBSITES: ResourceWebsiteItem[] = [
  // Instant Button Meme Sound Websites
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

  // Songs & Background Music Websites
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

  // Meme Videos, VFX & Green Screen Websites
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

  // Font Websites
  {
    id: 'site-google-fonts',
    name: 'Google Fonts',
    tagline: 'Clean modern, display & gaming fonts',
    category: 'Fonts',
    url: 'https://fonts.google.com/',
    accentHex: '#00CAE0',
  },
  {
    id: 'site-dafont',
    name: 'DaFont',
    tagline: 'Esports, brush, glitch & meme TTF fonts',
    category: 'Fonts',
    url: 'https://www.dafont.com/',
    accentHex: '#F59E0B',
  },
  {
    id: 'site-1001fonts',
    name: '1001 Fonts',
    tagline: 'Free custom TTF/OTF fonts for titles',
    category: 'Fonts',
    url: 'https://www.1001fonts.com/',
    accentHex: '#A78BFA',
  },
];

