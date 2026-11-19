import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { BootSplash } from './components/BootSplash';
import {
  BottomSheetTool,
  CapCutBottomDock,
  StudioToolInspector,
} from './components/CapCutBottomDock';
import { CapCutHome, QuickPresetKind } from './components/CapCutHome';
import { CapCutTimeline, TimelineDragMode } from './components/CapCutTimeline';
import { ExportModal } from './components/ExportModal';
import { InAppMediaPicker, SelectedGalleryItem } from './components/InAppMediaPicker';
import { MemeLibrarySheet } from './components/MemeLibrarySheet';
import { PreviewStage } from './components/PreviewStage';
import { SvgStickerSheet } from './components/SvgStickerSheet';
import {
  CREATOR_TEXT_RECIPES,
  GOOGLE_FONT_CATALOG,
  INTRO_OUTRO_TEMPLATES,
  IntroOutroTemplate,
  loadGoogleFont,
  MemeLibraryItem,
} from './data/assetsCatalog';
import { fetchRemoteFileAsFile, OnlineTemplateItem } from './data/onlineLibraries';
import {
  generateStockThumbnailDataUrl,
  getProjectDuration,
  interpolateTransform,
} from './engine/compositor';
import {
  createBlankProject,
  createInitialDemoProject,
  SPEED_PRESETS,
} from './engine/demoProject';
import {
  loadStudioDraftSnapshot,
  saveMediaBlobToDraftDb,
  saveStudioDraftSnapshot,
} from './engine/draftStorage';
import {
  extractAudioWaveform,
  extractVideoThumbnails,
  fallbackWaveform,
} from './engine/mediaUtils';
import { playMemeSfx } from './engine/sfxEngine';
import {
  AspectRatio,
  ChromaKeyConfig,
  Clip,
  ClipCrop,
  Keyframe,
  MediaAsset,
  ProjectState,
  SpeedPoint,
  SpeedPreset,
  TextAnimationType,
  TextStylePreset,
  Track,
  TransitionType,
  VideoEffectType,
} from './types/editor';

