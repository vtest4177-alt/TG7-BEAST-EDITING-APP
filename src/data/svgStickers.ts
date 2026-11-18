export interface SvgStickerPreset {
  id: string;
  name: string;
  category: 'HUD' | 'Motion' | 'Creator' | 'Impact';
  defaultColor: string;
  markup: string;
}

export const SVG_STICKER_LIBRARY: SvgStickerPreset[] = [
  {
    id: 'svg-target-hud',
    name: 'Cyber Reticle',
    category: 'HUD',
    defaultColor: '#00CAE0',
    markup: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <circle cx="100" cy="100" r="74" fill="none" stroke="CURRENT" stroke-width="5" stroke-dasharray="28 14"/>
  <circle cx="100" cy="100" r="46" fill="none" stroke="#FFFFFF" stroke-width="3" opacity="0.85"/>
  <circle cx="100" cy="100" r="7" fill="CURRENT"/>
  <path d="M100 10V40M100 160V190M10 100H40M160 100H190" stroke="CURRENT" stroke-width="6" stroke-linecap="round"/>
</svg>`,
  },
  {
    id: 'svg-hud-brackets',
    name: 'HUD Focus Frame',
    category: 'HUD',
    defaultColor: '#00CAE0',
    markup: `<svg viewBox="0 0 240 160" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 54V16H64M176 16H224V54M16 106V144H64M176 144H224V106" fill="none" stroke="CURRENT" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="28" y="26" width="12" height="12" rx="2" fill="#FFFFFF"/>
  <rect x="200" y="122" width="12" height="12" rx="2" fill="CURRENT"/>
</svg>`,
  },
  {
    id: 'svg-neon-arrow',
    name: 'Pointer Arrow',
    category: 'Motion',
    defaultColor: '#FBBF24',
    markup: `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
  <path d="M22 126C48 70 96 46 166 48" fill="none" stroke="CURRENT" stroke-width="14" stroke-linecap="round"/>
  <path d="M134 18L178 48L138 86" fill="none" stroke="CURRENT" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
  },
  {
    id: 'svg-lightning',
    name: 'Voltage Bolt',
    category: 'Impact',
    defaultColor: '#00CAE0',
    markup: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <polygon points="116,12 42,108 98,108 82,188 158,86 104,86" fill="CURRENT" stroke="#FFFFFF" stroke-width="6" stroke-linejoin="round"/>
</svg>`,
  },
  {
    id: 'svg-starburst',
    name: 'Impact Burst',
    category: 'Impact',
    defaultColor: '#F43F5E',
    markup: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <polygon points="100,10 120,62 174,36 146,86 194,110 142,128 164,180 112,150 86,192 80,140 24,158 54,110 10,80 64,74 44,22 90,54" fill="CURRENT" stroke="#FFFFFF" stroke-width="5" stroke-linejoin="round"/>
</svg>`,
  },
  {
    id: 'svg-crown',
    name: 'VIP Crown',
    category: 'Creator',
    defaultColor: '#FBBF24',
    markup: `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
  <path d="M24 126L14 48L62 84L100 26L138 84L186 48L176 126Z" fill="CURRENT" stroke="#FFFFFF" stroke-width="6" stroke-linejoin="round"/>
  <rect x="24" y="132" width="152" height="16" rx="6" fill="#FFFFFF"/>
</svg>`,
  },
  {
    id: 'svg-subscribe-pill',
    name: 'Subscribe Badge',
    category: 'Creator',
    defaultColor: '#EF4444',
    markup: `<svg viewBox="0 0 280 96" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="12" width="264" height="72" rx="18" fill="CURRENT" stroke="#FFFFFF" stroke-width="5"/>
  <polygon points="36,32 36,64 64,48" fill="#FFFFFF"/>
  <text x="164" y="57" text-anchor="middle" font-family="Outfit,sans-serif" font-weight="900" font-size="30" fill="#FFFFFF" letter-spacing="2">SUBSCRIBE</text>
</svg>`,
  },
  {
    id: 'svg-verified',
    name: 'Verified Seal',
    category: 'Creator',
    defaultColor: '#00CAE0',
    markup: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <circle cx="100" cy="100" r="76" fill="CURRENT" stroke="#FFFFFF" stroke-width="7"/>
  <path d="M62 104L88 130L142 74" fill="none" stroke="#000000" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
  },
  {
    id: 'svg-speed-lines',
    name: 'Anime Speed Ring',
    category: 'Motion',
    defaultColor: '#FFFFFF',
    markup: `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
  <g stroke="CURRENT" stroke-linecap="round">
    <line x1="120" y1="8" x2="120" y2="52" stroke-width="6"/>
    <line x1="120" y1="188" x2="120" y2="232" stroke-width="6"/>
    <line x1="8" y1="120" x2="52" y2="120" stroke-width="6"/>
    <line x1="188" y1="120" x2="232" y2="120" stroke-width="6"/>
    <line x1="36" y1="36" x2="72" y2="72" stroke-width="5"/>
    <line x1="168" y1="168" x2="204" y2="204" stroke-width="5"/>
    <line x1="204" y1="36" x2="168" y2="72" stroke-width="5"/>
    <line x1="72" y1="168" x2="36" y2="204" stroke-width="5"/>
    <line x1="75" y1="18" x2="92" y2="58" stroke-width="3"/>
    <line x1="165" y1="18" x2="148" y2="58" stroke-width="3"/>
    <line x1="75" y1="222" x2="92" y2="182" stroke-width="3"/>
    <line x1="165" y1="222" x2="148" y2="182" stroke-width="3"/>
  </g>
</svg>`,
  },
  {
    id: 'svg-rec-live',
    name: 'REC Cam Overlay',
    category: 'HUD',
    defaultColor: '#EF4444',
    markup: `<svg viewBox="0 0 220 90" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="10" width="204" height="70" rx="14" fill="#0A0A0E" fill-opacity="0.82" stroke="#FFFFFF" stroke-width="3"/>
  <circle cx="46" cy="45" r="14" fill="CURRENT"/>
  <text x="128" y="55" text-anchor="middle" font-family="JetBrains Mono,monospace" font-weight="800" font-size="30" fill="#FFFFFF">REC</text>
</svg>`,
  },
  {
    id: 'svg-flame',
    name: 'Cyber Flame',
    category: 'Impact',
    defaultColor: '#F97316',
    markup: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <path d="M104 16C108 54 148 74 148 118C148 156 122 184 96 184C66 184 48 158 48 124C48 92 70 72 80 54C84 74 96 80 100 60C102 42 100 28 104 16Z" fill="CURRENT" stroke="#FFFFFF" stroke-width="5" stroke-linejoin="round"/>
  <path d="M102 102C116 120 124 136 120 154C116 168 102 174 92 170C80 166 76 150 82 134C88 120 96 112 102 102Z" fill="#FDE047"/>
</svg>`,
  },
  {
    id: 'svg-wave-ring',
    name: 'Audio Pulse Ring',
    category: 'Motion',
    defaultColor: '#34D399',
    markup: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <circle cx="100" cy="100" r="82" fill="none" stroke="CURRENT" stroke-width="4" stroke-dasharray="10 10"/>
  <circle cx="100" cy="100" r="62" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-dasharray="32 14"/>
  <circle cx="100" cy="100" r="38" fill="none" stroke="CURRENT" stroke-width="8"/>
</svg>`,
  },
  {
    id: 'svg-comic-boom',
    name: 'BOOM Comic Stamp',
    category: 'Impact',
    defaultColor: '#FBBF24',
    markup: `<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg">
  <polygon points="18,46 66,22 108,38 158,14 218,46 196,86 226,118 164,114 120,132 74,112 20,124 44,82" fill="CURRENT" stroke="#000000" stroke-width="7" stroke-linejoin="round"/>
  <text x="120" y="84" text-anchor="middle" font-family="Outfit,sans-serif" font-weight="900" font-size="38" fill="#000000">BOOM!</text>
</svg>`,
  },
  {
    id: 'svg-cyber-wings',
    name: 'Vector Wings',
    category: 'Creator',
    defaultColor: '#A78BFA',
    markup: `<svg viewBox="0 0 260 140" xmlns="http://www.w3.org/2000/svg">
  <path d="M120 82L22 24L44 62L18 68L54 92L38 112L116 98Z" fill="CURRENT" stroke="#FFFFFF" stroke-width="4" stroke-linejoin="round"/>
  <path d="M140 82L238 24L216 62L242 68L206 92L222 112L144 98Z" fill="CURRENT" stroke="#FFFFFF" stroke-width="4" stroke-linejoin="round"/>
</svg>`,
  },
  {
    id: 'svg-glitch-bars',
    name: 'Glitch Scan Frame',
    category: 'HUD',
    defaultColor: '#00CAE0',
    markup: `<svg viewBox="0 0 260 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="14" y="20" width="140" height="10" fill="CURRENT"/>
  <rect x="92" y="42" width="154" height="14" fill="#F43F5E" fill-opacity="0.9"/>
  <rect x="28" y="68" width="180" height="8" fill="#FFFFFF"/>
  <rect x="64" y="88" width="176" height="12" fill="CURRENT"/>
</svg>`,
  },
  {
    id: 'svg-trophy',
    name: 'Clutch Trophy',
    category: 'Creator',
    defaultColor: '#FBBF24',
    markup: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <path d="M58 34H142V86C142 114 124 134 100 134C76 134 58 114 58 86V34Z" fill="CURRENT" stroke="#FFFFFF" stroke-width="6"/>
  <path d="M58 48H30C30 80 42 96 58 96M142 48H170C170 80 158 96 142 96" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>
  <rect x="90" y="134" width="20" height="28" fill="CURRENT"/>
  <rect x="66" y="162" width="68" height="16" rx="5" fill="#FFFFFF"/>
</svg>`,
  },
];

export function buildColoredSvgMarkup(markup: string, accentHex: string): string {
  return markup.replace(/CURRENT/g, accentHex);
}

export function svgMarkupToDataUrl(markup: string, accentHex = '#00CAE0'): string {
  const colored = buildColoredSvgMarkup(markup, accentHex);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(colored)}`;
}
