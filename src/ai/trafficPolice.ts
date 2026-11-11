// ai/trafficPolice.ts - POLICE ON THE HIGHWAYS (?police=1; TODO.md ROUND 4, the design agreed
// 11-11): a police car is a traffic car (a TrafficCar slot) in a UK police livery - the Battenberg
// check, a roof number (render/carsprite.ts paintPolice) - with a blue roof light bar (render/
// lightbar.ts). Now and then a car put back is one (ai/trafficKinds.ts),
// either way - oftener while police are DUE (you went over 70 mph or set off a speed camera within
// the last DUE_M of road: ai/policeHeat.ts) - and every PLACE_EVERY_M you drive there is a chance
// of one of our way placed ahead, out of sight. Of our way's put back ahead WAIT_SHARE wait at the
// roadside - beside a petrol station's canopy (a lay-by's, a services', Deaf Valley's), in a
// lay-by, else on the hard shoulder or the verge (ai/trafficBreak.ts stopOffAt) - until you pass.
// With the heat on (ai/policeHeat.ts: every driver's own, 1-3 stars) they CHASE - each star any
// driver gains sends one, up to MAX_CHASERS in all: one of our way's in sight of an offender joins,
// else one is sent from behind you, out of sight (one lost is not replaced until the next star).
// Each chaser goes after the CLOSEST driver with heat (owner 11-11: "pursue the closest law
// breaker"), picked again every RETARGET_S - a new one only when it is clearly closer. A chaser
// has the racing AI at its wheel (ai/circuit.ts, as a speeder's: ai/trafficSpeeder.ts seatRacer)
// with its target as its target - it does not dodge it, and within RAM_M it steers at it (each its
// own seat: its middle, its left side, its right side) closing faster at each of its stars; a
// stopped car it creeps into, boxing it in. A police car too damaged to drive is gone VANISH_S
// later.
import { tooInjured } from '../damage.ts';
import { makeCar, reset } from '../vehicle.ts';
import { ROSTER } from '../cars.ts';
import { roadFrame, roadPose, roadSpan } from '../highway.ts';
import { bayHere } from '../highway/laybys.ts';
import { rolling } from '../roll.ts';
import { sameLevel } from '../world/crossinggeo.ts';
import { steerCap, steerDemand } from './steerLaw.ts';
import { PAINTS, geo } from './trafficCtx.ts';
import type { TrafficCtx, VisFn } from './trafficCtx.ts';
import type { DriveEnv } from './trafficLane.ts';
import { cruise, fresh, pick, rebuildCars, roomAt, setSpeed, spot } from './trafficSpawn.ts';
import { PARKED, roadsideFree, stopOffAt } from './trafficBreak.ts';
import { drivePhysics } from './trafficPhys.ts';
import { seatRacer } from './trafficSpeeder.ts';
import type { AiCar, DriveInput, TrafficCar, TrafficEnt, TrafficVehicle } from './types.ts';
import { boxGap } from './policeHeat.ts';
import type { Heat, Suspect } from './policeHeat.ts';

