// The scenery painters: planes, trucks, trees, rocks, crowds, flags, signs and the
// other small trackside props.
import { parkMiller } from '../../core/random.ts';
import type { Prop } from '../../world/types.ts';
import type { PropCtx } from './types.ts';

/**
 * Draws the plane prop (plane).
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 */
export function drawPlane(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view } = propCtx;
  // LIGHT AIRCRAFT, nose along +x: fuselage, wing, tailplane, a coloured stripe
  const paint = (x: number, y: number, width: number, height: number, col: string) => {
    view.ctx.fillStyle = col;
    view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
  };
  view.ctx.fillStyle = 'rgba(10,12,16,0.30)';
  view.ctx.fillRect(-3.2 * ppm + 0.8 * ppm, -0.5 * ppm + 1.2 * ppm, 7 * ppm, 1 * ppm);
  view.ctx.fillRect(0.3 * ppm, -4.5 * ppm + 1.2 * ppm, 1.4 * ppm, 9 * ppm);
  paint(-3.2, -0.5, 7, 1, '#eef0f2');
  paint(0.3, -4.5, 1.4, 9, '#e3e6ea');
  paint(-3.2, -1.6, 0.8, 3.2, '#e3e6ea');
  paint(-2.6, -0.15, 5.6, 0.3, prop.col || '#c8302c');
  paint(3.4, -0.3, 0.4, 0.6, '#3a3f47');
}

/**
 * Draws the windsock prop (windsock).
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 */
export function drawWindsock(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view } = propCtx;
  const paint = (x: number, y: number, width: number, height: number, col: string) => {
    view.ctx.fillStyle = col;
    view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
  };
  paint(-0.25, -0.25, 0.5, 0.5, '#5a5e66');
  for (let seg = 0; seg < 4; seg++)
    paint(
      0.25 + seg * 0.6,
      -0.35 + seg * 0.04,
      0.6,
      0.7 - seg * 0.08,
      seg % 2 ? '#f2f2f2' : '#f07a1a',
    );
}

/**
 * Draws the truck prop (truck).
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 */
export function drawTruck(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view } = propCtx;
  // RACE TRANSPORTER (paddock): cab + long trailer with a team stripe, nose along +x
  const paint = (x: number, y: number, width: number, height: number, col: string) => {
    view.ctx.fillStyle = col;
    view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
  };
  view.ctx.fillStyle = 'rgba(10,12,16,0.35)';
  view.ctx.fillRect(-7 * ppm + 0.6 * ppm, -1.25 * ppm + 0.9 * ppm, 14 * ppm, 2.5 * ppm);
  paint(-7, -1.25, 11.2, 2.5, '#e6e8eb');
  paint(-7, -0.35, 11.2, 0.7, prop.col || '#c8302c');
  paint(4.6, -1.2, 2.4, 2.4, prop.col || '#c8302c');
  paint(6.2, -1.0, 0.6, 2.0, '#2a3038');
}

/**
 * Draws the tree prop (tree).
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 */
export function drawTree(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view } = propCtx;
  // a tree from overlapping SQUARES (pixel rule), shade per seed; long shadow first
  const size = (prop.s || 4) * ppm,
    shade = ((prop.seed! * 9301 + 49297) % 233280) / 233280;
  view.ctx.fillStyle = 'rgba(10,12,16,0.32)';
  view.ctx.fillRect(-size / 2 + 0.25 * size, -size / 2 + 0.35 * size, size, size);
  // pal: 'dry' = desert scrub (olive / dust), else conifer greens; snow: white caps on the
  // upper squares (generated stages)
  const cols =
    prop.pal === 'dry'
      ? shade < 0.5
        ? ['#5b5a2e', '#6f6d38', '#8a8646']
        : ['#64552c', '#786a36', '#948548']
      : shade < 0.5
        ? ['#2f5a2a', '#3d6e33', '#4f8240']
        : ['#355f2c', '#456f36', '#5a8a45'];
  view.ctx.fillStyle = cols[0];
  view.ctx.fillRect(-size / 2, -size / 2, size, size);
  view.ctx.fillStyle = prop.snow ? '#dfe7ee' : cols[1];
  view.ctx.fillRect(
    -size / 2 + size * 0.12,
    -size / 2 + size * 0.1,
    size * 0.62,
    size * 0.62,
  );
  if (prop.snow) {
    view.ctx.fillStyle = cols[1];
    view.ctx.fillRect(
      -size / 2 + size * 0.42,
      -size / 2 + size * 0.42,
      size * 0.32,
      size * 0.32,
    );
  }
  view.ctx.fillStyle = prop.snow ? '#ffffff' : cols[2];
  view.ctx.fillRect(-size / 2 + size * 0.2, -size / 2 + size * 0.18, size * 0.3, size * 0.3);
}

