/**
 * The chat wallpaper is the same for everyone: a plain navy background with a
 * very faint scatter of little hearts, stars and sparkles.
 */
const DOODLE_SVG =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">` +
      `<g fill="none" stroke="#8fb8ff" stroke-opacity="0.11" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">` +
      // heart
      `<path d="M22 24c-4-6-13-2-10 5 2 4 10 9 10 9s8-5 10-9c3-7-6-11-10-5z"/>` +
      // star
      `<path d="M88 14l3.2 6.6 7.2 1-5.2 5 1.3 7.2-6.5-3.5-6.5 3.5 1.3-7.2-5.2-5 7.2-1z"/>` +
      // small heart
      `<path d="M92 82c-2.6-3.9-8.4-1.3-6.5 3.2 1.3 2.6 6.5 5.8 6.5 5.8s5.2-3.2 6.5-5.8c1.9-4.5-3.9-7.1-6.5-3.2z"/>` +
      // sparkle
      `<path d="M30 84v14M23 91h14"/>` +
      // dots
      `<circle cx="60" cy="58" r="1.8"/><circle cx="108" cy="52" r="1.4"/><circle cx="8" cy="64" r="1.4"/>` +
      // squiggle
      `<path d="M52 104c3-4 6 4 9 0s6 4 9 0"/>` +
      `</g></svg>`
  );

export const CHAT_WALLPAPER_STYLE: React.CSSProperties = {
  backgroundColor: '#0c1b36',
  backgroundImage: `url("${DOODLE_SVG}")`,
  backgroundSize: '120px 120px',
};
