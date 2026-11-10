// render/props/desertjunk.ts - DEAF VALLEY's roadside junk and its gas station seen from above
// (highway/canyon.ts places them; owner 11-09: "Definite rusted out cars, gas station, cattle
// skull, road signs can be a thing"), lit from the top-left with their shadows down-right as every
// other prop's: a RUSTED-OUT CAR (rust and primer, no glass, no wheels - or on its roof, its
// floor pan and axles up), a CATTLE SKULL (bleached bone, the horns), the LAST GASP station (the
// shop's flat roof and its plant, two pumps on their islands) and its CANOPY (over the cars).
import { WRECK_M, GAS_SHOP, GAS_PUMPS, GAS_CANOPY, SHACK_M } from '../../world/desertjunk.ts';
import type { Prop } from '../../world/types.ts';
import type { PropCtx } from './types.ts';

// (a shack's tin: the sheet, its ribs light and dark)
const TIN = ['#8f8c83', '#a6a39a', '#7b786f'];
const SHADOW = 'rgba(30,18,10,0.34)', RUST = ['#7a4a2a', '#9b6236', '#5a3520', '#b07a44'],
  GLASSLESS = '#1d1a17', BONE = '#efe6d2', BONE_DARK = '#b9ad94';

/**
 * A screen offset (down-right, the shadows' way) in the prop's own turned frame, m.
 * @param prop the prop (its turn)
 * @param screenM m down and right on the screen
 * @returns the offset in its frame
 */
function shadowShift(prop: Prop, screenM: number): [number, number] {
  const cos = Math.cos(prop.rot || 0), sin = Math.sin(prop.rot || 0);
  return [screenM * (cos + sin), screenM * (cos - sin)];
}

/**
 * A rusted-out car: its shadow, the body in rust and primer patches, the roof caved, the window
 * holes empty, no wheels; on its roof, the floor pan with its two axles and the exhaust.
 * @param propCtx the view and painter helpers
 * @param prop the wreck (flip: on its roof)
 * @param ppm pixels per metre
 */
export function drawWreck(propCtx: PropCtx, prop: Prop, ppm: number) {
  const ctx = propCtx.view.ctx, [len, wid] = WRECK_M, seed = prop.seed || 1,
    rect = (x: number, y: number, wide: number, high: number, col: string) => {
      ctx.fillStyle = col;
      ctx.fillRect(x * ppm, y * ppm, wide * ppm, high * ppm);
    };
  const [shX, shY] = shadowShift(prop, 0.45);
  rect(-len / 2 + shX, -wid / 2 + shY, len, wid, SHADOW);
  rect(-len / 2, -wid / 2, len, wid, RUST[0]);
  for (let spot = 0; spot < 6; spot++)
    rect(-len / 2 + ((seed * 0.37 + spot * 0.61) % 0.85) * len, -wid / 2 + ((seed * 0.23 + spot
      * 0.41) % 0.7) * wid, len * 0.14, wid * 0.28, RUST[1 + ((seed + spot) % 3)]);
  if (prop.flip) {
    // the floor pan: two axles across it, the exhaust along it
    rect(-len * 0.36, -wid * 0.45, 0.18, wid * 0.9, '#2a2420');
    rect(len * 0.3, -wid * 0.45, 0.18, wid * 0.9, '#2a2420');
    rect(-len * 0.4, wid * 0.12, len * 0.75, 0.12, '#3d332c');
    return;
  }
  // the windscreen and back window holes, the caved roof between
  rect(len * 0.08, -wid * 0.38, len * 0.12, wid * 0.76, GLASSLESS);
  rect(-len * 0.3, -wid * 0.36, len * 0.1, wid * 0.72, GLASSLESS);
  rect(-len * 0.2, -wid * 0.36, len * 0.28, wid * 0.72, RUST[2]);
  rect(-len * 0.12, -wid * 0.2, len * 0.1, wid * 0.22, GLASSLESS);
}

/**
 * A tin shack (?desertjunk=1): its shadow, the corrugated roof in faded tin and rust, its ridge,
 * a sheet gone and patched with planks, a lean-to off the back.
 * @param propCtx the view and painter helpers
 * @param prop the shack
 * @param ppm pixels per metre
 */
