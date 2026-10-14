// menu.js — MAIN MENU, TEST MODE (track select -> match setup) and the GARAGE (user spec,
// SPECS-2026-10-03.md "UI / UX"). DOM, not canvas: lists, scrolling and taps are what the DOM is
// for, and the game canvas keeps running the DEMO LAP behind it (user's choice). Pixel-art UI
// style: hard 2 px outlines, square corners, hard drop shadows, the HUD's colour table (green = go
// / interactive, amber = highlight, red = locked / danger). Everything a screen shows is READ LIVE:
// car numbers come from src/carstats.js (measured by tools/carstats.mjs, rule 10), track pictures
// from the real level painter.
//
// main.js owns the game; this file only asks it to do things through `api`: api.thumbs() -> {
// levelId: canvas } (painted once, cached) api.launch(level, car) start a Test Mode session
// api.carSprite(id) -> canvas of the generated pixel car
import { LEVELS } from "./world/levels/index.ts";
import { ROSTER, CLASSES, classOf, PALETTE, TYRES, TYRE_BRANDS, TYRE_SURFS,
  tyreOf } from './cars.ts';
import { THEMES, LENGTHS } from './stagegen.js';
import { CAR_STATS } from './carstats.js';
import { TEST_LIST } from './testlist.js';

const KEY = 'carsim.profile.v1';
// PLAYER PROFILE (spec §5): unlocked cars, active car, last track. Every car is SEEDED unlocked for
// testing (spec: "ensure all existing vehicle IDs are seeded on boot"). localStorage can throw in
// private windows: guarded, and the game still works with the in-memory default.
function loadProfile() {
  let profile = null;
  try {
    profile = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch { /* no storage */ }
  profile = profile || {};
  profile.unlocked = [...new Set([...(profile.unlocked || []), ...ROSTER.map((car) => car.id)])];
  profile.active = ROSTER.some((car) => car.id === profile.active) ? profile.active : 'hatch-rwd';
  profile.lastLevel = LEVELS.some((entry) => entry.id === profile.lastLevel) ? profile.lastLevel
    : 'test-track';
  return profile;
}
function saveProfile(profile) {
  try {
  localStorage.setItem(KEY, JSON.stringify(profile));
} catch { /* fine */ }
}

const KIND = { lab: 'TEST GROUND', 'test-track': 'CIRCUIT', thruston: 'UK CIRCUIT',
  'castle-cum': 'UK CIRCUIT', 'brands-snatch': 'UK CIRCUIT · GP', knobhill: 'RALLYCROSS',
  'brands-snatch-indy': 'UK CIRCUIT · INDY', 'sweaty-lamb': 'RALLY STAGE',
  killder: 'RALLY STAGE · FOREST', 'slidden-hill': 'RALLYCROSS', 'grass-track': 'AUTOGRASS',
  'stock-car': 'OVAL', naffcar: 'OVAL', sandbox: 'CIRCUIT' };
// TRACK CATEGORIES (user, 2026-10-05). A level's category: CAT_OF by id, else generated / set rally
// stages -> rally, endless -> roads, anything new and unlisted -> circuits (so a new level is never
// hidden). ALL TRACKS keeps the old flat grid one tap away.
const CATS = [
  { id: 'circuits', name: 'CIRCUITS', sub: 'road racing · laps · grids' },
  { id: 'rally', name: 'RALLY STAGES', sub: 'point to point · against the clock' },
  { id: 'rx', name: 'RALLYCROSS', sub: 'mixed surface · joker lap' },
  { id: 'ovals', name: 'OVALS', sub: 'stock car · speedway · autograss' },
  { id: 'roads', name: 'ENDLESS ROADS', sub: 'how far can you get?' },
  { id: 'test', name: 'TEST GROUNDS', sub: 'surfaces · physics · free play' },
  { id: 'all', name: 'ALL TRACKS', sub: 'everything in one list' },
];
const CAT_OF = { 'test-track': 'circuits', thruston: 'circuits', 'castle-cum': 'circuits',
  'brands-snatch': 'circuits', 'brands-snatch-indy': 'circuits',
  'sweaty-lamb': 'rally', killder: 'rally', knobhill: 'rx', 'slidden-hill': 'rx',
    'grass-track': 'ovals', 'stock-car': 'ovals', naffcar: 'ovals',
  lab: 'test', sandbox: 'test' };
const catOf = (level) => CAT_OF[level.id]
  || (level.gen ? 'rally' : level.endless ? 'roads' : 'circuits');

const CSS = `
#menu { position: fixed; inset: 0; z-index: 20; display: flex; color: #e8e8ee; \
font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-weight: 700; letter-spacing: .06em; text-transform: uppercase; pointer-events: none; \
align-items: flex-start; }
#menu.gone { display: none; }
#menu .pane { pointer-events: auto; margin: 12px; padding: 14px; background: rgba(20,22,27,.94); \
border: 2px solid #000;
  box-shadow: inset 0 0 0 2px #3a3d48, 6px 6px 0 rgba(0,0,0,.55); display: flex; \
flex-direction: column; gap: 10px;
  max-height: calc(100% - 24px); overflow-y: auto; -webkit-overflow-scrolling: touch; }
#menu h1 { font-size: 26px; letter-spacing: .18em; margin: 2px 0 0; color: #e8a13a; \
text-shadow: 3px 3px 0 #000; }
#menu h2 { font-size: 15px; letter-spacing: .14em; margin: 0; color: #e8a13a; }
#menu .sub { font-size: 11px; opacity: .6; font-weight: 600; }
#menu button { font: inherit; text-transform: inherit; letter-spacing: inherit; color: #e8e8ee; \
background: #2a2d36; border: 2px solid #000;
  box-shadow: inset 0 0 0 2px #444856, 4px 4px 0 #000; padding: 12px 14px; min-height: 44px; \
text-align: left; cursor: pointer; }
#menu button:active { transform: translate(2px,2px); box-shadow: inset 0 0 0 2px #444856, \
2px 2px 0 #000; }
#menu button.go { background: #4cc2a0; color: #0d1a16; box-shadow: inset 0 0 0 2px #7fe0c4, \
4px 4px 0 #000; }
#menu button.on { background: #e8a13a; color: #2a1405; box-shadow: inset 0 0 0 2px #f5c879, \
4px 4px 0 #000; }
#menu button[disabled] { opacity: .38; cursor: default; }
#menu button[disabled]:active { transform: none; }
#menu .tag { font-size: 10px; color: #d8453c; margin-left: 8px; }
#menu .row { display: flex; gap: 8px; align-items: stretch; flex-wrap: wrap; }
#menu .picker { display: flex; flex-direction: column; gap: 6px; padding: 8px; margin: 4px 0 8px; \
background: #17191e; border: 2px solid #000; box-shadow: inset 0 0 0 2px #2a2d36; }
#menu .picker .prow { display: flex; align-items: center; gap: 6px; }
#menu .picker .cap { width: 52px; flex: none; text-align: center; font-size: 10px; \
padding: 5px 0; color: #14161b; border: 2px solid #000; }
#menu .picker button { flex: none; min-width: 40px; min-height: 34px; padding: 0 10px; }
#menu .picker .val { flex: 1; text-align: center; font-size: 12px; line-height: 1.1; }
#menu .picker .val.car { font-size: 15px; display: flex; flex-direction: column; \
align-items: center; }
#menu .picker .val.car span { font-size: 9px; color: #9aa0aa; margin-top: 2px; }
#menu .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); \
gap: 10px; }
#menu .card { display: flex; flex-direction: column; gap: 6px; padding: 8px; }
#menu .card canvas { width: 100%; aspect-ratio: 16 / 10; object-fit: contain; \
background: #111318; border: 2px solid #000; image-rendering: pixelated; }
#menu .card .nm { font-size: 13px; } #menu .card .k { font-size: 10px; opacity: .6; }
#menu .cats { display: flex; flex-direction: column; gap: 8px; }
#menu .cat { display: flex; align-items: center; gap: 12px; padding: 8px 12px 8px 8px; \
min-height: 64px; }
#menu .cat .strip { display: flex; gap: 3px; flex: none; width: 150px; }
#menu .cat .strip canvas { width: 48px; height: 44px; object-fit: cover; background: #111318; \
border: 2px solid #000; image-rendering: pixelated; }
#menu .cat .tx { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
#menu .cat .nm { font-size: 16px; letter-spacing: .12em; } #menu .cat .k { font-size: 10px; \
opacity: .6; text-transform: none; letter-spacing: .04em; }
#menu .cat .n { flex: none; font-size: 18px; color: #e8a13a; min-width: 28px; text-align: right; \
} #menu .cat.on .n { color: #2a1405; }
@media (max-width: 480px) { #menu .cat .strip { width: 99px; } \
#menu .cat .strip canvas:nth-child(3) { display: none; } #menu .cat .nm { font-size: 14px; } }
#menu .stats { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 12px; }
#menu .stats b { color: #4cc2a0; font-weight: 700; }
/* the lift is capped in HEIGHT: photographed in landscape it filled the pane and pushed the \
stats and buttons off screen */
#menu .lift { background: #23262e; border: 2px solid #000; image-rendering: pixelated; \
width: 100%; max-height: 34vh; object-fit: contain; }
#menu .podium { display: flex; gap: 8px; align-items: flex-end; justify-content: center; \
padding-top: 6px; }
#menu .podium > div { display: flex; flex-direction: column; align-items: center; gap: 4px; \
width: 92px; font-size: 11px; }
#menu .podium canvas { image-rendering: pixelated; max-width: 92px; max-height: 120px; \
object-fit: contain; }
#menu .podium .step { width: 100%; background: #2a2d36; border: 2px solid #000; \
box-shadow: inset 0 0 0 2px #444856; display: flex;
  align-items: flex-start; justify-content: center; font-size: 22px; padding-top: 4px; \
color: #e8a13a; }
#menu .res { display: grid; grid-template-columns: repeat(7, auto); justify-content: start; \
gap: 3px 16px; font-size: 12px; align-items: center; }
#menu .res .h { font-size: 9px; opacity: .55; }
#menu .res > div { white-space: nowrap; }
@media (max-width: 480px) { #menu .res { gap: 3px 9px; font-size: 11px; } #menu .res .h { \
font-size: 8px; } } #menu .res .me { color: #4cc2a0; } #menu .res .pen { color: #d8453c; }
#menu .res .sw { width: 12px; height: 12px; border: 2px solid #000; display: inline-block; \
vertical-align: -2px; margin-right: 4px; }
#menu .garage { display: flex; gap: 12px; flex-wrap: wrap; } #menu .garage > * { flex: 1 1 240px; \
min-width: 0; }
#menu .test { background: #17191e; border: 2px solid #000; box-shadow: inset 0 0 0 2px #2a2d36; \
padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; }
#menu .test .nm { font-size: 13px; color: #4cc2a0; } #menu .test .nm span { font-size: 9px; \
opacity: .5; margin-left: 6px; }
#menu .test .ln { font-size: 11px; text-transform: none; letter-spacing: .02em; font-weight: 600; \
line-height: 1.35; } #menu .test .ln b { color: #e8a13a; font-size: 9px; letter-spacing: .1em; \
margin-right: 4px; }
#menu .test .ln.bad b { color: #d8453c; }
`;

export function createMenu(api) {
  const profile = loadProfile();
  const styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);
  const root = document.createElement('div');
  root.id = 'menu';
  root.className = 'gone';
  document.body.appendChild(root);
  let thumbs = null;
  // GHOST-CLICK GUARD. MEASURED BUG (portrait, 2026-10-03): tapping the HUD pause chip opened the
  // pause pane, and the SAME tap's follow-up click landed on RESUME, which sits right under the
  // chip at 390 px — paused and resumed in one tap. Every new screen ignores clicks for GHOST_MS.
  let openedAt = 0;
  const GHOST_MS = 350;
  const pane = (wide) => {
    openedAt = performance.now();
  root.innerHTML = '';
  const panel = document.createElement('div');
  panel.className = 'pane';
  panel.style.width = wide ? 'min(720px, calc(100% - 24px))' : 'min(320px, calc(100% - 24px))';
  root.appendChild(panel);
  return panel;
  };
  const btn = (parent, label, onClick, cls = '', disabled = false, tag = '') => {
    const button = document.createElement('button');
    button.innerHTML = label + (tag ? `<span class="tag">${tag}</span>` : '');
    if (cls) button.className = cls;
    button.disabled = disabled;
    button.addEventListener('click', (evt) => {
      evt.stopPropagation();
    if (!disabled && performance.now() - openedAt > GHOST_MS) onClick();
    });
    parent.appendChild(button);
    return button;
  };
  const addEl = (parent, tag, html, cls) => {
    const elem = document.createElement(tag);
  elem.innerHTML = html;
  if (cls) elem.className = cls;
  parent.appendChild(elem);
  return elem;
  };

  // ---- MAIN MENU (spec §2): Story locked, Garage, Test Mode (primary)
  function main() {
    const panel = pane(false);
    addEl(panel, 'h1', 'RAC3R');
    addEl(panel, 'div', 'a driving sandbox', 'sub');   // the game's name (user, 2026-10-03)
    btn(panel, 'TEST MODE', trackSelect, 'go');
    btn(panel, 'GARAGE', garage);
    btn(panel, 'STORY', () => {}, '', true, 'LOCKED');
  }

  // ---- TEST MODE step 1: CATEGORY LIST (user, 2026-10-05: "a menu layer for circuit type, stick
  // appropriate tracks in the correct category" — "a BIG LIST", Grass Track in OVALS), then step
  // 1b: that category's track cards (overhead thumbnails)
  function trackSelect() {
    const panel = pane(true);
    addEl(panel, 'h2', 'TEST MODE · CHOOSE A TYPE');
    if (!thumbs) thumbs = api.thumbs();
    const list = addEl(panel, 'div', '', 'cats');
    for (const category of CATS) {
      const lvs = LEVELS.filter((entry) => category.id === 'all' || catOf(entry) === category.id);
      if (!lvs.length) continue;
      const button = btn(list, '', () => {
        profile.lastCat = category.id;
      saveProfile(profile);
      trackList(category.id);
      }, 'cat' + (category.id === profile.lastCat ? ' on' : ''));
      const strip = addEl(button, 'div', '', 'strip');
      for (const level of lvs.slice(0, 3)) {
        const thumb = thumbs[level.id];
      if (!thumb) continue;
      const canvas = document.createElement('canvas');
      canvas.width = thumb.width;
      canvas.height = thumb.height;
      canvas.getContext('2d').drawImage(thumb, 0, 0);
      strip.appendChild(canvas);
      }
      const text = addEl(button, 'div', '', 'tx');
      addEl(text, 'span', category.name, 'nm');
      addEl(text, 'span', category.sub, 'k');
      addEl(button, 'span', String(lvs.length), 'n');
    }
    const row = addEl(panel, 'div', '', 'row');
    btn(row, '◀ BACK', main);
  }
  function trackList(cat) {
    const panel = pane(true), catEntry = CATS.find((entry) => entry.id === cat)
      || CATS[CATS.length - 1];
    addEl(panel, 'h2', 'TEST MODE · ' + catEntry.name);
    if (!thumbs) thumbs = api.thumbs();
    {
      const cur = LEVELS.find((entry) => entry.gen && !entry.fixed), savedGen = profile.gen;
    if (cur && savedGen && ['seed', 'theme', 'len', 'style'].some((key) => savedGen[key]
      !== cur.gen[key])) api.genStage(savedGen);
    }
    const grid = addEl(panel, 'div', '', 'grid');
    for (const level of LEVELS.filter((entry) => cat === 'all' || catOf(entry) === cat)) {
      const button = btn(grid, '', () => {
        profile.lastLevel = level.id;
      saveProfile(profile);
      setup(level);
      }, 'card' + (level.id === profile.lastLevel ? ' on' : ''));
      if (level.gen && !level.fixed) {
        const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 200;
      roadMap(canvas, level);
      button.appendChild(canvas);
      addEl(button, 'span', 'STAGE GENERATOR', 'nm');
      addEl(button, 'span', 'RALLY STAGE · NEW EVERY TIME', 'k');
      continue;
      }
      const thumb = thumbs[level.id];
      if (thumb) {
        const canvas = document.createElement('canvas');
      canvas.width = thumb.width;
      canvas.height = thumb.height;
      canvas.getContext('2d').drawImage(thumb, 0, 0);
      button.appendChild(canvas);
      }
      addEl(button, 'span', level.name, 'nm');
      addEl(button, 'span', level.endless ? 'ENDLESS MOTORWAY' : level.fixed ? 'RALLY STAGE · '
        + THEMES[level.gen.theme].name.split(' ')[0] : KIND[level.id] || 'TRACK', 'k');
    }
    const row = addEl(panel, 'div', '', 'row');
    btn(row, '◀ TYPES', trackSelect);
  }

  // ---- TEST MODE step 2 (spec §4): Solo now; Race vs AI shown, locked until AI exists. Car picker
  // (unlocked only). a generated stage's ROAD MAP: the theme's ground, the road (not the ghost
  // return), START green, FINISH chequered
  function roadMap(canvas, level) {
    const ctx = canvas.getContext('2d'), sub = level.subtrack, points = sub.pts, ghost = sub.ghost;
    const ground = { forest: '#2c3b27', alpine: '#3a4434', snow: '#cfd8df',
      desert: '#b89a68' }[level.gen.theme] || '#2c3b27';
    const roadCol = { forest: '#8a7a5c', alpine: '#4a4d55', snow: '#f4f7fa',
      desert: '#d8bf8c' }[level.gen.theme] || '#888';
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const point of points) {
      minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
    }
    const scale = Math.min((canvas.width - 24) / (maxX - minX || 1), (canvas.height - 24)
      / (maxY - minY || 1)), mapX = (x) => 12 + (x - minX) * scale
      + ((canvas.width - 24) - (maxX - minX) * scale) / 2, mapY = (y) => 12 + (y - minY) * scale
      + ((canvas.height - 24) - (maxY - minY) * scale) / 2;
    const isG = (i) => ghost && points[i].dist >= ghost.d0 - 0.01 && points[i].dist < ghost.d1
      - 0.01;
    for (const [lineWidth, col] of [[Math.max(4, sub.width * scale + 3), 'rgba(0,0,0,0.45)'],
      [Math.max(2.5, sub.width * scale), roadCol]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        if (isG(i)) {
        ctx.lineTo(mapX(points[i].x), mapY(points[i].y));
      ctx.stroke();
      ctx.beginPath();
      continue;
      }
      if (i === 0 || isG(i - 1)) ctx.moveTo(mapX(points[i].x),
        mapY(points[i].y)); else ctx.lineTo(mapX(points[i].x), mapY(points[i].y));
      }
      ctx.lineTo(mapX(points[0].x), mapY(points[0].y));
      ctx.stroke();
    }
    const finish = onTrackPt(level, level.stage.finish);
    ctx.fillStyle = '#4cc2a0';
    ctx.beginPath();
    ctx.arc(mapX(points[0].x), mapY(points[0].y), 5, 0, 7);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#111' : '#fff';
    ctx.fillRect(mapX(finish.x) - 5 + (i % 2) * 5, mapY(finish.y) - 5 + (i >> 1) * 5, 5, 5);
    }
  }
  const onTrackPt = (level, dist) => {
    const points = level.subtrack.pts;
  let best = points[0];
  for (const point of points) if (Math.abs(point.dist - dist)
    < Math.abs(best.dist - dist)) best = point;
  return best;
  };

  // GENERATOR SETUP (user, 2026-10-04: procedural point-to-point stages): THEME, LENGTH, CORNERS,
  // SEED (◀ ▶ / NEW STAGE), the road map; every change regenerates (≤ ~0.5 s) and the setup reopens
  // on the new stage. Remembered in profile.gen.
  function genRows(panel, level) {
    const gen = { ...level.gen };
    const map = document.createElement('canvas');
    map.width = 320;
    map.height = 200;
    map.style.cssText = 'width:100%;border:2px solid #000;image-rendering:pixelated;margin:4px 0';
    panel.appendChild(map);
    roadMap(map, level);
    addEl(panel, 'div',
      `${THEMES[gen.theme].name} · ${level.gen.km.toFixed(2)} KM · SEED ${gen.seed}`, 'sub');
    const regen = (changes) => {
      Object.assign(gen, changes);
    profile.gen = { theme: gen.theme, len: gen.len, style: gen.style, seed: gen.seed };
    saveProfile(profile);
    const newLevel = api.genStage(gen);
    profile.lastLevel = newLevel.id;
    saveProfile(profile);
    setup(newLevel);
    };
    const row = (opts, cur, key) => {
      const rowEl = addEl(panel, 'div', '', 'row');
    for (const [value, label] of opts) btn(rowEl, label, () => regen({ [key]: value }), value
      === cur ? 'on' : '');
    };
    row(Object.entries(THEMES).map(([key, theme]) => [key, theme.name.split(' ')[0]]), gen.theme,
      'theme');
    row(Object.keys(LENGTHS).map((key) => [key, key.toUpperCase()]), gen.len, 'len');
    row([['flowing', 'FLOWING'], ['mixed', 'MIXED'], ['tight', 'TIGHT']], gen.style, 'style');
    const seedRow = addEl(panel, 'div', '', 'row');
    btn(seedRow, '◀', () => regen({ seed: Math.max(1, gen.seed - 1) }));
    btn(seedRow, '▶', () => regen({ seed: gen.seed + 1 }));
    btn(seedRow, 'NEW STAGE 🎲', () => regen({ seed: 1 + Math.floor(Math.random() * 99999) }),
      'go');
  }
  function setup(level) {
    const panel = pane(false);
    addEl(panel, 'h2', level.name);
    addEl(panel, 'div', level.endless ? 'ENDLESS MOTORWAY · HOW FAR CAN YOU GET?' : level.fixed
      ? `RALLY STAGE · ${THEMES[level.gen.theme].name} · ${level.gen.km.toFixed(2)} KM · POINT TO \
POINT`
      : level.gen ? 'GENERATED RALLY STAGE · POINT TO POINT' : KIND[level.id] || 'TRACK', 'sub');
    if (level.gen && !level.fixed) genRows(panel, level);
    // ROAD TYPE (endless highway, user 2026-10-05: "how do I test the lane presets — I don't see
    // any buttons"): lanes / width / walls
    let road = level.roadType || null;
    if (level.roadTypes) {
      const roadRow = addEl(panel, 'div', '', 'row');
    const roadBtns = Object.entries(level.roadTypes).map(([roadKey, name]) => btn(roadRow, name,
      () => {
      road = roadKey;
    roadBtns.forEach((button, i) => button.classList.toggle('on', Object.keys(level.roadTypes)[i]
      === road));
    }, roadKey === road ? 'on' : ''));
    }
    // TRAFFIC + LITTER sliders (user, 2026-10-05: "a slider in test mode for density" / "a slider
    // for frequency / density" of the roadside objects); remembered. TRAFFIC 0-150 % (100 % = 6
    // cars a lane), LITTER 0-3 x
    let traffic = profile.traffic ?? 0.6, litter = profile.litter ?? 1;
    if (level.endless) {
      const slider = (label, min, max, stepV, val, fmt, set) => {
        const row = addEl(panel, 'div', '', 'row');
        row.style.alignItems = 'center';
        const labelEl = addEl(row, 'div', '');
        labelEl.style.cssText = 'width:120px;font-size:12px';
        const input = document.createElement('input');
        input.type = 'range';
        input.min = min;
        input.max = max;
        input.step = stepV;
        input.value = val;
        input.style.cssText = 'flex:1;min-height:34px;accent-color:#e8a13a';
        const showLabel = () => {
          labelEl.textContent = label + ' ' + fmt(+input.value);
        };
        input.addEventListener('input', () => {
          set(+input.value);
        showLabel();
        saveProfile(profile);
        });
        row.appendChild(input);
        showLabel();
      };
      slider('TRAFFIC', 0, 1.5, 0.05, traffic, (value) => value ? Math.round(value * 100) + '%'
        : 'OFF', (value) => {
        traffic = profile.traffic = value;
      });
      slider('LITTER', 0, 3, 0.1, litter, (value) => value ? value.toFixed(1) + 'x' : 'OFF',
        (value) => {
        litter = profile.litter = value;
      });
    }
    const modeRow = addEl(panel, 'div', '', 'row');
    // VS AI (2026-10-04, AI stage 1 preview): 1-5 opponents in the same car, different colours.
    // Racing / lights / results come in later stages.
    let opponents = 0, aiN = 5;
    const bSolo = btn(modeRow, 'SOLO', () => {
      opponents = 0;
    paint();
    }, 'on'), bAI = btn(modeRow, 'VS AI', () => {
      opponents = aiN;
    paint();
    });
    const nRow = addEl(panel, 'div', '', 'row');
    const nBtns = [1, 2, 3, 4, 5].map((count) => btn(nRow, String(count), () => {
      aiN = count;
    opponents = count;
    paint();
    }));
    // DIFFICULTY (PLAN.md §4; the centre of the field's spread — aidriver.js)
    const DIFF = [['MOBILE', 'Mobile game'], ['GAME', 'Game'], ['REALISH', 'Realish'],
      ['RICH', "Real but you're rich"], ['REAL', 'Real']];
    let diff = 2;
    try {
      const stored = localStorage.getItem('carsim.aidiff');
    if (stored != null) diff = Math.max(0, Math.min(4, +stored));
    } catch { /* default */ }
    const dRow = addEl(panel, 'div', '', 'row');
    const dBtns = DIFF.map(([name], i) => btn(dRow, name, () => {
      diff = i;
    try {
      localStorage.setItem('carsim.aidiff', String(i));
    } catch { /* fine */ }
    paint();
    }));
    const dName = addEl(panel, 'div', '', 'sub');
    // AI CARS: CLASS (each AI a car of your class) or YOUR CAR (all the same as you); remembered
    let aiCars = profile.aiCars === 'same' ? 'same' : 'class';
    const aRow = addEl(panel, 'div', '', 'row');
    const bCls = btn(aRow, 'AI: CLASS CARS', () => {
      aiCars = 'class';
    profile.aiCars = aiCars;
    saveProfile(profile);
    paint();
    });
    const bSame = btn(aRow, 'AI: YOUR CAR', () => {
      aiCars = 'same';
    profile.aiCars = aiCars;
    saveProfile(profile);
    paint();
    });
    let paint = function () {
      bSolo.classList.toggle('on', opponents === 0);
    bAI.classList.toggle('on', opponents > 0);
    nRow.style.display = opponents ? '' : 'none';
    nBtns.forEach((button, i) => button.classList.toggle('on', i + 1 === aiN));
      dRow.style.display = opponents ? '' : 'none';
      dName.style.display = opponents ? '' : 'none';
      dBtns.forEach((button, i) => button.classList.toggle('on', i === diff));
      dName.textContent = 'AI: ' + DIFF[diff][1];
      aRow.style.display = opponents ? '' : 'none';
      bCls.classList.toggle('on', aiCars === 'class');
      bSame.classList.toggle('on', aiCars === 'same');
    };
    paint();
    // a JOKER level offers the RX race (5 laps from the grid, joker once, missed = +5 s) next to
    // free practice
    let rxRace = false;
    if (level.joker) {
      const rxRow = addEl(panel, 'div', '', 'row');
      const practiceBtn = btn(rxRow, 'PRACTICE', () => {
        rxRace = false;
      practiceBtn.classList.add('on');
      rxBtn.classList.remove('on');
      }, 'on');
      const rxBtn = btn(rxRow, `RX RACE · ${level.joker.laps} LAPS`, () => {
        rxRace = true;
      rxBtn.classList.add('on');
      practiceBtn.classList.remove('on');
      });
    }
    // LAPS (user, 2026-10-04: "choose in setup"): a race (VS AI or the RX race) is this many laps;
    // default 3, the RX race its joker laps
    let laps = level.joker ? level.joker.laps || 5 : 3;
    const lRow = addEl(panel, 'div', '', 'row'), lLbl = addEl(lRow, 'div', '');
    lLbl.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;\
font-size:14px';
    // (the highway has no laps: a ROLLING START, and it ends when someone gets away off screen — a
    // line says so instead)
    const lPaint = () => {
      lLbl.textContent = laps + (laps === 1 ? ' LAP' : ' LAPS');
    lRow.style.display = (opponents || rxRace) && !level.endless ? '' : 'none';
    if (hwNote) hwNote.style.display = opponents ? '' : 'none';
    };
    const hwNote = level.endless ? addEl(panel, 'div',
      'ROLLING START · GET AWAY: LOSE THEM OFF THE BOTTOM OF THE SCREEN TO WIN · LET ONE GET AWAY \
OFF THE TOP AND IT IS OVER', 'sub') : null;
    btn(lRow, '−', () => {
      laps = Math.max(1, laps - 1);
    lPaint();
    });
    lRow.appendChild(lLbl);
    btn(lRow, '+', () => {
      laps = Math.min(10, laps + 1);
    lPaint();
    });
    const paint0 = paint;
    paint = () => {
      paint0();
    lPaint();
    };
    if (level.joker) for (const button of panel.querySelectorAll('button'))
      if (/PRACTICE|RX RACE/.test(button.textContent))
        button.addEventListener('click', () => lPaint());
    paint();
    carPicker(panel);
    btn(panel, 'LAUNCH ▶', () => {
      hide();
    api.launch(level.id, profile.active,
      { rx: rxRace, ai: opponents, diff, road, aiCars,
      ...(level.endless ? { traffic, litter } : {}), laps: opponents || rxRace ? laps : 0,
      livery: (profile.livery || {})[profile.active],
      tyre: (profile.tyres || {})[profile.active] });
    }, 'go');
    btn(panel, '◀ BACK', () => trackList(profile.lastCat || catOf(level)));
  }
  // CAR PICKER filtered CLASS -> SUBCLASS -> car (user, 2026-10-04). Only classes / subclasses you
  // own a car in are offered ('ALL' first); the filter starts on the active car's class.
  // onPick(row) after every change. Used by race setup and the garage.
  function carPicker(panel, onPick = () => {}) {
    const owned = () => ROSTER.filter((car) => profile.unlocked.includes(car.id));
    const cur = () => ROSTER.find((car) => car.id === profile.active);
    let filterClass = cur().cls, filterSub = 'ALL';
    const clsList = () => ['ALL', ...CLASSES.filter((cls) => owned().some((car) => car.cls
      === cls.id)).map((cls) => cls.id)];
    const subList = () => filterClass === 'ALL' ? ['ALL']
      : ['ALL', ...classOf(filterClass).subs.filter((sub) => owned().some((car) => car.cls
      === filterClass && car.sub === sub))];
    const cars = () => owned().filter((car) => (filterClass === 'ALL' || car.cls === filterClass)
      && (filterSub === 'ALL' || car.sub === filterSub));
    const step = (list, value, delta) => list[(list.indexOf(value) + delta
      + list.length) % list.length];
    const fit = () => {
      const list = cars();
    if (!list.some((car) => car.id === profile.active)) profile.active = list[0].id;
    saveProfile(profile);
    };
    // one boxed group; each row: TAG (coloured) ◀ value ▶ — the value takes the tag's colour so the
    // three read as a set
    const box = addEl(panel, 'div', '', 'picker');
    const row = (tag, col, prev, next) => {
      const rowEl = addEl(box, 'div', '', 'prow');
      const tagEl = addEl(rowEl, 'div', tag, 'cap');
      tagEl.style.background = col;
      btn(rowEl, '◀', prev);
      const valEl = addEl(rowEl, 'div', '', 'val');
      valEl.style.color = col;
      btn(rowEl, '▶', next);
      return valEl;
    };
    const classLabel = row('CLASS', '#e8a13a', () => {
      filterClass = step(clsList(), filterClass, -1);
    filterSub = 'ALL';
    fit();
    paint();
    }, () => {
      filterClass = step(clsList(), filterClass, 1);
    filterSub = 'ALL';
    fit();
    paint();
    });
    const subLabel = row('TYPE', '#4cc2a0', () => {
      filterSub = step(subList(), filterSub, -1);
    fit();
    paint();
    }, () => {
      filterSub = step(subList(), filterSub, 1);
    fit();
    paint();
    });
    const lbl = row('CAR', '#e8e8ee', () => {
      profile.active = step(cars().map((car) => car.id), profile.active, -1);
    saveProfile(profile);
    paint();
    },
      () => {
        profile.active = step(cars().map((car) => car.id), profile.active, 1);
      saveProfile(profile);
      paint();
      });
    lbl.classList.add('car');
    const paint = () => {
      const car = cur(), total = cars().length, index = cars().findIndex((x) => x.id === car.id)
        + 1;
      classLabel.textContent = filterClass === 'ALL' ? 'ALL' : classOf(filterClass).name;
      subLabel.textContent = filterSub === 'ALL' ? 'ALL' : filterSub.toUpperCase();
      lbl.innerHTML = car.name + `<span>${index} / ${total}</span>`;
      onPick(car);
    };
    paint();
  }


  // ---- GARAGE (spec §3; user chose: the TOP-DOWN car on a workshop LIFT). Browse owned cars,
  // measured stats.
  function garage() {
    const panel = pane(true);
    addEl(panel, 'h2', 'GARAGE');
    const box = addEl(panel, 'div', '', 'garage');
    const left = addEl(box, 'div', ''), right = addEl(box, 'div', '');
    const lift = document.createElement('canvas');
    lift.className = 'lift';
    lift.width = 360;
    lift.height = 150;
    left.appendChild(lift);
    const pick = addEl(left, 'div', '');
    pick.style.marginTop = '8px';
    const stats = addEl(right, 'div', '', 'stats');
    const showStats = () => {
      const car = ROSTER.find((x) => x.id === profile.active), spec = CAR_STATS[car.id] || {};
      drawLift(lift, api.carSprite(car.id, (profile.livery || {})[car.id]));
      const aids = spec.aids ? [spec.aids.abs && 'ABS', spec.aids.tcs
        && 'TCS'].filter(Boolean).join(' + ') || 'NONE' : 'NONE';
      stats.innerHTML = `<span>TOP SPEED</span><b>${spec.topKph ?? '—'} KM/H</b><span>0-100 \
KM/H</span><b>${spec.zeroTo100 != null ? spec.zeroTo100 + ' S' : '—'}</b>`
        + `<span>100-0 BRAKING</span><b>${spec.brake100 ?? '—'} M</b><span>GRIP</span><b>${(() => {
          const tarmacGrip = tyreOf((profile.tyres || {})[car.id]).grip.tarmac;
          return spec.gripG == null ? '—' : tarmacGrip === 1 ? spec.gripG + ' G'
            : (spec.gripG * tarmacGrip).toFixed(2) + ' G <span style="color:#9aa0aa;\
font-size:10px">STOCK ' + spec.gripG + '</span>';
        })()}</b>`
        + `<span>WEIGHT</span><b>${spec.massKg} KG</b><span>DRIVE</span><b>${spec.drive}</b><span>\
AIDS</span><b>${aids}</b>`
        + `<span>CLASS</span><b>${classOf(car.cls).name} · ${car.sub.toUpperCase()}</b>`
        + (() => {
          const tyre = tyreOf((profile.tyres || {})[car.id]),
            brand = TYRE_BRANDS.find((x) => x.id === tyre.brand);
          return `<span>TYRES</span><b style="color:${brand.col}">${brand.name} \
· ${tyre.name.toUpperCase()}</b>`;
        })();
    };
    const buttonRow = addEl(panel, 'div', '', 'row');
    btn(buttonRow, 'PAINT', () => paintShop());
    btn(buttonRow, 'TYRES', () => tyreShop());
    btn(buttonRow, 'BUY CARS', () => {}, '', true, 'SOON');
    btn(buttonRow, 'UPGRADES', () => {}, '', true, 'SOON');
    btn(panel, '◀ BACK', main);
    carPicker(pick, showStats);
  }
  // ---- PAINT SHOP (user, 2026-10-04: "palette + number + preview"): BODY and TRIM from the
  // 16-colour PALETTE, a NUMBER 1-99 (or none), the car previewed on the lift as you go; APPLY
  // saves it to the profile (it follows the car into events), BACK drops the changes, STOCK puts
  // the car's own colours back. Test mode: free (prices come with story mode).
  function paintShop() {
    const panel = pane(true), carId = profile.active, car = ROSTER.find((x) => x.id === carId);
    const cur = { paint: car.paint, trim: car.trim, num: 0,
      ...((profile.livery || {})[carId] || {}) };
    addEl(panel, 'h2', 'PAINT · ' + car.name);
    const box = addEl(panel, 'div', '', 'garage'), left = addEl(box, 'div', ''),
      right = addEl(box, 'div', '');
    const lift = document.createElement('canvas');
    lift.className = 'lift';
    lift.width = 360;
    lift.height = 150;
    left.appendChild(lift);
    const showLivery = () => {
      drawLift(lift, api.carSprite(carId, cur));
    numL.textContent = cur.num ? '#' + cur.num : 'NO NUMBER';
      for (const [field, list] of [['paint', bodyB],
        ['trim', trimB]]) for (const button of list) button.style.outline = button.dataset.c
        === cur[field] ? '3px solid #e8a13a' : 'none';
    };
    const swatches = (label, field) => {
      addEl(right, 'div', label, 'sub');
      const grid = addEl(right, 'div', '');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(8,1fr);gap:4px;\
margin-bottom:8px';
      return PALETTE.map((colour) => {
        const swatch = btn(grid, '', () => {
        cur[field] = colour;
      showLivery();
      });
      swatch.dataset.c = colour;
        swatch.style.cssText = 'background:' + colour
          + ';min-width:0;min-height:0;height:24px;padding:0;box-shadow:none;outline-offset:-1px';
        return swatch;
      });
    };
    const bodyB = swatches('BODY', 'paint'), trimB = swatches('TRIM', 'trim');
    const numRow = addEl(left, 'div', '', 'row');
    numRow.style.marginTop = '8px';
    btn(numRow, '−10', () => {
      cur.num = Math.max(0, cur.num - 10);
    showLivery();
    });
    btn(numRow, '−', () => {
      cur.num = Math.max(0, cur.num - 1);
    showLivery();
    });
    const numL = addEl(numRow, 'div', '');
    numL.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;\
font-size:15px';
    btn(numRow, '+', () => {
      cur.num = Math.min(99, cur.num + 1);
    showLivery();
    });
    btn(numRow, '+10', () => {
      cur.num = Math.min(99, cur.num + 10);
    showLivery();
    });
    const buttonRow = addEl(panel, 'div', '', 'row');
    btn(buttonRow, 'STOCK', () => {
      Object.assign(cur, { paint: car.paint, trim: car.trim, num: 0 });
    showLivery();
    });
    btn(buttonRow, 'APPLY ✓', () => {
      profile.livery = profile.livery || {};
    profile.livery[carId] = { ...cur };
    saveProfile(profile);
    garage();
    }, 'go');
    btn(panel, '◀ BACK', garage);
    showLivery();
  }
  // ---- TYRES (user, 2026-10-04: 4 brands / 15 types, fit by class, prices shown, the effect shown
  // with the stats). Grouped by brand (coloured), a tyre that does not fit this car's class is
  // shown but locked; the panel: grip per surface vs Pre-Spun, the heat window, what it is for, the
  // price; FIT saves it to profile.tyres[id] and it rides into every event. Test mode: free.
  function tyreShop() {
    const panel = pane(true), carId = profile.active, car = ROSTER.find((x) => x.id === carId),
      spec = CAR_STATS[carId] || {};
    let sel = tyreOf((profile.tyres || {})[carId]).id;
    addEl(panel, 'h2', 'TYRES · ' + car.name);
    const box = addEl(panel, 'div', '', 'garage'), left = addEl(box, 'div', ''),
      right = addEl(box, 'div', '');
    const btns = {};
    for (const brand of TYRE_BRANDS) {
      const head = addEl(left, 'div', brand.name + ' <span style="color:#9aa0aa;font-size:10px">'
        + brand.blurb + '</span>');
      head.style.cssText = 'margin:6px 0 4px;font-size:12px;color:' + brand.col;
      const group = addEl(left, 'div', '');
      group.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px';
      for (const tyre of TYRES.filter((x) => x.brand === brand.id)) {
        const fits = tyre.fits.includes(car.cls);
        const tyreBtn = btn(group, tyre.name, () => {
          sel = tyre.id;
        showTyre();
        }, '', !fits, fits ? '' : 'NO FIT');
        tyreBtn.style.cssText = 'min-height:32px;padding:4px 9px;font-size:11px;border-left:5px \
solid ' + brand.col;
        btns[tyre.id] = tyreBtn;
      }
    }
    const info = addEl(right, 'div', '');
    const fitR = addEl(panel, 'div', '', 'row');
    const fitB = btn(fitR, 'FIT ✓', () => {
      profile.tyres = profile.tyres || {};
    profile.tyres[carId] = sel;
    saveProfile(profile);
    garage();
    }, 'go');
    btn(panel, '◀ BACK', garage);
    const showTyre = () => {
      const tyre = tyreOf(sel), brand = TYRE_BRANDS.find((x) => x.id === tyre.brand),
        cur = tyreOf((profile.tyres || {})[carId]).id === tyre.id;
      for (const [key, tyreBtn] of Object.entries(btns)) tyreBtn.style.outline = key === sel
        ? '3px solid #e8a13a' : 'none';
      const bar = (lbl, surf) => {
        const grip = tyre.grip[surf], percent = Math.round((grip - 1) * 100),
          width = Math.max(4, Math.min(100, grip / 1.6 * 100));
        return `<div style="display:flex;align-items:center;gap:6px;margin:2px 0"><span \
style="width:44px;font-size:10px">${lbl}</span>`


              + `<div style="flex:1;height:10px;background:#2a2d36;border:1px solid #000;\
position:relative"><div style="position:absolute;left:62.5%;top:-3px;bottom:-3px;width:2px;\
background:#e8e8ee"></div><div style="height:100%;width:${width}%;\
background:${grip > 1.001 ? '#4cc2a0' : grip < 0.999 ? '#d8453c' : '#9aa0aa'}"></div></div>`
              + `<span style="width:40px;text-align:right;font-size:11px;\
color:${grip > 1.001 ? '#4cc2a0' : grip < 0.999 ? '#d8453c' : '#9aa0aa'}">\
${percent > 0 ? '+' : ''}${percent}%</span></div>`;
        };
      const opt = tyre.opt || [65, 110], heat = (tyre.heatHard || 1) > 1.05 ? 'FAST on tarmac'
        : (tyre.heatHard || 1) < 0.95 ? 'slow' : 'normal';
      const tarmacG = spec.gripG ? (spec.gripG * tyre.grip.tarmac).toFixed(2) + ' G' : '—';
      info.innerHTML = `<div style="font-size:15px;color:${brand.col}">${brand.name} \
· ${tyre.name.toUpperCase()}</div>`
        + `<div class="sub" style="margin:2px 0 6px">${tyre.note || ''}</div>`
        + '<div class="sub" style="font-size:9px">white line = STOCK (PRE-SPUN)</div>'
          + TYRE_SURFS.map(([surf, lbl]) => bar(lbl, surf)).join('')
        + `<div class="stats" style="margin-top:6px"><span>GRIP (TARMAC)</span><b>${tarmacG}</b>\
<span>WORKING HEAT</span><b>${opt[0]}-${opt[1]} C</b>`
        + `<span>HEATS UP</span><b>${heat}</b><span>PRICE</span><b>\
£${tyre.price}${tyre.price ? ' · FREE IN TEST' : ''}</b></div>`;
      fitB.innerHTML = cur ? 'FITTED ✓' : 'FIT ✓';
    };
    showTyre();
  }
  // the workshop lift: a pixel floor, two lift arms, the car top-down on it, scaled up on whole
  // pixels
  function drawLift(canvas, spr) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#23262e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#2b2f39';
    for (let x = 0; x < canvas.width; x += 24) ctx.fillRect(x, 0, 12,
      canvas.height);      // floor panels
    ctx.fillStyle = '#e8a13a';
    ctx.fillRect(0, canvas.height - 10, canvas.width,
      4);                                 // hazard stripe
    const scale = Math.max(1, Math.floor(Math.min((canvas.width - 60) / spr.c.width, (canvas.height
      - 40) / spr.c.height)));
    const drawW = spr.c.width * scale, drawH = spr.c.height * scale,
      x = Math.round((canvas.width - drawW) / 2), y = Math.round((canvas.height - drawH) / 2) - 4;
    ctx.fillStyle = '#5a5f6d';
    ctx.fillRect(x - 10, y + drawH * 0.2, drawW + 20, 6);
    ctx.fillRect(x - 10, y + drawH * 0.8 - 6, drawW + 20, 6);   // lift arms
    ctx.fillStyle = '#3a3e4a';
    ctx.fillRect(x - 16, y - 6, 8, drawH + 12);
    ctx.fillRect(x + drawW + 8, y - 6, 8, drawH + 12);           // posts
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(x + 4, y + 6, drawW,
      drawH);                                                  // shadow
    ctx.drawImage(spr.c, x, y, drawW, drawH);
  }

  // ---- IN-SESSION PAUSE (spec §4 step 3): the track and car stay loaded until you leave. Car swap
  // stays on the HUD chip.
  function pause(act) {
    root.className = '';
    const panel = pane(false);
    addEl(panel, 'h2', 'PAUSED');
    btn(panel, 'RESUME ▶', () => {
      hide();
    act.resume();
    }, 'go');
    // SOUND (user, 2026-10-07: "sound needs a volume control / mute button in pause menu too please
    // - kinda high priority"): a slider 0-100 % and MUTE; audio.js remembers both (localStorage
    // rac3r.vol / rac3r.mute)
    if (act.audio) {
      const audio = act.audio, row = addEl(panel, 'div', '', 'row');
      row.style.alignItems = 'center';
      const label = addEl(row, 'div', '');
      label.style.cssText = 'width:96px;font-size:12px';
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = 0;
      slider.max = 100;
      slider.step = 5;
      slider.value = Math.round(audio.volume * 100);
      slider.style.cssText = 'flex:1;min-height:34px;accent-color:#e8a13a';
      row.appendChild(slider);
      let muteBtn = null;
      const showSound = () => {
        label.textContent = 'SOUND ' + (audio.muted ? 'MUTED' : Math.round(audio.volume * 100)
          + '%');
      if (muteBtn) {
        muteBtn.textContent = audio.muted ? 'UNMUTE' : 'MUTE';
      muteBtn.classList.toggle('on', audio.muted);
      }
      };
      slider.addEventListener('input', () => {
        audio.setVolume(+slider.value / 100);
      if (audio.muted && +slider.value > 0) audio.toggleMute();
      showSound();
      });
      muteBtn = btn(row, 'MUTE', () => {
        audio.toggleMute();
      showSound();
      });
      showSound();
    }
    btn(panel, 'RESTART SESSION', () => {
      hide();
    act.restart();
    });
    btn(panel, 'HOW TO PLAY', () => {
      hide();
    act.guide();
    });
    if (act.tests && TEST_LIST.length) btn(panel, 'TESTING · ' + TEST_LIST.length,
      () => testing(act));   // the test queue (src/testlist.js)
    if (act.rules) btn(panel, 'EVENT RULES', () => {
      hide();
    act.rules();
    });   // the walkthrough for THIS event (guide.js RULES)
    btn(panel, 'TRACK SELECT', () => {
      act.exit();
    show();
    trackSelect();
    });
    btn(panel, 'MAIN MENU', () => {
      act.exit();
    show();
    });
  }
  // ---- TESTING (user, 2026-10-06: "a to test feature list somewhere in the pause menu ... updated
  // when we add new features and remove approved features"): src/testlist.js, newest first. Each
  // card: where, what to try, what counts as wrong. Test mode only.
  function testing(act) {
    const panel = pane(true);
    addEl(panel, 'h2', 'TESTING · ' + TEST_LIST.length + ' TO CHECK');
    addEl(panel, 'div', 'waiting for your verdict: tell Claude "ok" or what is wrong', 'sub');
    for (const test of [...TEST_LIST].reverse()) {
      const card = addEl(panel, 'div', '', 'test');
      addEl(card, 'div', test.name + ' <span>' + test.added + '</span>', 'nm');
      addEl(card, 'div', '<b>WHERE</b> ' + test.where, 'ln');
      addEl(card, 'div', '<b>TRY</b> ' + test.try, 'ln');
      addEl(card, 'div', '<b>WRONG IF</b> ' + test.wrong, 'ln bad');
    }
    const row = addEl(panel, 'div', '', 'row');
    btn(row, 'RESUME ▶', () => {
      hide();
    act.resume();
    }, 'go');
    btn(row, 'BACK', () => pause(act));
  }
  // ---- RESULTS (AI stage 4; user: "podium first, then the table"). flow = raceflow.js (results
  // sorted on time incl. penalties; est = still running when the race was cut short). act: { name,
  // restart, tracks, menu }.
  function results(flow, act) {
    root.className = '';
    const racers = flow.results, fmt = (time) => {
      const mins = Math.floor(time / 60), x = time - mins * 60;
    return mins + ':' + (x < 10 ? '0' : '') + x.toFixed(2);
    };
    const who = (racer) => (racer.player ? 'YOU' : '#' + racer.num);
    const buttons = (panel) => {
      btn(panel, 'RESTART ▶', () => {
        hide();
      act.restart();
      }, 'go');
      const row = addEl(panel, 'div', '', 'row');
      btn(row, 'TRACK SELECT', () => {
        act.tracks();
      show();
      trackSelect();
      });
      btn(row, 'MAIN MENU', () => {
        act.menu();
      show();
      });
    };
    // the HIGHWAY race (highwayrace.js): no laps or times — how far up the road each car got, and
    // the gap in metres to the leader
    const fmtKm = (metres) => (metres / 1000).toFixed(2) + ' KM';
    const hwTable = () => {
      const panel = pane(true);
      addEl(panel, 'h2', 'RESULTS');
      addEl(panel, 'div', act.name + ' · ROLLING START · ' + fmt(flow.endT || flow.t), 'sub');
      const grid = addEl(panel, 'div', '', 'res');
      grid.style.gridTemplateColumns = 'repeat(5, auto)';
      for (const head of ['POS', 'CAR', 'DISTANCE', 'GAP', 'REPAIR']) addEl(grid, 'div', head, 'h');
      for (const racer of racers) {
        const cls = racer.player ? 'me' : '';
        addEl(grid, 'div', 'P' + racer.pos, cls);
        const cell = addEl(grid, 'div', '', cls);
        const swatch = addEl(cell, 'span', '', 'sw');
        swatch.style.background = racer.paint || '#e8e8ee';
        cell.appendChild(document.createTextNode(who(racer)));
        addEl(grid, 'div', fmtKm(racer.dist), cls);
        addEl(grid, 'div', racer.pos === 1 ? '' : '-' + Math.round(racer.gapM) + ' m', cls);
        addEl(grid, 'div', racer.bill ? '£' + racer.bill.toLocaleString('en-GB') : '-', cls);
      }
      addEl(panel, 'div', (racers[0] && racers[0].player) ? 'YOU GOT AWAY' : 'THEY GOT AWAY',
        'sub');
      {
        const player = racers.find((racer) => racer.player);
      if (player) addEl(panel, 'div', 'YOUR REPAIRS £' + (player.bill || 0).toLocaleString('en-GB')
        + ' — TEST MODE: SHOWN, NOT CHARGED', 'sub');
      }
      buttons(panel);
    };
    const table = () => {
      if (flow.highway) return hwTable();
      const panel = pane(true);
      addEl(panel, 'h2', 'RESULTS');
      addEl(panel, 'div', act.name + ' · '
        + (flow.stage ? 'STAGE · STAGGERED STARTS' : flow.laps
        + (flow.laps === 1 ? ' LAP' : ' LAPS')), 'sub');
      const grid = addEl(panel, 'div', '', 'res');
      for (const head of ['POS', 'CAR', 'TIME', 'GAP', 'BEST', 'PEN', 'REPAIR']) addEl(grid, 'div',
        head, 'h');
      for (const racer of racers) {
        const cls = racer.player ? 'me' : '';
        addEl(grid, 'div', 'P' + racer.pos, cls);
        const cell = addEl(grid, 'div', '', cls);
        const swatch = addEl(cell, 'span', '', 'sw');
        swatch.style.background = racer.paint || '#e8e8ee';
        cell.appendChild(document.createTextNode(who(racer)));
        addEl(grid, 'div', racer.dnf ? 'DNF' : (racer.est ? '~' : '') + fmt(racer.total), cls);
        addEl(grid, 'div', racer.pos === 1 || racer.dnf ? '' : '+' + racer.gap.toFixed(2), cls);
        addEl(grid, 'div', racer.best != null ? fmt(racer.best) : '-', cls);
        addEl(grid, 'div', racer.penalty ? '+' + racer.penalty + ' s' : '', 'pen');
        addEl(grid, 'div', racer.bill ? '£' + racer.bill.toLocaleString('en-GB') : '-', cls);
      }
      if (racers.some((racer) => racer.est)) addEl(panel, 'div', flow.stage
        ? '~ estimated: still on the stage when you finished'
        : '~ estimated: still running when the top 3 were home', 'sub');
      if (racers.some((racer) => racer.penalty)) addEl(panel, 'div',
        'PEN = time penalties (joker rule, track cuts)', 'sub');
      // DAMAGE (user: "counted cost-wise against you at the end of a race in Story mode — shown in
      // Test but never charged")
      {
        const player = racers.find((racer) => racer.player);
      if (player) addEl(panel, 'div', 'YOUR REPAIRS £' + (player.bill || 0).toLocaleString('en-GB')
        + ' — TEST MODE: SHOWN, NOT CHARGED', 'sub');
      }
      buttons(panel);
    };
    // the PODIUM: 2nd, 1st, 3rd on steps, the car on top; tap or 2.5 s -> the table
    const panel = pane(false);
    addEl(panel, 'h2', 'RESULTS');
    addEl(panel, 'div', act.name, 'sub');
    const pod = addEl(panel, 'div', '', 'podium');
    for (const [i, hgt] of [[1, 46], [0, 62], [2, 34]]) {
      const racer = racers[i];
      const col = addEl(pod, 'div', '');
      if (!racer) continue;
      // the car as it is IN THE GAME: top-down, with its wheels, nose UP the step (user,
      // 2026-10-05: "podium looks broken, just use normal top down cars"). WAS: the body-only
      // sprite (drawn nose-RIGHT, no wheels) squeezed into a 40 x 64 portrait box -> squashed
      // sideways.
      const spr = api.carSprite(racer.car.spec, null, true),
        canvas = document.createElement('canvas');
      canvas.width = spr.c.height;
      canvas.height = spr.c.width;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(spr.c, -spr.c.width / 2, -spr.c.height / 2);
      canvas.style.width = Math.round(canvas.width * 2) + 'px';
      canvas.style.height = Math.round(canvas.height * 2) + 'px';
      col.appendChild(canvas);
      addEl(col, 'div', who(racer), racer.player ? '' : '');
      addEl(col, 'div', flow.highway ? fmtKm(racer.dist) : racer.dnf ? 'DNF'
        : (racer.est ? '~' : '') + fmt(racer.total));
      const stepEl = addEl(col, 'div', String(racer.pos), 'step');
      stepEl.style.height = hgt + 'px';
    }
    const you = racers.find((racer) => racer.player);
    if (you) addEl(panel, 'div', 'YOU: P' + you.pos + ' of ' + racers.length, 'sub');
    let gone = false;
    const next = () => {
      if (gone) return;
    gone = true;
    table();
    };
    btn(panel, 'RESULTS ▶', next, 'go');
    setTimeout(next, 2500);
  }
  function show() {
    root.className = '';
  main();
  }
  function hide() {
    root.className = 'gone';
  root.innerHTML = '';
  }
  return { show, hide, pause, results, profile, get open() {
    return root.className !== 'gone';
  } };
}