// the share of the cars put back that are police, and the share while police are due (MEASURED,
// tools/scratch/_police.mjs survey: at 1 / 30 an oncoming police car every 0.3-0.8 km - you sped
// past one every minute)
const POLICE_SHARE = 1 / 60, DUE_SHARE = 1 / 15;
// m of road you drive between two chances of a police car of our way placed ahead, the chance
// each time and while police are due, and m ahead it is placed (out of sight)
const PLACE_EVERY_M = 400, PLACE_CHANCE = 0.35, DUE_PLACE_CHANCE = 0.7;
const PLACE_AHEAD_M = [260, 420];
// of our way's police put back ahead, the share waiting at the roadside
const WAIT_SHARE = 0.5;
// the cars the police drive (UK motorway police: a BMW 3 Series, a Volvo V70 - their parodies),
// and their paint (a PAINTS row: white)
const POLICE_CARS: [string, number][] = [['saloon-rwd', 1], ['estate-4x4', 1]];
const POLICE_PAINT = 1;
// the roof numbers a police car carries (render/carsprite.ts paints them; one sprite each, so a
// short list)
const ROOF_NUMBERS = [12, 17, 23, 31, 38, 44, 52, 67];
// m ahead of where it is put back a waiting car looks for its place, every WAIT_STEP_M; m behind
// it a station may be
const WAIT_LOOK_M = 160, WAIT_STEP_M = 8, WAIT_BACK_M = 20;
// a forecourt's waiting place from the station's middle (world/desertjunk.ts: the canopy 16 x 8 m
// round its middle, its posts 6.5 m either side): m up the road, past the canopy, and m toward
// the road
const FORECOURT_AHEAD_M = 11, FORECOURT_IN_M = 1;
// s a wrecked police car stays before it is gone
const VANISH_S = 2;
// a chaser's driver: its difficulty (Pro: it rarely makes a mistake) and aggression
const CHASE_DIFF = 3, CHASE_AGG = 1;
// km/h a chaser drives at the most, by the stars (1-3) - a car faster than that gets away - and
// m/s faster than you it closes up at
const CHASE_KMH = [170, 200, 230], CATCH_MS = 12;
// a chaser ahead of you holds this share of your speed (you come up to it)
const AHEAD_SHARE = 0.8;
// m from its aim inside which a chaser steers at you; s of your speed it aims ahead; m beside your
// middle a second and a third chaser aim (your left, your right: into your side)
const RAM_M = 30, LEAD_S = 0.35, SEAT_SIDE_M = 1.2;
// m either side of the line to its aim another car must be clear of for a chaser to ram (a car
// and a half wide)
const LANE_CLEAR_M = 2;
// rad off its nose past which you are not ahead of it (it races on)
const AIM_MAX_RAD = 1.2;
// m/s faster than you it rams at, by the stars; within BOX_M of a car under BOX_MS it creeps in at
// CREEP_MS until within TOUCH_GAP_M, then stops there (boxed in: MEASURED, _police.mjs, rammed on
// at 10 m/s over you it shoved a stopped car 40 s down the road at up to 49 km/h); STILL_MS: you
// are stopped
const RAM_CLOSE_MS = [3, 6, 10], BOX_M = 6, BOX_MS = 6, TOUCH_GAP_M = 0.4, CREEP_MS = 1;
// the share of its target's speed a chaser touching it holds (it backs off from the hit)
const TOUCH_SHARE = 0.9;
const STILL_MS = 2;
// s you must have been stopped before a chaser ahead of you, out of sight, is sent round behind
const STILL_RESEND_S = 2;
// m: a police car of our way within this of you joins a chase (it sees you: ai/policeHeat.ts
// SIGHT_M); one sent comes from this far behind you (out of sight on screen)
const JOIN_M = 200;
// s between two tries to send a chaser; the most chasers at once
const SEND_GAP_S = 1, MAX_CHASERS = 3;
// s between a chaser's looks for the closest driver with heat, and the share of the distance to
// its own a new one must be inside to take it (no flicking between two)
const RETARGET_S = 2, RETARGET_SHARE = 0.75;
// m along the road from you inside which a police car out of its lane (waiting, chasing) is a
// real physics car, seen or not (carried, it would be put onto its lane line)
export const POLICE_PHYS_M = 150;

/** What a police car is doing: cruising with the traffic, waiting at the roadside, chasing. */
export type PoliceMode = 'cruise' | 'wait' | 'chase';

/**
 * A police car's state: its mode, its seat in a chase (0-2), s it has been wrecked, the driver it
 * is after, s until it looks again for the closest and s it has waited ahead of it stopped.
 */
export interface TrafficPolice { mode: PoliceMode; seat: number; wreckT: number;
  target?: (AiCar & { crossing?: number }) | null; targetT?: number; waitT?: number;
  // ?roadrage=1: an angry driver chasing as police do, no lights, and s until it calms down
  angry?: boolean; angryT?: number }

/**
 * What the heat (ai/policeHeat.ts) tells the police, and their counts: every driver's stars in all
 * (capped), the road distance (m) until which police are due, the chasers still to send and when
 * the next try is (s); every driver's heat and those with stars (the suspects); s you have been
 * still; counts for the tools.
 */
export interface PoliceOrders {
  stars: number; dueUntil: number; owed: number;
  sendT: number; heats: Map<object, Heat>; suspects: Suspect[]; nextPlaceS: number | null;
  stillT: number;
  sent: number; joined: number; vanished: number; dealt: number; waiting: number; placed: number;
}

/**
 * The traffic's police orders (made on first use; a traffic reset forgets them).
 * @param ctx the traffic
 * @returns the orders
 */
export function ordersOf(ctx: TrafficCtx): PoliceOrders {
  return (ctx.police ||= { stars: 0, dueUntil: -Infinity, owed: 0, sendT: 0, heats: new Map(),
    suspects: [], nextPlaceS: null, stillT: 0, sent: 0, joined: 0, vanished: 0, dealt: 0,
    waiting: 0, placed: 0 });
}

/**
 * The share of the cars put back that are police now: more while they are due.
 * @param ctx the traffic
 * @returns 0..1
 */
export function policeShare(ctx: TrafficCtx): number {
  const youS = ctx.level?._hw?.q?.s ?? -Infinity;
  return ctx.police && youS < ctx.police.dueUntil ? DUE_SHARE : POLICE_SHARE;
}

