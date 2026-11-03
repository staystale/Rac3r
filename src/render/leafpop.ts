// render/leafpop.ts - LEAVES OUT OF A BUSH (?leafpop; owner 11-03: "bushes should pop in a little
// burst of green leaf like pixels that can be above the car and fall below"; "it should be the
// body of the car not the wheel hitting a bush"). A car's BODY pushing into a standing bush (its
// front corners, nose and flanks in bush ground) throws a burst of square leaf pixels at that spot
// on contact, and more every POP_EVERY m it ploughs on, in that bush's own greens (its clumps,
// lit and base: the tufts' colours). A leaf flies up and out, drawn OVER the
// cars while it is above roof height, then flutters down UNDER them, lies a moment and fades.
// Render only: the sim never reads a leaf; their randomness is the render's own.
import { LEVEL } from '../world/state.ts';
import { groundSurfaceAt } from '../world/wear.ts';
import { BUSH_LOOKS } from './ground/bushes.ts';
import type { Patch } from '../world/types.ts';
import type { PropCtx } from './props/types.ts';

/** One leaf: where (z = height, m), how it moves, its side (m) and colour, its age (s). */
interface Leaf { x: number; y: number; z: number; vx: number; vy: number; vz: number;
  side: number; colour: string; age: number; rest: number; phase: number }

// leaves a pop throws: LEAVES_MIN at a crawl, one more per LEAVES_PER m/s, at most LEAVES_MAX
const LEAVES_MIN = 6, LEAVES_PER = 3, LEAVES_MAX = 14, POOL_MAX = 260;
// m/s up, out (on top of a share of the car's speed), and the size, m
const UP_MIN = 3.0, UP_SPAN = 3.0, OUT_MIN = 2.0, OUT_SPAN = 3.0, CAR_SHARE = 0.3;
const SIDE_MIN = 0.22, SIDE_SPAN = 0.14;
// falling: gravity, the flutter's top speed down, the air's drag (1/s) and the sway (m/s)
const GRAVITY = 9.8, FLUTTER_DOWN = 1.4, DRAG = 1.2, SWAY = 0.9;
// over the cars while higher than this, m (a car's roof)
const OVER_FROM = 1.2;
// on the ground: lies REST_MIN .. + REST_SPAN s, then fades over FADE s
const REST_MIN = 1.2, REST_SPAN = 1.6, FADE = 0.6;
// the drawn side grows a little with height (closer to the camera), per m
const HEIGHT_GROW = 0.12;

/** A body in a bush: where, the car's velocity and speed (m/s), and how big a burst. */
interface Pop { x: number; y: number; vx: number; vy: number; speed: number; first: boolean }
/** A car as the leaves see it. */
export interface LeafCar { x: number; y: number; vx: number; vy: number; heading: number;
  spec: { len: number; wid: number } }

// a pop every POP_EVERY m a body ploughs through a bush; slower than POP_FROM m/s, none; the first
// contact throws FIRST_K times the leaves
const POP_EVERY = 0.9, POP_FROM = 1.5, FIRST_K = 2, POPS_MAX = 48;
// the body's sample points, as shares of (half length, half width): the nose, its corners and
// the flanks' middles
const BODY_POINTS: [number, number][] = [[1, 0], [0.9, 0.9], [0.9, -0.9], [0, 1], [0, -1]];

const pops: Pop[] = [];
const ploughed = new WeakMap<LeafCar, { inBush: boolean; dist: number; x: number; y: number }>();
const leaves: Leaf[] = [];
let lastMs = 0;

/**
 * The bush a point is in (its square), for its greens.
 * @param x world x, m
 * @param y world y, m
 * @returns the bush, or null
 */
function bushAt(x: number, y: number): Patch | null {
  for (const patch of LEVEL._bushes || []) {
    const half = patch.w / 2 + 0.5;
    if (Math.abs(x - patch.x) <= half && Math.abs(y - patch.y) <= half) return patch;
  }
  return null;
}

/**
 * Where a car's body is in a standing bush, if anywhere: the first sample point in bush ground.
 * @param car the car
 * @returns the point, or null
 */
function bodyInBush(car: LeafCar): { x: number; y: number } | null {
  const reach = car.spec.len;
  let near = false;
  for (const patch of LEVEL._bushes || []) {
    if (Math.abs(car.x - patch.x) < patch.w / 2 + reach && Math.abs(car.y - patch.y)
      < patch.w / 2 + reach) { near = true; break; }
  }
  if (!near) return null;
  const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
  const halfL = car.spec.len / 2, halfW = car.spec.wid / 2;
  for (const [along, side] of BODY_POINTS) {
    const x = car.x + cosH * along * halfL - sinH * side * halfW;
    const y = car.y + sinH * along * halfL + cosH * side * halfW;
    if (groundSurfaceAt(x, y).id === 'bush') return { x, y };
  }
  return null;
}

