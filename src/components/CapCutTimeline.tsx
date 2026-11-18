import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Diamond,
  Music,
  Plus,
  SkipBack,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { getProjectDuration } from '../engine/compositor';
import { Clip, ProjectState } from '../types/editor';

export type TimelineDragMode = 'scroll-timeline' | 'move-clip' | 'trim-left' | 'trim-right';

interface CapCutTimelineProps {
  project: ProjectState;
  onSeek: (sec: number) => void;
  onSelectClip: (clipId: string | null) => void;
  onOpenTransition: (clipId: string) => void;
  onMoveOrTrimClip: (
    clipId: string,
    startSec: number,
    durationSec: number,
    trimStartSec: number,
    mode: TimelineDragMode
  ) => void;
  onFinishDrag?: (clipId?: string, mode?: TimelineDragMode) => void;
  onToggleMainMute: () => void;
  onOpenMainGallery: () => void;
  onOpenQuickAdd: (kind: 'audio' | 'overlay' | 'meme') => void;
  onChangeZoom: (zoom: number) => void;
}

interface ActiveDragSession {
  mode: TimelineDragMode;
  clipId?: string;
  startClientX: number;
  origPlayheadSec: number;
  origStartSec: number;
  origDurationSec: number;
  origTrimStartSec: number;
  allowNegativeExtend: boolean;
}

