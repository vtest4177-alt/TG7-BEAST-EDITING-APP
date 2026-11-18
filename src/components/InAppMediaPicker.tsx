import { useMemo, useRef, useState } from 'react';
import { Check, ExternalLink, Film, Image as ImageIcon, Plus, X } from 'lucide-react';
import { RESOURCE_WEBSITES, STOCK_CLIPS, StockClipPreset } from '../data/assetsCatalog';
import { generateStockThumbnailDataUrl } from '../engine/compositor';
import { MediaAsset } from '../types/editor';

export interface SelectedGalleryItem {
  kind: 'asset' | 'stock';
  asset?: MediaAsset;
  stock?: StockClipPreset;
}

interface InAppMediaPickerProps {
  title: string;
  deviceAssets: MediaAsset[];
  onImportDeviceFiles: (files: FileList) => void;
  onConfirmSelection: (items: SelectedGalleryItem[]) => void;
  onClose: () => void;
}

export function InAppMediaPicker({
  title,
  deviceAssets,
  onImportDeviceFiles,
  onConfirmSelection,
  onClose,
}: InAppMediaPickerProps) {
  const [tab, setTab] = useState<'all' | 'videos' | 'photos' | 'stock'>('all');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const stockThumbs = useMemo(() => {
    const map = new Map<string, string>();
    STOCK_CLIPS.forEach((s) => {
      map.set(s.id, generateStockThumbnailDataUrl(s.variant));
    });
    return map;
  }, []);

  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const filteredAssets = deviceAssets.filter((a) => {
    if (tab === 'videos') return a.kind === 'video';
    if (tab === 'photos') return a.kind === 'image';
    if (tab === 'stock') return false;
    return a.kind === 'video' || a.kind === 'image';
  });

  const showStock = tab === 'all' || tab === 'stock' || tab === 'videos';

  const handleConfirm = () => {
    const chosen: SelectedGalleryItem[] = [];
    for (const key of selectedKeys) {
      if (key.startsWith('asset:')) {
        const id = key.slice(6);
        const asset = deviceAssets.find((a) => a.id === id);
        if (asset) chosen.push({ kind: 'asset', asset });
      } else if (key.startsWith('stock:')) {
        const id = key.slice(6);
        const stock = STOCK_CLIPS.find((s) => s.id === id);
        if (stock) chosen.push({ kind: 'stock', stock });
      }
    }
    if (chosen.length > 0) {
      onConfirmSelection(chosen);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 bg-[#000000] text-[#F5F5F7] flex flex-col"
    >
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onImportDeviceFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onImportDeviceFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* CapCut Gallery Header */}
      <header className="h-14 px-4 border-b border-[#1C1C22] flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close media picker"
          className="w-9 h-9 rounded-full hover:bg-[#1C1C22] flex items-center justify-center cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="font-display text-sm font-semibold">{title}</h2>

        <div className="w-9" />
      </header>

      {/* CapCut Media Type Tabs */}
      <div className="px-4 py-2.5 border-b border-[#1C1C22] flex items-center justify-between gap-2 overflow-x-auto shrink-0">
        <div className="flex items-center gap-1.5">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'videos', label: 'Videos' },
              { id: 'photos', label: 'Photos' },
              { id: 'stock', label: 'Stock Clips' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap ${
                tab === t.id
                  ? 'bg-[#F5F5F7] text-black font-semibold'
                  : 'bg-[#141418] text-[#8E8E98] hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Direct Gallery Import Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            className="px-3 py-1.5 bg-[#181820] hover:bg-[#22222C] border border-[#2C2C36] rounded-lg text-xs font-medium text-[#00CAE0] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Film className="w-3.5 h-3.5" />
            <span>+ Phone Video</span>
          </button>
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="px-3 py-1.5 bg-[#181820] hover:bg-[#22222C] border border-[#2C2C36] rounded-lg text-xs font-medium text-[#A78BFA] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>+ Phone Photo</span>
          </button>
        </div>
      </div>

      {/* Visual Media Grid */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
        {(tab === 'all' || tab === 'stock' || tab === 'videos') && (
          <div className="max-w-5xl mx-auto flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-[11px] text-[#8E8E98] whitespace-nowrap shrink-0">
              Download VFX / Clips:
            </span>
            {RESOURCE_WEBSITES.filter((s) => s.category === 'Meme VFX & Video').map((site) => (
              <a
                key={site.id}
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-md bg-[#141418] hover:bg-[#1E1E26] border border-[#262630] text-[11px] font-medium flex items-center gap-1 whitespace-nowrap shrink-0"
                style={{ color: site.accentHex }}
              >
                <span>{site.name}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 max-w-5xl mx-auto">
          {/* Quick Device Gallery Tile */}
          <button
            type="button"
            onClick={() =>
              tab === 'photos' ? photoInputRef.current?.click() : videoInputRef.current?.click()
            }
            className="aspect-square rounded-xl bg-[#141418] hover:bg-[#1C1C22] border border-dashed border-[#00CAE0]/60 flex flex-col items-center justify-center gap-1.5 p-2 text-center cursor-pointer"
          >
            <div className="w-9 h-9 rounded-full bg-[#00CAE0]/15 flex items-center justify-center">
              <Plus className="w-5 h-5 text-[#00CAE0]" />
            </div>
            <span className="text-[11px] font-medium text-[#F5F5F7]">
              {tab === 'photos' ? 'Pick Photos' : 'Pick Videos'}
            </span>
          </button>

          {/* Device Uploaded Media Tiles */}
          {filteredAssets.map((asset) => {
            const key = `asset:${asset.id}`;
            const orderIdx = selectedKeys.indexOf(key);
            const isSelected = orderIdx >= 0;
            const thumb =
              asset.kind === 'image'
                ? asset.url
                : asset.thumbnails && asset.thumbnails.length > 0
                  ? asset.thumbnails[0]
                  : '';

            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleSelect(key)}
                className={`aspect-square rounded-xl overflow-hidden relative bg-[#141418] border cursor-pointer group ${
                  isSelected ? 'border-[#00CAE0] ring-2 ring-[#00CAE0]' : 'border-[#24242C]'
                }`}
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt={asset.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film className="w-6 h-6 text-[#8E8E98]" />
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/90 to-transparent flex items-end justify-between gap-1">
                  <span className="text-[10px] text-white truncate">{asset.name}</span>
                  <span className="text-[10px] font-mono tabular-nums text-white/80 shrink-0">
                    {asset.durationSec.toFixed(1)}s
                  </span>
                </div>

                <div
                  className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border ${
                    isSelected
                      ? 'bg-[#00CAE0] border-[#00CAE0] text-black'
                      : 'bg-black/60 border-white/60 text-transparent'
                  }`}
                >
                  {isSelected ? orderIdx + 1 : <Check className="w-3 h-3" />}
                </div>
              </button>
            );
          })}

          {/* Built-in Animated Stock Clips */}
          {showStock &&
            STOCK_CLIPS.map((stock) => {
              const key = `stock:${stock.id}`;
              const orderIdx = selectedKeys.indexOf(key);
              const isSelected = orderIdx >= 0;
              const thumb = stockThumbs.get(stock.id);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleSelect(key)}
                  className={`aspect-square rounded-xl overflow-hidden relative bg-[#141418] border cursor-pointer ${
                    isSelected ? 'border-[#00CAE0] ring-2 ring-[#00CAE0]' : 'border-[#24242C]'
                  }`}
                >
                  {thumb && (
                    <img
                      src={thumb}
                      alt={stock.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-[#00CAE0]">
                    STOCK
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/90 to-transparent flex items-end justify-between gap-1">
                    <span className="text-[10px] text-white truncate">{stock.name}</span>
                    <span className="text-[10px] font-mono tabular-nums text-white/80 shrink-0">
                      {stock.durationSec.toFixed(1)}s
                    </span>
                  </div>
                  <div
                    className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border ${
                      isSelected
                        ? 'bg-[#00CAE0] border-[#00CAE0] text-black'
                        : 'bg-black/60 border-white/60 text-transparent'
                    }`}
                  >
                    {isSelected ? orderIdx + 1 : <Check className="w-3 h-3" />}
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {/* CapCut Bottom Multi-Select Bar */}
      <footer className="h-16 px-4 border-t border-[#1C1C22] bg-[#121215] flex items-center justify-between shrink-0">
        <div className="text-xs text-[#8E8E98]">
          {selectedKeys.length === 0
            ? 'Tap clips to select multiple'
            : `${selectedKeys.length} clip${selectedKeys.length > 1 ? 's' : ''} selected`}
        </div>
        <button
          type="button"
          disabled={selectedKeys.length === 0}
          onClick={handleConfirm}
          className="px-6 py-2.5 min-h-[40px] rounded-lg bg-[#00CAE0] disabled:bg-[#24242C] disabled:text-[#666670] text-black text-xs font-bold cursor-pointer"
        >
          Add {selectedKeys.length > 0 ? `(${selectedKeys.length})` : ''}
        </button>
      </footer>
    </div>
  );
}