/**
 * A police car: a model of POLICE_CARS, white, in the police livery with a roof number, its aids
 * as its spec, its light bar flag.
 * @param ctx the traffic
 * @returns the car (not placed)
 */
function policeVehicle(ctx: TrafficCtx): TrafficVehicle {
  const ids = POLICE_CARS.filter(([candId]) => ROSTER.some((entry) => entry.id === candId));
  const [vehId] = pick(ctx, ids), [paint, trim] = PAINTS[POLICE_PAINT];
  const roofNo = ROOF_NUMBERS[Math.floor(ctx.rnd() * ROOF_NUMBERS.length)];
  const car: TrafficVehicle = makeCar(vehId);
  // (its livery: the Battenberg check and the roof number - render/carsprite.ts paintPolice)
  car.spec = { ...car.spec, id: vehId + '#p' + roofNo, paint, trim, police: roofNo };
  car.traffic = true;
  car.police = true;
  car.absOn = !!(car.spec.aids && car.spec.aids.abs);
  car.tcsOn = !!(car.spec.aids && car.spec.aids.tcs);
  return car;
}

/**
 * A car just placed made a police car (cruising): a police vehicle where it is, moving as it was.
 * @param ctx the traffic
 * @param slot the car
 */
export function makePolice(ctx: TrafficCtx, slot: TrafficCar) {
  const old = slot.car, car = policeVehicle(ctx);
  reset(car, old.x, old.y, old.heading);
  slot.car = car;
  setSpeed(slot, slot.vAl);
  slot.police = { mode: 'cruise', seat: 0, wreckT: 0 };
  slot.racer = null;
  slot.quick = false;
  ordersOf(ctx).dealt++;
}

/**
 * A waiting place on a station's forecourt (our side) near a road distance: beside its canopy, up
 * the road from it.
 * @param ctx the traffic
 * @param dist road distance, m
 * @returns the place (s, off), or null
 */
function forecourtNear(ctx: TrafficCtx, dist: number): { s: number; off: number } | null {
  const level = ctx.level!;
  for (const prop of level.props) {
    if (prop.kind !== 'gasstation' || prop._s == null || prop._s < dist - WAIT_BACK_M
      || prop._s > dist + WAIT_LOOK_M) continue;
    const frame = roadFrame(level, prop.x, prop.y, prop._s);
    if (frame && frame.off < 0) return { s: frame.s + FORECOURT_AHEAD_M,
      off: frame.off + FORECOURT_IN_M };
  }
  return null;
}

/**
 * A waiting place ahead of a road distance, free of other cars: a station's forecourt, else a
 * lay-by's middle (half its depth out), else the hard shoulder or the verge where a car with an
 * issue would stop.
 * @param ctx the traffic
 * @param dist road distance, m
 * @param ents everyone on the road
 * @returns the place (s, off), or null
 */
function waitingPlace(ctx: TrafficCtx, dist: number, ents: TrafficEnt[]) {
  const level = ctx.level!, half = geo(ctx).hw;
  const court = forecourtNear(ctx, dist);
  if (court && roadsideFree(ents, court.s, court.off)) return court;
  for (let ahead = 0; ahead <= WAIT_LOOK_M; ahead += WAIT_STEP_M) {
    const bay = bayHere(level, dist + ahead);
    if (!bay || bay.station) continue;
    const off = -(half + (bayHere(level, bay.mid)?.out ?? 0) / 2);
    if (roadsideFree(ents, bay.mid, off)) return { s: bay.mid, off };
  }
  const off = stopOffAt(ctx, dist);
  return off != null && roadsideFree(ents, dist, off) ? { s: dist, off } : null;
}

/**
 * Of our way's police cars just put back ahead, WAIT_SHARE are put waiting at the roadside.
 * @param ctx the traffic
 * @param slot the police car
 * @param ents everyone on the road
 * @returns put waiting
 */
export function mayWait(ctx: TrafficCtx, slot: TrafficCar, ents: TrafficEnt[]): boolean {
  return ctx.rnd() < WAIT_SHARE && putWaiting(ctx, slot, ents);
}

/**
 * A police car put waiting, stopped, at the waiting place nearest ahead of it (none free: it
 * stays as it is).
 * @param ctx the traffic
 * @param slot the police car
 * @param ents everyone on the road
 * @returns put waiting
 */
function putWaiting(ctx: TrafficCtx, slot: TrafficCar, ents: TrafficEnt[]): boolean {
  const place = waitingPlace(ctx, slot.s, ents);
  if (!place) return false;
  const pose = roadPose(ctx.level!, place.s, place.off);
  reset(slot.car, pose.x, pose.y, pose.h);
  setSpeed(slot, 0);
  Object.assign(slot, { lane: 0, laneT: 0, laneOff: geo(ctx).own[0], s: place.s, off: place.off,
    kOff: null });
  slot.police!.mode = 'wait';
  ordersOf(ctx).waiting++;
  return true;
}

