import { useEffect } from 'react';
import { motion } from 'motion/react';

interface BootSplashProps {
  onComplete: () => void;
}

export function BootSplash({ onComplete }: BootSplashProps) {
  useEffect(() => {
    const timer = window.setTimeout(onComplete, 1650);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      onClick={onComplete}
      className="fixed inset-0 z-[100] bg-[#000000] flex flex-col items-center justify-center overflow-hidden select-none cursor-pointer"
    >
      {/* Ambient Radial Cyan Glow */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: [0.6, 1.15, 1], opacity: [0, 0.55, 0.35] }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="absolute w-72 h-72 rounded-full bg-[#00CAE0]/30 blur-[80px] pointer-events-none"
      />

      {/* Expanding Shockwave Ring */}
      <motion.div
        initial={{ scale: 0.65, opacity: 0.85 }}
        animate={{ scale: 1.85, opacity: 0 }}
        transition={{ duration: 1.15, ease: [0.16, 1, 0.3, 1] }}
        className="absolute w-32 h-32 rounded-full border-2 border-[#00CAE0]/70 pointer-events-none"
      />

      {/* Neon Cyan TG7 Logo Reveal */}
      <motion.div
        initial={{ scale: 0.45, opacity: 0, rotate: -12 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, mass: 0.9 }}
        className="relative"
      >
        <img
          src="/tg7-logo.png"
          alt="TG7 Editor"
          className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl object-cover shadow-[0_0_45px_rgba(0,202,224,0.45)] border border-[#00CAE0]/40"
        />
      </motion.div>

      {/* Brand Stagger */}
      <motion.div
        initial={{ y: 18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="mt-5 text-center space-y-1"
      >
        <div className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          TG7 <span className="text-[#00CAE0]">EDITOR</span>
        </div>
        <div className="font-mono text-[11px] tracking-[0.26em] uppercase text-[#8E8EA0]">
          PRO MOTION &amp; VIDEO STUDIO
        </div>
      </motion.div>

      {/* Sleek Loading Beam */}
      <div className="mt-7 w-44 h-1 rounded-full bg-[#16161C] overflow-hidden">
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '0%' }}
          transition={{ duration: 1.35, ease: [0.22, 1, 0.36, 1] }}
          className="h-full w-full bg-gradient-to-r from-[#00CAE0] via-[#38BDF8] to-[#34D399]"
        />
      </div>
    </motion.div>
  );
}
