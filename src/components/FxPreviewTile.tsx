import { motion } from 'motion/react';
import { TransitionType, VideoEffectType } from '../types/editor';

export function EffectVisualThumb({ type }: { type: VideoEffectType }) {
  return (
    <div className="relative w-full h-12 rounded-lg overflow-hidden bg-[#09090D] border border-white/10">
      {/* Base Miniature Scene */}
      <svg viewBox="0 0 80 48" className="w-full h-full">
        <defs>
          <linearGradient id="fxBase" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#162238" />
            <stop offset="100%" stopColor="#090D16" />
          </linearGradient>
        </defs>
        <rect width="80" height="48" fill="url(#fxBase)" />
        <polygon points="10,44 34,18 52,32 66,22 76,44" fill="#1F3B5B" />
        <circle cx="58" cy="14" r="6" fill="#00CAE0" fillOpacity="0.8" />
      </svg>

      {type === 'rgb-glitch' && (
        <>
          <motion.div
            animate={{ x: [-3, 4, -2, 0] }}
            transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
            className="absolute inset-x-0 top-3 h-2.5 bg-[#F43F5E]/45 mix-blend-screen"
          />
          <motion.div
            animate={{ x: [3, -4, 2, 0] }}
            transition={{ repeat: Infinity, duration: 0.75, ease: 'linear' }}
            className="absolute inset-x-0 bottom-3 h-2.5 bg-[#00CAE0]/50 mix-blend-screen"
          />
        </>
      )}

      {type === 'cyber-prism' && (
        <motion.div
          animate={{ x: [-40, 90] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
          className="absolute inset-y-0 w-7 -skew-x-12 bg-gradient-to-r from-transparent via-[#00CAE0]/55 to-[#A78BFA]/55 blur-[2px]"
        />
      )}

      {type === 'vhs-retro' && (
        <>
          <div
            className="absolute inset-0 opacity-45"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, rgba(0,0,0,0.65) 0px, rgba(0,0,0,0.65) 2px, transparent 2px, transparent 4px)',
            }}
          />
          <motion.div
            animate={{ y: [-6, 48] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }}
            className="absolute inset-x-0 h-2 bg-white/30"
          />
        </>
      )}

      {type === 'motion-blur-zoom' && (
        <motion.div
          animate={{ scale: [0.85, 1.35, 0.85], opacity: [0.4, 0.95, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.1 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="w-10 h-10 rounded-full border-2 border-[#00CAE0]/70" />
        </motion.div>
      )}

      {type === 'shake-impact' && (
        <motion.div
          animate={{ x: [-2.5, 2.5, -2, 2, 0], y: [1.5, -1.5, 2, -2, 0] }}
          transition={{ repeat: Infinity, duration: 0.4 }}
          className="absolute inset-2 rounded border-2 border-[#FBBF24]/80"
        />
      )}

      {type === 'neon-flash' && (
        <motion.div
          animate={{ opacity: [0, 0.85, 0, 0] }}
          transition={{ repeat: Infinity, duration: 1.0 }}
          className="absolute inset-0 bg-white"
        />
      )}

      {type === 'zoom-pulse' && (
        <motion.div
          animate={{ scale: [1, 1.18, 1] }}
          transition={{ repeat: Infinity, duration: 0.85 }}
          className="absolute inset-2 rounded border border-[#34D399]/80"
        />
      )}

      {type === 'edge-glow' && (
        <div className="absolute inset-0 border-[3px] border-[#00CAE0] shadow-[inset_0_0_12px_#00CAE0]" />
      )}

      {type === 'cinematic-teal' && (
        <div className="absolute inset-0 bg-gradient-to-tr from-[#0D9488]/45 via-transparent to-[#F97316]/45" />
      )}

      {type === 'vignette' && (
        <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_35%,rgba(0,0,0,0.92)_100%)]" />
      )}

      {type === 'bw-contrast' && (
        <div className="absolute inset-0 backdrop-grayscale contrast-150 bg-white/5" />
      )}

      {type === 'warm-gold' && (
        <div className="absolute inset-0 bg-[#FBBF24]/28 mix-blend-screen" />
      )}
    </div>
  );
}