/**
 * A police car's step, when it is not driven as traffic: waiting (parked; carried, it stays put),
 * or chasing near a real car (the racing AI, aimed at you).
 * @param ctx the traffic
 * @param slot the police car
 * @param env the step's road
 * @param speed its speed, m/s
 * @returns true when it was stepped here
 */
export function drivePolice(ctx: TrafficCtx, slot: TrafficCar, env: DriveEnv,
  speed: number): boolean {
  const mode = slot.police!.mode, car = slot.car;
  if (mode === 'wait') {
    if (slot.phys) drivePhysics(ctx, slot, env, speed, 0, 0, PARKED);
    else {
      car.vx = car.vy = slot.vAl = 0;
      slot.deadT = 0;
    }
    car.brakeLight = 0;
    return true;
  }
  if (mode !== 'chase' || !slot.phys) return false;
  driveChaser(ctx, slot, env, speed);
  return true;
}

/**
 * A chaser near a real car: the racing driver's controls (it sees every car on its side of a
 * central reservation but you), aimed at you inside RAM_M; then the traffic's physics.
 * @param ctx the traffic
 * @param slot the chaser
 * @param env the step's road
 * @param speed its speed, m/s
 */
function driveChaser(ctx: TrafficCtx, slot: TrafficCar, env: DriveEnv, speed: number) {
  const car = slot.car, racer = slot.racer!, median = geo(ctx).median;
  const target = slot.police!.target ?? null;
  const stars = slot.police!.angry ? ANGRY_STARS
    : ordersOf(ctx).suspects.find((each) => each.car === target)?.stars ?? 1;
  if (slot.kin) racer.relocate();
  slot.laneT = slot.lane;
  slot.ind = 0;
  const side = (off: number) => median == null || Math.sign(off - median)
    === Math.sign(slot.off - median);
  let input: DriveInput | undefined;
  if (!slot.wreck && !tooInjured(car)) {
    input = racer.drive(car, env.dt, () => ({
      cars: env.ents.filter((ent) => ent.car !== car && ent.car !== target && side(ent.off))
        .map((ent) => ent.car),
      vMax: slot.vWant, hold: false }));
    if (target) input = ramAt({ car, target, raced: input, others: env.ents },
      slot.police!.seat, stars, speed);
  }
  drivePhysics(ctx, slot, env, speed, slot.vWant, 0, input);
}

/**
 * Whether no other car stands between a chaser and its aim (within LANE_CLEAR_M of the line to
 * it): the racing driver goes round one, a ram would go through it.
 * @param car the chaser
 * @param target you
 * @param others everyone on the road
 * @param aimX its aim, world m
 * @param aimY its aim, world m
 * @returns clear
 */
function clearTo(car: AiCar, target: AiCar, others: TrafficEnt[], aimX: number, aimY: number) {
  const dx = aimX - car.x, dy = aimY - car.y, length = Math.hypot(dx, dy) || 1;
  for (const ent of others) {
    const other = ent.car;
    if (other === car || other === target) continue;
    const toX = other.x - car.x, toY = other.y - car.y;
    const along = (toX * dx + toY * dy) / length, across = (toY * dx - toX * dy) / length;
    if (along > 0 && along < length && Math.abs(across) < LANE_CLEAR_M) return false;
  }
  return true;
}

/** What a ram reads: the chaser, you, the racing driver's controls, everyone on the road. */
interface RamCtx { car: TrafficVehicle; target: AiCar; raced: DriveInput; others: TrafficEnt[] }

/**
 * A chaser's controls inside RAM_M of its aim with you ahead of it and no car between: steered at
 * its seat (one steering law: ai/steerLaw.ts), closing at RAM_CLOSE_MS faster than you - creeping
 * up to a slow car within BOX_M and stopping against it; else the racing driver's.
 * @param ram the chaser, you, the racing driver's controls, everyone on the road
 * @param seat 0 your middle, 1 your left side, 2 your right side
 * @param stars the heat, 1-3
 * @param speed its speed, m/s
 * @returns the controls
 */
