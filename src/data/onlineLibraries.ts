// Live In-App Online Libraries (MyInstants, Mixkit SFX & Music, Mixkit VFX, Imgflip, Fontsource & DaFont)
// Fetches bytes directly inside the app via Express /api/* proxy OR Android native TG7Android bridge (zero Chrome jumps).

import { saveCustomFontBlobToDraftDb } from '../engine/draftStorage';

export interface OnlineMemeTemplate {
  id: string;
  name: string;
  url: string;
  remoteUrl?: string;
  width: number;
  height: number;
}

export interface OnlineSoundItem {
  id: string;
  title: string;
  artist?: string;
  source: string;
  kind: 'sfx' | 'music';
  durationSec: number;
  remoteUrl: string;
  previewUrl: string;
}

export interface OnlineVfxItem {
  id: string;
  title: string;
  source: string;
  thumbUrl: string;
  remoteThumbUrl: string;
  videoUrl: string;
  remoteVideoUrl: string;
}

export interface OnlineGoogleFontItem {
  id: string;
  name: string;
  category: string;
  source: 'google';
  googleFamily: string;
}

export interface OnlineDaFontItem {
  id: string;
  name: string;
  category: string;
  source: 'dafont';
  zipUrl: string;
  remoteZipUrl: string;
}

export interface IconifySearchResult {
  id: string;
  title: string;
  previewUrl: string;
}

interface TG7AndroidWindow extends Window {
  TG7Android?: {
    saveVideo?: (b64: string, name: string) => boolean;
    saveVideoWithMime?: (b64: string, name: string, mime?: string) => boolean;
    shareVideo?: (b64: string, name: string, mime?: string) => boolean;
    fetchText?: (url: string) => string;
    fetchBase64?: (url: string) => string;
  };
}

function getAndroidBridge() {
  return (window as unknown as TG7AndroidWindow).TG7Android;
}

function isServerApiAvailable(): boolean {
  return typeof window !== 'undefined' && window.location.protocol.startsWith('http') && window.location.host !== 'appassets.androidplatform.net';
}

