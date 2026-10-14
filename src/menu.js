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

// GHOST-CLICK GUARD. MEASURED BUG (portrait, 2026-10-03): tapping the HUD pause chip opened the
// pause pane, and the SAME tap's follow-up click landed on RESUME, which sits right under the
// chip at 390 px — paused and resumed in one tap. Every new screen ignores clicks for GHOST_MS.
const GHOST_MS = 350;

// DIFFICULTY (PLAN.md §4; the centre of the field's spread — aidriver.js)
const DIFF = [['MOBILE', 'Mobile game'], ['GAME', 'Game'], ['REALISH', 'Realish'],
  ['RICH', "Real but you're rich"], ['REAL', 'Real']];

/**
 * Empties the menu root and adds a fresh pane (and stamps the ghost-click guard).
 * @param {object} menu the menu context
 * @param {boolean} wide true for the 720 px pane, false for the 320 px one
 * @returns {HTMLElement} the new pane element
 */
function addPane(menu, wide) {
  menu.openedAt = performance.now();
  menu.root.innerHTML = '';
  const panel = document.createElement('div');
  panel.className = 'pane';
  panel.style.width = wide ? 'min(720px, calc(100% - 24px))' : 'min(320px, calc(100% - 24px))';
  menu.root.appendChild(panel);
  return panel;
}

/**
 * Adds a menu button; its click is ignored while disabled or inside the ghost-click window.
 * @param {object} menu the menu context
 * @param {HTMLElement} parent element to append to
 * @param {string} label button HTML
 * @param {Function} onClick click handler
 * @param {string} [cls] class name
 * @param {boolean} [disabled] true to lock the button
 * @param {string} [tag] small red tag after the label
 * @returns {HTMLButtonElement} the button
 */
function addButton(menu, parent, label, onClick, cls = '', disabled = false, tag = '') {
  const button = document.createElement('button');
  button.innerHTML = label + (tag ? `<span class="tag">${tag}</span>` : '');
  if (cls) button.className = cls;
  button.disabled = disabled;
  button.addEventListener('click', (evt) => {
    evt.stopPropagation();
    if (!disabled && performance.now() - menu.openedAt > GHOST_MS) onClick();
  });
  parent.appendChild(button);
  return button;
}

/**
 * Creates an element with HTML content and an optional class, and appends it to parent.
 * @param {HTMLElement} parent element to append to
 * @param {string} tag tag name
 * @param {string} html inner HTML
 * @param {string} [cls] class name
 * @returns {HTMLElement} the new element
 */
function addElement(parent, tag, html, cls) {
  const elem = document.createElement(tag);
  elem.innerHTML = html;
  if (cls) elem.className = cls;
  parent.appendChild(elem);
  return elem;
}

/**
 * Finds the sample point of a generated stage's track nearest a distance along it.
 * @param {object} level a generated level (level.subtrack.pts)
 * @param {number} dist distance along the track
 * @returns {object} the nearest track point
 */
function findTrackPoint(level, dist) {
  const points = level.subtrack.pts;
  let best = points[0];
  for (const point of points) if (Math.abs(point.dist - dist)
    < Math.abs(best.dist - dist)) best = point;
  return best;
}

/**
 * Draws a generated stage's ROAD MAP: the theme's ground, the road (not the ghost return), START
 * green, FINISH chequered.
 * @param {HTMLCanvasElement} canvas canvas to draw into
 * @param {object} level the generated level
 */
function drawRoadMap(canvas, level) {
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
  const finish = findTrackPoint(level, level.stage.finish);
  ctx.fillStyle = '#4cc2a0';
  ctx.beginPath();
  ctx.arc(mapX(points[0].x), mapY(points[0].y), 5, 0, 7);
  ctx.fill();
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 ? '#111' : '#fff';
  ctx.fillRect(mapX(finish.x) - 5 + (i % 2) * 5, mapY(finish.y) - 5 + (i >> 1) * 5, 5, 5);
  }
}

/**
 * Closes the menu: hides the root and empties it.
 * @param {object} menu the menu context
 */
function hideMenu(menu) {
  menu.root.className = 'gone';
  menu.root.innerHTML = '';
}

/**
 * Opens the menu on the main screen.
 * @param {object} menu the menu context
 */
function showMenu(menu) {
  menu.root.className = '';
  showMainMenu(menu);
}

/**
 * MAIN MENU (spec §2): Story locked, Garage, Test Mode (primary).
 * @param {object} menu the menu context
 */
function showMainMenu(menu) {
  const panel = addPane(menu, false);
  addElement(panel, 'h1', 'RAC3R');
  addElement(panel, 'div', 'a driving sandbox', 'sub');   // the game's name (user, 2026-10-03)
  addButton(menu, panel, 'TEST MODE', () => showTrackSelect(menu), 'go');
  addButton(menu, panel, 'GARAGE', () => showGarage(menu));
  addButton(menu, panel, 'STORY', () => {}, '', true, 'LOCKED');
}

/**
 * Draws a level's painted thumbnail into a new canvas and returns it.
 * @param {object} thumb the cached thumbnail canvas
 * @returns {HTMLCanvasElement} a canvas holding a copy of the thumbnail
 */
function copyThumb(thumb) {
  const canvas = document.createElement('canvas');
  canvas.width = thumb.width;
  canvas.height = thumb.height;
  canvas.getContext('2d').drawImage(thumb, 0, 0);
  return canvas;
}

/**
 * TEST MODE step 1: CATEGORY LIST (user, 2026-10-05: "a menu layer for circuit type, stick
 * appropriate tracks in the correct category" — "a BIG LIST", Grass Track in OVALS), then step 1b:
 * that category's track cards (overhead thumbnails).
 * @param {object} menu the menu context
 */