function ramAt(ram: RamCtx, seat: number, stars: number, speed: number): DriveInput {
  const { car, target, raced } = ram;
  const sideM = seat === 1 ? -SEAT_SIDE_M : seat === 2 ? SEAT_SIDE_M : 0;
  const cosT = Math.cos(target.heading), sinT = Math.sin(target.heading);
  const aimX = target.x + target.vx * LEAD_S - sinT * sideM;
  const aimY = target.y + target.vy * LEAD_S + cosT * sideM;
  const dx = aimX - car.x, dy = aimY - car.y, dist = Math.hypot(dx, dy);
  let psi = Math.atan2(dy, dx) - car.heading;
  psi = Math.atan2(Math.sin(psi), Math.cos(psi));
  if (dist > RAM_M || Math.abs(psi) > AIM_MAX_RAD || !clearTo(car, target, ram.others, aimX, aimY))
    return raced;
  const lock = car.spec.steerMax || 0.56, wheelbase = car.spec.L;
  const demand = steerDemand(psi, 0, speed, car.yawRate, car.delta, wheelbase);
  const cap = steerCap(wheelbase, car.surface.mu * car.spec.mu, speed, lock);
  const steer = Math.max(-cap, Math.min(cap, demand / lock));
  const youV = Math.hypot(target.vx, target.vy);
  // (a slow car within BOX_M: crept up to, then held touching - not shoved down the road)
  // (touching: it eases off to the target's speed - a ram is a hit, not a shove: MEASURED,
  // _police.mjs, held on at 3 m/s over a braking rival it pushed it on at 35-49 km/h)
  const boxing = youV < BOX_MS && dist < BOX_M, touching = boxGap(car, target) < TOUCH_GAP_M;
  const wantV = touching ? youV * TOUCH_SHARE : boxing ? youV + CREEP_MS
    : youV + RAM_CLOSE_MS[Math.max(0, Math.min(2, stars - 1))];
  const err = wantV - speed;
  return { steer, throttle: err > 0 ? Math.min(1, 0.25 + err * 0.2) : 0,
    brake: err < -1 ? Math.min(1, -err * 0.15) : 0, handbrake: 0, reverse: 0 };
}

/**
 * A police car made a chaser: the racing driver at its wheel, its lights going.
 * @param ctx the traffic
 * @param slot the police car
 */
function makeChaser(ctx: TrafficCtx, slot: TrafficCar) {
  seatRacer(ctx, slot, CHASE_DIFF, CHASE_AGG);
  slot.broke = null;
  slot.police!.mode = 'chase';
}

/**
 * A chaser gives up (the heat cleared): a cruising police car again, its lights off.
 * @param ctx the traffic
 * @param slot the chaser
 */
function giveUp(ctx: TrafficCtx, slot: TrafficCar) {
  slot.police!.mode = 'cruise';
  slot.racer = null;
  slot.quick = false;
  slot.vWant = cruise(ctx, slot.lane, geo(ctx).own.length);
}

/**
 * A chaser's speed: CATCH_MS faster than you up to CHASE_KMH at the stars; one ahead of you
 * AHEAD_SHARE of yours.
 * @param stars the heat, 1-3
 * @param youV your speed, m/s
 * @param relS its road distance ahead of you, m
 * @returns m/s
 */
function chaseSpeed(stars: number, youV: number, relS: number): number {
  if (relS > 0) return youV * AHEAD_SHARE;
  return Math.min(CHASE_KMH[Math.max(0, Math.min(2, stars - 1))] / 3.6, youV + CATCH_MS);
}

/**
 * A police car too damaged to drive (or tumbling) for VANISH_S is gone (its slot rejoins later
 * as a random car).
 * @param ctx the traffic
 * @param dt the step, s
 * @returns true when one went
 */
function vanishWrecks(ctx: TrafficCtx, dt: number): boolean {
  let changed = false;
  for (const slot of ctx.list) {
    const police = slot.police;
    if (slot.parked || !police || police.angry) continue;
    const wrecked = slot.wreck || rolling(slot.car) || tooInjured(slot.car);
    police.wreckT = wrecked ? police.wreckT + dt : 0;
    if (police.wreckT <= VANISH_S) continue;
    slot.parked = true;
    slot.police = null;
    ordersOf(ctx).vanished++;
    changed = true;
  }
  return changed;
}

/**
 * The police cars of our way in sight of a driver with heat (JOIN_M, on its level) join the chase
 * while chasers are owed (a star more: one more chaser - one lost is not replaced, so you can get
 * away).
 * @param ctx the traffic
 * @param chasers the chasers (added to)
 */
function joinBySight(ctx: TrafficCtx, chasers: TrafficCar[]) {
  const orders = ordersOf(ctx);
  for (const slot of ctx.list) {
    if (orders.owed <= 0) return;
    const police = slot.police;
    if (slot.parked || !police || police.mode === 'chase' || (slot.dir ?? 1) < 0 || slot.wreck
      || !orders.suspects.some((each) => each.car !== slot.car && sameLevel(slot.car, each.car)
        && Math.hypot(slot.car.x - each.car.x, slot.car.y - each.car.y) < JOIN_M)) continue;
    makeChaser(ctx, slot);
    chasers.push(slot);
    orders.owed--;
    orders.joined++;
  }
}