function decodeHtml(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function guessMimeFromUrl(url: string, fallback = 'application/octet-stream'): string {
  const lower = url.toLowerCase();
  if (lower.includes('.mp3')) return 'audio/mpeg';
  if (lower.includes('.wav')) return 'audio/wav';
  if (lower.includes('.ogg')) return 'audio/ogg';
  if (lower.includes('.m4a')) return 'audio/mp4';
  if (lower.includes('.mp4')) return 'video/mp4';
  if (lower.includes('.webm')) return 'video/webm';
  if (lower.includes('.gif')) return 'image/gif';
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  if (lower.includes('.svg')) return 'image/svg+xml';
  if (lower.includes('.jpg') || lower.includes('.jpeg')) return 'image/jpeg';
  if (lower.includes('.zip') || lower.includes('dafont.com/dl')) return 'application/zip';
  return fallback;
}

export async function fetchRemoteFileAsBlob(
  remoteUrl: string,
  proxyOrDirectUrl?: string,
  fallbackMime?: string
): Promise<Blob> {
  const android = getAndroidBridge();

  if (isServerApiAvailable()) {
    const fetchUrl =
      proxyOrDirectUrl && proxyOrDirectUrl.startsWith('/api/')
        ? proxyOrDirectUrl
        : `/api/proxy?url=${encodeURIComponent(remoteUrl)}`;
    const res = await fetch(fetchUrl);
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const rawBlob = await res.blob();
    const mime =
      rawBlob.type && rawBlob.type !== 'application/octet-stream'
        ? rawBlob.type
        : guessMimeFromUrl(remoteUrl, fallbackMime);
    return new Blob([rawBlob], { type: mime });
  }

  if (android?.fetchBase64) {
    const b64 = android.fetchBase64(remoteUrl);
    if (b64 && b64.length > 0) {
      const bytes = base64ToUint8Array(b64);
      const ab = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(ab).set(bytes);
      return new Blob([ab], { type: guessMimeFromUrl(remoteUrl, fallbackMime) });
    }
  }

  const res = await fetch(remoteUrl);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  return await res.blob();
}

export async function fetchRemoteFileAsFile(
  remoteUrl: string,
  fileName: string,
  proxyOrDirectUrl?: string,
  fallbackMime?: string
): Promise<File> {
  const blob = await fetchRemoteFileAsBlob(remoteUrl, proxyOrDirectUrl, fallbackMime);
  const safeName = fileName.replace(/[^\w.\-\s()]/g, '_').trim() || 'tg7-asset';
  return new File([blob], safeName, {
    type: blob.type || guessMimeFromUrl(remoteUrl, fallbackMime),
  });
}

let cachedImgflipMemes: OnlineMemeTemplate[] | null = null;
let cachedFontsource: { id: string; family: string; category: string }[] | null = null;
const iconifySearchCache = new Map<string, IconifySearchResult[]>();
const iconifyMarkupCache = new Map<string, string>();

export async function fetchOnlineImgflipMemes(): Promise<OnlineMemeTemplate[]> {
  if (cachedImgflipMemes && cachedImgflipMemes.length > 0) {
    return cachedImgflipMemes;
  }
  if (isServerApiAvailable()) {
    const res = await fetch('/api/memes/trending');
    if (res.ok) {
      const json = (await res.json()) as { memes?: OnlineMemeTemplate[] };
      if (json.memes && json.memes.length > 0) {
        cachedImgflipMemes = json.memes;
        return json.memes;
      }
    }
  }
  const res = await fetch('https://api.imgflip.com/get_memes');
  if (!res.ok) throw new Error('Could not reach Imgflip meme API.');
  const json = (await res.json()) as {
    data?: { memes?: OnlineMemeTemplate[] };
  };
  const memes = (json?.data?.memes ?? []).map((m) => ({
    ...m,
    remoteUrl: m.url,
    url: isServerApiAvailable() ? `/api/proxy?url=${encodeURIComponent(m.url)}` : m.url,
  }));
  cachedImgflipMemes = memes;
  return memes;
}

export async function searchOnlineSounds(
  query: string,
  source: 'all' | 'myinstants' | 'mixkit-sfx' | 'mixkit-music' = 'all'
): Promise<OnlineSoundItem[]> {
  if (isServerApiAvailable()) {
    const res = await fetch(
      `/api/sounds/search?q=${encodeURIComponent(query)}&source=${encodeURIComponent(source)}`
    );
    if (!res.ok) throw new Error('Sound search failed.');
    const json = (await res.json()) as { items?: OnlineSoundItem[] };
    return json.items ?? [];
  }

  const android = getAndroidBridge();
  if (!android?.fetchText) {
    throw new Error('Online sound proxy unavailable.');
  }
  const q = query.trim();
  const items: OnlineSoundItem[] = [];
  if (source === 'all' || source === 'myinstants') {
    const url = q
      ? `https://www.myinstants.com/en/search/?name=${encodeURIComponent(q)}`
      : 'https://www.myinstants.com/en/index/in/';
    const html = android.fetchText(url);
    const rx =
      /onclick="play\('([^']+\.mp3)'[^"]*\)"[^>]*>[\s\S]{0,600}?class="instant-link[^"]*"[^>]*>([^<]+)</gi;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(html)) !== null && items.length < 30) {
      const soundPath = m[1];
      const remoteUrl = soundPath.startsWith('http')
        ? soundPath
        : `https://www.myinstants.com${soundPath.startsWith('/') ? '' : '/'}${soundPath}`;
      items.push({
        id: `mi-apk-${items.length}`,
        title: decodeHtml(m[2]),
        source: 'MyInstants',
        kind: 'sfx',
        durationSec: 3,
        remoteUrl,
        previewUrl: remoteUrl,
      });
    }
  }
  return items;
}

