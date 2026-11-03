// menu/palette.ts - the colours the menu screens write into their own markup and canvases (the
// lift, the pickers, the tyre bars). The old palette on the plain link; ?menustyle=1 the logo's
// (menu/pixelstyle.ts): ember orange, electric blue for selected / better, burnt-brown edges.
import { FIX } from '../core/fixes.ts';

const PIXEL = FIX.menuStyle;

export const MENU_COL = {
  accent: PIXEL ? '#ff7a2a' : '#e8a13a',   // headings, the CLASS picker, slider accents
  good: PIXEL ? '#4fd8ff' : '#4cc2a0',     // better, the TYPE picker, the start marker
  bad: PIXEL ? '#ff3a2a' : '#d8453c',      // worse
  dim: PIXEL ? '#b3a39b' : '#9aa0aa',      // side notes
  fg: PIXEL ? '#f6eee6' : '#e8e8ee',       // plain text, the CAR picker
  well: PIXEL ? '#241c23' : '#2a2d36',     // a bar's empty track
  pick: PIXEL ? '#4fd8ff' : '#e8a13a',     // the outline of the item picked
  note: PIXEL ? '16px' : '9px',            // a footnote
  small: PIXEL ? '16px' : '10px',          // side-note size (the pixel small face reads small)
  label: PIXEL ? '13px' : '10px',          // a bar's label
  labelW: PIXEL ? '84px' : '44px',         // a bar's label column
  value: PIXEL ? '14px' : '11px',          // a bar's value
  valueW: PIXEL ? '74px' : '40px',         // a bar's value column
  lift: PIXEL
    ? { floor: '#17141b', panel: '#211a20', stripe: '#ff4a1a', arm: '#6e3a1c', post: '#3a2018' }
    : { floor: '#23262e', panel: '#2b2f39', stripe: '#e8a13a', arm: '#5a5f6d', post: '#3a3e4a' },
};
