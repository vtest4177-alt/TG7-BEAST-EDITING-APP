import { useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { getProjectDuration, renderCompositeFrame } from '../engine/compositor';
import { ProjectState } from '../types/editor';

interface ExportModalProps {
  project: ProjectState;
  mediaElements: Map<string, HTMLVideoElement | HTMLImageElement | HTMLAudioElement>;
  onClose: () => void;
}

export function ExportModal({ project, mediaElements, onClose }: ExportModalProps) {
  const [resolution, setResolution] = useState<'720p' | '1080p'>('1080p');
  const [fps, setFps] = useState<30 | 60>(project.fps);
  const [status, setStatus] = useState<'idle' | 'rendering' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const [androidSaved, setAndroidSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const totalDuration = getProjectDuration(project);

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

  const startExport = async () => {
    cancelledRef.current = false;
    setStatus('rendering');
    setProgress(0);
    setErrorMsg(null);
    setAndroidSaved(false);
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
      setErrorMsg('Canvas 2D context unavailable in this browser.');
      return;
    }

    if (typeof MediaRecorder === 'undefined' || typeof canvas.captureStream !== 'function') {
      setStatus('error');
      setErrorMsg('MediaRecorder export is not supported in this browser.');
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    const stream = canvas.captureStream(fps);
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: resolution === '1080p' ? 8_000_000 : 4_500_000,
    });

    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };

    recorder.onstop = () => {
      if (cancelledRef.current) return;
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setExportedBlob(blob);
      setDownloadUrl(url);
      setProgress(100);
      setStatus('done');
    };

    recorder.start(100);

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
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
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

        <div className="p-5 space-y-5">
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
            <span>Format: WEBM</span>
          </div>

          {status === 'rendering' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#F5F5F7]">Exporting frames...</span>
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
            (window as unknown as { TG7Android?: { saveVideo: (b64: string, name: string) => boolean } })
              .TG7Android ? (
              <button
                type="button"
                onClick={() => {
                  if (!exportedBlob) return;
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    if (typeof reader.result === 'string') {
                      const filename = `${project.name.toLowerCase().replace(/\s+/g, '-')}-tg7.webm`;
                      const ok = (
                        window as unknown as {
                          TG7Android: { saveVideo: (b64: string, name: string) => boolean };
                        }
                      ).TG7Android.saveVideo(reader.result, filename);
                      if (ok) setAndroidSaved(true);
                    }
                  };
                  reader.readAsDataURL(exportedBlob);
                }}
                className="w-full min-h-[44px] bg-[#00CAE0] hover:brightness-110 text-black text-sm font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{androidSaved ? 'Saved to Downloads/TG7 Editor' : 'Save Video to Phone'}</span>
              </button>
            ) : (
              <a
                href={downloadUrl}
                download={`${project.name.toLowerCase().replace(/\s+/g, '-')}-tg7.webm`}
                className="w-full min-h-[44px] bg-[#00CAE0] hover:brightness-110 text-black text-sm font-bold rounded-xl flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Video
              </a>
            )
          ) : (
            <button
              type="button"
              disabled={status === 'rendering'}
              onClick={startExport}
              className="w-full min-h-[44px] bg-[#00CAE0] hover:brightness-110 disabled:opacity-50 text-black text-sm font-bold rounded-xl transition-colors cursor-pointer"
            >
              {status === 'rendering' ? 'Exporting...' : 'Start Export'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
