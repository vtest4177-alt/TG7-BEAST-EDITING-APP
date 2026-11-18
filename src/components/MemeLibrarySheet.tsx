import { useRef, useState } from 'react';
import { ExternalLink, Globe, Link2, Music, Plus, Search, Upload, Volume2, X } from 'lucide-react';
import {
  MEME_LIBRARY,
  MemeLibraryItem,
  RESOURCE_WEBSITES,
} from '../data/assetsCatalog';
import { playMemeSfx } from '../engine/sfxEngine';
import { SvgMemeIcon, SvgStickerIcon } from './StudioIcons';

interface MemeLibrarySheetProps {
  onAddMeme: (item: MemeLibraryItem) => void;
  onImportFiles: (files: FileList, asOverlay?: boolean) => void;
  onImportDirectUrl: (url: string) => void;
  onOpenSvgStickers: () => void;
  onClose: () => void;
}

const CATEGORIES = [
  'All',
  'Websites',
  'Sound FX',
  'Green Screen',
  'Trending',
  'Gaming',
  'Reaction',
] as const;

export function MemeLibrarySheet({
  onAddMeme,
  onImportFiles,
  onImportDirectUrl,
  onOpenSvgStickers,
  onClose,
}: MemeLibrarySheetProps) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All');
  const [query, setQuery] = useState('');
  const [directUrl, setDirectUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const q = query.trim().toLowerCase();

  const filteredMemes = MEME_LIBRARY.filter((item) => {
    if (category === 'Websites') return false;
    const matchCat = category === 'All' || item.category === category;
    const matchSearch =
      !q ||
      item.title.toLowerCase().includes(q) ||
      (item.topText && item.topText.toLowerCase().includes(q)) ||
      (item.bottomText && item.bottomText.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });

  const filteredSites = RESOURCE_WEBSITES.filter((site) => {
    if (category !== 'Websites' && category !== 'All') return false;
    if (!q) return true;
    return (
      site.name.toLowerCase().includes(q) ||
      site.tagline.toLowerCase().includes(q) ||
      site.category.toLowerCase().includes(q)
    );
  });

  const handleApplyDirectUrl = () => {
    const trimmed = directUrl.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setUrlError('Paste a direct http/https link to an .mp3, .mp4, .png, .gif, or .svg file.');
      return;
    }
    setUrlError(null);
    onImportDirectUrl(trimmed);
    setDirectUrl('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Memes, VFX, Sounds and Websites library"
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
          aria-label="Close meme library"
          className="w-9 h-9 rounded-full hover:bg-[#1C1C22] flex items-center justify-center cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <SvgMemeIcon className="w-5 h-5" />
          <h2 className="font-display text-sm font-semibold">
            Memes, Sound FX, SVGs &amp; Websites
          </h2>
        </div>
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenSvgStickers();
          }}
          className="px-2.5 py-1.5 rounded-lg bg-[#16161C] hover:bg-[#22222C] border border-[#2C2C38] text-[11px] font-semibold text-[#38BDF8] flex items-center gap-1.5 cursor-pointer"
        >
          <SvgStickerIcon className="w-3.5 h-3.5" />
          <span>SVG Studio</span>
        </button>
      </header>

      {/* Search, Direct URL Apply, Downloaded File Import & Category Tabs */}
      <div className="p-3 border-b border-[#1C1C22] space-y-2.5 shrink-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-5xl mx-auto">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8E8E98] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search MyInstants, NCS songs, Vine boom, green screen..."
              className="w-full pl-9 pr-3 py-2 bg-[#141418] border border-[#24242C] focus:border-[#00CAE0] rounded-lg text-xs text-white outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto shrink-0">
            <button
              type="button"
              onClick={() => audioInputRef.current?.click()}
              className="px-3 py-2 rounded-lg bg-[#00CAE0] hover:brightness-110 text-black text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Music className="w-3.5 h-3.5" />
              <span>+ Apply Audio/MP3</span>
            </button>
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="px-3 py-2 rounded-lg bg-[#1C1C24] hover:bg-[#262630] border border-[#2E2E3A] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5 text-[#A78BFA]" />
              <span>+ Apply Meme / Video / SVG</span>
            </button>
          </div>
        </div>

        {/* Direct Paste URL -> Apply straight to Timeline */}
        <div className="max-w-5xl mx-auto flex items-center gap-2">
          <div className="relative flex-1">
            <Link2 className="w-3.5 h-3.5 text-[#00CAE0] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="url"
              value={directUrl}
              onChange={(e) => setDirectUrl(e.target.value)}
              placeholder="Paste direct .mp3 / .mp4 / .gif / .png / .svg URL from website to apply directly..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#0C0C10] border border-[#24242E] focus:border-[#00CAE0] rounded-lg text-xs text-white outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleApplyDirectUrl}
            className="px-3 py-1.5 rounded-lg bg-[#1E2E34] hover:bg-[#253C44] border border-[#00CAE0]/40 text-[#00CAE0] text-xs font-bold cursor-pointer whitespace-nowrap"
          >
            Direct Apply
          </button>
        </div>

        {urlError && <p className="max-w-5xl mx-auto text-[11px] text-[#F87171]">{urlError}</p>}

        <div className="flex items-center gap-1.5 overflow-x-auto max-w-5xl mx-auto pb-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                category === cat
                  ? 'bg-[#00CAE0] text-black font-semibold'
                  : 'bg-[#141418] text-[#8E8E98] hover:text-white'
              }`}
            >
              {cat === 'Websites' && <Globe className="w-3.5 h-3.5" />}
              <span>{cat}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Websites + Massive Built-in Memes & SFX Grid */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-5">
        {filteredSites.length > 0 && (
          <section className="max-w-5xl mx-auto space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8E8E98]">
                Free Download Websites (Download or Copy Link · Apply Directly Above)
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {filteredSites.map((site) => (
                <a
                  key={site.id}
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-xl bg-[#121216] hover:bg-[#191920] border border-[#24242E] flex items-start justify-between gap-2 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-xs font-bold truncate"
                        style={{ color: site.accentHex }}
                      >
                        {site.name}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-[#7C7C88] mt-0.5">
                      {site.category}
                    </div>
                    <p className="text-[11px] text-[#B4B4C0] mt-1 line-clamp-2">
                      {site.tagline}
                    </p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-[#8E8E98] shrink-0 mt-0.5" />
                </a>
              ))}
            </div>
          </section>
        )}

        {filteredMemes.length > 0 && (
          <section className="max-w-5xl mx-auto space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8E8E98]">
              Instant Built-In Memes &amp; Sound FX ({filteredMemes.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredMemes.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#121215] border border-[#22222A] rounded-xl overflow-hidden flex flex-col justify-between"
                >
                  {item.kind === 'visual' ? (
                    <div
                      className="h-24 p-2.5 flex flex-col items-center justify-center text-center relative"
                      style={{
                        backgroundColor: item.chromaGreen ? '#0A2E14' : '#0B0B10',
                        borderBottom: `2px solid ${item.accentHex}`,
                      }}
                    >
                      {item.chromaGreen && (
                        <span className="absolute top-1.5 left-1.5 text-[9px] font-mono text-[#34D399]">
                          GREEN SCREEN
                        </span>
                      )}
                      <span className="text-[11px] font-bold text-white leading-tight">
                        {item.topText}
                      </span>
                      <span
                        className="text-sm font-extrabold leading-tight mt-0.5"
                        style={{ color: item.accentHex }}
                      >
                        {item.bottomText}
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => item.sfxId && playMemeSfx(item.sfxId)}
                      className="h-24 p-3 bg-[#0D1A1D] hover:bg-[#12262B] flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Volume2 className="w-6 h-6 text-[#00CAE0]" />
                      <span className="text-[10px] font-mono text-[#00CAE0]">TAP TO PREVIEW</span>
                    </button>
                  )}

                  <div className="p-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-[#F5F5F7] truncate">
                        {item.title}
                      </div>
                      <div className="text-[10px] font-mono text-[#8E8E98]">
                        {item.category} · {item.durationSec}s
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (item.kind === 'sfx' && item.sfxId) playMemeSfx(item.sfxId);
                        onAddMeme(item);
                      }}
                      aria-label={`Add ${item.title}`}
                      className="w-8 h-8 rounded-lg bg-[#00CAE0] hover:brightness-110 text-black flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
