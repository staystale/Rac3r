// debris.ts - CRASH DEBRIS (car systems C7; mockup approved). Owner: parts come off
// at ~0.3 damage on a corner, likelier the bigger the hit; the car's own look stays (its dents);
// parts STAY all race, capped, the oldest fading out first; glass sparkles and shifts colour
// gently as the view moves.
// PARTS: a hard hit on a corner may knock off that corner's part - a BUMPER (end-on), a WING
// (a corner hit) or a door PANEL (side-on), once per corner until a repair - in the car's paint
// and trim. damage.ts queues it on the car (car.partSpawn); game/sim.js throws it out of the
// corner as a loose object (the cones system: cars hit and push it, a debris puncture chance by
// kind, physics/punctures.ts). Past PART_CAP the oldest fades out over FADE_S and goes.
// GLASS: a hard hit on a car with windows may shatter one: a few wear cells round that corner
// take the cover 'glass' (like the oil and the tyres' water - one cover system; drawn by the GPU
// field, render/glfield.ts, glints moving with the view). It changes no grip; the first tyre
// pass sweeps the cell clean and may puncture that tyre slowly (PASS: world/pass.ts).
import { getCell, wearDirty, WEAR_CELL } from "./wear.ts";
import { PASS } from "./pass.ts";
import { DEBRIS } from "../cones/coneConsts.js";
import type { WearCell } from "./types.ts";

// a corner's hit of PART_HIT+ knocks its part off PART_P_MIN of the time, surely at
// PART_HIT + PART_SPAN; an end-on hit (endW over END_ON) is a bumper, side-on (under SIDE_ON) a
// panel, else a wing
const PART_HIT = 0.3, PART_SPAN = 0.4, PART_P_MIN = 0.35, END_ON = 0.65, SIDE_ON = 0.35;
// parts on the ground before the oldest fades; how long a fade takes, s
const PART_CAP = 24, FADE_S = 2.5;
// a car's parts as bits: a wing or panel per damage corner (1 << corner), and ONE bumper an end
// (a front hit reaches both front corners: one bumper, not two)
const FRONT_BUMPER = 1 << 4, REAR_BUMPER = 1 << 5;
// m/s a part is thrown out sideways from its corner; share of the car's speed it keeps
const THROW_OUT = 3, KEEP_SPEED = 0.7;
// a corner's hit of GLASS_HIT+ shatters a window GLASS_P_MIN of the time (more the harder):
// GLASS_CELLS_MIN .. + GLASS_CELLS_MORE cells within GLASS_REACH_M ahead of that corner
const GLASS_HIT = 0.15, GLASS_SPAN = 0.4, GLASS_P_MIN = 0.4;
const GLASS_CELLS_MIN = 3, GLASS_CELLS_MORE = 4, GLASS_REACH_M = 2.5;
// the chance the tyre that sweeps a glass cell is punctured (slowly) - higher than litter's 8 %
const GLASS_PUNCTURE = 0.12;
// a glass puncture is a sudden POP (a burst) GLASS_POP of the time, else the slow leak (owner)
const GLASS_POP = 0.15;
// car kinds with no glass to break: the open-wheel track car, the stripped banger and grass car
const NO_GLASS = new Set(['track', 'banger', 'grass']);

/** A car as the debris reads it. */
export interface DebrisCar {
  x?: number; y?: number; vx: number; vy: number; heading: number;
  spec?: { kind?: string; paint?: string; trim?: string; lf?: number; lr?: number;
    trackWidth?: number };
  partSpawn?: { corner: number; kind: string }[];
  partsOff?: number;     // a bit per part gone (until a repair): PART_BIT
  glassOut?: number;     // a bit per damage corner whose window is gone (until a repair)
}
/** A loose part on the ground (a cones.js object). */
interface PartObject { part?: boolean; fade?: number; fading?: boolean }
/** What this file needs of the loose objects (cones.js). */
interface LooseObjects {
  list: PartObject[];
  add(extra: object): void;
  cull(keep: (obj: PartObject) => boolean): number;
}

// the parts on the ground, oldest first, and the list they were added to (a reset replaces it)
let parts: PartObject[] = [];
let partsList: unknown = null;


/**
 * A hard hit's share on one corner (damage.ts hardHitCorners): maybe a part off, maybe a window.
 * @param car the car
 * @param corner the damage corner, 0..3
 * @param add the damage the hit added to it
 * @param endW how end-on the hit was, 0..1
 * @param rnd the random source
 */
export function crashDebris(car: DebrisCar, corner: number, add: number, endW: number,
    rnd: () => number): void {
  partOff(car, corner, add, endW, rnd);
  windowOut(car, corner, add, rnd);
}

/**
 * A corner's part may come off: queued on the car (game/sim.js throws it out).
 * @param car the car
 * @param corner the damage corner
 * @param add the damage the hit added to it
 * @param endW how end-on the hit was, 0..1
 * @param rnd the random source
 */
function partOff(car: DebrisCar, corner: number, add: number, endW: number,
    rnd: () => number) {
  if (add < PART_HIT) return;
  const kind = endW > END_ON ? 'bumper' : endW < SIDE_ON ? 'panel' : 'wing';
  const bit = kind !== 'bumper' ? 1 << corner : corner < 2 ? FRONT_BUMPER : REAR_BUMPER;
  if ((car.partsOff || 0) & bit) return;
  if (rnd() >= Math.min(1, PART_P_MIN + (add - PART_HIT) / PART_SPAN)) return;
  car.partsOff = (car.partsOff || 0) | bit;
  (car.partSpawn || (car.partSpawn = [])).push({ corner, kind });
}