type ScreenMode = 'home' | 'editor';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [projects, setProjects] = useState<ProjectState[]>(() => [
    createInitialDemoProject(),
  ]);
  const [activeProjectId, setActiveProjectId] = useState<string>('proj-demo-tg7');
  const [deviceAssets, setDeviceAssets] = useState<MediaAsset[]>([]);
  const [customFonts, setCustomFonts] = useState<string[]>([]);
  const [screen, setScreen] = useState<ScreenMode>('home');
  const [activeSheet, setActiveSheet] = useState<BottomSheetTool>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showMemeLibrary, setShowMemeLibrary] = useState(false);
  const [showSvgStickers, setShowSvgStickers] = useState(false);
  const [galleryMode, setGalleryMode] = useState<
    null | { mode: 'new-project'; ratio: AspectRatio } | { mode: 'main' } | { mode: 'overlay' }
  >(null);

  const [undoStack, setUndoStack] = useState<ProjectState[]>([]);
  const [redoStack, setRedoStack] = useState<ProjectState[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  const mediaElementsRef = useRef<
    Map<string, HTMLVideoElement | HTMLImageElement | HTMLAudioElement>
  >(new Map());
  const desktopAudioInputRef = useRef<HTMLInputElement | null>(null);
  const hasHydratedDraftsRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const triggeredSfxRef = useRef<Set<string>>(new Set());
  const previewTimerRef = useRef<number | null>(null);

  const project =
    projects.find((p) => p.id === activeProjectId) ?? projects[0];
  const totalDuration = getProjectDuration(project);
  const selectedClip =
    project.clips.find((c) => c.id === project.selectedClipId) ?? null;

  // Bind HTMLVideoElement / HTMLImageElement / HTMLAudioElement cleanly from URL
  const bindMediaElementForClip = useCallback((clip: Clip) => {
    if (!clip.mediaUrl) return;
    if (clip.sourceType === 'local-image') {
      const img = new Image();
      if (clip.mediaUrl.startsWith('http')) img.crossOrigin = 'anonymous';
      img.src = clip.mediaUrl;
      mediaElementsRef.current.set(clip.id, img);
    } else if (clip.sourceType === 'local-video') {
      const vid = document.createElement('video');
      vid.preload = 'auto';
      vid.playsInline = true;
      if (clip.mediaUrl.startsWith('http://') || clip.mediaUrl.startsWith('https://')) {
        vid.crossOrigin = 'anonymous';
      }
      vid.src = clip.mediaUrl;
      vid.load();
      mediaElementsRef.current.set(clip.id, vid);
    } else if (clip.sourceType === 'local-audio') {
      const aud = new Audio(clip.mediaUrl);
      aud.preload = 'auto';
      mediaElementsRef.current.set(clip.id, aud);
    }
  }, []);

  // Hydrate crash-safe saved drafts + local media blobs + custom fonts on boot
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { snapshot } = await loadStudioDraftSnapshot();
      if (cancelled) return;
      if (snapshot && snapshot.projects.length > 0) {
        setProjects(snapshot.projects);
        setActiveProjectId(snapshot.activeProjectId || snapshot.projects[0].id);
        setCustomFonts(snapshot.customFonts || []);
        setDeviceAssets(snapshot.deviceAssets || []);
        setLastSavedAt(snapshot.savedAt);

        snapshot.projects.forEach((p) => {
          p.clips.forEach((c) => {
            bindMediaElementForClip(c);
            if (c.fontFamily) {
              const gf = GOOGLE_FONT_CATALOG.find((g) => g.name === c.fontFamily);
              if (gf) void loadGoogleFont(gf);
            }
          });
        });
      }
      hasHydratedDraftsRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [bindMediaElementForClip]);

  // Continuous debounced auto-save + immediate flush before tab close / crash
  const latestDraftStateRef = useRef({
    projects,
    activeProjectId,
    customFonts,
    deviceAssets,
  });
  latestDraftStateRef.current = { projects, activeProjectId, customFonts, deviceAssets };

  useEffect(() => {
    if (!hasHydratedDraftsRef.current) return;
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      const snap = latestDraftStateRef.current;
      void saveStudioDraftSnapshot({
        ...snap,
        savedAt: Date.now(),
      }).then(() => setLastSavedAt(Date.now()));
    }, 350);
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [projects, activeProjectId, customFonts, deviceAssets]);

  useEffect(() => {
    const flushNow = () => {
      if (!hasHydratedDraftsRef.current) return;
      const snap = latestDraftStateRef.current;
      void saveStudioDraftSnapshot({
        ...snap,
        savedAt: Date.now(),
      });
    };
    window.addEventListener('beforeunload', flushNow);
    window.addEventListener('pagehide', flushNow);
    return () => {
      window.removeEventListener('beforeunload', flushNow);
      window.removeEventListener('pagehide', flushNow);
    };
  }, []);

  const commitProjectChange = (
    updater: (prev: ProjectState) => ProjectState,
    recordHistory = true
  ) => {
    setProjects((prevList) =>
      prevList.map((p) => {
        if (p.id !== project.id) return p;
        if (recordHistory) {
          setUndoStack((u) => [...u.slice(-19), p]);
          setRedoStack([]);
        }
        return updater(p);
      })
    );
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prevSnapshot = undoStack[undoStack.length - 1];
    setUndoStack((u) => u.slice(0, -1));
    setRedoStack((r) => [...r, project]);
    setProjects((list) =>
      list.map((p) => (p.id === project.id ? prevSnapshot : p))
    );
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextSnapshot = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((u) => [...u, project]);
    setProjects((list) =>
      list.map((p) => (p.id === project.id ? nextSnapshot : p))
    );
  };

  useEffect(() => {
    if (!project.isPlaying) {
      triggeredSfxRef.current.clear();
      return;
    }
    let rafId = 0;
    let lastTs = performance.now();
    let accDt = 0;

    const step = (now: number) => {
      const frameDt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;
      accDt += frameDt;

      // Throttle React tree commits (~30fps) so large HD/4K videos never lag scrolling/UI
      if (accDt >= 0.032) {
        const dt = accDt;
        accDt = 0;
        setProjects((prevList) =>
          prevList.map((prev) => {
            if (prev.id !== activeProjectId || !prev.isPlaying) return prev;
            const maxDur = getProjectDuration(prev);
            const nextTime = prev.playheadSec + dt;

            // Trigger Meme SFX when playhead enters sfx clip
            prev.clips.forEach((c) => {
              if (
                c.sourceType === 'meme-sfx' &&
                c.sfxId &&
                nextTime >= c.startSec &&
                nextTime <= c.startSec + 0.2 &&
                !triggeredSfxRef.current.has(c.id)
              ) {
                triggeredSfxRef.current.add(c.id);
                playMemeSfx(c.sfxId);
              }
            });

            if (nextTime >= maxDur) {
              triggeredSfxRef.current.clear();
              return { ...prev, playheadSec: 0, isPlaying: false };
            }
            return { ...prev, playheadSec: nextTime };
          })
        );
      }
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [project.isPlaying, activeProjectId]);

  const updateSelectedClip = (
    updater: (clip: Clip) => Clip,
    recordHistory = true
  ) => {
    commitProjectChange((prev) => {
      if (!prev.selectedClipId) return prev;
      return {
        ...prev,
        clips: prev.clips.map((c) =>
          c.id === prev.selectedClipId ? updater(c) : c
        ),
      };
    }, recordHistory);
  };

  const handleUpsertKeyframe = (
    patch: Partial<Omit<Keyframe, 'id' | 'timeOffset'>>,
    recordHistory = false
  ) => {
    updateSelectedClip((clip) => {
      const localTime = Math.max(
        0,
        Math.min(clip.durationSec, project.playheadSec - clip.startSec)
      );
      const existingIdx = clip.keyframes.findIndex(
        (k) => Math.abs(k.timeOffset - localTime) < 0.08
      );
      const current = interpolateTransform(clip, localTime);

      if (existingIdx >= 0) {
        return {
          ...clip,
          keyframes: clip.keyframes.map((k, idx) =>
            idx === existingIdx ? { ...k, ...patch } : k
          ),
        };
      }

      const newKf: Keyframe = {
        id: `kf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timeOffset: Math.round(localTime * 100) / 100,
        x: patch.x ?? current.x,
        y: patch.y ?? current.y,
        scale: patch.scale ?? current.scale,
        rotation: patch.rotation ?? current.rotation,
        opacity: patch.opacity ?? current.opacity,
      };
      return { ...clip, keyframes: [...clip.keyframes, newKf] };
    }, recordHistory);
  };

  const handleToggleKeyframeAtPlayhead = () => {
    if (!selectedClip) return;
    const localTime = Math.max(
      0,
      Math.min(selectedClip.durationSec, project.playheadSec - selectedClip.startSec)
    );
    const existing = selectedClip.keyframes.find(
      (k) => Math.abs(k.timeOffset - localTime) < 0.08
    );
    if (existing) {
      updateSelectedClip((clip) => ({
        ...clip,
        keyframes: clip.keyframes.filter((k) => k.id !== existing.id),
      }));
    } else {
      handleUpsertKeyframe({}, true);
    }
  };

  const handleSplitAtPlayhead = () => {
    if (!selectedClip) return;
    const splitLocal = project.playheadSec - selectedClip.startSec;
    if (splitLocal <= 0.25 || splitLocal >= selectedClip.durationSec - 0.25) {
      return;
    }

    const leftDur = Math.round(splitLocal * 100) / 100;
    const splitPointSec = Math.round((selectedClip.startSec + leftDur) * 100) / 100;
    const rightDur = Math.max(0.25, Math.round((selectedClip.durationSec - leftDur) * 100) / 100);

    const leftClip: Clip = {
      ...selectedClip,
      durationSec: leftDur,
      keyframes: selectedClip.keyframes.filter((k) => k.timeOffset <= leftDur),
    };

    const rightClipId = `clip-${Date.now()}`;
    const rightClip: Clip = {
      ...selectedClip,
      id: rightClipId,
      name: `${selectedClip.name} (2)`,
      startSec: splitPointSec,
      durationSec: rightDur,
      trimStartSec: Math.round((selectedClip.trimStartSec + leftDur) * 100) / 100,
      keyframes: selectedClip.keyframes
        .filter((k) => k.timeOffset >= leftDur)
        .map((k) => ({
          ...k,
          id: `${k.id}-r`,
          timeOffset: Math.round((k.timeOffset - leftDur) * 100) / 100,
        })),
    };

    bindMediaElementForClip(rightClip);

    commitProjectChange((prev) => ({
      ...prev,
      selectedClipId: rightClipId,
      clips: prev.clips.flatMap((c) =>
        c.id === selectedClip.id ? [leftClip, rightClip] : [c]
      ),
    }));
  };

  const handleDuplicateSelected = () => {
    if (!selectedClip) return;
    const newId = `clip-${Date.now()}`;
    const clone: Clip = {
      ...selectedClip,
      id: newId,
      name: `${selectedClip.name} Copy`,
      startSec:
        Math.round((selectedClip.startSec + selectedClip.durationSec) * 100) / 100,
      keyframes: selectedClip.keyframes.map((k, i) => ({
        ...k,
        id: `${newId}-kf-${i}`,
      })),
    };
    bindMediaElementForClip(clone);
    commitProjectChange((prev) => ({
      ...prev,
      selectedClipId: newId,
      clips: [...prev.clips, clone],
    }));
  };

  const handleDeleteSelected = () => {
    if (!project.selectedClipId) return;
    setActiveSheet(null);
    commitProjectChange((prev) => ({
      ...prev,
      clips: prev.clips.filter((c) => c.id !== prev.selectedClipId),
      selectedClipId: null,
    }));
  };

  const handleAddTextClip = () => {
    const newId = `clip-text-${Date.now()}`;
    commitProjectChange((prev) => {
      let overlayTrack = prev.tracks.find((t) => t.type === 'overlay');
      const nextTracks = [...prev.tracks];
      if (!overlayTrack) {
        overlayTrack = {
          id: `track-overlay-${Date.now()}`,
          label: 'Overlay',
          type: 'overlay',
          muted: false,
          locked: false,
          hidden: false,
        };
        nextTracks.push(overlayTrack);
      }

      const newClip: Clip = {
        id: newId,
        trackId: overlayTrack.id,
        name: 'Text · TG7',
        sourceType: 'demo-text',
        textContent: 'YOUR TEXT',
        textColor: '#FFFFFF',
        fontFamily: 'Orbitron',
        fontSize: 80,
        textStyle: 'outline',
        textAnimation: 'bounceIn',
        startSec: Math.round(prev.playheadSec * 100) / 100,
        durationSec: 3.0,
        trimStartSec: 0,
        volume: 0,
        chromaKey: { enabled: false, targetHex: '#00FF00', similarity: 40, smoothness: 15 },
        speedRamp: {
          preset: 'normal',
          points: SPEED_PRESETS.normal.points.map((p) => ({ ...p })),
        },
        keyframes: [
          { id: `${newId}-kf1`, timeOffset: 0, x: 0, y: 0, scale: 1.0, rotation: 0, opacity: 1 },
        ],
      };

      return {
        ...prev,
        tracks: nextTracks,
        selectedClipId: newId,
        clips: [...prev.clips, newClip],
      };
    });
    setActiveSheet('text');
  };

  const handleAddSvgSticker = (name: string, svgMarkup: string, accentHex: string) => {
    const newId = `clip-svg-${Date.now()}`;
    commitProjectChange((prev) => {
      let overlayTrack = prev.tracks.find((t) => t.type === 'overlay');
      const nextTracks = [...prev.tracks];
      if (!overlayTrack) {
        overlayTrack = {
          id: `track-overlay-${Date.now()}`,
          label: 'Layer 1',
          type: 'overlay',
          muted: false,
          locked: false,
          hidden: false,
        };
        nextTracks.push(overlayTrack);
      }

      const svgClip: Clip = {
        id: newId,
        trackId: overlayTrack.id,
        name,
        sourceType: 'svg-sticker',
        svgMarkup,
        svgAccent: accentHex,
        startSec: Math.round(prev.playheadSec * 100) / 100,
        durationSec: 3.0,
        trimStartSec: 0,
        volume: 0,
        chromaKey: { enabled: false, targetHex: '#00FF00', similarity: 40, smoothness: 15 },
        speedRamp: {
          preset: 'normal',
          points: SPEED_PRESETS.normal.points.map((p) => ({ ...p })),
        },
        keyframes: [
          { id: `${newId}-kf1`, timeOffset: 0, x: 0, y: 0, scale: 0.9, rotation: 0, opacity: 1 },
        ],
      };

      return {
        ...prev,
        tracks: nextTracks,
        selectedClipId: newId,
        clips: [...prev.clips, svgClip],
      };
    });
    setActiveSheet('motion');
  };

  const handleImportOnlineMedia = async (
    remoteUrl: string,
    title: string,
    kind: 'audio' | 'video' | 'image',
    proxyUrl?: string,
    asOverlay = true
  ) => {
    const ext =
      kind === 'audio' ? 'mp3' : kind === 'video' ? 'mp4' : 'jpg';
    const fileName = /\.[a-z0-9]{2,5}$/i.test(title) ? title : `${title}.${ext}`;
    const mime =
      kind === 'audio' ? 'audio/mpeg' : kind === 'video' ? 'video/mp4' : 'image/jpeg';
    const file = await fetchRemoteFileAsFile(remoteUrl, fileName, proxyUrl, mime);
    const dt = new DataTransfer();
    dt.items.add(file);
    handleImportDeviceFiles(dt.files, kind === 'audio' ? false : asOverlay);
  };

  const handleImportDirectUrl = async (url: string) => {
    const cleanName = decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'Web Asset').slice(0, 36);
    const lower = url.toLowerCase();
    const kind: 'audio' | 'video' | 'image' = /\.(mp3|wav|ogg|m4a|aac)(\?|$)/.test(lower)
      ? 'audio'
      : /\.(mp4|webm|mov|m4v)(\?|$)/.test(lower)
        ? 'video'
        : 'image';
    await handleImportOnlineMedia(url, cleanName || 'Web Asset', kind, undefined, kind !== 'audio');
  };

  const handlePreviewSegment = (startSec: number) => {
    if (previewTimerRef.current !== null) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    commitProjectChange(
      (prev) => ({
        ...prev,
        playheadSec: Math.max(0, Math.min(totalDuration - 0.1, startSec)),
        isPlaying: true,
      }),
      false
    );
    previewTimerRef.current = window.setTimeout(() => {
      previewTimerRef.current = null;
      commitProjectChange((prev) => ({ ...prev, isPlaying: false }), false);
    }, 1850);
  };

  const handleOpenSmartFx = (sheet: 'effects' | 'transition') => {
    const mainTrack = project.tracks.find((t) => t.type === 'video') ?? project.tracks[0];
    let targetClip =
      project.clips.find(
        (c) =>
          c.sourceType !== 'local-audio' &&
          c.sourceType !== 'demo-audio' &&
          c.sourceType !== 'meme-sfx' &&
          project.playheadSec >= c.startSec &&
          project.playheadSec <= c.startSec + c.durationSec
      ) ?? null;

    if (sheet === 'transition') {
      const mainSorted = project.clips
        .filter((c) => c.trackId === mainTrack.id)
        .sort((a, b) => a.startSec - b.startSec);
      targetClip = mainSorted[1] ?? mainSorted[0] ?? targetClip;
    } else if (!targetClip) {
      targetClip = project.clips.find((c) => c.trackId === mainTrack.id) ?? project.clips[0] ?? null;
    }

    if (!targetClip) {
      setGalleryMode({ mode: 'main' });
      return;
    }

    commitProjectChange(
      (prev) => ({ ...prev, selectedClipId: targetClip!.id }),
      false
    );
    setActiveSheet(sheet);
  };

  const handleApplyIntroOutro = async (tpl: IntroOutroTemplate) => {
    await loadGoogleFont({
      name: tpl.fontFamily,
      category: 'Gaming',
      googleFamily: tpl.fontFamily.replace(/\s+/g, '+'),
      previewText: tpl.headline,
    });

    commitProjectChange((prev) => {
      const mainTrack = prev.tracks.find((t) => t.type === 'video') ?? prev.tracks[0];
      let overlayTrack = prev.tracks.find((t) => t.type === 'overlay');
      const nextTracks = [...prev.tracks];
      if (!overlayTrack) {
        overlayTrack = {
          id: `track-overlay-${Date.now()}`,
          label: 'Layer 1',
          type: 'overlay',
          muted: false,
          locked: false,
          hidden: false,
        };
        nextTracks.push(overlayTrack);
      }

      const thumb = generateStockThumbnailDataUrl(tpl.stockVariant);
      const bgId = `clip-tpl-bg-${Date.now()}`;
      const txtId = `clip-tpl-txt-${Date.now()}`;

      let startAt = 0;
      let shiftedClips = [...prev.clips];

      if (tpl.kind === 'intro') {
        startAt = 0;
        shiftedClips = shiftedClips.map((c) => ({
          ...c,
          startSec: Math.round((c.startSec + tpl.durationSec) * 100) / 100,
        }));
      } else {
        startAt =
          prev.clips.length > 0
            ? Math.max(...prev.clips.map((c) => c.startSec + c.durationSec))
            : 0;
      }

      const bgClip: Clip = {
        id: bgId,
        trackId: mainTrack.id,
        name: tpl.name,
        sourceType: 'stock-clip',
        stockVariant: tpl.stockVariant,
        thumbnails: thumb ? [thumb] : [],
        startSec: startAt,
        durationSec: tpl.durationSec,
        trimStartSec: 0,
        volume: 0,
        transitionIn: { type: 'dissolve', durationSec: 0.4 },
        chromaKey: { enabled: false, targetHex: '#00FF00', similarity: 40, smoothness: 15 },
        speedRamp: {
          preset: 'normal',
          points: SPEED_PRESETS.normal.points.map((p) => ({ ...p })),
        },
        keyframes: [],
      };

      const txtClip: Clip = {
        id: txtId,
        trackId: overlayTrack.id,
        name: `${tpl.headline}`,
        sourceType: 'demo-text',
        textContent: tpl.headline,
        textColor: tpl.colorHex,
        fontFamily: tpl.fontFamily,
        textAnimation: tpl.textAnimation,
        startSec: startAt,
        durationSec: tpl.durationSec,
        trimStartSec: 0,
        volume: 0,
        chromaKey: { enabled: false, targetHex: '#00FF00', similarity: 40, smoothness: 15 },
        speedRamp: {
          preset: 'normal',
          points: SPEED_PRESETS.normal.points.map((p) => ({ ...p })),
        },
        keyframes: [
          { id: `${txtId}-kf1`, timeOffset: 0, x: 0, y: 0, scale: 1.0, rotation: 0, opacity: 1 },
        ],
      };

      return {
        ...prev,
        tracks: nextTracks,
        playheadSec: startAt + 0.4,
        selectedClipId: txtId,
        clips: [...shiftedClips, bgClip, txtClip],
      };
    });
  };

  const handleAddMeme = (item: MemeLibraryItem) => {
    commitProjectChange((prev) => {
      const nextTracks = [...prev.tracks];
      const clipId = `clip-sfx-${Date.now()}`;
      let audioTrack = nextTracks.find((t) => t.type === 'audio');
      if (!audioTrack) {
        audioTrack = {
          id: `track-audio-${Date.now()}`,
          label: 'Audio',
          type: 'audio',
          muted: false,
          locked: false,
          hidden: false,
        };
        nextTracks.push(audioTrack);
      }
      const sfxClip: Clip = {
        id: clipId,
        trackId: audioTrack.id,
        name: item.title,
        sourceType: 'meme-sfx',
        sfxId: item.sfxId,
        waveform: fallbackWaveform(32),
        startSec: Math.round(prev.playheadSec * 100) / 100,
        durationSec: item.durationSec,
        trimStartSec: 0,
        volume: 1,
        chromaKey: { enabled: false, targetHex: '#00FF00', similarity: 40, smoothness: 15 },
        speedRamp: {
          preset: 'normal',
          points: SPEED_PRESETS.normal.points.map((p) => ({ ...p })),
        },
        keyframes: [],
      };
      return {
        ...prev,
        tracks: nextTracks,
        selectedClipId: clipId,
        clips: [...prev.clips, sfxClip],
      };
    });
    setShowMemeLibrary(false);
  };

  const handleAddOnlineMemeImage = async (title: string, imageUrl: string, remoteUrl?: string) => {
    try {
      await handleImportOnlineMedia(remoteUrl || imageUrl, title, 'image', imageUrl, true);
      setActiveSheet('motion');
    } catch {
      const asset: MediaAsset = {
        id: `asset-meme-${Date.now()}`,
        name: title,
        kind: 'image',
        url: imageUrl,
        durationSec: 3.5,
        thumbnails: [imageUrl],
      };
      setDeviceAssets((prev) => [asset, ...prev]);
      appendGalleryItemsToProject(project.id, [{ kind: 'asset', asset }], true);
      setActiveSheet('motion');
    }
  };

  const handleImportDeviceFiles = (files: FileList, autoAppendAsOverlay = false) => {
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      const assetId = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      void saveMediaBlobToDraftDb(assetId, file);
      const isAudio =
        file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(file.name);
      const isImage =
        file.type.startsWith('image/') || /\.(svg|png|jpe?g|webp|gif)$/i.test(file.name);

      if (isImage) {
        const img = new Image();
        img.onload = () => {
          const asset: MediaAsset = {
            id: assetId,
            name: file.name,
            kind: 'image',
            url,
            durationSec: 4.0,
            thumbnails: [url],
          };
          setDeviceAssets((prev) => [asset, ...prev]);
          if (autoAppendAsOverlay) {
            appendGalleryItemsToProject(project.id, [{ kind: 'asset', asset }], true);
          }
        };
        img.src = url;
      } else if (isAudio) {
        const audio = new Audio(url);
        audio.onloadedmetadata = async () => {
          const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 8.0;
          const waveform = await extractAudioWaveform(file, 48);
          const asset: MediaAsset = {
            id: assetId,
            name: file.name,
            kind: 'audio',
            url,
            durationSec: Math.min(180, dur),
            waveform,
          };
          setDeviceAssets((prev) => [asset, ...prev]);
          appendGalleryItemsToProject(project.id, [{ kind: 'asset', asset }], false);
        };
      } else {
        const vid = document.createElement('video');
        vid.preload = 'metadata';
        vid.playsInline = true;
        vid.src = url;
        vid.onloadedmetadata = () => {
          const rawDur = Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 5.0;
          const clampedDur = Math.max(1, Math.min(1800, rawDur));
          const asset: MediaAsset = {
            id: assetId,
            name: file.name,
            kind: 'video',
            url,
            durationSec: clampedDur,
            thumbnails: [],
          };
          setDeviceAssets((prev) => [asset, ...prev]);
          if (autoAppendAsOverlay) {
            appendGalleryItemsToProject(project.id, [{ kind: 'asset', asset }], true);
          }

          // Extract timeline thumbnails lazily in background so large 100MB+ videos never freeze import
          const thumbCount = Math.min(10, Math.max(4, Math.round(clampedDur / 4)));
          void extractVideoThumbnails(url, clampedDur, thumbCount).then((thumbnails) => {
            if (thumbnails.length === 0) return;
            setDeviceAssets((prev) =>
              prev.map((a) => (a.id === assetId ? { ...a, thumbnails } : a))
            );
            setProjects((prevList) =>
              prevList.map((proj) => ({
                ...proj,
                clips: proj.clips.map((c) =>
                  c.assetId === assetId ? { ...c, thumbnails } : c
                ),
              }))
            );
          });
        };
      }
    });
  };

  const appendGalleryItemsToProject = (
    targetProjectId: string,
    items: SelectedGalleryItem[],
    asOverlay: boolean
  ) => {
    setProjects((prevList) =>
      prevList.map((proj) => {
        if (proj.id !== targetProjectId) return proj;
        const nextTracks: Track[] = [...proj.tracks];
        const addedClips: Clip[] = [];
        let lastId: string | null = proj.selectedClipId;

        const mainTrack = nextTracks.find((t) => t.type === 'video') ?? nextTracks[0];
        const existingMain = proj.clips.filter((c) => c.trackId === mainTrack.id);
        let cursorMain =
          existingMain.length > 0
            ? Math.max(...existingMain.map((c) => c.startSec + c.durationSec))
            : 0;

        items.forEach((item, idx) => {
          const clipId = `clip-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`;
          lastId = clipId;

          if (item.kind === 'stock' && item.stock) {
            const thumb = generateStockThumbnailDataUrl(item.stock.variant);
            let targetTrackId = mainTrack.id;
            let startSec = cursorMain;

            if (asOverlay) {
              const overlayTrack: Track =
                nextTracks.find((t) => t.type === 'overlay') ?? {
                  id: `track-overlay-${Date.now()}`,
                  label: 'Layer',
                  type: 'overlay',
                  muted: false,
                  locked: false,
                  hidden: false,
                };
              if (!nextTracks.includes(overlayTrack)) nextTracks.push(overlayTrack);
              targetTrackId = overlayTrack.id;
              startSec = proj.playheadSec;
            } else {
              cursorMain += item.stock.durationSec;
            }

            addedClips.push({
              id: clipId,
              trackId: targetTrackId,
              name: item.stock.name,
              sourceType: 'stock-clip',
              stockVariant: item.stock.variant,
              thumbnails: thumb ? [thumb] : [],
              startSec: Math.round(startSec * 100) / 100,
              durationSec: item.stock.durationSec,
              trimStartSec: 0,
              volume: 0,
              chromaKey: { enabled: false, targetHex: '#00FF00', similarity: 40, smoothness: 15 },
              speedRamp: {
                preset: 'normal',
                points: SPEED_PRESETS.normal.points.map((p) => ({ ...p })),
              },
              keyframes: [
                {
                  id: `${clipId}-kf`,
                  timeOffset: 0,
                  x: 0,
                  y: 0,
                  scale: asOverlay ? 0.65 : 1,
                  rotation: 0,
                  opacity: 1,
                },
              ],
            });
          } else if (item.kind === 'asset' && item.asset) {
            const asset = item.asset;
            let targetTrackId = mainTrack.id;
            let startSec = cursorMain;

            if (asset.kind === 'audio') {
              let audioTrack = nextTracks.find((t) => t.type === 'audio');
              if (!audioTrack) {
                audioTrack = {
                  id: `track-audio-${Date.now()}`,
                  label: 'Audio',
                  type: 'audio',
                  muted: false,
                  locked: false,
                  hidden: false,
                };
                nextTracks.push(audioTrack);
              }
              targetTrackId = audioTrack.id;
              startSec = proj.playheadSec;
            } else if (asOverlay) {
              const overlayTrack: Track = {
                id: `track-overlay-${Date.now()}-${idx}`,
                label: `Layer ${nextTracks.filter((t) => t.type === 'overlay').length + 1}`,
                type: 'overlay',
                muted: false,
                locked: false,
                hidden: false,
              };
              nextTracks.push(overlayTrack);
              targetTrackId = overlayTrack.id;
              startSec = proj.playheadSec;
            } else {
              cursorMain += asset.durationSec;
            }

            if (asset.kind === 'image') {
              const img = new Image();
              if (asset.url.startsWith('http')) {
                img.crossOrigin = 'anonymous';
                img.onerror = () => {
                  const fallback = new Image();
                  fallback.src = asset.url;
                  mediaElementsRef.current.set(clipId, fallback);
                };
              }
              img.src = asset.url;
              mediaElementsRef.current.set(clipId, img);
            } else if (asset.kind === 'video') {
              const vid = document.createElement('video');
              vid.preload = 'auto';
              vid.playsInline = true;
              if (asset.url.startsWith('http://') || asset.url.startsWith('https://')) {
                vid.crossOrigin = 'anonymous';
              }
              vid.src = asset.url;
              vid.load();
              mediaElementsRef.current.set(clipId, vid);
            } else if (asset.kind === 'audio') {
              const aud = new Audio(asset.url);
              aud.preload = 'auto';
              mediaElementsRef.current.set(clipId, aud);
            }

            addedClips.push({
              id: clipId,
              trackId: targetTrackId,
              name: asset.name,
              sourceType:
                asset.kind === 'audio'
                  ? 'local-audio'
                  : asset.kind === 'image'
                    ? 'local-image'
                    : 'local-video',
              mediaUrl: asset.url,
              assetId: asset.id,
              thumbnails: asset.thumbnails,
              waveform: asset.waveform,
              startSec: Math.round(startSec * 100) / 100,
              durationSec: asset.durationSec,
              trimStartSec: 0,
              volume: 1,
              chromaKey: { enabled: false, targetHex: '#00FF00', similarity: 40, smoothness: 15 },
              speedRamp: {
                preset: 'normal',
                points: SPEED_PRESETS.normal.points.map((p) => ({ ...p })),
              },
              keyframes: [
                {
                  id: `${clipId}-kf`,
                  timeOffset: 0,
                  x: 0,
                  y: 0,
                  scale: asOverlay ? 0.65 : 1,
                  rotation: 0,
                  opacity: 1,
                },
              ],
            });
          }
        });

        return {
          ...proj,
          tracks: nextTracks,
          selectedClipId: lastId,
          clips: [...proj.clips, ...addedClips],
        };
      })
    );
  };

  const handleDuplicateProject = (projId: string) => {
    setProjects((prev) => {
      const orig = prev.find((p) => p.id === projId);
      if (!orig) return prev;
      const newId = `proj-${Date.now()}`;
      const cloned: ProjectState = {
        ...orig,
        id: newId,
        name: `${orig.name} Copy`,
        updatedAt: Date.now(),
        isPlaying: false,
        tracks: orig.tracks.map((t) => ({ ...t })),
        clips: orig.clips.map((c) => ({
          ...c,
          keyframes: c.keyframes.map((k) => ({ ...k })),
          speedRamp: {
            ...c.speedRamp,
            points: c.speedRamp.points.map((pt) => ({ ...pt })),
          },
          chromaKey: { ...c.chromaKey },
        })),
      };
      return [cloned, ...prev];
    });
  };

  const handleLaunchPreset = (preset: QuickPresetKind, ratio: AspectRatio) => {
    setUndoStack([]);
    setRedoStack([]);
    if (preset === 'mrbeast-shorts') {
      const antonMeta = GOOGLE_FONT_CATALOG.find((g) => g.name === 'Anton');
      if (antonMeta) void loadGoogleFont(antonMeta);
      const base = createBlankProject('MrBeast Viral Cut', ratio, 60);
      const mainTrack = base.tracks.find((t) => t.type === 'video') ?? base.tracks[0];
      const overlayTrack = base.tracks.find((t) => t.type === 'overlay') ?? base.tracks[1];
      const thumb1 = generateStockThumbnailDataUrl('hyper-warp');
      const thumb2 = generateStockThumbnailDataUrl('synth-horizon');
      const c1Id = `clip-mb1-${Date.now()}`;
      const c2Id = `clip-mb2-${Date.now() + 1}`;
      const txtId = `clip-mbtxt-${Date.now() + 2}`;
      const recipe = CREATOR_TEXT_RECIPES[0];

      const clip1: Clip = {
        id: c1Id,
        trackId: mainTrack.id,
        name: 'Hook Intro',
        sourceType: 'stock-clip',
        stockVariant: 'hyper-warp',
        thumbnails: thumb1 ? [thumb1] : [],
        startSec: 0,
        durationSec: 3.0,
        trimStartSec: 0,
        volume: 0,
        effect: { type: 'shake-impact', intensity: 45 },
        chromaKey: { enabled: false, targetHex: '#00FF00', similarity: 40, smoothness: 15 },
        speedRamp: { preset: 'normal', points: SPEED_PRESETS.normal.points.map((p) => ({ ...p })) },
        keyframes: [],
      };
      const clip2: Clip = {
        id: c2Id,
        trackId: mainTrack.id,
        name: 'Drop Climax',
        sourceType: 'stock-clip',
        stockVariant: 'synth-horizon',
        thumbnails: thumb2 ? [thumb2] : [],
        startSec: 3.0,
        durationSec: 3.5,
        trimStartSec: 0,
        volume: 0,
        transitionIn: { type: 'CrossZoom', durationSec: 0.45 },
        effect: { type: 'zoom-pulse', intensity: 65 },
        chromaKey: { enabled: false, targetHex: '#00FF00', similarity: 40, smoothness: 15 },
        speedRamp: { preset: 'normal', points: SPEED_PRESETS.normal.points.map((p) => ({ ...p })) },
        keyframes: [],
      };
      const txtClip: Clip = {
        id: txtId,
        trackId: overlayTrack.id,
        name: '$10,000 CHALLENGE',
        sourceType: 'demo-text',
        textContent: '$10,000\nCHALLENGE!',
        fontFamily: recipe.fontFamily,
        fontSize: 88,
        textAnimation: 'bounceIn',
        ...recipe.patch,
        startSec: 0.2,
        durationSec: 3.2,
        trimStartSec: 0,
        volume: 0,
        chromaKey: { enabled: false, targetHex: '#00FF00', similarity: 40, smoothness: 15 },
        speedRamp: { preset: 'normal', points: SPEED_PRESETS.normal.points.map((p) => ({ ...p })) },
        keyframes: [
          { id: `${txtId}-kf1`, timeOffset: 0, x: 0, y: -4, scale: 1.0, rotation: -2, opacity: 1 },
        ],
      };
      const mbProj: ProjectState = {
        ...base,
        playheadSec: 0.5,
        selectedClipId: txtId,
        clips: [clip1, clip2, txtClip],
      };
      setProjects((prev) => [mbProj, ...prev]);
      setActiveProjectId(mbProj.id);
      setActiveSheet('text');
      setScreen('editor');
      return;
    }

    if (preset === 'meme-vault') {
      const newProj = createBlankProject(`Meme Edit ${projects.length + 1}`, ratio, 60);
      setProjects((prev) => [newProj, ...prev]);
      setActiveProjectId(newProj.id);
      setActiveSheet(null);
      setScreen('editor');
      setShowMemeLibrary(true);
      return;
    }

    if (preset === 'glitch-intro') {
      const tpl = INTRO_OUTRO_TEMPLATES[0];
      void loadGoogleFont({
        name: tpl.fontFamily,
        category: 'Gaming',
        googleFamily: tpl.fontFamily.replace(/\s+/g, '+'),
        previewText: tpl.headline,
      });
      const base = createBlankProject('Cyber Intro FX', ratio, 60);
      const mainTrack = base.tracks.find((t) => t.type === 'video') ?? base.tracks[0];
      const overlayTrack = base.tracks.find((t) => t.type === 'overlay') ?? base.tracks[1];
      const thumb = generateStockThumbnailDataUrl(tpl.stockVariant);
      const bgId = `clip-tpl-bg-${Date.now()}`;
      const txtId = `clip-tpl-txt-${Date.now()}`;
      const bgClip: Clip = {
        id: bgId,
        trackId: mainTrack.id,
        name: tpl.name,
        sourceType: 'stock-clip',
        stockVariant: tpl.stockVariant,
        thumbnails: thumb ? [thumb] : [],
        startSec: 0,
        durationSec: tpl.durationSec,
        trimStartSec: 0,
        volume: 0,
        effect: { type: 'rgb-glitch', intensity: 65 },
        transitionIn: { type: 'GlitchMemories', durationSec: 0.45 },
        chromaKey: { enabled: false, targetHex: '#00FF00', similarity: 40, smoothness: 15 },
        speedRamp: {
          preset: 'normal',
          points: SPEED_PRESETS.normal.points.map((p) => ({ ...p })),
        },
        keyframes: [],
      };
      const txtClip: Clip = {
        id: txtId,
        trackId: overlayTrack.id,
        name: tpl.headline,
        sourceType: 'demo-text',
        textContent: tpl.headline,
        textColor: tpl.colorHex,
        fontFamily: tpl.fontFamily,
        textAnimation: tpl.textAnimation,
        startSec: 0,
        durationSec: tpl.durationSec,
        trimStartSec: 0,
        volume: 0,
        chromaKey: { enabled: false, targetHex: '#00FF00', similarity: 40, smoothness: 15 },
        speedRamp: {
          preset: 'normal',
          points: SPEED_PRESETS.normal.points.map((p) => ({ ...p })),
        },
        keyframes: [
          { id: `${txtId}-kf1`, timeOffset: 0, x: 0, y: 0, scale: 1.0, rotation: 0, opacity: 1 },
        ],
      };
      const introProj: ProjectState = {
        ...base,
        playheadSec: 0.8,
        selectedClipId: bgId,
        clips: [bgClip, txtClip],
      };
      setProjects((prev) => [introProj, ...prev]);
      setActiveProjectId(introProj.id);
      setActiveSheet('effects');
      setScreen('editor');
      return;
    }

    const demo = createInitialDemoProject();
    const newId = `proj-${Date.now()}`;
    const presetProj: ProjectState = {
      ...demo,
      id: newId,
      name: preset === 'velocity' ? 'Velocity Montage' : 'Keyframes & Chroma',
      aspectRatio: ratio,
      updatedAt: Date.now(),
      playheadSec: preset === 'velocity' ? 4.6 : 1.4,
      selectedClipId: preset === 'velocity' ? 'clip-clutch-hit' : 'clip-text-kill',
    };
    setProjects((prev) => [presetProj, ...prev]);
    setActiveProjectId(newId);
    setActiveSheet(preset === 'velocity' ? 'speed' : 'chroma');
    setScreen('editor');
  };

  const handleLaunchOnlineTemplate = async (tpl: OnlineTemplateItem) => {
    setUndoStack([]);
    setRedoStack([]);

    await loadGoogleFont({
      name: tpl.fontFamily,
      category: 'Gaming',
      googleFamily: tpl.fontFamily.replace(/\s+/g, '+'),
      previewText: tpl.headline,
    }).catch(() => undefined);

    const base = createBlankProject(tpl.title, tpl.aspectRatio, 60);
    const mainTrack = base.tracks.find((t) => t.type === 'video') ?? base.tracks[0];
    const overlayTrack = base.tracks.find((t) => t.type === 'overlay') ?? base.tracks[1];
    const audioTrack = base.tracks.find((t) => t.type === 'audio') ?? base.tracks[2];

    const vidFile = await fetchRemoteFileAsFile(
      tpl.remoteVideoUrl,
      `${tpl.id}.mp4`,
      tpl.videoUrl,
      'video/mp4'
    );
    const vidUrl = URL.createObjectURL(vidFile);
    const vidAssetId = `asset-tpl-${Date.now()}`;
    void saveMediaBlobToDraftDb(vidAssetId, vidFile);

    const probedDur = await new Promise<number>((resolve) => {
      const probe = document.createElement('video');
      probe.preload = 'metadata';
      probe.src = vidUrl;
      probe.onloadedmetadata = () =>
        resolve(Number.isFinite(probe.duration) && probe.duration > 0 ? probe.duration : tpl.durationSec);
      probe.onerror = () => resolve(tpl.durationSec);
      window.setTimeout(() => resolve(tpl.durationSec), 4000);
    });

    const vidClipId = `clip-tplv-${Date.now()}`;
    const vidEl = document.createElement('video');
    vidEl.preload = 'auto';
    vidEl.playsInline = true;
    vidEl.src = vidUrl;
    vidEl.load();
    mediaElementsRef.current.set(vidClipId, vidEl);

    const mainDur = Math.max(3, Math.min(20, probedDur));
    const recipe = CREATOR_TEXT_RECIPES[0];

    const mainClip: Clip = {
      id: vidClipId,
      trackId: mainTrack.id,
      name: tpl.title,
      sourceType: 'local-video',
      mediaUrl: vidUrl,
      assetId: vidAssetId,
      thumbnails: tpl.thumbUrl ? [tpl.thumbUrl] : [],
      startSec: 0,
      durationSec: Math.round(mainDur * 10) / 10,
      trimStartSec: 0,
      volume: 0.75,
      effect: { type: tpl.effectType as VideoEffectType, intensity: 75 },
      transitionIn: { type: tpl.transitionType as TransitionType, durationSec: 0.5 },
      chromaKey: { enabled: false, targetHex: '#00FF00', similarity: 40, smoothness: 15 },
      speedRamp: {
        preset: tpl.id.includes('velocity') ? 'velocity-jump' : 'normal',
        points: (
          tpl.id.includes('velocity')
            ? SPEED_PRESETS['velocity-jump'].points
            : SPEED_PRESETS.normal.points
        ).map((p) => ({ ...p })),
      },
      keyframes: [],
    };

    const txtClipId = `clip-tplt-${Date.now() + 1}`;
    const txtClip: Clip = {
      id: txtClipId,
      trackId: overlayTrack.id,
      name: `Text · ${tpl.headline}`,
      sourceType: 'demo-text',
      textContent: tpl.headline,
      fontFamily: tpl.fontFamily,
      fontSize: 84,
      textAnimation: 'bounceIn',
      ...recipe.patch,
      textColor: tpl.textColor,
      textGradientColor1: tpl.textColor,
      startSec: 0.2,
      durationSec: Math.min(3.6, mainDur),
      trimStartSec: 0,
      volume: 0,
      chromaKey: { enabled: false, targetHex: '#00FF00', similarity: 40, smoothness: 15 },
      speedRamp: {
        preset: 'normal',
        points: SPEED_PRESETS.normal.points.map((p) => ({ ...p })),
      },
      keyframes: [
        { id: `${txtClipId}-kf`, timeOffset: 0, x: 0, y: -4, scale: 1.0, rotation: 0, opacity: 1 },
      ],
    };

    const nextClips: Clip[] = [mainClip, txtClip];

    if (tpl.remoteAudioUrl) {
      try {
        const audFile = await fetchRemoteFileAsFile(
          tpl.remoteAudioUrl,
          `${tpl.id}.mp3`,
          tpl.audioUrl,
          'audio/mpeg'
        );
        const audUrl = URL.createObjectURL(audFile);
        const audAssetId = `asset-tpla-${Date.now()}`;
        void saveMediaBlobToDraftDb(audAssetId, audFile);
        const audClipId = `clip-tpla-${Date.now() + 2}`;
        const audEl = new Audio(audUrl);
        audEl.preload = 'auto';
        mediaElementsRef.current.set(audClipId, audEl);

        nextClips.push({
          id: audClipId,
          trackId: audioTrack.id,
          name: tpl.audioTitle || `${tpl.title} Audio`,
          sourceType: 'local-audio',
          mediaUrl: audUrl,
          assetId: audAssetId,
          waveform: fallbackWaveform(48),
          startSec: 0,
          durationSec: Math.round(mainDur * 10) / 10,
          trimStartSec: 0,
          volume: 0.85,
          chromaKey: { enabled: false, targetHex: '#00FF00', similarity: 40, smoothness: 15 },
          speedRamp: {
            preset: 'normal',
            points: SPEED_PRESETS.normal.points.map((p) => ({ ...p })),
          },
          keyframes: [],
        });
      } catch {
        // video + text template still launches cleanly even if audio endpoint fails
      }
    }

    const newProj: ProjectState = {
      ...base,
      playheadSec: 0.5,
      selectedClipId: vidClipId,
      clips: nextClips,
    };

    setProjects((prev) => [newProj, ...prev]);
    setActiveProjectId(newProj.id);
    setActiveSheet('effects');
    setScreen('editor');

    void extractVideoThumbnails(vidUrl, mainDur, 6).then((thumbs) => {
      if (thumbs.length === 0) return;
      setProjects((prevList) =>
        prevList.map((p) =>
          p.id === newProj.id
            ? {
                ...p,
                clips: p.clips.map((c) =>
                  c.id === vidClipId ? { ...c, thumbnails: thumbs } : c
                ),
              }
            : p
        )
      );
    });
  };

  if (screen === 'home') {
    return (
      <>
        <AnimatePresence>
          {showSplash && <BootSplash onComplete={() => setShowSplash(false)} />}
        </AnimatePresence>
        <CapCutHome
          projects={projects}
          lastSavedAt={lastSavedAt}
          onOpenProject={(id) => {
            setActiveProjectId(id);
            setUndoStack([]);
            setRedoStack([]);
            setActiveSheet(null);
            setScreen('editor');
          }}
          onOpenNewProjectPicker={(ratio) => setGalleryMode({ mode: 'new-project', ratio })}
          onCreateBlankProject={(ratio) => {
            const newProj = createBlankProject(`Project ${projects.length + 1}`, ratio, 60);
            setProjects((prev) => [newProj, ...prev]);
            setActiveProjectId(newProj.id);
            setUndoStack([]);
            setRedoStack([]);
            setActiveSheet(null);
            setScreen('editor');
          }}
          onLaunchPreset={handleLaunchPreset}
          onLaunchOnlineTemplate={handleLaunchOnlineTemplate}
          onDuplicateProject={handleDuplicateProject}
          onDeleteProject={(projId) => {
            setProjects((prev) => {
              const remaining = prev.filter((p) => p.id !== projId);
              if (remaining.length === 0) return prev;
              if (activeProjectId === projId) setActiveProjectId(remaining[0].id);
              return remaining;
            });
          }}
        />

        {galleryMode && (
          <InAppMediaPicker
            title="New Project · Select Videos or Photos"
            deviceAssets={deviceAssets}
            onImportDeviceFiles={handleImportDeviceFiles}
            onConfirmSelection={(items) => {
              const ratio =
                galleryMode.mode === 'new-project' ? galleryMode.ratio : project.aspectRatio;
              const newProj = createBlankProject(`Project ${projects.length + 1}`, ratio, 60);
              setProjects((prev) => [newProj, ...prev]);
              setActiveProjectId(newProj.id);
              setUndoStack([]);
              setRedoStack([]);
              setGalleryMode(null);
              setScreen('editor');
              appendGalleryItemsToProject(newProj.id, items, false);
            }}
            onClose={() => setGalleryMode(null)}
          />
        )}
      </>
    );
  }

  const inspectorSharedProps = {
    selectedClip,
    playheadSec: project.playheadSec,
    aspectRatio: project.aspectRatio,
    activeSheet,
    customFonts,
    onChangeSheet: setActiveSheet,
    onPreviewSegment: handlePreviewSegment,
    onAddSfxItem: handleAddMeme,
    onImportOnlineMedia: handleImportOnlineMedia,
    onOpenMemeHub: () => setShowMemeLibrary(true),
    onApplyIntroOutro: handleApplyIntroOutro,
    onChangeAspectRatio: (aspectRatio: AspectRatio) =>
      commitProjectChange((prev) => ({ ...prev, aspectRatio })),
    onUpdateTransform: (patch: Partial<Omit<Keyframe, 'id' | 'timeOffset'>>) =>
      handleUpsertKeyframe(patch, false),
    onUpdateChromaKey: (patch: Partial<ChromaKeyConfig>) =>
      updateSelectedClip((clip) => ({
        ...clip,
        chromaKey: { ...clip.chromaKey, ...patch },
      })),
    onUpdateSpeedRamp: (preset: SpeedPreset, points: SpeedPoint[]) =>
      updateSelectedClip((clip) => ({
        ...clip,
        speedRamp: { preset, points },
      })),
    onUpdateText: (textContent: string, textColor: string) =>
      updateSelectedClip((clip) => ({
        ...clip,
        name: `Text · ${textContent.split('\n')[0] || 'Text'}`,
        textContent,
        textColor,
      })),
    onUpdateTextProps: (patch: Partial<Clip>) =>
      updateSelectedClip((clip) => ({
        ...clip,
        ...patch,
      })),
    onUpdateTextStyle: (textStyle: TextStylePreset, fontSize?: number) =>
      updateSelectedClip((clip) => ({
        ...clip,
        textStyle,
        fontSize: fontSize ?? clip.fontSize ?? 74,
      })),
    onUpdateSvgColor: (svgAccent: string) =>
      updateSelectedClip((clip) => ({ ...clip, svgAccent })),
    onUpdateFont: (fontFamily: string) =>
      updateSelectedClip((clip) => ({ ...clip, fontFamily })),
    onAddCustomFont: (fontFamily: string) =>
      setCustomFonts((prev) => (prev.includes(fontFamily) ? prev : [fontFamily, ...prev])),
    onUpdateTextAnimation: (textAnimation: TextAnimationType) =>
      updateSelectedClip((clip) => ({ ...clip, textAnimation })),
    onUpdateEffect: (type: VideoEffectType, intensity: number) =>
      updateSelectedClip((clip) => ({
        ...clip,
        effect: { type, intensity },
      })),
    onUpdateTransition: (type: TransitionType, durationSec: number) =>
      updateSelectedClip((clip) => ({
        ...clip,
        transitionIn: { type, durationSec },
      })),
    onApplyTransitionToAll: (type: TransitionType, durationSec: number) =>
      commitProjectChange((prev) => {
        const mainTrack = prev.tracks.find((t) => t.type === 'video');
        if (!mainTrack) return prev;
        const mainSorted = prev.clips
          .filter((c) => c.trackId === mainTrack.id)
          .sort((a, b) => a.startSec - b.startSec);
        const cutClipIds = new Set(mainSorted.slice(1).map((c) => c.id));
        return {
          ...prev,
          clips: prev.clips.map((c) =>
            cutClipIds.has(c.id) ? { ...c, transitionIn: { type, durationSec } } : c
          ),
        };
      }),
    onUpdateCrop: (crop: ClipCrop) =>
      updateSelectedClip((clip) => ({ ...clip, crop })),
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#000000] text-[#F5F5F7]">
      <input
        ref={desktopAudioInputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleImportDeviceFiles(e.target.files, false);
            e.target.value = '';
          }
        }}
      />

      <AnimatePresence>
        {showSplash && <BootSplash onComplete={() => setShowSplash(false)} />}
      </AnimatePresence>

      {/* Pro 3-Zone Studio Top Command Bar */}
      <header className="h-12 px-3 sm:px-4 bg-[#050507] border-b border-[#16161B] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => {
              commitProjectChange((p) => ({ ...p, isPlaying: false }), false);
              setScreen('home');
            }}
            className="flex items-center gap-1.5 text-xs font-medium text-[#A1A1AE] hover:text-white min-h-[36px] px-1.5 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Projects</span>
          </button>

          {isEditingTitle ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setIsEditingTitle(false);
              }}
              className="flex items-center gap-1"
            >
              <input
                autoFocus
                type="text"
                value={project.name}
                onChange={(e) =>
                  commitProjectChange((p) => ({ ...p, name: e.target.value }), false)
                }
                onBlur={() => setIsEditingTitle(false)}
                className="w-32 sm:w-44 px-2 py-1 rounded bg-[#14141A] border border-[#00CAE0] text-xs font-semibold text-white outline-none"
              />
              <button
                type="submit"
                className="p-1 text-[#00CAE0] cursor-pointer"
                aria-label="Save name"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingTitle(true)}
              title="Tap to rename project"
              className="text-xs sm:text-sm font-semibold text-white/90 hover:text-[#00CAE0] truncate max-w-[140px] sm:max-w-[220px] cursor-pointer text-left"
            >
              {project.name}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {lastSavedAt && (
            <span className="hidden md:inline text-[10px] font-mono text-[#6F6F7D]">
              Draft saved
            </span>
          )}
          <button
            type="button"
            onClick={() => setActiveSheet(activeSheet === 'ratio' ? null : 'ratio')}
            className="hidden sm:inline-flex px-2 py-1 rounded bg-[#16161B] hover:bg-[#202028] text-[11px] font-mono text-[#A1A1AE] hover:text-white cursor-pointer"
          >
            {project.aspectRatio}
          </button>
          <button
            type="button"
            onClick={() =>
              commitProjectChange(
                (p) => ({ ...p, fps: p.fps === 60 ? 30 : 60 }),
                false
              )
            }
            className="px-2.5 py-1 rounded bg-[#16161B] hover:bg-[#202028] text-[11px] font-mono tabular-nums text-[#F5F5F7] cursor-pointer"
          >
            1080P · {project.fps}fps
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowExportModal(true)}
          className="px-3.5 py-1.5 min-h-[34px] bg-[#00CAE0] hover:brightness-110 text-black text-xs font-bold rounded-md cursor-pointer whitespace-nowrap shrink-0"
        >
          Export
        </button>
      </header>

      {/* Responsive Split NLE Workbench: Stage Left + Right Inspector Sidebar on Desktop */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        <PreviewStage
          project={project}
          mediaElements={mediaElementsRef.current}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onTogglePlay={() => {
            if (previewTimerRef.current !== null) {
              window.clearTimeout(previewTimerRef.current);
              previewTimerRef.current = null;
            }
            commitProjectChange(
              (prev) => ({
                ...prev,
                isPlaying: !prev.isPlaying,
                playheadSec:
                  prev.playheadSec >= totalDuration - 0.05 ? 0 : prev.playheadSec,
              }),
              false
            );
          }}
          onStepFrame={(deltaFrames) => {
            const stepSec = deltaFrames / project.fps;
            commitProjectChange(
              (prev) => ({
                ...prev,
                isPlaying: false,
                playheadSec: Math.max(
                  0,
                  Math.min(totalDuration, Math.round((prev.playheadSec + stepSec) * 1000) / 1000)
                ),
              }),
              false
            );
          }}
          onAddKeyframe={handleToggleKeyframeAtPlayhead}
          onDragSelectedClip={(x, y) => handleUpsertKeyframe({ x, y }, false)}
          onQuickImport={() => setGalleryMode({ mode: 'main' })}
          onOpenEditText={() => setActiveSheet('text')}
        />

        {/* Desktop Pro Right-Side Inspector Drawer */}
        <div className="hidden lg:flex h-full shrink-0">
          <AnimatePresence mode="wait">
            {activeSheet && (
              <StudioToolInspector
                {...inspectorSharedProps}
                mode="desktop-sidebar"
                onImportAudioClick={() => desktopAudioInputRef.current?.click()}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      <CapCutTimeline
        project={project}
        onSeek={(sec) =>
          commitProjectChange(
            (prev) => ({
              ...prev,
              isPlaying: false,
              playheadSec: Math.max(0, Math.min(totalDuration + 2, sec)),
            }),
            false
          )
        }
        onSelectClip={(clipId) => {
          if (!clipId) setActiveSheet(null);
          commitProjectChange((prev) => ({ ...prev, selectedClipId: clipId }), false);
        }}
        onOpenEditText={(clipId) => {
          commitProjectChange((prev) => ({ ...prev, selectedClipId: clipId }), false);
          setActiveSheet('text');
        }}
        onOpenTransition={(clipId) => {
          commitProjectChange((prev) => ({ ...prev, selectedClipId: clipId }), false);
          setActiveSheet('transition');
        }}
        onToggleTrackFlag={(trackId, flag) =>
          commitProjectChange((prev) => ({
            ...prev,
            tracks: prev.tracks.map((t) =>
              t.id === trackId ? { ...t, [flag]: !t[flag] } : t
            ),
          }))
        }
        onMoveOrTrimClip={(
          clipId,
          startSec,
          durationSec,
          trimStartSec,
          mode: TimelineDragMode
        ) =>
          commitProjectChange(
            (prev) => {
              const target = prev.clips.find((c) => c.id === clipId);
              if (!target) return prev;
              const mainTrack = prev.tracks.find((t) => t.type === 'video');
              const isMain = mainTrack && target.trackId === mainTrack.id;

              if (isMain && mode === 'trim-right') {
                const oldEnd = target.startSec + target.durationSec;
                const newEnd = startSec + durationSec;
                const shiftDelta = newEnd - oldEnd;
                return {
                  ...prev,
                  clips: prev.clips.map((c) => {
                    if (c.id === clipId) {
                      return { ...c, startSec, durationSec, trimStartSec };
                    }
                    if (c.trackId === mainTrack.id && c.startSec >= oldEnd - 0.05) {
                      return {
                        ...c,
                        startSec: Math.max(0, Math.round((c.startSec + shiftDelta) * 100) / 100),
                      };
                    }
                    return c;
                  }),
                };
              }

              return {
                ...prev,
                clips: prev.clips.map((c) =>
                  c.id === clipId ? { ...c, startSec, durationSec, trimStartSec } : c
                ),
              };
            },
            false
          )
        }
        onFinishDrag={(clipId, mode) => {
          if (!clipId || (mode !== 'trim-left' && mode !== 'move-clip')) return;
          commitProjectChange((prev) => {
            const mainTrack = prev.tracks.find((t) => t.type === 'video');
            if (!mainTrack) return prev;
            const target = prev.clips.find((c) => c.id === clipId);
            if (!target || target.trackId !== mainTrack.id) return prev;

            // Sort main track by clip center (start + duration/2) so dragging past neighbor's center swaps cleanly!
            const mainSorted = prev.clips
              .filter((c) => c.trackId === mainTrack.id)
              .sort((a, b) => a.startSec + a.durationSec / 2 - (b.startSec + b.durationSec / 2));
            let cursor = 0;
            const packedMap = new Map<string, number>();
            for (const mc of mainSorted) {
              packedMap.set(mc.id, Math.round(cursor * 100) / 100);
              cursor += mc.durationSec;
            }
            const nextPlayhead = packedMap.has(clipId)
              ? Math.max(0, packedMap.get(clipId)! + 0.05)
              : prev.playheadSec;
            return {
              ...prev,
              playheadSec: nextPlayhead,
              clips: prev.clips.map((c) =>
                packedMap.has(c.id) ? { ...c, startSec: packedMap.get(c.id)! } : c
              ),
            };
          }, true);
        }}
        onReorderMainClip={(clipId, direction) => {
          commitProjectChange((prev) => {
            const mainTrack = prev.tracks.find((t) => t.type === 'video');
            if (!mainTrack) return prev;
            const mainSorted = prev.clips
              .filter((c) => c.trackId === mainTrack.id)
              .sort((a, b) => a.startSec - b.startSec);
            const idx = mainSorted.findIndex((c) => c.id === clipId);
            const swapIdx = idx + direction;
            if (idx < 0 || swapIdx < 0 || swapIdx >= mainSorted.length) return prev;

            const reordered = [...mainSorted];
            const [moved] = reordered.splice(idx, 1);
            reordered.splice(swapIdx, 0, moved);

            let cursor = 0;
            const packedMap = new Map<string, number>();
            for (const mc of reordered) {
              packedMap.set(mc.id, Math.round(cursor * 100) / 100);
              cursor += mc.durationSec;
            }
            return {
              ...prev,
              playheadSec: Math.max(0, (packedMap.get(clipId) ?? 0) + 0.05),
              clips: prev.clips.map((c) =>
                packedMap.has(c.id) ? { ...c, startSec: packedMap.get(c.id)! } : c
              ),
            };
          }, true);
        }}
        onToggleMainMute={() =>
          commitProjectChange((prev) => {
            const main = prev.tracks.find((t) => t.type === 'video');
            if (!main) return prev;
            return {
              ...prev,
              tracks: prev.tracks.map((t) =>
                t.id === main.id ? { ...t, muted: !t.muted } : t
              ),
            };
          })
        }
        onOpenMainGallery={() => setGalleryMode({ mode: 'main' })}
        onOpenQuickAdd={(kind) => {
          if (kind === 'overlay') setGalleryMode({ mode: 'overlay' });
          else if (kind === 'meme') setShowMemeLibrary(true);
          else {
            commitProjectChange((prev) => ({ ...prev, selectedClipId: null }), false);
            setActiveSheet('audio-hub');
          }
        }}
        onChangeZoom={(zoomPxPerSec) =>
          commitProjectChange((prev) => ({ ...prev, zoomPxPerSec }), false)
        }
      />

      <CapCutBottomDock
        {...inspectorSharedProps}
        onOpenSmartFx={handleOpenSmartFx}
        onDeselectClip={() =>
          commitProjectChange((prev) => ({ ...prev, selectedClipId: null }), false)
        }
        onOpenMediaPicker={(mode) => setGalleryMode({ mode })}
        onOpenMemes={() => setShowMemeLibrary(true)}
        onOpenSvgStickers={() => setShowSvgStickers(true)}
        onImportAudio={(files) => handleImportDeviceFiles(files, false)}
        onAddTextClip={handleAddTextClip}
        onSplit={handleSplitAtPlayhead}
        onToggleKeyframe={handleToggleKeyframeAtPlayhead}
        onDuplicate={handleDuplicateSelected}
        onDelete={handleDeleteSelected}
      />

      {galleryMode && (
        <InAppMediaPicker
          title={
            galleryMode.mode === 'overlay'
              ? 'Add Overlay Layer'
              : 'Select Videos or Photos'
          }
          deviceAssets={deviceAssets}
          onImportDeviceFiles={handleImportDeviceFiles}
          onImportOnlineMedia={(remoteUrl, title, kind, proxyUrl) =>
            handleImportOnlineMedia(
              remoteUrl,
              title,
              kind,
              proxyUrl,
              galleryMode.mode === 'overlay'
            )
          }
          onConfirmSelection={(items) => {
            const isOverlay = galleryMode.mode === 'overlay';
            setGalleryMode(null);
            appendGalleryItemsToProject(project.id, items, isOverlay);
          }}
          onClose={() => setGalleryMode(null)}
        />
      )}

      {showMemeLibrary && (
        <MemeLibrarySheet
          onAddMeme={handleAddMeme}
          onAddOnlineMemeImage={handleAddOnlineMemeImage}
          onImportOnlineMedia={handleImportOnlineMedia}
          onImportFiles={(files, asOverlay) => handleImportDeviceFiles(files, Boolean(asOverlay))}
          onImportDirectUrl={handleImportDirectUrl}
          onOpenSvgStickers={() => setShowSvgStickers(true)}
          onClose={() => setShowMemeLibrary(false)}
        />
      )}

      {showSvgStickers && (
        <SvgStickerSheet
          onAddSvgSticker={handleAddSvgSticker}
          onClose={() => setShowSvgStickers(false)}
        />
      )}

      {showExportModal && (
        <ExportModal
          project={project}
          mediaElements={mediaElementsRef.current}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}
