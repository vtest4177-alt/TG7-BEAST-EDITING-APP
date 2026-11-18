import { useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, Search, Upload } from 'lucide-react';
import {
  FontCatalogItem,
  GOOGLE_FONT_CATALOG,
  installGoogleFontByInput,
  installLocalFontFile,
  loadGoogleFont,
} from '../data/assetsCatalog';

interface FontManagerSheetProps {
  currentFont: string;
  customFonts: string[];
  onSelectFont: (fontFamily: string) => void;
  onAddCustomFont: (fontFamily: string) => void;
}

export function FontManagerSheet({
  currentFont,
  customFonts,
  onSelectFont,
  onAddCustomFont,
}: FontManagerSheetProps) {
  const [loadingFont, setLoadingFont] = useState<string | null>(null);
  const [fontInput, setFontInput] = useState('');
  const [fontError, setFontError] = useState<string | null>(null);
  const [installingCustom, setInstallingCustom] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Preload catalog font stylesheets lazily when sheet opens so cards render in their actual font face
  useEffect(() => {
    GOOGLE_FONT_CATALOG.slice(0, 14).forEach((item) => {
      void loadGoogleFont(item);
    });
  }, []);

  const handlePickCatalogFont = async (item: FontCatalogItem) => {
    setLoadingFont(item.name);
    setFontError(null);
    await loadGoogleFont(item);
    setLoadingFont(null);
    onSelectFont(item.name);
  };

  const handleDirectWebFontInstall = async () => {
    if (!fontInput.trim()) return;
    setInstallingCustom(true);
    setFontError(null);
    try {
      const fam = await installGoogleFontByInput(fontInput);
      onAddCustomFont(fam);
      onSelectFont(fam);
      setFontInput('');
    } catch {
      setFontError('Could not load that Google Font name or link. Check spelling.');
    } finally {
      setInstallingCustom(false);
    }
  };

  const handleLocalFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFontError(null);
    try {
      const fontName = await installLocalFontFile(file);
      onAddCustomFont(fontName);
      onSelectFont(fontName);
    } catch (err) {
      setFontError(
        err instanceof Error
          ? err.message
          : 'Could not load font. Pick a .ttf, .otf, .woff2, or DaFont .zip file.'
      );
    }
    e.target.value = '';
  };

  const q = fontInput.trim().toLowerCase();
  const filteredCatalog = q
    ? GOOGLE_FONT_CATALOG.filter(
        (f) =>
          f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q)
      )
    : GOOGLE_FONT_CATALOG;

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".ttf,.otf,.woff,.woff2,.zip"
        className="hidden"
        onChange={handleLocalFontUpload}
      />

      {/* Direct Website Download & 1-Tap Apply Bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 text-[#8E8E98] absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={fontInput}
            onChange={(e) => setFontInput(e.target.value)}
            placeholder="Type Google Font (e.g. Syne) or paste CSS link..."
            className="flex-1 pl-8 pr-2.5 py-1.5 bg-[#0B0B0E] border border-[#2C2C38] focus:border-[#00CAE0] rounded-lg text-xs text-white outline-none"
          />
          {fontInput.trim().length > 0 && (
            <button
              type="button"
              disabled={installingCustom}
              onClick={handleDirectWebFontInstall}
              className="px-2.5 py-1.5 rounded-lg bg-[#00CAE0] text-black text-[11px] font-bold whitespace-nowrap cursor-pointer"
            >
              {installingCustom ? '...' : 'Apply Font'}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 rounded-lg bg-[#00CAE0] hover:brightness-110 text-black text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Import .ZIP / .TTF / .OTF</span>
        </button>
      </div>

      {/* External Chrome Websites */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        <a
          href="https://fonts.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1 rounded-md bg-[#1C1C24] hover:bg-[#262630] border border-[#2C2C36] text-[11px] font-medium text-[#00CAE0] flex items-center gap-1 whitespace-nowrap shrink-0"
        >
          <span>Google Fonts</span>
          <ExternalLink className="w-3 h-3" />
        </a>
        <a
          href="https://www.dafont.com"
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1 rounded-md bg-[#1C1C24] hover:bg-[#262630] border border-[#2C2C36] text-[11px] font-medium text-[#FBBF24] flex items-center gap-1 whitespace-nowrap shrink-0"
        >
          <span>DaFont (.ZIP direct)</span>
          <ExternalLink className="w-3 h-3" />
        </a>
        <a
          href="https://www.1001fonts.com"
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1 rounded-md bg-[#1C1C24] hover:bg-[#262630] border border-[#2C2C36] text-[11px] font-medium text-[#A78BFA] flex items-center gap-1 whitespace-nowrap shrink-0"
        >
          <span>1001 Fonts (.ZIP)</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {fontError && <p className="text-[11px] text-[#F87171]">{fontError}</p>}

      {/* Installed Custom Fonts */}
      {customFonts.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {customFonts.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onSelectFont(f)}
              style={{ fontFamily: `"${f}", sans-serif` }}
              className={`px-3 py-1.5 rounded-lg text-xs border whitespace-nowrap shrink-0 cursor-pointer ${
                currentFont === f
                  ? 'bg-[#00CAE0] border-[#00CAE0] text-black font-bold'
                  : 'bg-[#181820] border-[#2C2C36] text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* Live Font Specimens Grid (Every font renders in its real font face) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {filteredCatalog.map((item) => {
          const active = currentFont === item.name;
          return (
            <button
              key={item.name}
              type="button"
              onClick={() => handlePickCatalogFont(item)}
              className={`px-3 py-2 rounded-lg border text-left flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                active
                  ? 'bg-[#10262B] border-[#00CAE0] text-white'
                  : 'bg-[#181820] border-[#262630] text-[#E4E4EA] hover:border-[#3A3A48]'
              }`}
            >
              <div className="min-w-0">
                <div
                  className="text-sm font-bold truncate"
                  style={{ fontFamily: `"${item.name}", "Outfit", sans-serif` }}
                >
                  {item.previewText}
                </div>
                <div className="text-[10px] text-[#8E8E98] truncate">
                  {item.name} · {item.category}
                </div>
              </div>
              {loadingFont === item.name ? (
                <span className="text-[10px] font-mono text-[#00CAE0]">...</span>
              ) : active ? (
                <Check className="w-3.5 h-3.5 text-[#00CAE0] shrink-0" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
