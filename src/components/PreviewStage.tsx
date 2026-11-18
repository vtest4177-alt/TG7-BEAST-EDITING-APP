import { useEffect, useRef, useState } from 'react';
import { Diamond, Pause, Play, Plus, Redo2, Undo2 } from 'lucide-react';
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
  onAddKeyframe: () => void;
  onDragSelectedClip: (xPercent: number, yPercent: number) => void;
  onQuickImport: () => void;
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
  onAddKeyframe,
  onDragSelectedClip,
  onQuickImport,
}: PreviewStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastSeekTsRef = useRef<number>(0);
  const renderRafRef = useRef<number | null>(null);
  const latestRenderStateRef = useRef({ project, mediaElements, dims: ASPECT_DIMENSIONS[project.aspectRatio] });

  const dragOriginRef = useRef<{
    clientX: number;
    clientY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const [isDraggingStage, setIsDraggingStage] = useState(false);

  const totalDuration = getProjectDuration(project);
  const dims = ASPECT_DIMENSIONS[project.aspectRatio];
  const selectedClip = project.clips.find((c) => c.id === project.selectedClipId) ?? null;

  latestRenderStateRef.current = { project, mediaElements, dims };

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

  const aspectClass =
    project.aspectRatio === '16:9'
      ? 'aspect-video max-h-full w-auto max-w-full'
      : project.aspectRatio === '9:16'
        ? 'aspect-[9/16] h-full max-h-full w-auto'
        : 'aspect-square h-full max-h-full w-auto';

  return (
    <section
      aria-label="CapCut video preview"
      className="flex-1 min-h-[190px] flex flex-col bg-[#000000] overflow-hidden"
    >
      {/* Centered Black Preview Canvas */}
      <div className="flex-1 min-h-0 px-4 pt-2 pb-1 flex items-center justify-center overflow-hidden">
        <div
          className={`${aspectClass} relative bg-[#08080A] border border-[#1E1E24] overflow-hidden flex items-center justify-center`}
        >
          <canvas
            ref={canvasRef}
            width={dims.w}
            height={dims.h}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={endCanvasDrag}
            onPointerCancel={endCanvasDrag}
            className={`w-full h-full object-contain block ${
              isDraggingStage ? 'cursor-grabbing' : selectedClip ? 'cursor-grab' : ''
            }`}
          />

          {project.clips.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 bg-black/80">
              <button
                type="button"
                onClick={onQuickImport}
                className="px-4 py-2.5 min-h-[42px] bg-[#00CAE0] hover:brightness-110 text-black text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Video or Photo</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CapCut Floating Transport Bar */}
      <div className="h-11 px-4 flex items-center justify-between gap-4 shrink-0 border-b border-[#16161B]">
        <div className="text-[11px] font-mono tabular-nums text-[#8E8E98] whitespace-nowrap">
          <span className="text-white">{formatTimecode(project.playheadSec)}</span>
          <span className="mx-1">/</span>
          <span>{formatTimecode(totalDuration)}</span>
        </div>

        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={project.isPlaying ? 'Pause' : 'Play'}
          className="w-9 h-9 rounded-full bg-white hover:bg-[#E5E5EA] text-black flex items-center justify-center transition-colors cursor-pointer"
        >
          {project.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            aria-label="Undo"
            className="w-8 h-8 rounded flex items-center justify-center text-[#A1A1AE] hover:text-white disabled:opacity-30 cursor-pointer"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
            aria-label="Redo"
            className="w-8 h-8 rounded flex items-center justify-center text-[#A1A1AE] hover:text-white disabled:opacity-30 cursor-pointer"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!selectedClip}
            onClick={onAddKeyframe}
            aria-label="Add or update keyframe"
            title="Add Keyframe"
            className="w-8 h-8 rounded flex items-center justify-center text-[#FBBF24] hover:bg-[#1C1C22] disabled:opacity-30 cursor-pointer"
          >
            <Diamond className="w-4 h-4 fill-[#FBBF24]" />
          </button>
        </div>
      </div>
    </section>
  );
}
