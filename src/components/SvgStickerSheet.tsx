import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Code2, Loader2, Plus, Search, Upload, X } from 'lucide-react';
import {
  fetchIconifySvgMarkup,
  IconifySearchResult,
  searchOnlineIconifySvgs,
} from '../data/onlineLibraries';
import { SvgStickerIcon } from './StudioIcons';

interface SvgStickerSheetProps {
  onAddSvgSticker: (name: string, svgMarkup: string, accentHex: string) => void;
  onClose: () => void;
}

const QUICK_TOPICS = [
  { label: 'Gaming & HUD', query: 'target crosshair sword trophy' },
  { label: 'Fire & FX', query: 'fire flame lightning bolt' },
  { label: 'Arrows & UI', query: 'arrow cursor sparkles' },
  { label: 'Creator & Crown', query: 'crown verified star heart' },
  { label: 'Social Icons', query: 'youtube instagram tiktok' },
  { label: 'Emoji Vectors', query: 'fluent-emoji fire' },
];

const ACCENT_COLORS = ['#00CAE0', '#FFFFFF', '#FBBF24', '#34D399', '#F43F5E', '#A78BFA'];

export function SvgStickerSheet({ onAddSvgSticker, onClose }: SvgStickerSheetProps) {
  const [searchQuery, setSearchQuery] = useState('fire lightning crown');
  const [results, setResults] = useState<IconifySearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [accentHex, setAccentHex] = useState('#00CAE0');
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pastedSvg, setPastedSvg] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const runSearch = async (q: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const items = await searchOnlineIconifySvgs(q);
      setResults(items);
    } catch {
      setErrorMsg('Could not reach Iconify GitHub vector API. Check internet connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void runSearch('fire lightning crown');
  }, []);

  const handleSelectOnlineSvg = async (item: IconifySearchResult) => {
    setAddingId(item.id);
    setErrorMsg(null);
    try {
      const markup = await fetchIconifySvgMarkup(item.id, accentHex);
      onAddSvgSticker(item.title, markup, accentHex);
      onClose();
    } catch {
      setErrorMsg(`Failed to download ${item.title} SVG.`);
    } finally {
      setAddingId(null);
    }
  };

  const handleImportSvgFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    try {
      const text = await file.text();
      if (!text.includes('<svg')) {
        setErrorMsg('Please select a valid .svg vector file.');
        return;
      }
      const cleanName = file.name.replace(/\.svg$/i, '');
      onAddSvgSticker(cleanName, text, accentHex);
      onClose();
    } catch {
      setErrorMsg('Could not read SVG file.');
    }
    e.target.value = '';
  };

  const handleApplyPastedSvg = () => {
    const trimmed = pastedSvg.trim();
    if (!trimmed.includes('<svg')) {
      setErrorMsg('Paste valid <svg>...</svg> code copied from SVG Repo or Iconify.');
      return;
    }
    setErrorMsg(null);
    onAddSvgSticker('Custom SVG Vector', trimmed, accentHex);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 18 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      role="dialog"
      aria-modal="true"
      aria-label="Online GitHub Iconify SVG Vector Library"
      className="fixed inset-0 z-50 bg-[#000000] text-[#F5F5F7] flex flex-col"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".svg,image/svg+xml"
        className="hidden"
        onChange={handleImportSvgFile}
      />

      <header className="h-14 px-4 border-b border-[#1C1C22] flex items-center justify-between shrink-0">
        <motion.button
          whileTap={{ scale: 0.88 }}
          type="button"
          onClick={onClose}
          aria-label="Close SVG studio"
          className="w-9 h-9 rounded-full hover:bg-[#1C1C22] flex items-center justify-center cursor-pointer"
        >
          <X className="w-5 h-5" />
        </motion.button>

        <div className="flex items-center gap-2">
          <SvgStickerIcon className="w-5 h-5" />
          <h2 className="font-display text-sm font-semibold">
            Iconify GitHub Vectors (200k+ SVGs)
          </h2>
        </div>

        <div className="w-9" />
      </header>

      <div className="p-3 border-b border-[#1C1C22] space-y-2.5 shrink-0">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runSearch(searchQuery);
            }}
            className="flex-1 flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#8E8E98] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search 200,000+ open-source GitHub SVGs (arrow, fire, crown, subscribe, skull)..."
                className="w-full pl-9 pr-3 py-2 bg-[#141418] border border-[#24242C] focus:border-[#00CAE0] rounded-lg text-xs text-white outline-none"
              />
            </div>
            <motion.button
              whileTap={{ scale: 0.92 }}
              type="submit"
              className="px-3.5 py-2 rounded-lg bg-[#00CAE0] hover:brightness-110 text-black text-xs font-bold cursor-pointer shrink-0"
            >
              Search
            </motion.button>
          </form>

          <div className="flex items-center gap-2 shrink-0">
            <motion.button
              whileTap={{ scale: 0.92 }}
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 rounded-lg bg-[#16161C] hover:bg-[#22222C] border border-[#2C2C38] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5 text-[#00CAE0]" />
              <span>.SVG File</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.92 }}
              type="button"
              onClick={() => setShowPasteBox((v) => !v)}
              className="px-3 py-2 rounded-lg bg-[#16161C] hover:bg-[#22222C] border border-[#2C2C38] text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Code2 className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>Paste Code</span>
            </motion.button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {QUICK_TOPICS.map((topic) => (
              <motion.button
                whileTap={{ scale: 0.92 }}
                key={topic.label}
                type="button"
                onClick={() => {
                  setSearchQuery(topic.query);
                  void runSearch(topic.query);
                }}
                className="px-2.5 py-1 rounded-lg bg-[#141418] hover:bg-[#1E1E26] border border-[#24242E] text-[11px] font-medium text-[#D1D1DC] whitespace-nowrap shrink-0 cursor-pointer"
              >
                {topic.label}
              </motion.button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[#8E8E98] mr-1">Tint:</span>
            {ACCENT_COLORS.map((hex) => (
              <motion.button
                whileTap={{ scale: 0.85 }}
                key={hex}
                type="button"
                onClick={() => setAccentHex(hex)}
                aria-label={`Set SVG color ${hex}`}
                className={`w-5 h-5 rounded-full border cursor-pointer ${
                  accentHex === hex ? 'border-white scale-110 ring-2 ring-[#00CAE0]/50' : 'border-white/20'
                }`}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
        </div>

        {showPasteBox && (
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-2 pt-1">
            <textarea
              rows={2}
              value={pastedSvg}
              onChange={(e) => setPastedSvg(e.target.value)}
              placeholder='Paste <svg viewBox="...">...</svg> copied from SVG Repo or Iconify...'
              className="flex-1 px-3 py-2 bg-[#121216] border border-[#2C2C38] focus:border-[#00CAE0] rounded-lg text-xs font-mono text-white outline-none resize-none"
            />
            <motion.button
              whileTap={{ scale: 0.92 }}
              type="button"
              onClick={handleApplyPastedSvg}
              className="px-4 py-2 rounded-lg bg-[#00CAE0] text-black text-xs font-bold cursor-pointer shrink-0"
            >
              Apply SVG Now
            </motion.button>
          </div>
        )}

        {errorMsg && <p className="max-w-5xl mx-auto text-xs text-[#F87171]">{errorMsg}</p>}
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-5">
        <section className="max-w-5xl mx-auto space-y-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8E8E98]">
            Live GitHub Iconify Results ({results.length})
          </h3>

          {loading ? (
            <div className="py-12 flex items-center justify-center gap-2 text-xs text-[#8E8E98]">
              <Loader2 className="w-4 h-4 animate-spin text-[#00CAE0]" />
              <span>Searching GitHub Iconify vectors...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
              {results.map((item) => {
                const tintedPreview = item.id.includes('emoji')
                  ? item.previewUrl
                  : `${item.previewUrl}&color=${encodeURIComponent(accentHex)}`;
                const isBusy = addingId === item.id;
                return (
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    key={item.id}
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleSelectOnlineSvg(item)}
                    className="group bg-[#101015] hover:bg-[#16161F] border border-[#22222C] hover:border-[#00CAE0]/60 rounded-xl p-2.5 flex flex-col items-center justify-between gap-2 cursor-pointer transition-colors"
                  >
                    <div className="w-full h-16 flex items-center justify-center bg-[#07070A] rounded-lg p-2">
                      {isBusy ? (
                        <Loader2 className="w-5 h-5 animate-spin text-[#00CAE0]" />
                      ) : (
                        <img
                          src={tintedPreview}
                          alt={item.title}
                          loading="lazy"
                          className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform"
                        />
                      )}
                    </div>
                    <div className="w-full flex items-center justify-between gap-1">
                      <span className="text-[10px] font-medium text-white truncate">
                        {item.title}
                      </span>
                      <span className="w-6 h-6 rounded-md bg-[#00CAE0] text-black flex items-center justify-center shrink-0">
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </motion.div>
  );
}