/**
 * A chaser's target: every RETARGET_S the closest driver with heat on its level (not itself) -
 * taken only when inside RETARGET_SHARE of the distance to its own, or when its own has no heat.
 * @param ctx the traffic
 * @param slot the chaser
 * @param dt the step, s
 * @returns the target's suspect entry, or null: no one to chase
 */
function pickTarget(ctx: TrafficCtx, slot: TrafficCar, dt: number): Suspect | null {
  const police = slot.police!, suspects = ordersOf(ctx).suspects, car = slot.car;
  const gapTo = (each: Suspect) => (each.car === car || !sameLevel(car, each.car) ? Infinity
    : Math.hypot(each.car.x - car.x, each.car.y - car.y));
  let mine = suspects.find((each) => each.car === police.target) ?? null;
  police.targetT = (police.targetT ?? 0) - dt;
  if (mine && police.targetT > 0) return mine;
  police.targetT = RETARGET_S;
  let best: Suspect | null = null;
  for (const each of suspects) if (!best || gapTo(each) < gapTo(best)) best = each;
  if (best && gapTo(best) < Infinity && (!mine || gapTo(best) < RETARGET_SHARE * gapTo(mine)))
    mine = best;
  police.target = mine ? mine.car : null;
  return mine;
}

/**
 * Sends a chaser from behind a driver with heat, out of sight: a parked slot of our way, else our
 * way's car out of view furthest from you (not a police car) - or a chaser sent round again - made
 * a police car with the racing driver.
 * @param ctx the traffic
 * @param ents everyone on the road (the car's entry kept up)
 * @param vis the screen test
 * @param after the driver it is sent after (from behind it)
 * @param again a chaser to send round again (none: a spare slot)
 * @returns the chaser, or null: no room this step
 */
function sendChaser(ctx: TrafficCtx, ents: TrafficEnt[], vis: VisFn, after: Suspect,
  again: TrafficCar | null = null) {
  const playerS = ctx.level!._hw.q!.s, pickSlot = again ?? spareSlot(ctx, playerS, vis);
  const place = pickSlot && spot(ctx, ents, after.s, 'chase', vis, 1);
  if (!pickSlot || !place) return null;
  fresh(ctx, pickSlot, place.s, place.lane, Math.hypot(after.car.vx, after.car.vy) + CATCH_MS, 1);
  makePolice(ctx, pickSlot);
  makeChaser(ctx, pickSlot);
  keepEntry(ents, pickSlot);
  ordersOf(ctx).sent++;
  return pickSlot;
}

/**
 * A slot that can become a police car now: a parked slot of our way, else our way's car out of
 * view furthest from you (not a police car, not broken down).
 * @param ctx the traffic
 * @param playerS your road distance, m
 * @param vis the screen test
 * @returns the slot, or null
 */
function spareSlot(ctx: TrafficCtx, playerS: number, vis: VisFn): TrafficCar | null {
  let pickSlot: TrafficCar | null = null, far = -1;
  for (const slot of ctx.list) {
    if ((slot.dir ?? 1) < 0 || slot.police || slot.broke) continue;
    const away = slot.parked ? Infinity : Math.abs(slot.s - playerS);
    if (away > far && (slot.parked || !vis(slot.car.x, slot.car.y, slot.s))) {
      far = away;
      pickSlot = slot;
    }
  }
  return pickSlot;
}

/**
 * A slot just filled again: its road entry follows it (a new one if it was parked).
 * @param ents everyone on the road
 * @param slot the slot
 */
function keepEntry(ents: TrafficEnt[], slot: TrafficCar) {
  const ent = ents.find((each) => each.t === slot);
  const now = { car: slot.car, s: slot.s, off: slot.off, v: (slot.dir ?? 1) * slot.vAl, t: slot };
  if (ent) Object.assign(ent, now);
  else ents.push(now);
}

/**
 * Every PLACE_EVERY_M of road you drive, a chance (higher while police are due) of a police car of
 * our way ahead, out of sight: waiting at the roadside (WAIT_SHARE, where there is a place), else
 * cruising in a lane - your way's traffic is rarely put back ahead when you drive at its speed.
 * @param ctx the traffic
 * @param ents everyone on the road
 * @param vis the screen test
 * @returns true when one was placed
 */
