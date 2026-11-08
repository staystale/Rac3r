import fs from 'node:fs';
function edit(path, pairs) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(path + ': ' + a.slice(0, 80));
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
}
edit('src/menu/pixelstyle.ts', [
  ['unicode-range: U+0025, U+0030-0039;', 'unicode-range: U+0030-0039;'],
  ["//            and its % (unicode-range; owner: VT323's % was hard to read), so a 4 is\n//            always the same 4",
    "//            (unicode-range), so a 4 is always the same 4; every % is Press Start 2P's,\n//            the clearest (owner: the small face's % was hard to read)"],
  ['`;\n\n// PIXEL-ART SHADES', `/* every % is Press Start 2P's (declared last, so it wins U+0025 over the faces above) */
@font-face { font-family: R3Small; src: url(\${FONT}press-start-2p.woff2) format("woff2");
  unicode-range: U+0025; size-adjust: 62%; font-display: swap; }
@font-face { font-family: R3Head; src: url(\${FONT}press-start-2p.woff2) format("woff2");
  unicode-range: U+0025; size-adjust: 80%; font-display: swap; }
\`;

// PIXEL-ART SHADES`],
  ['#menu .tagline { display: none; }', '#menu .tagline { display: none; }\n'
    + '/* a picked (blue) card or row: its side line dark on the blue, not grey */\n'
    + '#menu button.on .k, #menu button.on .sub { color: #0a2a60; }'],
]);
edit('src/menu/palette.ts', [
  ["  small: PIXEL ? '16px' : '10px',", "  note: PIXEL ? '16px' : '9px',            // a footnote\n  small: PIXEL ? '16px' : '10px',"],
  ["  label: PIXEL ? '16px' : '10px',          // a bar's label",
    "  label: PIXEL ? '16px' : '10px',          // a bar's label\n  labelW: PIXEL ? '70px' : '44px',         // a bar's label column"],
]);
edit('src/menu/garage.ts', [
  ['style="width:44px;font-size:${MENU_COL.label}">${lbl}', 'style="width:${MENU_COL.labelW};font-size:${MENU_COL.label}">${lbl}'],
  ["'<div class=\"sub\" style=\"font-size:9px\">white line = STOCK (PRE-SPUN)</div>'",
    "'<div class=\"sub\" style=\"font-size:' + MENU_COL.note\n        + '\">white line = STOCK (PRE-SPUN)</div>'"],
]);
console.log('ok');
