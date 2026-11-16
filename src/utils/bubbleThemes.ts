export type BubbleThemeId =
  | 'blue'
  | 'emerald'
  | 'purple'
  | 'sunset'
  | 'rose'
  | 'amber'
  | 'neon'
  | 'midnight'
  | 'lavender';

export interface BubbleTheme {
  id: BubbleThemeId;
  name: string;
  description: string;
  previewColor: string;
  // Outgoing styling (sender's bubble)
  outgoingBg: string;
  outgoingText: string;
  outgoingTime: string;
  outgoingCheck: string;
  outgoingReplyBg: string;
  outgoingReplyBorder: string;
  // Incoming styling (when others view this sender's bubble)
  incomingBg: string;
  incomingText: string;
  incomingTime: string;
  incomingName: string;
  incomingReplyBg: string;
  incomingReplyBorder: string;
}

export const BUBBLE_THEMES: Record<BubbleThemeId, BubbleTheme> = {
  blue: {
    id: 'blue',
    name: 'Ocean Blue',
    description: 'Classic crisp sapphire blue',
    previewColor: '#2563eb',
    outgoingBg: 'bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white shadow-md',
    outgoingText: 'text-white',
    outgoingTime: 'text-blue-100/75',
    outgoingCheck: 'text-[#8fd0ff]',
    outgoingReplyBg: 'bg-black/20 text-white/90',
    outgoingReplyBorder: 'border-[#93c5fd]',
    incomingBg: 'bg-gradient-to-br from-[#1e40af] to-[#1e3a8a] text-white shadow-md border border-[#3b82f6]/30',
    incomingText: 'text-white',
    incomingTime: 'text-blue-100/75',
    incomingName: 'text-[#bfdbfe]',
    incomingReplyBg: 'bg-black/25 text-white/90',
    incomingReplyBorder: 'border-[#60a5fa]',
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Green',
    description: 'WhatsApp-style vivid emerald',
    previewColor: '#059669',
    outgoingBg: 'bg-gradient-to-br from-[#059669] to-[#047857] text-white shadow-md',
    outgoingText: 'text-white',
    outgoingTime: 'text-emerald-100/75',
    outgoingCheck: 'text-[#a7f3d0]',
    outgoingReplyBg: 'bg-black/20 text-white/90',
    outgoingReplyBorder: 'border-[#6ee7b7]',
    incomingBg: 'bg-gradient-to-br from-[#065f46] to-[#044e39] text-white shadow-md border border-[#10b981]/30',
    incomingText: 'text-white',
    incomingTime: 'text-emerald-100/75',
    incomingName: 'text-[#a7f3d0]',
    incomingReplyBg: 'bg-black/25 text-white/90',
    incomingReplyBorder: 'border-[#34d399]',
  },
  purple: {
    id: 'purple',
    name: 'Royal Purple',
    description: 'Deep regal violet and grape',
    previewColor: '#7c3aed',
    outgoingBg: 'bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] text-white shadow-md',
    outgoingText: 'text-white',
    outgoingTime: 'text-purple-100/75',
    outgoingCheck: 'text-[#ddd6fe]',
    outgoingReplyBg: 'bg-black/20 text-white/90',
    outgoingReplyBorder: 'border-[#c4b5fd]',
    incomingBg: 'bg-gradient-to-br from-[#5b21b6] to-[#4c1d95] text-white shadow-md border border-[#8b5cf6]/30',
    incomingText: 'text-white',
    incomingTime: 'text-purple-100/75',
    incomingName: 'text-[#ddd6fe]',
    incomingReplyBg: 'bg-black/25 text-white/90',
    incomingReplyBorder: 'border-[#a78bfa]',
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset Coral',
    description: 'Warm tropical sunset orange',
    previewColor: '#ea580c',
    outgoingBg: 'bg-gradient-to-br from-[#f97316] to-[#ea580c] text-white shadow-md',
    outgoingText: 'text-white',
    outgoingTime: 'text-orange-100/75',
    outgoingCheck: 'text-[#fed7aa]',
    outgoingReplyBg: 'bg-black/20 text-white/90',
    outgoingReplyBorder: 'border-[#fdba74]',
    incomingBg: 'bg-gradient-to-br from-[#c2410c] to-[#9a3412] text-white shadow-md border border-[#f97316]/30',
    incomingText: 'text-white',
    incomingTime: 'text-orange-100/75',
    incomingName: 'text-[#fed7aa]',
    incomingReplyBg: 'bg-black/25 text-white/90',
    incomingReplyBorder: 'border-[#fb923c]',
  },
  rose: {
    id: 'rose',
    name: 'Rose Pink',
    description: 'Chic vibrant berry rose',
    previewColor: '#e11d48',
    outgoingBg: 'bg-gradient-to-br from-[#f43f5e] to-[#e11d48] text-white shadow-md',
    outgoingText: 'text-white',
    outgoingTime: 'text-rose-100/75',
    outgoingCheck: 'text-[#fecdd3]',
    outgoingReplyBg: 'bg-black/20 text-white/90',
    outgoingReplyBorder: 'border-[#fda4af]',
    incomingBg: 'bg-gradient-to-br from-[#be123c] to-[#9f1239] text-white shadow-md border border-[#f43f5e]/30',
    incomingText: 'text-white',
    incomingTime: 'text-rose-100/75',
    incomingName: 'text-[#fecdd3]',
    incomingReplyBg: 'bg-black/25 text-white/90',
    incomingReplyBorder: 'border-[#fb7185]',
  },
  amber: {
    id: 'amber',
    name: 'Honey Amber',
    description: 'Luminous warm gold and honey',
    previewColor: '#d97706',
    outgoingBg: 'bg-gradient-to-br from-[#f59e0b] to-[#d97706] text-white shadow-md',
    outgoingText: 'text-white',
    outgoingTime: 'text-amber-100/75',
    outgoingCheck: 'text-[#fde68a]',
    outgoingReplyBg: 'bg-black/20 text-white/90',
    outgoingReplyBorder: 'border-[#fcd34d]',
    incomingBg: 'bg-gradient-to-br from-[#b45309] to-[#92400e] text-white shadow-md border border-[#f59e0b]/30',
    incomingText: 'text-white',
    incomingTime: 'text-amber-100/75',
    incomingName: 'text-[#fde68a]',
    incomingReplyBg: 'bg-black/25 text-white/90',
    incomingReplyBorder: 'border-[#fbbf24]',
  },
  neon: {
    id: 'neon',
    name: 'Cyber Teal',
    description: 'Futuristic electric teal and cyan',
    previewColor: '#0d9488',
    outgoingBg: 'bg-gradient-to-br from-[#14b8a6] to-[#0d9488] text-white shadow-md',
    outgoingText: 'text-white',
    outgoingTime: 'text-teal-100/75',
    outgoingCheck: 'text-[#99f6e4]',
    outgoingReplyBg: 'bg-black/20 text-white/90',
    outgoingReplyBorder: 'border-[#5eead4]',
    incomingBg: 'bg-gradient-to-br from-[#0f766e] to-[#115e59] text-white shadow-md border border-[#14b8a6]/30',
    incomingText: 'text-white',
    incomingTime: 'text-teal-100/75',
    incomingName: 'text-[#99f6e4]',
    incomingReplyBg: 'bg-black/25 text-white/90',
    incomingReplyBorder: 'border-[#2dd4bf]',
  },
  lavender: {
    id: 'lavender',
    name: 'Electric Indigo',
    description: 'Dreamy lavender and electric indigo',
    previewColor: '#6366f1',
    outgoingBg: 'bg-gradient-to-br from-[#6366f1] to-[#4f46e5] text-white shadow-md',
    outgoingText: 'text-white',
    outgoingTime: 'text-indigo-100/75',
    outgoingCheck: 'text-[#c7d2fe]',
    outgoingReplyBg: 'bg-black/20 text-white/90',
    outgoingReplyBorder: 'border-[#a5b4fc]',
    incomingBg: 'bg-gradient-to-br from-[#4338ca] to-[#3730a3] text-white shadow-md border border-[#6366f1]/30',
    incomingText: 'text-white',
    incomingTime: 'text-indigo-100/75',
    incomingName: 'text-[#c7d2fe]',
    incomingReplyBg: 'bg-black/25 text-white/90',
    incomingReplyBorder: 'border-[#818cf8]',
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight Slate',
    description: 'Dark stealth minimal slate',
    previewColor: '#475569',
    outgoingBg: 'bg-gradient-to-br from-[#475569] to-[#334155] text-white shadow-md border border-slate-600/40',
    outgoingText: 'text-white',
    outgoingTime: 'text-slate-200/75',
    outgoingCheck: 'text-[#93c5fd]',
    outgoingReplyBg: 'bg-black/20 text-white/90',
    outgoingReplyBorder: 'border-slate-400',
    incomingBg: 'bg-gradient-to-br from-[#1e293b] to-[#0f172a] text-white shadow-md border border-slate-700/60',
    incomingText: 'text-white',
    incomingTime: 'text-slate-300/75',
    incomingName: 'text-[#94a3b8]',
    incomingReplyBg: 'bg-black/25 text-white/90',
    incomingReplyBorder: 'border-slate-500',
  },
};

export function getBubbleTheme(themeId?: string | null): BubbleTheme {
  if (themeId && themeId in BUBBLE_THEMES) {
    return BUBBLE_THEMES[themeId as BubbleThemeId];
  }
  return BUBBLE_THEMES.blue;
}
