import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

interface FontsourceEntry {
  id: string;
  family: string;
  category: string;
  subsets?: string[];
  weights?: number[];
}

let cachedFontsource: FontsourceEntry[] | null = null;
let cachedFontsourceAt = 0;

function isSafeExternalUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host.startsWith('169.254.')
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function toProxyUrl(targetUrl: string): string {
  return `/api/proxy?url=${encodeURIComponent(targetUrl)}`;
}

async function fetchTextWithTimeout(url: string, timeoutMs = 9500): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/json,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function extractJsonLdObjects(html: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object') results.push(item as Record<string, unknown>);
        }
      } else if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>;
        if (Array.isArray(obj.itemListElement)) {
          for (const el of obj.itemListElement) {
            if (el && typeof el === 'object') results.push(el as Record<string, unknown>);
          }
        }
        if (Array.isArray(obj['@graph'])) {
          for (const el of obj['@graph']) {
            if (el && typeof el === 'object') {
              const g = el as Record<string, unknown>;
              if (Array.isArray(g.itemListElement)) {
                for (const sub of g.itemListElement) {
                  if (sub && typeof sub === 'object') results.push(sub as Record<string, unknown>);
                }
              }
              results.push(g);
            }
          }
        }
        results.push(obj);
      }
    } catch {
      // ignore invalid JSON-LD block
    }
  }
  return results;
}

function parseIsoDurationSec(iso?: string): number {
  if (!iso || typeof iso !== 'string') return 12;
  const m = iso.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 12;
  const mins = parseInt(m[1] || '0', 10);
  const secs = parseInt(m[2] || '0', 10);
  return Math.max(1, mins * 60 + secs);
}

async function getFontsourceCatalog(): Promise<FontsourceEntry[]> {
  if (cachedFontsource && Date.now() - cachedFontsourceAt < 1000 * 60 * 60) {
    return cachedFontsource;
  }
  const raw = await fetchTextWithTimeout('https://api.fontsource.org/v1/fonts', 12000);
  const parsed = JSON.parse(raw) as FontsourceEntry[];
  cachedFontsource = parsed;
  cachedFontsourceAt = Date.now();
  return parsed;
}

