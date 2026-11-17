import type { CSSProperties } from 'react';
import type { WallpaperId } from '../types';

const DOODLE_SVG =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">` +
      `<g fill="none" stroke="#8fb8ff" stroke-opacity="0.11" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">` +
      `<path d="M22 24c-4-6-13-2-10 5 2 4 10 9 10 9s8-5 10-9c3-7-6-11-10-5z"/>` +
      `<path d="M88 14l3.2 6.6 7.2 1-5.2 5 1.3 7.2-6.5-3.5-6.5 3.5 1.3-7.2-5.2-5 7.2-1z"/>` +
      `<path d="M92 82c-2.6-3.9-8.4-1.3-6.5 3.2 1.3 2.6 6.5 5.8 6.5 5.8s5.2-3.2 6.5-5.8c1.9-4.5-3.9-7.1-6.5-3.2z"/>` +
      `<path d="M30 84v14M23 91h14"/><circle cx="60" cy="58" r="1.8"/><circle cx="108" cy="52" r="1.4"/><circle cx="8" cy="64" r="1.4"/>` +
      `<path d="M52 104c3-4 6 4 9 0s6 4 9 0"/>` +
      `</g></svg>`
  );

export const WALLPAPER_CHOICES: Array<{ id: WallpaperId; name: string; swatch: string }> = [
  { id: 'whatsapp-doodle', name: 'Doodle', swatch: 'linear-gradient(135deg,#0c1b36,#18345b)' },
  { id: 'midnight-emerald', name: 'Emerald', swatch: 'linear-gradient(135deg,#071e24,#0b443b)' },
  { id: 'deep-ocean', name: 'Ocean', swatch: 'linear-gradient(135deg,#071a35,#075985)' },
  { id: 'warm-sand', name: 'Sand', swatch: 'linear-gradient(135deg,#4a3322,#a66a37)' },
  { id: 'slate-minimal', name: 'Slate', swatch: 'linear-gradient(135deg,#202a3b,#526175)' },
  { id: 'royal-plum', name: 'Plum', swatch: 'linear-gradient(135deg,#25143e,#633a78)' },
  { id: 'aurora-glow', name: 'Aurora', swatch: 'linear-gradient(135deg,#092b3e,#155e75,#28514a)' },
  { id: 'rose-dawn', name: 'Rose dawn', swatch: 'linear-gradient(135deg,#3f1d3a,#8f4564,#c77962)' },
  { id: 'paper-garden', name: 'Garden', swatch: 'linear-gradient(135deg,#183b31,#59734b)' },
  { id: 'geometric-night', name: 'Geometric', swatch: 'linear-gradient(135deg,#17213e,#384b78)' },
];

const BACKGROUNDS: Record<WallpaperId, string> = {
  'whatsapp-doodle': '#0c1b36',
  'midnight-emerald': 'radial-gradient(ellipse at 20% 15%, rgba(16,185,129,.20), transparent 50%), linear-gradient(145deg,#071e24,#0b443b)',
  'deep-ocean': 'radial-gradient(ellipse at 80% 10%, rgba(56,189,248,.22), transparent 45%), linear-gradient(145deg,#071a35,#075985)',
  'warm-sand': 'radial-gradient(ellipse at 20% 20%, rgba(251,191,36,.20), transparent 45%), linear-gradient(145deg,#4a3322,#a66a37)',
  'slate-minimal': 'linear-gradient(145deg,#202a3b,#526175)',
  'royal-plum': 'radial-gradient(ellipse at 75% 15%, rgba(216,180,254,.18), transparent 48%), linear-gradient(145deg,#25143e,#633a78)',
  'aurora-glow': 'radial-gradient(ellipse at 18% 25%, rgba(34,211,238,.27), transparent 45%), radial-gradient(ellipse at 82% 72%, rgba(52,211,153,.19), transparent 42%), linear-gradient(145deg,#092b3e,#15384a)',
  'rose-dawn': 'radial-gradient(ellipse at 20% 10%, rgba(251,113,133,.28), transparent 43%), linear-gradient(145deg,#3f1d3a,#8f4564 58%,#7d514e)',
  'paper-garden': 'radial-gradient(circle at 20% 25%, rgba(190,220,141,.11) 0 2px, transparent 3px), radial-gradient(circle at 75% 70%, rgba(190,220,141,.10) 0 2px, transparent 3px), linear-gradient(145deg,#183b31,#35583c)',
  'geometric-night': 'linear-gradient(135deg, transparent 48%, rgba(147,197,253,.08) 49% 51%, transparent 52%), linear-gradient(45deg, transparent 48%, rgba(147,197,253,.06) 49% 51%, transparent 52%), linear-gradient(145deg,#17213e,#384b78)',
};

export function getChatWallpaperStyle(id?: WallpaperId, isLight = false): CSSProperties {
  const selected = id || 'whatsapp-doodle';
  const background = isLight && selected === 'whatsapp-doodle' ? '#dce8f7' : BACKGROUNDS[selected];
  return {
    backgroundColor: background.startsWith('#') ? background : undefined,
    backgroundImage: selected === 'whatsapp-doodle' ? `url("${DOODLE_SVG}")` : background,
    backgroundSize: selected === 'whatsapp-doodle' ? '120px 120px' : 'cover',
    backgroundAttachment: 'local',
  };
}

export const CHAT_WALLPAPER_STYLE: CSSProperties = getChatWallpaperStyle();
