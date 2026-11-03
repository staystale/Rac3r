// menu/pixelstyle.ts - THE PIXEL MENU STYLE (?menustyle=1, owner 11-03 after the mockup rounds:
// claude.ai artifact "RAC3R Menu Redesign"). Laid over menu/style.ts's sheet, so every screen
// takes it without its own code changing:
//   LOGO     the owner's own image (assets/logo.jpg, "A DRIVING SANDBOX" under it) on the main menu
//   COLOURS  the logo's: near-black panes, ember red to orange for actions, burnt brown edges,
//            electric blue (the 3) for what is selected
//   SHADING  no smooth gradients: buttons are PIXEL-ART shaded - a flat middle the words sit on, a
//            light top-left bevel, a dark bottom-right, 2 px checker dither where shades meet, a
//            few highlight pixels
//   TYPE     headers + buttons Silkscreen, titles Press Start 2P, small text and stats VT323
//            (bigger: it reads small); ONE SET OF DIGITS - every face takes Silkscreen's 0-9
//            (unicode-range), so a 4 is always the same 4
// The fonts ship with the game (assets/fonts, SIL Open Font License).

const FONT = 'assets/fonts/';

// each family: its own face for everything but 0-9, Silkscreen's digits for 0-9
const FACES = `
@font-face { font-family: R3Digits; src: url(${FONT}silkscreen-700.woff2) format("woff2");
  unicode-range: U+0030-0039; font-display: swap; }
@font-face { font-family: R3Small; src: url(${FONT}silkscreen-700.woff2) format("woff2");
  unicode-range: U+0030-0039; size-adjust: 72%; font-display: swap; }
@font-face { font-family: R3Small; src: url(${FONT}vt323.woff2) format("woff2");
  unicode-range: U+0000-002F, U+003A-FFFF; font-display: swap; }
@font-face { font-family: R3Head; src: url(${FONT}silkscreen-700.woff2) format("woff2");
  font-weight: 700; font-display: swap; }
@font-face { font-family: R3Head; src: url(${FONT}silkscreen-400.woff2) format("woff2");
  font-weight: 400; font-display: swap; }
@font-face { font-family: R3Title; src: url(${FONT}silkscreen-700.woff2) format("woff2");
  unicode-range: U+0030-0039; font-display: swap; }
@font-face { font-family: R3Title; src: url(${FONT}press-start-2p.woff2) format("woff2");
  unicode-range: U+0000-002F, U+003A-FFFF; font-display: swap; }
`;

// PIXEL-ART SHADES (hard bands + checker dither, no blending)
const CHECK = (col: string) => `conic-gradient(${col} 25%, transparent 0 50%, ${col} 0 75%, \
transparent 0)`;
const HOT = `linear-gradient(#ffe2b8, #ffe2b8) left 6px top 4px / 8px 2px no-repeat,
  linear-gradient(#ffe2b8, #ffe2b8) left 18px top 4px / 2px 2px no-repeat,
  linear-gradient(#ffc890, #ffc890) left 4px top 6px / 2px 4px no-repeat,
  ${CHECK('#ff8a3a')} left 0 top 8px / 4px 4px repeat-x,
  ${CHECK('#c8141c')} left 2px bottom 8px / 4px 4px repeat-x,
  linear-gradient(180deg, #ffb070 0 2px, #ff8a3a 2px 8px, #ff5a1a 8px calc(100% - 8px),
    #c8141c calc(100% - 8px) calc(100% - 2px), #7a0d16 calc(100% - 2px))`;
const ZAP = `linear-gradient(#ffffff, #ffffff) left 4px top 3px / 6px 2px no-repeat,
  linear-gradient(#e0fdff, #e0fdff) left 3px top 5px / 2px 3px no-repeat,
  ${CHECK('#8ff2ff')} left 0 top 6px / 4px 4px repeat-x,
  ${CHECK('#1250d8')} left 2px bottom 6px / 4px 4px repeat-x,
  linear-gradient(180deg, #e0fdff 0 2px, #8ff2ff 2px 6px, #35c4ff 6px calc(100% - 6px),
    #1e8cff calc(100% - 6px) calc(100% - 2px), #0e3aa8 calc(100% - 2px))`;