function showTrackSelect(menu) {
  const profile = menu.profile;
  const panel = addPane(menu, true);
  addElement(panel, 'h2', 'TEST MODE · CHOOSE A TYPE');
  if (!menu.thumbs) menu.thumbs = menu.api.thumbs();
  const list = addElement(panel, 'div', '', 'cats');
  for (const category of CATS) {
    const lvs = LEVELS.filter((entry) => category.id === 'all' || catOf(entry) === category.id);
    if (!lvs.length) continue;
    const button = addButton(menu, list, '', () => {
      profile.lastCat = category.id;
      saveProfile(profile);
      showTrackList(menu, category.id);
    }, 'cat' + (category.id === profile.lastCat ? ' on' : ''));
    const strip = addElement(button, 'div', '', 'strip');
    for (const level of lvs.slice(0, 3)) {
      const thumb = menu.thumbs[level.id];
      if (!thumb) continue;
      strip.appendChild(copyThumb(thumb));
    }
    const text = addElement(button, 'div', '', 'tx');
    addElement(text, 'span', category.name, 'nm');
    addElement(text, 'span', category.sub, 'k');
    addElement(button, 'span', String(lvs.length), 'n');
  }
  const row = addElement(panel, 'div', '', 'row');
  addButton(menu, row, '◀ BACK', () => showMainMenu(menu));
}

/**
 * Adds one level's card to the track grid.
 * @param {object} menu the menu context
 * @param {HTMLElement} grid the card grid
 * @param {object} level the level the card stands for
 */
function addTrackCard(menu, grid, level) {
  const profile = menu.profile;
  const button = addButton(menu, grid, '', () => {
    profile.lastLevel = level.id;
    saveProfile(profile);
    showSetup(menu, level);
  }, 'card' + (level.id === profile.lastLevel ? ' on' : ''));
  if (level.gen && !level.fixed) {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 200;
    drawRoadMap(canvas, level);
    button.appendChild(canvas);
    addElement(button, 'span', 'STAGE GENERATOR', 'nm');
    addElement(button, 'span', 'RALLY STAGE · NEW EVERY TIME', 'k');
    return;
  }
  const thumb = menu.thumbs[level.id];
  if (thumb) button.appendChild(copyThumb(thumb));
  addElement(button, 'span', level.name, 'nm');
  addElement(button, 'span', level.endless ? 'ENDLESS MOTORWAY' : level.fixed ? 'RALLY STAGE · '
    + THEMES[level.gen.theme].name.split(' ')[0] : KIND[level.id] || 'TRACK', 'k');
}

/**
 * TEST MODE step 1b: the track cards of one category.
 * @param {object} menu the menu context
 * @param {string} cat the category id (CATS)
 */
function showTrackList(menu, cat) {
  const panel = addPane(menu, true), catEntry = CATS.find((entry) => entry.id === cat)
    || CATS[CATS.length - 1];
  addElement(panel, 'h2', 'TEST MODE · ' + catEntry.name);
  if (!menu.thumbs) menu.thumbs = menu.api.thumbs();
  {
    const cur = LEVELS.find((entry) => entry.gen && !entry.fixed), savedGen = menu.profile.gen;
    if (cur && savedGen && ['seed', 'theme', 'len', 'style'].some((key) => savedGen[key]
      !== cur.gen[key])) menu.api.genStage(savedGen);
  }
  const grid = addElement(panel, 'div', '', 'grid');
  for (const level of LEVELS.filter((entry) => cat === 'all' || catOf(entry) === cat)) {
    addTrackCard(menu, grid, level);
  }
  const row = addElement(panel, 'div', '', 'row');
  addButton(menu, row, '◀ TYPES', () => showTrackSelect(menu));
}

/**
 * GENERATOR SETUP (user, 2026-10-04: procedural point-to-point stages): THEME, LENGTH, CORNERS,
 * SEED (◀ ▶ / NEW STAGE), the road map; every change regenerates (≤ ~0.5 s) and the setup
 * reopens on the new stage. Remembered in profile.gen.
 * @param {object} menu the menu context
 * @param {HTMLElement} panel the setup pane
 * @param {object} level the generated level
 */
function addGenRows(menu, panel, level) {
  const gen = { ...level.gen };
  const map = document.createElement('canvas');
  map.width = 320;
  map.height = 200;
  map.style.cssText = 'width:100%;border:2px solid #000;image-rendering:pixelated;margin:4px 0';
  panel.appendChild(map);
  drawRoadMap(map, level);
  addElement(panel, 'div',
    `${THEMES[gen.theme].name} · ${level.gen.km.toFixed(2)} KM · SEED ${gen.seed}`, 'sub');
  const regen = (changes) => {
    Object.assign(gen, changes);
  menu.profile.gen = { theme: gen.theme, len: gen.len, style: gen.style, seed: gen.seed };
  saveProfile(menu.profile);
  const newLevel = menu.api.genStage(gen);
  menu.profile.lastLevel = newLevel.id;
  saveProfile(menu.profile);
  showSetup(menu, newLevel);
  };
  const row = (opts, cur, key) => {
    const rowEl = addElement(panel, 'div', '', 'row');
  for (const [value, label] of opts) addButton(menu, rowEl, label, () => regen({ [key]: value }),
      value === cur ? 'on' : '');
  };
  row(Object.entries(THEMES).map(([key, theme]) => [key, theme.name.split(' ')[0]]), gen.theme,
    'theme');
  row(Object.keys(LENGTHS).map((key) => [key, key.toUpperCase()]), gen.len, 'len');
  row([['flowing', 'FLOWING'], ['mixed', 'MIXED'], ['tight', 'TIGHT']], gen.style, 'style');
  const seedRow = addElement(panel, 'div', '', 'row');
  addButton(menu, seedRow, '◀', () => regen({ seed: Math.max(1, gen.seed - 1) }));
  addButton(menu, seedRow, '▶', () => regen({ seed: gen.seed + 1 }));
  addButton(menu, seedRow, 'NEW STAGE 🎲', () => regen({
    seed: 1 + Math.floor(Math.random() * 99999) }), 'go');
}

