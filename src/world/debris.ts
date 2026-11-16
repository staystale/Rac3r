// debris.ts - CRASH DEBRIS (car systems C7; mockup approved). Owner: parts come off
// at ~0.3 damage on a corner, likelier the bigger the hit; the car's own look stays (its dents);
// parts STAY all race, capped, the oldest fading out first; glass sparkles and shifts colour
// gently as the view moves.
// PARTS: a hard hit on a corner may knock off that corner's part - a BUMPER (end-on), a WING
// (a corner hit) or a door PANEL (side-on), once per corner until a repair - in the car's paint
// and trim. damage.ts queues it on the car (car.partSpawn); game/sim.ts throws it out of the
// corner as a loose object (the cones system: cars hit and push it, a debris puncture chance by
// kind, physics/punctures.ts). Past PART_CAP the oldest fades out over FADE_S and goes.
// GLASS: a hard hit on a car with windows may shatter one: a few wear cells round that corner
// take the cover 'glass' (like the oil and the tyres' water - one cover system; drawn by the GPU
// field, render/glfield.ts, glints moving with the view). It changes no grip; the first tyre
// pass sweeps the cell clean and may puncture that tyre slowly (PASS: world/pass.ts).
import { bitsOf, doorAt, doorsOf, hasNo } from '../carbits.ts';
import { FIX } from '../core/fixes.ts';
import { getCell, wearDirty, WEAR_CELL } from "./wear.ts";
import { PASS } from "./pass.ts";
import { DEBRIS } from "../cones/coneConsts.ts";
import { takeFenceShreds } from "./armcodent.ts";
import { deckShiftOf } from "./deckwear.ts";
import type { WearCell } from "./types.ts";
import { halfTrackAt } from './wheels.ts';

// a corner's hit of PART_HIT+ knocks its part off PART_P_MIN of the time, surely at
// PART_HIT + PART_SPAN; an end-on hit (endW over END_ON) is a bumper, side-on (under SIDE_ON) a
// panel, else a wing
const PART_HIT = 0.3, PART_SPAN = 0.4, PART_P_MIN = 0.35, END_ON = 0.65, SIDE_ON = 0.35;
// a BIG_HIT corner (worse than a part's) throws the car's bits by these chances; the
// engine only from ENGINE_HIT
// (both corners of an end are hit: ~2x these a crash - MEASURED _bittest.mjs)
const BIG_HIT = 0.5, ENGINE_HIT = 0.8, BONNET_P = 0.14, EXHAUST_P = 0.17, REAR_P = 0.12;
const MIRROR_P = 0.12, ENGINE_P = 0.04;
// (owner 11-07: "can they have a chance to come off in smaller knocks but keep it low"):
// a corner's hit from SMALL_FROM to PART_HIT knocks its part off at most SMALL_P of the time
const SMALL_FROM = 0.08, SMALL_P = 0.06;
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
  x?: number; y?: number; vx: number; vy: number; heading: number; crossing?: number;
  spec?: { id?: string; kind?: string; paint?: string; trim?: string; lf?: number; lr?: number;
    trackWidth?: number; trackR?: number; drive?: number };
  partSpawn?: { corner: number; kind: string }[];
  partsOff?: number;     // a bit per part gone (until a repair): PART_BIT
  // the parts gone, "kind:corner" each joined by "," (render/carparts.ts draws the car without
  // them)
  partLost?: string;
  glassOut?: number;     // a bit per damage corner whose window is gone (until a repair)
  // ?underskin: per corner, the suspension thrown with its wheel (SUSP_* bits; until a repair)
  suspOff?: number[];
}
/** A loose part on the ground (a cones.ts object). */
interface PartObject { part?: boolean; fade?: number; fading?: boolean }
/** What this file needs of the loose objects (cones.ts). */
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
  bigParts(car, corner, add, endW, rnd);
  windowOut(car, corner, add, rnd);
}

/**
 * A corner's part may come off: queued on the car (game/sim.ts throws it out).
 * @param car the car
 * @param corner the damage corner
 * @param add the damage the hit added to it
 * @param endW how end-on the hit was, 0..1
 * @param rnd the random source
 */
