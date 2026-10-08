// menu.js — MAIN MENU, TEST MODE (track select -> match setup) and the GARAGE (user spec, SPECS-2026-10-03.md "UI / UX").
// DOM, not canvas: lists, scrolling and taps are what the DOM is for, and the game canvas keeps running the DEMO LAP behind
// it (user's choice). Pixel-art UI style: hard 2 px outlines, square corners, hard drop shadows, the HUD's colour table
// (green = go / interactive, amber = highlight, red = locked / danger). Everything a screen shows is READ LIVE: car
// numbers come from src/carstats.js (measured by tools/carstats.mjs, rule 10), track pictures from the real level painter.
//
// main.js owns the game; this file only asks it to do things through `api`:
//   api.thumbs()        -> { levelId: canvas }  (painted once, cached)
//   api.launch(level, car)    start a Test Mode session
//   api.carSprite(id)   -> canvas of the generated pixel car
import { LEVELS } from './lab.js';
import { ROSTER, CLASSES, classOf, PALETTE, TYRES, TYRE_BRANDS, TYRE_SURFS, tyreOf } from './cars.js';
import { THEMES, LENGTHS } from './stagegen.js';
import { CAR_STATS } from './carstats.js';
import { TEST_LIST } from './testlist.js';

const KEY = 'carsim.profile.v1';
// PLAYER PROFILE (spec §5): unlocked cars, active car, last track. Every car is SEEDED unlocked for testing (spec: "ensure
// all existing vehicle IDs are seeded on boot"). localStorage can throw in private windows: guarded, and the game still
// works with the in-memory default.
function loadProfile() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* no storage */ }
  p = p || {};
  p.unlocked = [...new Set([...(p.unlocked || []), ...ROSTER.map((r) => r.id)])];
  p.active = ROSTER.some((r) => r.id === p.active) ? p.active : 'hatch-rwd';
  p.lastLevel = LEVELS.some((l) => l.id === p.lastLevel) ? p.lastLevel : 'test-track';
  return p;
}
function saveProfile(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* fine */ } }

const KIND = { lab: 'TEST GROUND', 'test-track': 'CIRCUIT', thruston: 'UK CIRCUIT', 'castle-cum': 'UK CIRCUIT', 'brands-snatch': 'UK CIRCUIT · GP', knobhill: 'RALLYCROSS', 'brands-snatch-indy': 'UK CIRCUIT · INDY', 'sweaty-lamb': 'RALLY STAGE', killder: 'RALLY STAGE · FOREST', 'slidden-hill': 'RALLYCROSS', 'grass-track': 'AUTOGRASS', 'stock-car': 'OVAL', naffcar: 'OVAL', sandbox: 'CIRCUIT' };
// TRACK CATEGORIES (user, 2026-10-05). A level's category: CAT_OF by id, else generated / set rally stages -> rally, endless -> roads,
// anything new and unlisted -> circuits (so a new level is never hidden). ALL TRACKS keeps the old flat grid one tap away.
const CATS = [
  { id: 'circuits', name: 'CIRCUITS', sub: 'road racing · laps · grids' },
  { id: 'rally', name: 'RALLY STAGES', sub: 'point to point · against the clock' },
  { id: 'rx', name: 'RALLYCROSS', sub: 'mixed surface · joker lap' },
  { id: 'ovals', name: 'OVALS', sub: 'stock car · speedway · autograss' },
  { id: 'roads', name: 'ENDLESS ROADS', sub: 'how far can you get?' },
  { id: 'test', name: 'TEST GROUNDS', sub: 'surfaces · physics · free play' },
  { id: 'all', name: 'ALL TRACKS', sub: 'everything in one list' },
];
const CAT_OF = { 'test-track': 'circuits', thruston: 'circuits', 'castle-cum': 'circuits', 'brands-snatch': 'circuits', 'brands-snatch-indy': 'circuits',
  'sweaty-lamb': 'rally', killder: 'rally', knobhill: 'rx', 'slidden-hill': 'rx', 'grass-track': 'ovals', 'stock-car': 'ovals', naffcar: 'ovals',
  lab: 'test', sandbox: 'test' };
const catOf = (lv) => CAT_OF[lv.id] || (lv.gen ? 'rally' : lv.endless ? 'roads' : 'circuits');

