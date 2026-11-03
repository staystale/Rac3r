// menu/palette.ts - the colours the menu screens write into their own markup and canvases (the
// lift, the pickers, the tyre bars): the logo's (menu/pixelstyle.ts) - ember orange, electric
// blue for better, burnt-brown edges.
export const MENU_COL = {
  accent: '#ff7a2a',   // headings, the CLASS picker, slider accents
  good: '#4fd8ff',   // better, the TYPE picker, the start marker
  bad: '#ff3a2a',   // worse
  dim: '#b3a39b',   // side notes
  fg: '#f6eee6',   // plain text, the CAR picker
  well: '#241c23',   // a bar's empty track
  pick: '#ff7a2a',   // the outline of the item picked (locked in)
  note: '16px',   // a footnote
  small: '16px',   // side-note size (the pixel small face reads small)
  label: '13px',   // a bar's label
  labelW: '84px',   // a bar's label column
  value: '14px',   // a bar's value
  valueW: '74px',   // a bar's value column
  lift: { floor: '#17141b', panel: '#211a20', stripe: '#ff4a1a', arm: '#6e3a1c', post: '#3a2018' },
};