/**
 * Draws the rock prop (rock).
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 */
export function drawRock(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view } = propCtx;
  // ROCK / BOULDER: overlapping grey squares, light top-left, dark bottom-right, a long
  // shadow (pixel rule); pal 'red' = desert stone
  const size = (prop.s || 3) * ppm,
    shade = (((prop.seed || 1) * 9301 + 49297) % 233280) / 233280;
  const cols =
    prop.pal === 'red'
      ? ['#6e4a32', '#8c5f40', '#a87652', '#c39270']
      : ['#4d5157', '#62676e', '#7b8088', '#989da4'];
  view.ctx.fillStyle = 'rgba(10,12,16,0.34)';
  view.ctx.fillRect(-size / 2 + 0.3 * size, -size / 2 + 0.4 * size, size, size * 0.9);
  view.ctx.fillStyle = cols[0];
  view.ctx.fillRect(-size / 2, -size / 2 + size * 0.1, size, size * 0.8);
  view.ctx.fillRect(-size / 2 + size * 0.15, -size / 2, size * 0.7, size);
  view.ctx.fillStyle = cols[1];
  view.ctx.fillRect(-size / 2 + size * 0.1, -size / 2 + size * 0.08, size * 0.72, size * 0.7);
  view.ctx.fillStyle = cols[2];
  view.ctx.fillRect(
    -size / 2 + size * 0.16,
    -size / 2 + size * 0.12,
    size * (0.38 + 0.15 * shade),
    size * 0.36,
  );
  view.ctx.fillStyle = cols[3];
  view.ctx.fillRect(
    -size / 2 + size * 0.22,
    -size / 2 + size * 0.16,
    size * 0.16,
    size * 0.14,
  );
  if (prop.snow) {
    view.ctx.fillStyle = '#eef3f7';
    view.ctx.fillRect(
      -size / 2 + size * 0.12,
      -size / 2 + size * 0.06,
      size * 0.5,
      size * 0.22,
    );
  }
}

/**
 * Draws the crowd prop (crowd).
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 */
export function drawCrowd(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view } = propCtx;
  // SPECTATORS: a cluster of people (a 2x2 px head-and-shoulders each, jackets in random
  // colours, a shadow) over w x h m
  const count = prop.n || 14,
    width = prop.w || 8,
    height = prop.h || 3;
  const rand = parkMiller((prop.seed || 7) * 7919);
  const jackets = [
    '#c8302c',
    '#2b56b5',
    '#e2c13a',
    '#2f7d4f',
    '#f2f2f2',
    '#e07a1f',
    '#7a3fa0',
    '#16181d',
    '#3fb6c9',
  ];
  for (let person = 0; person < count; person++) {
    const x = (rand() - 0.5) * width * ppm,
      y = (rand() - 0.5) * height * ppm,
      z = Math.max(2, 0.55 * ppm);
    view.ctx.fillStyle = 'rgba(10,12,16,0.3)';
    view.ctx.fillRect(x + z * 0.3, y + z * 0.4, z, z);
    view.ctx.fillStyle = jackets[(rand() * jackets.length) | 0];
    view.ctx.fillRect(x - z / 2, y - z / 2, z, z);
    view.ctx.fillStyle = rand() < 0.5 ? '#e6c3a0' : '#8a5a3c';
    view.ctx.fillRect(x - z * 0.22, y - z * 0.22, z * 0.44, z * 0.44);
  }
}