/**
 * Adds one labelled range slider row to the setup panel.
 * @param {object} menu the menu context
 * @param {HTMLElement} panel the setup pane
 * @param {string} label slider name
 * @param {number} min lowest value
 * @param {number} max highest value
 * @param {number} stepV step
 * @param {number} val start value
 * @param {Function} fmt value -> label text
 * @param {Function} set called with the new value on every input
 */
function addSetupSlider(menu, panel, label, min, max, stepV, val, fmt, set) {
  const row = addElement(panel, 'div', '', 'row');
  row.style.alignItems = 'center';
  const labelEl = addElement(row, 'div', '');
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
    saveProfile(menu.profile);
  });
  row.appendChild(input);
  showLabel();
}

/**
 * Adds the setup title, the track description line and (generated stages) the generator rows.
 * @param {object} menu the menu context
 * @param {HTMLElement} panel the setup pane
 * @param {object} level the chosen level
 */
function addSetupHeader(menu, panel, level) {
  addElement(panel, 'h2', level.name);
  addElement(panel, 'div', level.endless ? 'ENDLESS MOTORWAY · HOW FAR CAN YOU GET?' : level.fixed
    ? `RALLY STAGE · ${THEMES[level.gen.theme].name} · ${level.gen.km.toFixed(2)} KM · POINT TO \
POINT`
    : level.gen ? 'GENERATED RALLY STAGE · POINT TO POINT' : KIND[level.id] || 'TRACK', 'sub');
  if (level.gen && !level.fixed) addGenRows(menu, panel, level);
}

/**
 * Adds the ROAD TYPE buttons (endless highway, user 2026-10-05: "how do I test the lane presets —
 * I don't see any buttons"): lanes / width / walls.
 * @param {object} menu the menu context
 * @param {HTMLElement} panel the setup pane
 * @param {object} level the chosen level
 * @param {object} state the setup state (reads / writes road)
 */
function addRoadTypeRow(menu, panel, level, state) {
  if (level.roadTypes) {
    const roadRow = addElement(panel, 'div', '', 'row');
    const roadBtns = Object.entries(level.roadTypes).map(([roadKey, name]) => addButton(menu,
      roadRow, name, () => {
        state.road = roadKey;
        roadBtns.forEach((button, i) => button.classList.toggle('on',
          Object.keys(level.roadTypes)[i] === state.road));
      }, roadKey === state.road ? 'on' : ''));
  }
}

/**
 * Adds the TRAFFIC + LITTER sliders of an endless level (user, 2026-10-05: "a slider in test mode
 * for density" / "a slider for frequency / density" of the roadside objects); remembered. TRAFFIC
 * 0-150 % (100 % = 6 cars a lane), LITTER 0-3 x.
 * @param {object} menu the menu context
 * @param {HTMLElement} panel the setup pane
 * @param {object} level the chosen level
 * @param {object} state the setup state (reads / writes traffic, litter)
 */
function addTrafficSliders(menu, panel, level, state) {
  if (level.endless) {
    addSetupSlider(menu, panel, 'TRAFFIC', 0, 1.5, 0.05, state.traffic, (value) => value
      ? Math.round(value * 100) + '%' : 'OFF', (value) => {
      state.traffic = menu.profile.traffic = value;
    });
    addSetupSlider(menu, panel, 'LITTER', 0, 3, 0.1, state.litter, (value) => value
      ? value.toFixed(1) + 'x' : 'OFF', (value) => {
      state.litter = menu.profile.litter = value;
    });
  }
}

/**
 * Adds the SOLO / VS AI buttons and the opponent-count row. VS AI (2026-10-04, AI stage 1
 * preview): 1-5 opponents in the same car, different colours.
 * @param {object} menu the menu context
 * @param {HTMLElement} panel the setup pane
 * @param {object} state the setup state (reads / writes opponents, aiN; fills ui)
 */
function addOpponentCountRows(menu, panel, state) {
  const modeRow = addElement(panel, 'div', '', 'row');
  state.ui.bSolo = addButton(menu, modeRow, 'SOLO', () => {
    state.opponents = 0;
    state.paint();
  }, 'on');
  state.ui.bAI = addButton(menu, modeRow, 'VS AI', () => {
    state.opponents = state.aiN;
    state.paint();
  });
  state.ui.nRow = addElement(panel, 'div', '', 'row');
  state.ui.nBtns = [1, 2, 3, 4, 5].map((count) => addButton(menu, state.ui.nRow, String(count),
    () => {
      state.aiN = count;
      state.opponents = count;
      state.paint();
    }));
}

/**
 * Adds the DIFFICULTY row and its name line, and the AI CARS row: CLASS (each AI a car of your
 * class) or YOUR CAR (all the same as you); remembered.
 * @param {object} menu the menu context
 * @param {HTMLElement} panel the setup pane
 * @param {object} state the setup state (reads / writes diff, aiCars; fills ui)
 */
function addDifficultyRows(menu, panel, state) {
  try {
    const stored = localStorage.getItem('carsim.aidiff');
    if (stored != null) state.diff = Math.max(0, Math.min(4, +stored));
  } catch { /* default */ }
  state.ui.dRow = addElement(panel, 'div', '', 'row');
  state.ui.dBtns = DIFF.map(([name], i) => addButton(menu, state.ui.dRow, name, () => {
    state.diff = i;
    try {
      localStorage.setItem('carsim.aidiff', String(i));
    } catch { /* fine */ }
    state.paint();
  }));
  state.ui.dName = addElement(panel, 'div', '', 'sub');
  state.aiCars = menu.profile.aiCars === 'same' ? 'same' : 'class';
  state.ui.aRow = addElement(panel, 'div', '', 'row');
  state.ui.bCls = addButton(menu, state.ui.aRow, 'AI: CLASS CARS', () => {
    state.aiCars = 'class';
    menu.profile.aiCars = state.aiCars;
    saveProfile(menu.profile);
    state.paint();
  });
  state.ui.bSame = addButton(menu, state.ui.aRow, 'AI: YOUR CAR', () => {
    state.aiCars = 'same';
    menu.profile.aiCars = state.aiCars;
    saveProfile(menu.profile);
    state.paint();
  });
}

