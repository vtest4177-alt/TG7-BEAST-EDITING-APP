import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  ChevronLeft,
  ChevronsUpDown,
  Copy,
  Loader2,
  Pause,
  Play,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import {
  CLIP_TRANSITIONS,
  CREATOR_TEXT_RECIPES,
  EffectCategory,
  GOOGLE_FONT_CATALOG,
  INTRO_OUTRO_TEMPLATES,
  IntroOutroTemplate,
  loadGoogleFont,
  MEME_LIBRARY,
  MemeLibraryItem,
  TEXT_ANIMATIONS,
  TEXT_STYLE_PRESETS,
  TransitionCategory,
  VIDEO_EFFECTS,
} from '../data/assetsCatalog';
import { OnlineSoundItem, searchOnlineSounds } from '../data/onlineLibraries';
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

export interface StudioToolInspectorProps {
  selectedClip: Clip | null;
  playheadSec: number;
  aspectRatio: AspectRatio;
  activeSheet: BottomSheetTool;
  customFonts: string[];
  onChangeSheet: (sheet: BottomSheetTool) => void;
  onPreviewSegment: (startSec: number) => void;
  onImportAudioClick: () => void;
  onAddSfxItem: (item: MemeLibraryItem) => void;
  onImportOnlineMedia: (
    remoteUrl: string,
    title: string,
    kind: 'audio' | 'video' | 'image',
    proxyUrl?: string,
    asOverlay?: boolean
  ) => Promise<void>;
  onOpenMemeHub: () => void;
  onApplyIntroOutro: (tpl: IntroOutroTemplate) => void;
  onChangeAspectRatio: (ratio: AspectRatio) => void;
  onUpdateTransform: (patch: Partial<Omit<Keyframe, 'id' | 'timeOffset'>>) => void;
  onUpdateChromaKey: (patch: Partial<ChromaKeyConfig>) => void;
  onUpdateSpeedRamp: (preset: SpeedPreset, points: SpeedPoint[]) => void;
  onUpdateText: (textContent: string, textColor: string) => void;
  onUpdateTextProps: (patch: Partial<Clip>) => void;
  onUpdateTextStyle: (style: TextStylePreset, fontSize?: number) => void;
  onUpdateSvgColor: (accentHex: string) => void;
  onUpdateFont: (fontFamily: string) => void;
  onAddCustomFont: (fontFamily: string) => void;
  onUpdateTextAnimation: (anim: TextAnimationType) => void;
  onUpdateEffect: (type: VideoEffectType, intensity: number) => void;
  onUpdateTransition: (type: TransitionType, durationSec: number) => void;
  onApplyTransitionToAll: (type: TransitionType, durationSec: number) => void;
  onUpdateCrop: (crop: ClipCrop) => void;
  mode?: 'mobile-sheet' | 'desktop-sidebar';
}

interface CapCutBottomDockProps extends Omit<StudioToolInspectorProps, 'mode' | 'onImportAudioClick'> {
  onOpenSmartFx: (sheet: 'effects' | 'transition') => void;
  onDeselectClip: () => void;
  onOpenMediaPicker: (mode: 'main' | 'overlay') => void;
  onOpenMemes: () => void;
  onOpenSvgStickers: () => void;
  onImportAudio: (files: FileList) => void;
  onAddTextClip: () => void;
  onSplit: () => void;
  onToggleKeyframe: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  showInlineSheetOnDesktop?: boolean;
}

const CHROMA_SWATCHES = [
  { hex: '#00FF00', label: 'Green' },
  { hex: '#0044FF', label: 'Blue' },
  { hex: '#FFFFFF', label: 'White' },
  { hex: '#000000', label: 'Black' },
];

const TEXT_COLORS = ['#FFFFFF', '#FFE600', '#00CAE0', '#34D399', '#F43F5E', '#A78BFA', '#FF7A00'];

const EFFECT_CATEGORIES: EffectCategory[] = [
  'All',
  'Glitch & Cyber',
  'Lens & Warp',
  'Glow & Neon',
  'Motion',
  'Film LUTs',
];

const TRANSITION_CATEGORIES: TransitionCategory[] = [
  'All',
  'Glitch & TV',
  'Zoom & Spin',
  '3D & Flip',
  'Wipe & Split',
  'Burn & Glow',
  'Dissolve',
];

