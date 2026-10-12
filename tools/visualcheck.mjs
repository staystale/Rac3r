// visualcheck.mjs — DOES WHAT IS DRAWN MATCH WHAT YOU DRIVE ON? (user rule, 2026-10-03: "surface visuals should be
// accurate to their effects"). For every level, the REAL renderer paints the ground flat (each surface its base
// colour, no patterns: renderer.debugFlat) and every pixel is compared with groundAt() at that point. A pixel is a
// MISMATCH when its colour is not one of the colours the physics surface there is painted in. Mismatches within
// EDGE_M of a physics boundary are anti-aliasing / sub-pixel edges and are counted separately, not failed.
//
//   node tools/visualcheck.mjs [level ...]     starts its own server. Writes shots/visualcheck-<level>.png:
//                                             red = real mismatch, yellow = edge, faded = matches.
//
// Reports, per level, the mismatched AREA by "drawn as -> drives as", with one example point for each, so a fix can
// go straight to the spot. Gate: MAX_BAD_PCT. Found and fixed with it on 2026-10-03: kerbs drawn on the OPPOSITE side of
// the track from the physics kerbs (lab.js querySubtrack side), rounded pads with no physics apron/corners (zoneAt),
// sector changes drawn up to ~3 m late (render.ts sectorCut).
import { startServer, launchBrowser } from './lib/browser.mjs';
import { mkdirSync } from 'node:fs';

const PPM = 2;            // px per metre painted (0.5 m per pixel: the pixel-art grid of patches and covers)
const EDGE_M = 0.6;       // a mismatch this close to a physics boundary is an edge, not a fault
// GATE: % of the level drawn as something it does not drive as. At 0.5 m per pixel, anti-aliased kerb teeth and edge
// lines leave 0.16-0.33% on a correct level (MEASURED 2026-10-03, after the fixes below). The bugs this was built to
// catch measured: kerbs drawn on the wrong side 2.9-3.7%; rounded pads + sector seams ~1%. Proved to fire (rule 19).
const MAX_BAD_PCT = 0.5;
const LEVEL_IDS = process.argv.slice(2).length ? process.argv.slice(2) : ['lab', 'test-track', 'grass-track', 'stock-car', 'naffcar', 'sandbox'];
mkdirSync(new URL('../shots/', import.meta.url), { recursive: true });