function placeAhead(ctx: TrafficCtx, ents: TrafficEnt[], vis: VisFn): boolean {
  const orders = ordersOf(ctx), level = ctx.level!, playerS = level._hw.q!.s;
  if (orders.nextPlaceS == null) orders.nextPlaceS = playerS + PLACE_EVERY_M;
  if (playerS < orders.nextPlaceS) return false;
  orders.nextPlaceS = playerS + PLACE_EVERY_M;
  if (ctx.rnd() >= (playerS < orders.dueUntil ? DUE_PLACE_CHANCE : PLACE_CHANCE)) return false;
  const dist = playerS + PLACE_AHEAD_M[0] + ctx.rnd() * (PLACE_AHEAD_M[1] - PLACE_AHEAD_M[0]);
  const lanes = geo(ctx).own, lane = (ctx.rnd() * lanes.length) | 0, slot = spareSlot(ctx,
    playerS, vis);
  const pose = roadPose(level, dist, lanes[lane]);
  if (!slot || dist > roadSpan(level).s1 - 60 || !roomAt(ctx, ents, dist, lane, 30, 30, 1)
    || vis(pose.x, pose.y, dist)) return false;
  fresh(ctx, slot, dist, lane, cruise(ctx, lane, lanes.length), 1);
  makePolice(ctx, slot);
  if (ctx.rnd() < WAIT_SHARE) putWaiting(ctx, slot, ents);
  keepEntry(ents, slot);
  orders.placed++;
  return true;
}

/**
 * You stopped with heat and no chaser of yours behind you (one ahead in sight cannot turn back):
 * one more chaser is owed. Keeps the time you have been still.
 * @param ctx the traffic
 * @param dt the step, s
 * @param player you
 * @param chasers the chasers
 */
function oweOneBehind(ctx: TrafficCtx, dt: number, player: AiCar, chasers: TrafficCar[]) {
  const orders = ordersOf(ctx), playerS = ctx.level!._hw.q!.s;
  orders.stillT = Math.hypot(player.vx, player.vy) < STILL_MS ? orders.stillT + dt : 0;
  if (orders.stillT > STILL_RESEND_S && orders.suspects.some((each) => each.car === player)
    && !chasers.some((slot) => slot.police!.target === player && slot.s < playerS))
    orders.owed = Math.max(orders.owed, 1);
}

/**
 * One step of a chase: the police in sight of an offender joining while chasers are owed, else
 * one sent from behind you (one a SEND_GAP_S), up to MAX_CHASERS; each chaser's target (the
 * closest with heat; none: it gives up), its speed by its target's and its seat among that
 * target's chasers. One ahead of its target stopped STILL_RESEND_S, out of sight, is sent round
 * behind it (it cannot turn back); you stopped with none of yours behind you, in sight, one more
 * is owed.
 * @param ctx the traffic
 * @param dt the step, s
 * @param player you
 * @param chasers the chasers (added to)
 * @param road everyone on the road and the screen test
 * @param road.ents everyone on the road
 * @param road.vis the screen test
 * @returns true when the live cars changed
 */
function runChase(ctx: TrafficCtx, dt: number, player: AiCar & { crossing?: number },
  chasers: TrafficCar[], road: { ents: TrafficEnt[]; vis: VisFn }): boolean {
  const orders = ordersOf(ctx);
  let changed = false;
  oweOneBehind(ctx, dt, player, chasers);
  orders.owed = Math.max(0, Math.min(orders.owed, Math.min(MAX_CHASERS, orders.stars)
    - chasers.length));
  joinBySight(ctx, chasers);
  orders.sendT -= dt;
  // (a new one from behind the driver with heat nearest you: the chase you can see)
  const playerS = ctx.level!._hw.q!.s;
  const nearest = orders.suspects.reduce<Suspect | null>((best, each) => (!best
    || Math.abs(each.s - playerS) < Math.abs(best.s - playerS) ? each : best), null);
  if (orders.owed > 0 && orders.sendT <= 0 && nearest) {
    orders.sendT = SEND_GAP_S;
    const sent = sendChaser(ctx, road.ents, road.vis, nearest);
    if (sent) {
      chasers.push(sent);
      orders.owed--;
      changed = true;
    }
  }
  const seats = new Map<object, number>();
  for (const slot of chasers) {
    const mine = pickTarget(ctx, slot, dt);
    if (!mine) {
      giveUp(ctx, slot);
      continue;
    }
    const relS = slot.s - mine.s, targetV = Math.hypot(mine.car.vx, mine.car.vy);
    // (ahead of its target stopped STILL_RESEND_S, out of sight: sent round behind it)
    const police = slot.police!;
    police.waitT = relS > BOX_M && targetV < STILL_MS ? (police.waitT ?? 0) + dt : 0;
    if (police.waitT > STILL_RESEND_S && !road.vis(slot.car.x, slot.car.y, slot.s)
      && sendChaser(ctx, road.ents, road.vis, mine, slot)) changed = true;
    slot.vWant = chaseSpeed(mine.stars, targetV, relS);
    const seat = seats.get(mine.car) ?? 0;
    seats.set(mine.car, seat + 1);
    slot.police!.seat = seat % 3;
  }
  return changed;
}