export async function searchOnlineVfx(query: string): Promise<OnlineVfxItem[]> {
  if (isServerApiAvailable()) {
    const res = await fetch(`/api/vfx/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('VFX search failed.');
    const json = (await res.json()) as { items?: OnlineVfxItem[] };
    return json.items ?? [];
  }

  const android = getAndroidBridge();
  if (!android?.fetchText) return [];
  const q = query.trim();
  const url = q
    ? `https://mixkit.co/free-stock-video/search/?q=${encodeURIComponent(q)}`
    : 'https://mixkit.co/free-stock-video/glitch/';
  const html = android.fetchText(url);
  const mp4s = html.match(/https:\/\/assets\.mixkit\.co\/videos\/\d+\/\d+-360\.mp4/g) ?? [];
  const seen = new Set<string>();
  const list: OnlineVfxItem[] = [];
  for (const vid of mp4s) {
    if (seen.has(vid)) continue;
    seen.add(vid);
    const id = vid.match(/videos\/(\d+)/)?.[1] || String(list.length);
    const thumb = `https://assets.mixkit.co/videos/${id}/${id}-thumb-360-0.jpg`;
    list.push({
      id: `mkvfx-apk-${id}`,
      title: `VFX Clip #${id}`,
      source: 'Mixkit VFX',
      thumbUrl: thumb,
      remoteThumbUrl: thumb,
      videoUrl: vid,
      remoteVideoUrl: vid,
    });
    if (list.length >= 24) break;
  }
  return list;
}

export async function searchOnlineFonts(
  query: string,
  source: 'all' | 'google' | 'dafont' = 'all'
): Promise<{
  googleFonts: OnlineGoogleFontItem[];
  dafontFonts: OnlineDaFontItem[];
}> {
  if (isServerApiAvailable()) {
    const res = await fetch(
      `/api/fonts/search?q=${encodeURIComponent(query)}&source=${encodeURIComponent(source)}`
    );
    if (!res.ok) throw new Error('Font search failed.');
    return (await res.json()) as {
      googleFonts: OnlineGoogleFontItem[];
      dafontFonts: OnlineDaFontItem[];
    };
  }

  // Fallback direct Fontsource + Android DaFont bridge
  let googleFonts: OnlineGoogleFontItem[] = [];
  if (source !== 'dafont') {
    if (!cachedFontsource) {
      const r = await fetch('https://api.fontsource.org/v1/fonts');
      if (r.ok) {
        cachedFontsource = (await r.json()) as { id: string; family: string; category: string }[];
      }
    }
    const lower = query.trim().toLowerCase();
    googleFonts = (cachedFontsource ?? [])
      .filter(
        (f) => !lower || f.family.toLowerCase().includes(lower) || f.category.toLowerCase().includes(lower)
      )
      .slice(0, 48)
      .map((f) => ({
        id: `fs-${f.id}`,
        name: f.family,
        category: f.category,
        source: 'google' as const,
        googleFamily: f.family.replace(/\s+/g, '+'),
      }));
  }

  const dafontFonts: OnlineDaFontItem[] = [];
  const android = getAndroidBridge();
  if (source !== 'google' && android?.fetchText) {
    const target = query.trim()
      ? `https://www.dafont.com/search.php?q=${encodeURIComponent(query.trim())}`
      : 'https://www.dafont.com/top.php';
    const html = android.fetchText(target);
    const rx =
      /class="lv1left dfbg"[^>]*>([\s\S]{1,350}?)<\/div>[\s\S]{0,1400}?href="(?:https?:)?(\/\/dl\.dafont\.com\/dl\/\?f=[^"]+)"/gi;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(html)) !== null && dafontFonts.length < 20) {
      const remoteZipUrl = `https:${m[2]}`;
      const rawHeader = m[1].split(/\s+by\s+/i)[0] || m[1];
      const name = decodeHtml(rawHeader.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
      if (!name) continue;
      dafontFonts.push({
        id: `df-apk-${dafontFonts.length}`,
        name,
        category: 'DaFont .ZIP',
        source: 'dafont',
        remoteZipUrl,
        zipUrl: remoteZipUrl,
      });
    }
  }

  return { googleFonts, dafontFonts };
}

export async function installDaFontZipInApp(item: OnlineDaFontItem): Promise<string> {
  const zipFile = await fetchRemoteFileAsFile(
    item.remoteZipUrl,
    `${item.name.replace(/\s+/g, '_')}.zip`,
    item.zipUrl,
    'application/zip'
  );
  const { extractFontFromZip } = await import('../engine/zipFontExtractor');
  const extracted = await extractFontFromZip(zipFile);
  const displayName = item.name || extracted.name;
  const fontFace = new FontFace(displayName, extracted.buffer.slice(0));
  const loaded = await fontFace.load();
  document.fonts.add(loaded);
  void saveCustomFontBlobToDraftDb(displayName, extracted.buffer.slice(0));
  return displayName;
}

export function getIconifySvgUrl(iconId: string, colorHex?: string): string {
  const [prefix, name] = iconId.split(':');
  if (!prefix || !name) return '';
  const base = `https://api.iconify.design/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg?height=128`;
  if (colorHex && !prefix.includes('emoji') && prefix !== 'noto') {
    return `${base}&color=${encodeURIComponent(colorHex)}`;
  }
  return base;
}

export async function searchOnlineIconifySvgs(query: string): Promise<IconifySearchResult[]> {
  const q = query.trim() || 'fire lightning crown arrow';
  if (iconifySearchCache.has(q)) {
    return iconifySearchCache.get(q)!;
  }
  const url = `https://api.iconify.design/search?query=${encodeURIComponent(q)}&limit=48`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not reach Iconify SVG API.');
  const json = (await res.json()) as { icons?: string[] };
  const icons = json.icons ?? [];
  const results: IconifySearchResult[] = icons.map((id) => {
    const rawName = (id.split(':')[1] || id).replace(/[-_]/g, ' ');
    const title = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    return {
      id,
      title,
      previewUrl: getIconifySvgUrl(id),
    };
  });
  iconifySearchCache.set(q, results);
  return results;
}

