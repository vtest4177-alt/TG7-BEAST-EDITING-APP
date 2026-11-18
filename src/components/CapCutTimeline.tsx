import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeftRight,
  Diamond,
  Eye,
  EyeOff,
  GripVertical,
  Lock,
  Music,
  Plus,
  SkipBack,
  Unlock,
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
  onOpenEditText?: (clipId: string) => void;
  onOpenTransition: (clipId: string) => void;
  onMoveOrTrimClip: (
    clipId: string,
    startSec: number,
    durationSec: number,
    trimStartSec: number,
    mode: TimelineDragMode
  ) => void;
  onFinishDrag?: (clipId?: string, mode?: TimelineDragMode) => void;
  onToggleTrackFlag?: (trackId: string, flag: 'muted' | 'locked' | 'hidden') => void;
  onToggleMainMute: () => void;
  onOpenMainGallery: () => void;
  onOpenQuickAdd: (kind: 'audio' | 'overlay' | 'meme') => void;
  onChangeZoom: (zoom: number) => void;
}

interface ActiveDragSession {
  mode: TimelineDragMode;
  clipId?: string;
  startClientX: number;
  startClientY: number;
  maxMovePx: number;
  origPlayheadSec: number;
  origStartSec: number;
  origDurationSec: number;
  origTrimStartSec: number;
  allowNegativeExtend: boolean;
  isHoldingPending?: boolean;
  holdTimerId?: number | null;
}