/**
 * Draws the marshal prop (marshal).
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 */
export function drawMarshal(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view } = propCtx;
  // MARSHAL POST: small hut, white roof, orange edge
  const paint = (x: number, y: number, width: number, height: number, col: string) => {
    view.ctx.fillStyle = col;
    view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
  };
  view.ctx.fillStyle = 'rgba(10,12,16,0.35)';
  view.ctx.fillRect(-1.2 * ppm + 0.4 * ppm, -1 * ppm + 0.6 * ppm, 2.4 * ppm, 2 * ppm);
  paint(-1.2, -1, 2.4, 2, '#f07a1a');
  paint(-0.95, -0.75, 1.9, 1.5, '#f2f2f2');
}

/**
 * Draws the sculpture prop (sculpture).
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 */
export function drawSculpture(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view } = propCtx;
  // the red steel SCULPTURE by the start line (photo): a crown of red squares, orange core,
  // long shadow (it is tall)
  const paint = (x: number, y: number, width: number, height: number, col: string) => {
    view.ctx.fillStyle = col;
    view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
  };
  view.ctx.fillStyle = 'rgba(10,12,16,0.32)';
  view.ctx.fillRect(0.2 * ppm, 0.2 * ppm, 3.2 * ppm, 1.6 * ppm);
  for (const [x, y] of [
    [-1.1, -1.1],
    [0.3, -1.3],
    [0.7, -0.2],
    [-0.1, 0.6],
    [-1.2, 0.1],
  ])
    paint(x, y, 0.8, 0.8, '#d6331f');
  paint(-0.4, -0.4, 0.8, 0.8, '#f07a1a');
}

/**
 * Draws the block prop (block).
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 */
export function drawBlock(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view } = propCtx;
  // a flat-roofed BUILDING (clubhouse, offices): roof colour, parapet, rooftop plant,
  // optional name on the roof
  const paint = (x: number, y: number, width: number, height: number, col: string) => {
    view.ctx.fillStyle = col;
    view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
  };
  const halfW = prop.w! / 2,
    halfH = prop.h! / 2;
  view.ctx.fillStyle = 'rgba(10,12,16,0.40)';
  view.ctx.fillRect(
    -halfW * ppm + 1.2 * ppm,
    -halfH * ppm + 1.6 * ppm,
    prop.w! * ppm,
    prop.h! * ppm,
  );
  paint(-halfW, -halfH, prop.w!, prop.h!, '#3b4047');
  paint(-halfW + 0.4, -halfH + 0.4, prop.w! - 0.8, prop.h! - 0.8, prop.roof || '#5b626b');
  paint(halfW - 4, -halfH + 1.2, 2.4, 1.8, '#9aa0a8');
  paint(halfW - 3.6, -halfH + 1.5, 1.6, 1.2, '#7c828a');
  // a CHURCH (highway.js village): a square tower at the west end of the nave, with a little
  // cross; a HOUSE: a ridge line, no rooftop plant
  if (prop.church) {
    paint(-halfW - 2.6, -2, 4, 4, '#3b4047');
    paint(-halfW - 2.3, -1.7, 3.4, 3.4, '#8f8a80');
    paint(-halfW - 0.8, -0.8, 0.4, 1.6, '#3b4047');
    paint(-halfW - 1.2, -0.2, 1.2, 0.4, '#3b4047');
  }
  if (prop.house || prop.church)
    paint(-halfW + 0.4, -0.08, prop.w! - 0.8, 0.16, 'rgba(20,22,28,0.35)');
  if (prop.label && ppm * 1.4 >= 9) {
    view.ctx.fillStyle = 'rgba(255,255,255,0.85)';
    view.ctx.font = `900 ${Math.round(ppm * 1.4)}px Impact, ui-sans-serif, sans-serif`;
    view.ctx.textAlign = 'center';
    view.ctx.textBaseline = 'middle';
    if (Math.cos(prop.rot || 0) < 0) view.ctx.rotate(Math.PI);
    view.ctx.fillText(prop.label, 0, 0.6 * ppm, prop.w! * 0.8 * ppm);
  }
}

