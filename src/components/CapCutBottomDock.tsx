import { useRef } from 'react';
import { Check, ChevronLeft, Copy, ExternalLink, Play, Trash2, Upload, Volume2 } from 'lucide-react';
import {
  CLIP_TRANSITIONS,
  INTRO_OUTRO_TEMPLATES,
  IntroOutroTemplate,
  MEME_LIBRARY,
  MemeLibraryItem,
  RESOURCE_WEBSITES,
  TEXT_ANIMATIONS,
  TEXT_STYLE_PRESETS,
  VIDEO_EFFECTS,
} from '../data/assetsCatalog';
import { interpolateTransform } from '../engine/compositor';
import { playMemeSfx } from '../engine/sfxEngine';
import {
  AspectRatio,
  ChromaKeyConfig,
  Clip,
  ClipCrop,
  Keyframe,
  SpeedPoint,
  SpeedPreset,
  TextAnimationType,
  TextStylePreset,
  TransitionType,
  VideoEffectType,
} from '../types/editor';
import { FontManagerSheet } from './FontManagerSheet';
import { EffectVisualThumb, TransitionVisualThumb } from './FxPreviewTile';
import { SpeedCurveEditor } from './SpeedCurveEditor';
import {
  SvgAudioIcon,
  SvgChromaIcon,
  SvgCropIcon,
  SvgEffectsIcon,
  SvgFontIcon,
  SvgIntroIcon,
  SvgKeyframeIcon,
  SvgLayerIcon,
  SvgMediaIcon,
  SvgMemeIcon,
  SvgMotionIcon,
  SvgRatioIcon,
  SvgScissorsIcon,
  SvgSpeedIcon,
  SvgStickerIcon,
  SvgTextIcon,
  SvgTransitionIcon,
} from './StudioIcons';

export type BottomSheetTool =
  | null
  | 'audio-hub'
  | 'speed'
  | 'chroma'
  | 'motion'
  | 'crop'
  | 'text'
  | 'fonts'
  | 'text-anim'
  | 'effects'
  | 'transition'
  | 'intro-outro'
  | 'ratio';

interface CapCutBottomDockProps {
  selectedClip: Clip | null;
  playheadSec: number;
  aspectRatio: AspectRatio;
  activeSheet: BottomSheetTool;
  customFonts: string[];
  onChangeSheet: (sheet: BottomSheetTool) => void;
  onOpenSmartFx: (sheet: 'effects' | 'transition') => void;
  onPreviewSegment: (startSec: number) => void;
  onDeselectClip: () => void;
  onOpenMediaPicker: (mode: 'main' | 'overlay') => void;
  onOpenMemes: () => void;
  onOpenSvgStickers: () => void;
  onImportAudio: (files: FileList) => void;
  onAddSfxItem: (item: MemeLibraryItem) => void;
  onAddTextClip: () => void;
  onApplyIntroOutro: (tpl: IntroOutroTemplate) => void;
  onSplit: () => void;
  onToggleKeyframe: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onChangeAspectRatio: (ratio: AspectRatio) => void;
  onUpdateTransform: (patch: Partial<Omit<Keyframe, 'id' | 'timeOffset'>>) => void;
  onUpdateChromaKey: (patch: Partial<ChromaKeyConfig>) => void;
  onUpdateSpeedRamp: (preset: SpeedPreset, points: SpeedPoint[]) => void;
  onUpdateText: (textContent: string, textColor: string) => void;
  onUpdateTextStyle: (style: TextStylePreset, fontSize?: number) => void;
  onUpdateSvgColor: (accentHex: string) => void;
  onUpdateFont: (fontFamily: string) => void;
  onAddCustomFont: (fontFamily: string) => void;
  onUpdateTextAnimation: (anim: TextAnimationType) => void;
  onUpdateEffect: (type: VideoEffectType, intensity: number) => void;
  onUpdateTransition: (type: TransitionType, durationSec: number) => void;
  onApplyTransitionToAll: (type: TransitionType, durationSec: number) => void;
  onUpdateCrop: (crop: ClipCrop) => void;
}

const CHROMA_SWATCHES = [
  { hex: '#00FF00', label: 'Green' },
  { hex: '#0044FF', label: 'Blue' },
  { hex: '#FFFFFF', label: 'White' },
  { hex: '#000000', label: 'Black' },
];

