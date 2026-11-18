export async function extractVideoThumbnails(
  videoUrl: string,
  durationSec: number,
  count = 6
): Promise<string[]> {
  return new Promise((resolve) => {
    const vid = document.createElement('video');
    vid.src = videoUrl;
    vid.muted = true;
    vid.playsInline = true;
    vid.crossOrigin = 'anonymous';

    const thumbs: string[] = [];
    const safeDur = Math.max(0.5, durationSec);
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 54;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      resolve([]);
      return;
    }

    let current = 0;

    const captureNext = () => {
      if (current >= count) {
        vid.src = '';
        resolve(thumbs);
        return;
      }
      const targetTime = Math.min(safeDur - 0.05, (current / count) * safeDur);
      vid.currentTime = Math.max(0, targetTime);
    };

    vid.onloadeddata = () => {
      captureNext();
    };

    vid.onseeked = () => {
      try {
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        thumbs.push(canvas.toDataURL('image/jpeg', 0.65));
      } catch {
        // Ignore cross-origin draw errors
      }
      current += 1;
      captureNext();
    };

    vid.onerror = () => resolve([]);
    window.setTimeout(() => {
      if (thumbs.length === 0) resolve([]);
    }, 3500);
  });
}

export async function extractAudioWaveform(
  file: File,
  bars = 48
): Promise<number[]> {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return fallbackWaveform(bars);

    const ctx = new AudioCtx();
    const buf = await file.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(buf);
    const channel = audioBuffer.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(channel.length / bars));
    const peaks: number[] = [];

    for (let i = 0; i < bars; i++) {
      let max = 0;
      const start = i * blockSize;
      const end = Math.min(channel.length, start + blockSize);
      for (let j = start; j < end; j += 12) {
        const val = Math.abs(channel[j]);
        if (val > max) max = val;
      }
      peaks.push(Math.max(0.12, Math.min(1, max)));
    }
    void ctx.close();
    return peaks;
  } catch {
    return fallbackWaveform(bars);
  }
}

export function fallbackWaveform(bars = 48): number[] {
  return Array.from({ length: bars }, (_, i) => {
    const v = Math.abs(Math.sin(i * 0.45) * 0.65 + Math.cos(i * 1.1) * 0.35);
    return Math.max(0.15, Math.min(1, v));
  });
}