export function CapCutTimeline({
  project,
  onSeek,
  onSelectClip,
  onOpenEditText,
  onOpenTransition,
  onMoveOrTrimClip,
  onFinishDrag,
  onToggleTrackFlag,
  onToggleMainMute,
  onOpenMainGallery,
  onOpenQuickAdd,
  onChangeZoom,
}: CapCutTimelineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(800);
  const [trimmingClipId, setTrimmingClipId] = useState<string | null>(null);
  const [movingClipId, setMovingClipId] = useState<string | null>(null);
  const [snapLineSec, setSnapLineSec] = useState<number | null>(null);

  const dragRef = useRef<ActiveDragSession | null>(null);
  const pendingClientXRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const playheadRef = useRef<number>(project.playheadSec);
  playheadRef.current = project.playheadSec;

  const pxPerSec = project.zoomPxPerSec;
  const totalDuration = Math.max(12, getProjectDuration(project));
  const maxScrubSec = Math.max(totalDuration + 6, 18);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setViewportWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
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

  const lockedTrackIds = useMemo(
    () => new Set(project.tracks.filter((t) => t.locked).map((t) => t.id)),
    [project.tracks]
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

  const snapTime = useCallback(
    (
      rawSec: number,
      ignoreStartEndOfClip?: ActiveDragSession
    ): { snapped: number; hitSnap: number | null } => {
      for (const pt of snapPointsRef.current) {
        if (
          ignoreStartEndOfClip &&
          (Math.abs(pt - ignoreStartEndOfClip.origStartSec) < 0.001 ||
            Math.abs(
              pt - (ignoreStartEndOfClip.origStartSec + ignoreStartEndOfClip.origDurationSec)
            ) < 0.001)
        ) {
          continue;
        }
        if (Math.abs(rawSec - pt) < 0.12) {
          const val = Math.round(pt * 100) / 100;
          return { snapped: val, hitSnap: val };
        }
      }
      return { snapped: Math.round(rawSec * 100) / 100, hitSnap: null };
    },
    []
  );

  const processDragFrame = useCallback(() => {
    rafRef.current = null;
    const session = dragRef.current;
    const clientX = pendingClientXRef.current;
    if (!session || clientX === null) return;

    const dx = clientX - session.startClientX;
    session.maxMovePx = Math.max(session.maxMovePx, Math.abs(dx));

    // If user is waiting on a 200ms long-press on a clip, moving >6px converts seamlessly into smooth timeline scrubbing!
    if (session.isHoldingPending && Math.abs(dx) > 6) {
      if (session.holdTimerId) {
        window.clearTimeout(session.holdTimerId);
        session.holdTimerId = null;
      }
      session.isHoldingPending = false;
      session.mode = 'scroll-timeline';
      session.clipId = undefined;
    }

    if (session.mode === 'scroll-timeline') {
      const nextTime = Math.max(0, Math.min(maxScrubSec, session.origPlayheadSec - dx / pxPerSec));
      onSeek(nextTime);
      return;
    }

    if (!session.clipId || session.isHoldingPending) return;
    const deltaSec = dx / pxPerSec;

    if (session.mode === 'move-clip') {
      const { snapped, hitSnap } = snapTime(session.origStartSec + deltaSec, session);
      const nextStart = Math.max(0, snapped);
      setSnapLineSec(hitSnap);
      onMoveOrTrimClip(
        session.clipId,
        nextStart,
        session.origDurationSec,
        session.origTrimStartSec,
        'move-clip'
      );
    } else if (session.mode === 'trim-right') {
      const rawDur = Math.max(0.25, session.origDurationSec + deltaSec);
      const { snapped: snappedEnd, hitSnap } = snapTime(session.origStartSec + rawDur, session);
      setSnapLineSec(hitSnap);
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
      const { snapped: nextStartSnapped, hitSnap } = snapTime(
        session.origStartSec + clampedDelta,
        session
      );
      setSnapLineSec(hitSnap);
      const effectiveDelta = nextStartSnapped - session.origStartSec;
      const safeDelta = Math.max(minLeftShift, Math.min(maxRightShift, effectiveDelta));
      const nextStart = Math.round((session.origStartSec + safeDelta) * 100) / 100;
      const nextDur = Math.round((session.origDurationSec - safeDelta) * 100) / 100;
      const nextTrimStart = Math.max(
        0,
        Math.round((session.origTrimStartSec + safeDelta) * 100) / 100
      );
      onMoveOrTrimClip(session.clipId, nextStart, nextDur, nextTrimStart, 'trim-left');
    }
  }, [maxScrubSec, onMoveOrTrimClip, onSeek, pxPerSec, snapTime]);

  const endDragSession = useCallback(() => {
    const finished = dragRef.current;
    if (finished?.holdTimerId) {
      window.clearTimeout(finished.holdTimerId);
    }
    dragRef.current = null;
    pendingClientXRef.current = null;
    setTrimmingClipId(null);
    setMovingClipId(null);
    setSnapLineSec(null);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (finished) {
      // Quick tap inside a clip selects it without bumping
      if (finished.isHoldingPending && finished.clipId && finished.maxMovePx < 6) {
        onSelectClip(finished.clipId);
        return;
      }
      // Pure tap on empty background deselects
      if (finished.mode === 'scroll-timeline' && finished.maxMovePx < 5) {
        onSelectClip(null);
      }
      if (onFinishDrag && !finished.isHoldingPending) {
        onFinishDrag(finished.clipId, finished.mode);
      }
    }
  }, [onFinishDrag, onSelectClip]);

  // Global window pointer listeners guarantee smooth forward/backward scrubbing & dragging even outside bounds
  useEffect(() => {
    const onWinMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      pendingClientXRef.current = e.clientX;
      if (dragRef.current.mode === 'scroll-timeline' || dragRef.current.isHoldingPending) {
        processDragFrame();
      } else if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(processDragFrame);
      }
    };
    const onWinUp = () => {
      if (!dragRef.current) return;
      endDragSession();
    };
    window.addEventListener('pointermove', onWinMove, { passive: true });
    window.addEventListener('pointerup', onWinUp);
    window.addEventListener('pointercancel', onWinUp);
    return () => {
      window.removeEventListener('pointermove', onWinMove);
      window.removeEventListener('pointerup', onWinUp);
      window.removeEventListener('pointercancel', onWinUp);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [endDragSession, processDragFrame]);

  const beginDragSession = useCallback((pointerId: number, session: ActiveDragSession) => {
    if (dragRef.current?.holdTimerId) {
      window.clearTimeout(dragRef.current.holdTimerId);
    }
    dragRef.current = session;
    pendingClientXRef.current = session.startClientX;
    if (session.mode === 'trim-left' || session.mode === 'trim-right') {
      setTrimmingClipId(session.clipId ?? null);
    } else if (session.mode === 'move-clip' && !session.isHoldingPending) {
      setMovingClipId(session.clipId ?? null);
    }
    try {
      containerRef.current?.setPointerCapture(pointerId);
    } catch {
      // fallback handled by global window listeners
    }
  }, []);

  const handleSelectClipById = useCallback(
    (clipId: string) => {
      onSelectClip(clipId);
    },
    [onSelectClip]
  );

  // Supports both Hold-to-Drag (~195ms long press) AND immediate drag on trim handles / grip
  const handleStartClipDrag = useCallback(
    (
      clip: Clip,
      mode: TimelineDragMode,
      clientX: number,
      clientY: number,
      pointerId: number,
      requireHold: boolean
    ) => {
      if (lockedTrackIds.has(clip.trackId) && mode !== 'scroll-timeline') {
        onSelectClip(clip.id);
        return;
      }

      if (requireHold && mode === 'move-clip') {
        const session: ActiveDragSession = {
          mode: 'scroll-timeline',
          clipId: clip.id,
          startClientX: clientX,
          startClientY: clientY,
          maxMovePx: 0,
          origPlayheadSec: playheadRef.current,
          origStartSec: clip.startSec,
          origDurationSec: clip.durationSec,
          origTrimStartSec: clip.trimStartSec,
          allowNegativeExtend:
            clip.sourceType !== 'local-video' && clip.sourceType !== 'local-audio',
          isHoldingPending: true,
          holdTimerId: null,
        };

        session.holdTimerId = window.setTimeout(() => {
          const active = dragRef.current;
          if (!active || active !== session || active.maxMovePx > 6) return;
          active.isHoldingPending = false;
          active.mode = 'move-clip';
          active.holdTimerId = null;
          setMovingClipId(clip.id);
          onSelectClip(clip.id);
          try {
            navigator.vibrate?.(16);
          } catch {
            // ignore on browsers without vibration API
          }
        }, 195);

        beginDragSession(pointerId, session);
        return;
      }

      beginDragSession(pointerId, {
        mode,
        clipId: clip.id,
        startClientX: clientX,
        startClientY: clientY,
        maxMovePx: 0,
        origPlayheadSec: playheadRef.current,
        origStartSec: clip.startSec,
        origDurationSec: clip.durationSec,
        origTrimStartSec: clip.trimStartSec,
        allowNegativeExtend:
          clip.sourceType !== 'local-video' && clip.sourceType !== 'local-audio',
      });
    },
    [beginDragSession, lockedTrackIds, onSelectClip]
  );

  const handleJumpToKeyframe = useCallback(
    (clipId: string, sec: number) => {
      onSelectClip(clipId);
      onSeek(sec);
    },
    [onSelectClip, onSeek]
  );

  const rulerSecCount = Math.ceil(maxScrubSec + 2);

  return (
    <section
      ref={containerRef}
      aria-label="TG7 multi-track timeline"
      onPointerDown={(e) => {
        beginDragSession(e.pointerId, {
          mode: 'scroll-timeline',
          startClientX: e.clientX,
          startClientY: e.clientY,
          maxMovePx: 0,
          origPlayheadSec: playheadRef.current,
          origStartSec: 0,
          origDurationSec: 0,
          origTrimStartSec: 0,
          allowNegativeExtend: true,
        });
      }}
      onWheel={(e) => {
        const deltaPx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
        if (deltaPx !== 0) {
          const next = Math.max(0, Math.min(maxScrubSec, playheadRef.current + deltaPx / pxPerSec));
          onSeek(next);
        }
      }}
      className="flex-1 min-h-[215px] lg:min-h-[245px] bg-[#0B0B0D] relative overflow-hidden select-none touch-none cursor-ew-resize flex flex-col"
    >
      {/* Top-Left Fixed Controls: Jump to 00:00, Main Mute & Gesture Hint */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-1 left-2 z-50 flex items-center gap-1.5"
      >
        <motion.button
          whileTap={{ scale: 0.9 }}
          type="button"
          aria-label="Jump to start 00:00"
          title="Jump to 00:00"
          onClick={() => onSeek(0)}
          className="px-1.5 py-0.5 rounded bg-[#141418]/90 hover:bg-[#1E1E26] border border-[#24242C] text-[10px] font-mono text-[#00CAE0] flex items-center gap-1 cursor-pointer"
        >
          <SkipBack className="w-3 h-3" />
          <span>00:00</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
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
        </motion.button>

        <span className="hidden md:inline text-[10px] text-[#6B6B78] pl-1 pointer-events-none">
          Hold clip or drag ⋮⋮ to move
        </span>
      </div>

      {/* Floating Zoom Buttons */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-1 right-2 z-50 flex items-center gap-1 bg-[#141418]/90 border border-[#24242C] rounded-md p-0.5"
      >
        <motion.button
          whileTap={{ scale: 0.85 }}
          type="button"
          aria-label="Zoom out timeline"
          onClick={() => onChangeZoom(Math.max(48, pxPerSec - 18))}
          className="p-1 text-[#A1A1AE] hover:text-white cursor-pointer"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.85 }}
          type="button"
          aria-label="Zoom in timeline"
          onClick={() => onChangeZoom(Math.min(220, pxPerSec + 18))}
          className="p-1 text-[#A1A1AE] hover:text-white cursor-pointer"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </motion.button>
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

        {/* Magnetic Snap Vertical Laser Line */}
        {snapLineSec !== null && (
          <div
            aria-hidden="true"
            style={{ left: `${snapLineSec * pxPerSec}px` }}
            className="absolute top-6 bottom-0 w-[1.5px] bg-[#00CAE0] shadow-[0_0_10px_#00CAE0] pointer-events-none z-45"
          />
        )}

        {/* Tracks Container */}
        <div className="flex-1 overflow-y-auto overflow-x-visible py-3 space-y-2.5 relative touch-none">
          {/* MAIN VIDEO TRACK */}
          <div className="h-[56px] relative">
            {mainClips.map((clip) => (
              <ClipStrip
                key={clip.id}
                clip={clip}
                pxPerSec={pxPerSec}
                isSelected={project.selectedClipId === clip.id}
                isTrimming={trimmingClipId === clip.id}
                isMoving={movingClipId === clip.id}
                isLocked={lockedTrackIds.has(clip.trackId)}
                variant="video"
                onSelectClip={handleSelectClipById}
                onStartDrag={handleStartClipDrag}
                onJumpToKeyframe={handleJumpToKeyframe}
                onOpenEditText={onOpenEditText}
              />
            ))}

            {/* CapCut Cut-Point Transition Buttons */}
            {mainClips.map((clip, idx) => {
              if (idx === 0) return null;
              const prevClip = mainClips[idx - 1];
              const isAdjacent =
                Math.abs(clip.startSec - (prevClip.startSec + prevClip.durationSec)) < 0.35;
              if (!isAdjacent) return null;
              const hasTransition = clip.transitionIn && clip.transitionIn.type !== 'none';
              return (
                <motion.button
                  whileTap={{ scale: 0.84 }}
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
                </motion.button>
              );
            })}

            {/* CapCut [ + ] Button */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onOpenMainGallery();
              }}
              aria-label="Add video or photo"
              style={{ left: `${mainEndSec * pxPerSec + 14}px` }}
              className="absolute top-2 w-10 h-10 rounded-lg bg-[#F5F5F7] hover:bg-white text-black flex items-center justify-center shadow cursor-pointer"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </motion.button>
          </div>

          {/* STACKED OVERLAY / MEME / TEXT / SVG LAYERS */}
          {overlayTracks.map((track) => {
            const clips = project.clips
              .filter((c) => c.trackId === track.id)
              .sort((a, b) => a.startSec - b.startSec);

            return (
              <div
                key={track.id}
                className={`h-[40px] relative transition-opacity ${
                  track.hidden ? 'opacity-40' : 'opacity-100'
                }`}
              >
                {clips.map((clip) => (
                  <ClipStrip
                    key={clip.id}
                    clip={clip}
                    pxPerSec={pxPerSec}
                    isSelected={project.selectedClipId === clip.id}
                    isTrimming={trimmingClipId === clip.id}
                    isMoving={movingClipId === clip.id}
                    isLocked={Boolean(track.locked)}
                    variant={clip.sourceType === 'demo-text' ? 'text' : 'overlay'}
                    onSelectClip={handleSelectClipById}
                    onStartDrag={handleStartClipDrag}
                    onJumpToKeyframe={handleJumpToKeyframe}
                    onOpenEditText={onOpenEditText}
                  />
                ))}

                {clips.map((clip, idx) => {
                  if (idx === 0) return null;
                  const prevClip = clips[idx - 1];
                  const isAdjacent =
                    Math.abs(clip.startSec - (prevClip.startSec + prevClip.durationSec)) < 0.35;
                  if (!isAdjacent) return null;
                  const hasTransition = clip.transitionIn && clip.transitionIn.type !== 'none';
                  return (
                    <motion.button
                      whileTap={{ scale: 0.84 }}
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
                    </motion.button>
                  );
                })}
              </div>
            );
          })}

          {/* AUDIO & MEME SFX TRACKS */}
          {audioTracks.map((track) => {
            const clips = project.clips.filter((c) => c.trackId === track.id);
            return (
              <div
                key={track.id}
                className={`h-[38px] relative transition-opacity ${
                  track.muted ? 'opacity-45' : 'opacity-100'
                }`}
              >
                {clips.map((clip) => (
                  <ClipStrip
                    key={clip.id}
                    clip={clip}
                    pxPerSec={pxPerSec}
                    isSelected={project.selectedClipId === clip.id}
                    isTrimming={trimmingClipId === clip.id}
                    isMoving={movingClipId === clip.id}
                    isLocked={Boolean(track.locked)}
                    variant="audio"
                    onSelectClip={handleSelectClipById}
                    onStartDrag={handleStartClipDrag}
                    onJumpToKeyframe={handleJumpToKeyframe}
                    onOpenEditText={onOpenEditText}
                  />
                ))}
              </div>
            );
          })}

          {/* Inline Add Audio / Layer / Meme + Track Controls Row */}
          <div className="h-8 relative flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.92 }}
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
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.92 }}
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
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.92 }}
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
            </motion.button>
          </div>
        </div>
      </div>

      {/* Left Compact Track Control Pills (Hide/Mute/Lock for active tracks) */}
      {onToggleTrackFlag && (overlayTracks.length > 0 || audioTracks.length > 0) && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute bottom-2 left-2 z-40 flex items-center gap-1 bg-[#121216]/90 border border-[#24242C] rounded-md px-1.5 py-0.5 backdrop-blur-sm"
        >
          {overlayTracks[0] && (
            <>
              <button
                type="button"
                title={overlayTracks[0].hidden ? 'Show Layer Track' : 'Hide Layer Track'}
                onClick={() => onToggleTrackFlag(overlayTracks[0].id, 'hidden')}
                className="p-1 text-[#A1A1AE] hover:text-white cursor-pointer"
              >
                {overlayTracks[0].hidden ? (
                  <EyeOff className="w-3 h-3 text-[#F59E0B]" />
                ) : (
                  <Eye className="w-3 h-3" />
                )}
              </button>
              <button
                type="button"
                title={overlayTracks[0].locked ? 'Unlock Layer Track' : 'Lock Layer Track'}
                onClick={() => onToggleTrackFlag(overlayTracks[0].id, 'locked')}
                className="p-1 text-[#A1A1AE] hover:text-white cursor-pointer"
              >
                {overlayTracks[0].locked ? (
                  <Lock className="w-3 h-3 text-[#F59E0B]" />
                ) : (
                  <Unlock className="w-3 h-3" />
                )}
              </button>
            </>
          )}
          {audioTracks[0] && (
            <button
              type="button"
              title={audioTracks[0].muted ? 'Unmute Audio Track' : 'Mute Audio Track'}
              onClick={() => onToggleTrackFlag(audioTracks[0].id, 'muted')}
              className="p-1 text-[#A1A1AE] hover:text-white cursor-pointer"
            >
              {audioTracks[0].muted ? (
                <VolumeX className="w-3 h-3 text-[#F59E0B]" />
              ) : (
                <Volume2 className="w-3 h-3 text-[#00CAE0]" />
              )}
            </button>
          )}
        </div>
      )}

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
  isMoving: boolean;
  isLocked: boolean;
  variant: 'video' | 'overlay' | 'text' | 'audio';
  onSelectClip: (clipId: string) => void;
  onStartDrag: (
    clip: Clip,
    mode: TimelineDragMode,
    clientX: number,
    clientY: number,
    pointerId: number,
    requireHold: boolean
  ) => void;
  onJumpToKeyframe: (clipId: string, sec: number) => void;
  onOpenEditText?: (clipId: string) => void;
}

