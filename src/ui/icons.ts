/**
 * Small inline SVG icon set for the chrome around the Strudel editor. Linear, single-weight,
 * currentColor strokes so they inherit button/text color and theme (dark/light) automatically.
 * No emoji, no unicode glyphs in controls.
 */

const svg = (body: string, viewBox = '0 0 16 16') =>
  `<svg viewBox="${viewBox}" width="14" height="14" fill="none" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICON_PLAY = svg('<path d="M4 2.6 12.5 8 4 13.4Z" fill="currentColor"/>');
export const ICON_STOP = svg('<rect x="3.5" y="3.5" width="9" height="9" rx="1.5" fill="currentColor"/>');
export const ICON_REFRESH = svg(
  '<path d="M3 8a5 5 0 0 1 8.5-3.6M13 8a5 5 0 0 1-8.5 3.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<path d="M11.6 2.6v2.4H9.2M4.4 13.4V11H6.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
);
export const ICON_RUN = svg(
  '<path d="M2.5 3v10l5-5Z" fill="currentColor"/><path d="M9.5 3v10l5-5Z" fill="currentColor" opacity="0.55"/>',
);
export const ICON_REC = svg('<circle cx="8" cy="8" r="4" fill="currentColor"/>');
export const ICON_CHECK = svg(
  '<path d="M3 8.3 6.3 11.5 13 4.3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
);
export const ICON_X = svg(
  '<path d="M4 4 12 12M12 4 4 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
);
export const ICON_EYE = svg(
  '<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>' +
    '<circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.4"/>',
);
export const ICON_DOWNLOAD = svg(
  '<path d="M8 2.5v7.2M4.8 7 8 10.2 11.2 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M3 12.5h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
);
