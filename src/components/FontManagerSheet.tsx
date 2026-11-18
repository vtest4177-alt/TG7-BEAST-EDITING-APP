import { useRef, useState } from 'react';
import { Check, ExternalLink, Upload } from 'lucide-react';
import {
  FontCatalogItem,
  GOOGLE_FONT_CATALOG,
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
  const [fontError, setFontError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePickCatalogFont = async (item: FontCatalogItem) => {
    setLoadingFont(item.name);
    setFontError(null);
    await loadGoogleFont(item);
    setLoadingFont(null);
    onSelectFont(item.name);
  };

  const handleLocalFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFontError(null);
    try {
      const fontName = await installLocalFontFile(file);
      onAddCustomFont(fontName);
      onSelectFont(fontName);
    } catch {
      setFontError('Could not load font file. Please pick a valid .ttf, .otf, or .woff2 file.');
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".ttf,.otf,.woff,.woff2"
        className="hidden"
        onChange={handleLocalFontUpload}
      />

      {/* Download in Chrome + Install Downloaded Font Row */}
      <div className="flex flex-wrap items-center gap-2">
        <a
          href="https://fonts.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-lg bg-[#1C1C24] hover:bg-[#262630] border border-[#2C2C36] text-[11px] font-medium text-[#00CAE0] flex items-center gap-1.5"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Download in Chrome (Google Fonts)</span>
        </a>

        <a
          href="https://www.dafont.com"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-lg bg-[#1C1C24] hover:bg-[#262630] border border-[#2C2C36] text-[11px] font-medium text-[#F5F5F7] flex items-center gap-1.5"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>DaFont</span>
        </a>

        <a
          href="https://www.1001fonts.com"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-lg bg-[#1C1C24] hover:bg-[#262630] border border-[#2C2C36] text-[11px] font-medium text-[#A78BFA] flex items-center gap-1.5"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>1001 Fonts</span>
        </a>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 rounded-lg bg-[#00CAE0] hover:brightness-110 text-black text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Import .TTF / .OTF Font</span>
        </button>
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
              style={{ fontFamily: f }}
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

      {/* Built-In One-Tap Google Fonts */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {GOOGLE_FONT_CATALOG.map((item) => {
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
                <div className="text-xs font-semibold truncate">{item.name}</div>
                <div className="text-[10px] text-[#8E8E98]">{item.category}</div>
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
