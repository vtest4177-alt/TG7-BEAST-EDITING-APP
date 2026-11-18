import { useRef, useState } from 'react';
import { SPEED_PRESETS } from '../engine/demoProject';
import { evaluateSpeedAt } from '../engine/compositor';
import { Clip, SpeedPoint, SpeedPreset } from '../types/editor';

interface SpeedCurveEditorProps {
  clip: Clip;
  localTime: number;
  onUpdateSpeedRamp: (preset: SpeedPreset, points: SpeedPoint[]) => void;
}

const SVG_W = 300;
const SVG_H = 120;
const PAD = 12;
const MIN_SPEED = 0.25;
const MAX_SPEED = 4.0;

function speedToY(speed: number): number {
  const norm = (speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED);
  return SVG_H - PAD - norm * (SVG_H - PAD * 2);
}

function yToSpeed(y: number): number {
  const norm = (SVG_H - PAD - y) / (SVG_H - PAD * 2);
  const raw = MIN_SPEED + Math.max(0, Math.min(1, norm)) * (MAX_SPEED - MIN_SPEED);
  return Math.round(raw * 20) / 20;
}

function posToX(pos: number): number {
  return PAD + pos * (SVG_W - PAD * 2);
}

function xToPos(x: number): number {
  return Math.max(0, Math.min(1, (x - PAD) / (SVG_W - PAD * 2)));
}

export function SpeedCurveEditor({ clip, localTime, onUpdateSpeedRamp }: SpeedCurveEditorProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const points = [...clip.speedRamp.points].sort((a, b) => a.position - b.position);
  const clipProgress = Math.max(0, Math.min(1, localTime / Math.max(0.1, clip.durationSec)));
  const currentSpeed = evaluateSpeedAt(points, clipProgress);

  const samplePath = () => {
    const samples = 40;
    const cmds: string[] = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const spd = evaluateSpeedAt(points, t);
      const x = posToX(t);
      const y = speedToY(spd);
      cmds.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return cmds.join(' ');
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingIndex === null || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * SVG_W;
    const relY = ((e.clientY - rect.top) / rect.height) * SVG_H;

    const updated = points.map((pt, idx) => {
      if (idx !== draggingIndex) return pt;
      const isEdge = idx === 0 || idx === points.length - 1;
      const minX = idx === 0 ? 0 : points[idx - 1].position + 0.06;
      const maxX = idx === points.length - 1 ? 1 : points[idx + 1].position - 0.06;
      return {
        position: isEdge ? pt.position : Math.max(minX, Math.min(maxX, xToPos(relX))),
        speed: yToSpeed(relY),
      };
    });
    onUpdateSpeedRamp(clip.speedRamp.preset, updated);
  };

  const baseline1xY = speedToY(1.0);

  return (
    <div className="space-y-3">
      <div className="bg-[#0B0B0D] border border-[#24242C] rounded-lg p-2">
        <div className="flex justify-end px-1 pb-1">
          <span className="text-[11px] font-mono tabular-nums text-[#00CAE0]">
            {currentSpeed.toFixed(2)}x
          </span>
        </div>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full h-28 select-none touch-none cursor-crosshair"
          onPointerMove={handlePointerMove}
          onPointerUp={() => setDraggingIndex(null)}
          onPointerLeave={() => setDraggingIndex(null)}
        >
          <line
            x1={PAD}
            y1={baseline1xY}
            x2={SVG_W - PAD}
            y2={baseline1xY}
            stroke="#24242E"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
          <line
            x1={posToX(clipProgress)}
            y1={PAD}
            x2={posToX(clipProgress)}
            y2={SVG_H - PAD}
            stroke="#FFFFFF"
            strokeOpacity="0.45"
            strokeWidth="1.5"
          />
          <path
            d={samplePath()}
            fill="none"
            stroke="#00CAE0"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {points.map((pt, idx) => (
            <circle
              key={idx}
              cx={posToX(pt.position)}
              cy={speedToY(pt.speed)}
              r={draggingIndex === idx ? 6.5 : 5}
              fill="#0B0B0D"
              stroke="#00CAE0"
              strokeWidth="2.5"
              className="cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => {
                e.stopPropagation();
                (e.target as Element).setPointerCapture(e.pointerId);
                setDraggingIndex(idx);
              }}
            />
          ))}
        </svg>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(Object.keys(SPEED_PRESETS) as SpeedPreset[]).map((presetKey) => {
          const preset = SPEED_PRESETS[presetKey];
          const isSelected = clip.speedRamp.preset === presetKey;
          return (
            <button
              key={presetKey}
              type="button"
              onClick={() =>
                onUpdateSpeedRamp(
                  presetKey,
                  preset.points.map((p) => ({ ...p }))
                )
              }
              className={`px-3 py-1.5 text-xs font-medium rounded-md border whitespace-nowrap shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-[#00CAE0] border-[#00CAE0] text-black font-semibold'
                  : 'bg-[#1C1C22] border-[#2C2C34] text-[#A1A1AE] hover:text-white'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