export function drawShack(propCtx: PropCtx, prop: Prop, ppm: number) {
  const ctx = propCtx.view.ctx, [len, wid] = SHACK_M, seed = prop.seed || 1,
    rect = (x: number, y: number, wide: number, high: number, col: string) => {
      ctx.fillStyle = col;
      ctx.fillRect(x * ppm, y * ppm, Math.max(1, wide * ppm), Math.max(1, high * ppm));
    };
  const [shX, shY] = shadowShift(prop, 0.9);
  rect(-len / 2 + shX, -wid / 2 + shY, len, wid + 1.4, SHADOW);
  // the lean-to off the back, lower and darker
  rect(-len * 0.4, wid / 2, len * 0.6, 1.4, '#6f6a5f');
  rect(-len / 2, -wid / 2, len, wid, TIN[0]);
  // the corrugations across the roof, rust patches by the seed, the ridge along it
  for (let rib = 0; rib < 13; rib++)
    rect(-len / 2 + rib * (len / 13), -wid / 2, len / 26, wid, TIN[1 + (rib % 2)]);
  for (let spot = 0; spot < 4; spot++)
    rect(-len / 2 + ((seed * 0.29 + spot * 0.53) % 0.8) * len, -wid / 2 + ((seed * 0.17 + spot
      * 0.37) % 0.75) * wid, len * 0.18, wid * 0.22, RUST[(seed + spot) % 4]);
  rect(-len / 2, -0.08, len, 0.16, '#5b574f');
  rect(len * 0.18, -wid * 0.42, len * 0.16, wid * 0.36, '#8a6a43');
}

/**
 * A cattle skull: its shadow, the long face, the eye holes, the horns curving out.
 * @param propCtx the view and painter helpers
 * @param prop the skull
 * @param ppm pixels per metre
 */
export function drawSkull(propCtx: PropCtx, prop: Prop, ppm: number) {
  paintSkull(propCtx.view.ctx, prop.rot || 0, ppm);
}

/**
 * A loose cattle skull (?desertjunk=1: cones/coneConsts.ts DEBRIS), or the bone shards a hit left
 * (a few bleached chips and a horn scattered flat), in its own turned frame.
 * @param ctx the canvas, at the object
 * @param cone the object (its kind, its angle, its home spot for its look)
 * @param ppm pixels per metre
 * @returns true for a skull or its bones
 */
export function drawLooseSkull(ctx: CanvasRenderingContext2D,
    cone: { kind: string; ang?: number; hx?: number; hy?: number }, ppm: number): boolean {
  if (cone.kind === 'skull') paintSkull(ctx, cone.ang || 0, ppm);
  else if (cone.kind === 'bones') paintBones(ctx, Math.abs(Math.round((cone.hx || 0) * 7
    + (cone.hy || 0) * 13)) % 997 + 1, ppm);
  else return false;
  return true;
}

/**
 * A skull's broken bits: bleached chips, a horn, scattered flat round the spot.
 * @param ctx the canvas
 * @param seed its look
 * @param ppm pixels per metre
 */
function paintBones(ctx: CanvasRenderingContext2D, seed: number, ppm: number) {
  let state = seed;
  const rand = () => (state = (state * 16807) % 2147483647) / 2147483647;
  for (let bit = 0; bit < 8; bit++) {
    const angle = rand() * 6.283, radius = Math.sqrt(rand()) * 0.9, horn = bit === 0,
      wide = (horn ? 0.3 : 0.08 + rand() * 0.12) * ppm, high = (horn ? 0.07 : 0.06 + rand() * 0.08)
      * ppm;
    ctx.fillStyle = bit % 3 === 2 ? BONE_DARK : BONE;
    ctx.fillRect(Math.cos(angle) * radius * ppm - wide / 2, Math.sin(angle) * radius * ppm
      - high / 2, Math.max(1, wide), Math.max(1, high));
  }
}

/**
 * A cattle skull in its turned frame: its shadow, the long face, the eye holes, the horns.
 * @param ctx the canvas, at the skull and turned with it
 * @param rot its turn (the shadow falls down-right on the screen whatever it)
 * @param ppm pixels per metre
 */