export function CapCutTimeline({
  project,
  onSeek,
  onSelectClip,
  onOpenTransition,
  onMoveOrTrimClip,
  onFinishDrag,
  onToggleMainMute,
  onOpenMainGallery,
  onOpenQuickAdd,
  onChangeZoom,
}: CapCutTimelineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(800);
  const [trimmingClipId, setTrimmingClipId] = useState<string | null>(null);

  const dragRef = useRef<ActiveDragSession | null>(null);
  const pendingClientXRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const playheadRef = useRef<number>(project.playheadSec);
  playheadRef.current = project.playheadSec;

  const pxPerSec = project.zoomPxPerSec;
  const totalDuration = Math.max(10, getProjectDuration(project));

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setViewportWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const halfWidth = viewportWidth / 2;
  const trackShiftX = halfWidth - project.playheadSec * pxPerSec;

  const mainTrack = project.tracks.find((t) => t.type === 'video') ?? project.tracks[0];
  const overlayTracks = useMemo(
    () =>
      project.tracks.filter(
        (t) => t.type === 'overlay' && project.clips.some((c) => c.trackId === t.id)
      ),
    [project.tracks, project.clips]
  );
  const audioTracks = useMemo(
    () =>
      project.tracks.filter(
        (t) => t.type === 'audio' && project.clips.some((c) => c.trackId === t.id)
      ),
    [project.tracks, project.clips]
  );

  const mainClips = useMemo(
    () =>
      project.clips
        .filter((c) => c.trackId === mainTrack.id)
        .sort((a, b) => a.startSec - b.startSec),
    [project.clips, mainTrack.id]
  );

  const mainEndSec =
    mainClips.length > 0
      ? Math.max(...mainClips.map((c) => c.startSec + c.durationSec))
      : 0;

  const snapPointsRef = useRef<number[]>([0]);
  snapPointsRef.current = useMemo(() => {
    const pts = [0, playheadRef.current];
    project.clips.forEach((c) => {
      pts.push(c.startSec, c.startSec + c.durationSec);
    });
    return pts;
  }, [project.clips]);

  const snapTime = (rawSec: number, ignoreStartEndOfClip?: ActiveDragSession): number => {
    for (const pt of snapPointsRef.current) {
      if (
        ignoreStartEndOfClip &&
        (Math.abs(pt - ignoreStartEndOfClip.origStartSec) < 0.001 ||
          Math.abs(pt - (ignoreStartEndOfClip.origStartSec + ignoreStartEndOfClip.origDurationSec)) <
            0.001)
      ) {
        continue;
      }
      if (Math.abs(rawSec - pt) < 0.12) return Math.round(pt * 100) / 100;
    }
    return Math.round(rawSec * 100) / 100;
  };

  const processDragFrame = () => {
    rafRef.current = null;
    const session = dragRef.current;
    const clientX = pendingClientXRef.current;
    if (!session || clientX === null) return;

    const dx = clientX - session.startClientX;

    if (session.mode === 'scroll-timeline') {
      const nextTime = Math.max(
        0,
        Math.min(totalDuration + 2, session.origPlayheadSec - dx / pxPerSec)
      );
      onSeek(nextTime);
      return;
    }

    if (!session.clipId) return;
    const deltaSec = dx / pxPerSec;

    if (session.mode === 'move-clip') {
      const nextStart = Math.max(0, snapTime(session.origStartSec + deltaSec, session));
      onMoveOrTrimClip(
        session.clipId,
        nextStart,
        session.origDurationSec,
        session.origTrimStartSec,
        'move-clip'
      );
    } else if (session.mode === 'trim-right') {
      const rawDur = Math.max(0.25, session.origDurationSec + deltaSec);
      const snappedEnd = snapTime(session.origStartSec + rawDur, session);
      const nextDur = Math.max(0.25, snappedEnd - session.origStartSec);
      onMoveOrTrimClip(
        session.clipId,
        session.origStartSec,
        Math.round(nextDur * 100) / 100,
        session.origTrimStartSec,
        'trim-right'
      );
    } else if (session.mode === 'trim-left') {
      const maxRightShift = session.origDurationSec - 0.25;
      const minLeftShift = session.allowNegativeExtend
        ? -session.origStartSec
        : Math.max(-session.origStartSec, -session.origTrimStartSec);
      const clampedDelta = Math.max(minLeftShift, Math.min(maxRightShift, deltaSec));
      const nextStart = Math.round((session.origStartSec + clampedDelta) * 100) / 100;
      const nextDur = Math.round((session.origDurationSec - clampedDelta) * 100) / 100;
      const nextTrimStart = Math.max(
        0,
        Math.round((session.origTrimStartSec + clampedDelta) * 100) / 100
      );
      onMoveOrTrimClip(session.clipId, nextStart, nextDur, nextTrimStart, 'trim-left');
    }
  };

  const beginDragSession = useCallback((pointerId: number, session: ActiveDragSession) => {
    dragRef.current = session;
    pendingClientXRef.current = session.startClientX;
    if (session.mode === 'trim-left' || session.mode === 'trim-right') {
      setTrimmingClipId(session.clipId ?? null);
    }
    try {
      containerRef.current?.setPointerCapture(pointerId);
    } catch {
      // ignore if pointer capture is unavailable
    }
  }, []);

  const handleSelectClipById = useCallback(
    (clipId: string) => {
      onSelectClip(clipId);
    },
    [onSelectClip]
  );

  const handleStartClipDrag = useCallback(
    (clip: Clip, mode: TimelineDragMode, clientX: number, pointerId: number) => {
      beginDragSession(pointerId, {
        mode,
        clipId: clip.id,
        startClientX: clientX,
        origPlayheadSec: playheadRef.current,
        origStartSec: clip.startSec,
        origDurationSec: clip.durationSec,
        origTrimStartSec: clip.trimStartSec,
        allowNegativeExtend:
          clip.sourceType !== 'local-video' && clip.sourceType !== 'local-audio',
      });
    },
    [beginDragSession]
  );

  const handleJumpToKeyframe = useCallback(
    (clipId: string, sec: number) => {
      onSelectClip(clipId);
      onSeek(sec);
    },
    [onSelectClip, onSeek]
  );

  const endDragSession = () => {
    const finished = dragRef.current;
    dragRef.current = null;
    pendingClientXRef.current = null;
    setTrimmingClipId(null);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (finished && onFinishDrag) {
      onFinishDrag(finished.clipId, finished.mode);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    pendingClientXRef.current = e.clientX;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(processDragFrame);
    }
  };

  const rulerSecCount = Math.ceil(totalDuration + 4);

  return (
    <section
      ref={containerRef}
      aria-label="CapCut scrolling timeline"
      onPointerDown={(e) => {
        onSelectClip(null);
        beginDragSession(e.pointerId, {
          mode: 'scroll-timeline',
          startClientX: e.clientX,
          origPlayheadSec: playheadRef.current,
          origStartSec: 0,
          origDurationSec: 0,
          origTrimStartSec: 0,
          allowNegativeExtend: true,
        });
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={endDragSession}
      onPointerCancel={endDragSession}
      className="flex-1 min-h-[235px] bg-[#0B0B0D] relative overflow-hidden select-none touch-none cursor-ew-resize flex flex-col"
    >
      {/* Fixed Left Controls: Jump to 00:00 & Main Audio Mute (Never Clipped) */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-1 left-2 z-50 flex items-center gap-1"
      >
        <button
          type="button"
          aria-label="Jump to start 00:00"
          title="Jump to 00:00"
          onClick={() => onSeek(0)}
          className="px-1.5 py-0.5 rounded bg-[#141418]/90 hover:bg-[#1E1E26] border border-[#24242C] text-[10px] font-mono text-[#00CAE0] flex items-center gap-1 cursor-pointer"
        >
          <SkipBack className="w-3 h-3" />
          <span>00:00</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMainMute();
          }}
          title={mainTrack.muted ? 'Unmute clip audio' : 'Mute clip audio'}
          className="px-2 py-0.5 rounded bg-[#141418]/90 hover:bg-[#1E1E26] border border-[#24242C] flex items-center gap-1 text-[10px] text-[#A1A1AE] hover:text-white cursor-pointer"
        >
          {mainTrack.muted ? (
            <VolumeX className="w-3 h-3 text-[#F59E0B]" />
          ) : (
            <Volume2 className="w-3 h-3" />
          )}
          <span className="hidden sm:inline">{mainTrack.muted ? 'Muted' : 'Audio'}</span>
        </button>
      </div>

      {/* Floating Zoom Buttons */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-1 right-2 z-50 flex items-center gap-1 bg-[#141418]/90 border border-[#24242C] rounded-md p-0.5"
      >
        <button
          type="button"
          aria-label="Zoom out timeline"
          onClick={() => onChangeZoom(Math.max(48, pxPerSec - 18))}
          className="p-1 text-[#A1A1AE] hover:text-white cursor-pointer"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          aria-label="Zoom in timeline"
          onClick={() => onChangeZoom(Math.min(220, pxPerSec + 18))}
          className="p-1 text-[#A1A1AE] hover:text-white cursor-pointer"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Moving Timeline Surface */}
      <div
        style={{ transform: `translate3d(${trackShiftX}px, 0, 0)` }}
        className="relative flex-1 flex flex-col will-change-transform"
      >
        <RulerTrack rulerSecCount={rulerSecCount} pxPerSec={pxPerSec} />

        {/* Persistent 00:00 Starting Line across all tracks */}
        <div
          aria-hidden="true"
          style={{ left: '0px' }}
          className="absolute top-6 bottom-0 w-[2px] bg-[#00CAE0]/75 pointer-events-none z-20"
        />

        {/* Tracks Container (no overflow-x clipping on 00:00 edge) */}
        <div className="flex-1 overflow-y-auto overflow-x-visible py-3 space-y-2.5 relative">

          {/* MAIN VIDEO TRACK */}
          <div className="h-[54px] relative">
            {mainClips.map((clip) => (
              <ClipStrip
                key={clip.id}
                clip={clip}
                pxPerSec={pxPerSec}
                isSelected={project.selectedClipId === clip.id}
                isTrimming={trimmingClipId === clip.id}
                variant="video"
                onSelectClip={handleSelectClipById}
                onStartDrag={handleStartClipDrag}
                onJumpToKeyframe={handleJumpToKeyframe}
              />
            ))}

            {/* CapCut Cut-Point Transition Buttons (z-40 above handles) */}
            {mainClips.map((clip, idx) => {
              if (idx === 0) return null;
              const prevClip = mainClips[idx - 1];
              const isAdjacent =
                Math.abs(clip.startSec - (prevClip.startSec + prevClip.durationSec)) < 0.35;
              if (!isAdjacent) return null;
              const hasTransition = clip.transitionIn && clip.transitionIn.type !== 'none';
              return (
                <button
                  key={`cut-${clip.id}`}
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenTransition(clip.id);
                  }}
                  title="Tap cut point to add transition"
                  aria-label="Edit cut transition"
                  style={{ left: `${clip.startSec * pxPerSec - 12}px` }}
                  className={`absolute top-1/2 -translate-y-1/2 w-[24px] h-[24px] rounded-md flex items-center justify-center z-40 border shadow-lg cursor-pointer transition-transform hover:scale-110 ${
                    hasTransition
                      ? 'bg-[#00CAE0] border-white text-black'
                      : 'bg-white border-black/40 text-black'
                  }`}
                >
                  {hasTransition ? (
                    <ArrowLeftRight className="w-3 h-3 stroke-[2.5]" />
                  ) : (
                    <span className="w-[2.5px] h-3.5 bg-black rounded-full" />
                  )}
                </button>
              );
            })}

            {/* CapCut [ + ] Button opens In-App Media Gallery */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onOpenMainGallery();
              }}
              aria-label="Add video or photo"
              style={{ left: `${mainEndSec * pxPerSec + 14}px` }}
              className="absolute top-1.5 w-10 h-10 rounded-lg bg-[#F5F5F7] hover:bg-white text-black flex items-center justify-center shadow cursor-pointer"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

          {/* STACKED OVERLAY / MEME / TEXT LAYERS */}
          {overlayTracks.map((track) => {
            const clips = project.clips
              .filter((c) => c.trackId === track.id)
              .sort((a, b) => a.startSec - b.startSec);

            return (
              <div key={track.id} className="h-[38px] relative">
                {clips.map((clip) => (
                  <ClipStrip
                    key={clip.id}
                    clip={clip}
                    pxPerSec={pxPerSec}
                    isSelected={project.selectedClipId === clip.id}
                    isTrimming={trimmingClipId === clip.id}
                    variant={clip.sourceType === 'demo-text' ? 'text' : 'overlay'}
                    onSelectClip={handleSelectClipById}
                    onStartDrag={handleStartClipDrag}
                    onJumpToKeyframe={handleJumpToKeyframe}
                  />
                ))}

                {/* Overlay Cut-Point Transition Buttons */}
                {clips.map((clip, idx) => {
                  if (idx === 0) return null;
                  const prevClip = clips[idx - 1];
                  const isAdjacent =
                    Math.abs(clip.startSec - (prevClip.startSec + prevClip.durationSec)) < 0.35;
                  if (!isAdjacent) return null;
                  const hasTransition = clip.transitionIn && clip.transitionIn.type !== 'none';
                  return (
                    <button
                      key={`cut-ov-${clip.id}`}
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenTransition(clip.id);
                      }}
                      title="Tap cut point to add transition"
                      aria-label="Edit layer cut transition"
                      style={{ left: `${clip.startSec * pxPerSec - 10}px` }}
                      className={`absolute top-1/2 -translate-y-1/2 w-[20px] h-[20px] rounded flex items-center justify-center z-40 border shadow cursor-pointer ${
                        hasTransition
                          ? 'bg-[#00CAE0] border-white text-black'
                          : 'bg-white border-black/40 text-black'
                      }`}
                    >
                      {hasTransition ? (
                        <ArrowLeftRight className="w-2.5 h-2.5 stroke-[2.5]" />
                      ) : (
                        <span className="w-[2px] h-3 bg-black rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}

          {/* AUDIO & MEME SFX TRACKS */}
          {audioTracks.map((track) => {
            const clips = project.clips.filter((c) => c.trackId === track.id);
            return (
              <div key={track.id} className="h-[36px] relative">
                {clips.map((clip) => (
                  <ClipStrip
                    key={clip.id}
                    clip={clip}
                    pxPerSec={pxPerSec}
                    isSelected={project.selectedClipId === clip.id}
                    isTrimming={trimmingClipId === clip.id}
                    variant="audio"
                    onSelectClip={handleSelectClipById}
                    onStartDrag={handleStartClipDrag}
                    onJumpToKeyframe={handleJumpToKeyframe}
                  />
                ))}
              </div>
            );
          })}

          {/* Inline Add Audio / Layer / Meme Row */}
          <div className="h-8 relative flex items-center gap-2">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onOpenQuickAdd('audio');
              }}
              className="px-2.5 py-1 rounded bg-[#16161B] hover:bg-[#1F1F26] border border-[#26262E] text-[11px] text-[#A1A1AE] hover:text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Music className="w-3 h-3 text-[#00CAE0]" />
              <span>+ Add audio</span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onOpenQuickAdd('overlay');
              }}
              className="px-2.5 py-1 rounded bg-[#16161B] hover:bg-[#1F1F26] border border-[#26262E] text-[11px] text-[#A1A1AE] hover:text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3 h-3 text-[#A78BFA]" />
              <span>+ Add layer</span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onOpenQuickAdd('meme');
              }}
              className="px-2.5 py-1 rounded bg-[#16161B] hover:bg-[#1F1F26] border border-[#26262E] text-[11px] text-[#A1A1AE] hover:text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3 h-3 text-[#FBBF24]" />
              <span>+ Meme / SFX</span>
            </button>
          </div>
        </div>
      </div>

      {/* FIXED CENTER WHITE PLAYHEAD */}
      <div
        aria-hidden="true"
        className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-white pointer-events-none z-40 shadow-[0_0_8px_rgba(255,255,255,0.65)]"
      />
    </section>
  );
}

const RulerTrack = React.memo(function RulerTrack({
  rulerSecCount,
  pxPerSec,
}: {
  rulerSecCount: number;
  pxPerSec: number;
}) {
  return (
    <div className="h-6 relative shrink-0 border-b border-[#1C1C22]">
      {Array.from({ length: rulerSecCount }).map((_, sec) => (
        <div
          key={sec}
          style={{ left: `${sec * pxPerSec}px` }}
          className="absolute top-0 bottom-0 flex items-center pointer-events-none"
        >
          <span
            className={`text-[10px] font-mono tabular-nums ${
              sec === 0
                ? 'text-[#00CAE0] font-bold translate-x-1'
                : 'text-[#7C7C88] -translate-x-1/2'
            }`}
          >
            {String(Math.floor(sec / 60)).padStart(2, '0')}:{String(sec % 60).padStart(2, '0')}
          </span>
          <span
            style={{ left: `${pxPerSec / 2}px` }}
            className="absolute top-2.5 w-1 h-1 rounded-full bg-[#3A3A44]"
          />
        </div>
      ))}
    </div>
  );
});

interface ClipStripProps {
  clip: Clip;
  pxPerSec: number;
  isSelected: boolean;
  isTrimming: boolean;
  variant: 'video' | 'overlay' | 'text' | 'audio';
  onSelectClip: (clipId: string) => void;
  onStartDrag: (clip: Clip, mode: TimelineDragMode, clientX: number, pointerId: number) => void;
  onJumpToKeyframe: (clipId: string, sec: number) => void;
}

const ClipStrip = React.memo(function ClipStrip({
  clip,
  pxPerSec,
  isSelected,
  isTrimming,
  variant,
  onSelectClip,
  onStartDrag,
  onJumpToKeyframe,
}: ClipStripProps) {
  const leftPx = clip.startSec * pxPerSec;
  const widthPx = Math.max(24, clip.durationSec * pxPerSec);

  const bgClass =
    variant === 'video'
      ? 'bg-[#1D2430]'
      : variant === 'overlay'
        ? 'bg-[#29203A]'
        : variant === 'text'
          ? 'bg-[#36281A]'
          : 'bg-[#112B2B]';

  const thumbCount = Math.max(2, Math.ceil(widthPx / 48));

  return (
    <div
      style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelectClip(clip.id);
        onStartDrag(clip, 'move-clip', e.clientX, e.pointerId);
      }}
      className={`absolute top-0 bottom-0 cursor-grab active:cursor-grabbing ${
        isSelected ? 'z-20' : 'z-10'
      }`}
    >
      {/* Inner clipped background strip */}
      <div
        className={`absolute inset-0 rounded-md overflow-hidden ${bgClass} ${
          isSelected ? 'ring-2 ring-white' : 'border border-white/15'
        }`}
      >
        {variant === 'video' && clip.thumbnails && clip.thumbnails.length > 0 && (
          <div className="absolute inset-0 flex pointer-events-none">
            {Array.from({ length: thumbCount }).map((_, idx) => (
              <img
                key={idx}
                src={clip.thumbnails![idx % clip.thumbnails!.length]}
                alt=""
                draggable={false}
                className="h-full w-12 object-cover shrink-0 border-r border-black/30"
              />
            ))}
          </div>
        )}

        {variant === 'video' && (!clip.thumbnails || clip.thumbnails.length === 0) && (
          <div className="absolute inset-0 flex opacity-45 pointer-events-none">
            {Array.from({ length: thumbCount }).map((_, idx) => (
              <div
                key={idx}
                className="h-full w-12 shrink-0 border-r border-black/40 bg-gradient-to-br from-[#2B3648] to-[#141A24]"
              />
            ))}
          </div>
        )}

        {variant === 'audio' && (
          <div className="absolute inset-x-1 bottom-0.5 top-3.5 flex items-end gap-[2px] opacity-80 pointer-events-none">
            {(clip.waveform || [0.3, 0.7, 0.5, 0.9, 0.4, 0.8, 0.6, 0.85, 0.5]).map((amp, i) => (
              <div
                key={i}
                style={{ height: `${Math.round(amp * 100)}%` }}
                className="flex-1 bg-[#00CAE0] rounded-t-[1px]"
              />
            ))}
          </div>
        )}

        <div className="relative z-[1] px-3 pt-0.5 flex items-center justify-between gap-1 pointer-events-none">
          <span className="text-[10px] font-medium text-white drop-shadow truncate">
            {clip.name}
          </span>
        </div>

        {clip.keyframes.map((kf) => {
          const kfLeft = Math.max(8, Math.min(widthPx - 12, kf.timeOffset * pxPerSec));
          return (
            <button
              key={kf.id}
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onJumpToKeyframe(clip.id, clip.startSec + kf.timeOffset);
              }}
              style={{ left: `${kfLeft}px` }}
              title={`Keyframe ${kf.timeOffset.toFixed(2)}s`}
              className="absolute bottom-1 w-2.5 h-2.5 flex items-center justify-center z-20 cursor-pointer"
            >
              <Diamond className="w-2.5 h-2.5 text-[#FBBF24] fill-[#FBBF24]" />
            </button>
          );
        })}
      </div>

      {/* Live Trim Duration Tooltip */}
      {isTrimming && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-[#00CAE0] text-black font-mono text-[10px] font-bold tabular-nums whitespace-nowrap pointer-events-none z-50 shadow">
          {clip.durationSec.toFixed(2)}s
        </div>
      )}

      {/* Left Start-Trim / Crop Handle */}
      <div
        onPointerDown={(e) => {
          e.stopPropagation();
          onSelectClip(clip.id);
          onStartDrag(clip, 'trim-left', e.clientX, e.pointerId);
        }}
        title="Drag to trim/resize start"
        className={`absolute -left-1.5 top-0 bottom-0 w-5 flex items-center justify-start cursor-ew-resize z-30 ${
          isSelected ? 'opacity-100' : 'opacity-0 hover:opacity-80'
        }`}
      >
        <div className="w-3 h-full rounded-l-md bg-white flex items-center justify-center shadow">
          <span className="w-0.5 h-4 bg-black/60 rounded-full" />
        </div>
      </div>

      {/* Right End-Trim / Crop Handle */}
      <div
        onPointerDown={(e) => {
          e.stopPropagation();
          onSelectClip(clip.id);
          onStartDrag(clip, 'trim-right', e.clientX, e.pointerId);
        }}
        title="Drag to trim/resize end"
        className={`absolute -right-1.5 top-0 bottom-0 w-5 flex items-center justify-end cursor-ew-resize z-30 ${
          isSelected ? 'opacity-100' : 'opacity-0 hover:opacity-80'
        }`}
      >
        <div className="w-3 h-full rounded-r-md bg-white flex items-center justify-center shadow">
          <span className="w-0.5 h-4 bg-black/60 rounded-full" />
        </div>
      </div>
    </div>
  );
});