/**
 * One step of the police (?police=1), before the traffic is driven: wrecks gone, now and then one
 * placed ahead, a chase given up when the heat is off, else the chase's step (runChase); every
 * police car's light bar going while it chases.
 * @param ctx the traffic
 * @param dt the step, s
 * @param player you
 * @param ents everyone on the road
 * @param vis the screen test
 */
export function stepPolice(ctx: TrafficCtx, dt: number, player: AiCar & { crossing?: number },
  ents: TrafficEnt[], vis: VisFn) {
  const orders = ordersOf(ctx);
  let changed = vanishWrecks(ctx, dt);
  changed = placeAhead(ctx, ents, vis) || changed;
  const chasers = ctx.list.filter((slot) => !slot.parked && slot.police?.mode === 'chase'
    && !slot.police.angry);
  if (!orders.stars) {
    for (const slot of chasers) giveUp(ctx, slot);
    orders.owed = 0;
  } else changed = runChase(ctx, dt, player, chasers, { ents, vis }) || changed;
  for (const slot of ctx.list) if (slot.police) slot.car.blues = slot.police.mode === 'chase'
    && !slot.police.angry;
  if (changed) rebuildCars(ctx);
}

/**
 * The police cars chasing a driver go (its bust: that chase is over), every police car with none
 * given; their slots rejoin later as random cars.
 * @param ctx the traffic
 * @param target the busted driver's car (none: every police car)
 */
export function clearPolice(ctx: TrafficCtx, target: object | null = null) {
  let changed = false;
  for (const slot of ctx.list)
    if (!slot.parked && slot.police && (!target || slot.police.target === target)) {
      slot.parked = true;
      slot.police = null;
      changed = true;
    }
  const orders = ordersOf(ctx);
  if (!target) orders.stars = orders.owed = 0;
  if (changed) rebuildCars(ctx);
}

/**
 * A traffic driver busted (a speeder, a crasher) is put away: off the road, its slot to rejoin
 * later as a random car.
 * @param ctx the traffic
 * @param car its car
 * @returns true when it was one of the traffic's
 */
export function putAway(ctx: TrafficCtx, car: object): boolean {
  const slot = ctx.list.find((each) => !each.parked && each.car === car);
  if (!slot) return false;
  slot.parked = true;
  slot.racer = null;
  slot.police = null;
  rebuildCars(ctx);
  return true;
}

// ?roadrage=1: s an angry driver stays angry, the least and the most; the stars it drives at you
// with (its closing speed and its rams: ai/trafficPolice.ts ramAt), and how far away it gives up
const ANGRY_S = [30, 45], ANGRY_STARS = 2, ANGRY_SIGHT_M = 200;

/**
 * A driver made ANGRY (?roadrage=1, ai/trafficYield.ts noteFlash): the police's chase driver at its
 * wheel - the racing AI, you its target, tailgating and ramming - without the lights or the livery
 * (render/cars.ts flashes its headlights); not a police car to the heat (ai/policeHeat.ts).
 * @param ctx the traffic
 * @param slot the car
 * @param target you
 */
export function makeAngry(ctx: TrafficCtx, slot: TrafficCar,
  target: AiCar & { crossing?: number }) {
  seatRacer(ctx, slot, CHASE_DIFF, CHASE_AGG);
  slot.broke = null;
  slot.yieldT = 0;
  slot.police = { mode: 'chase', seat: 0, wreckT: 0, target, targetT: Infinity, angry: true,
    angryT: ANGRY_S[0] + ctx.rnd() * (ANGRY_S[1] - ANGRY_S[0]) };
  slot.car.angry = true;
}

/**
 * The angry drivers' step (?roadrage=1): each one's speed after you, as a chaser's; calmed down -
 * driving on as traffic - once its time is up, it is wrecked, or you are out of its sight.
 * @param ctx the traffic
 * @param dt the step, s
 * @param player you
 */
export function stepAngry(ctx: TrafficCtx, dt: number, player: AiCar) {
  const playerS = ctx.level!._hw.q!.s, youV = Math.hypot(player.vx, player.vy);
  for (const slot of ctx.list) {
    const police = slot.police;
    if (slot.parked || !police?.angry) continue;
    police.angryT = (police.angryT ?? 0) - dt;
    const gap = Math.hypot(slot.car.x - player.x, slot.car.y - player.y);
    if (police.angryT > 0 && gap < ANGRY_SIGHT_M && !slot.wreck) {
      slot.vWant = chaseSpeed(ANGRY_STARS, youV, slot.s - playerS);
      continue;
    }
    giveUp(ctx, slot);
    slot.police = null;
    slot.car.angry = false;
  }
}