function partOff(car: DebrisCar, corner: number, add: number, endW: number,
    rnd: () => number) {
  // (a smaller knock now and then - SMALL_FROM up, at most SMALL_P just under PART_HIT)
  if (add < SMALL_FROM) return;
  const kind = endW > END_ON ? 'bumper' : endW < SIDE_ON ? 'panel' : 'wing';
  const bit = kind !== 'bumper' ? 1 << corner : corner < 2 ? FRONT_BUMPER : REAR_BUMPER;
  if ((car.partsOff || 0) & bit || hasNoDoor(car, kind, corner)) return;
  const chance = add < PART_HIT ? SMALL_P * (add - SMALL_FROM) / (PART_HIT - SMALL_FROM)
    : Math.min(1, PART_P_MIN + (add - PART_HIT) / PART_SPAN);
  if (rnd() >= chance) return;
  car.partsOff = (car.partsOff || 0) | bit;
  car.partLost = (car.partLost ? car.partLost + ',' : '') + kind + ':' + corner;
  (car.partSpawn || (car.partSpawn = [])).push({ corner, kind });
}

/**
 * ?carparts: a door asked of a corner where the car has none (a 2-door's rear, an open car).
 * @param car the car
 * @param kind the part
 * @param corner the damage corner
 * @returns no door there
 */
const hasNoDoor = (car: DebrisCar, kind: string, corner: number) => FIX.carparts
  && kind === 'panel' && doorAt(car.spec?.id || '', corner) === null;

/**
 * ?carparts: a van's rear doors - a pair, each lost on its own side.
 * @param car the car
 * @param kind the part
 * @returns its boot is a pair
 */
const isTwin = (car: DebrisCar, kind: string) => FIX.carparts && kind === 'boot'
  && !!doorsOf(car.spec?.id || '')?.twinRear;

/**
 * a bad hit may throw the car's own BITS (carbits.ts) - each at most once until a
 * repair: end-on at the front its bonnet (BONNET_P from BIG_HIT), at the back its exhaust
 * (EXHAUST_P) and its boot lid or spoiler (REAR_P), from the side a mirror (MIRROR_P from
 * PART_HIT); the engine only in the very worst, ENGINE_HIT+ at the end it sits (ENGINE_P).
 * @param car the car
 * @param corner the damage corner (0, 1 front)
 * @param add the damage the hit added to it
 * @param endW how end-on the hit was, 0..1
 * @param rnd the random source
 */
function bigParts(car: DebrisCar, corner: number, add: number, endW: number,
    rnd: () => number) {
  if (add < PART_HIT) return;
  const bits = bitsOf(car.spec?.id || ''), front = corner < 2;
  const has = (kind: string) => (car.partLost || '').split(',').some((entry) =>
    entry.startsWith(kind));
  const off = (kind: string, chance: number) => {
    if (hasNo(bits, kind) || has(kind === 'mirror' || isTwin(car, kind) ? kind + ':' + corner
      : kind) || rnd() >= chance) return;
    car.partLost = (car.partLost ? car.partLost + ',' : '') + kind + ':' + corner;
    (car.partSpawn || (car.partSpawn = [])).push({ corner, kind });
  };
  if (endW < SIDE_ON && front) off('mirror', MIRROR_P);
  if (endW <= END_ON || add < BIG_HIT) return;
  if (front && bits.front === 'bonnet') off('bonnet', BONNET_P);
  if (!front) off('exhaust', EXHAUST_P);
  if (!front && bits.rear !== 'none') off(bits.rear, REAR_P);
  if (add >= ENGINE_HIT && front === (bits.engine === 'front')) off('engine', ENGINE_P);
}

/**
 * one part off by a roll's impact, if still on (a bumper / wing / door by its bit, the
 * rest by its name - a mirror by its side).
 * @param car the car
 * @param kind the part
 * @param corner its corner
 * @param chance the chance
 */
function shedOnRoll(car: DebrisCar, kind: string, corner: number, chance: number): void {
  const own = ['bumper', 'wing', 'panel'].includes(kind);
  const bit = !own ? 0 : kind !== 'bumper' ? 1 << corner : corner < 2 ? FRONT_BUMPER : REAR_BUMPER;
  const name = kind === 'mirror' || isTwin(car, kind) ? kind + ':' + corner : kind;
  const gone = own ? ((car.partsOff || 0) & bit) !== 0
    : (car.partLost || '').split(',').some((entry) => entry.startsWith(name));
  if (gone || Math.random() >= chance) return;
  if (own) car.partsOff = (car.partsOff || 0) | bit;
  car.partLost = (car.partLost ? car.partLost + ',' : '') + kind + ':' + corner;
  (car.partSpawn || (car.partSpawn = [])).push({ corner, kind });
}

/**
 * a closed car ON ITS ROOF: its boot lid or spoiler (a van's two rear doors), the mirrors, the
 * bonnet, the exhaust.
 * @param car the car
 * @param shed sheds a part by its chance
 */
