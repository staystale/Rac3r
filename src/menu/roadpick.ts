// menu/roadpick.ts - THE ENDLESS ROADS PICKED IN THE LEVEL SELECTOR (passed 11-09; owner: "The
// menu to choose needs to be simple and clear / and be in the level selector not the pre race setup
// menu after / So you choose the asthetic type and then the road type"): TEST MODE > ENDLESS ROADS
// is the SCENERY's cards (COUNTRYSIDE, DEAF VALLEY), then the ROAD's (every road in every scenery),
// then the setup. Each card a little painting of the road in its scenery.
import { LEVELS } from '../world/levels/index.ts';
import { HW_ROADS, HW_SCENERY } from '../highway/presets.ts';
import { saveProfile } from './profile.ts';
import { addPane, addButton, addElement } from './widgets.ts';
import { showSetup } from './setup.ts';
import { showTrackSelect } from './tracks.ts';
import type { Menu } from '../menu.ts';

// a card's painting, px (the card canvas's 16:10), and each scenery's colours
const CARD_W = 320, CARD_H = 200;
const LOOK: Record<string, { ground: string; band: string; dot: string; dot2: string }> = {
  countryside: { ground: '#4f7a3a', band: '#5d8a44', dot: '#2f5a2a', dot2: '#3d6b30' },
  canyon: { ground: '#c9a46a', band: '#d8b77e', dot: '#9a4a2c', dot2: '#4f7a3a' },
};
const TARMAC = '#3b3e44', PAINT = '#e8e8e0', WALL = '#9a9a94';

/**
 * The scenery's ground: its colour, stripes of the fields or the sand, and its dots - trees and
 * hedges, or red rocks and cacti - kept off the road.
 * @param ctx the card's context
 * @param scenery the scenery
 * @param roadAt the road's middle (px across) at a height, and its half width
 */
function paintGround(ctx: CanvasRenderingContext2D, scenery: string,
  roadAt: (y: number) => { mid: number; half: number }) {
  const look = LOOK[scenery] || LOOK.countryside;
  ctx.fillStyle = look.ground;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = look.band;
  for (let y = 0; y < CARD_H; y += 40) ctx.fillRect(0, y, CARD_W, 18);
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let dot = 0; dot < 46; dot++) {
    const x = rand() * CARD_W, y = rand() * CARD_H, size = 5 + rand() * 9, road = roadAt(y);
    if (Math.abs(x - road.mid) < road.half + size + 6) continue;
    ctx.fillStyle = dot % 3 ? look.dot : look.dot2;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(size), Math.round(size));
  }
}

/**
 * A road's painting across the card: its carriageways, the central reservation, the lane lines
 * (and the walls; the twisty road winding, its centre line).
 * @param ctx the card's context
 * @param road the road type (HW_ROADS)
 * @param roadAt the road's middle and half width at a height
 */
function paintRoad(ctx: CanvasRenderingContext2D, road: string,
  roadAt: (y: number) => { mid: number; half: number }) {
  const lanes = road === 'interstate' ? 4 : road === 'dual' ? 2 : road === 'twisty' ? 1 : 3;
  const twin = road !== 'twisty', median = twin ? 6 : 0;
  for (let y = 0; y < CARD_H; y += 2) {
    const { mid, half } = roadAt(y), laneW = (half - median / 2) / lanes;
    ctx.fillStyle = TARMAC;
    ctx.fillRect(Math.round(mid - half), y, Math.round(2 * half), 2);
    if (road === 'walled') {
      ctx.fillStyle = WALL;
      ctx.fillRect(Math.round(mid - half - 5), y, 3, 2);
      ctx.fillRect(Math.round(mid + half + 2), y, 3, 2);
    }
    ctx.fillStyle = PAINT;
    if (twin) {
      // the central reservation's barrier
      ctx.fillStyle = WALL;
      ctx.fillRect(Math.round(mid - 1), y, 2, 2);
      ctx.fillStyle = PAINT;
    }
    if ((y >> 3) % 2) continue;
    for (const side of [-1, 1]) for (let lane = 1; lane < lanes; lane++)
      ctx.fillRect(Math.round(mid + side * (median / 2 + lane * laneW)), y, 1, 2);
    if (!twin) ctx.fillRect(Math.round(mid), y, 1, 2);
  }
}

/**
 * Paints a card: a road (none: the scenery's motorway) running up through a scenery.
 * @param scenery the scenery
 * @param road the road type, or null
 * @returns the canvas
 */
function paintCard(scenery: string, road: string | null): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!, kind = road || 'motorway';
  const half = kind === 'interstate' ? 46 : kind === 'dual' ? 28 : kind === 'twisty' ? 14 : 38;
  const roadAt = (y: number) => ({ half, mid: CARD_W / 2 + (kind === 'twisty'
    ? 60 * Math.sin(y / 34) : 22 * Math.sin(y / 90)) });
  paintGround(ctx, scenery, roadAt);
  paintRoad(ctx, kind, roadAt);
  return canvas;
}

/** The highway level (the one endless level). */
const highwayLevel = () => LEVELS.find((level) => level.endless);

/**
 * TEST MODE > ENDLESS ROADS, step 1: the scenery.
 * @param menu the menu context
 */
export function showSceneryList(menu: Menu) {
  const panel = addPane(menu, true), profile = menu.profile;
  addElement(panel, 'h2', 'TEST MODE · ENDLESS ROADS');
  addElement(panel, 'div', 'CHOOSE THE SCENERY', 'sub');
  const grid = addElement(panel, 'div', '', 'grid');
  for (const [key, entry] of Object.entries(HW_SCENERY)) {
    const button = addButton(menu, grid, '', () => {
      profile.hwScenery = key;
      saveProfile(profile);
      showRoadList(menu, key);
    }, 'card' + (key === (profile.hwScenery || 'countryside') ? ' on' : ''));
    button.appendChild(paintCard(key, null));
    addElement(button, 'span', entry.name, 'nm');
    addElement(button, 'span', entry.line, 'k');
  }
  const row = addElement(panel, 'div', '', 'row');
  addButton(menu, row, '◀ TYPES', () => showTrackSelect(menu));
}

/**
 * TEST MODE > ENDLESS ROADS, step 2: the road in a scenery, then its setup.
 * @param menu the menu context
 * @param scenery the scenery picked (HW_SCENERY)
 */
export function showRoadList(menu: Menu, scenery: string) {
  const panel = addPane(menu, true), profile = menu.profile, level = highwayLevel();
  addElement(panel, 'h2', 'TEST MODE · ' + (HW_SCENERY[scenery] || HW_SCENERY.countryside).name);
  addElement(panel, 'div', 'CHOOSE THE ROAD', 'sub');
  const grid = addElement(panel, 'div', '', 'grid');
  for (const [key, entry] of Object.entries(HW_ROADS)) {
    const button = addButton(menu, grid, '', () => {
      profile.hwRoad = key;
      if (level) profile.lastLevel = level.id;
      saveProfile(profile);
      if (level) showSetup(menu, level, { road: key, scenery });
    }, 'card' + (key === (profile.hwRoad || 'motorway') ? ' on' : ''));
    button.appendChild(paintCard(scenery, key));
    addElement(button, 'span', entry.name, 'nm');
    addElement(button, 'span', entry.line, 'k');
  }
  const row = addElement(panel, 'div', '', 'row');
  addButton(menu, row, '◀ SCENERY', () => showSceneryList(menu));
}
