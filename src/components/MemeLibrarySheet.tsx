import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Film,
  Image as ImageIcon,
  Link2,
  Loader2,
  Music,
  Pause,
  Play,
  Plus,
  Search,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import { MEME_LIBRARY, MemeLibraryItem } from '../data/assetsCatalog';
import {
  fetchOnlineImgflipMemes,
  OnlineMemeTemplate,
  OnlineSoundItem,
  OnlineVfxItem,
  searchOnlineSounds,
  searchOnlineVfx,
} from '../data/onlineLibraries';
import { playMemeSfx } from '../engine/sfxEngine';
import { SvgMemeIcon, SvgStickerIcon } from './StudioIcons';

interface MemeLibrarySheetProps {
  onAddMeme: (item: MemeLibraryItem) => void;
  onAddOnlineMemeImage: (title: string, imageUrl: string, remoteUrl?: string) => Promise<void> | void;
  onImportOnlineMedia: (
    remoteUrl: string,
    title: string,
    kind: 'audio' | 'video' | 'image',
    proxyUrl?: string,
    asOverlay?: boolean
  ) => Promise<void>;
  onImportFiles: (files: FileList, asOverlay?: boolean) => void;
  onImportDirectUrl: (url: string) => Promise<void> | void;
  onOpenSvgStickers: () => void;
  onClose: () => void;
}

const TABS = [
  { id: 'sounds', label: 'Sounds & Music' },
  { id: 'vfx', label: 'VFX Videos' },
  { id: 'memes', label: 'Meme Pics' },
  { id: 'url', label: 'Direct Link' },
] as const;

