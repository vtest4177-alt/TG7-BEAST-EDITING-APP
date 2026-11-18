import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Smartphone } from 'lucide-react';
import { ApkBuildHub } from './components/ApkBuildHub';
import { BottomSheetTool, CapCutBottomDock } from './components/CapCutBottomDock';
import { CapCutHome } from './components/CapCutHome';
import { CapCutTimeline, TimelineDragMode } from './components/CapCutTimeline';
import { ExportModal } from './components/ExportModal';
import { InAppMediaPicker, SelectedGalleryItem } from './components/InAppMediaPicker';
import { MemeLibrarySheet } from './components/MemeLibrarySheet';
import { PreviewStage } from './components/PreviewStage';
import {
  IntroOutroTemplate,
  loadGoogleFont,
  MemeLibraryItem,
} from './data/assetsCatalog';
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
  Track,
  TransitionType,
  VideoEffectType,
} from './types/editor';

type ScreenMode = 'home' | 'editor' | 'apk';

export default function App() {
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
  const [galleryMode, setGalleryMode] = useState<
    null | { mode: 'new-project'; ratio: AspectRatio } | { mode: 'main' } | { mode: 'overlay' }
  >(null);

  const [undoStack, setUndoStack] = useState<ProjectState[]>([]);
  const [redoStack, setRedoStack] = useState<ProjectState[]>([]);

  const mediaElementsRef = useRef<
    Map<string, HTMLVideoElement | HTMLImageElement | HTMLAudioElement>
  >(new Map());
  const triggeredSfxRef = useRef<Set<string>>(new Set());

  const project =
    projects.find((p) => p.id === activeProjectId) ?? projects[0];
  const totalDuration = getProjectDuration(project);
  const selectedClip =
    project.clips.find((c) => c.id === project.selectedClipId) ?? null;

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

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;
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

    const existingMedia = mediaElementsRef.current.get(selectedClip.id);
    if (existingMedia) {
      mediaElementsRef.current.set(rightClipId, existingMedia);
    }

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
    const existingMedia = mediaElementsRef.current.get(selectedClip.id);
    if (existingMedia) {
      mediaElementsRef.current.set(newId, existingMedia);
    }
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
        fontFamily: 'Outfit',
        textAnimation: 'pop-bounce',
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
      const clipId = `clip-meme-${Date.now()}`;

      if (item.kind === 'sfx') {
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
      }

      let overlayTrack = nextTracks.find((t) => t.type === 'overlay');
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

      const memeClip: Clip = {
        id: clipId,
        trackId: overlayTrack.id,
        name: item.title,
        sourceType: 'meme-clip',
        memeId: item.id,
        memeTopText: item.topText,
        memeBottomText: item.bottomText,
        memeAccent: item.accentHex,
        startSec: Math.round(prev.playheadSec * 100) / 100,
        durationSec: item.durationSec,
        trimStartSec: 0,
        volume: 0,
        chromaKey: {
          enabled: Boolean(item.chromaGreen),
          targetHex: '#00FF00',
          similarity: 46,
          smoothness: 18,
        },
        speedRamp: {
          preset: 'normal',
          points: SPEED_PRESETS.normal.points.map((p) => ({ ...p })),
        },
        keyframes: [
          {
            id: `${clipId}-kf1`,
            timeOffset: 0,
            x: 0,
            y: -8,
            scale: 0.78,
            rotation: 0,
            opacity: 1,
          },
        ],
      };

      return {
        ...prev,
        tracks: nextTracks,
        selectedClipId: clipId,
        clips: [...prev.clips, memeClip],
      };
    });
    setShowMemeLibrary(false);
  };

  const handleImportDeviceFiles = (files: FileList, autoAppendAsOverlay = false) => {
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      const assetId = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const isAudio = file.type.startsWith('audio/');
      const isImage = file.type.startsWith('image/');

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
        vid.onloadedmetadata = async () => {
          const rawDur = Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 5.0;
          const clampedDur = Math.max(1, Math.min(120, rawDur));
          const thumbnails = await extractVideoThumbnails(url, clampedDur, 6);
          const asset: MediaAsset = {
            id: assetId,
            name: file.name,
            kind: 'video',
            url,
            durationSec: clampedDur,
            thumbnails,
          };
          setDeviceAssets((prev) => [asset, ...prev]);
          if (autoAppendAsOverlay) {
            appendGalleryItemsToProject(project.id, [{ kind: 'asset', asset }], true);
          }
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
              img.src = asset.url;
              mediaElementsRef.current.set(clipId, img);
            } else if (asset.kind === 'video') {
              const vid = document.createElement('video');
              vid.preload = 'metadata';
              vid.playsInline = true;
              vid.src = asset.url;
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

  if (screen === 'home') {
    return (
      <>
        <CapCutHome
          projects={projects}
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
          onDeleteProject={(projId) => {
            setProjects((prev) => {
              const remaining = prev.filter((p) => p.id !== projId);
              if (remaining.length === 0) return prev;
              if (activeProjectId === projId) setActiveProjectId(remaining[0].id);
              return remaining;
            });
          }}
          onOpenApkHub={() => setScreen('apk')}
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

  if (screen === 'apk') {
    return <ApkBuildHub onBack={() => setScreen('home')} />;
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#000000] text-[#F5F5F7]">
      {/* Slim CapCut Top Header */}
      <header className="h-12 px-3 sm:px-4 bg-[#000000] border-b border-[#16161B] flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={() => {
            commitProjectChange((p) => ({ ...p, isPlaying: false }), false);
            setScreen('home');
          }}
          className="flex items-center gap-1.5 text-xs font-medium text-[#A1A1AE] hover:text-white min-h-[36px] px-1 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Projects</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              commitProjectChange(
                (p) => ({ ...p, fps: p.fps === 60 ? 30 : 60 }),
                false
              )
            }
            className="px-2.5 py-1 rounded bg-[#16161B] text-[11px] font-mono tabular-nums text-[#F5F5F7] cursor-pointer"
          >
            1080P · {project.fps}fps
          </button>
          <button
            type="button"
            onClick={() => setScreen('apk')}
            aria-label="Open Android APK Builder"
            className="p-1.5 rounded bg-[#16161B] text-[#A1A1AE] hover:text-white cursor-pointer"
          >
            <Smartphone className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowExportModal(true)}
          className="px-3.5 py-1.5 min-h-[34px] bg-[#00CAE0] hover:brightness-110 text-black text-xs font-bold rounded-md cursor-pointer whitespace-nowrap"
        >
          Export
        </button>
      </header>

      <PreviewStage
        project={project}
        mediaElements={mediaElementsRef.current}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onTogglePlay={() =>
          commitProjectChange(
            (prev) => ({
              ...prev,
              isPlaying: !prev.isPlaying,
              playheadSec:
                prev.playheadSec >= totalDuration - 0.05 ? 0 : prev.playheadSec,
            }),
            false
          )
        }
        onAddKeyframe={handleToggleKeyframeAtPlayhead}
        onDragSelectedClip={(x, y) => handleUpsertKeyframe({ x, y }, false)}
        onQuickImport={() => setGalleryMode({ mode: 'main' })}
      />

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
        onOpenTransition={(clipId) => {
          commitProjectChange((prev) => ({ ...prev, selectedClipId: clipId }), false);
          setActiveSheet('transition');
        }}
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

            // Pack Main Track clips cleanly end-to-end so cuts never drift apart
            const mainSorted = prev.clips
              .filter((c) => c.trackId === mainTrack.id)
              .sort((a, b) => a.startSec - b.startSec);
            let cursor = 0;
            const packedMap = new Map<string, number>();
            for (const mc of mainSorted) {
              packedMap.set(mc.id, Math.round(cursor * 100) / 100);
              cursor += mc.durationSec;
            }
            return {
              ...prev,
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
        selectedClip={selectedClip}
        playheadSec={project.playheadSec}
        aspectRatio={project.aspectRatio}
        activeSheet={activeSheet}
        customFonts={customFonts}
        onChangeSheet={setActiveSheet}
        onDeselectClip={() =>
          commitProjectChange((prev) => ({ ...prev, selectedClipId: null }), false)
        }
        onOpenMediaPicker={(mode) => setGalleryMode({ mode })}
        onOpenMemes={() => setShowMemeLibrary(true)}
        onImportAudio={(files) => handleImportDeviceFiles(files, false)}
        onAddSfxItem={handleAddMeme}
        onAddTextClip={handleAddTextClip}
        onApplyIntroOutro={handleApplyIntroOutro}
        onSplit={handleSplitAtPlayhead}
        onToggleKeyframe={handleToggleKeyframeAtPlayhead}
        onDuplicate={handleDuplicateSelected}
        onDelete={handleDeleteSelected}
        onChangeAspectRatio={(aspectRatio) =>
          commitProjectChange((prev) => ({ ...prev, aspectRatio }))
        }
        onUpdateTransform={(patch) => handleUpsertKeyframe(patch, false)}
        onUpdateChromaKey={(patch: Partial<ChromaKeyConfig>) =>
          updateSelectedClip((clip) => ({
            ...clip,
            chromaKey: { ...clip.chromaKey, ...patch },
          }))
        }
        onUpdateSpeedRamp={(preset: SpeedPreset, points: SpeedPoint[]) =>
          updateSelectedClip((clip) => ({
            ...clip,
            speedRamp: { preset, points },
          }))
        }
        onUpdateText={(textContent, textColor) =>
          updateSelectedClip((clip) => ({
            ...clip,
            name: `Text · ${textContent || 'Text'}`,
            textContent,
            textColor,
          }))
        }
        onUpdateFont={(fontFamily) =>
          updateSelectedClip((clip) => ({ ...clip, fontFamily }))
        }
        onAddCustomFont={(fontFamily) =>
          setCustomFonts((prev) => (prev.includes(fontFamily) ? prev : [fontFamily, ...prev]))
        }
        onUpdateTextAnimation={(textAnimation: TextAnimationType) =>
          updateSelectedClip((clip) => ({ ...clip, textAnimation }))
        }
        onUpdateEffect={(type: VideoEffectType, intensity: number) =>
          updateSelectedClip((clip) => ({
            ...clip,
            effect: { type, intensity },
          }))
        }
        onUpdateTransition={(type: TransitionType, durationSec: number) =>
          updateSelectedClip((clip) => ({
            ...clip,
            transitionIn: { type, durationSec },
          }))
        }
        onApplyTransitionToAll={(type: TransitionType, durationSec: number) =>
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
          })
        }
        onUpdateCrop={(crop: ClipCrop) =>
          updateSelectedClip((clip) => ({ ...clip, crop }))
        }
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
          onImportFiles={(files, asOverlay) => handleImportDeviceFiles(files, Boolean(asOverlay))}
          onClose={() => setShowMemeLibrary(false)}
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