export async function fetchIconifySvgMarkup(iconId: string, colorHex?: string): Promise<string> {
  const key = `${iconId}::${colorHex ?? ''}`;
  if (iconifyMarkupCache.has(key)) {
    return iconifyMarkupCache.get(key)!;
  }
  const url = getIconifySvgUrl(iconId, colorHex);
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not download SVG from Iconify.');
  const markup = await res.text();
  iconifyMarkupCache.set(key, markup);
  return markup;
}

export interface OnlineTemplateItem {
  id: string;
  title: string;
  tag: string;
  desc: string;
  accentHex: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  effectType: string;
  transitionType: string;
  headline: string;
  fontFamily: string;
  textColor: string;
  videoUrl: string;
  remoteVideoUrl: string;
  thumbUrl: string;
  audioUrl?: string;
  remoteAudioUrl?: string;
  audioTitle?: string;
  durationSec: number;
}

let cachedOnlineTemplates: OnlineTemplateItem[] | null = null;

export async function fetchOnlineTemplates(): Promise<OnlineTemplateItem[]> {
  if (cachedOnlineTemplates && cachedOnlineTemplates.length > 0) {
    return cachedOnlineTemplates;
  }
  if (isServerApiAvailable()) {
    const res = await fetch('/api/templates/online');
    if (!res.ok) throw new Error('Failed to load online templates.');
    const json = (await res.json()) as { templates?: OnlineTemplateItem[] };
    const list = json.templates ?? [];
    if (list.length > 0) cachedOnlineTemplates = list;
    return list;
  }

  // Standalone APK offline-friendly fallback using Mixkit direct Android bridge
  const [cyber, fire, glitch, music] = await Promise.all([
    searchOnlineVfx('cyberpunk').catch(() => []),
    searchOnlineVfx('fire').catch(() => []),
    searchOnlineVfx('glitch').catch(() => []),
    searchOnlineSounds('phonk', 'all').catch(() => []),
  ]);

  const templates: OnlineTemplateItem[] = [
    cyber[0] && {
      id: 'tpl-phonk-drift',
      title: 'Phonk Beat Edit',
      tag: 'VIRAL REEL',
      desc: 'HD Cyber clip + Phonk beat + RGB Split Beat',
      accentHex: '#00CAE0',
      aspectRatio: '9:16',
      effectType: 'rgb-split-pro',
      transitionType: 'CrossZoom',
      headline: 'NO BRAKES',
      fontFamily: 'Anton',
      textColor: '#FFE600',
      videoUrl: cyber[0].videoUrl,
      remoteVideoUrl: cyber[0].remoteVideoUrl,
      thumbUrl: cyber[0].thumbUrl,
      audioUrl: music[0]?.previewUrl,
      remoteAudioUrl: music[0]?.remoteUrl,
      audioTitle: music[0]?.title,
      durationSec: 6.5,
    },
    glitch[0] && {
      id: 'tpl-anime-velocity',
      title: 'Anime Velocity Cut',
      tag: 'VELOCITY',
      desc: 'Speedlines shader + Ramp curve + Hyper track',
      accentHex: '#F472B6',
      aspectRatio: '9:16',
      effectType: 'anime-speedlines',
      transitionType: 'DirectionalWarp',
      headline: 'MAXIMUM POWER',
      fontFamily: 'Bangers',
      textColor: '#FFFFFF',
      videoUrl: glitch[0].videoUrl,
      remoteVideoUrl: glitch[0].remoteVideoUrl,
      thumbUrl: glitch[0].thumbUrl,
      audioUrl: music[1]?.previewUrl,
      remoteAudioUrl: music[1]?.remoteUrl,
      audioTitle: music[1]?.title,
      durationSec: 6.0,
    },
    fire[0] && {
      id: 'tpl-fire-trailer',
      title: 'Action Fire Opener',
      tag: 'CINEMATIC',
      desc: 'Ember sparks footage + Kodak Halation + Score',
      accentHex: '#F97316',
      aspectRatio: '16:9',
      effectType: 'film-burn-halation',
      transitionType: 'BurnThrough',
      headline: 'RISE AGAIN',
      fontFamily: 'Bebas Neue',
      textColor: '#FF9E2C',
      videoUrl: fire[0].videoUrl,
      remoteVideoUrl: fire[0].remoteVideoUrl,
      thumbUrl: fire[0].thumbUrl,
      audioUrl: music[2]?.previewUrl,
      remoteAudioUrl: music[2]?.remoteUrl,
      audioTitle: music[2]?.title,
      durationSec: 7.0,
    },
  ].filter(Boolean) as OnlineTemplateItem[];

  if (templates.length > 0) cachedOnlineTemplates = templates;
  return templates;
}
