import { useEffect, useRef } from 'react';
import { renderGlEffectPreviewToCanvas } from '../engine/glEffectRenderer';
import { renderGlTransitionPreviewToCanvas } from '../engine/glTransitionRenderer';
import { TransitionType, VideoEffectType } from '../types/editor';

interface EffectThumbProps {
  type: VideoEffectType;
  animate?: boolean;
}

export function EffectVisualThumb({ type, animate = false }: EffectThumbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderGlEffectPreviewToCanvas(canvas, type, 1.15);

    if (!animate || type === 'none') return;
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const t = (now - start) / 1000;
      renderGlEffectPreviewToCanvas(canvas, type, 0.4 + (t % 2.4));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [type, animate]);

  return (
    <div className="relative w-full h-12 rounded-lg overflow-hidden bg-[#09090D] border border-white/10">
      <canvas ref={canvasRef} width={160} height={96} className="w-full h-full object-cover block" />
      <span className="absolute bottom-1 right-1 px-1 rounded bg-black/65 text-[8px] font-mono text-[#00CAE0] pointer-events-none">
        {type === 'none' ? 'RAW' : 'GL'}
      </span>
    </div>
  );
}

interface TransitionThumbProps {
  type: TransitionType;
  animate?: boolean;
}

export function TransitionVisualThumb({ type, animate = false }: TransitionThumbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (type === 'none') {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(0, 0, 80, 96);
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(80, 0, 80, 96);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(79, 0, 2, 96);
        ctx.font = '700 18px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#94A3B8';
        ctx.fillText('A', 40, 48);
        ctx.fillStyle = '#00CAE0';
        ctx.fillText('B', 120, 48);
      }
      return;
    }

    renderGlTransitionPreviewToCanvas(canvas, type, 0.46);

    if (!animate) return;
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const cycle = ((now - start) / 1400) % 1;
      renderGlTransitionPreviewToCanvas(canvas, type, cycle);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [type, animate]);

  return (
    <div className="relative w-full h-11 rounded-lg overflow-hidden bg-[#0A0A0E] border border-white/10">
      <canvas ref={canvasRef} width={160} height={96} className="w-full h-full object-cover block" />
    </div>
  );
}