/**
 * Draws the chevron prop (chevron).
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 */
export function drawChevron(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view } = propCtx;
  // RALLY CHEVRON BOARD (black + yellow arrows), placed on the outside of a corner, arrows
  // pointing the way it turns (+x). Drawn at 1.6x (photographed: at 3.2 m it was a smudge
  // beside the bales)
  view.ctx.scale(1.6, 1.6);
  const paint = (x: number, y: number, width: number, height: number, col: string) => {
    view.ctx.fillStyle = col;
    view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
  };
  view.ctx.fillStyle = 'rgba(10,12,16,0.32)';
  view.ctx.fillRect(-1.6 * ppm + 0.3 * ppm, -0.25 * ppm + 0.5 * ppm, 3.2 * ppm, 0.5 * ppm);
  paint(-1.6, -0.25, 3.2, 0.5, '#15171c');
  for (let chevron = 0; chevron < 3; chevron++) {
    paint(-1.25 + chevron * 1.0, -0.2, 0.25, 0.15, '#f2c21b');
    paint(-1.0 + chevron * 1.0, -0.075, 0.25, 0.15, '#f2c21b');
    paint(-1.25 + chevron * 1.0, 0.05, 0.25, 0.15, '#f2c21b');
  }
}

/**
 * Draws the bale prop (bale).
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 */
export function drawBale(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view } = propCtx;
  // ROUND HAY BALE from the top: a straw square with a darker spiral ring (squares — the
  // pixel rule)
  const paint = (x: number, y: number, width: number, height: number, col: string) => {
    view.ctx.fillStyle = col;
    view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
  };
  view.ctx.fillStyle = 'rgba(10,12,16,0.30)';
  view.ctx.fillRect(-0.8 * ppm + 0.3 * ppm, -0.8 * ppm + 0.45 * ppm, 1.6 * ppm, 1.6 * ppm);
  paint(-0.8, -0.8, 1.6, 1.6, '#c9a85a');
  paint(-0.55, -0.55, 1.1, 1.1, '#b48f45');
  paint(-0.3, -0.3, 0.6, 0.6, '#d8bb6e');
  paint(-0.08, -0.08, 0.16, 0.16, '#9a7836');
}

/**
 * Draws the flag prop (flag).
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 */
export function drawFlag(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view } = propCtx;
  // a FLAG on a pole: pole square + a pennant blowing in +x, with a long shadow
  const paint = (x: number, y: number, width: number, height: number, col: string) => {
    view.ctx.fillStyle = col;
    view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
  };
  view.ctx.fillStyle = 'rgba(10,12,16,0.28)';
  view.ctx.fillRect(0.2 * ppm, 0.1 * ppm, 1.8 * ppm, 0.6 * ppm);
  paint(-0.15, -0.15, 0.3, 0.3, '#3a3f47');
  paint(0.15, -0.55, 1.3, 0.75, prop.col || '#c8302c');
  paint(0.15, -0.55, 1.3, 0.12, 'rgba(255,255,255,0.35)');
}

/**
 * Draws the slip count prop (slipcount).
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 */
export function drawSlipCount(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view } = propCtx;
  // the 300 / 200 / 100 yd COUNTDOWN posts before an exit: white with red diagonal bars
  // (squares, not circles)
  const paint = (x: number, y: number, width: number, height: number, col: string) => {
    view.ctx.fillStyle = col;
    view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
  };
  paint(-0.5, -1.0, 1.2, 2.2, 'rgba(10,12,16,0.35)');
  paint(-0.6, -1.1, 1.2, 2.2, '#f2f2f2');
  for (let bar = 0; bar < (prop.bars || 1); bar++)
    paint(-0.6, -0.95 + bar * 0.7, 1.2, 0.35, '#c8302c');
}

