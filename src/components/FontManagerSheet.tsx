import { useEffect, useRef, useState } from 'react';
import { Check, Download, Loader2, Search, Upload } from 'lucide-react';
import {
  FontCatalogItem,
  GOOGLE_FONT_CATALOG,
  installGoogleFontByInput,
  installLocalFontFile,
  loadGoogleFont,
} from '../data/assetsCatalog';
import {
  installDaFontZipInApp,
  OnlineDaFontItem,
  OnlineGoogleFontItem,
  searchOnlineFonts,
} from '../data/onlineLibraries';

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
  const [tab, setTab] = useState<'featured' | 'online-google' | 'dafont'>('featured');
  const [loadingFont, setLoadingFont] = useState<string | null>(null);
  const [fontInput, setFontInput] = useState('');
  const [fontError, setFontError] = useState<string | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);

  const [onlineGoogle, setOnlineGoogle] = useState<OnlineGoogleFontItem[]>([]);
  const [dafontItems, setDafontItems] = useState<OnlineDaFontItem[]>([]);
  const [searchingOnline, setSearchingOnline] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    GOOGLE_FONT_CATALOG.slice(0, 14).forEach((item) => {
      void loadGoogleFont(item);
    });
  }, []);

  // Debounced live search when on Online Google or DaFont tabs
  useEffect(() => {
    if (tab === 'featured' && !fontInput.trim()) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearchingOnline(true);
      setFontError(null);
      try {
        const res = await searchOnlineFonts(
          fontInput,
          tab === 'dafont' ? 'dafont' : tab === 'online-google' ? 'google' : 'all'
        );
        if (cancelled) return;
        setOnlineGoogle(res.googleFonts);
        setDafontItems(res.dafontFonts);
      } catch {
        if (!cancelled) setFontError('Could not load online font catalog. Check internet.');
      } finally {
        if (!cancelled) setSearchingOnline(false);
      }
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [fontInput, tab]);

  const handlePickCatalogFont = async (item: FontCatalogItem) => {
    setLoadingFont(item.name);
    setFontError(null);
    await loadGoogleFont(item);
    setLoadingFont(null);
    onSelectFont(item.name);
  };

  const handleApplyOnlineGoogle = async (item: OnlineGoogleFontItem) => {
    setInstallingId(item.id);
    setFontError(null);
    try {
      await loadGoogleFont({
        name: item.name,
        category: 'Modern',
        googleFamily: `${item.googleFamily}:wght@400;700;900`,
        previewText: item.name,
      });
      onAddCustomFont(item.name);
      onSelectFont(item.name);
    } catch {
      setFontError(`Could not load "${item.name}".`);
    } finally {
      setInstallingId(null);
    }
  };

  const handleApplyDaFontInApp = async (item: OnlineDaFontItem) => {
    setInstallingId(item.id);
    setFontError(null);
    try {
      const fam = await installDaFontZipInApp(item);
      onAddCustomFont(fam);
      onSelectFont(fam);
    } catch (err) {
      setFontError(
        err instanceof Error ? err.message : `Could not install "${item.name}" from DaFont.`
      );
    } finally {
      setInstallingId(null);
    }
  };

  const handleDirectWebFontInstall = async () => {
    if (!fontInput.trim()) return;
    setInstallingId('direct');
    setFontError(null);
    try {
      const fam = await installGoogleFontByInput(fontInput);
      onAddCustomFont(fam);
      onSelectFont(fam);
    } catch {
      setFontError('Could not load that font name. Pick from DaFont or Google results below.');
    } finally {
      setInstallingId(null);
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
          : 'Could not load font. Pick a .ttf, .otf, .woff2, or .zip file.'
      );
    }
    e.target.value = '';
  };

  const q = fontInput.trim().toLowerCase();
  const filteredCatalog = q
    ? GOOGLE_FONT_CATALOG.filter(
        (f) => f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q)
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

      {/* In-App Search & Direct Install Bar (No Chrome Redirects) */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 text-[#8E8E98] absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={fontInput}
            onChange={(e) => setFontInput(e.target.value)}
            placeholder="Search 2,100+ Google & DaFont fonts directly..."
            className="flex-1 pl-8 pr-2.5 py-1.5 bg-[#0B0B0E] border border-[#2C2C38] focus:border-[#00CAE0] rounded-lg text-xs text-white outline-none"
          />
          {fontInput.trim().length > 0 && (
            <button
              type="button"
              disabled={installingId === 'direct'}
              onClick={handleDirectWebFontInstall}
              className="px-2.5 py-1.5 rounded-lg bg-[#00CAE0] text-black text-[11px] font-bold whitespace-nowrap cursor-pointer"
            >
              {installingId === 'direct' ? '...' : 'Quick Apply'}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 rounded-lg bg-[#1C1C24] hover:bg-[#262630] border border-[#2C2C38] text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <Upload className="w-3.5 h-3.5 text-[#00CAE0]" />
          <span>Local .ZIP / .TTF</span>
        </button>
      </div>

      {/* In-App Font Source Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {(
          [
            { id: 'featured', label: 'Creator Packs' },
            { id: 'online-google', label: 'Google Fonts (2,100+)' },
            { id: 'dafont', label: 'DaFont Direct (.ZIP)' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              tab === t.id
                ? 'bg-[#00CAE0] text-black'
                : 'bg-[#181820] text-[#9A9AA8] hover:text-white border border-[#282834]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {fontError && <p className="text-[11px] text-[#F87171]">{fontError}</p>}

      {/* Installed Custom / Downloaded Fonts */}
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

      {/* DaFont Direct In-App Installer */}
      {tab === 'dafont' && (
        <div className="space-y-2">
          {searchingOnline ? (
            <div className="py-6 flex items-center justify-center gap-2 text-xs text-[#8E8E98]">
              <Loader2 className="w-4 h-4 animate-spin text-[#00CAE0]" />
              <span>Searching DaFont directly in-app...</span>
            </div>
          ) : dafontItems.length === 0 ? (
            <p className="text-xs text-[#8E8E98] py-4 text-center">
              Type a style above (e.g. cyber, graffiti, anime, brush) to install DaFont .ZIPs right here.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {dafontItems.map((item) => {
                const active = currentFont === item.name;
                const busy = installingId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={busy}
                    onClick={() => void handleApplyDaFontInApp(item)}
                    className={`px-3 py-2 rounded-lg border text-left flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      active
                        ? 'bg-[#10262B] border-[#00CAE0] text-white'
                        : 'bg-[#181820] border-[#262630] text-[#E4E4EA] hover:border-[#3A3A48]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{item.name}</div>
                      <div className="text-[10px] text-[#8E8E98] truncate">
                        DaFont · 1-Tap Extract &amp; Apply
                      </div>
                    </div>
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00CAE0] shrink-0" />
                    ) : active ? (
                      <Check className="w-3.5 h-3.5 text-[#00CAE0] shrink-0" />
                    ) : (
                      <Download className="w-3.5 h-3.5 text-[#FBBF24] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Live 2,100+ Google Fonts Results */}
      {tab === 'online-google' && (
        <div className="space-y-2">
          {searchingOnline ? (
            <div className="py-6 flex items-center justify-center gap-2 text-xs text-[#8E8E98]">
              <Loader2 className="w-4 h-4 animate-spin text-[#00CAE0]" />
              <span>Loading online Google Fonts...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {onlineGoogle.map((item) => {
                const active = currentFont === item.name;
                const busy = installingId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={busy}
                    onClick={() => void handleApplyOnlineGoogle(item)}
                    className={`px-3 py-2 rounded-lg border text-left flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      active
                        ? 'bg-[#10262B] border-[#00CAE0] text-white'
                        : 'bg-[#181820] border-[#262630] text-[#E4E4EA] hover:border-[#3A3A48]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{item.name}</div>
                      <div className="text-[10px] text-[#8E8E98] truncate capitalize">
                        {item.category}
                      </div>
                    </div>
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00CAE0] shrink-0" />
                    ) : active ? (
                      <Check className="w-3.5 h-3.5 text-[#00CAE0] shrink-0" />
                    ) : (
                      <Download className="w-3.5 h-3.5 text-[#00CAE0] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Featured Pre-styled Creator Specimens */}
      {tab === 'featured' && (
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
      )}
    </div>
  );
}