function roofParts(car: DebrisCar, shed: (part: string, corner: number, chance: number) => void) {
  const bits = bitsOf(car.spec?.id || '');
  if (bits.rear !== 'none') shed(bits.rear, 2, 0.5);
  if (isTwin(car, bits.rear)) shed(bits.rear, 3, 0.5);
  shed('mirror', 0, 0.5); shed('mirror', 1, 0.5);
  if (bits.front === 'bonnet') shed('bonnet', 0, 0.3);
  shed('exhaust', 2, 0.2);
}

/**
 * an OPEN car rolling breaks up (owner 11-08: "f1 like cars should absolutely shed parts and break
 * if rolling"): its wings (its 'bumpers', render/carparts.ts) and sidepods ('panels') - its wheels
 * too (physics/openwheel.ts rollRipWheels).
 * @param shed sheds a part by its chance
 * @param kind 'side', 'roof' or 'wheels'
 * @param front the front corner on the side it hit
 * @param rear the rear corner
 */
function openRollParts(shed: (part: string, corner: number, chance: number) => void, kind: string,
  front: number, rear: number) {
  if (kind === 'side') {
    shed('panel', front, 0.6); shed('panel', rear, 0.5); shed('bumper', 0, 0.35);
  } else if (kind === 'roof') {
    shed('bumper', 2, 0.7); shed('bumper', 0, 0.6);
  } else {
    shed('bumper', 0, 0.4); shed('bumper', 2, 0.3);
  }
}

/**
 * a ROLL is a hectic crash (owner 11-07: "maybe rolling increases the chance for all
 * parts") - each time the body meets the ground (damage.ts hitRoll) it may shed what that face
 * carries, the car's own bits (carbits.ts): ON A SIDE that side's mirror, door and wings, the
 * spoiler; ON THE ROOF the spoiler / boot lid, the mirrors, the bonnet, the exhaust; BACK ON ITS
 * WHEELS the bumpers, the exhaust, rarely the engine. The harder the impact the likelier (scale).
 * @param car the car
 * @param kind 'side', 'roof' or 'wheels'
 * @param side +1 = +y, -1 = -y (a side impact)
 * @param scale the impact's share, 0..1
 */
export function rollParts(car: DebrisCar, kind: string, side: number, scale: number): void {
  const bits = bitsOf(car.spec?.id || ''), front = side > 0 ? 1 : 0, rear = side > 0 ? 3 : 2;
  const shed = (part: string, corner: number, chance: number) => {
    if (!hasNo(bits, part) && !hasNoDoor(car, part, corner))
      shedOnRoll(car, part, corner, chance * scale);
  };
  if (car.spec?.kind === 'track' || car.spec?.kind === 'grass') {
    openRollParts(shed, kind, front, rear);
    return;
  }
  if (kind === 'side') {
    // (owner 11-08: "cars should maybe have a high damage from rolling and then also shed more
    // parts / have a higher chance" - about twice the chances of 11-07)
    shed('mirror', front, 0.6); shed('panel', front, 0.45); shed('panel', rear, 0.4);
    shed('wing', front, 0.4); shed('wing', rear, 0.4);
    if (bits.rear === 'spoiler') shed('spoiler', 2, 0.3);
  } else if (kind === 'roof') roofParts(car, shed);
  else {
    shed('bumper', 0, 0.3); shed('bumper', 2, 0.3); shed('exhaust', 2, 0.3);
    shed('engine', bits.engine === 'front' ? 0 : 2, 0.05);
  }
}

// ?underskin (owner 11-16: "they should all emit true to the amount knocked off the car"): a
// wheel torn off ALWAYS takes its hub, and its suspension by how hard the hit was - no dice. Each
// piece thrown is gone from the car (SUSP_* bits in car.suspOff, render/cars.ts draws what stays,
// snapped); a driven wheel always takes its drive shaft's outer end.
export const SUSP_STRUT = 1, SUSP_WISHBONE = 2, SUSP_SHAFT = 4;
// the tearing hit's size, 0..1 (damage.ts: (add - WHEEL_HIT) / WHEEL_HIT), from which it takes the
// STRUT, and from which the WISHBONE too (a closed car); an open car always its wishbone, from
// OPEN_SECOND a second
const STRUT_FROM = 0.3, WISHBONE_FROM = 0.65, OPEN_SECOND = 0.5;

/**
 * a wheel torn off takes its suspension with it - an open car's WISHBONES, a closed car's STRUT
 * and maybe its lower arm, a driven wheel maybe its DRIVE SHAFT (damage.ts, physics/openwheel.ts).
 * With ?underskin it is decided by the hit's size and recorded (car.suspOff), never rolled.
 * @param car the car
 * @param corner the wheel's corner
 * @param rnd the random source
 * @param size the tearing hit's size, 0..1 (?underskin)
 */
