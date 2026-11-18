import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, FolderDown, Share2, X } from 'lucide-react';
import { getProjectDuration, renderCompositeFrame } from '../engine/compositor';
import { ProjectState } from '../types/editor';

interface ExportModalProps {
  project: ProjectState;
  mediaElements: Map<string, HTMLVideoElement | HTMLImageElement | HTMLAudioElement>;
  onClose: () => void;
}

interface TG7AndroidWindow extends Window {
  TG7Android?: {
    saveVideo?: (b64: string, name: string) => boolean;
    saveVideoWithMime?: (b64: string, name: string, mime?: string) => boolean;
    shareVideo?: (b64: string, name: string, mime?: string) => boolean;
  };
}

function pickSupportedRecorderMime(): { mimeType: string; ext: 'mp4' | 'webm' } {
  const candidates: { mimeType: string; ext: 'mp4' | 'webm' }[] = [
    { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' },
    { mimeType: 'video/mp4', ext: 'mp4' },
    { mimeType: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { mimeType: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { mimeType: 'video/webm', ext: 'webm' },
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.mimeType)) {
      return c;
    }
  }
  return { mimeType: 'video/webm', ext: 'webm' };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not encode video'));
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

export function ExportModal({ project, mediaElements, onClose }: ExportModalProps) {
  const [resolution, setResolution] = useState<'720p' | '1080p'>('1080p');
  const [fps, setFps] = useState<30 | 60>(project.fps);
  const [status, setStatus] = useState<'idle' | 'rendering' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const [exportedFileName, setExportedFileName] = useState<string>('tg7-export.webm');
  const [exportedMime, setExportedMime] = useState<string>('video/webm');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cancelledRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const totalDuration = getProjectDuration(project);
  const hasAndroidBridge = Boolean((window as unknown as TG7AndroidWindow).TG7Android);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      void audioCtxRef.current?.close().catch(() => undefined);
    };
  }, [downloadUrl]);

  const getExportDimensions = () => {
    const base = resolution === '1080p' ? 1080 : 720;
    if (project.aspectRatio === '16:9') {
      return { w: Math.round((base * 16) / 9), h: base };
    }
    if (project.aspectRatio === '9:16') {
      return { w: base, h: Math.round((base * 16) / 9) };
    }
    return { w: base, h: base };
  };

  const saveInsideAndroidApk = async (blob: Blob, fileName: string, mimeType: string) => {
    const bridge = (window as unknown as TG7AndroidWindow).TG7Android;
    if (!bridge) return false;
    try {
      const dataUrl = await blobToDataUrl(blob);
      const ok = bridge.saveVideoWithMime
        ? bridge.saveVideoWithMime(dataUrl, fileName, mimeType)
        : bridge.saveVideo
          ? bridge.saveVideo(dataUrl, fileName)
          : false;
      if (ok) {
        setSaveMessage('Saved directly to Phone Gallery (Movies/TG7 Editor)');
      }
      return ok;
    } catch {
      return false;
    }
  };

  const handleShareOrSaveNative = async () => {
    if (!exportedBlob) return;
    const bridge = (window as unknown as TG7AndroidWindow).TG7Android;

    if (bridge?.shareVideo) {
      const dataUrl = await blobToDataUrl(exportedBlob);
      bridge.shareVideo(dataUrl, exportedFileName, exportedMime);
      return;
    }

    const file = new File([exportedBlob], exportedFileName, { type: exportedMime });
    const nav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
      share?: (data: ShareData) => Promise<void>;
    };

    if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
      try {
        await nav.share({
          files: [file],
          title: project.name,
        });
        setSaveMessage('Shared / Saved via device sheet');
        return;
      } catch {
        // user dismissed share or unsupported; fall through to folder picker
      }
    }

    const winWithPicker = window as unknown as {
      showSaveFilePicker?: (opts: {
        suggestedName: string;
        types: { description: string; accept: Record<string, string[]> }[];
      }) => Promise<{
        createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
      }>;
    };

    if (winWithPicker.showSaveFilePicker) {
      try {
        const handle = await winWithPicker.showSaveFilePicker({
          suggestedName: exportedFileName,
          types: [
            {
              description: 'Video File',
              accept: { [exportedMime.split(';')[0]]: [`.${exportedFileName.endsWith('.mp4') ? 'mp4' : 'webm'}`] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(exportedBlob);
        await writable.close();
        setSaveMessage('Saved to chosen folder');
        return;
      } catch {
        return;
      }
    }

    if (downloadUrl) {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = exportedFileName;
      a.click();
      setSaveMessage('Saved to device');
    }
  };

  const handleSaveToFolder = async () => {
    if (!exportedBlob) return;
    if (hasAndroidBridge) {
      await saveInsideAndroidApk(exportedBlob, exportedFileName, exportedMime);
      return;
    }
    const winWithPicker = window as unknown as {
      showSaveFilePicker?: (opts: { suggestedName: string }) => Promise<{
        createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
      }>;
    };
    if (winWithPicker.showSaveFilePicker) {
      try {
        const handle = await winWithPicker.showSaveFilePicker({ suggestedName: exportedFileName });
        const writable = await handle.createWritable();
        await writable.write(exportedBlob);
        await writable.close();
        setSaveMessage('Saved directly to device folder');
        return;
      } catch {
        return;
      }
    }
    await handleShareOrSaveNative();
  };

  const prepareAudioExportTrack = async (): Promise<MediaStreamTrack | null> => {
    const audioClips = project.clips.filter((c) => {
      const tr = project.tracks.find((t) => t.id === c.trackId);
      if (tr?.muted || tr?.hidden) return false;
      return (c.sourceType === 'local-audio' || c.sourceType === 'local-video') && c.mediaUrl;
    });
    if (audioClips.length === 0) return null;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const actx = new AudioCtx();
      audioCtxRef.current = actx;
      const dest = actx.createMediaStreamDestination();

      await Promise.all(
        audioClips.map(async (clip) => {
          if (!clip.mediaUrl) return;
          try {
            const resp = await fetch(clip.mediaUrl);
            const arr = await resp.arrayBuffer();
            const decoded = await actx.decodeAudioData(arr);
            const src = actx.createBufferSource();
            src.buffer = decoded;
            const gain = actx.createGain();
            gain.gain.value = Math.max(0, Math.min(1, clip.volume ?? 1));
            src.connect(gain);
            gain.connect(dest);
            const offset = Math.max(0, clip.trimStartSec || 0);
            const dur = Math.min(clip.durationSec, Math.max(0.1, decoded.duration - offset));
            src.start(actx.currentTime + Math.max(0, clip.startSec), offset, dur);
          } catch {
            // skip undecodable audio clip
          }
        })
      );

      return dest.stream.getAudioTracks()[0] ?? null;
    } catch {
      return null;
    }
  };

  const startExport = async () => {
    cancelledRef.current = false;
    setStatus('rendering');
    setProgress(0);
    setErrorMsg(null);
    setSaveMessage(null);
    setExportedBlob(null);
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }

    const { w, h } = getExportDimensions();
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setStatus('error');
      setErrorMsg('Canvas 2D context unavailable.');
      return;
    }

    if (typeof MediaRecorder === 'undefined' || typeof canvas.captureStream !== 'function') {
      setStatus('error');
      setErrorMsg('Video export is not supported in this browser.');
      return;
    }

    const { mimeType, ext } = pickSupportedRecorderMime();
    const safeSlug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tg7-edit';
    const fileName = `${safeSlug}.${ext}`;
    setExportedFileName(fileName);
    setExportedMime(mimeType);

    const videoStream = canvas.captureStream(fps);
    const audioTrack = await prepareAudioExportTrack();
    const tracks = [...videoStream.getVideoTracks(), ...(audioTrack ? [audioTrack] : [])];
    const combinedStream = new MediaStream(tracks);

    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: resolution === '1080p' ? 8_000_000 : 4_500_000,
    });

    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };

    recorder.onstop = async () => {
      void audioCtxRef.current?.close().catch(() => undefined);
      if (cancelledRef.current) return;
      const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
      const url = URL.createObjectURL(blob);
      setExportedBlob(blob);
      setDownloadUrl(url);
      setProgress(100);
      setStatus('done');

      if (hasAndroidBridge) {
        await saveInsideAndroidApk(blob, fileName, mimeType.split(';')[0]);
      }
    };

    recorder.start(120);

    const frameIntervalMs = 1000 / fps;
    const totalFrames = Math.ceil(totalDuration * fps);

    for (let frame = 0; frame <= totalFrames; frame++) {
      if (cancelledRef.current) {
        if (recorder.state !== 'inactive') recorder.stop();
        return;
      }
      const timeSec = (frame / totalFrames) * totalDuration;
      renderCompositeFrame(ctx, w, h, project, mediaElements, timeSec);
      setProgress(Math.min(99, Math.round((frame / totalFrames) * 100)));
      await new Promise((resolve) => window.setTimeout(resolve, frameIntervalMs));
    }

    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  const handleClose = () => {
    cancelledRef.current = true;
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Export TG7 video"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md bg-[#121216] border border-[#24242C] rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-[#1E1E24] flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-[#F5F5F7]">
            Export Video
          </h2>
          <button
            type="button"
            aria-label="Close export modal"
            onClick={handleClose}
            className="p-1.5 text-[#8E8EA0] hover:text-[#F5F5F7] rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {status !== 'done' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="text-xs text-[#8E8EA0]">Resolution</div>
                  <div className="flex gap-1.5">
                    {(['720p', '1080p'] as const).map((res) => (
                      <button
                        key={res}
                        type="button"
                        disabled={status === 'rendering'}
                        onClick={() => setResolution(res)}
                        className={`flex-1 py-2 text-xs font-mono rounded-lg border cursor-pointer ${
                          resolution === res
                            ? 'bg-[#00CAE0]/15 border-[#00CAE0] text-[#00CAE0]'
                            : 'bg-[#08080A] border-[#24242C] text-[#8E8EA0]'
                        }`}
                      >
                        {res}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs text-[#8E8EA0]">Frame Rate</div>
                  <div className="flex gap-1.5">
                    {([30, 60] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        disabled={status === 'rendering'}
                        onClick={() => setFps(f)}
                        className={`flex-1 py-2 text-xs font-mono rounded-lg border cursor-pointer ${
                          fps === f
                            ? 'bg-[#00CAE0]/15 border-[#00CAE0] text-[#00CAE0]'
                            : 'bg-[#08080A] border-[#24242C] text-[#8E8EA0]'
                        }`}
                      >
                        {f} fps
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="text-xs font-mono tabular-nums text-[#8E8EA0] flex items-center justify-between border-t border-b border-[#1E1E24] py-2.5">
                <span>Duration: {totalDuration.toFixed(1)}s</span>
                <span>Aspect: {project.aspectRatio}</span>
                <span>{resolution} · {fps}fps</span>
              </div>
            </>
          )}

          {status === 'rendering' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#F5F5F7]">Rendering video &amp; audio...</span>
                <span className="font-mono tabular-nums text-[#00CAE0]">{progress}%</span>
              </div>
              <div className="h-2 bg-[#08080A] border border-[#24242C] rounded-full overflow-hidden">
                <div
                  style={{ width: `${progress}%` }}
                  className="h-full bg-[#00CAE0] transition-[width] duration-100"
                />
              </div>
            </div>
          )}

          {status === 'error' && errorMsg && (
            <p className="text-xs text-[#F87171] bg-[#2B1418] border border-[#F87171]/40 rounded-lg p-3">
              {errorMsg}
            </p>
          )}

          {status === 'done' && downloadUrl ? (
            <div className="space-y-3">
              <div className="rounded-xl overflow-hidden bg-black border border-[#24242C] max-h-56 flex items-center justify-center">
                <video
                  src={downloadUrl}
                  controls
                  playsInline
                  className="max-h-56 w-auto mx-auto"
                />
              </div>

              {saveMessage && (
                <div className="flex items-center gap-2 text-xs text-[#34D399] bg-[#0B221A] border border-[#194735] rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{saveMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void handleShareOrSaveNative()}
                  className="w-full min-h-[44px] bg-[#00CAE0] hover:brightness-110 text-black text-sm font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{hasAndroidBridge ? 'Share Video' : 'Save / Share'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveToFolder()}
                  className="w-full min-h-[44px] bg-[#1C1C24] hover:bg-[#262632] border border-[#2E2E3A] text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FolderDown className="w-4 h-4 text-[#00CAE0]" />
                  <span>{hasAndroidBridge ? 'Save Gallery Again' : 'Save to Folder'}</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={status === 'rendering'}
              onClick={startExport}
              className="w-full min-h-[44px] bg-[#00CAE0] hover:brightness-110 disabled:opacity-50 text-black text-sm font-bold rounded-xl transition-colors cursor-pointer"
            >
              {status === 'rendering' ? 'Exporting...' : 'Export & Save to Device'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