function paintSkull(ctx: CanvasRenderingContext2D, rot: number, ppm: number) {
  const rect = (x: number, y: number, wide: number, high: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(x * ppm, y * ppm, Math.max(1, wide * ppm), Math.max(1, high * ppm));
  };
  const [shX, shY] = shadowShift({ rot } as Prop, 0.12);
  rect(-0.15 + shX, -0.2 + shY, 0.3, 0.55, SHADOW);
  rect(-0.15, -0.2, 0.3, 0.55, BONE);
  rect(-0.1, -0.05, 0.07, 0.07, '#3a3128');
  rect(0.03, -0.05, 0.07, 0.07, '#3a3128');
  rect(-0.08, 0.25, 0.16, 0.08, BONE_DARK);
  // the horns: out and up each side
  for (const side of [-1, 1]) {
    rect(side > 0 ? 0.15 : -0.35, -0.2, 0.2, 0.07, BONE);
    rect(side > 0 ? 0.32 : -0.39, -0.32, 0.07, 0.12, BONE_DARK);
  }
}

/**
 * The LAST GASP gas station under the cars (its local +y away from the road): the shop's flat
 * roof with its plant and a red fascia, two pumps on their islands.
 * @param propCtx the view and painter helpers
 * @param prop the station
 * @param ppm pixels per metre
 */
export function drawGasStation(propCtx: PropCtx, prop: Prop, ppm: number) {
  const ctx = propCtx.view.ctx, rect = (x: number, y: number, wide: number, high: number,
    col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(x * ppm, y * ppm, wide * ppm, high * ppm);
  };
  const [x, y, wide, deep] = GAS_SHOP, [shX, shY] = shadowShift(prop, 1.2);
  rect(x - wide / 2 + shX, y - deep / 2 + shY, wide, deep, SHADOW);
  rect(x - wide / 2, y - deep / 2, wide, deep, '#b9b4a8');
  rect(x - wide / 2, y - deep / 2, wide, 0.6, '#c0392b');
  rect(x - wide * 0.3, y - deep * 0.1, 1.6, 1.2, '#7d7a72');
  rect(x + wide * 0.15, y + deep * 0.05, 1.2, 1.2, '#7d7a72');
  for (const [pumpX, pumpY, pumpW, pumpH] of GAS_PUMPS) {
    rect(pumpX - pumpW / 2 - 0.4, pumpY - pumpH / 2 - 0.5, pumpW + 0.8, pumpH + 1, '#9c9a94');
    rect(pumpX - pumpW / 2, pumpY - pumpH / 2, pumpW, pumpH, '#d8432f');
    rect(pumpX - pumpW / 2 + 0.15, pumpY - pumpH / 2 + 0.2, pumpW - 0.3, 0.4, '#f1e9d8');
  }
}

/**
 * The LAST GASP canopy over the pumps (drawn over the cars): its shadow, the white roof, the red
 * band round it.
 * @param propCtx the view and painter helpers
 * @param prop the canopy
 * @param ppm pixels per metre
 */
export function drawCanopy(propCtx: PropCtx, prop: Prop, ppm: number) {
  const ctx = propCtx.view.ctx, [x, y, wide, deep] = GAS_CANOPY,
    [shX, shY] = shadowShift(prop, 1.6);
  ctx.fillStyle = 'rgba(30,18,10,0.22)';
  ctx.fillRect((x - wide / 2 + shX) * ppm, (y - deep / 2 + shY) * ppm, wide * ppm, deep * ppm);
  ctx.fillStyle = '#f2efe8';
  ctx.fillRect((x - wide / 2) * ppm, (y - deep / 2) * ppm, wide * ppm, deep * ppm);
  ctx.strokeStyle = '#c0392b';
  ctx.lineWidth = Math.max(1, 0.6 * ppm);
  ctx.strokeRect((x - wide / 2 + 0.3) * ppm, (y - deep / 2 + 0.3) * ppm, (wide - 0.6) * ppm,
    (deep - 0.6) * ppm);
}