export function wheelBits(car: Pick<DebrisCar, 'spec' | 'partSpawn' | 'suspOff'>, corner: number,
  rnd: () => number, size = 0.5): void {
  const open = car.spec?.kind === 'track' || car.spec?.kind === 'grass';
  const spawn = (kind: string) => (car.partSpawn || (car.partSpawn = [])).push({ corner, kind });
  // a DRIVEN wheel's drive shaft may come with it (owner 11-07: "can drive shafts also be an
  // object that can come out")
  const driven = isDrivenCorner(car.spec?.drive, corner);
  if (FIX.underskin) { suspensionOff(car, corner, { open, driven, size }, spawn); return; }
  if (driven && rnd() < 0.5) spawn('shaft');
  if (open) { if (rnd() < 0.6) spawn('wishbone'); if (rnd() < 0.25) spawn('wishbone'); return; }
  if (rnd() < 0.4) spawn('strut');
  if (rnd() < 0.25) spawn('wishbone');
}

// ?underskin (owner 11-16: "if the car crumples so much the engine is exposed and the bumpers are
// pushed past it the engine should eject"): an end crushed this deep (its corners' mean end
// crush, 0..1) has reached its engine - the bumper pushed back past the engine's front - and
// throws it, no dice. Measured on the drawing (render/cardamage.ts endCrushPx, 0.26 of the length
// at 1): a front engine's front sits ~0.12 of the length in from the nose, so ~0.5; a rear
// engine's back ~0.1 in from the tail (0.22 a length at 1), ~0.45; a mid engine, behind the cabin,
// ~0.8 at the rear
const ENGINE_REACHED: Record<string, number> = { front: 0.5, rear: 0.45, mid: 0.8 };

/**
 * ?underskin: an end crushed past its engine throws the engine (once, until a repair).
 * @param car the car
 * @param crushEnds each corner's end crush, 0..1 (damage.ts crushL)
 */
export function crushedEngine(car: DebrisCar, crushEnds: number[]): void {
  if (!FIX.underskin) return;
  const bits = bitsOf(car.spec?.id || ''), where = bits.engine;
  if (hasNo(bits, 'engine') || (car.partLost || '').includes('engine')) return;
  const front = where === 'front', reach = ENGINE_REACHED[where] ?? 1;
  const crush = front ? (crushEnds[0] + crushEnds[1]) / 2 : (crushEnds[2] + crushEnds[3]) / 2;
  if (crush < reach) return;
  const corner = front ? 0 : 2;
  car.partLost = (car.partLost ? car.partLost + ',' : '') + 'engine:' + corner;
  (car.partSpawn || (car.partSpawn = [])).push({ corner, kind: 'engine' });
}

/**
 * Whether a corner's wheel is driven.
 * @param drive the car's drive split (0 rear .. 1 front; none = rear)
 * @param corner the damage corner (0, 1 front)
 * @returns driven
 */
function isDrivenCorner(drive = 0, corner: number): boolean {
  return corner < 2 ? drive > 0 : drive < 1;
}

/**
 * ?underskin: what a torn-off wheel takes, by the hit's size (no dice), each piece recorded as gone
 * from the car (car.suspOff, SUSP_* bits) and thrown.
 * @param car the car
 * @param corner the wheel's corner
 * @param wheel an open car's, a driven wheel, the tearing hit's size 0..1
 * @param spawn throws a part of that kind
 */
