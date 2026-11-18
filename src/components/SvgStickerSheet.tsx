import { useRef, useState } from 'react';
import { Code2, ExternalLink, Globe, Plus, Upload, X } from 'lucide-react';
import { RESOURCE_WEBSITES } from '../data/assetsCatalog';
import {
  buildColoredSvgMarkup,
  SVG_STICKER_LIBRARY,
  svgMarkupToDataUrl,
} from '../data/svgStickers';
import { SvgStickerIcon } from './StudioIcons';

interface SvgStickerSheetProps {
  onAddSvgSticker: (name: string, svgMarkup: string, accentHex: string) => void;
  onClose: () => void;
}

const SVG_CATEGORIES = ['All', 'HUD', 'Motion', 'Creator', 'Impact', 'Websites'] as const;
const ACCENT_COLORS = ['#00CAE0', '#FFFFFF', '#FBBF24', '#34D399', '#F43F5E', '#A78BFA'];

export function SvgStickerSheet({ onAddSvgSticker, onClose }: SvgStickerSheetProps) {
  const [category, setCategory] = useState<(typeof SVG_CATEGORIES)[number]>('All');
  const [accentHex, setAccentHex] = useState('#00CAE0');
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pastedSvg, setPastedSvg] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const svgSites = RESOURCE_WEBSITES.filter((s) => s.category === 'SVG & Stickers');
  const filteredStickers = SVG_STICKER_LIBRARY.filter(
    (s) => category === 'All' || s.category === category
  );

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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="SVG Vector Stickers and HUD Overlays"
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
        <button
          type="button"
          onClick={onClose}
          aria-label="Close SVG studio"
          className="w-9 h-9 rounded-full hover:bg-[#1C1C22] flex items-center justify-center cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <SvgStickerIcon className="w-5 h-5" />
          <h2 className="font-display text-sm font-semibold">
            SVG Vector Stickers &amp; HUD Overlays
          </h2>
        </div>

        <div className="w-9" />
      </header>

      {/* Top Action Bar: Import .SVG, Paste Code & Accent Color */}
      <div className="p-3 border-b border-[#1C1C22] space-y-2.5 shrink-0">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 rounded-lg bg-[#00CAE0] hover:brightness-110 text-black text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import .SVG File</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPasteBox((v) => !v)}
              className="px-3 py-2 rounded-lg bg-[#16161C] hover:bg-[#202028] border border-[#2C2C38] text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Code2 className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>Paste SVG Code</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[#8E8E98] mr-1">Vector Color:</span>
            {ACCENT_COLORS.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => setAccentHex(hex)}
                aria-label={`Set SVG color ${hex}`}
                className={`w-6 h-6 rounded-full border cursor-pointer transition-transform ${
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
              placeholder='Paste <svg viewBox="...">...</svg> copied from Iconify or SVG Repo...'
              className="flex-1 px-3 py-2 bg-[#121216] border border-[#2C2C38] focus:border-[#00CAE0] rounded-lg text-xs font-mono text-white outline-none resize-none"
            />
            <button
              type="button"
              onClick={handleApplyPastedSvg}
              className="px-4 py-2 rounded-lg bg-[#00CAE0] text-black text-xs font-bold cursor-pointer shrink-0"
            >
              Apply SVG Now
            </button>
          </div>
        )}

        {errorMsg && <p className="max-w-5xl mx-auto text-xs text-[#F87171]">{errorMsg}</p>}

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-5xl mx-auto pb-0.5">
          {SVG_CATEGORIES.map((cat) => (
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

      {/* Scrollable SVG Library & Websites */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-5">
        {(category === 'All' || category === 'Websites') && (
          <section className="max-w-5xl mx-auto space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8E8E98]">
              Download Free SVG Vectors (Open · Download/Copy · Import Above)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {svgSites.map((site) => (
                <a
                  key={site.id}
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-xl bg-[#121216] hover:bg-[#191920] border border-[#24242E] flex items-start justify-between gap-2 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate" style={{ color: site.accentHex }}>
                      {site.name}
                    </div>
                    <p className="text-[11px] text-[#A1A1AE] mt-1">{site.tagline}</p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-[#8E8E98] shrink-0 mt-0.5" />
                </a>
              ))}
            </div>
          </section>
        )}

        {category !== 'Websites' && (
          <section className="max-w-5xl mx-auto space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8E8E98]">
              Crisp Vector SVG Stickers ({filteredStickers.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {filteredStickers.map((stk) => {
                const color = accentHex || stk.defaultColor;
                const dataUrl = svgMarkupToDataUrl(stk.markup, color);
                return (
                  <button
                    key={stk.id}
                    type="button"
                    onClick={() => {
                      onAddSvgSticker(stk.name, buildColoredSvgMarkup(stk.markup, color), color);
                      onClose();
                    }}
                    className="group bg-[#101015] hover:bg-[#16161F] border border-[#22222C] hover:border-[#00CAE0]/60 rounded-xl p-3 flex flex-col items-center justify-between gap-2.5 cursor-pointer transition-all"
                  >
                    <div className="w-full h-20 flex items-center justify-center bg-[#07070A] rounded-lg p-2">
                      <img
                        src={dataUrl}
                        alt={stk.name}
                        className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform"
                      />
                    </div>
                    <div className="w-full flex items-center justify-between gap-1.5">
                      <div className="text-left min-w-0">
                        <div className="text-xs font-semibold text-white truncate">{stk.name}</div>
                        <div className="text-[10px] font-mono text-[#7E7E8C]">{stk.category}</div>
                      </div>
                      <span className="w-7 h-7 rounded-lg bg-[#00CAE0] text-black flex items-center justify-center shrink-0">
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
