import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Diamond,
  Maximize2,
  Minimize2,
  Pause,
  Pencil,
  Play,
  Plus,
  Redo2,
  Smartphone,
  Undo2,
} from 'lucide-react';
import {
  formatTimecode,
  getProjectDuration,
  interpolateTransform,
  renderCompositeFrame,
} from '../engine/compositor';
import { AspectRatio, ProjectState } from '../types/editor';

interface PreviewStageProps {
  project: ProjectState;
  mediaElements: Map<string, HTMLVideoElement | HTMLImageElement | HTMLAudioElement>;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onTogglePlay: () => void;
  onStepFrame?: (deltaFrames: number) => void;
  onAddKeyframe: () => void;
  onDragSelectedClip: (xPercent: number, yPercent: number) => void;
  onQuickImport: () => void;
  onOpenEditText?: () => void;
}

const ASPECT_DIMENSIONS: Record<AspectRatio, { w: number; h: number }> = {
  '16:9': { w: 1280, h: 720 },
  '9:16': { w: 720, h: 1280 },
  '1:1': { w: 960, h: 960 },
};

export function PreviewStage({
  project,
  mediaElements,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onTogglePlay,
  onStepFrame,
  onAddKeyframe,
  onDragSelectedClip,
  onQuickImport,
  onOpenEditText,
}: PreviewStageProps) {
  const stageSectionRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastSeekTsRef = useRef<number>(0);
  const renderRafRef = useRef<number | null>(null);
  const latestRenderStateRef = useRef({
    project,
    mediaElements,
    dims: ASPECT_DIMENSIONS[project.aspectRatio],
  });

  const dragOriginRef = useRef<{
    clientX: number;
    clientY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const [isDraggingStage, setIsDraggingStage] = useState(false);
  const [showSafeZone, setShowSafeZone] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const totalDuration = getProjectDuration(project);
  const dims = ASPECT_DIMENSIONS[project.aspectRatio];
  const selectedClip = project.clips.find((c) => c.id === project.selectedClipId) ?? null;

  latestRenderStateRef.current = { project, mediaElements, dims };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    const mainTrack = project.tracks.find((t) => t.type === 'video');
    const now = performance.now();
    const canSeekNow = now - lastSeekTsRef.current > 80;

    for (const clip of project.clips) {
      if (clip.sourceType === 'local-video') {
        const el = mediaElements.get(clip.id);
        if (el instanceof HTMLVideoElement) {
          const isVisible =
            project.playheadSec >= clip.startSec &&
            project.playheadSec <= clip.startSec + clip.durationSec;
          if (isVisible) {
            const targetLocal = Math.max(0, project.playheadSec - clip.startSec + clip.trimStartSec);
            if (!project.isPlaying) {
              if (!el.seeking && canSeekNow && Math.abs(el.currentTime - targetLocal) > 0.1) {
                el.currentTime = targetLocal;
                lastSeekTsRef.current = now;
              }
            } else if (el.paused) {
              if (!el.seeking) el.currentTime = targetLocal;
              void el.play().catch(() => undefined);
            }
          } else if (!el.paused) {
            el.pause();
          }
          el.muted = mainTrack ? mainTrack.muted : false;
        }
      } else if (clip.sourceType === 'local-audio') {
        const el = mediaElements.get(clip.id);
        if (el instanceof HTMLAudioElement) {
          const track = project.tracks.find((t) => t.id === clip.trackId);
          const isActive =
            project.isPlaying &&
            !track?.muted &&
            project.playheadSec >= clip.startSec &&
            project.playheadSec <= clip.startSec + clip.durationSec;
          if (isActive) {
            const targetLocal = Math.max(0, project.playheadSec - clip.startSec + clip.trimStartSec);
            if (el.paused) {
              el.currentTime = targetLocal;
              void el.play().catch(() => undefined);
            }
            el.volume = Math.max(0, Math.min(1, clip.volume));
          } else if (!el.paused) {
            el.pause();
          }
        }
      }
    }

    if (renderRafRef.current !== null) return;
    renderRafRef.current = requestAnimationFrame(() => {
      renderRafRef.current = null;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const { project: p, mediaElements: media, dims: d } = latestRenderStateRef.current;
      renderCompositeFrame(ctx, d.w, d.h, p, media, p.playheadSec);
    });
  }, [project, mediaElements, dims.w, dims.h]);

  useEffect(() => {
    return () => {
      if (renderRafRef.current !== null) {
        cancelAnimationFrame(renderRafRef.current);
      }
    };
  }, []);

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (
      !selectedClip ||
      selectedClip.sourceType === 'local-audio' ||
      selectedClip.sourceType === 'demo-audio' ||
      selectedClip.sourceType === 'meme-sfx'
    ) {
      return;
    }
    const localTime = Math.max(
      0,
      Math.min(selectedClip.durationSec, project.playheadSec - selectedClip.startSec)
    );
    const current = interpolateTransform(selectedClip, localTime);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragOriginRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      origX: current.x,
      origY: current.y,
    };
    setIsDraggingStage(true);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragOriginRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dxPct = ((e.clientX - dragOriginRef.current.clientX) / rect.width) * 100;
    const dyPct = ((e.clientY - dragOriginRef.current.clientY) / rect.height) * 100;
    onDragSelectedClip(
      Math.round(Math.max(-80, Math.min(80, dragOriginRef.current.origX + dxPct))),
      Math.round(Math.max(-80, Math.min(80, dragOriginRef.current.origY + dyPct)))
    );
  };

  const endCanvasDrag = () => {
    dragOriginRef.current = null;
    setIsDraggingStage(false);
  };

  const toggleFullscreen = async () => {
    const el = stageSectionRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // ignore if browser blocks fullscreen inside iframe
    }
  };

  const aspectClass =
    project.aspectRatio === '16:9'
      ? 'aspect-video max-h-full w-auto max-w-full'
      : project.aspectRatio === '9:16'
        ? 'aspect-[9/16] h-full max-h-full w-auto'
        : 'aspect-square h-full max-h-full w-auto';

  return (
    <section
      ref={stageSectionRef}
      aria-label="TG7 video monitor"
      className="h-[36vh] min-h-[195px] max-h-[380px] lg:h-full lg:max-h-none lg:flex-1 shrink-0 flex flex-col bg-[#000000] overflow-hidden"
    >
      <div className="flex-1 min-h-0 px-3 sm:px-5 pt-2 pb-1 flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,_rgba(0,202,224,0.06)_0%,_rgba(0,0,0,1)_72%)]">
        <div
          className={`${aspectClass} relative bg-[#08080A] border border-[#1E1E24] rounded-md overflow-hidden flex items-center justify-center shadow-[0_12px_40px_rgba(0,0,0,0.8)]`}
        >
          <canvas
            ref={canvasRef}
            width={dims.w}
            height={dims.h}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={endCanvasDrag}
            onPointerCancel={endCanvasDrag}
            onDoubleClick={() => {
              if (selectedClip?.sourceType === 'demo-text' && onOpenEditText) {
                onOpenEditText();
              }
            }}
            className={`w-full h-full object-contain block ${
              isDraggingStage ? 'cursor-grabbing' : selectedClip ? 'cursor-grab' : ''
            }`}
          />

          {/* Reels / Shorts 9:16 Safe Zone Guide */}
          {showSafeZone && (
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none"
            >
              <div className="absolute inset-x-[6%] top-[10%] bottom-[22%] border border-dashed border-[#00CAE0]/70 rounded-md">
                <span className="absolute top-1 left-1.5 text-[9px] font-mono uppercase tracking-wider text-[#00CAE0] bg-black/75 px-1 rounded">
                  Reels / Shorts Safe Area
                </span>
              </div>
              <div className="absolute right-[4%] bottom-[22%] w-8 h-32 border border-dashed border-[#F59E0B]/55 rounded" />
            </div>
          )}

          {/* Stage Quick Actions when Text Clip Selected */}
          {selectedClip?.sourceType === 'demo-text' && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
              <motion.button
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={() => onDragSelectedClip(0, 0)}
                title="Center text on screen"
                className="px-2 py-1 rounded-md bg-black/80 hover:bg-black border border-white/20 text-[11px] font-medium text-[#E4E4EA] flex items-center gap-1 shadow-lg cursor-pointer"
              >
                <Crosshair className="w-3 h-3 text-[#00CAE0]" />
                <span>Center</span>
              </motion.button>
              {onOpenEditText && (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={onOpenEditText}
                  className="px-2.5 py-1 rounded-md bg-black/85 hover:bg-black border border-[#00CAE0]/70 text-[11px] font-semibold text-[#00CAE0] flex items-center gap-1 shadow-lg cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit Text</span>
                </motion.button>
              )}
            </div>
          )}

          {project.clips.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 bg-black/80">
              <motion.button
                whileTap={{ scale: 0.92 }}
                type="button"
                onClick={onQuickImport}
                className="px-4 py-2.5 min-h-[42px] bg-[#00CAE0] hover:brightness-110 text-black text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Video or Photo</span>
              </motion.button>
            </div>
          )}
        </div>
      </div>

      {/* Creator Transport & Monitor Controls Bar */}
      <div className="h-11 px-3 sm:px-4 flex items-center justify-between gap-2 shrink-0 border-b border-[#16161B] bg-[#070709]">
        <div className="text-[11px] font-mono tabular-nums text-[#8E8E98] whitespace-nowrap">
          <span className="text-white">{formatTimecode(project.playheadSec)}</span>
          <span className="mx-1">/</span>
          <span>{formatTimecode(totalDuration)}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {onStepFrame && (
            <motion.button
              whileTap={{ scale: 0.85 }}
              type="button"
              onClick={() => onStepFrame(-1)}
              title="Previous frame (-1f)"
              aria-label="Step back 1 frame"
              className="w-7 h-7 rounded-md bg-[#131318] hover:bg-[#1E1E26] text-[#A1A1AE] hover:text-white flex items-center justify-center cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </motion.button>
          )}

          <motion.button
            whileTap={{ scale: 0.86 }}
            type="button"
            onClick={onTogglePlay}
            aria-label={project.isPlaying ? 'Pause' : 'Play'}
            className="w-9 h-9 rounded-full bg-white hover:bg-[#E5E5EA] text-black flex items-center justify-center transition-colors cursor-pointer"
          >
            {project.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </motion.button>

          {onStepFrame && (
            <motion.button
              whileTap={{ scale: 0.85 }}
              type="button"
              onClick={() => onStepFrame(1)}
              title="Next frame (+1f)"
              aria-label="Step forward 1 frame"
              className="w-7 h-7 rounded-md bg-[#131318] hover:bg-[#1E1E26] text-[#A1A1AE] hover:text-white flex items-center justify-center cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </motion.button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <motion.button
            whileTap={{ scale: 0.85 }}
            type="button"
            onClick={() => setShowSafeZone((v) => !v)}
            title="Toggle Reels/Shorts Safe Zone Guide"
            aria-label="Toggle safe zones"
            className={`w-8 h-8 rounded flex items-center justify-center cursor-pointer ${
              showSafeZone ? 'bg-[#0F2A30] text-[#00CAE0]' : 'text-[#A1A1AE] hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.85 }}
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            aria-label="Undo"
            className="w-8 h-8 rounded flex items-center justify-center text-[#A1A1AE] hover:text-white disabled:opacity-30 cursor-pointer"
          >
            <Undo2 className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.85 }}
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
            aria-label="Redo"
            className="w-8 h-8 rounded flex items-center justify-center text-[#A1A1AE] hover:text-white disabled:opacity-30 cursor-pointer"
          >
            <Redo2 className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.85 }}
            type="button"
            disabled={!selectedClip}
            onClick={onAddKeyframe}
            aria-label="Add or update keyframe"
            title="Add Keyframe"
            className="w-8 h-8 rounded flex items-center justify-center text-[#FBBF24] hover:bg-[#1C1C22] disabled:opacity-30 cursor-pointer"
          >
            <Diamond className="w-4 h-4 fill-[#FBBF24]" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.85 }}
            type="button"
            onClick={() => void toggleFullscreen()}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen preview'}
            title="Fullscreen Preview"
            className="hidden sm:flex w-8 h-8 rounded items-center justify-center text-[#A1A1AE] hover:text-white cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </motion.button>
        </div>
      </div>
    </section>
  );
}