/**
 * Shows / hides and highlights the opponent, difficulty and AI-car rows from the setup state.
 * @param {object} state the setup state
 */
function paintSetupOpponents(state) {
  const wid = state.ui;
  wid.bSolo.classList.toggle('on', state.opponents === 0);
  wid.bAI.classList.toggle('on', state.opponents > 0);
  wid.nRow.style.display = state.opponents ? '' : 'none';
  wid.nBtns.forEach((button, i) => button.classList.toggle('on', i + 1 === state.aiN));
  wid.dRow.style.display = state.opponents ? '' : 'none';
  wid.dName.style.display = state.opponents ? '' : 'none';
  wid.dBtns.forEach((button, i) => button.classList.toggle('on', i === state.diff));
  wid.dName.textContent = 'AI: ' + DIFF[state.diff][1];
  wid.aRow.style.display = state.opponents ? '' : 'none';
  wid.bCls.classList.toggle('on', state.aiCars === 'class');
  wid.bSame.classList.toggle('on', state.aiCars === 'same');
}

/**
 * Adds the PRACTICE / RX RACE choice of a JOKER level: the RX race (5 laps from the grid, joker
 * once, missed = +5 s) next to free practice.
 * @param {object} menu the menu context
 * @param {HTMLElement} panel the setup pane
 * @param {object} level the chosen level
 * @param {object} state the setup state (writes rxRace)
 */
function addRxRaceRow(menu, panel, level, state) {
  if (level.joker) {
    const rxRow = addElement(panel, 'div', '', 'row');
    const practiceBtn = addButton(menu, rxRow, 'PRACTICE', () => {
      state.rxRace = false;
      practiceBtn.classList.add('on');
      rxBtn.classList.remove('on');
    }, 'on');
    const rxBtn = addButton(menu, rxRow, `RX RACE · ${level.joker.laps} LAPS`, () => {
      state.rxRace = true;
      rxBtn.classList.add('on');
      practiceBtn.classList.remove('on');
    });
  }
}

/**
 * Adds the LAPS row (user, 2026-10-04: "choose in setup"): a race (VS AI or the RX race) is this
 * many laps; default 3, the RX race its joker laps. Wraps state.paint so the row follows the mode.
 * @param {object} menu the menu context
 * @param {HTMLElement} panel the setup pane
 * @param {object} level the chosen level
 * @param {object} state the setup state (reads / writes laps, paint)
 */
function addLapsRow(menu, panel, level, state) {
  const lRow = addElement(panel, 'div', '', 'row'), lLbl = addElement(lRow, 'div', '');
  lLbl.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;\
font-size:14px';
  // (the highway has no laps: a ROLLING START, and it ends when someone gets away off screen — a
  // line says so instead)
  const lPaint = () => {
    lLbl.textContent = state.laps + (state.laps === 1 ? ' LAP' : ' LAPS');
    lRow.style.display = (state.opponents || state.rxRace) && !level.endless ? '' : 'none';
    if (hwNote) hwNote.style.display = state.opponents ? '' : 'none';
  };
  const hwNote = level.endless ? addElement(panel, 'div',
    'ROLLING START · GET AWAY: LOSE THEM OFF THE BOTTOM OF THE SCREEN TO WIN · LET ONE GET AWAY \
OFF THE TOP AND IT IS OVER', 'sub') : null;
  addButton(menu, lRow, '−', () => {
    state.laps = Math.max(1, state.laps - 1);
    lPaint();
  });
  lRow.appendChild(lLbl);
  addButton(menu, lRow, '+', () => {
    state.laps = Math.min(10, state.laps + 1);
    lPaint();
  });
  const paint0 = state.paint;
  state.paint = () => {
    paint0();
    lPaint();
  };
  if (level.joker) for (const button of panel.querySelectorAll('button'))
    if (/PRACTICE|RX RACE/.test(button.textContent))
      button.addEventListener('click', () => lPaint());
}

/**
 * Adds the LAUNCH button (starts the session with the chosen options) and BACK.
 * @param {object} menu the menu context
 * @param {HTMLElement} panel the setup pane
 * @param {object} level the chosen level
 * @param {object} state the setup state
 */
function addLaunchButtons(menu, panel, level, state) {
  const profile = menu.profile;
  addButton(menu, panel, 'LAUNCH ▶', () => {
    hideMenu(menu);
    menu.api.launch(level.id, profile.active,
      { rx: state.rxRace, ai: state.opponents, diff: state.diff, road: state.road,
        aiCars: state.aiCars,
        ...(level.endless ? { traffic: state.traffic, litter: state.litter } : {}),
        laps: state.opponents || state.rxRace ? state.laps : 0,
        livery: (profile.livery || {})[profile.active],
        tyre: (profile.tyres || {})[profile.active] });
  }, 'go');
  addButton(menu, panel, '◀ BACK', () => showTrackList(menu, profile.lastCat || catOf(level)));
}

/**
 * TEST MODE step 2 (spec §4): the match setup of a level - solo or VS AI, laps, difficulty, the
 * car picker and LAUNCH.
 * @param {object} menu the menu context
 * @param {object} level the chosen level
 */
function showSetup(menu, level) {
  const panel = addPane(menu, false);
  addSetupHeader(menu, panel, level);
  const state = {
    road: level.roadType || null,   // endless highway road type
    traffic: menu.profile.traffic ?? 0.6,   // endless: traffic density
    litter: menu.profile.litter ?? 1,   // endless: roadside litter density
    opponents: 0,   // VS AI opponents (0 = solo)
    aiN: 5,   // how many opponents VS AI picks
    diff: 2,   // AI difficulty index into DIFF
    aiCars: 'class',   // AI cars: class or same
    rxRace: false,   // the RX race (joker level) rather than practice
    laps: level.joker ? level.joker.laps || 5 : 3,   // laps of a race
    ui: {},   // the opponent / difficulty widgets paintSetupOpponents updates
    paint: () => {},   // repaints the setup rows (wrapped by the laps row)
  };
  addRoadTypeRow(menu, panel, level, state);
  addTrafficSliders(menu, panel, level, state);
  addOpponentCountRows(menu, panel, state);
  addDifficultyRows(menu, panel, state);
  state.paint = () => paintSetupOpponents(state);
  state.paint();
  addRxRaceRow(menu, panel, level, state);
  addLapsRow(menu, panel, level, state);
  state.paint();
  showCarPicker(menu, panel);
  addLaunchButtons(menu, panel, level, state);
}