const CSS = `
#menu { position: fixed; inset: 0; z-index: 20; display: flex; color: #e8e8ee; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-weight: 700; letter-spacing: .06em; text-transform: uppercase; pointer-events: none; align-items: flex-start; }
#menu.gone { display: none; }
#menu .pane { pointer-events: auto; margin: 12px; padding: 14px; background: rgba(20,22,27,.94); border: 2px solid #000;
  box-shadow: inset 0 0 0 2px #3a3d48, 6px 6px 0 rgba(0,0,0,.55); display: flex; flex-direction: column; gap: 10px;
  max-height: calc(100% - 24px); overflow-y: auto; -webkit-overflow-scrolling: touch; }
#menu h1 { font-size: 26px; letter-spacing: .18em; margin: 2px 0 0; color: #e8a13a; text-shadow: 3px 3px 0 #000; }
#menu h2 { font-size: 15px; letter-spacing: .14em; margin: 0; color: #e8a13a; }
#menu .sub { font-size: 11px; opacity: .6; font-weight: 600; }
#menu button { font: inherit; text-transform: inherit; letter-spacing: inherit; color: #e8e8ee; background: #2a2d36; border: 2px solid #000;
  box-shadow: inset 0 0 0 2px #444856, 4px 4px 0 #000; padding: 12px 14px; min-height: 44px; text-align: left; cursor: pointer; }
#menu button:active { transform: translate(2px,2px); box-shadow: inset 0 0 0 2px #444856, 2px 2px 0 #000; }
#menu button.go { background: #4cc2a0; color: #0d1a16; box-shadow: inset 0 0 0 2px #7fe0c4, 4px 4px 0 #000; }
#menu button.on { background: #e8a13a; color: #2a1405; box-shadow: inset 0 0 0 2px #f5c879, 4px 4px 0 #000; }
#menu button[disabled] { opacity: .38; cursor: default; }
#menu button[disabled]:active { transform: none; }
#menu .tag { font-size: 10px; color: #d8453c; margin-left: 8px; }
#menu .row { display: flex; gap: 8px; align-items: stretch; flex-wrap: wrap; }
#menu .picker { display: flex; flex-direction: column; gap: 6px; padding: 8px; margin: 4px 0 8px; background: #17191e; border: 2px solid #000; box-shadow: inset 0 0 0 2px #2a2d36; }
#menu .picker .prow { display: flex; align-items: center; gap: 6px; }
#menu .picker .cap { width: 52px; flex: none; text-align: center; font-size: 10px; padding: 5px 0; color: #14161b; border: 2px solid #000; }
#menu .picker button { flex: none; min-width: 40px; min-height: 34px; padding: 0 10px; }
#menu .picker .val { flex: 1; text-align: center; font-size: 12px; line-height: 1.1; }
#menu .picker .val.car { font-size: 15px; display: flex; flex-direction: column; align-items: center; }
#menu .picker .val.car span { font-size: 9px; color: #9aa0aa; margin-top: 2px; }
#menu .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
#menu .card { display: flex; flex-direction: column; gap: 6px; padding: 8px; }
#menu .card canvas { width: 100%; aspect-ratio: 16 / 10; object-fit: contain; background: #111318; border: 2px solid #000; image-rendering: pixelated; }
#menu .card .nm { font-size: 13px; } #menu .card .k { font-size: 10px; opacity: .6; }
#menu .cats { display: flex; flex-direction: column; gap: 8px; }
#menu .cat { display: flex; align-items: center; gap: 12px; padding: 8px 12px 8px 8px; min-height: 64px; }
#menu .cat .strip { display: flex; gap: 3px; flex: none; width: 150px; }
#menu .cat .strip canvas { width: 48px; height: 44px; object-fit: cover; background: #111318; border: 2px solid #000; image-rendering: pixelated; }
#menu .cat .tx { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
#menu .cat .nm { font-size: 16px; letter-spacing: .12em; } #menu .cat .k { font-size: 10px; opacity: .6; text-transform: none; letter-spacing: .04em; }
#menu .cat .n { flex: none; font-size: 18px; color: #e8a13a; min-width: 28px; text-align: right; } #menu .cat.on .n { color: #2a1405; }
@media (max-width: 480px) { #menu .cat .strip { width: 99px; } #menu .cat .strip canvas:nth-child(3) { display: none; } #menu .cat .nm { font-size: 14px; } }
#menu .stats { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 12px; }
#menu .stats b { color: #4cc2a0; font-weight: 700; }
/* the lift is capped in HEIGHT: photographed in landscape it filled the pane and pushed the stats and buttons off screen */
#menu .lift { background: #23262e; border: 2px solid #000; image-rendering: pixelated; width: 100%; max-height: 34vh; object-fit: contain; }
#menu .podium { display: flex; gap: 8px; align-items: flex-end; justify-content: center; padding-top: 6px; }
#menu .podium > div { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 92px; font-size: 11px; }
#menu .podium canvas { image-rendering: pixelated; max-width: 92px; max-height: 120px; object-fit: contain; }
#menu .podium .step { width: 100%; background: #2a2d36; border: 2px solid #000; box-shadow: inset 0 0 0 2px #444856; display: flex;
  align-items: flex-start; justify-content: center; font-size: 22px; padding-top: 4px; color: #e8a13a; }
#menu .res { display: grid; grid-template-columns: repeat(7, auto); justify-content: start; gap: 3px 16px; font-size: 12px; align-items: center; }
#menu .res .h { font-size: 9px; opacity: .55; }
#menu .res > div { white-space: nowrap; }
@media (max-width: 480px) { #menu .res { gap: 3px 9px; font-size: 11px; } #menu .res .h { font-size: 8px; } } #menu .res .me { color: #4cc2a0; } #menu .res .pen { color: #d8453c; }
#menu .res .sw { width: 12px; height: 12px; border: 2px solid #000; display: inline-block; vertical-align: -2px; margin-right: 4px; }
#menu .garage { display: flex; gap: 12px; flex-wrap: wrap; } #menu .garage > * { flex: 1 1 240px; min-width: 0; }
#menu .test { background: #17191e; border: 2px solid #000; box-shadow: inset 0 0 0 2px #2a2d36; padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; }
#menu .test .nm { font-size: 13px; color: #4cc2a0; } #menu .test .nm span { font-size: 9px; opacity: .5; margin-left: 6px; }
#menu .test .ln { font-size: 11px; text-transform: none; letter-spacing: .02em; font-weight: 600; line-height: 1.35; } #menu .test .ln b { color: #e8a13a; font-size: 9px; letter-spacing: .1em; margin-right: 4px; }
#menu .test .ln.bad b { color: #d8453c; }
`;