function suspensionOff(car: Pick<DebrisCar, 'suspOff'>, corner: number,
  wheel: { open: boolean; driven: boolean; size: number }, spawn: (kind: string) => void) {
  const gone = (bit: number, kind: string) => {
    spawn(kind);
    const off = car.suspOff || (car.suspOff = [0, 0, 0, 0]);
    off[corner] |= bit;
  };
  if (wheel.driven) gone(SUSP_SHAFT, 'shaft');
  if (wheel.open) {
    gone(SUSP_WISHBONE, 'wishbone');
    if (wheel.size >= OPEN_SECOND) spawn('wishbone');
    return;
  }
  if (wheel.size >= STRUT_FROM) gone(SUSP_STRUT, 'strut');
  if (wheel.size >= WISHBONE_FROM) gone(SUSP_WISHBONE, 'wishbone');
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
  const side = corner % 2 ? 1 : -1, across = side * halfTrackAt(spec, corner >= 2);
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
  // (a car with more glass - the bus's two decks - throws more of it, further: its cells by its
  // glass, its reach by the root of it, the same glass to the square metre)
  const glass = (FIX.carparts && doorsOf(car.spec?.id || '')?.glass)
    || bitsOf(car.spec?.id || '').glass || 1, reach = GLASS_REACH_M * Math.sqrt(glass);
  const count = Math.round((GLASS_CELLS_MIN + Math.floor(rnd() * (GLASS_CELLS_MORE + 1))) * glass);
  for (let i = 0; i < count; i++) {
    const ahead = rnd() * reach, spread = (rnd() - 0.5) * reach;
    // (on a bridge or in a tunnel, its own ground: world/deckwear.ts)
    glassCell(spot.x + deckShiftOf(car) + aimX * ahead - aimY * spread,
      spot.y + aimY * ahead + aimX * spread);
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
 * What a thrown part looks like: its car and which part - render/carparts.ts cuts it from that
 * car's own sprite (owner 11-07: "make sure any emitted bumper or wheel is correct"; "the
 * emitted part ... doesn't match what's on the car"). Drawing only: the part's mass and size in
 * the sim are its kind's.
 * @param car the car
 * @param corner the damage corner (0, 1 front)
 * @param kind the part (bumper / wing / panel)
 * @returns the look fields, or none
 */
function partLook(car: DebrisCar, corner: number, kind: string) {
  return car.spec ? { carSpec: car.spec, cutKind: kind, cutCorner: corner } : {};
}

// the chance a car meeting a thrown part DRIVES OVER it (dragging it a little) rather than into
// it, rolled afresh each time a car meets it (cones/coneCar.ts; owner 11-08: "a chance of being
// driven into / driven over ... not a guarantee either way"), for the hatch's ground clearance (a
// lower car hits more, a higher one clears more: cones/coneCar.ts rollsOver), by kind: a scrap
// of mesh always, a mirror mostly, a panel / door, wing, bumper or wishbone more often than not,
// a bonnet, boot lid, spoiler, exhaust, strut or shaft half the time, a fence post less; an
// engine block (and a wheel, thrown as a tyre) never
const DRIVE_OVER_CHANCE: Record<string, number> = { mesh: 1, mirror: 0.7, panel: 0.6, wing: 0.6,
  bumper: 0.6, wishbone: 0.6, bonnet: 0.5, boot: 0.5, spoiler: 0.5, exhaust: 0.5, strut: 0.5,
  shaft: 0.5, fencepost: 0.4, engine: 0 };

/**
 * The parts the cars in play knocked off this step are thrown out of their corners as loose
 * objects (game/sim.ts, after the wheels torn off).
 * @param cars the cars in play
 * @param loose the loose objects (cones.ts)
 */
export function throwParts(cars: DebrisCar[], loose: LooseObjects): void {
  if (partsList !== loose.list) {
    parts = loose.list.filter((obj) => obj.part);
    partsList = loose.list;
  }
  // a torn catch fence's shreds (world/armcodent.ts)
  for (const bit of takeFenceShreds()) {
    const table = DEBRIS[bit.kind as keyof typeof DEBRIS];
    loose.add({ ...bit, mode: bit.kind, part: true, mass: table.mass, r: table.r, fade: 1,
      overChance: DRIVE_OVER_CHANCE[bit.kind] ?? 0 });
    parts.push(loose.list[loose.list.length - 1]);
  }
  for (const car of cars) {
    while (car.partSpawn && car.partSpawn.length) {
      const { corner, kind } = car.partSpawn.shift()!;
      const spot = cornerAt(car, corner), table = DEBRIS[kind as keyof typeof DEBRIS];
      const outX = -Math.sin(car.heading) * spot.side * THROW_OUT;
      const outY = Math.cos(car.heading) * spot.side * THROW_OUT;
      loose.add({ kind, mode: kind, part: true, mass: table.mass, r: table.r, x: spot.x,
        y: spot.y, overChance: DRIVE_OVER_CHANCE[kind] ?? 0,
        vx: car.vx * KEEP_SPEED + outX, vy: car.vy * KEEP_SPEED + outY, ang: car.heading,
        spin: (Math.random() - 0.5) * 8, col: car.spec?.paint, trim: car.spec?.trim, fade: 1,
        ...partLook(car, corner, kind) });
      parts.push(loose.list[loose.list.length - 1]);
    }
  }
  for (let i = 0; i < parts.length - PART_CAP; i++) parts[i].fading = true;
}

/**
 * The fading parts fade a step; the faded ones leave the loose objects (game/sim.ts).
 * @param loose the loose objects (cones.ts)
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