const DULL = `linear-gradient(180deg, #3a2a2c 0 2px, #2c2128 2px calc(100% - 4px), \
#1a1418 calc(100% - 4px))`;

export const MENU_PIXEL_CSS = FACES + `
#menu { font-family: R3Head, ui-monospace, monospace; letter-spacing: .03em; color: #f6eee6; }
#menu .pane { background: rgba(12,11,16,.95); box-shadow: inset 0 0 0 2px #3a2018,
  6px 6px 0 rgba(0,0,0,.6); }
#menu h1 { font-family: R3Title, monospace; font-weight: 400; font-size: 22px;
  letter-spacing: .02em;
  color: #ff4a1a; text-shadow: 2px 2px 0 #000, 3px 3px 0 #5a2f1c; }
#menu h2 { font-family: R3Title, monospace; font-weight: 400; font-size: 15px;
  letter-spacing: .02em;
  line-height: 1.35; color: #ff4a1a; text-shadow: 2px 2px 0 #000; }
#menu .sub, #menu .k, #menu .card .k, #menu .cat .k, #menu .picker .val.car span,
#menu .test .ln { font-family: R3Small, monospace; font-weight: 400; font-size: 18px;
  letter-spacing: .02em; text-transform: none; opacity: 1; color: #b3a39b; }
#menu button { font-family: R3Head, monospace; font-weight: 700; font-size: 16px; color: #f6eee6;
  background: ${DULL}; box-shadow: inset 2px 0 0 #3a2a2c, inset -2px 0 0 #120e12, 4px 4px 0 #000;
  min-height: 48px; }
#menu button:active { box-shadow: inset 2px 0 0 #3a2a2c, inset -2px 0 0 #120e12, 2px 2px 0 #000; }
#menu button.go { background: ${HOT}; color: #1a0604; text-shadow: 1px 1px 0 #ffb070;
  box-shadow: inset 2px 0 0 #ff9a50, inset -2px 0 0 #a8121a, 4px 4px 0 #000; }
#menu button.on { background: ${ZAP}; color: #031230;
  box-shadow: inset 2px 0 0 #9ff6ff, inset -2px 0 0 #1250d8, 4px 4px 0 #000; }
#menu .tag { font-family: R3Small, monospace; font-weight: 400; font-size: 16px; color: #ff3a2a; }
#menu .picker, #menu .test { background: #17141b; box-shadow: inset 0 0 0 2px #3a2018; }
#menu .picker .val { font-size: 14px; } #menu .picker .val.car { font-size: 17px; }
#menu .card .nm, #menu .cat .nm { font-size: 15px; }
#menu .cat .n { color: #ff7a2a; } #menu .cat.on .n { color: #031230; }
#menu .stats { font-family: R3Small, monospace; font-weight: 400; font-size: 20px; gap: 2px 12px;
  align-items: baseline; }
#menu .stats span { color: #b3a39b; }
#menu .stats b { font-family: R3Head, monospace; font-weight: 700; font-size: 14px; color: #fff; }
#menu .res, #menu .podium > div { font-family: R3Small, monospace; font-weight: 400;
  font-size: 18px; }
#menu .res .me { color: #4fd8ff; } #menu .res .pen { color: #ff3a2a; }
#menu .podium .step { background: ${DULL}; color: #ff7a2a; font-family: R3Head, monospace; }
#menu .test .nm { color: #4fd8ff; } #menu .test .ln b { color: #ff7a2a; font-size: 15px; }
#menu .lift { background: #17141b; }
#menu .logo { display: block; width: 100%; max-width: 420px; height: auto; margin: 0 auto -4px;
  image-rendering: auto; }
#menu .tagline { display: none; }
/* the old sheet spaced its letters wide; the pixel faces are wide already */
#menu button, #menu .cat .nm, #menu .card .nm, #menu .picker .val, #menu .picker .cap,
#menu .stats b, #menu .podium .step { letter-spacing: .02em; }
`;
