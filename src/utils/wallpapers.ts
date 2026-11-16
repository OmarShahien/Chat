import type { ThemeMode, WallpaperId } from '../types';

export interface WallpaperOption {
  id: WallpaperId;
  name: string;
  previewSwatch: string;
}

export const WALLPAPER_OPTIONS: WallpaperOption[] = [
  {
    id: 'whatsapp-doodle',
    name: 'Classic Pattern',
    previewSwatch: 'linear-gradient(135deg, #0b141a 0%, #16252f 100%)',
  },
  {
    id: 'midnight-emerald',
    name: 'Midnight Emerald',
    previewSwatch: 'linear-gradient(135deg, #071b16 0%, #0d3328 100%)',
  },
  {
    id: 'deep-ocean',
    name: 'Deep Ocean',
    previewSwatch: 'linear-gradient(135deg, #091526 0%, #102a45 100%)',
  },
  {
    id: 'warm-sand',
    name: 'Warm Desert',
    previewSwatch: 'linear-gradient(135deg, #1f1916 0%, #332720 100%)',
  },
  {
    id: 'royal-plum',
    name: 'Royal Dusk',
    previewSwatch: 'linear-gradient(135deg, #181124 0%, #2a1c3d 100%)',
  },
  {
    id: 'slate-minimal',
    name: 'Clean Minimal',
    previewSwatch: 'linear-gradient(135deg, #0f171e 0%, #17212b 100%)',
  },
];

// Subtle chat icon/doodle SVG pattern encoded as data URI
const DARK_DOODLE_SVG = `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-opacity='0.035' stroke-width='1.3'%3E%3Cpath d='M14 18h14a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-8l-5 4v-4h-1a4 4 0 0 1-4-4v-8a4 4 0 0 1 4-4z'/%3E%3Ccircle cx='58' cy='22' r='7'/%3E%3Cpath d='M52 54l6-10 6 10z'/%3E%3Cpath d='M18 56a6 6 0 1 0 10-4'/%3E%3Ccircle cx='40' cy='42' r='2.5'/%3E%3C/g%3E%3C/svg%3E")`;

const LIGHT_DOODLE_SVG = `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%2354656f' stroke-opacity='0.075' stroke-width='1.3'%3E%3Cpath d='M14 18h14a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-8l-5 4v-4h-1a4 4 0 0 1-4-4v-8a4 4 0 0 1 4-4z'/%3E%3Ccircle cx='58' cy='22' r='7'/%3E%3Cpath d='M52 54l6-10 6 10z'/%3E%3Cpath d='M18 56a6 6 0 1 0 10-4'/%3E%3Ccircle cx='40' cy='42' r='2.5'/%3E%3C/g%3E%3C/svg%3E")`;

export function getWallpaperStyle(
  wallpaper: WallpaperId = 'whatsapp-doodle',
  theme: ThemeMode = 'dark'
): React.CSSProperties {
  if (theme === 'light') {
    switch (wallpaper) {
      case 'midnight-emerald':
        return { backgroundColor: '#e3f2ed', backgroundImage: LIGHT_DOODLE_SVG };
      case 'deep-ocean':
        return { backgroundColor: '#e4eef7', backgroundImage: LIGHT_DOODLE_SVG };
      case 'warm-sand':
        return { backgroundColor: '#f3ece1', backgroundImage: LIGHT_DOODLE_SVG };
      case 'royal-plum':
        return { backgroundColor: '#efe8f6', backgroundImage: LIGHT_DOODLE_SVG };
      case 'slate-minimal':
        return { backgroundColor: '#f0f2f5' };
      case 'whatsapp-doodle':
      default:
        return { backgroundColor: '#efeae2', backgroundImage: LIGHT_DOODLE_SVG };
    }
  }

  switch (wallpaper) {
    case 'midnight-emerald':
      return { backgroundColor: '#071914', backgroundImage: DARK_DOODLE_SVG };
    case 'deep-ocean':
      return { backgroundColor: '#091422', backgroundImage: DARK_DOODLE_SVG };
    case 'warm-sand':
      return { backgroundColor: '#191412', backgroundImage: DARK_DOODLE_SVG };
    case 'royal-plum':
      return { backgroundColor: '#140f1f', backgroundImage: DARK_DOODLE_SVG };
    case 'slate-minimal':
      return { backgroundColor: '#0b141a' };
    case 'whatsapp-doodle':
    default:
      return { backgroundColor: '#0b141a', backgroundImage: DARK_DOODLE_SVG };
  }
}

export const STATUS_GRADIENTS = [
  'linear-gradient(135deg, #00a884 0%, #005c4b 100%)',
  'linear-gradient(135deg, #2563eb 0%, #1e1b4b 100%)',
  'linear-gradient(135deg, #db2777 0%, #581c87 100%)',
  'linear-gradient(135deg, #ea580c 0%, #7c2d12 100%)',
  'linear-gradient(135deg, #0f766e 0%, #111827 100%)',
  'linear-gradient(135deg, #7c3aed 0%, #312e81 100%)',
];