const TEXT_COLORS = ['#FFFFFF', '#00CAE0', '#FBBF24', '#34D399', '#F43F5E', '#A78BFA'];

export function CapCutBottomDock({
  selectedClip,
  playheadSec,
  aspectRatio,
  activeSheet,
  customFonts,
  onChangeSheet,
  onOpenSmartFx,
  onPreviewSegment,
  onDeselectClip,
  onOpenMediaPicker,
  onOpenMemes,
  onOpenSvgStickers,
  onImportAudio,
  onAddSfxItem,
  onAddTextClip,
  onApplyIntroOutro,
  onSplit,
  onToggleKeyframe,
  onDuplicate,
  onDelete,
  onChangeAspectRatio,
  onUpdateTransform,
  onUpdateChromaKey,
  onUpdateSpeedRamp,
  onUpdateText,
  onUpdateTextStyle,
  onUpdateSvgColor,
  onUpdateFont,
  onAddCustomFont,
  onUpdateTextAnimation,
  onUpdateEffect,
  onUpdateTransition,
  onApplyTransitionToAll,
  onUpdateCrop,
}: CapCutBottomDockProps) {
  const audioFileRef = useRef<HTMLInputElement | null>(null);

  const localTime = selectedClip
    ? Math.max(0, Math.min(selectedClip.durationSec, playheadSec - selectedClip.startSec))
    : 0;
  const currentTransform = selectedClip
    ? interpolateTransform(selectedClip, localTime)
    : { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };

  return (
    <div className="shrink-0 bg-[#121215] border-t border-[#1E1E24] relative z-30">
      <input
        ref={audioFileRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onImportAudio(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {activeSheet && (
        <div className="border-b border-[#24242C] bg-[#141418] px-4 py-3 max-h-[290px] overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#A1A1AE]">
                {activeSheet === 'audio-hub' && 'Sounds, Songs & Instant Websites'}
                {activeSheet === 'speed' && 'Speed Curve'}
                {activeSheet === 'chroma' && 'Chroma Key'}
                {activeSheet === 'motion' && 'Motion & Transform'}
                {activeSheet === 'crop' && 'Crop & Frame'}
                {activeSheet === 'text' && 'Text Style & Color'}
                {activeSheet === 'fonts' && 'Fonts, Google Fonts & DaFont .ZIP'}
                {activeSheet === 'text-anim' && 'Text Animation'}
                {activeSheet === 'effects' && 'Live Video Effects'}
                {activeSheet === 'transition' && 'Live Cut Transitions'}
                {activeSheet === 'intro-outro' && 'Intro & Outro Templates'}
                {activeSheet === 'ratio' && 'Canvas Ratio'}
              </h3>

              <div className="flex items-center gap-1.5">
                {activeSheet === 'effects' && selectedClip && (
                  <button
                    type="button"
                    onClick={() => onPreviewSegment(selectedClip.startSec)}
                    className="px-2.5 py-1 rounded-md bg-[#00CAE0] text-black text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-black" />
                    <span>Replay FX</span>
                  </button>
                )}
                {activeSheet === 'transition' && selectedClip && (
                  <button
                    type="button"
                    onClick={() => onPreviewSegment(Math.max(0, selectedClip.startSec - 0.15))}
                    className="px-2.5 py-1 rounded-md bg-[#00CAE0] text-black text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-black" />
                    <span>Replay Cut</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onChangeSheet(null)}
                  aria-label="Apply and close panel"
                  className="w-8 h-8 rounded-full bg-[#24242C] hover:bg-[#32323D] text-white flex items-center justify-center cursor-pointer"
                >
                  <Check className="w-4 h-4 text-[#00CAE0]" />
                </button>
              </div>
            </div>

            {activeSheet === 'audio-hub' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => audioFileRef.current?.click()}
                    className="px-3.5 py-2 rounded-lg bg-[#00CAE0] hover:brightness-110 text-black text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>+ Import Song / MP3 from Phone</span>
                  </button>

                  {RESOURCE_WEBSITES.filter(
                    (s) => s.category === 'Meme Sounds' || s.category === 'Songs & Beats'
                  ).map((site) => (
                    <a
                      key={site.id}
                      href={site.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-lg bg-[#1C1C24] hover:bg-[#262632] border border-[#2C2C38] text-xs font-medium flex items-center gap-1.5"
                      style={{ color: site.accentHex }}
                    >
                      <span>{site.name}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {MEME_LIBRARY.filter((m) => m.kind === 'sfx').map((sfx) => (
                    <button
                      key={sfx.id}
                      type="button"
                      onClick={() => {
                        if (sfx.sfxId) playMemeSfx(sfx.sfxId);
                        onAddSfxItem(sfx);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#0D1A1D] hover:bg-[#13292E] border border-[#1E3B42] text-xs text-[#00CAE0] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>{sfx.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeSheet === 'speed' && selectedClip && (
              <SpeedCurveEditor
                clip={selectedClip}
                localTime={localTime}
                onUpdateSpeedRamp={onUpdateSpeedRamp}
              />
            )}

            {activeSheet === 'effects' && selectedClip && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {VIDEO_EFFECTS.map((fx) => {
                    const active = (selectedClip.effect?.type || 'none') === fx.id;
                    return (
                      <button
                        key={fx.id}
                        type="button"
                        onClick={() => {
                          onUpdateEffect(fx.id, selectedClip.effect?.intensity ?? 70);
                          onPreviewSegment(selectedClip.startSec);
                        }}
                        className={`p-1.5 rounded-xl border text-left transition-all cursor-pointer ${
                          active
                            ? 'bg-[#0F2A30] border-[#00CAE0] ring-1 ring-[#00CAE0]'
                            : 'bg-[#191921] border-[#2A2A34] hover:border-[#3A3A48]'
                        }`}
                      >
                        <EffectVisualThumb type={fx.id} />
                        <div className="mt-1.5 px-0.5">
                          <div className="text-[11px] font-semibold text-white truncate">
                            {fx.label}
                          </div>
                          <div className="text-[9px] text-[#8E8E98] truncate">{fx.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedClip.effect && selectedClip.effect.type !== 'none' && (
                  <label className="block space-y-1">
                    <div className="flex justify-between text-[11px] text-[#A1A1AE]">
                      <span>Effect Intensity</span>
                      <span className="font-mono">{selectedClip.effect.intensity}%</span>
                    </div>
                    <input
                      type="range"
                      min={15}
                      max={100}
                      value={selectedClip.effect.intensity}
                      onChange={(e) =>
                        onUpdateEffect(
                          selectedClip.effect!.type,
                          parseInt(e.target.value, 10)
                        )
                      }
                      className="w-full tg7-slider"
                    />
                  </label>
                )}
              </div>
            )}

            {activeSheet === 'transition' && selectedClip && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {CLIP_TRANSITIONS.map((tr) => {
                    const active = (selectedClip.transitionIn?.type || 'none') === tr.id;
                    return (
                      <button
                        key={tr.id}
                        type="button"
                        onClick={() => {
                          onUpdateTransition(
                            tr.id,
                            selectedClip.transitionIn?.durationSec ?? 0.45
                          );
                          onPreviewSegment(Math.max(0, selectedClip.startSec - 0.15));
                        }}
                        className={`p-1.5 rounded-xl border text-left transition-all cursor-pointer ${
                          active
                            ? 'bg-[#0F2A30] border-[#00CAE0] ring-1 ring-[#00CAE0]'
                            : 'bg-[#191921] border-[#2A2A34] hover:border-[#3A3A48]'
                        }`}
                      >
                        <TransitionVisualThumb type={tr.id} />
                        <div className="mt-1.5 px-0.5 text-[11px] font-semibold text-white truncate">
                          {tr.label}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-end gap-3">
                  <label className="flex-1 block space-y-1">
                    <div className="flex justify-between text-[11px] text-[#A1A1AE]">
                      <span>Transition Duration</span>
                      <span className="font-mono">
                        {(selectedClip.transitionIn?.durationSec ?? 0.45).toFixed(2)}s
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.2}
                      max={1.5}
                      step={0.05}
                      value={selectedClip.transitionIn?.durationSec ?? 0.45}
                      onChange={(e) =>
                        onUpdateTransition(
                          selectedClip.transitionIn?.type ?? 'dissolve',
                          parseFloat(e.target.value)
                        )
                      }
                      className="w-full tg7-slider"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      onApplyTransitionToAll(
                        selectedClip.transitionIn?.type ?? 'dissolve',
                        selectedClip.transitionIn?.durationSec ?? 0.45
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-[#24242C] hover:bg-[#32323E] text-[11px] font-semibold text-[#00CAE0] whitespace-nowrap cursor-pointer"
                  >
                    Apply to All Cuts
                  </button>
                </div>
              </div>
            )}

            {activeSheet === 'crop' && selectedClip && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateCrop({
                        top: selectedClip.crop?.top ?? 0,
                        bottom: selectedClip.crop?.bottom ?? 0,
                        left: selectedClip.crop?.left ?? 0,
                        right: selectedClip.crop?.right ?? 0,
                        fitMode: 'contain',
                      })
                    }
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                      (selectedClip.crop?.fitMode ?? 'contain') === 'contain'
                        ? 'bg-[#00CAE0] border-[#00CAE0] text-black font-semibold'
                        : 'bg-[#1C1C24] border-[#2C2C34] text-white'
                    }`}
                  >
                    Fit Frame
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateCrop({
                        top: selectedClip.crop?.top ?? 0,
                        bottom: selectedClip.crop?.bottom ?? 0,
                        left: selectedClip.crop?.left ?? 0,
                        right: selectedClip.crop?.right ?? 0,
                        fitMode: 'cover',
                      })
                    }
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                      selectedClip.crop?.fitMode === 'cover'
                        ? 'bg-[#00CAE0] border-[#00CAE0] text-black font-semibold'
                        : 'bg-[#1C1C24] border-[#2C2C34] text-white'
                    }`}
                  >
                    Fill &amp; Crop
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateCrop({ top: 0, bottom: 0, left: 0, right: 0, fitMode: 'contain' })
                    }
                    className="px-3 py-1.5 rounded-lg bg-[#24242C] hover:bg-[#32323D] text-xs text-white cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(['top', 'bottom', 'left', 'right'] as const).map((side) => {
                    const val = selectedClip.crop?.[side] ?? 0;
                    return (
                      <label key={side} className="space-y-1 block">
                        <div className="flex justify-between text-[11px] text-[#A1A1AE] capitalize">
                          <span>Crop {side}</span>
                          <span className="font-mono">{val}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={45}
                          value={val}
                          onChange={(e) =>
                            onUpdateCrop({
                              top: selectedClip.crop?.top ?? 0,
                              bottom: selectedClip.crop?.bottom ?? 0,
                              left: selectedClip.crop?.left ?? 0,
                              right: selectedClip.crop?.right ?? 0,
                              fitMode: selectedClip.crop?.fitMode ?? 'contain',
                              [side]: parseInt(e.target.value, 10),
                            })
                          }
                          className="w-full tg7-slider"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {activeSheet === 'text-anim' && selectedClip && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {TEXT_ANIMATIONS.map((anim) => {
                  const active = (selectedClip.textAnimation || 'none') === anim.id;
                  return (
                    <button
                      key={anim.id}
                      type="button"
                      onClick={() => {
                        onUpdateTextAnimation(anim.id);
                        onPreviewSegment(selectedClip.startSec);
                      }}
                      className={`px-3.5 py-2 rounded-lg border text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-[#00CAE0] border-[#00CAE0] text-black font-semibold'
                          : 'bg-[#1C1C24] border-[#2C2C34] text-white'
                      }`}
                    >
                      {anim.label}
                    </button>
                  );
                })}
              </div>
            )}

            {activeSheet === 'fonts' && selectedClip && (
              <FontManagerSheet
                currentFont={selectedClip.fontFamily || 'Outfit'}
                customFonts={customFonts}
                onSelectFont={onUpdateFont}
                onAddCustomFont={onAddCustomFont}
              />
            )}

            {activeSheet === 'intro-outro' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {INTRO_OUTRO_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      onApplyIntroOutro(tpl);
                      onChangeSheet(null);
                    }}
                    className="p-3 rounded-lg bg-[#1C1C24] hover:bg-[#242430] border border-[#2C2C36] text-left flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-semibold text-white">{tpl.name}</div>
                      <div className="text-[10px] font-mono text-[#8E8E98]">
                        {tpl.kind.toUpperCase()} · {tpl.durationSec}s · {tpl.fontFamily}
                      </div>
                    </div>
                    <span
                      className="text-[11px] font-bold px-2 py-1 rounded bg-black/50"
                      style={{ color: tpl.colorHex }}
                    >
                      + Add
                    </span>
                  </button>
                ))}
              </div>
            )}

            {activeSheet === 'chroma' && selectedClip && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#F5F5F7]">Remove Backdrop Color</span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateChromaKey({ enabled: !selectedClip.chromaKey.enabled })
                    }
                    className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                      selectedClip.chromaKey.enabled
                        ? 'bg-[#00CAE0] text-black'
                        : 'bg-[#24242C] text-[#A1A1AE]'
                    }`}
                  >
                    {selectedClip.chromaKey.enabled ? 'Enabled' : 'Off'}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {CHROMA_SWATCHES.map((sw) => (
                    <button
                      key={sw.hex}
                      type="button"
                      onClick={() => onUpdateChromaKey({ targetHex: sw.hex, enabled: true })}
                      className={`h-7 flex-1 rounded text-[11px] font-medium cursor-pointer border ${
                        selectedClip.chromaKey.targetHex.toUpperCase() === sw.hex
                          ? 'border-white ring-1 ring-white'
                          : 'border-[#2E2E38]'
                      }`}
                      style={{
                        backgroundColor: sw.hex,
                        color: sw.hex === '#000000' || sw.hex === '#0044FF' ? '#FFF' : '#000',
                      }}
                    >
                      {sw.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 block">
                    <div className="flex justify-between text-[11px] text-[#A1A1AE]">
                      <span>Intensity</span>
                      <span className="font-mono">{selectedClip.chromaKey.similarity}%</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={85}
                      value={selectedClip.chromaKey.similarity}
                      onChange={(e) =>
                        onUpdateChromaKey({ similarity: parseInt(e.target.value, 10) })
                      }
                      className="w-full tg7-slider"
                    />
                  </label>
                  <label className="space-y-1 block">
                    <div className="flex justify-between text-[11px] text-[#A1A1AE]">
                      <span>Shadow</span>
                      <span className="font-mono">{selectedClip.chromaKey.smoothness}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={40}
                      value={selectedClip.chromaKey.smoothness}
                      onChange={(e) =>
                        onUpdateChromaKey({ smoothness: parseInt(e.target.value, 10) })
                      }
                      className="w-full tg7-slider"
                    />
                  </label>
                </div>
              </div>
            )}

            {activeSheet === 'motion' && selectedClip && (
              <div className="space-y-3">
                {selectedClip.sourceType === 'svg-sticker' && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#8E8E98]">SVG Color:</span>
                    {TEXT_COLORS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => onUpdateSvgColor(hex)}
                        className={`w-6 h-6 rounded-full border cursor-pointer ${
                          selectedClip.svgAccent === hex ? 'border-white scale-110' : 'border-white/20'
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 block">
                    <div className="flex justify-between text-[11px] text-[#A1A1AE]">
                      <span>Scale</span>
                      <span className="font-mono">{Math.round(currentTransform.scale * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.2}
                      max={2.5}
                      step={0.02}
                      value={currentTransform.scale}
                      onChange={(e) => onUpdateTransform({ scale: parseFloat(e.target.value) })}
                      className="w-full tg7-slider"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <div className="flex justify-between text-[11px] text-[#A1A1AE]">
                      <span>Rotate</span>
                      <span className="font-mono">{Math.round(currentTransform.rotation)}°</span>
                    </div>
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      step={1}
                      value={currentTransform.rotation}
                      onChange={(e) =>
                        onUpdateTransform({ rotation: parseFloat(e.target.value) })
                      }
                      className="w-full tg7-slider"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <div className="flex justify-between text-[11px] text-[#A1A1AE]">
                      <span>Opacity</span>
                      <span className="font-mono">
                        {Math.round(currentTransform.opacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={currentTransform.opacity}
                      onChange={(e) =>
                        onUpdateTransform({ opacity: parseFloat(e.target.value) })
                      }
                      className="w-full tg7-slider"
                    />
                  </label>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateTransform({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 })
                      }
                      className="w-full py-1.5 bg-[#24242C] hover:bg-[#30303B] rounded text-xs text-white cursor-pointer"
                    >
                      Reset Position
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSheet === 'text' && selectedClip && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={selectedClip.textContent || ''}
                    onChange={(e) =>
                      onUpdateText(e.target.value, selectedClip.textColor || '#FFFFFF')
                    }
                    placeholder="Enter overlay text..."
                    className="flex-1 px-3 py-2 bg-[#0B0B0D] border border-[#2C2C34] focus:border-[#00CAE0] rounded-lg text-sm text-white outline-none"
                  />
                  <input
                    type="color"
                    value={selectedClip.textColor || '#FFFFFF'}
                    onChange={(e) =>
                      onUpdateText(selectedClip.textContent || '', e.target.value)
                    }
                    className="w-9 h-9 rounded bg-transparent border border-[#2C2C34] cursor-pointer"
                  />
                </div>

                {/* Pro Text Style Presets */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {TEXT_STYLE_PRESETS.map((st) => {
                    const active = (selectedClip.textStyle || 'outline') === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => onUpdateTextStyle(st.id, selectedClip.fontSize)}
                        className={`px-2 py-1.5 rounded-lg border text-center cursor-pointer ${
                          active
                            ? 'bg-[#00CAE0] border-[#00CAE0] text-black font-bold'
                            : 'bg-[#1A1A22] border-[#2C2C36] text-white'
                        }`}
                      >
                        <div className="text-[11px] truncate">{st.label}</div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex-1 min-w-[140px] flex items-center gap-2">
                    <span className="text-[11px] text-[#A1A1AE]">Size</span>
                    <input
                      type="range"
                      min={28}
                      max={136}
                      value={selectedClip.fontSize || 74}
                      onChange={(e) =>
                        onUpdateTextStyle(
                          selectedClip.textStyle || 'outline',
                          parseInt(e.target.value, 10)
                        )
                      }
                      className="flex-1 tg7-slider"
                    />
                    <span className="text-[11px] font-mono w-8 text-right">
                      {selectedClip.fontSize || 74}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => onChangeSheet('fonts')}
                    className="px-3 py-1.5 rounded-lg bg-[#1C1C24] border border-[#2C2C36] text-xs text-[#00CAE0] cursor-pointer"
                  >
                    Font: {selectedClip.fontFamily || 'Outfit'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeSheet('text-anim')}
                    className="px-3 py-1.5 rounded-lg bg-[#1C1C24] border border-[#2C2C36] text-xs text-white cursor-pointer"
                  >
                    Anim: {selectedClip.textAnimation || 'none'}
                  </button>
                </div>
              </div>
            )}

            {activeSheet === 'ratio' && (
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: '9:16', label: '9:16 Reels' },
                    { id: '16:9', label: '16:9 YouTube' },
                    { id: '1:1', label: '1:1 Square' },
                  ] as { id: AspectRatio; label: string }[]
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onChangeAspectRatio(item.id)}
                    className={`py-2.5 rounded-lg text-xs font-medium border cursor-pointer ${
                      aspectRatio === item.id
                        ? 'bg-[#00CAE0] border-[#00CAE0] text-black font-semibold'
                        : 'bg-[#1C1C22] border-[#2C2C34] text-[#F5F5F7]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main CapCut Bottom Tool Dock with Custom Crisp SVG Icons */}
      <div className="h-[64px] px-2 flex items-center gap-1 overflow-x-auto">
        {!selectedClip ? (
          <div className="flex items-center justify-around w-full max-w-4xl mx-auto">
            <DockToolButton
              icon={<SvgMediaIcon />}
              label="Media"
              onClick={() => onOpenMediaPicker('main')}
            />
            <DockToolButton
              icon={<SvgAudioIcon />}
              label="Audio"
              active={activeSheet === 'audio-hub'}
              onClick={() =>
                onChangeSheet(activeSheet === 'audio-hub' ? null : 'audio-hub')
              }
            />
            <DockToolButton
              icon={<SvgTextIcon />}
              label="Text"
              onClick={onAddTextClip}
            />
            <DockToolButton
              icon={<SvgStickerIcon />}
              label="SVG"
              onClick={onOpenSvgStickers}
            />
            <DockToolButton
              icon={<SvgEffectsIcon />}
              label="Effects"
              onClick={() => onOpenSmartFx('effects')}
            />
            <DockToolButton
              icon={<SvgTransitionIcon />}
              label="Transition"
              onClick={() => onOpenSmartFx('transition')}
            />
            <DockToolButton
              icon={<SvgLayerIcon />}
              label="Overlay"
              onClick={() => onOpenMediaPicker('overlay')}
            />
            <DockToolButton
              icon={<SvgMemeIcon />}
              label="Memes"
              onClick={onOpenMemes}
            />
            <DockToolButton
              icon={<SvgIntroIcon />}
              label="Intro/Outro"
              active={activeSheet === 'intro-outro'}
              onClick={() =>
                onChangeSheet(activeSheet === 'intro-outro' ? null : 'intro-outro')
              }
            />
            <DockToolButton
              icon={<SvgRatioIcon />}
              label="Ratio"
              active={activeSheet === 'ratio'}
              onClick={() => onChangeSheet(activeSheet === 'ratio' ? null : 'ratio')}
            />
          </div>
        ) : (
          <div className="flex items-center gap-1.5 w-full max-w-4xl mx-auto">
            <button
              type="button"
              onClick={() => {
                onChangeSheet(null);
                onDeselectClip();
              }}
              aria-label="Back to main tools"
              className="min-w-[44px] h-11 rounded-lg bg-[#1C1C22] hover:bg-[#26262E] flex items-center justify-center text-white shrink-0 cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-1 flex-1 justify-around overflow-x-auto">
              <DockToolButton
                icon={<SvgScissorsIcon />}
                label="Split"
                onClick={onSplit}
              />
              <DockToolButton
                icon={<SvgSpeedIcon />}
                label="Speed"
                active={activeSheet === 'speed'}
                onClick={() => onChangeSheet(activeSheet === 'speed' ? null : 'speed')}
              />
              <DockToolButton
                icon={<SvgEffectsIcon className="w-4 h-4" />}
                label="Effects"
                active={activeSheet === 'effects'}
                onClick={() => onChangeSheet(activeSheet === 'effects' ? null : 'effects')}
              />
              <DockToolButton
                icon={<SvgTransitionIcon className="w-4 h-4" />}
                label="Transition"
                active={activeSheet === 'transition'}
                onClick={() =>
                  onChangeSheet(activeSheet === 'transition' ? null : 'transition')
                }
              />
              <DockToolButton
                icon={<SvgKeyframeIcon />}
                label="Keyframe"
                onClick={onToggleKeyframe}
              />
              <DockToolButton
                icon={<SvgChromaIcon />}
                label="Chroma"
                active={activeSheet === 'chroma'}
                onClick={() => onChangeSheet(activeSheet === 'chroma' ? null : 'chroma')}
              />
              <DockToolButton
                icon={<SvgCropIcon />}
                label="Crop"
                active={activeSheet === 'crop'}
                onClick={() => onChangeSheet(activeSheet === 'crop' ? null : 'crop')}
              />
              <DockToolButton
                icon={<SvgMotionIcon />}
                label="Motion"
                active={activeSheet === 'motion'}
                onClick={() => onChangeSheet(activeSheet === 'motion' ? null : 'motion')}
              />
              {selectedClip.sourceType === 'demo-text' && (
                <>
                  <DockToolButton
                    icon={<SvgTextIcon className="w-4 h-4" />}
                    label="Style/Text"
                    active={activeSheet === 'text'}
                    onClick={() => onChangeSheet(activeSheet === 'text' ? null : 'text')}
                  />
                  <DockToolButton
                    icon={<SvgFontIcon />}
                    label="Fonts"
                    active={activeSheet === 'fonts'}
                    onClick={() => onChangeSheet(activeSheet === 'fonts' ? null : 'fonts')}
                  />
                  <DockToolButton
                    icon={<SvgEffectsIcon className="w-4 h-4" />}
                    label="Text Anim"
                    active={activeSheet === 'text-anim'}
                    onClick={() =>
                      onChangeSheet(activeSheet === 'text-anim' ? null : 'text-anim')
                    }
                  />
                </>
              )}
              <DockToolButton
                icon={<Copy className="w-4 h-4 text-[#A1A1AE]" />}
                label="Copy"
                onClick={onDuplicate}
              />
              <DockToolButton
                icon={<Trash2 className="w-4 h-4 text-[#F87171]" />}
                label="Delete"
                onClick={onDelete}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface DockToolButtonProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}

function DockToolButton({ icon, label, active, onClick }: DockToolButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-[56px] h-[52px] px-2 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors shrink-0 cursor-pointer ${
        active ? 'bg-[#1F1F27] text-[#00CAE0]' : 'text-[#E4E4EA] hover:bg-[#1A1A20]'
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium whitespace-nowrap">{label}</span>
    </button>
  );
}