export function createMenu(api) {
  const profile = loadProfile();
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const root = document.createElement('div'); root.id = 'menu'; root.className = 'gone'; document.body.appendChild(root);
  let thumbs = null;
  // GHOST-CLICK GUARD. MEASURED BUG (portrait, 2026-10-03): tapping the HUD pause chip opened the pause pane, and the SAME
  // tap's follow-up click landed on RESUME, which sits right under the chip at 390 px — paused and resumed in one tap.
  // Every new screen ignores clicks for GHOST_MS.
  let openedAt = 0;
  const GHOST_MS = 350;
  const pane = (wide) => { openedAt = performance.now(); root.innerHTML = ''; const p = document.createElement('div'); p.className = 'pane'; p.style.width = wide ? 'min(720px, calc(100% - 24px))' : 'min(320px, calc(100% - 24px))'; root.appendChild(p); return p; };
  const btn = (p, label, fn, cls = '', disabled = false, tag = '') => {
    const b = document.createElement('button'); b.innerHTML = label + (tag ? `<span class="tag">${tag}</span>` : ''); if (cls) b.className = cls; b.disabled = disabled;
    b.addEventListener('click', (e) => { e.stopPropagation(); if (!disabled && performance.now() - openedAt > GHOST_MS) fn(); }); p.appendChild(b); return b;
  };
  const el = (p, tag, html, cls) => { const e = document.createElement(tag); e.innerHTML = html; if (cls) e.className = cls; p.appendChild(e); return e; };

  // ---- MAIN MENU (spec §2): Story locked, Garage, Test Mode (primary)
  function main() {
    const p = pane(false);
    el(p, 'h1', 'RAC3R'); el(p, 'div', 'a driving sandbox', 'sub');   // the game's name (user, 2026-10-03)
    btn(p, 'TEST MODE', trackSelect, 'go');
    btn(p, 'GARAGE', garage);
    btn(p, 'STORY', () => {}, '', true, 'LOCKED');
  }

  // ---- TEST MODE step 1: CATEGORY LIST (user, 2026-10-05: "a menu layer for circuit type, stick appropriate tracks in the correct
  // category" — "a BIG LIST", Grass Track in OVALS), then step 1b: that category's track cards (overhead thumbnails)
  function trackSelect() {
    const p = pane(true);
    el(p, 'h2', 'TEST MODE · CHOOSE A TYPE');
    if (!thumbs) thumbs = api.thumbs();
    const list = el(p, 'div', '', 'cats');
    for (const c of CATS) {
      const lvs = LEVELS.filter((l) => c.id === 'all' || catOf(l) === c.id); if (!lvs.length) continue;
      const b = btn(list, '', () => { profile.lastCat = c.id; saveProfile(profile); trackList(c.id); }, 'cat' + (c.id === profile.lastCat ? ' on' : ''));
      const strip = el(b, 'div', '', 'strip');
      for (const lv of lvs.slice(0, 3)) { const t = thumbs[lv.id]; if (!t) continue; const cv = document.createElement('canvas'); cv.width = t.width; cv.height = t.height; cv.getContext('2d').drawImage(t, 0, 0); strip.appendChild(cv); }
      const tx = el(b, 'div', '', 'tx'); el(tx, 'span', c.name, 'nm'); el(tx, 'span', c.sub, 'k');
      el(b, 'span', String(lvs.length), 'n');
    }
    const r = el(p, 'div', '', 'row'); btn(r, '◀ BACK', main);
  }
  function trackList(cat) {
    const p = pane(true), C = CATS.find((c) => c.id === cat) || CATS[CATS.length - 1];
    el(p, 'h2', 'TEST MODE · ' + C.name);
    if (!thumbs) thumbs = api.thumbs();
    { const cur = LEVELS.find((l) => l.gen && !l.fixed), pg = profile.gen; if (cur && pg && ['seed', 'theme', 'len', 'style'].some((k) => pg[k] !== cur.gen[k])) api.genStage(pg); }
    const g = el(p, 'div', '', 'grid');
    for (const lv of LEVELS.filter((l) => cat === 'all' || catOf(l) === cat)) {
      const b = btn(g, '', () => { profile.lastLevel = lv.id; saveProfile(profile); setup(lv); }, 'card' + (lv.id === profile.lastLevel ? ' on' : ''));
      if (lv.gen && !lv.fixed) { const c = document.createElement('canvas'); c.width = 320; c.height = 200; roadMap(c, lv); b.appendChild(c); el(b, 'span', 'STAGE GENERATOR', 'nm'); el(b, 'span', 'RALLY STAGE · NEW EVERY TIME', 'k'); continue; }
      const t = thumbs[lv.id]; if (t) { const c = document.createElement('canvas'); c.width = t.width; c.height = t.height; c.getContext('2d').drawImage(t, 0, 0); b.appendChild(c); }
      el(b, 'span', lv.name, 'nm'); el(b, 'span', lv.endless ? 'ENDLESS MOTORWAY' : lv.fixed ? 'RALLY STAGE · ' + THEMES[lv.gen.theme].name.split(' ')[0] : KIND[lv.id] || 'TRACK', 'k');
    }
    const r = el(p, 'div', '', 'row'); btn(r, '◀ TYPES', trackSelect);
  }

  // ---- TEST MODE step 2 (spec §4): Solo now; Race vs AI shown, locked until AI exists. Car picker (unlocked only).
  // a generated stage's ROAD MAP: the theme's ground, the road (not the ghost return), START green, FINISH chequered
  function roadMap(c, lv) {
    const g = c.getContext('2d'), sub = lv.subtrack, P = sub.pts, gh = sub.ghost;
    const bg = { forest: '#2c3b27', alpine: '#3a4434', snow: '#cfd8df', desert: '#b89a68' }[lv.gen.theme] || '#2c3b27';
    const rd = { forest: '#8a7a5c', alpine: '#4a4d55', snow: '#f4f7fa', desert: '#d8bf8c' }[lv.gen.theme] || '#888';
    g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const q of P) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
    const k = Math.min((c.width - 24) / (x1 - x0 || 1), (c.height - 24) / (y1 - y0 || 1)), X = (x) => 12 + (x - x0) * k + ((c.width - 24) - (x1 - x0) * k) / 2, Y = (y) => 12 + (y - y0) * k + ((c.height - 24) - (y1 - y0) * k) / 2;
    const isG = (i) => gh && P[i].dist >= gh.d0 - 0.01 && P[i].dist < gh.d1 - 0.01;
    for (const [w, col] of [[Math.max(4, sub.width * k + 3), 'rgba(0,0,0,0.45)'], [Math.max(2.5, sub.width * k), rd]]) {
      g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
      for (let i = 0; i < P.length; i++) { if (isG(i)) { g.lineTo(X(P[i].x), Y(P[i].y)); g.stroke(); g.beginPath(); continue; } if (i === 0 || isG(i - 1)) g.moveTo(X(P[i].x), Y(P[i].y)); else g.lineTo(X(P[i].x), Y(P[i].y)); }
      g.lineTo(X(P[0].x), Y(P[0].y)); g.stroke();
    }
    const f = onTrackPt(lv, lv.stage.finish);
    g.fillStyle = '#4cc2a0'; g.beginPath(); g.arc(X(P[0].x), Y(P[0].y), 5, 0, 7); g.fill();
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#111' : '#fff'; g.fillRect(X(f.x) - 5 + (i % 2) * 5, Y(f.y) - 5 + (i >> 1) * 5, 5, 5); }
  }
  const onTrackPt = (lv, d) => { const P = lv.subtrack.pts; let best = P[0]; for (const q of P) if (Math.abs(q.dist - d) < Math.abs(best.dist - d)) best = q; return best; };

  // GENERATOR SETUP (user, 2026-10-04: procedural point-to-point stages): THEME, LENGTH, CORNERS, SEED (◀ ▶ / NEW STAGE), the road map;
  // every change regenerates (≤ ~0.5 s) and the setup reopens on the new stage. Remembered in profile.gen.
  function genRows(p, lv) {
    const o = { ...lv.gen };
    const map = document.createElement('canvas'); map.width = 320; map.height = 200; map.style.cssText = 'width:100%;border:2px solid #000;image-rendering:pixelated;margin:4px 0'; p.appendChild(map); roadMap(map, lv);
    el(p, 'div', `${THEMES[o.theme].name} · ${lv.gen.km.toFixed(2)} KM · SEED ${o.seed}`, 'sub');
    const regen = (ch) => { Object.assign(o, ch); profile.gen = { theme: o.theme, len: o.len, style: o.style, seed: o.seed }; saveProfile(profile); const nl = api.genStage(o); profile.lastLevel = nl.id; saveProfile(profile); setup(nl); };
    const row = (opts, cur, key) => { const r = el(p, 'div', '', 'row'); for (const [v, label] of opts) btn(r, label, () => regen({ [key]: v }), v === cur ? 'on' : ''); };
    row(Object.entries(THEMES).map(([k, t]) => [k, t.name.split(' ')[0]]), o.theme, 'theme');
    row(Object.keys(LENGTHS).map((k) => [k, k.toUpperCase()]), o.len, 'len');
    row([['flowing', 'FLOWING'], ['mixed', 'MIXED'], ['tight', 'TIGHT']], o.style, 'style');
    const sr = el(p, 'div', '', 'row');
    btn(sr, '◀', () => regen({ seed: Math.max(1, o.seed - 1) })); btn(sr, '▶', () => regen({ seed: o.seed + 1 }));
    btn(sr, 'NEW STAGE 🎲', () => regen({ seed: 1 + Math.floor(Math.random() * 99999) }), 'go');
  }
  function setup(lv) {
    const p = pane(false);
    el(p, 'h2', lv.name); el(p, 'div', lv.endless ? 'ENDLESS MOTORWAY · HOW FAR CAN YOU GET?' : lv.fixed ? `RALLY STAGE · ${THEMES[lv.gen.theme].name} · ${lv.gen.km.toFixed(2)} KM · POINT TO POINT` : lv.gen ? 'GENERATED RALLY STAGE · POINT TO POINT' : KIND[lv.id] || 'TRACK', 'sub');
    if (lv.gen && !lv.fixed) genRows(p, lv);
    // ROAD TYPE (endless highway, user 2026-10-05: "how do I test the lane presets — I don't see any buttons"): lanes / width / walls
    let road = lv.roadType || null;
    if (lv.roadTypes) { const rr = el(p, 'div', '', 'row'); const rb = Object.entries(lv.roadTypes).map(([k, name]) => btn(rr, name, () => { road = k; rb.forEach((b, i) => b.classList.toggle('on', Object.keys(lv.roadTypes)[i] === road)); }, k === road ? 'on' : '')); }
    // TRAFFIC + LITTER sliders (user, 2026-10-05: "a slider in test mode for density" / "a slider for frequency / density" of the roadside
    // objects); remembered. TRAFFIC 0-150 % (100 % = 6 cars a lane), LITTER 0-3 x
    let traffic = profile.traffic ?? 0.6, litter = profile.litter ?? 1;
    if (lv.endless) {
      const slider = (label, min, max, stepV, val, fmt, set) => {
        const r = el(p, 'div', '', 'row'); r.style.alignItems = 'center';
        const l = el(r, 'div', ''); l.style.cssText = 'width:120px;font-size:12px';
        const s = document.createElement('input'); s.type = 'range'; s.min = min; s.max = max; s.step = stepV; s.value = val; s.style.cssText = 'flex:1;min-height:34px;accent-color:#e8a13a';
        const show = () => { l.textContent = label + ' ' + fmt(+s.value); };
        s.addEventListener('input', () => { set(+s.value); show(); saveProfile(profile); }); r.appendChild(s); show();
      };
      slider('TRAFFIC', 0, 1.5, 0.05, traffic, (v) => v ? Math.round(v * 100) + '%' : 'OFF', (v) => { traffic = profile.traffic = v; });
      slider('LITTER', 0, 3, 0.1, litter, (v) => v ? v.toFixed(1) + 'x' : 'OFF', (v) => { litter = profile.litter = v; });
    }
    const r = el(p, 'div', '', 'row');
    // VS AI (2026-10-04, AI stage 1 preview): 1-5 opponents in the same car, different colours. Racing / lights / results come in later stages.
    let ai = 0, aiN = 5;
    const bSolo = btn(r, 'SOLO', () => { ai = 0; paint(); }, 'on'), bAI = btn(r, 'VS AI', () => { ai = aiN; paint(); });
    const nRow = el(p, 'div', '', 'row'); const nBtns = [1, 2, 3, 4, 5].map((n) => btn(nRow, String(n), () => { aiN = n; ai = n; paint(); }));
    // DIFFICULTY (PLAN.md §4; the centre of the field's spread — aidriver.js)
    const DIFF = [['MOBILE', 'Mobile game'], ['GAME', 'Game'], ['REALISH', 'Realish'], ['RICH', "Real but you're rich"], ['REAL', 'Real']];
    let diff = 2; try { const v = localStorage.getItem('carsim.aidiff'); if (v != null) diff = Math.max(0, Math.min(4, +v)); } catch { /* default */ }
    const dRow = el(p, 'div', '', 'row'); const dBtns = DIFF.map(([s], i) => btn(dRow, s, () => { diff = i; try { localStorage.setItem('carsim.aidiff', String(i)); } catch { /* fine */ } paint(); }));
    const dName = el(p, 'div', '', 'sub');
    // AI CARS: CLASS (each AI a car of your class) or YOUR CAR (all the same as you); remembered
    let aiCars = profile.aiCars === 'same' ? 'same' : 'class';
    const aRow = el(p, 'div', '', 'row');
    const bCls = btn(aRow, 'AI: CLASS CARS', () => { aiCars = 'class'; profile.aiCars = aiCars; saveProfile(profile); paint(); });
    const bSame = btn(aRow, 'AI: YOUR CAR', () => { aiCars = 'same'; profile.aiCars = aiCars; saveProfile(profile); paint(); });
    let paint = function () { bSolo.classList.toggle('on', ai === 0); bAI.classList.toggle('on', ai > 0); nRow.style.display = ai ? '' : 'none'; nBtns.forEach((b, i) => b.classList.toggle('on', i + 1 === aiN));
      dRow.style.display = ai ? '' : 'none'; dName.style.display = ai ? '' : 'none'; dBtns.forEach((b, i) => b.classList.toggle('on', i === diff)); dName.textContent = 'AI: ' + DIFF[diff][1];
      aRow.style.display = ai ? '' : 'none'; bCls.classList.toggle('on', aiCars === 'class'); bSame.classList.toggle('on', aiCars === 'same'); };
    paint();
    // a JOKER level offers the RX race (5 laps from the grid, joker once, missed = +5 s) next to free practice
    let rx = false;
    if (lv.joker) {
      const m = el(p, 'div', '', 'row');
      const bP = btn(m, 'PRACTICE', () => { rx = false; bP.classList.add('on'); bR.classList.remove('on'); }, 'on');
      const bR = btn(m, `RX RACE · ${lv.joker.laps} LAPS`, () => { rx = true; bR.classList.add('on'); bP.classList.remove('on'); });
    }
    // LAPS (user, 2026-10-04: "choose in setup"): a race (VS AI or the RX race) is this many laps; default 3, the RX race its joker laps
    let laps = lv.joker ? lv.joker.laps || 5 : 3;
    const lRow = el(p, 'div', '', 'row'), lLbl = el(lRow, 'div', ''); lLbl.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;font-size:14px';
    // (the highway has no laps: a ROLLING START, and it ends when someone gets away off screen — a line says so instead)
    const lPaint = () => { lLbl.textContent = laps + (laps === 1 ? ' LAP' : ' LAPS'); lRow.style.display = (ai || rx) && !lv.endless ? '' : 'none'; if (hwNote) hwNote.style.display = ai ? '' : 'none'; };
    const hwNote = lv.endless ? el(p, 'div', 'ROLLING START · GET AWAY: LOSE THEM OFF THE BOTTOM OF THE SCREEN TO WIN · LET ONE GET AWAY OFF THE TOP AND IT IS OVER', 'sub') : null;
    btn(lRow, '−', () => { laps = Math.max(1, laps - 1); lPaint(); }); lRow.appendChild(lLbl); btn(lRow, '+', () => { laps = Math.min(10, laps + 1); lPaint(); });
    const paint0 = paint; paint = () => { paint0(); lPaint(); };
    if (lv.joker) for (const b of p.querySelectorAll('button')) if (/PRACTICE|RX RACE/.test(b.textContent)) b.addEventListener('click', () => lPaint());
    paint();
    carPicker(p);
    btn(p, 'LAUNCH ▶', () => { hide(); api.launch(lv.id, profile.active, { rx, ai, diff, road, aiCars, ...(lv.endless ? { traffic, litter } : {}), laps: ai || rx ? laps : 0, livery: (profile.livery || {})[profile.active], tyre: (profile.tyres || {})[profile.active] }); }, 'go');
    btn(p, '◀ BACK', () => trackList(profile.lastCat || catOf(lv)));
  }
  // CAR PICKER filtered CLASS -> SUBCLASS -> car (user, 2026-10-04). Only classes / subclasses you own a car in are offered ('ALL' first);
  // the filter starts on the active car's class. onPick(row) after every change. Used by race setup and the garage.
  function carPicker(p, onPick = () => {}) {
    const owned = () => ROSTER.filter((r) => profile.unlocked.includes(r.id));
    const cur = () => ROSTER.find((r) => r.id === profile.active);
    let fc = cur().cls, fs = 'ALL';
    const clsList = () => ['ALL', ...CLASSES.filter((k) => owned().some((r) => r.cls === k.id)).map((k) => k.id)];
    const subList = () => fc === 'ALL' ? ['ALL'] : ['ALL', ...classOf(fc).subs.filter((s) => owned().some((r) => r.cls === fc && r.sub === s))];
    const cars = () => owned().filter((r) => (fc === 'ALL' || r.cls === fc) && (fs === 'ALL' || r.sub === fs));
    const step = (list, v, d) => list[(list.indexOf(v) + d + list.length) % list.length];
    const fit = () => { const l = cars(); if (!l.some((r) => r.id === profile.active)) profile.active = l[0].id; saveProfile(profile); };
    // one boxed group; each row: TAG (coloured) ◀ value ▶ — the value takes the tag's colour so the three read as a set
    const box = el(p, 'div', '', 'picker');
    const row = (tag, col, prev, next) => {
      const r = el(box, 'div', '', 'prow');
      const t = el(r, 'div', tag, 'cap'); t.style.background = col;
      btn(r, '◀', prev); const v = el(r, 'div', '', 'val'); v.style.color = col; btn(r, '▶', next); return v;
    };
    const cL = row('CLASS', '#e8a13a', () => { fc = step(clsList(), fc, -1); fs = 'ALL'; fit(); paint(); }, () => { fc = step(clsList(), fc, 1); fs = 'ALL'; fit(); paint(); });
    const sL = row('TYPE', '#4cc2a0', () => { fs = step(subList(), fs, -1); fit(); paint(); }, () => { fs = step(subList(), fs, 1); fit(); paint(); });
    const lbl = row('CAR', '#e8e8ee', () => { profile.active = step(cars().map((r) => r.id), profile.active, -1); saveProfile(profile); paint(); },
      () => { profile.active = step(cars().map((r) => r.id), profile.active, 1); saveProfile(profile); paint(); });
    lbl.classList.add('car');
    const paint = () => {
      const r = cur(), n = cars().length, k = cars().findIndex((x) => x.id === r.id) + 1;
      cL.textContent = fc === 'ALL' ? 'ALL' : classOf(fc).name;
      sL.textContent = fs === 'ALL' ? 'ALL' : fs.toUpperCase();
      lbl.innerHTML = r.name + `<span>${k} / ${n}</span>`;
      onPick(r);
    };
    paint();
  }


  // ---- GARAGE (spec §3; user chose: the TOP-DOWN car on a workshop LIFT). Browse owned cars, measured stats.
  function garage() {
    const p = pane(true);
    el(p, 'h2', 'GARAGE');
    const box = el(p, 'div', '', 'garage');
    const left = el(box, 'div', ''), right = el(box, 'div', '');
    const lift = document.createElement('canvas'); lift.className = 'lift'; lift.width = 360; lift.height = 150; left.appendChild(lift);
    const pick = el(left, 'div', ''); pick.style.marginTop = '8px';
    const stats = el(right, 'div', '', 'stats');
    const show = () => {
      const r = ROSTER.find((x) => x.id === profile.active), s = CAR_STATS[r.id] || {};
      drawLift(lift, api.carSprite(r.id, (profile.livery || {})[r.id]));
      const aids = s.aids ? [s.aids.abs && 'ABS', s.aids.tcs && 'TCS'].filter(Boolean).join(' + ') || 'NONE' : 'NONE';
      stats.innerHTML = `<span>TOP SPEED</span><b>${s.topKph ?? '—'} KM/H</b><span>0-100 KM/H</span><b>${s.zeroTo100 != null ? s.zeroTo100 + ' S' : '—'}</b>`
        + `<span>100-0 BRAKING</span><b>${s.brake100 ?? '—'} M</b><span>GRIP</span><b>${(() => { const tg = tyreOf((profile.tyres || {})[r.id]).grip.tarmac;
          return s.gripG == null ? '—' : tg === 1 ? s.gripG + ' G' : (s.gripG * tg).toFixed(2) + ' G <span style="color:#9aa0aa;font-size:10px">STOCK ' + s.gripG + '</span>'; })()}</b>`
        + `<span>WEIGHT</span><b>${s.massKg} KG</b><span>DRIVE</span><b>${s.drive}</b><span>AIDS</span><b>${aids}</b>`
        + `<span>CLASS</span><b>${classOf(r.cls).name} · ${r.sub.toUpperCase()}</b>`
        + (() => { const t = tyreOf((profile.tyres || {})[r.id]), b = TYRE_BRANDS.find((x) => x.id === t.brand); return `<span>TYRES</span><b style="color:${b.col}">${b.name} · ${t.name.toUpperCase()}</b>`; })();
    };
    const r2 = el(p, 'div', '', 'row');
    btn(r2, 'PAINT', () => paintShop());
    btn(r2, 'TYRES', () => tyreShop());
    btn(r2, 'BUY CARS', () => {}, '', true, 'SOON'); btn(r2, 'UPGRADES', () => {}, '', true, 'SOON');
    btn(p, '◀ BACK', main);
    carPicker(pick, show);
  }
  // ---- PAINT SHOP (user, 2026-10-04: "palette + number + preview"): BODY and TRIM from the 16-colour PALETTE, a NUMBER 1-99 (or none),
  // the car previewed on the lift as you go; APPLY saves it to the profile (it follows the car into events), BACK drops the changes,
  // STOCK puts the car's own colours back. Test mode: free (prices come with story mode).
  function paintShop() {
    const p = pane(true), id = profile.active, r = ROSTER.find((x) => x.id === id);
    const cur = { paint: r.paint, trim: r.trim, num: 0, ...((profile.livery || {})[id] || {}) };
    el(p, 'h2', 'PAINT · ' + r.name);
    const box = el(p, 'div', '', 'garage'), left = el(box, 'div', ''), right = el(box, 'div', '');
    const lift = document.createElement('canvas'); lift.className = 'lift'; lift.width = 360; lift.height = 150; left.appendChild(lift);
    const show = () => { drawLift(lift, api.carSprite(id, cur)); numL.textContent = cur.num ? '#' + cur.num : 'NO NUMBER';
      for (const [k, list] of [['paint', bodyB], ['trim', trimB]]) for (const b of list) b.style.outline = b.dataset.c === cur[k] ? '3px solid #e8a13a' : 'none'; };
    const swatches = (label, k) => {
      el(right, 'div', label, 'sub');
      const g = el(right, 'div', ''); g.style.cssText = 'display:grid;grid-template-columns:repeat(8,1fr);gap:4px;margin-bottom:8px';
      return PALETTE.map((c) => { const b = btn(g, '', () => { cur[k] = c; show(); }); b.dataset.c = c;
        b.style.cssText = 'background:' + c + ';min-width:0;min-height:0;height:24px;padding:0;box-shadow:none;outline-offset:-1px'; return b; });
    };
    const bodyB = swatches('BODY', 'paint'), trimB = swatches('TRIM', 'trim');
    const nr = el(left, 'div', '', 'row'); nr.style.marginTop = '8px';
    btn(nr, '−10', () => { cur.num = Math.max(0, cur.num - 10); show(); }); btn(nr, '−', () => { cur.num = Math.max(0, cur.num - 1); show(); });
    const numL = el(nr, 'div', ''); numL.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;font-size:15px';
    btn(nr, '+', () => { cur.num = Math.min(99, cur.num + 1); show(); }); btn(nr, '+10', () => { cur.num = Math.min(99, cur.num + 10); show(); });
    const r2 = el(p, 'div', '', 'row');
    btn(r2, 'STOCK', () => { Object.assign(cur, { paint: r.paint, trim: r.trim, num: 0 }); show(); });
    btn(r2, 'APPLY ✓', () => { profile.livery = profile.livery || {}; profile.livery[id] = { ...cur }; saveProfile(profile); garage(); }, 'go');
    btn(p, '◀ BACK', garage);
    show();
  }
  // ---- TYRES (user, 2026-10-04: 4 brands / 15 types, fit by class, prices shown, the effect shown with the stats). Grouped by brand
  // (coloured), a tyre that does not fit this car's class is shown but locked; the panel: grip per surface vs Pre-Spun, the heat window,
  // what it is for, the price; FIT saves it to profile.tyres[id] and it rides into every event. Test mode: free.
  function tyreShop() {
    const p = pane(true), id = profile.active, r = ROSTER.find((x) => x.id === id), s = CAR_STATS[id] || {};
    let sel = tyreOf((profile.tyres || {})[id]).id;
    el(p, 'h2', 'TYRES · ' + r.name);
    const box = el(p, 'div', '', 'garage'), left = el(box, 'div', ''), right = el(box, 'div', '');
    const btns = {};
    for (const b of TYRE_BRANDS) {
      const h = el(left, 'div', b.name + ' <span style="color:#9aa0aa;font-size:10px">' + b.blurb + '</span>'); h.style.cssText = 'margin:6px 0 4px;font-size:12px;color:' + b.col;
      const g = el(left, 'div', ''); g.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px';
      for (const t of TYRES.filter((x) => x.brand === b.id)) {
        const ok = t.fits.includes(r.cls);
        const bt = btn(g, t.name, () => { sel = t.id; show(); }, '', !ok, ok ? '' : 'NO FIT');
        bt.style.cssText = 'min-height:32px;padding:4px 9px;font-size:11px;border-left:5px solid ' + b.col; btns[t.id] = bt;
      }
    }
    const info = el(right, 'div', '');
    const fitR = el(p, 'div', '', 'row');
    const fitB = btn(fitR, 'FIT ✓', () => { profile.tyres = profile.tyres || {}; profile.tyres[id] = sel; saveProfile(profile); garage(); }, 'go');
    btn(p, '◀ BACK', garage);
    const show = () => {
      const t = tyreOf(sel), b = TYRE_BRANDS.find((x) => x.id === t.brand), cur = tyreOf((profile.tyres || {})[id]).id === t.id;
      for (const [k, bt] of Object.entries(btns)) bt.style.outline = k === sel ? '3px solid #e8a13a' : 'none';
      const bar = (lbl, k) => { const v = t.grip[k], pc = Math.round((v - 1) * 100), w = Math.max(4, Math.min(100, v / 1.6 * 100));
        return `<div style="display:flex;align-items:center;gap:6px;margin:2px 0"><span style="width:44px;font-size:10px">${lbl}</span>`
          + `<div style="flex:1;height:10px;background:#2a2d36;border:1px solid #000;position:relative"><div style="position:absolute;left:62.5%;top:-3px;bottom:-3px;width:2px;background:#e8e8ee"></div><div style="height:100%;width:${w}%;background:${v > 1.001 ? '#4cc2a0' : v < 0.999 ? '#d8453c' : '#9aa0aa'}"></div></div>`
          + `<span style="width:40px;text-align:right;font-size:11px;color:${v > 1.001 ? '#4cc2a0' : v < 0.999 ? '#d8453c' : '#9aa0aa'}">${pc > 0 ? '+' : ''}${pc}%</span></div>`; };
      const opt = t.opt || [65, 110], heat = (t.heatHard || 1) > 1.05 ? 'FAST on tarmac' : (t.heatHard || 1) < 0.95 ? 'slow' : 'normal';
      const gG = s.gripG ? (s.gripG * t.grip.tarmac).toFixed(2) + ' G' : '—';
      info.innerHTML = `<div style="font-size:15px;color:${b.col}">${b.name} · ${t.name.toUpperCase()}</div>`
        + `<div class="sub" style="margin:2px 0 6px">${t.note || ''}</div>`
        + '<div class="sub" style="font-size:9px">white line = STOCK (PRE-SPUN)</div>' + TYRE_SURFS.map(([k, lbl]) => bar(lbl, k)).join('')
        + `<div class="stats" style="margin-top:6px"><span>GRIP (TARMAC)</span><b>${gG}</b><span>WORKING HEAT</span><b>${opt[0]}-${opt[1]} C</b>`
        + `<span>HEATS UP</span><b>${heat}</b><span>PRICE</span><b>£${t.price}${t.price ? ' · FREE IN TEST' : ''}</b></div>`;
      fitB.innerHTML = cur ? 'FITTED ✓' : 'FIT ✓';
    };
    show();
  }
  // the workshop lift: a pixel floor, two lift arms, the car top-down on it, scaled up on whole pixels
  function drawLift(cv, spr) {
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#23262e'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#2b2f39'; for (let x = 0; x < cv.width; x += 24) g.fillRect(x, 0, 12, cv.height);      // floor panels
    g.fillStyle = '#e8a13a'; g.fillRect(0, cv.height - 10, cv.width, 4);                                 // hazard stripe
    const k = Math.max(1, Math.floor(Math.min((cv.width - 60) / spr.c.width, (cv.height - 40) / spr.c.height)));
    const w = spr.c.width * k, h = spr.c.height * k, x = Math.round((cv.width - w) / 2), y = Math.round((cv.height - h) / 2) - 4;
    g.fillStyle = '#5a5f6d'; g.fillRect(x - 10, y + h * 0.2, w + 20, 6); g.fillRect(x - 10, y + h * 0.8 - 6, w + 20, 6);   // lift arms
    g.fillStyle = '#3a3e4a'; g.fillRect(x - 16, y - 6, 8, h + 12); g.fillRect(x + w + 8, y - 6, 8, h + 12);           // posts
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 4, y + 6, w, h);                                                  // shadow
    g.drawImage(spr.c, x, y, w, h);
  }

  // ---- IN-SESSION PAUSE (spec §4 step 3): the track and car stay loaded until you leave. Car swap stays on the HUD chip.
  function pause(act) {
    root.className = '';
    const p = pane(false);
    el(p, 'h2', 'PAUSED');
    btn(p, 'RESUME ▶', () => { hide(); act.resume(); }, 'go');
    // SOUND (user, 2026-10-07: "sound needs a volume control / mute button in pause menu too please - kinda high priority"): a slider
    // 0-100 % and MUTE; audio.js remembers both (localStorage rac3r.vol / rac3r.mute)
    if (act.audio) {
      const A = act.audio, r = el(p, 'div', '', 'row'); r.style.alignItems = 'center';
      const l = el(r, 'div', ''); l.style.cssText = 'width:96px;font-size:12px';
      const s = document.createElement('input'); s.type = 'range'; s.min = 0; s.max = 100; s.step = 5; s.value = Math.round(A.volume * 100); s.style.cssText = 'flex:1;min-height:34px;accent-color:#e8a13a';
      r.appendChild(s);
      let m = null;
      const show = () => { l.textContent = 'SOUND ' + (A.muted ? 'MUTED' : Math.round(A.volume * 100) + '%'); if (m) { m.textContent = A.muted ? 'UNMUTE' : 'MUTE'; m.classList.toggle('on', A.muted); } };
      s.addEventListener('input', () => { A.setVolume(+s.value / 100); if (A.muted && +s.value > 0) A.toggleMute(); show(); });
      m = btn(r, 'MUTE', () => { A.toggleMute(); show(); });
      show();
    }
    btn(p, 'RESTART SESSION', () => { hide(); act.restart(); });
    btn(p, 'HOW TO PLAY', () => { hide(); act.guide(); });
    if (act.tests && TEST_LIST.length) btn(p, 'TESTING · ' + TEST_LIST.length, () => testing(act));   // the test queue (src/testlist.js)
    if (act.rules) btn(p, 'EVENT RULES', () => { hide(); act.rules(); });   // the walkthrough for THIS event (guide.js RULES)
    btn(p, 'TRACK SELECT', () => { act.exit(); show(); trackSelect(); });
    btn(p, 'MAIN MENU', () => { act.exit(); show(); });
  }
  // ---- TESTING (user, 2026-10-06: "a to test feature list somewhere in the pause menu ... updated when we add new features and remove
  // approved features"): src/testlist.js, newest first. Each card: where, what to try, what counts as wrong. Test mode only.
  function testing(act) {
    const p = pane(true);
    el(p, 'h2', 'TESTING · ' + TEST_LIST.length + ' TO CHECK'); el(p, 'div', 'waiting for your verdict: tell Claude "ok" or what is wrong', 'sub');
    for (const t of [...TEST_LIST].reverse()) {
      const c = el(p, 'div', '', 'test');
      el(c, 'div', t.name + ' <span>' + t.added + '</span>', 'nm');
      el(c, 'div', '<b>WHERE</b> ' + t.where, 'ln'); el(c, 'div', '<b>TRY</b> ' + t.try, 'ln'); el(c, 'div', '<b>WRONG IF</b> ' + t.wrong, 'ln bad');
    }
    const r = el(p, 'div', '', 'row');
    btn(r, 'RESUME ▶', () => { hide(); act.resume(); }, 'go'); btn(r, 'BACK', () => pause(act));
  }
  // ---- RESULTS (AI stage 4; user: "podium first, then the table"). flow = raceflow.js (results sorted on time incl. penalties;
  // est = still running when the race was cut short). act: { name, restart, tracks, menu }.
  function results(flow, act) {
    root.className = '';
    const R = flow.results, fmt = (t) => { const m = Math.floor(t / 60), x = t - m * 60; return m + ':' + (x < 10 ? '0' : '') + x.toFixed(2); };
    const who = (r) => (r.player ? 'YOU' : '#' + r.num);
    const buttons = (p) => {
      btn(p, 'RESTART ▶', () => { hide(); act.restart(); }, 'go');
      const r = el(p, 'div', '', 'row');
      btn(r, 'TRACK SELECT', () => { act.tracks(); show(); trackSelect(); }); btn(r, 'MAIN MENU', () => { act.menu(); show(); });
    };
    // the HIGHWAY race (hwrace.js): no laps or times — how far up the road each car got, and the gap in metres to the leader
    const km = (m) => (m / 1000).toFixed(2) + ' KM';
    const hwTable = () => {
      const p = pane(true);
      el(p, 'h2', 'RESULTS'); el(p, 'div', act.name + ' · ROLLING START · ' + fmt(flow.endT || flow.t), 'sub');
      const g = el(p, 'div', '', 'res'); g.style.gridTemplateColumns = 'repeat(5, auto)';
      for (const h of ['POS', 'CAR', 'DISTANCE', 'GAP', 'REPAIR']) el(g, 'div', h, 'h');
      for (const r of R) {
        const c = r.player ? 'me' : '';
        el(g, 'div', 'P' + r.pos, c);
        const w = el(g, 'div', '', c); const sw = el(w, 'span', '', 'sw'); sw.style.background = r.paint || '#e8e8ee'; w.appendChild(document.createTextNode(who(r)));
        el(g, 'div', km(r.dist), c); el(g, 'div', r.pos === 1 ? '' : '-' + Math.round(r.gapM) + ' m', c);
        el(g, 'div', r.bill ? '£' + r.bill.toLocaleString('en-GB') : '-', c);
      }
      el(p, 'div', (R[0] && R[0].player) ? 'YOU GOT AWAY' : 'THEY GOT AWAY', 'sub');
      { const me = R.find((r) => r.player); if (me) el(p, 'div', 'YOUR REPAIRS £' + (me.bill || 0).toLocaleString('en-GB') + ' — TEST MODE: SHOWN, NOT CHARGED', 'sub'); }
      buttons(p);
    };
    const table = () => {
      if (flow.highway) return hwTable();
      const p = pane(true);
      el(p, 'h2', 'RESULTS'); el(p, 'div', act.name + ' · ' + (flow.stage ? 'STAGE · STAGGERED STARTS' : flow.laps + (flow.laps === 1 ? ' LAP' : ' LAPS')), 'sub');
      const g = el(p, 'div', '', 'res');
      for (const h of ['POS', 'CAR', 'TIME', 'GAP', 'BEST', 'PEN', 'REPAIR']) el(g, 'div', h, 'h');
      for (const r of R) {
        const c = r.player ? 'me' : '';
        el(g, 'div', 'P' + r.pos, c);
        const w = el(g, 'div', '', c); const sw = el(w, 'span', '', 'sw'); sw.style.background = r.paint || '#e8e8ee'; w.appendChild(document.createTextNode(who(r)));
        el(g, 'div', r.dnf ? 'DNF' : (r.est ? '~' : '') + fmt(r.total), c);
        el(g, 'div', r.pos === 1 || r.dnf ? '' : '+' + r.gap.toFixed(2), c);
        el(g, 'div', r.best != null ? fmt(r.best) : '-', c);
        el(g, 'div', r.penalty ? '+' + r.penalty + ' s' : '', 'pen');
        el(g, 'div', r.bill ? '£' + r.bill.toLocaleString('en-GB') : '-', c);
      }
      if (R.some((r) => r.est)) el(p, 'div', flow.stage ? '~ estimated: still on the stage when you finished' : '~ estimated: still running when the top 3 were home', 'sub');
      if (R.some((r) => r.penalty)) el(p, 'div', 'PEN = time penalties (joker rule, track cuts)', 'sub');
      // DAMAGE (user: "counted cost-wise against you at the end of a race in Story mode — shown in Test but never charged")
      { const me = R.find((r) => r.player); if (me) el(p, 'div', 'YOUR REPAIRS £' + (me.bill || 0).toLocaleString('en-GB') + ' — TEST MODE: SHOWN, NOT CHARGED', 'sub'); }
      buttons(p);
    };
    // the PODIUM: 2nd, 1st, 3rd on steps, the car on top; tap or 2.5 s -> the table
    const p = pane(false);
    el(p, 'h2', 'RESULTS'); el(p, 'div', act.name, 'sub');
    const pod = el(p, 'div', '', 'podium');
    for (const [i, hgt] of [[1, 46], [0, 62], [2, 34]]) {
      const r = R[i]; const col = el(pod, 'div', ''); if (!r) continue;
      // the car as it is IN THE GAME: top-down, with its wheels, nose UP the step (user, 2026-10-05: "podium looks broken, just use normal
      // top down cars"). WAS: the body-only sprite (drawn nose-RIGHT, no wheels) squeezed into a 40 x 64 portrait box -> squashed sideways.
      const spr = api.carSprite(r.car.spec, null, true), cv = document.createElement('canvas'); cv.width = spr.c.height; cv.height = spr.c.width;
      const g2 = cv.getContext('2d'); g2.imageSmoothingEnabled = false; g2.translate(cv.width / 2, cv.height / 2); g2.rotate(-Math.PI / 2); g2.drawImage(spr.c, -spr.c.width / 2, -spr.c.height / 2);
      cv.style.width = Math.round(cv.width * 2) + 'px'; cv.style.height = Math.round(cv.height * 2) + 'px'; col.appendChild(cv);
      el(col, 'div', who(r), r.player ? '' : ''); el(col, 'div', flow.highway ? km(r.dist) : r.dnf ? 'DNF' : (r.est ? '~' : '') + fmt(r.total));
      const st = el(col, 'div', String(r.pos), 'step'); st.style.height = hgt + 'px';
    }
    const me = R.find((r) => r.player);
    if (me) el(p, 'div', 'YOU: P' + me.pos + ' of ' + R.length, 'sub');
    let gone = false; const next = () => { if (gone) return; gone = true; table(); };
    btn(p, 'RESULTS ▶', next, 'go');
    setTimeout(next, 2500);
  }
  function show() { root.className = ''; main(); }
  function hide() { root.className = 'gone'; root.innerHTML = ''; }
  return { show, hide, pause, results, profile, get open() { return root.className !== 'gone'; } };
}