export function TransitionVisualThumb({ type }: { type: TransitionType }) {
  return (
    <div className="relative w-full h-11 rounded-lg overflow-hidden bg-[#0A0A0E] border border-white/10">
      {/* Clip A */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1B2A4A] to-[#0B1120] flex items-center justify-center">
        <span className="text-[10px] font-mono text-white/60">A</span>
      </div>

      {/* Animated Clip B Transition Preview */}
      {type === 'none' && (
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[#0F2429] border-l border-white/30 flex items-center justify-center">
          <span className="text-[10px] font-mono text-[#00CAE0]">B</span>
        </div>
      )}

      {type === 'dissolve' && (
        <motion.div
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ repeat: Infinity, duration: 1.6 }}
          className="absolute inset-0 bg-gradient-to-br from-[#0E3A42] to-[#06181E] flex items-center justify-center"
        >
          <span className="text-[10px] font-mono text-[#00CAE0]">B</span>
        </motion.div>
      )}

      {type === 'flash-white' && (
        <motion.div
          animate={{ opacity: [0, 1, 0] }}
          transition={{ repeat: Infinity, duration: 1.3 }}
          className="absolute inset-0 bg-white"
        />
      )}

      {type === 'fade-black' && (
        <motion.div
          animate={{ opacity: [0, 1, 0] }}
          transition={{ repeat: Infinity, duration: 1.4 }}
          className="absolute inset-0 bg-black"
        />
      )}

      {type === 'zoom-in' && (
        <motion.div
          animate={{ scale: [0.35, 1.15, 0.35], opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.3 }}
          className="absolute inset-2 rounded bg-[#00CAE0]/30 border border-[#00CAE0] flex items-center justify-center"
        >
          <span className="text-[9px] font-mono text-white">ZOOM</span>
        </motion.div>
      )}

      {type === 'zoom-out' && (
        <motion.div
          animate={{ scale: [1.5, 0.7, 1.5], opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.3 }}
          className="absolute inset-2 rounded bg-[#A78BFA]/30 border border-[#A78BFA] flex items-center justify-center"
        >
          <span className="text-[9px] font-mono text-white">OUT</span>
        </motion.div>
      )}

      {type === 'slide-left' && (
        <motion.div
          animate={{ x: ['100%', '0%', '-100%'] }}
          transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
          className="absolute inset-0 bg-[#0D3138] border-l-2 border-[#00CAE0] flex items-center justify-center"
        >
          <span className="text-[10px] font-mono text-[#00CAE0]">B</span>
        </motion.div>
      )}

      {type === 'slide-up' && (
        <motion.div
          animate={{ y: ['100%', '0%', '-100%'] }}
          transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
          className="absolute inset-0 bg-[#0D3138] border-t-2 border-[#00CAE0] flex items-center justify-center"
        >
          <span className="text-[10px] font-mono text-[#00CAE0]">B</span>
        </motion.div>
      )}

      {type === 'spin-cut' && (
        <motion.div
          animate={{ rotate: [0, 180, 360], scale: [0.7, 1, 0.7] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
          className="absolute inset-2 rounded bg-[#00CAE0]/25 border border-[#00CAE0] flex items-center justify-center"
        >
          <span className="text-[9px] font-mono text-white">SPIN</span>
        </motion.div>
      )}

      {type === 'circle-wipe' && (
        <motion.div
          animate={{ scale: [0.15, 1.45, 0.15] }}
          transition={{ repeat: Infinity, duration: 1.4 }}
          className="w-8 h-8 rounded-full bg-[#00CAE0]/35 border-2 border-[#00CAE0] m-auto mt-1.5"
        />
      )}

      {type === 'diamond-wipe' && (
        <motion.div
          animate={{ scale: [0.2, 1.4, 0.2], rotate: [45, 45, 45] }}
          transition={{ repeat: Infinity, duration: 1.4 }}
          className="w-7 h-7 bg-[#FBBF24]/35 border-2 border-[#FBBF24] m-auto mt-2"
        />
      )}

      {type === 'glitch-cut' && (
        <motion.div
          animate={{ x: [-6, 6, -4, 0], opacity: [0.4, 1, 0.6, 1] }}
          transition={{ repeat: Infinity, duration: 0.75 }}
          className="absolute inset-0 bg-gradient-to-r from-[#F43F5E]/40 via-[#00CAE0]/35 to-transparent"
        />
      )}
    </div>
  );
}
