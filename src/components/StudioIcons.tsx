import React from 'react';

interface IconProps {
  className?: string;
}

export function SvgMediaIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <rect x="2.5" y="4" width="19" height="16" rx="3" stroke="#00CAE0" strokeWidth="1.8" fill="#00CAE0" fillOpacity="0.14" />
      <polygon points="10,8.5 16,12 10,15.5" fill="#FFFFFF" />
      <path d="M5 7.5H6.5M5 12H6.5M5 16.5H6.5" stroke="#00CAE0" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function SvgAudioIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path d="M4 13V11M8 16V8M12 19V5M16 15V9M20 13V11" stroke="#34D399" strokeWidth="2.1" strokeLinecap="round" />
      <circle cx="12" cy="5" r="1.4" fill="#FFFFFF" />
    </svg>
  );
}

export function SvgTextIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <rect x="3" y="3.5" width="18" height="17" rx="3.5" fill="#FFFFFF" fillOpacity="0.08" stroke="#FFFFFF" strokeOpacity="0.25" strokeWidth="1.4" />
      <path d="M7.5 8.5H16.5M12 8.5V16.5M9.5 16.5H14.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
      <circle cx="17.5" cy="16" r="1.8" fill="#00CAE0" />
    </svg>
  );
}

export function SvgLayerIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path d="M12 3.5L20.5 8L12 12.5L3.5 8L12 3.5Z" fill="#A78BFA" fillOpacity="0.35" stroke="#A78BFA" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M3.5 12.5L12 17L20.5 12.5" stroke="#00CAE0" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 16.5L12 21L20.5 16.5" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SvgStickerIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <polygon points="12,2.5 14.9,8.4 21.4,9.3 16.7,13.9 17.8,20.4 12,17.3 6.2,20.4 7.3,13.9 2.6,9.3 9.1,8.4" fill="#38BDF8" fillOpacity="0.25" stroke="#38BDF8" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.2" fill="#FFFFFF" />
    </svg>
  );
}

export function SvgMemeIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <rect x="3" y="4" width="18" height="16" rx="4" fill="#FBBF24" fillOpacity="0.16" stroke="#FBBF24" strokeWidth="1.7" />
      <path d="M8 10L10.5 11.5L8 13M16 10L13.5 11.5L16 13" stroke="#FFFFFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 15.5C10.5 17 13.5 17 15 15.5" stroke="#FBBF24" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function SvgEffectsIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path d="M12 3L14.3 9.7L21 12L14.3 14.3L12 21L9.7 14.3L3 12L9.7 9.7L12 3Z" fill="#A78BFA" fillOpacity="0.28" stroke="#A78BFA" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="18.5" cy="5.5" r="1.5" fill="#00CAE0" />
      <circle cx="5.5" cy="18.5" r="1.2" fill="#F472B6" />
    </svg>
  );
}

export function SvgTransitionIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <rect x="3" y="5" width="7.5" height="14" rx="2" fill="#00CAE0" fillOpacity="0.22" stroke="#00CAE0" strokeWidth="1.6" />
      <rect x="13.5" y="5" width="7.5" height="14" rx="2" fill="#FFFFFF" fillOpacity="0.1" stroke="#FFFFFF" strokeWidth="1.6" />
      <polygon points="10.5,9 13.5,12 10.5,15" fill="#00CAE0" />
      <polygon points="13.5,9 10.5,12 13.5,15" fill="#FFFFFF" />
    </svg>
  );
}

export function SvgIntroIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <rect x="3" y="5" width="18" height="14" rx="3" fill="#34D399" fillOpacity="0.14" stroke="#34D399" strokeWidth="1.7" />
      <path d="M3 9.5H21M7.5 5L10 9.5M13.5 5L16 9.5" stroke="#34D399" strokeWidth="1.6" />
      <polygon points="10.5,12 15.5,14.5 10.5,17" fill="#FFFFFF" />
    </svg>
  );
}

export function SvgScissorsIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <circle cx="6.5" cy="7" r="2.7" stroke="#FFFFFF" strokeWidth="1.8" />
      <circle cx="6.5" cy="17" r="2.7" stroke="#FFFFFF" strokeWidth="1.8" />
      <path d="M8.8 8.6L19.5 16.5M8.8 15.4L19.5 7.5" stroke="#00CAE0" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function SvgSpeedIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path d="M4.5 16.5A8.5 8.5 0 1 1 19.5 16.5" stroke="#00CAE0" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 14L16.8 8.8" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="14.5" r="2" fill="#00CAE0" />
    </svg>
  );
}

export function SvgKeyframeIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <polygon points="12,3 20.5,12 12,21 3.5,12" fill="#FBBF24" fillOpacity="0.28" stroke="#FBBF24" strokeWidth="1.9" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.2" fill="#FFFFFF" />
    </svg>
  );
}

export function SvgChromaIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" fill="#34D399" fillOpacity="0.22" stroke="#34D399" strokeWidth="1.7" />
      <circle cx="12" cy="10.5" r="2.8" fill="#FFFFFF" />
      <path d="M7.5 17.5C8.5 15 15.5 15 16.5 17.5" fill="#FFFFFF" />
    </svg>
  );
}

export function SvgCropIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path d="M7 3V17H21" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 7H17V21" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SvgMotionIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path d="M12 3V21M3 12H21" stroke="#00CAE0" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9.5 5.5L12 3L14.5 5.5M9.5 18.5L12 21L14.5 18.5M5.5 9.5L3 12L5.5 14.5M18.5 9.5L21 12L18.5 14.5" stroke="#FFFFFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SvgFontIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path d="M5 18L10 6H12L17 18M6.8 14H15.2" stroke="#00CAE0" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 11.5V18.5M15.5 15H21.5" stroke="#FFFFFF" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function SvgRatioIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" stroke="#FFFFFF" strokeWidth="1.7" />
      <rect x="7" y="8.5" width="10" height="7" rx="1" fill="#00CAE0" fillOpacity="0.28" stroke="#00CAE0" strokeWidth="1.4" />
    </svg>
  );
}