/**
 * Draws the gate prop (gate).
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 */
export function drawGate(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view } = propCtx;
  // a FIELD GATE where the slip road ends (wooden 5-bar, posts either side)
  const paint = (x: number, y: number, width: number, height: number, col: string) => {
    view.ctx.fillStyle = col;
    view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
  };
  paint(-3.4, -0.2, 6.8, 0.6, 'rgba(10,12,16,0.35)');
  paint(-3.2, -0.35, 0.5, 0.7, '#3a2d21');
  paint(2.7, -0.35, 0.5, 0.7, '#3a2d21');
  for (let rail = 0; rail < 3; rail++) paint(-2.7, -0.25 + rail * 0.22, 5.4, 0.1, '#b48a5a');
}

/**
 * Draws the solar farm prop (solarfarm).
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 */
export function drawSolarFarm(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view } = propCtx;
  // the SMILEY SOLAR FARM (a cheeky extra): rows of dark blue panels laid out as a smiling
  // face, seen from above
  const paint = (x: number, y: number, width: number, height: number, col: string) => {
    view.ctx.fillStyle = col;
    view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
  };
  const cell = (cellX: number, cellY: number) => {
    paint(cellX * 2.4 - 1.1, cellY * 2.4 - 0.9, 2.2, 1.8, '#1b2b55');
    paint(cellX * 2.4 - 1.1, cellY * 2.4 - 0.9, 2.2, 0.35, '#5f7fc4');
  };
  for (const [cellX, cellY] of [
    [-3, -3],
    [-2, -3],
    [2, -3],
    [3, -3],
    [-3, -2],
    [-2, -2],
    [2, -2],
    [3, -2],
  ])
    cell(cellX, cellY); // eyes
  for (const [cellX, cellY] of [
    [-5, 1],
    [-4, 2],
    [-3, 3],
    [-2, 3],
    [-1, 4],
    [0, 4],
    [1, 4],
    [2, 3],
    [3, 3],
    [4, 2],
    [5, 1],
  ])
    cell(cellX, cellY); // grin
}

// a board's size, m (render/light.ts backlights the same rectangle)
export const BOARD_W_M = 18, BOARD_H_M = 2.4;

/**
 * A board's accent colour: a motorway exit sign's white, else by its sponsor.
 * @param prop the board
 * @returns the colour
 */
export function boardAccent(prop: Prop): string {
  if (prop.blue) return '#ffffff';
  const label = prop.label || '';
  return label.includes('SPUM') ? '#eab308' : label.includes('CREEM') ? '#38bdf8' : '#f97316';
}

/**
 * Draws the board prop (board).
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 */
export function drawBoard(propCtx: PropCtx, prop: Prop, ppm: number) {
  const { view } = propCtx;
  // Heavy timber support posts
  const boardW = BOARD_W_M * ppm,
    boardH = BOARD_H_M * ppm;
  view.ctx.fillStyle = 'rgba(10,12,16,0.38)';
  view.ctx.fillRect(-boardW / 2 + 2, -boardH / 2 + 3, boardW, boardH);
  // Wooden support posts
  view.ctx.fillStyle = '#3a2d21';
  view.ctx.fillRect(-boardW / 2 + 1 * ppm, -boardH / 2, 0.4 * ppm, boardH + 2);
  view.ctx.fillRect(boardW / 2 - 1.4 * ppm, -boardH / 2, 0.4 * ppm, boardH + 2);
  // Signboard body with colored accent border
  // blue = a motorway EXIT sign (highway.js slip roads)
  view.ctx.fillStyle = prop.blue ? '#1f4fa8' : '#14161c';
  view.ctx.fillRect(-boardW / 2, -boardH / 2, boardW, boardH);
  view.ctx.strokeStyle = boardAccent(prop);
  view.ctx.lineWidth = 1.8;
  view.ctx.strokeRect(-boardW / 2, -boardH / 2, boardW, boardH);
  // Sponsor typography with punchy contrast
  view.ctx.fillStyle = '#ffffff';
  view.ctx.font = `900 ${Math.round(1.15 * ppm)}px Impact, ui-sans-serif, sans-serif`;
  view.ctx.textAlign = 'center';
  view.ctx.textBaseline = 'middle';
  view.ctx.fillText(prop.label || 'SPONSOR', 0, 0);
}