const ClipStrip = React.memo(function ClipStrip({
  clip,
  pxPerSec,
  isSelected,
  isTrimming,
  isMoving,
  isLocked,
  variant,
  onSelectClip,
  onStartDrag,
  onJumpToKeyframe,
  onOpenEditText,
}: ClipStripProps) {
  const leftPx = clip.startSec * pxPerSec;
  const widthPx = Math.max(26, clip.durationSec * pxPerSec);

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
        // Require ~200ms hold on clip body so quick swipes smoothly scrub timeline instead of bumping clips!
        onStartDrag(clip, 'move-clip', e.clientX, e.clientY, e.pointerId, true);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onSelectClip(clip.id);
        if (clip.sourceType === 'demo-text' && onOpenEditText) {
          onOpenEditText(clip.id);
        }
      }}
      className={`absolute top-0 bottom-0 transition-transform duration-150 ${
        isMoving
          ? 'z-30 scale-[1.03] cursor-grabbing'
          : isSelected
            ? 'z-20 cursor-grab'
            : 'z-10 cursor-grab'
      }`}
    >
      <div
        className={`absolute inset-0 rounded-md overflow-hidden ${bgClass} ${
          isMoving
            ? 'ring-2 ring-[#00CAE0] shadow-[0_8px_24px_rgba(0,202,224,0.38)]'
            : isSelected
              ? 'ring-2 ring-white'
              : 'border border-white/15'
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

        {/* Clip Header Row + Instant Drag Grip when Selected */}
        <div className="relative z-[2] px-2 pt-0.5 flex items-center justify-between gap-1">
          <div className="flex items-center gap-0.5 min-w-0">
            {isSelected && !isLocked && (
              <button
                type="button"
                title="Drag forward / backward immediately"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelectClip(clip.id);
                  onStartDrag(clip, 'move-clip', e.clientX, e.clientY, e.pointerId, false);
                }}
                className="p-0.5 -ml-1 rounded bg-black/55 hover:bg-[#00CAE0] hover:text-black text-white/90 cursor-grab active:cursor-grabbing shrink-0"
              >
                <GripVertical className="w-3 h-3" />
              </button>
            )}
            <span className="text-[10px] font-medium text-white drop-shadow truncate pointer-events-none">
              {clip.name}
            </span>
          </div>
          {isLocked && <Lock className="w-2.5 h-2.5 text-[#F59E0B] shrink-0" />}
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

      {/* Live Float Readout Badge while Moving or Trimming */}
      {(isTrimming || isMoving) && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-[#00CAE0] text-black font-mono text-[10px] font-bold tabular-nums whitespace-nowrap pointer-events-none z-50 shadow">
          {isMoving ? `Move · ${clip.startSec.toFixed(2)}s` : `${clip.durationSec.toFixed(2)}s`}
        </div>
      )}

      {/* Left Start-Trim / Crop Handle */}
      {!isLocked && (
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            onSelectClip(clip.id);
            onStartDrag(clip, 'trim-left', e.clientX, e.clientY, e.pointerId, false);
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
      )}

      {/* Right End-Trim / Crop Handle */}
      {!isLocked && (
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            onSelectClip(clip.id);
            onStartDrag(clip, 'trim-right', e.clientX, e.clientY, e.pointerId, false);
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
      )}
    </div>
  );
});