async function searchMyInstants(query: string) {
  const q = query.trim();
  const target = q
    ? `https://www.myinstants.com/en/search/?name=${encodeURIComponent(q)}`
    : 'https://www.myinstants.com/en/index/in/';
  const html = await fetchTextWithTimeout(target);

  const items: {
    id: string;
    title: string;
    source: string;
    kind: 'sfx' | 'music';
    durationSec: number;
    remoteUrl: string;
    previewUrl: string;
  }[] = [];
  const seen = new Set<string>();

  const cardRegex =
    /onclick="play\('([^']+\.mp3)'[^"]*\)"[^>]*>[\s\S]{0,600}?class="instant-link[^"]*"[^>]*>([^<]+)</gi;
  let m: RegExpExecArray | null;
  while ((m = cardRegex.exec(html)) !== null && items.length < 36) {
    const soundPath = m[1];
    const title = decodeHtmlEntities(m[2]);
    const remoteUrl = soundPath.startsWith('http')
      ? soundPath
      : `https://www.myinstants.com${soundPath.startsWith('/') ? '' : '/'}${soundPath}`;
    if (!seen.has(remoteUrl) && title) {
      seen.add(remoteUrl);
      items.push({
        id: `mi-${seen.size}-${Buffer.from(remoteUrl).toString('base64').slice(0, 8)}`,
        title,
        source: 'MyInstants',
        kind: 'sfx',
        durationSec: 3.0,
        remoteUrl,
        previewUrl: toProxyUrl(remoteUrl),
      });
    }
  }

  // Fallback regex if markup differs slightly
  if (items.length === 0) {
    const mp3Matches = html.match(/\/media\/sounds\/[^"'\s)]+\.mp3/g) ?? [];
    for (const rel of mp3Matches) {
      const remoteUrl = `https://www.myinstants.com${rel}`;
      if (seen.has(remoteUrl)) continue;
      seen.add(remoteUrl);
      const slug = rel.split('/').pop()?.replace(/\.mp3$/i, '') || 'Meme Sound';
      const title = slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      items.push({
        id: `mi-fb-${seen.size}`,
        title,
        source: 'MyInstants',
        kind: 'sfx',
        durationSec: 3.0,
        remoteUrl,
        previewUrl: toProxyUrl(remoteUrl),
      });
      if (items.length >= 24) break;
    }
  }

  return items;
}

async function searchMixkitSfx(query: string) {
  const q = query.trim();
  const target = q
    ? `https://mixkit.co/free-sound-effects/search/?q=${encodeURIComponent(q)}`
    : 'https://mixkit.co/free-sound-effects/transition/';
  const html = await fetchTextWithTimeout(target);

  const items: {
    id: string;
    title: string;
    source: string;
    kind: 'sfx' | 'music';
    durationSec: number;
    remoteUrl: string;
    previewUrl: string;
  }[] = [];
  const seen = new Set<string>();

  const blocks = extractJsonLdObjects(html);
  for (const obj of blocks) {
    const url = typeof obj.contentUrl === 'string' ? obj.contentUrl : typeof obj.url === 'string' ? obj.url : '';
    if (url && url.includes('assets.mixkit.co') && url.endsWith('.mp3') && !seen.has(url)) {
      seen.add(url);
      const title = decodeHtmlEntities(String(obj.name || 'Mixkit SFX'));
      items.push({
        id: `mksfx-${seen.size}`,
        title,
        source: 'Mixkit SFX',
        kind: 'sfx',
        durationSec: 3.0,
        remoteUrl: url,
        previewUrl: toProxyUrl(url),
      });
    }
  }

  if (items.length === 0) {
    const urls = html.match(/https:\/\/assets\.mixkit\.co\/active_storage\/sfx\/[^"'\s>]+\.mp3/g) ?? [];
    for (const url of urls) {
      if (seen.has(url)) continue;
      seen.add(url);
      const idPart = url.match(/sfx\/(\d+)/)?.[1] || String(seen.size);
      items.push({
        id: `mksfx-${idPart}`,
        title: `Mixkit SFX #${idPart}`,
        source: 'Mixkit SFX',
        kind: 'sfx',
        durationSec: 2.5,
        remoteUrl: url,
        previewUrl: toProxyUrl(url),
      });
      if (items.length >= 24) break;
    }
  }

  return items.slice(0, 24);
}

async function searchMixkitMusic(query: string) {
  const q = query.trim().toLowerCase();
  const genreMap: Record<string, string> = {
    phonk: 'hip-hop',
    hiphop: 'hip-hop',
    'hip-hop': 'hip-hop',
    rap: 'hip-hop',
    trap: 'hip-hop',
    edm: 'electronic',
    gaming: 'electronic',
    cyber: 'electronic',
    cinematic: 'cinematic',
    epic: 'cinematic',
    chill: 'chill',
    lofi: 'chill',
    vlog: 'pop',
    pop: 'pop',
    rock: 'rock',
  };
  let genre = 'hip-hop';
  for (const [k, v] of Object.entries(genreMap)) {
    if (q.includes(k)) {
      genre = v;
      break;
    }
  }
  const target = `https://mixkit.co/free-stock-music/${genre}/`;
  const html = await fetchTextWithTimeout(target);

  const items: {
    id: string;
    title: string;
    artist?: string;
    source: string;
    kind: 'sfx' | 'music';
    durationSec: number;
    remoteUrl: string;
    previewUrl: string;
  }[] = [];
  const seen = new Set<string>();

  const blocks = extractJsonLdObjects(html);
  for (const obj of blocks) {
    const url = typeof obj.url === 'string' ? obj.url : '';
    if (url && url.includes('assets.mixkit.co/music/') && url.endsWith('.mp3') && !seen.has(url)) {
      const title = decodeHtmlEntities(String(obj.name || 'Beat Track'));
      const artist = typeof obj.byArtist === 'string' ? decodeHtmlEntities(obj.byArtist) : undefined;
      if (
        q &&
        !genreMap[q] &&
        !title.toLowerCase().includes(q) &&
        !(artist || '').toLowerCase().includes(q) &&
        genre === 'hip-hop'
      ) {
        // still allow tracks if query matched genre or generic search
      }
      seen.add(url);
      items.push({
        id: `mkmus-${seen.size}`,
        title: artist ? `${title} · ${artist}` : title,
        artist,
        source: 'Mixkit Music',
        kind: 'music',
        durationSec: parseIsoDurationSec(typeof obj.duration === 'string' ? obj.duration : undefined),
        remoteUrl: url,
        previewUrl: toProxyUrl(url),
      });
    }
  }
  return items.slice(0, 24);
}

async function searchMixkitVfx(query: string) {
  const q = query.trim().toLowerCase();
  const categorySlugs: Record<string, string> = {
    glitch: 'glitch',
    explosion: 'explosion',
    fire: 'fire',
    neon: 'neon',
    smoke: 'smoke',
    particles: 'particles',
    transition: 'transition',
    light: 'light',
    laser: 'laser',
    rain: 'rain',
    abstract: 'abstract',
    cyberpunk: 'cyberpunk',
    background: 'background',
    cinematic: 'background',
    gaming: 'neon',
    sparks: 'particles',
  };
  let target = 'https://mixkit.co/free-stock-video/glitch/';
  if (q) {
    const matchedSlug = Object.keys(categorySlugs).find((k) => q.includes(k));
    target = matchedSlug
      ? `https://mixkit.co/free-stock-video/${categorySlugs[matchedSlug]}/`
      : `https://mixkit.co/free-stock-video/search/?q=${encodeURIComponent(q)}`;
  }
  const html = await fetchTextWithTimeout(target);

  const items: {
    id: string;
    title: string;
    source: string;
    thumbUrl: string;
    remoteThumbUrl: string;
    videoUrl: string;
    remoteVideoUrl: string;
  }[] = [];
  const seen = new Set<string>();

  const blocks = extractJsonLdObjects(html);
  for (const obj of blocks) {
    const rawVideo =
      (typeof obj.embedUrl === 'string' && obj.embedUrl) ||
      (typeof obj.contentUrl === 'string' && obj.contentUrl) ||
      '';
    const rawThumb = typeof obj.thumbnailUrl === 'string' ? obj.thumbnailUrl : '';
    if (!rawVideo || !rawVideo.endsWith('.mp4') || seen.has(rawVideo)) continue;
    seen.add(rawVideo);
    const title = decodeHtmlEntities(String(obj.name || 'VFX Video Clip'));
    items.push({
      id: `mkvfx-${seen.size}`,
      title,
      source: 'Mixkit VFX',
      remoteThumbUrl: rawThumb,
      thumbUrl: rawThumb ? toProxyUrl(rawThumb) : '',
      remoteVideoUrl: rawVideo,
      videoUrl: toProxyUrl(rawVideo),
    });
  }

  if (items.length === 0) {
    const mp4s = html.match(/https:\/\/assets\.mixkit\.co\/videos\/\d+\/\d+-360\.mp4/g) ?? [];
    for (const vid of mp4s) {
      if (seen.has(vid)) continue;
      seen.add(vid);
      const id = vid.match(/videos\/(\d+)/)?.[1] || String(seen.size);
      const thumb = `https://assets.mixkit.co/videos/${id}/${id}-thumb-360-0.jpg`;
      items.push({
        id: `mkvfx-${id}`,
        title: `VFX Clip #${id}`,
        source: 'Mixkit VFX',
        remoteThumbUrl: thumb,
        thumbUrl: toProxyUrl(thumb),
        remoteVideoUrl: vid,
        videoUrl: toProxyUrl(vid),
      });
      if (items.length >= 24) break;
    }
  }

  return items.slice(0, 28);
}

async function searchDaFont(query: string) {
  const q = query.trim();
  const target = q
    ? `https://www.dafont.com/search.php?q=${encodeURIComponent(q)}`
    : 'https://www.dafont.com/top.php';
  const html = await fetchTextWithTimeout(target);

  const items: {
    id: string;
    name: string;
    category: string;
    source: 'dafont';
    zipUrl: string;
    remoteZipUrl: string;
  }[] = [];
  const seen = new Set<string>();

  const cardRegex =
    /class="lv1left dfbg"[^>]*>([\s\S]{1,350}?)<\/div>[\s\S]{0,1400}?href="(?:https?:)?(\/\/dl\.dafont\.com\/dl\/\?f=[^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = cardRegex.exec(html)) !== null && items.length < 24) {
    const rawHeader = m[1].split(/\s+by\s+/i)[0] || m[1];
    const name = decodeHtmlEntities(rawHeader.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
    const dlPath = m[2];
    const remoteZipUrl = `https:${dlPath}`;
    if (!seen.has(remoteZipUrl) && name) {
      seen.add(remoteZipUrl);
      items.push({
        id: `df-${seen.size}`,
        name,
        category: 'DaFont .ZIP',
        source: 'dafont',
        remoteZipUrl,
        zipUrl: toProxyUrl(remoteZipUrl),
      });
    }
  }

  return items;
}

interface OnlineTemplateItem {
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
let cachedOnlineTemplatesAt = 0;

async function buildOnlineTemplates(): Promise<OnlineTemplateItem[]> {
  if (cachedOnlineTemplates && Date.now() - cachedOnlineTemplatesAt < 1000 * 60 * 30) {
    return cachedOnlineTemplates;
  }

  const [cyberVids, fireVids, particleVids, glitchVids, hiphopTracks, edmTracks, cinemaTracks] =
    await Promise.all([
      searchMixkitVfx('cyberpunk').catch(() => []),
      searchMixkitVfx('fire').catch(() => []),
      searchMixkitVfx('particles').catch(() => []),
      searchMixkitVfx('glitch').catch(() => []),
      searchMixkitMusic('hip-hop').catch(() => []),
      searchMixkitMusic('electronic').catch(() => []),
      searchMixkitMusic('cinematic').catch(() => []),
    ]);

  const specs = [
    {
      id: 'tpl-phonk-drift',
      title: 'Phonk Beat Edit',
      tag: 'VIRAL REEL',
      desc: 'HD Cyber clip + Phonk beat + Shake + RGB Split',
      accentHex: '#00CAE0',
      aspectRatio: '9:16' as const,
      effectType: 'rgb-split-pro',
      transitionType: 'CrossZoom',
      headline: 'NO BRAKES',
      fontFamily: 'Anton',
      textColor: '#FFE600',
      vid: cyberVids[0] || glitchVids[0],
      aud: hiphopTracks[0],
      durationSec: 6.5,
    },
    {
      id: 'tpl-anime-velocity',
      title: 'Anime Velocity Cut',
      tag: 'VELOCITY',
      desc: 'Speedlines shader + Ramp curve + Hyper track',
      accentHex: '#F472B6',
      aspectRatio: '9:16' as const,
      effectType: 'anime-speedlines',
      transitionType: 'DirectionalWarp',
      headline: 'MAXIMUM POWER',
      fontFamily: 'Bangers',
      textColor: '#FFFFFF',
      vid: glitchVids[0] || cyberVids[1],
      aud: edmTracks[0] || hiphopTracks[1],
      durationSec: 6.0,
    },
    {
      id: 'tpl-fire-trailer',
      title: 'Action Fire Opener',
      tag: 'CINEMATIC',
      desc: 'Ember sparks footage + Kodak Halation + Epic score',
      accentHex: '#F97316',
      aspectRatio: '16:9' as const,
      effectType: 'film-burn-halation',
      transitionType: 'BurnThrough',
      headline: 'RISE AGAIN',
      fontFamily: 'Bebas Neue',
      textColor: '#FF9E2C',
      vid: fireVids[0] || particleVids[0],
      aud: cinemaTracks[0],
      durationSec: 7.0,
    },
    {
      id: 'tpl-dreamy-aesthetic',
      title: 'Aesthetic Gold Vlog',
      tag: 'TRENDING',
      desc: 'Particles overlay + Light Leak Flare + Lo-Fi groove',
      accentHex: '#FBBF24',
      aspectRatio: '9:16' as const,
      effectType: 'light-leak-flare',
      transitionType: 'DreamyZoom',
      headline: 'GOLDEN HOURS',
      fontFamily: 'Syne',
      textColor: '#FFF3C4',
      vid: particleVids[0] || fireVids[1],
      aud: cinemaTracks[1] || hiphopTracks[2],
      durationSec: 7.5,
    },
    {
      id: 'tpl-cyber-hud',
      title: 'Cyber HUD Montage',
      tag: 'GAMING',
      desc: 'Target HUD Scanner + Glitch FX + Bass EDM',
      accentHex: '#34D399',
      aspectRatio: '16:9' as const,
      effectType: 'cyber-hud-scan',
      transitionType: 'GlitchMemories',
      headline: 'SYSTEM LOCKED',
      fontFamily: 'Orbitron',
      textColor: '#00CAE0',
      vid: cyberVids[1] || glitchVids[1],
      aud: edmTracks[1] || edmTracks[0],
      durationSec: 6.5,
    },
    {
      id: 'tpl-vhs-90s',
      title: '90s VHS Camcorder',
      tag: 'RETRO',
      desc: 'Analog camcorder bleed + Vintage grain + Chill beat',
      accentHex: '#A78BFA',
      aspectRatio: '1:1' as const,
      effectType: 'vhs-camcorder',
      transitionType: 'FilmBurn',
      headline: 'REC 1998',
      fontFamily: 'Rubik Glitch',
      textColor: '#FFFFFF',
      vid: glitchVids[2] || cyberVids[2],
      aud: hiphopTracks[3] || cinemaTracks[0],
      durationSec: 6.0,
    },
  ];

  const built: OnlineTemplateItem[] = specs
    .filter((s) => Boolean(s.vid))
    .map((s) => ({
      id: s.id,
      title: s.title,
      tag: s.tag,
      desc: s.desc,
      accentHex: s.accentHex,
      aspectRatio: s.aspectRatio,
      effectType: s.effectType,
      transitionType: s.transitionType,
      headline: s.headline,
      fontFamily: s.fontFamily,
      textColor: s.textColor,
      videoUrl: s.vid.videoUrl,
      remoteVideoUrl: s.vid.remoteVideoUrl,
      thumbUrl: s.vid.thumbUrl,
      audioUrl: s.aud?.previewUrl,
      remoteAudioUrl: s.aud?.remoteUrl,
      audioTitle: s.aud?.title,
      durationSec: s.durationSec,
    }));

  if (built.length > 0) {
    cachedOnlineTemplates = built;
    cachedOnlineTemplatesAt = Date.now();
  }
  return built;
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT || 3000);

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'tg7-editor-studio' });
  });

  // 1. Safe Binary Media / Font Proxy (eliminates Chrome redirects & Canvas CORS taint)
  app.get('/api/proxy', async (req: Request, res: Response) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    const safeUrl = isSafeExternalUrl(rawUrl);
    if (!safeUrl) {
      res.status(400).json({ error: 'Invalid or blocked URL' });
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const upstream = await fetch(safeUrl.toString(), {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': USER_AGENT,
          Referer: `${safeUrl.origin}/`,
        },
      });
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: `Upstream HTTP ${upstream.status}` });
        return;
      }

      const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
      const contentLen = upstream.headers.get('content-length');
      res.setHeader('Content-Type', contentType);
      if (contentLen) res.setHeader('Content-Length', contentLen);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cache-Control', 'public, max-age=86400');

      const arrayBuf = await upstream.arrayBuffer();
      res.send(Buffer.from(arrayBuf));
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Proxy fetch failed',
      });
    } finally {
      clearTimeout(timer);
    }
  });

  // 2. Live Sound FX & Music Search (MyInstants + Mixkit SFX + Mixkit Music)
  app.get('/api/sounds/search', async (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const source = typeof req.query.source === 'string' ? req.query.source : 'all';

    try {
      const tasks: Promise<unknown[]>[] = [];
      if (source === 'all' || source === 'myinstants') tasks.push(searchMyInstants(q).catch(() => []));
      if (source === 'all' || source === 'mixkit-sfx') tasks.push(searchMixkitSfx(q).catch(() => []));
      if (source === 'all' || source === 'mixkit-music')
        tasks.push(searchMixkitMusic(q).catch(() => []));

      const batches = await Promise.all(tasks);
      const items = batches.flat();
      res.json({ items });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Sound search failed' });
    }
  });

  // 3. Live VFX Videos & Memes Search (Mixkit Video + Imgflip)
  app.get('/api/vfx/search', async (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    try {
      const videos = await searchMixkitVfx(q);
      res.json({ items: videos });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'VFX search failed' });
    }
  });

  app.get('/api/memes/trending', async (_req: Request, res: Response) => {
    try {
      const raw = await fetchTextWithTimeout('https://api.imgflip.com/get_memes', 9000);
      const json = JSON.parse(raw) as {
        data?: { memes?: { id: string; name: string; url: string; width: number; height: number }[] };
      };
      const memes = (json.data?.memes ?? []).map((m) => ({
        ...m,
        remoteUrl: m.url,
        url: toProxyUrl(m.url),
      }));
      res.json({ memes });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Meme fetch failed' });
    }
  });

  // 4. Live Fonts Search (2,100+ Google Fonts via Fontsource + DaFont .ZIP Packs)
  app.get('/api/fonts/search', async (req: Request, res: Response) => {
    const q = (typeof req.query.q === 'string' ? req.query.q : '').trim();
    const source = typeof req.query.source === 'string' ? req.query.source : 'all';

    try {
      const [googleList, dafontList] = await Promise.all([
        source === 'dafont'
          ? Promise.resolve([])
          : getFontsourceCatalog()
              .then((all) => {
                const lower = q.toLowerCase();
                const matched = lower
                  ? all.filter(
                      (f) =>
                        f.family.toLowerCase().includes(lower) ||
                        f.category.toLowerCase().includes(lower)
                    )
                  : all;
                return matched.slice(0, 48).map((f) => ({
                  id: `fs-${f.id}`,
                  name: f.family,
                  category: f.category,
                  source: 'google' as const,
                  googleFamily: f.family.replace(/\s+/g, '+'),
                }));
              })
              .catch(() => []),
        source === 'google' ? Promise.resolve([]) : searchDaFont(q).catch(() => []),
      ]);

      res.json({ googleFonts: googleList, dafontFonts: dafontList });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Font search failed' });
    }
  });

  // 5. Live Online Creator Templates & Viral Preset Packs
  app.get('/api/templates/online', async (_req: Request, res: Response) => {
    try {
      const templates = await buildOnlineTemplates();
      res.json({ templates });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Online templates fetch failed',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`TG7 Studio server listening on http://0.0.0.0:${port}`);
  });
}

void startServer();