/**
 * Notes the cars' bodies ploughing into bushes this frame: a pop on contact and every POP_EVERY m
 * on (render.ts, each frame, for the player and the AI).
 * @param cars the cars
 */
export function noteBodies(cars: LeafCar[]): void {
  for (const car of cars) {
    const speed = Math.hypot(car.vx, car.vy);
    let track = ploughed.get(car);
    if (!track) ploughed.set(car, (track = { inBush: false, dist: 0, x: car.x, y: car.y }));
    const moved = Math.hypot(car.x - track.x, car.y - track.y);
    track.x = car.x; track.y = car.y;
    const spot = speed >= POP_FROM && moved < 5 ? bodyInBush(car) : null;
    if (!spot) { track.inBush = false; continue; }
    track.dist += moved;
    if (track.inBush && track.dist < POP_EVERY) continue;
    if (pops.length < POPS_MAX) pops.push({ ...spot, vx: car.vx, vy: car.vy, speed,
      first: !track.inBush });
    track.inBush = true; track.dist = 0;
  }
}

/** Turns the waiting pops into leaves. */
function burst(): void {
  for (const pop of pops) {
    const patch = bushAt(pop.x, pop.y);
    const look = BUSH_LOOKS[(patch && patch.art) || 'bush'] || BUSH_LOOKS.bush;
    // the lit green twice: leaves turning in the air catch the light, and read against the bush
    const colours = [look.lit, look.clumps, look.lit, look.base];
    const count = Math.round(Math.min(LEAVES_MAX, LEAVES_MIN + Math.floor(pop.speed / LEAVES_PER))
      * (pop.first ? FIRST_K : 1));
    for (let i = 0; i < count; i++) {
      if (leaves.length >= POOL_MAX) leaves.shift();
      const angle = Math.random() * Math.PI * 2, out = OUT_MIN + Math.random() * OUT_SPAN;
      leaves.push({
        x: pop.x + (Math.random() - 0.5) * 0.6, y: pop.y + (Math.random() - 0.5) * 0.6, z: 0.3,
        vx: pop.vx * CAR_SHARE + Math.cos(angle) * out,
        vy: pop.vy * CAR_SHARE + Math.sin(angle) * out,
        vz: UP_MIN + Math.random() * UP_SPAN,
        side: SIDE_MIN + Math.random() * SIDE_SPAN, colour: colours[i % colours.length],
        age: 0, rest: REST_MIN + Math.random() * REST_SPAN, phase: Math.random() * 6.28,
      });
    }
  }
  pops.length = 0;
}

/**
 * Moves every leaf one frame: up, then fluttering down with a sway; on the ground it lies.
 * @param dt the frame, s
 */
function step(dt: number): void {
  for (let i = leaves.length - 1; i >= 0; i--) {
    const leaf = leaves[i];
    leaf.age += dt;
    if (leaf.z > 0) {
      leaf.vz = Math.max(-FLUTTER_DOWN, leaf.vz - GRAVITY * dt);
      const drag = Math.exp(-DRAG * dt), sway = leaf.vz < 0 ? Math.sin(leaf.age * 7 + leaf.phase)
        * SWAY : 0;
      leaf.vx = leaf.vx * drag;
      leaf.vy = leaf.vy * drag;
      leaf.x += (leaf.vx + sway) * dt;
      leaf.y += (leaf.vy + sway * 0.6) * dt;
      leaf.z += leaf.vz * dt;
      if (leaf.z <= 0) { leaf.z = 0; leaf.age = 0; }
    } else if (leaf.age > leaf.rest + FADE) leaves.splice(i, 1);
  }
}

/**
 * Draws the leaves of one layer: under the cars (low and landed ones; this pass also moves them)
 * or over them (the ones above roof height).
 * @param propCtx the view and camera helpers
 * @param ppm px a metre
 * @param over true for the pass above the cars
 */
export function drawLeaves(propCtx: PropCtx, ppm: number, over: boolean): void {
  if (!over) {
    const now = performance.now(), dt = lastMs ? Math.min(0.1, (now - lastMs) / 1000) : 0;
    lastMs = now;
    if (pops.length) burst();
    step(dt);
  }
  if (!leaves.length) return;
  const { view, toScreenX, toScreenY } = propCtx, ctx = view.ctx;
  for (const leaf of leaves) {
    if ((leaf.z >= OVER_FROM) !== over) continue;
    const fade = leaf.z > 0 ? 1 : Math.max(0, Math.min(1, 1 - (leaf.age - leaf.rest) / FADE));
    if (fade <= 0) continue;
    const side = leaf.side * (1 + leaf.z * HEIGHT_GROW) * ppm;
    ctx.globalAlpha = fade;
    ctx.fillStyle = leaf.colour;
    ctx.fillRect(toScreenX(leaf.x) - side / 2, toScreenY(leaf.y) - side / 2,
      Math.max(1, side), Math.max(1, side));
  }
  ctx.globalAlpha = 1;
}


/** The leaves in the air or lying now (tools). @returns the count */
export const leafCount = (): number => leaves.length;