export function StudioToolInspector({
  selectedClip,
  playheadSec,
  aspectRatio,
  activeSheet,
  customFonts,
  onChangeSheet,
  onPreviewSegment,
  onImportAudioClick,
  onAddSfxItem,
  onImportOnlineMedia,
  onOpenMemeHub,
  onApplyIntroOutro,
  onChangeAspectRatio,
  onUpdateTransform,
  onUpdateChromaKey,
  onUpdateSpeedRamp,
  onUpdateText,
  onUpdateTextProps,
  onUpdateTextStyle,
  onUpdateSvgColor,
  onUpdateFont,
  onAddCustomFont,
  onUpdateTextAnimation,
  onUpdateEffect,
  onUpdateTransition,
  onApplyTransitionToAll,
  onUpdateCrop,
  mode = 'mobile-sheet',
}: StudioToolInspectorProps) {
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isExpandedMobile, setIsExpandedMobile] = useState(false);

  const [audioQuery, setAudioQuery] = useState('');
  const [onlineAudio, setOnlineAudio] = useState<OnlineSoundItem[]>([]);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [downloadingAudioId, setDownloadingAudioId] = useState<string | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  const [hoveredFx, setHoveredFx] = useState<string | null>(null);
  const [fxCategory, setFxCategory] = useState<EffectCategory>('All');
  const [fxQuery, setFxQuery] = useState('');

  const [hoveredTrans, setHoveredTrans] = useState<string | null>(null);
  const [transCategory, setTransCategory] = useState<TransitionCategory>('All');
  const [transQuery, setTransQuery] = useState('');
  const [showAllGlTrans, setShowAllGlTrans] = useState(false);

  useEffect(() => {
    if (activeSheet !== 'audio-hub') {
      audioPreviewRef.current?.pause();
      setPlayingAudioId(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoadingAudio(true);
      try {
        const res = await searchOnlineSounds(audioQuery, 'all');
        if (!cancelled) setOnlineAudio(res.slice(0, 12));
      } catch {
        // fallback to offline sfx below
      } finally {
        if (!cancelled) setLoadingAudio(false);
      }
    }, 260);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeSheet, audioQuery]);

  useEffect(() => {
    if (activeSheet === 'text') {
      const id = window.setTimeout(() => {
        textAreaRef.current?.focus();
      }, 70);
      return () => window.clearTimeout(id);
    }
  }, [activeSheet, selectedClip?.id]);

  const localTime = selectedClip
    ? Math.max(0, Math.min(selectedClip.durationSec, playheadSec - selectedClip.startSec))
    : 0;
  const currentTransform = selectedClip
    ? interpolateTransform(selectedClip, localTime)
    : { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };

  const visibleEffects = useMemo(() => {
    const q = fxQuery.trim().toLowerCase();
    return VIDEO_EFFECTS.filter((fx) => {
      if (fxCategory !== 'All' && fx.category !== fxCategory && fx.id !== 'none') return false;
      if (!q) return true;
      return (
        fx.label.toLowerCase().includes(q) ||
        fx.desc.toLowerCase().includes(q) ||
        fx.id.toLowerCase().includes(q)
      );
    });
  }, [fxCategory, fxQuery]);

  const visibleTransitions = useMemo(() => {
    const q = transQuery.trim().toLowerCase();
    const filtered = CLIP_TRANSITIONS.filter((tr) => {
      if (tr.id === 'none') return true;
      if (transCategory !== 'All' && tr.category !== transCategory) return false;
      if (!q) return true;
      return (
        tr.label.toLowerCase().includes(q) ||
        String(tr.id).toLowerCase().includes(q) ||
        (tr.author || '').toLowerCase().includes(q)
      );
    });
    if (q || transCategory !== 'All' || showAllGlTrans) {
      return filtered;
    }
    return filtered.slice(0, 30);
  }, [transCategory, transQuery, showAllGlTrans]);

  if (!activeSheet) return null;

  const isSidebar = mode === 'desktop-sidebar';

  return (
    <motion.div
      key={`${mode}-${activeSheet}`}
      initial={isSidebar ? { opacity: 0, x: 18 } : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={isSidebar ? { opacity: 0, x: 18 } : { opacity: 0, y: 14 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className={
        isSidebar
          ? 'h-full w-[380px] xl:w-[410px] shrink-0 bg-[#101014] border-l border-[#1E1E26] flex flex-col overflow-hidden'
          : `border-b border-[#24242C] bg-[#131318] px-3 sm:px-4 py-3 overflow-y-auto transition-[max-height] duration-200 ${
              isExpandedMobile ? 'max-h-[54vh]' : 'max-h-[300px]'
            }`
      }
    >
      <div className={isSidebar ? 'flex-1 overflow-y-auto px-4 py-3.5 space-y-3.5' : 'max-w-4xl mx-auto space-y-3'}>
        {/* Inspector Header */}
        <div className="flex items-center justify-between gap-2 sticky top-0 z-10 bg-inherit pb-1">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#A1A1AE]">
            {activeSheet === 'audio-hub' && 'Audio & Soundboards'}
            {activeSheet === 'speed' && 'Velocity Speed Curve'}
            {activeSheet === 'chroma' && 'Chroma Key Matte'}
            {activeSheet === 'motion' && 'Motion & Keyframe Transform'}
            {activeSheet === 'crop' && 'Crop & Framing'}
            {activeSheet === 'text' && 'Creator Text Studio'}
            {activeSheet === 'fonts' && 'Fonts, Google & DaFont .ZIP'}
            {activeSheet === 'text-anim' && 'Animate.css Motion'}
            {activeSheet === 'effects' && `WebGL FX (${VIDEO_EFFECTS.length - 1} Shaders)`}
            {activeSheet === 'transition' &&
              `gl-transitions (${CLIP_TRANSITIONS.length - 1} Shaders)`}
            {activeSheet === 'intro-outro' && 'Intro & Outro Templates'}
            {activeSheet === 'ratio' && 'Canvas Aspect Ratio'}
          </h3>

          <div className="flex items-center gap-1.5">
            {activeSheet === 'effects' && selectedClip && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={() => onPreviewSegment(selectedClip.startSec)}
                className="px-2.5 py-1 rounded-md bg-[#00CAE0] text-black text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Play className="w-3 h-3 fill-black" />
                <span>Replay</span>
              </motion.button>
            )}
            {activeSheet === 'transition' && selectedClip && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={() => onPreviewSegment(Math.max(0, selectedClip.startSec - 0.15))}
                className="px-2.5 py-1 rounded-md bg-[#00CAE0] text-black text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Play className="w-3 h-3 fill-black" />
                <span>Replay Cut</span>
              </motion.button>
            )}
            {(activeSheet === 'text' || activeSheet === 'text-anim') && selectedClip && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={() => onPreviewSegment(selectedClip.startSec)}
                className="px-2.5 py-1 rounded-md bg-[#00CAE0] text-black text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Play className="w-3 h-3 fill-black" />
                <span>Replay</span>
              </motion.button>
            )}
            {!isSidebar && (
              <motion.button
                whileTap={{ scale: 0.85 }}
                type="button"
                onClick={() => setIsExpandedMobile((v) => !v)}
                aria-label={isExpandedMobile ? 'Compact drawer' : 'Expand drawer'}
                title={isExpandedMobile ? 'Compact height' : 'Expand taller'}
                className="w-8 h-8 rounded-full bg-[#202028] hover:bg-[#2C2C36] text-[#A1A1AE] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <ChevronsUpDown className="w-3.5 h-3.5" />
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.85 }}
              type="button"
              onClick={() => onChangeSheet(null)}
              aria-label="Apply and close panel"
              className="w-8 h-8 rounded-full bg-[#24242C] hover:bg-[#32323D] text-white flex items-center justify-center cursor-pointer"
            >
              <Check className="w-4 h-4 text-[#00CAE0]" />
            </motion.button>
          </div>
        </div>

        {/* AUDIO HUB (100% In-App Search, Preview & Apply) */}
        {activeSheet === 'audio-hub' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-[#8E8E98] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={audioQuery}
                  onChange={(e) => setAudioQuery(e.target.value)}
                  placeholder="Search MyInstants, Phonk, Whoosh..."
                  className="w-full pl-8 pr-3 py-1.5 bg-[#0C0C10] border border-[#24242E] focus:border-[#00CAE0] rounded-lg text-xs text-white outline-none"
                />
              </div>
              <motion.button
                whileTap={{ scale: 0.93 }}
                type="button"
                onClick={onImportAudioClick}
                className="px-3 py-1.5 rounded-lg bg-[#1C1C24] hover:bg-[#262632] border border-[#2C2C38] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#00CAE0]" />
                <span>Device MP3</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.93 }}
                type="button"
                onClick={() => {
                  onChangeSheet(null);
                  onOpenMemeHub();
                }}
                className="px-3 py-1.5 rounded-lg bg-[#00CAE0] hover:brightness-110 text-black text-xs font-bold cursor-pointer"
              >
                Full Browser
              </motion.button>
            </div>

            {loadingAudio ? (
              <div className="py-4 flex items-center justify-center gap-2 text-xs text-[#8E8E98]">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00CAE0]" />
                <span>Searching online sounds...</span>
              </div>
            ) : onlineAudio.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {onlineAudio.map((item) => {
                  const playing = playingAudioId === item.id;
                  const downloading = downloadingAudioId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="px-2.5 py-1.5 rounded-lg bg-[#0C0C10] border border-[#22222C] flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (playing) {
                            audioPreviewRef.current?.pause();
                            setPlayingAudioId(null);
                            return;
                          }
                          audioPreviewRef.current?.pause();
                          const a = new Audio(item.previewUrl);
                          audioPreviewRef.current = a;
                          setPlayingAudioId(item.id);
                          a.onended = () => setPlayingAudioId(null);
                          a.onerror = () => setPlayingAudioId(null);
                          void a.play().catch(() => setPlayingAudioId(null));
                        }}
                        className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        {playing ? (
                          <Pause className="w-3.5 h-3.5 text-[#00CAE0] shrink-0" />
                        ) : (
                          <Play className="w-3.5 h-3.5 text-[#00CAE0] shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold text-white truncate">
                            {item.title}
                          </div>
                          <div className="text-[9px] font-mono text-[#7C7C88] truncate">
                            {item.source}
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        disabled={downloading}
                        onClick={async () => {
                          setDownloadingAudioId(item.id);
                          audioPreviewRef.current?.pause();
                          try {
                            await onImportOnlineMedia(
                              item.remoteUrl,
                              item.title,
                              'audio',
                              item.previewUrl,
                              false
                            );
                          } finally {
                            setDownloadingAudioId(null);
                          }
                        }}
                        className="px-2 py-1 rounded bg-[#00CAE0] text-black text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {downloading ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Plus className="w-3 h-3 stroke-[2.5]" />
                            <span>Add</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              {MEME_LIBRARY.map((sfx) => (
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  key={sfx.id}
                  type="button"
                  onClick={() => {
                    playMemeSfx(sfx.sfxId);
                    onAddSfxItem(sfx);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#0D1A1D] hover:bg-[#13292E] border border-[#1E3B42] text-xs text-[#00CAE0] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{sfx.title}</span>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* SPEED CURVE */}
        {activeSheet === 'speed' && selectedClip && (
          <SpeedCurveEditor
            clip={selectedClip}
            localTime={localTime}
            onUpdateSpeedRamp={onUpdateSpeedRamp}
          />
        )}

        {/* MASSIVE 44 WEBGL VIDEO EFFECTS BROWSER */}
        {activeSheet === 'effects' && selectedClip && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-[#8E8E98] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={fxQuery}
                  onChange={(e) => setFxQuery(e.target.value)}
                  placeholder="Search 44 GPU effects (Glitch, Kaleido, LUT, Bloom)..."
                  className="w-full pl-8 pr-3 py-1.5 bg-[#0C0C10] border border-[#24242E] focus:border-[#00CAE0] rounded-lg text-xs text-white outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {EFFECT_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFxCategory(cat)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap cursor-pointer ${
                    fxCategory === cat
                      ? 'bg-[#00CAE0] text-black font-bold'
                      : 'bg-[#1A1A22] text-[#A1A1AE] hover:text-white border border-[#282832]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div
              className={`grid gap-2 ${
                isSidebar ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-5 md:grid-cols-6'
              }`}
            >
              {visibleEffects.map((fx) => {
                const active = (selectedClip.effect?.type || 'none') === fx.id;
                const hovered = hoveredFx === fx.id;
                return (
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    key={fx.id}
                    type="button"
                    onMouseEnter={() => setHoveredFx(fx.id)}
                    onMouseLeave={() => setHoveredFx(null)}
                    onClick={() => {
                      onUpdateEffect(fx.id, selectedClip.effect?.intensity ?? 75);
                      onPreviewSegment(selectedClip.startSec);
                    }}
                    className={`p-1.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#0F2A30] border-[#00CAE0] ring-1 ring-[#00CAE0]'
                        : 'bg-[#191921] border-[#2A2A34] hover:border-[#3A3A48]'
                    }`}
                  >
                    <EffectVisualThumb type={fx.id} animate={active || hovered} />
                    <div className="mt-1.5 px-0.5">
                      <div className="text-[11px] font-semibold text-white truncate">{fx.label}</div>
                      <div className="text-[9px] text-[#8E8E98] truncate">{fx.desc}</div>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {selectedClip.effect && selectedClip.effect.type !== 'none' && (
              <label className="block space-y-1 pt-1">
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
                    onUpdateEffect(selectedClip.effect!.type, parseInt(e.target.value, 10))
                  }
                  className="w-full tg7-slider"
                />
              </label>
            )}
          </div>
        )}

        {/* MASSIVE 225 GITHUB GLSL TRANSITIONS BROWSER */}
        {activeSheet === 'transition' && selectedClip && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-[#8E8E98] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={transQuery}
                  onChange={(e) => setTransQuery(e.target.value)}
                  placeholder={`Search ${CLIP_TRANSITIONS.length - 1} GitHub GLSL shaders...`}
                  className="w-full pl-8 pr-3 py-1.5 bg-[#0C0C10] border border-[#24242E] focus:border-[#00CAE0] rounded-lg text-xs text-white outline-none"
                />
              </div>
              {!transQuery.trim() && transCategory === 'All' && (
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  type="button"
                  onClick={() => setShowAllGlTrans((v) => !v)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#1C1C24] border border-[#2C2C38] text-[11px] font-semibold text-[#00CAE0] cursor-pointer whitespace-nowrap"
                >
                  {showAllGlTrans ? 'Top 30' : `All (${CLIP_TRANSITIONS.length - 1})`}
                </motion.button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {TRANSITION_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setTransCategory(cat)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap cursor-pointer ${
                    transCategory === cat
                      ? 'bg-[#00CAE0] text-black font-bold'
                      : 'bg-[#1A1A22] text-[#A1A1AE] hover:text-white border border-[#282832]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div
              className={`grid gap-2 ${
                isSidebar ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-5 md:grid-cols-6'
              }`}
            >
              {visibleTransitions.map((tr) => {
                const active = (selectedClip.transitionIn?.type || 'none') === tr.id;
                const hovered = hoveredTrans === tr.id;
                return (
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    key={tr.id}
                    type="button"
                    onMouseEnter={() => setHoveredTrans(String(tr.id))}
                    onMouseLeave={() => setHoveredTrans(null)}
                    onClick={() => {
                      onUpdateTransition(tr.id, selectedClip.transitionIn?.durationSec ?? 0.5);
                      onPreviewSegment(Math.max(0, selectedClip.startSec - 0.15));
                    }}
                    className={`p-1.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#0F2A30] border-[#00CAE0] ring-1 ring-[#00CAE0]'
                        : 'bg-[#191921] border-[#2A2A34] hover:border-[#3A3A48]'
                    }`}
                  >
                    <TransitionVisualThumb type={tr.id} animate={active || hovered} />
                    <div className="mt-1.5 px-0.5 text-[11px] font-semibold text-white truncate">
                      {tr.label}
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <div className="flex items-end gap-2.5 pt-1">
              <label className="flex-1 block space-y-1">
                <div className="flex justify-between text-[11px] text-[#A1A1AE]">
                  <span>Transition Duration</span>
                  <span className="font-mono">
                    {(selectedClip.transitionIn?.durationSec ?? 0.5).toFixed(2)}s
                  </span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={1.5}
                  step={0.05}
                  value={selectedClip.transitionIn?.durationSec ?? 0.5}
                  onChange={(e) =>
                    onUpdateTransition(
                      selectedClip.transitionIn?.type ?? 'CrossZoom',
                      parseFloat(e.target.value)
                    )
                  }
                  className="w-full tg7-slider"
                />
              </label>
              <motion.button
                whileTap={{ scale: 0.92 }}
                type="button"
                onClick={() =>
                  onApplyTransitionToAll(
                    selectedClip.transitionIn?.type ?? 'CrossZoom',
                    selectedClip.transitionIn?.durationSec ?? 0.5
                  )
                }
                className="px-3 py-1.5 rounded-lg bg-[#24242C] hover:bg-[#32323E] text-[11px] font-semibold text-[#00CAE0] whitespace-nowrap cursor-pointer"
              >
                Apply to All Cuts
              </motion.button>
            </div>
          </div>
        )}

        {/* CROP */}
        {activeSheet === 'crop' && selectedClip && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.92 }}
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
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
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
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
                type="button"
                onClick={() =>
                  onUpdateCrop({ top: 0, bottom: 0, left: 0, right: 0, fitMode: 'contain' })
                }
                className="px-3 py-1.5 rounded-lg bg-[#24242C] hover:bg-[#32323D] text-xs text-white cursor-pointer"
              >
                Reset
              </motion.button>
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

        {/* TEXT ANIMATION */}
        {activeSheet === 'text-anim' && selectedClip && (
          <div className="flex flex-wrap items-center gap-2">
            {TEXT_ANIMATIONS.map((anim) => {
              const active = (selectedClip.textAnimation || 'none') === anim.id;
              return (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  key={anim.id}
                  type="button"
                  onClick={() => {
                    onUpdateTextAnimation(anim.id);
                    onPreviewSegment(selectedClip.startSec);
                  }}
                  className={`px-3.5 py-2 rounded-lg border text-xs font-medium whitespace-nowrap cursor-pointer ${
                    active
                      ? `bg-[#00CAE0] border-[#00CAE0] text-black font-bold animate__animated ${anim.animateClass}`
                      : 'bg-[#1C1C24] border-[#2C2C34] text-white hover:border-[#3A3A46]'
                  }`}
                >
                  {anim.label}
                </motion.button>
              );
            })}
          </div>
        )}

        {/* FONTS */}
        {activeSheet === 'fonts' && selectedClip && (
          <FontManagerSheet
            currentFont={selectedClip.fontFamily || 'Outfit'}
            customFonts={customFonts}
            onSelectFont={onUpdateFont}
            onAddCustomFont={onAddCustomFont}
          />
        )}

        {/* INTRO OUTRO */}
        {activeSheet === 'intro-outro' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {INTRO_OUTRO_TEMPLATES.map((tpl) => (
              <motion.button
                whileTap={{ scale: 0.94 }}
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
              </motion.button>
            ))}
          </div>
        )}

        {/* CHROMA KEY */}
        {activeSheet === 'chroma' && selectedClip && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#F5F5F7]">Remove Backdrop Color</span>
              <motion.button
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={() => onUpdateChromaKey({ enabled: !selectedClip.chromaKey.enabled })}
                className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                  selectedClip.chromaKey.enabled
                    ? 'bg-[#00CAE0] text-black'
                    : 'bg-[#24242C] text-[#A1A1AE]'
                }`}
              >
                {selectedClip.chromaKey.enabled ? 'Enabled' : 'Off'}
              </motion.button>
            </div>

            <div className="flex items-center gap-2">
              {CHROMA_SWATCHES.map((sw) => (
                <motion.button
                  whileTap={{ scale: 0.92 }}
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
                </motion.button>
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
                  <span>Feather</span>
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

        {/* MOTION & TRANSFORM */}
        {activeSheet === 'motion' && selectedClip && (
          <div className="space-y-3">
            {selectedClip.sourceType === 'svg-sticker' && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#8E8E98]">SVG Color:</span>
                {TEXT_COLORS.map((hex) => (
                  <motion.button
                    whileTap={{ scale: 0.85 }}
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
                  onChange={(e) => onUpdateTransform({ rotation: parseFloat(e.target.value) })}
                  className="w-full tg7-slider"
                />
              </label>

              <label className="space-y-1 block">
                <div className="flex justify-between text-[11px] text-[#A1A1AE]">
                  <span>Opacity</span>
                  <span className="font-mono">{Math.round(currentTransform.opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={currentTransform.opacity}
                  onChange={(e) => onUpdateTransform({ opacity: parseFloat(e.target.value) })}
                  className="w-full tg7-slider"
                />
              </label>

              <div className="flex items-end">
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  type="button"
                  onClick={() =>
                    onUpdateTransform({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 })
                  }
                  className="w-full py-1.5 bg-[#24242C] hover:bg-[#30303B] rounded text-xs text-white cursor-pointer"
                >
                  Reset Position
                </motion.button>
              </div>
            </div>
          </div>
        )}

        {/* FULL CREATOR TYPOGRAPHY STUDIO */}
        {activeSheet === 'text' && selectedClip && (
          <div className="space-y-3">
            {/* Multi-line Editable Textarea + AA Uppercase */}
            <div className="flex items-start gap-2">
              <textarea
                ref={textAreaRef}
                rows={2}
                value={selectedClip.textContent || ''}
                onChange={(e) =>
                  onUpdateText(e.target.value, selectedClip.textColor || '#FFFFFF')
                }
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') onChangeSheet(null);
                }}
                placeholder="Write caption (multi-line supported)..."
                className="flex-1 px-3 py-2 bg-[#0B0B0D] border border-[#00CAE0]/60 focus:border-[#00CAE0] rounded-lg text-sm text-white outline-none resize-none leading-snug"
              />
              <button
                type="button"
                title="Toggle UPPERCASE"
                onClick={() => onUpdateTextProps({ textUppercase: !selectedClip.textUppercase })}
                className={`px-2.5 py-2 rounded-lg text-xs font-extrabold border cursor-pointer ${
                  selectedClip.textUppercase
                    ? 'bg-[#00CAE0] border-[#00CAE0] text-black'
                    : 'bg-[#1A1A22] border-[#2C2C36] text-[#A1A1AE]'
                }`}
              >
                AA
              </button>
            </div>

            {/* 1-Tap MrBeast / Viral Creator Recipes */}
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#8E8E98]">
                <Sparkles className="w-3 h-3 text-[#FFE600]" />
                <span>Creator Recipes</span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {CREATOR_TEXT_RECIPES.map((recipe) => (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => {
                      const fontMeta = GOOGLE_FONT_CATALOG.find(
                        (f) => f.name === recipe.fontFamily
                      );
                      if (fontMeta) void loadGoogleFont(fontMeta);
                      onUpdateTextProps({
                        fontFamily: recipe.fontFamily,
                        ...recipe.patch,
                      });
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-[#1A1A22] hover:bg-[#23232E] border border-[#2C2C38] text-[11px] font-bold whitespace-nowrap cursor-pointer flex items-center gap-1.5"
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${recipe.previewColor1}, ${recipe.previewColor2})`,
                      }}
                    />
                    <span className="text-white">{recipe.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Fill Mode: Solid vs 2-Color Linear Gradient */}
            <div className="p-2.5 rounded-xl bg-[#0C0C10] border border-[#22222C] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-[#D4D4DD]">Fill Color</span>
                <div className="flex items-center rounded-md bg-[#181820] p-0.5 border border-[#282834]">
                  <button
                    type="button"
                    onClick={() => onUpdateTextProps({ textGradientEnabled: false })}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                      !selectedClip.textGradientEnabled
                        ? 'bg-[#00CAE0] text-black'
                        : 'text-[#9A9AA8]'
                    }`}
                  >
                    Solid
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateTextProps({
                        textGradientEnabled: true,
                        textGradientColor1: selectedClip.textGradientColor1 || '#FFE600',
                        textGradientColor2: selectedClip.textGradientColor2 || '#FF7A00',
                      })
                    }
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                      selectedClip.textGradientEnabled
                        ? 'bg-[#00CAE0] text-black'
                        : 'text-[#9A9AA8]'
                    }`}
                  >
                    Gradient
                  </button>
                </div>
              </div>

              {!selectedClip.textGradientEnabled ? (
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {TEXT_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() =>
                        onUpdateTextProps({
                          textColor: hex,
                          textGradientEnabled: false,
                        })
                      }
                      className={`w-6 h-6 rounded-full border shrink-0 cursor-pointer ${
                        (selectedClip.textColor || '#FFFFFF').toUpperCase() === hex
                          ? 'border-white scale-110 ring-2 ring-[#00CAE0]/50'
                          : 'border-white/20'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                  <input
                    type="color"
                    value={selectedClip.textColor || '#FFFFFF'}
                    onChange={(e) => onUpdateTextProps({ textColor: e.target.value })}
                    className="w-7 h-6 rounded bg-transparent border border-[#2C2C34] cursor-pointer ml-auto"
                    title="Custom Fill Color"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="flex items-center gap-1.5 text-[10px] text-[#A1A1AE]">
                    <span>C1</span>
                    <input
                      type="color"
                      value={selectedClip.textGradientColor1 || '#FFE600'}
                      onChange={(e) => onUpdateTextProps({ textGradientColor1: e.target.value })}
                      className="w-7 h-6 rounded bg-transparent border border-[#2C2C34] cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-[10px] text-[#A1A1AE]">
                    <span>C2</span>
                    <input
                      type="color"
                      value={selectedClip.textGradientColor2 || '#FF7A00'}
                      onChange={(e) => onUpdateTextProps({ textGradientColor2: e.target.value })}
                      className="w-7 h-6 rounded bg-transparent border border-[#2C2C34] cursor-pointer"
                    />
                  </label>
                  <div className="flex items-center gap-1 ml-auto">
                    {[
                      { deg: 90, label: 'Vert' },
                      { deg: 0, label: 'Horiz' },
                      { deg: 45, label: 'Diag' },
                    ].map((ang) => (
                      <button
                        key={ang.deg}
                        type="button"
                        onClick={() => onUpdateTextProps({ textGradientAngle: ang.deg })}
                        className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${
                          (selectedClip.textGradientAngle ?? 90) === ang.deg
                            ? 'bg-[#262632] text-[#00CAE0] font-bold'
                            : 'bg-[#16161C] text-[#8E8E98]'
                        }`}
                      >
                        {ang.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Stroke & Drop Shadow Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-xl bg-[#0C0C10] border border-[#22222C] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#D4D4DD]">Stroke</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] text-[#8E8E98]">
                      {selectedClip.textStrokeWidth ?? 10}px
                    </span>
                    <input
                      type="color"
                      value={selectedClip.textStrokeColor || '#000000'}
                      onChange={(e) => onUpdateTextProps({ textStrokeColor: e.target.value })}
                      className="w-6 h-5 rounded bg-transparent border border-[#2C2C34] cursor-pointer"
                    />
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={24}
                  value={selectedClip.textStrokeWidth ?? 10}
                  onChange={(e) =>
                    onUpdateTextProps({ textStrokeWidth: parseInt(e.target.value, 10) })
                  }
                  className="w-full tg7-slider"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-[#0C0C10] border border-[#22222C] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#D4D4DD]">Shadow / Glow</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] text-[#8E8E98]">
                      {selectedClip.textShadowBlur ?? 12}
                    </span>
                    <input
                      type="color"
                      value={
                        selectedClip.textShadowColor?.startsWith('#')
                          ? selectedClip.textShadowColor
                          : '#000000'
                      }
                      onChange={(e) => onUpdateTextProps({ textShadowColor: e.target.value })}
                      className="w-6 h-5 rounded bg-transparent border border-[#2C2C34] cursor-pointer"
                    />
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={40}
                  value={selectedClip.textShadowBlur ?? 12}
                  onChange={(e) =>
                    onUpdateTextProps({ textShadowBlur: parseInt(e.target.value, 10) })
                  }
                  className="w-full tg7-slider"
                />
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <label className="flex items-center gap-1 text-[9px] text-[#8E8E98]">
                    <span>X</span>
                    <input
                      type="range"
                      min={-16}
                      max={16}
                      value={selectedClip.textShadowOffsetX ?? 0}
                      onChange={(e) =>
                        onUpdateTextProps({ textShadowOffsetX: parseInt(e.target.value, 10) })
                      }
                      className="w-full tg7-slider"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-[9px] text-[#8E8E98]">
                    <span>Y</span>
                    <input
                      type="range"
                      min={-16}
                      max={16}
                      value={selectedClip.textShadowOffsetY ?? 4}
                      onChange={(e) =>
                        onUpdateTextProps({ textShadowOffsetY: parseInt(e.target.value, 10) })
                      }
                      className="w-full tg7-slider"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Caption Background Box & Spacing */}
            <div className="p-2.5 rounded-xl bg-[#0C0C10] border border-[#22222C] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-[#D4D4DD]">Caption Box</span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateTextProps({ textBgEnabled: !selectedClip.textBgEnabled })
                    }
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                      selectedClip.textBgEnabled
                        ? 'bg-[#00CAE0] text-black'
                        : 'bg-[#181820] text-[#8E8E98]'
                    }`}
                  >
                    {selectedClip.textBgEnabled ? 'On' : 'Off'}
                  </button>
                </div>
                {selectedClip.textBgEnabled && (
                  <input
                    type="color"
                    value={selectedClip.textBgColor || '#0B0B10'}
                    onChange={(e) => onUpdateTextProps({ textBgColor: e.target.value })}
                    className="w-6 h-5 rounded bg-transparent border border-[#2C2C34] cursor-pointer"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#A1A1AE] shrink-0">Size</span>
                  <input
                    type="range"
                    min={24}
                    max={148}
                    value={selectedClip.fontSize || 74}
                    onChange={(e) =>
                      onUpdateTextStyle(
                        selectedClip.textStyle || 'outline',
                        parseInt(e.target.value, 10)
                      )
                    }
                    className="w-full tg7-slider"
                  />
                  <span className="text-[10px] font-mono w-6 text-right">
                    {selectedClip.fontSize || 74}
                  </span>
                </label>
                <label className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#A1A1AE] shrink-0">Track</span>
                  <input
                    type="range"
                    min={-2}
                    max={14}
                    value={selectedClip.textLetterSpacing ?? 0}
                    onChange={(e) =>
                      onUpdateTextProps({ textLetterSpacing: parseInt(e.target.value, 10) })
                    }
                    className="w-full tg7-slider"
                  />
                  <span className="text-[10px] font-mono w-5 text-right">
                    {selectedClip.textLetterSpacing ?? 0}
                  </span>
                </label>
              </div>
            </div>

            {/* Style Presets & Quick Links */}
            <div className="grid grid-cols-3 gap-1.5">
              {TEXT_STYLE_PRESETS.map((st) => {
                const active = (selectedClip.textStyle || 'outline') === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => onUpdateTextStyle(st.id, selectedClip.fontSize)}
                    className={`px-2 py-1.5 rounded-lg border text-center cursor-pointer text-[11px] truncate ${
                      active
                        ? 'bg-[#00CAE0] border-[#00CAE0] text-black font-bold'
                        : 'bg-[#1A1A22] border-[#2C2C36] text-white'
                    }`}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.92 }}
                type="button"
                onClick={() => onChangeSheet('fonts')}
                className="flex-1 px-3 py-1.5 rounded-lg bg-[#1C1C24] border border-[#2C2C36] text-xs text-[#00CAE0] cursor-pointer truncate"
              >
                Font: {selectedClip.fontFamily || 'Outfit'}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
                type="button"
                onClick={() => onChangeSheet('text-anim')}
                className="flex-1 px-3 py-1.5 rounded-lg bg-[#1C1C24] border border-[#2C2C36] text-xs text-white cursor-pointer truncate"
              >
                Anim: {selectedClip.textAnimation || 'none'}
              </motion.button>
            </div>
          </div>
        )}

        {/* RATIO */}
        {activeSheet === 'ratio' && (
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: '9:16', label: '9:16 Reels' },
                { id: '16:9', label: '16:9 YouTube' },
                { id: '1:1', label: '1:1 Square' },
              ] as { id: AspectRatio; label: string }[]
            ).map((item) => (
              <motion.button
                whileTap={{ scale: 0.92 }}
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
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function CapCutBottomDock(props: CapCutBottomDockProps) {
  const {
    selectedClip,
    activeSheet,
    onChangeSheet,
    onOpenSmartFx,
    onDeselectClip,
    onOpenMediaPicker,
    onOpenMemes,
    onOpenSvgStickers,
    onImportAudio,
    onAddTextClip,
    onSplit,
    onToggleKeyframe,
    onDuplicate,
    onDelete,
    showInlineSheetOnDesktop = false,
  } = props;

  const audioFileRef = useRef<HTMLInputElement | null>(null);

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

      {/* On mobile (< lg), sheet renders cleanly above bottom tool dock; on desktop (lg:) it renders in Right Inspector Pane */}
      <div className={showInlineSheetOnDesktop ? 'block' : 'lg:hidden'}>
        <AnimatePresence mode="wait">
          {activeSheet && (
            <StudioToolInspector
              {...props}
              mode="mobile-sheet"
              onImportAudioClick={() => audioFileRef.current?.click()}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Main CapCut Bottom Tool Dock */}
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
              onClick={() => onChangeSheet(activeSheet === 'audio-hub' ? null : 'audio-hub')}
            />
            <DockToolButton icon={<SvgTextIcon />} label="Text" onClick={onAddTextClip} />
            <DockToolButton icon={<SvgStickerIcon />} label="SVG" onClick={onOpenSvgStickers} />
            <DockToolButton
              icon={<SvgEffectsIcon />}
              label="Effects"
              active={activeSheet === 'effects'}
              onClick={() => onOpenSmartFx('effects')}
            />
            <DockToolButton
              icon={<SvgTransitionIcon />}
              label="Transition"
              active={activeSheet === 'transition'}
              onClick={() => onOpenSmartFx('transition')}
            />
            <DockToolButton
              icon={<SvgLayerIcon />}
              label="Overlay"
              onClick={() => onOpenMediaPicker('overlay')}
            />
            <DockToolButton icon={<SvgMemeIcon />} label="Memes" onClick={onOpenMemes} />
            <DockToolButton
              icon={<SvgIntroIcon />}
              label="Intro/Outro"
              active={activeSheet === 'intro-outro'}
              onClick={() => onChangeSheet(activeSheet === 'intro-outro' ? null : 'intro-outro')}
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
            <motion.button
              whileTap={{ scale: 0.88 }}
              type="button"
              onClick={() => {
                onChangeSheet(null);
                onDeselectClip();
              }}
              aria-label="Back to main tools"
              className="min-w-[44px] h-11 rounded-lg bg-[#1C1C22] hover:bg-[#26262E] flex items-center justify-center text-white shrink-0 cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </motion.button>

            <div className="flex items-center gap-1 flex-1 justify-around overflow-x-auto">
              <DockToolButton icon={<SvgScissorsIcon />} label="Split" onClick={onSplit} />
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
                onClick={() => onChangeSheet(activeSheet === 'transition' ? null : 'transition')}
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
                    label="Edit Text"
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
    <motion.button
      whileTap={{ scale: 0.88 }}
      transition={{ type: 'spring', stiffness: 500, damping: 24 }}
      type="button"
      onClick={onClick}
      className={`min-w-[54px] h-[52px] px-2 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors shrink-0 cursor-pointer ${
        active ? 'bg-[#1F1F27] text-[#00CAE0]' : 'text-[#E4E4EA] hover:bg-[#1A1A20]'
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium whitespace-nowrap">{label}</span>
    </motion.button>
  );
}