/**
 * CAR PICKER filtered CLASS -> SUBCLASS -> car (user, 2026-10-04). Only classes / subclasses you
 * own a car in are offered ('ALL' first); the filter starts on the active car's class.
 * onPick(row) after every change. Used by race setup and the garage.
 * @param {object} menu the menu context
 * @param {HTMLElement} panel the pane to add the picker to
 * @param {Function} [onPick] called with the car after every change
 */
function showCarPicker(menu, panel, onPick = () => {}) {
  const owned = () => ROSTER.filter((car) => menu.profile.unlocked.includes(car.id));
  const cur = () => ROSTER.find((car) => car.id === menu.profile.active);
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
  if (!list.some((car) => car.id === menu.profile.active)) menu.profile.active = list[0].id;
  saveProfile(menu.profile);
  };
  // one boxed group; each row: TAG (coloured) ◀ value ▶ — the value takes the tag's colour so the
  // three read as a set
  const box = addElement(panel, 'div', '', 'picker');
  const row = (tag, col, prev, next) => {
    const rowEl = addElement(box, 'div', '', 'prow');
    const tagEl = addElement(rowEl, 'div', tag, 'cap');
    tagEl.style.background = col;
    addButton(menu, rowEl, '◀', prev);
    const valEl = addElement(rowEl, 'div', '', 'val');
    valEl.style.color = col;
    addButton(menu, rowEl, '▶', next);
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
    menu.profile.active = step(cars().map((car) => car.id), menu.profile.active, -1);
  saveProfile(menu.profile);
  paint();
  },
    () => {
      menu.profile.active = step(cars().map((car) => car.id), menu.profile.active, 1);
    saveProfile(menu.profile);
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

/**
 * GARAGE (spec §3; user chose: the TOP-DOWN car on a workshop LIFT). Browse owned cars, measured
 * stats.
 * @param {object} menu the menu context
 */
function showGarage(menu) {
  const panel = addPane(menu, true);
  addElement(panel, 'h2', 'GARAGE');
  const box = addElement(panel, 'div', '', 'garage');
  const left = addElement(box, 'div', ''), right = addElement(box, 'div', '');
  const lift = document.createElement('canvas');
  lift.className = 'lift';
  lift.width = 360;
  lift.height = 150;
  left.appendChild(lift);
  const pick = addElement(left, 'div', '');
  pick.style.marginTop = '8px';
  const stats = addElement(right, 'div', '', 'stats');
  const showStats = () => {
    const car = ROSTER.find((x) => x.id === menu.profile.active), spec = CAR_STATS[car.id] || {};
    drawLift(lift, menu.api.carSprite(car.id, (menu.profile.livery || {})[car.id]));
    const aids = spec.aids ? [spec.aids.abs && 'ABS', spec.aids.tcs
      && 'TCS'].filter(Boolean).join(' + ') || 'NONE' : 'NONE';
    stats.innerHTML = `<span>TOP SPEED</span><b>${spec.topKph ?? '—'} KM/H</b><span>0-100 \
KM/H</span><b>${spec.zeroTo100 != null ? spec.zeroTo100 + ' S' : '—'}</b>`
      + `<span>100-0 BRAKING</span><b>${spec.brake100 ?? '—'} M</b><span>GRIP</span><b>${(() => {
        const tarmacGrip = tyreOf((menu.profile.tyres || {})[car.id]).grip.tarmac;
        return spec.gripG == null ? '—' : tarmacGrip === 1 ? spec.gripG + ' G'
          : (spec.gripG * tarmacGrip).toFixed(2) + ' G <span style="color:#9aa0aa;\
font-size:10px">STOCK ' + spec.gripG + '</span>';
      })()}</b>`
      + `<span>WEIGHT</span><b>${spec.massKg} KG</b><span>DRIVE</span><b>${spec.drive}</b><span>\
AIDS</span><b>${aids}</b>`
      + `<span>CLASS</span><b>${classOf(car.cls).name} · ${car.sub.toUpperCase()}</b>`
      + (() => {
        const tyre = tyreOf((menu.profile.tyres || {})[car.id]),
          brand = TYRE_BRANDS.find((x) => x.id === tyre.brand);
        return `<span>TYRES</span><b style="color:${brand.col}">${brand.name} \
· ${tyre.name.toUpperCase()}</b>`;
      })();
  };
  const buttonRow = addElement(panel, 'div', '', 'row');
  addButton(menu, buttonRow, 'PAINT', () => showPaintShop(menu));
  addButton(menu, buttonRow, 'TYRES', () => showTyreShop(menu));
  addButton(menu, buttonRow, 'BUY CARS', () => {}, '', true, 'SOON');
  addButton(menu, buttonRow, 'UPGRADES', () => {}, '', true, 'SOON');
  addButton(menu, panel, '◀ BACK', () => showMainMenu(menu));
  showCarPicker(menu, pick, showStats);
}

/**
 * PAINT SHOP (user, 2026-10-04: "palette + number + preview"): BODY and TRIM from the 16-colour
 * PALETTE, a NUMBER 1-99 (or none), the car previewed on the lift as you go; APPLY saves it to
 * the profile, BACK drops the changes, STOCK puts the car's own colours back.
 * @param {object} menu the menu context
 */
function showPaintShop(menu) {
  const panel = addPane(menu, true), carId = menu.profile.active,
    car = ROSTER.find((x) => x.id === carId);
  const cur = { paint: car.paint, trim: car.trim, num: 0,
    ...((menu.profile.livery || {})[carId] || {}) };
  addElement(panel, 'h2', 'PAINT · ' + car.name);
  const box = addElement(panel, 'div', '', 'garage'), left = addElement(box, 'div', ''),
    right = addElement(box, 'div', '');
  const lift = document.createElement('canvas');
  lift.className = 'lift';
  lift.width = 360;
  lift.height = 150;
  left.appendChild(lift);
  const showLivery = () => {
    drawLift(lift, menu.api.carSprite(carId, cur));
  numL.textContent = cur.num ? '#' + cur.num : 'NO NUMBER';
    for (const [field, list] of [['paint', bodyB],
      ['trim', trimB]]) for (const button of list) button.style.outline = button.dataset.c
      === cur[field] ? '3px solid #e8a13a' : 'none';
  };
  const swatches = (label, field) => {
    addElement(right, 'div', label, 'sub');
    const grid = addElement(right, 'div', '');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(8,1fr);gap:4px;\
margin-bottom:8px';
    return PALETTE.map((colour) => {
      const swatch = addButton(menu, grid, '', () => {
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
  const numRow = addElement(left, 'div', '', 'row');
  numRow.style.marginTop = '8px';
  addButton(menu, numRow, '−10', () => {
    cur.num = Math.max(0, cur.num - 10);
  showLivery();
  });
  addButton(menu, numRow, '−', () => {
    cur.num = Math.max(0, cur.num - 1);
  showLivery();
  });
  const numL = addElement(numRow, 'div', '');
  numL.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;\
font-size:15px';
  addButton(menu, numRow, '+', () => {
    cur.num = Math.min(99, cur.num + 1);
  showLivery();
  });
  addButton(menu, numRow, '+10', () => {
    cur.num = Math.min(99, cur.num + 10);
  showLivery();
  });
  const buttonRow = addElement(panel, 'div', '', 'row');
  addButton(menu, buttonRow, 'STOCK', () => {
    Object.assign(cur, { paint: car.paint, trim: car.trim, num: 0 });
  showLivery();
  });
  addButton(menu, buttonRow, 'APPLY ✓', () => {
    menu.profile.livery = menu.profile.livery || {};
  menu.profile.livery[carId] = { ...cur };
  saveProfile(menu.profile);
  showGarage(menu);
  }, 'go');
  addButton(menu, panel, '◀ BACK', () => showGarage(menu));
  showLivery();
}

/**
 * TYRES (user, 2026-10-04: 4 brands / 15 types, fit by class, prices shown, the effect shown
 * with the stats). FIT saves it to profile.tyres[id].
 * @param {object} menu the menu context
 */
function showTyreShop(menu) {
  const panel = addPane(menu, true), carId = menu.profile.active,
    car = ROSTER.find((x) => x.id === carId),
    spec = CAR_STATS[carId] || {};
  let sel = tyreOf((menu.profile.tyres || {})[carId]).id;
  addElement(panel, 'h2', 'TYRES · ' + car.name);
  const box = addElement(panel, 'div', '', 'garage'), left = addElement(box, 'div', ''),
    right = addElement(box, 'div', '');
  const btns = {};
  for (const brand of TYRE_BRANDS) {
    const head = addElement(left, 'div', brand.name + ' <span style="color:#9aa0aa;font-size:10px">'
      + brand.blurb + '</span>');
    head.style.cssText = 'margin:6px 0 4px;font-size:12px;color:' + brand.col;
    const group = addElement(left, 'div', '');
    group.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px';
    for (const tyre of TYRES.filter((x) => x.brand === brand.id)) {
      const fits = tyre.fits.includes(car.cls);
      const tyreBtn = addButton(menu, group, tyre.name, () => {
        sel = tyre.id;
      showTyre();
      }, '', !fits, fits ? '' : 'NO FIT');
      tyreBtn.style.cssText = 'min-height:32px;padding:4px 9px;font-size:11px;border-left:5px \
solid ' + brand.col;
      btns[tyre.id] = tyreBtn;
    }
  }
  const info = addElement(right, 'div', '');
  const fitR = addElement(panel, 'div', '', 'row');
  const fitB = addButton(menu, fitR, 'FIT ✓', () => {
    menu.profile.tyres = menu.profile.tyres || {};
  menu.profile.tyres[carId] = sel;
  saveProfile(menu.profile);
  showGarage(menu);
  }, 'go');
  addButton(menu, panel, '◀ BACK', () => showGarage(menu));
  const showTyre = () => {
    const tyre = tyreOf(sel), brand = TYRE_BRANDS.find((x) => x.id === tyre.brand),
      cur = tyreOf((menu.profile.tyres || {})[carId]).id === tyre.id;
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

/**
 * Draws the workshop lift: a pixel floor, two lift arms, the car top-down on it, scaled up on
 * whole pixels.
 * @param {HTMLCanvasElement} canvas canvas to draw into
 * @param {object} spr the car sprite ({ c: canvas })
 */
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

/**
 * IN-SESSION PAUSE (spec §4 step 3): the track and car stay loaded until you leave. Car swap
 * stays on the HUD chip.
 * @param {object} menu the menu context
 * @param {object} act the session actions (resume, restart, guide, exit ...)
 */
function showPause(menu, act) {
  menu.root.className = '';
  const panel = addPane(menu, false);
  addElement(panel, 'h2', 'PAUSED');
  addButton(menu, panel, 'RESUME ▶', () => {
    hideMenu(menu);
  act.resume();
  }, 'go');
  // SOUND (user, 2026-10-07: "sound needs a volume control / mute button in pause menu too please
  // - kinda high priority"): a slider 0-100 % and MUTE; audio.js remembers both (localStorage
  // rac3r.vol / rac3r.mute)
  if (act.audio) {
    const audio = act.audio, row = addElement(panel, 'div', '', 'row');
    row.style.alignItems = 'center';
    const label = addElement(row, 'div', '');
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
    muteBtn = addButton(menu, row, 'MUTE', () => {
      audio.toggleMute();
    showSound();
    });
    showSound();
  }
  addButton(menu, panel, 'RESTART SESSION', () => {
    hideMenu(menu);
  act.restart();
  });
  addButton(menu, panel, 'HOW TO PLAY', () => {
    hideMenu(menu);
  act.guide();
  });
  if (act.tests && TEST_LIST.length) addButton(menu, panel, 'TESTING · ' + TEST_LIST.length,
    () => showTesting(menu, act));   // the test queue (src/testlist.js)
  if (act.rules) addButton(menu, panel, 'EVENT RULES', () => {
    hideMenu(menu);
  act.rules();
  });   // the walkthrough for THIS event (guide.js RULES)
  addButton(menu, panel, 'TRACK SELECT', () => {
    act.exit();
  showMenu(menu);
  showTrackSelect(menu);
  });
  addButton(menu, panel, 'MAIN MENU', () => {
    act.exit();
  showMenu(menu);
  });
}

/**
 * TESTING (user, 2026-10-06): the to-test feature list from src/testlist.js, newest first. Test
 * mode only.
 * @param {object} menu the menu context
 * @param {object} act the session actions
 */
function showTesting(menu, act) {
  const panel = addPane(menu, true);
  addElement(panel, 'h2', 'TESTING · ' + TEST_LIST.length + ' TO CHECK');
  addElement(panel, 'div', 'waiting for your verdict: tell Claude "ok" or what is wrong', 'sub');
  for (const test of [...TEST_LIST].reverse()) {
    const card = addElement(panel, 'div', '', 'test');
    addElement(card, 'div', test.name + ' <span>' + test.added + '</span>', 'nm');
    addElement(card, 'div', '<b>WHERE</b> ' + test.where, 'ln');
    addElement(card, 'div', '<b>TRY</b> ' + test.try, 'ln');
    addElement(card, 'div', '<b>WRONG IF</b> ' + test.wrong, 'ln bad');
  }
  const row = addElement(panel, 'div', '', 'row');
  addButton(menu, row, 'RESUME ▶', () => {
    hideMenu(menu);
  act.resume();
  }, 'go');
  addButton(menu, row, 'BACK', () => showPause(menu, act));
}

/**
 * Formats a race time as m:ss.ss.
 * @param {number} time seconds
 * @returns {string} the formatted time
 */
function formatRaceTime(time) {
  const mins = Math.floor(time / 60), x = time - mins * 60;
  return mins + ':' + (x < 10 ? '0' : '') + x.toFixed(2);
}

/**
 * The results label of a racer.
 * @param {object} racer a flow result row
 * @returns {string} YOU or #number
 */
function nameRacer(racer) {
  return racer.player ? 'YOU' : '#' + racer.num;
}

/**
 * The HIGHWAY race distance (highwayrace.js): how far up the road a car got.
 * @param {number} metres distance in metres
 * @returns {string} the distance in km
 */
function formatKm(metres) {
  return (metres / 1000).toFixed(2) + ' KM';
}

/**
 * Adds the RESTART / TRACK SELECT / MAIN MENU buttons under a results table.
 * @param {object} menu the menu context
 * @param {HTMLElement} panel the results pane
 * @param {object} act the results actions ({ restart, tracks, menu })
 */
function addResultsButtons(menu, panel, act) {
  addButton(menu, panel, 'RESTART ▶', () => {
    hideMenu(menu);
    act.restart();
  }, 'go');
  const row = addElement(panel, 'div', '', 'row');
  addButton(menu, row, 'TRACK SELECT', () => {
    act.tracks();
    showMenu(menu);
    showTrackSelect(menu);
  });
  addButton(menu, row, 'MAIN MENU', () => {
    act.menu();
    showMenu(menu);
  });
}

/**
 * Adds the player's repair bill line (shown in Test but never charged) when there is a player.
 * @param {HTMLElement} panel the results pane
 * @param {object[]} racers the flow results
 */
function addRepairsLine(panel, racers) {
  const player = racers.find((racer) => racer.player);
  if (player) addElement(panel, 'div', 'YOUR REPAIRS £'
    + (player.bill || 0).toLocaleString('en-GB') + ' — TEST MODE: SHOWN, NOT CHARGED', 'sub');
}

/**
 * Adds a racer's POS and CAR cells (colour swatch + name) to a results grid.
 * @param {HTMLElement} grid the results grid
 * @param {object} racer a flow result row
 * @param {string} cls the row class
 */
function addRacerCells(grid, racer, cls) {
  addElement(grid, 'div', 'P' + racer.pos, cls);
  const cell = addElement(grid, 'div', '', cls);
  const swatch = addElement(cell, 'span', '', 'sw');
  swatch.style.background = racer.paint || '#e8e8ee';
  cell.appendChild(document.createTextNode(nameRacer(racer)));
}

/**
 * The HIGHWAY race results table (highwayrace.js): no laps or times — how far up the road each
 * car got, and the gap in metres to the leader.
 * @param {object} menu the menu context
 * @param {object} flow the race flow (raceflow.js)
 * @param {object} act the results actions
 */
function showHighwayTable(menu, flow, act) {
  const racers = flow.results;
  const panel = addPane(menu, true);
  addElement(panel, 'h2', 'RESULTS');
  addElement(panel, 'div', act.name + ' · ROLLING START · ' + formatRaceTime(flow.endT || flow.t),
    'sub');
  const grid = addElement(panel, 'div', '', 'res');
  grid.style.gridTemplateColumns = 'repeat(5, auto)';
  for (const head of ['POS', 'CAR', 'DISTANCE', 'GAP', 'REPAIR']) addElement(grid, 'div', head,
    'h');
  for (const racer of racers) {
    const cls = racer.player ? 'me' : '';
    addRacerCells(grid, racer, cls);
    addElement(grid, 'div', formatKm(racer.dist), cls);
    addElement(grid, 'div', racer.pos === 1 ? '' : '-' + Math.round(racer.gapM) + ' m', cls);
    addElement(grid, 'div', racer.bill ? '£' + racer.bill.toLocaleString('en-GB') : '-', cls);
  }
  addElement(panel, 'div', (racers[0] && racers[0].player) ? 'YOU GOT AWAY' : 'THEY GOT AWAY',
    'sub');
  addRepairsLine(panel, racers);
  addResultsButtons(menu, panel, act);
}

/**
 * The results table of a lap / stage race: position, time, gap, best lap, penalty, repair bill.
 * @param {object} menu the menu context
 * @param {object} flow the race flow (raceflow.js)
 * @param {object} act the results actions
 */
function showResultsTable(menu, flow, act) {
  if (flow.highway) return showHighwayTable(menu, flow, act);
  const racers = flow.results, fmt = formatRaceTime;
  const panel = addPane(menu, true);
  addElement(panel, 'h2', 'RESULTS');
  addElement(panel, 'div', act.name + ' · '
    + (flow.stage ? 'STAGE · STAGGERED STARTS' : flow.laps
    + (flow.laps === 1 ? ' LAP' : ' LAPS')), 'sub');
  const grid = addElement(panel, 'div', '', 'res');
  for (const head of ['POS', 'CAR', 'TIME', 'GAP', 'BEST', 'PEN', 'REPAIR']) addElement(grid,
    'div', head, 'h');
  for (const racer of racers) {
    const cls = racer.player ? 'me' : '';
    addRacerCells(grid, racer, cls);
    addElement(grid, 'div', racer.dnf ? 'DNF' : (racer.est ? '~' : '') + fmt(racer.total), cls);
    addElement(grid, 'div', racer.pos === 1 || racer.dnf ? '' : '+' + racer.gap.toFixed(2), cls);
    addElement(grid, 'div', racer.best != null ? fmt(racer.best) : '-', cls);
    addElement(grid, 'div', racer.penalty ? '+' + racer.penalty + ' s' : '', 'pen');
    addElement(grid, 'div', racer.bill ? '£' + racer.bill.toLocaleString('en-GB') : '-', cls);
  }
  if (racers.some((racer) => racer.est)) addElement(panel, 'div', flow.stage
    ? '~ estimated: still on the stage when you finished'
    : '~ estimated: still running when the top 3 were home', 'sub');
  if (racers.some((racer) => racer.penalty)) addElement(panel, 'div',
    'PEN = time penalties (joker rule, track cuts)', 'sub');
  // DAMAGE (user: "counted cost-wise against you at the end of a race in Story mode — shown in
  // Test but never charged")
  addRepairsLine(panel, racers);
  addResultsButtons(menu, panel, act);
}

/**
 * Adds one podium step: the car top-down with its wheels, nose UP the step (user, 2026-10-05:
 * "podium looks broken, just use normal top down cars"), name, time / distance and the step.
 * @param {object} menu the menu context
 * @param {HTMLElement} pod the podium element
 * @param {object} flow the race flow
 * @param {object} racer the racer on this step (may be undefined)
 * @param {number} hgt the step height in px
 */
function addPodiumStep(menu, pod, flow, racer, hgt) {
  const col = addElement(pod, 'div', '');
  if (!racer) return;
  // WAS: the body-only sprite (drawn nose-RIGHT, no wheels) squeezed into a 40 x 64 portrait box
  // -> squashed sideways.
  const spr = menu.api.carSprite(racer.car.spec, null, true),
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
  addElement(col, 'div', nameRacer(racer), racer.player ? '' : '');
  addElement(col, 'div', flow.highway ? formatKm(racer.dist) : racer.dnf ? 'DNF'
    : (racer.est ? '~' : '') + formatRaceTime(racer.total));
  const stepEl = addElement(col, 'div', String(racer.pos), 'step');
  stepEl.style.height = hgt + 'px';
}

/**
 * RESULTS (AI stage 4; user: "podium first, then the table"): the PODIUM, 2nd, 1st, 3rd on
 * steps, the car on top; tap or 2.5 s -> the table. flow = raceflow.js (results sorted on time
 * incl. penalties; est = still running when the race was cut short).
 * @param {object} menu the menu context
 * @param {object} flow the race flow
 * @param {object} act { name, restart, tracks, menu }
 */
function showResults(menu, flow, act) {
  menu.root.className = '';
  const racers = flow.results;
  const panel = addPane(menu, false);
  addElement(panel, 'h2', 'RESULTS');
  addElement(panel, 'div', act.name, 'sub');
  const pod = addElement(panel, 'div', '', 'podium');
  for (const [i, hgt] of [[1, 46], [0, 62], [2, 34]]) {
    addPodiumStep(menu, pod, flow, racers[i], hgt);
  }
  const you = racers.find((racer) => racer.player);
  if (you) addElement(panel, 'div', 'YOU: P' + you.pos + ' of ' + racers.length, 'sub');
  let gone = false;
  const next = () => {
    if (gone) return;
    gone = true;
    showResultsTable(menu, flow, act);
  };
  addButton(menu, panel, 'RESULTS ▶', next, 'go');
  setTimeout(next, 2500);
}

/**
 * Creates the menu: injects its style and root element, builds the context object shared by the
 * screens and returns the menu's public methods.
 * @param {object} api what main.js offers (thumbs, launch, carSprite, genStage)
 * @returns {object} { show, hide, pause, results, profile, open }
 */
export function createMenu(api) {
  const profile = loadProfile();
  const styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);
  const root = document.createElement('div');
  root.id = 'menu';
  root.className = 'gone';
  document.body.appendChild(root);
  const menu = {
    api,
    root,
    profile,
    thumbs: null,   // the cached level thumbnails
    openedAt: 0,   // when the current screen opened (ghost-click guard)
  };
  return {
    show: () => showMenu(menu),
    hide: () => hideMenu(menu),
    pause: (act) => showPause(menu, act),
    results: (flow, act) => showResults(menu, flow, act),
    profile,
    get open() {
      return root.className !== 'gone';
    },
  };
}