export function MemeLibrarySheet({
  onAddMeme,
  onAddOnlineMemeImage,
  onImportOnlineMedia,
  onImportFiles,
  onImportDirectUrl,
  onOpenSvgStickers,
  onClose,
}: MemeLibrarySheetProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('sounds');
  const [query, setQuery] = useState('');
  const [directUrl, setDirectUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [soundSource, setSoundSource] = useState<'all' | 'myinstants' | 'mixkit-sfx' | 'mixkit-music'>('all');
  const [onlineSounds, setOnlineSounds] = useState<OnlineSoundItem[]>([]);
  const [loadingSounds, setLoadingSounds] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const [vfxItems, setVfxItems] = useState<OnlineVfxItem[]>([]);
  const [loadingVfx, setLoadingVfx] = useState(false);

  const [onlineMemes, setOnlineMemes] = useState<OnlineMemeTemplate[]>([]);
  const [loadingMemes, setLoadingMemes] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      previewAudioRef.current?.pause();
      previewAudioRef.current = null;
    };
  }, []);

  // Load sounds when on Sounds tab
  useEffect(() => {
    if (tab !== 'sounds') return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoadingSounds(true);
      setFetchError(null);
      try {
        const list = await searchOnlineSounds(query, soundSource);
        if (!cancelled) setOnlineSounds(list);
      } catch {
        if (!cancelled) setFetchError('Could not reach sound servers. Check internet connection.');
      } finally {
        if (!cancelled) setLoadingSounds(false);
      }
    }, 260);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [tab, query, soundSource]);

  // Load VFX when on VFX tab
  useEffect(() => {
    if (tab !== 'vfx') return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoadingVfx(true);
      setFetchError(null);
      try {
        const list = await searchOnlineVfx(query);
        if (!cancelled) setVfxItems(list);
      } catch {
        if (!cancelled) setFetchError('Could not load online VFX videos.');
      } finally {
        if (!cancelled) setLoadingVfx(false);
      }
    }, 260);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [tab, query]);

  // Load Memes when on Memes tab
  useEffect(() => {
    if (tab !== 'memes' || onlineMemes.length > 0) return;
    let cancelled = false;
    setLoadingMemes(true);
    setFetchError(null);
    void fetchOnlineImgflipMemes()
      .then((list) => {
        if (!cancelled) setOnlineMemes(list);
      })
      .catch(() => {
        if (!cancelled) setFetchError('Could not load Imgflip memes.');
      })
      .finally(() => {
        if (!cancelled) setLoadingMemes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, onlineMemes.length]);

  const togglePreviewSound = (item: OnlineSoundItem) => {
    if (playingId === item.id) {
      previewAudioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    previewAudioRef.current?.pause();
    const audio = new Audio(item.previewUrl);
    previewAudioRef.current = audio;
    setPlayingId(item.id);
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
    void audio.play().catch(() => setPlayingId(null));
  };

  const handleApplySound = async (item: OnlineSoundItem) => {
    setBusyId(item.id);
    setFetchError(null);
    try {
      previewAudioRef.current?.pause();
      await onImportOnlineMedia(item.remoteUrl, item.title, 'audio', item.previewUrl, false);
      onClose();
    } catch {
      setFetchError(`Could not download "${item.title}" right now.`);
    } finally {
      setBusyId(null);
    }
  };

  const handleApplyVfx = async (item: OnlineVfxItem, asOverlay: boolean) => {
    setBusyId(item.id);
    setFetchError(null);
    try {
      await onImportOnlineMedia(
        item.remoteVideoUrl,
        item.title,
        'video',
        item.videoUrl,
        asOverlay
      );
      onClose();
    } catch {
      setFetchError(`Could not download "${item.title}".`);
    } finally {
      setBusyId(null);
    }
  };

  const handleApplyDirectUrl = async () => {
    const trimmed = directUrl.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setUrlError('Paste an http/https link to an .mp3, .mp4, .gif, .png, or .svg file.');
      return;
    }
    setUrlError(null);
    setBusyId('direct-url');
    try {
      await onImportDirectUrl(trimmed);
      setDirectUrl('');
      onClose();
    } catch {
      setUrlError('Could not fetch that link inside the app. Check the URL.');
    } finally {
      setBusyId(null);
    }
  };

  const q = query.trim().toLowerCase();
  const filteredBuiltinSfx = MEME_LIBRARY.filter(
    (s) => !q || s.title.toLowerCase().includes(q)
  );
  const filteredMemes = onlineMemes.filter(
    (m) => !q || m.name.toLowerCase().includes(q)
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 18 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      role="dialog"
      aria-modal="true"
      aria-label="In-App Sounds, VFX and Memes"
      className="fixed inset-0 z-50 bg-[#000000] text-[#F5F5F7] flex flex-col"
    >
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onImportFiles(e.target.files, false);
            e.target.value = '';
            onClose();
          }
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*,image/*,.svg"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onImportFiles(e.target.files, true);
            e.target.value = '';
            onClose();
          }
        }}
      />

      <header className="h-14 px-4 border-b border-[#1C1C22] flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close online library"
          className="w-10 h-10 rounded-full hover:bg-[#1C1C22] flex items-center justify-center cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <SvgMemeIcon className="w-5 h-5" />
          <h2 className="font-display text-sm font-semibold">
            In-App Sounds, VFX &amp; Memes
          </h2>
        </div>
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenSvgStickers();
          }}
          className="px-3 py-1.5 rounded-lg bg-[#16161C] hover:bg-[#22222C] border border-[#2C2C38] text-[11px] font-semibold text-[#38BDF8] flex items-center gap-1.5 cursor-pointer"
        >
          <SvgStickerIcon className="w-3.5 h-3.5" />
          <span>SVG</span>
        </button>
      </header>

      {/* Search & Local File Shortcuts */}
      <div className="p-3 border-b border-[#1C1C22] space-y-2.5 shrink-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-5xl mx-auto">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8E8E98] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                tab === 'sounds'
                  ? 'Search MyInstants, Phonk, Whoosh, Vine Boom, Bruh...'
                  : tab === 'vfx'
                    ? 'Search VFX clips (glitch, fire, explosion, neon, smoke)...'
                    : 'Search trending memes...'
              }
              className="w-full pl-9 pr-3 py-2 bg-[#141418] border border-[#24242C] focus:border-[#00CAE0] rounded-lg text-xs text-white outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto shrink-0">
            <button
              type="button"
              onClick={() => audioInputRef.current?.click()}
              className="px-3 py-2 rounded-lg bg-[#181820] hover:bg-[#22222C] border border-[#2E2E3A] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Music className="w-3.5 h-3.5 text-[#00CAE0]" />
              <span>Device Audio</span>
            </button>
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="px-3 py-2 rounded-lg bg-[#181820] hover:bg-[#22222C] border border-[#2E2E3A] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5 text-[#A78BFA]" />
              <span>Device Video</span>
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-5xl mx-auto pb-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                tab === t.id
                  ? 'bg-[#00CAE0] text-black'
                  : 'bg-[#141418] text-[#8E8E98] hover:text-white border border-[#22222A]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable In-App Feed */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-5">
        {fetchError && (
          <div className="max-w-5xl mx-auto p-3 rounded-xl bg-[#241216] border border-[#4A2029] text-xs text-[#F87171]">
            {fetchError}
          </div>
        )}

        {/* SOUNDS & MUSIC TAB (MyInstants + Mixkit SFX + Mixkit Music) */}
        {tab === 'sounds' && (
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {(
                [
                  { id: 'all', label: 'All Online' },
                  { id: 'myinstants', label: 'MyInstants Meme' },
                  { id: 'mixkit-sfx', label: 'Mixkit SFX' },
                  { id: 'mixkit-music', label: 'Mixkit Songs & Phonk' },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSoundSource(s.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap cursor-pointer ${
                    soundSource === s.id
                      ? 'bg-white text-black font-semibold'
                      : 'bg-[#141418] text-[#9A9AA8] border border-[#24242E]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {loadingSounds ? (
              <div className="py-10 flex items-center justify-center gap-2 text-xs text-[#8E8E98]">
                <Loader2 className="w-4 h-4 animate-spin text-[#00CAE0]" />
                <span>Searching MyInstants &amp; Mixkit audio...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {onlineSounds.map((item) => {
                  const isPlaying = playingId === item.id;
                  const isBusy = busyId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="bg-[#121216] border border-[#22222A] rounded-xl p-2.5 flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => togglePreviewSound(item)}
                        className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <span className="w-9 h-9 rounded-lg bg-[#0D1A1D] flex items-center justify-center shrink-0">
                          {isPlaying ? (
                            <Pause className="w-4 h-4 text-[#00CAE0]" />
                          ) : (
                            <Play className="w-4 h-4 text-[#00CAE0] ml-0.5" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white truncate">
                            {item.title}
                          </div>
                          <div className="text-[10px] font-mono text-[#7C7C88] truncate">
                            {item.source} · {item.durationSec.toFixed(0)}s
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleApplySound(item)}
                        className="px-2.5 h-8 rounded-lg bg-[#00CAE0] hover:brightness-110 disabled:opacity-60 text-black text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {isBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Apply</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Instant Offline Built-in Synth SFX */}
            {filteredBuiltinSfx.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[#1C1C22]">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8E8E98]">
                  Instant Offline Soundboard
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {filteredBuiltinSfx.map((item) => (
                    <div
                      key={item.id}
                      className="bg-[#121215] border border-[#22222A] rounded-xl p-2 flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => playMemeSfx(item.sfxId)}
                        className="flex items-center gap-2 min-w-0 text-left flex-1 cursor-pointer"
                      >
                        <Volume2 className="w-4 h-4 text-[#00CAE0] shrink-0" />
                        <span className="text-xs text-white truncate">{item.title}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playMemeSfx(item.sfxId);
                          onAddMeme(item);
                        }}
                        aria-label={`Apply ${item.title}`}
                        className="w-7 h-7 rounded-lg bg-[#00CAE0] text-black flex items-center justify-center shrink-0 cursor-pointer"
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VFX VIDEOS TAB (Mixkit Live Clips downloaded right into timeline) */}
        {tab === 'vfx' && (
          <div className="max-w-5xl mx-auto space-y-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {['glitch', 'explosion', 'fire', 'neon', 'smoke', 'particles', 'transition'].map(
                (tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setQuery(tag)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium capitalize cursor-pointer ${
                      query.toLowerCase() === tag
                        ? 'bg-white text-black font-semibold'
                        : 'bg-[#141418] text-[#9A9AA8] border border-[#24242E]'
                    }`}
                  >
                    {tag}
                  </button>
                )
              )}
            </div>

            {loadingVfx ? (
              <div className="py-10 flex items-center justify-center gap-2 text-xs text-[#8E8E98]">
                <Loader2 className="w-4 h-4 animate-spin text-[#00CAE0]" />
                <span>Searching Mixkit VFX clips...</span>
              </div>
            ) : vfxItems.length === 0 ? (
              <p className="text-xs text-[#8E8E98] py-8 text-center">
                Try searching &ldquo;glitch&rdquo;, &ldquo;fire&rdquo;, or &ldquo;explosion&rdquo;.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {vfxItems.map((item) => {
                  const isBusy = busyId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="bg-[#121216] border border-[#22222A] rounded-xl overflow-hidden flex flex-col justify-between"
                    >
                      <div className="h-28 bg-[#08080A] relative overflow-hidden">
                        {item.thumbUrl ? (
                          <img
                            src={item.thumbUrl}
                            alt={item.title}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film className="w-6 h-6 text-[#8E8E98]" />
                          </div>
                        )}
                      </div>
                      <div className="p-2.5 space-y-2">
                        <div className="text-[11px] font-medium text-[#F5F5F7] truncate">
                          {item.title}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleApplyVfx(item, true)}
                            className="flex-1 py-1.5 rounded-lg bg-[#00CAE0] hover:brightness-110 disabled:opacity-60 text-black text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                          >
                            {isBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <span>+ Overlay</span>
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleApplyVfx(item, false)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#1E1E26] hover:bg-[#282834] text-white text-[11px] font-semibold cursor-pointer"
                          >
                            Main
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* MEME PICTURES TAB */}
        {tab === 'memes' && (
          <div className="max-w-5xl mx-auto">
            {loadingMemes ? (
              <div className="py-10 flex items-center justify-center gap-2 text-xs text-[#8E8E98]">
                <Loader2 className="w-4 h-4 animate-spin text-[#00CAE0]" />
                <span>Loading trending meme pictures...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filteredMemes.slice(0, 60).map((meme) => {
                  const isBusy = busyId === meme.id;
                  return (
                    <div
                      key={meme.id}
                      className="bg-[#121216] border border-[#22222A] hover:border-[#00CAE0]/50 rounded-xl overflow-hidden flex flex-col justify-between"
                    >
                      <div className="h-28 bg-[#08080A] overflow-hidden relative">
                        {meme.url ? (
                          <img
                            src={meme.url}
                            alt={meme.name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-[#8E8E98]" />
                          </div>
                        )}
                      </div>
                      <div className="p-2 flex items-center justify-between gap-2">
                        <div className="text-[11px] font-medium text-[#F5F5F7] truncate">
                          {meme.name}
                        </div>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={async () => {
                            setBusyId(meme.id);
                            await onAddOnlineMemeImage(meme.name, meme.url, meme.remoteUrl);
                            setBusyId(null);
                            onClose();
                          }}
                          aria-label={`Apply ${meme.name}`}
                          className="w-7 h-7 rounded-lg bg-[#00CAE0] hover:brightness-110 text-black flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          {isBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4 stroke-[2.5]" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* DIRECT LINK FETCHER (No Chrome / No CORS) */}
        {tab === 'url' && (
          <div className="max-w-xl mx-auto p-4 rounded-2xl bg-[#121216] border border-[#24242E] space-y-3">
            <h3 className="text-sm font-semibold text-white">
              Fetch Any Direct Media Link Into Timeline
            </h3>
            <p className="text-xs text-[#8E8E98]">
              Paste an .mp3, .wav, .mp4, .gif, .png, or .svg link — TG7 downloads it straight into your project locally.
            </p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Link2 className="w-3.5 h-3.5 text-[#00CAE0] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  value={directUrl}
                  onChange={(e) => setDirectUrl(e.target.value)}
                  placeholder="https://.../sound.mp3 or video.mp4"
                  className="w-full pl-8 pr-3 py-2 bg-[#0A0A0D] border border-[#2C2C38] focus:border-[#00CAE0] rounded-lg text-xs text-white outline-none"
                />
              </div>
              <button
                type="button"
                disabled={busyId === 'direct-url'}
                onClick={() => void handleApplyDirectUrl()}
                className="px-4 py-2 rounded-lg bg-[#00CAE0] text-black text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                {busyId === 'direct-url' ? 'Fetching...' : 'Apply'}
              </button>
            </div>
            {urlError && <p className="text-xs text-[#F87171]">{urlError}</p>}
          </div>
        )}
      </div>
    </motion.div>
  );
}
