import { LEVELS } from '../world/levels/index.ts';
import { THEMES, LENGTHS } from '../stagegen.js';
import { saveProfile } from './profile.js';
import { addPane, addButton, addElement, copyThumb } from './widgets.js';
import { showSetup } from './setup.js';
import { showGarage } from './garage.js';

export const KIND = { lab: 'TEST GROUND', 'test-track': 'CIRCUIT', thruston: 'UK CIRCUIT',
  'castle-cum': 'UK CIRCUIT', 'brands-snatch': 'UK CIRCUIT · GP', knobhill: 'RALLYCROSS',
  'brands-snatch-indy': 'UK CIRCUIT · INDY', 'sweaty-lamb': 'RALLY STAGE',
  killder: 'RALLY STAGE · FOREST', 'slidden-hill': 'RALLYCROSS', 'grass-track': 'AUTOGRASS',
  'stock-car': 'OVAL', naffcar: 'OVAL', sandbox: 'CIRCUIT', 'straight-outta': 'TEST STRAIGHT',
  'bowling-alley': 'TEST GROUND', 'rough-patch': 'TEST GROUND' };
// TRACK CATEGORIES. A level's category: CAT_OF by id, else generated / set rally
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
  lab: 'test', sandbox: 'test', 'straight-outta': 'test', 'bowling-alley': 'test',
  'rough-patch': 'test' };
export const catOf = (level) => CAT_OF[level.id]
  || (level.gen ? 'rally' : level.endless ? 'roads' : 'circuits');

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
 * MAIN MENU (spec §2): Story locked, Garage, Test Mode (primary).
 * @param {object} menu the menu context
 */
export function showMainMenu(menu) {
  const panel = addPane(menu, false);
  addElement(panel, 'h1', 'RAC3R');
  addElement(panel, 'div', 'a driving sandbox', 'sub');   // the game's name
  addButton(menu, panel, 'TEST MODE', () => showTrackSelect(menu), 'go');
  addButton(menu, panel, 'GARAGE', () => showGarage(menu));
  addButton(menu, panel, 'STORY', () => {}, '', true, 'LOCKED');
}

/**
 * TEST MODE step 1: CATEGORY LIST (requirement: a menu layer for circuit type, stick appropriate
 * tracks in the correct category — "a BIG LIST", Grass Track in OVALS), then step 1b: that
 * category's track cards (overhead thumbnails).
 * @param {object} menu the menu context
 */
export function showTrackSelect(menu) {
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
export function showTrackList(menu, cat) {
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
 * GENERATOR SETUP (user: procedural point-to-point stages): THEME, LENGTH, CORNERS,
 * SEED (◀ ▶ / NEW STAGE), the road map; every change regenerates (≤ ~0.5 s) and the setup
 * reopens on the new stage. Remembered in profile.gen.
 * @param {object} menu the menu context
 * @param {HTMLElement} panel the setup pane
 * @param {object} level the generated level
 */
export function addGenRows(menu, panel, level) {
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