/**
 * A corner's window may break: glass on the road round it.
 * @param car the car
 * @param corner the damage corner
 * @param add the damage the hit added to it
 * @param rnd the random source
 */
function windowOut(car: DebrisCar, corner: number, add: number, rnd: () => number) {
  const bit = 1 << corner;
  if (add < GLASS_HIT || (car.glassOut || 0) & bit || NO_GLASS.has(car.spec?.kind || '')) return;
  if (rnd() >= Math.min(1, GLASS_P_MIN + (add - GLASS_HIT) / GLASS_SPAN)) return;
  car.glassOut = (car.glassOut || 0) | bit;
  shatterGlass(car, corner, rnd);
}

/**
 * Where a damage corner of the car is now, m.
 * @param car the car
 * @param corner the damage corner (0 front -y, 1 front +y, 2 rear -y, 3 rear +y)
 * @returns world x, y and the side (+1 / -1)
 */
function cornerAt(car: DebrisCar, corner: number): { x: number; y: number; side: number } {
  const spec = car.spec || {}, cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
  const along = corner < 2 ? spec.lf ?? 1.2 : -(spec.lr ?? 1.2);
  const side = corner % 2 ? 1 : -1, across = side * (spec.trackWidth || 1.5) / 2;
  return { x: (car.x || 0) + cosH * along - sinH * across,
    y: (car.y || 0) + sinH * along + cosH * across, side };
}

/**
 * A window breaks: glass on a few wear cells round that corner, thrown the way the car went.
 * @param car the car
 * @param corner the damage corner
 * @param rnd the random source
 */
function shatterGlass(car: DebrisCar, corner: number, rnd: () => number) {
  const spot = cornerAt(car, corner);
  const speed = Math.hypot(car.vx, car.vy);
  const aimX = speed > 1 ? car.vx / speed : Math.cos(car.heading);
  const aimY = speed > 1 ? car.vy / speed : Math.sin(car.heading);
  const count = GLASS_CELLS_MIN + Math.floor(rnd() * (GLASS_CELLS_MORE + 1));
  for (let i = 0; i < count; i++) {
    const ahead = rnd() * GLASS_REACH_M, spread = (rnd() - 0.5) * GLASS_REACH_M;
    glassCell(spot.x + aimX * ahead - aimY * spread, spot.y + aimY * ahead + aimX * spread);
  }
}

/**
 * Glass lands at a point: bare ground in that wear cell takes it (covered ground keeps its cover).
 * @param x world x, m
 * @param y world y, m
 */
function glassCell(x: number, y: number) {
  const cell = getCell(Math.floor(x / WEAR_CELL), Math.floor(y / WEAR_CELL), true);
  if (!cell || cell.fixed || cell.cover) return;
  cell.cover = 'glass';
  cell.standing = false;
  cell.current = 'glass';
  wearDirty.push(cell);
}

/**
 * A tyre's pass over glass (wear.ts passCell): it sweeps the cell clean and may puncture.
 * @param cell the glass cell
 */
export function passGlassCell(cell: WearCell): void {
  cell.cover = null;
  cell.current = cell.base;
  wearDirty.push(cell);
  const car = PASS.car;
  if (car && PASS.tyre >= 0 && !((car.burstTyre ?? -1) >= 0) && Math.random() < GLASS_PUNCTURE) {
    car.burstTyre = PASS.tyre;
    car.burstSlow = Math.random() >= GLASS_POP;
  }
}

/**
 * The parts the cars in play knocked off this step are thrown out of their corners as loose
 * objects (game/sim.js, after the wheels torn off).
 * @param cars the cars in play
 * @param loose the loose objects (cones.js)
 */
export function throwParts(cars: DebrisCar[], loose: LooseObjects): void {
  if (partsList !== loose.list) {
    parts = loose.list.filter((obj) => obj.part);
    partsList = loose.list;
  }
  for (const car of cars) {
    while (car.partSpawn && car.partSpawn.length) {
      const { corner, kind } = car.partSpawn.shift()!;
      const spot = cornerAt(car, corner), table = DEBRIS[kind as keyof typeof DEBRIS];
      const outX = -Math.sin(car.heading) * spot.side * THROW_OUT;
      const outY = Math.cos(car.heading) * spot.side * THROW_OUT;
      loose.add({ kind, mode: kind, part: true, mass: table.mass, r: table.r, x: spot.x,
        y: spot.y,
        vx: car.vx * KEEP_SPEED + outX, vy: car.vy * KEEP_SPEED + outY, ang: car.heading,
        spin: (Math.random() - 0.5) * 8, col: car.spec?.paint, trim: car.spec?.trim, fade: 1 });
      parts.push(loose.list[loose.list.length - 1]);
    }
  }
  for (let i = 0; i < parts.length - PART_CAP; i++) parts[i].fading = true;
}

/**
 * The fading parts fade a step; the faded ones leave the loose objects (game/sim.js).
 * @param loose the loose objects (cones.js)
 * @param dt the step, s
 */
export function stepParts(loose: LooseObjects, dt: number): void {
  if (!parts.length) return;
  let gone = false;
  for (const obj of parts) {
    if (!obj.fading) continue;
    obj.fade = Math.max(0, (obj.fade ?? 1) - dt / FADE_S);
    if (obj.fade === 0) gone = true;
  }
  if (!gone) return;
  parts = parts.filter((obj) => obj.fade !== 0);
  loose.cull((obj) => !obj.part || obj.fade !== 0);
  partsList = loose.list;
}