const srv = await startServer();
let b;
try {
b = await launchBrowser();
let fails = 0;
for (const lv of LEVEL_IDS) {
  const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`${srv.url}/?level=${lv}&pc=1`); await p.waitForTimeout(1500);
  const res = await p.evaluate(async ({ PPM, EDGE_M }) => {
    const L = await import('/src/lab.js'), R = window.__game.renderer, LV = L.LEVEL;
    // bounds: the circuit plus a margin, or the whole floor for a level with no circuit
    let x0 = -L.FLOOR, y0 = -L.FLOOR, x1 = L.FLOOR, y1 = L.FLOOR;
    if (LV.subtrack) {
      x0 = y0 = Infinity; x1 = y1 = -Infinity;
      for (const q of LV.subtrack.pts) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
      const m = LV.subtrack.width + 20; x0 -= m; x1 += m; y0 -= m; y1 += m;
    }
    const img = R.debugFlat(x0, y0, x1, y1, PPM), C = R.debugColours();
    const hex = (s) => { const n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const rgba = (s) => { const m = s.match(/[\d.]+/g).map(Number); return m; };
    const over = (bg, s) => { const c = rgba(s), a = c[3] ?? 1; return [0, 1, 2].map((i) => Math.round(bg[i] * (1 - a) + c[i] * a)); };
    // the colours each PHYSICS id may legitimately be drawn in
    const want = (id, under) => {
      // DAMP ground (a 'wet' zone) drives as water on its base but is drawn with the WET TARMAC art: correct — it is a
      // different thing from a standing puddle (it dries under cold tyres), with the same grip
      if (id === 'puddle') { const bg = C.base[under] ? hex(C.base[under]) : [128, 128, 128]; return [C.puddle[under] ? over(bg, C.puddle[under]) : bg, hex(C.base.wet)]; }
      // kerb blocks, plus their raised crest highlight and lip shadow (drawCurvedKerbs / drawKerb)
      if (id === 'kerb') return [C.col.kerbA, C.col.kerbB].flatMap((k) => [hex(k), over(hex(k), 'rgba(255,255,255,0.42)'), over(hex(k), 'rgba(0,0,0,0.2)')]);
      if (id === 'lab') return [hex(C.col.floor), hex(C.col.grid), [250, 249, 247], [244, 243, 242], [236, 236, 240]];
      return C.base[id] ? [hex(C.base[id])] : [];
    };
    // the palette of every colour anything is drawn in, labelled, for naming what a wrong pixel LOOKS like
    const pal = [];
    for (const id of Object.keys(C.base)) pal.push([id, hex(C.base[id])]);
    for (const u of Object.keys(C.puddle)) if (C.base[u]) pal.push(['puddle:' + u, over(hex(C.base[u]), C.puddle[u])]);
    for (const k of ['kerbA', 'kerbB', 'floor', 'grid', 'tarmac', 'outside', 'paint']) if (C.col[k] && C.col[k][0] === '#') pal.push([k === 'kerbA' || k === 'kerbB' ? 'kerb' : k === 'floor' || k === 'grid' ? 'lab' : k, hex(C.col[k])]);
    const d2 = (a, c) => (a[0] - c[0]) ** 2 + (a[1] - c[1]) ** 2 + (a[2] - c[2]) ** 2;
    const nameOf = (px) => { let best = '?', bd = Infinity; for (const [n, c] of pal) { const d = d2(px, c); if (d < bd) { bd = d; best = n; } } return best; };
    const idAt = (x, y) => { const s = L.groundAt(x, y).surface; return s.id === 'puddle' ? 'puddle:' + s.under : s.id; };
    const TOL = 18 * 18;  // colour distance that still counts as "the same colour" (sheen, gradient, rounding)
    const out = new Uint8ClampedArray(img.w * img.h * 4), bad = {}, cache = new Map();
    let nBad = 0, nEdge = 0, n = 0;
    for (let j = 0; j < img.h; j++) for (let i = 0; i < img.w; i++) {
      const k = (j * img.w + i) * 4, px = [img.data[k], img.data[k + 1], img.data[k + 2]];
      const x = x0 + (i + 0.5) / PPM, y = y0 + (j + 0.5) / PPM;
      const s = L.groundAt(x, y).surface, id = s.id, under = s.under;
      const key = id + '|' + under;
      let w = cache.get(key); if (!w) cache.set(key, (w = want(id, under)));
      n++;
      // OK if it is one of this surface's own colours, or if the closest colour of ANY surface is this one (a kerb tooth
      // edge, a crest highlight: shaded, but unmistakably kerb)
      let ok = w.some((c) => d2(px, c) <= TOL);
      if (!ok) { const nm = nameOf(px), me0 = id === 'puddle' ? 'puddle:' + under : id; ok = nm === me0 || (me0.startsWith('puddle:') && nm === 'wet'); }
      let col = [px[0] * 0.3 + 179, px[1] * 0.3 + 179, px[2] * 0.3 + 179];
      if (!ok) {
        const me = idAt(x, y); let edge = false;
        for (let a = 0; a < 8 && !edge; a++) { const t = a * Math.PI / 4; if (idAt(x + Math.cos(t) * EDGE_M, y + Math.sin(t) * EDGE_M) !== me) edge = true; }
        if (edge) { nEdge++; col = [240, 200, 40]; }
        else {
          nBad++; col = [220, 30, 30];
          const tag = nameOf(px) + ' -> ' + me;
          const e = bad[tag] || (bad[tag] = { m2: 0, x: Math.round(x), y: Math.round(y) });
          e.m2 += 1 / (PPM * PPM);
        }
      }
      out[k] = col[0]; out[k + 1] = col[1]; out[k + 2] = col[2]; out[k + 3] = 255;
    }
    const c = document.createElement('canvas'); c.width = img.w; c.height = img.h;
    c.getContext('2d').putImageData(new ImageData(out, img.w, img.h), 0, 0);
    return { n, nBad, nEdge, bad, png: c.toDataURL(), size: [x1 - x0, y1 - y0] };
  }, { PPM, EDGE_M });
  const { writeFileSync } = await import('node:fs');
  writeFileSync(new URL(`../shots/visualcheck-${lv}.png`, import.meta.url), Buffer.from(res.png.split(',')[1], 'base64'));
  const badM2 = res.nBad / (PPM * PPM);
  console.log(`\n${lv}: ${res.size.map((v) => v.toFixed(0)).join(' x ')} m, mismatch ${badM2.toFixed(1)} m2 (${(100 * res.nBad / res.n).toFixed(2)}%), edge ${(res.nEdge / (PPM * PPM)).toFixed(0)} m2${errs.length ? '  PAGE ERRORS ' + errs.join(' | ') : ''}`);
  for (const [tag, e] of Object.entries(res.bad).sort((a, z) => z[1].m2 - a[1].m2).slice(0, 12)) console.log(`   ${e.m2.toFixed(1).padStart(8)} m2   drawn as ${tag.padEnd(40)} e.g. (${e.x}, ${e.y})`);
  const ok = 100 * res.nBad / res.n <= MAX_BAD_PCT && !errs.length;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} under ${MAX_BAD_PCT}% of the level drawn as something it is not`);
  if (!ok) fails++;
  await p.close();
}
await b.close();
console.log(fails ? `\nFAIL (${fails} levels)` : '\nVisuals match physics: all OK');
process.exitCode = fails ? 1 : 0;
} finally {
  await b?.close();
  srv.stop();
}
