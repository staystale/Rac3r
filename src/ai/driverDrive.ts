// ai/driverDrive.ts: one tick of the circuit driver: place, joker, mistakes, lane, traffic,
// racecraft, then steering and pedals. Takes the driver context.
import { profileOf } from "./line.ts";
import { driveOut } from "./weaver.ts";
import { jokerStep } from "./driverJoker.ts";
import { carsStep, obstacleAvoid } from "./driverTraffic.ts";
import { steerSlideStep, pedalStep } from "./driverPedals.ts";
import { coolStep, COOL_LOOK } from './driverCool.ts';
import {
  advance, placeAtStart, mistakeStep, laneStep, battleStep, racecraftStep,
} from "./driverLane.ts";
import type { AiCar, DriveCtx } from "./types.ts";
import { rejoinCross, rejoinAim, lateralOf } from "./rejoin.ts";
import { rejoinClear } from "./gapPick.ts";
import { SWERVE_RATE } from "./dodge.ts";
import type { Drv, AiPath } from "./driverCtx.ts";

// m: the lateral target never puts the car's centre closer than this to the road edge
const WANDER_EDGE = 1.1;

// look before pulling on: m inside the track's edge a car's middle counts as at the edge, and the
// m it must be coming in by to look first
const EDGE_IN_M = 0.3, COME_IN_M = 1;

/** Other cars and obstacles, then racecraft: the lateral target, speed scale and gap cap. */
function trafficStep(drv: Drv, car: AiCar, ctx: DriveCtx, path: AiPath, nearIdx: number,
    idx: (pos: number) => number, speed: number, dt: number, lineOff: number, startK: number,
    cur: { latT: number, vMul: number, prof: ReturnType<typeof profileOf> }) {
  const { traits, line, main, state } = drv;
  let { latT, vMul, prof } = cur;
  const others = ctx.cars || [];
  // ---- OTHER CARS (requirement: avoid waiting for or crashing into other cars, deviating from its
  // chosen path): a car ahead in the way -> pick the side with room and go round it (that IS the
  // overtake); no room -> sit behind it, matching its speed; a car alongside -> keep a gap; a
  // faster car close behind -> a defensive driver covers its side a little
  const prec = traits.prec ?? 0.5;
  const latLim = path === main ? line.hw - WANDER_EDGE : 2;
  const myLat = state.dodge + latT;
  const cars = carsStep(drv, car, others, path, nearIdx, idx, speed, prec, prof, lineOff, latT,
      startK, latLim, myLat);
  let dodgeT = cars.dodgeT, conflict = cars.conflict;
  const followCap = cars.followCap;
  const avoid = obstacleAvoid(drv, car, ctx, path, nearIdx, idx, speed, prec, lineOff, myLat,
      latLim, latT, dt, { dodgeT, conflict });
  ({ dodgeT, conflict } = avoid);
  // ---- RACECRAFT (stage 3; requirement: real overtakes, real defending, scrabbling for victory).
  // Stage 2 only went round a car that was already in the way, so circuits were processions
  // (aifieldsuite, Realish: 35 held passes in 12 six-car 3-lap races, Brands and
  // Naffcar ~0). ATTACK: sat behind the same car (longer for the cautious) with a corner coming
  // -> commit to a side for that corner: the INSIDE, unless the car ahead already covers it,
  // then round the OUTSIDE for the switch-back; brake later (K_BRAKE + ATK_KB) and push a
  // little. Ends past the apex, once ahead, if it drops back or after 7 s. DEFENCE: a car
  // closing behind with a corner coming -> a defensive driver (chance = defence) moves over to
  // COVER THE INSIDE once, and pays for the tighter line (3 % slower in the corner).
  if (path === main) {
    ({ vMul, dodgeT, conflict, prof } = racecraftStep(drv, car, path, nearIdx, idx, speed, dt,
        lineOff, latLim, latT, myLat, cars, vMul, dodgeT, conflict, prof));
  } else { state.atk = null; state.cover = null; state.cc = -1; }
  // (round a car in the way with no time to spare, the swerve's own rate: ai/dodge.ts)
  const rate = state.atk ? 3.5 : cars.urgent ? Math.max(2.5, SWERVE_RATE) : 2.5;
  state.dodge += Math.max(-rate * dt, Math.min(rate * dt, dodgeT - state.dodge)) * (
      conflict ? 1 : 0.5);
  state.follow = followCap < Infinity;
  latT += state.dodge;
  // past the usual edge only while going round a car (above)
  const edge = state.t < (state.wideUntil || 0) ? state.wide! : latLim;
  latT = Math.max(-edge, Math.min(edge, lineOff + latT)) - lineOff;
  if (path === main && cars.seen) latT = lookFirst(car, path, nearIdx, lineOff,
    latT, { hw: line.hw, speed, seen: cars.seen });
  return { latT, vMul, prof, followCap, conflict };
}

/**
 * LOOK BEFORE PULLING ON (passed 11-04) - a car at or past the track's edge that wants to come in
 * holds its place (driving on along the edge) until the lines it would cross are clear.
 * @param car my car
 * @param path my path
 * @param nearIdx my point on it
 * @param lineOff the line's m off the track's middle here
 * @param latT where I am going, m off my path
 * @param road the track's half width, my m/s and the cars seen
 * @returns where to go, m off my path
 */
function lookFirst(car: AiCar, path: AiPath, nearIdx: number, lineOff: number, latT: number,
  road: { hw: number; speed: number; seen: NonNullable<ReturnType<typeof carsStep>['seen']> }) {
  const actual = lateralOf(car, path, nearIdx), half = car.spec.wid / 2;
  // at the edge (a reset puts the car's middle on it) or past it, and coming in by a metre or more
  const atEdge = Math.abs(lineOff + actual) > road.hw - EDGE_IN_M;
  const comingIn = Math.abs(lineOff + latT) < Math.abs(lineOff + actual) - COME_IN_M;
  if (!atEdge || !comingIn) return latT;
  return rejoinClear(road.seen, actual, latT, half, car.spec.len, road.speed) ? latT : actual;
}

/** One drive tick: the controls for this car from the driver context, or a drive-out move. */
export function drive(drv: Drv, car: AiCar, dt = 1 / 120, ctx: DriveCtx = {}) {
  const { rnd, main, state, jLaps } = drv;
  state.t += dt;
  state.steerHold = null;
  const spec = car.spec, speed = Math.hypot(car.vx, car.vy);
  if (state.i === null) placeAtStart(drv, car);
  advance(drv, car);
  // ---- DRIVE ITSELF OUT (requirement: it should try to drive it self out, if it falls super far
  // behind / stays off track too long / stays still / drives too slow for too long, ect it can
  // reset). Nearly still for DRIVE_OUT_T s after the green (nose in a wall, beached, tangled with a
  // car) -> REVERSE for ~1-1.5 s with the wheel turned to swing the nose back
  // toward the road, then drive on. The game's reset (main.ts) is the LAST resort now: it waits
  // longer, so this gets two or three tries first. (! : st.i was set just above)
  {
    const out = driveOut(state, car, speed, dt, ctx, rnd, () => state.path.pts[state.i!].h);
    if (out) return out;
  }
  const lap = ctx.lap || Math.max(1, state.lap), laps = ctx.laps || jLaps;
  const path = state.path, size = path.n, idx = (pos: number) => (
      path.closed ? ((pos % size) + size) % size : Math.max(0, Math.min(size - 1, pos)));
  const nearIdx = state.i!; let prof = profileOf(path, spec, main, drv.traits.kBrake);
  const others = ctx.cars || [];
  const push = battleStep(drv, car, others);
  // ---- JOKER: decide once per lap ~220 m before the branch; take it at the switch point
  const jCap = jokerStep(drv, car, ctx, path, nearIdx, lap, laps);

  // ---- MISTAKES (requirement: genuine subtle driving errors that lead to crashes and / or slower
  // lap times), drawn per corner ~45 m out
  const mistakes = mistakeStep(drv, path, nearIdx);
  let vMul = mistakes.vMul;
  const thrForce = mistakes.thrForce;

  // ---- the line and the start lane
  const lane = laneStep(drv, car, path, nearIdx, speed, mistakes.latT);
  let latT = lane.latT;
  const lineOff = lane.lineOff, startK = lane.startK;
  // ---- hot tyres: a skilled driver may ease off / find water or grass (ai/driverCool.ts)
  const cool = coolStep(drv, car, path, idx(nearIdx + Math.round(COOL_LOOK / path.sp)),
    path === main ? drv.line.hw - 1 : 1);
  vMul *= cool.vMul;
  latT += cool.lat;

  const traffic = trafficStep(drv, car, ctx, path, nearIdx, idx, speed, dt, lineOff, startK,
      { latT, vMul, prof });
  ({ latT, vMul, prof } = traffic);
  const followCap = traffic.followCap;
  // OFF THE LINE INTO A CORNER (an attack, a cover, a dodge): the profile is for the
  // racing line's radius; x m further INSIDE at the apex is a radius R - x, so the corner speed
  // drops by sqrt((R - x) / R). Without it attackers ran wide on the exit (aifieldsuite Realish
  // off-road 142 -> 299 car-s, MEASURED). (applied in the SPEED section: every bend ahead within
  // braking distance, not only the "corners" — Naffcar's banked turns are wider than CORNER_R,
  // and tow passes on their inside slid off: off-road 0 -> 14 car-s, MEASURED)
  // (R2) not making a move -> a soft rejoin, and corners taken for where it really is
  const moving = traffic.conflict || !!state.atk || !!state.cover;
  const crossMax = moving ? Infinity : rejoinCross(drv.traits.skill);
  const aim = rejoinAim(car, path, nearIdx, mistakes.latT, rejoinCross(drv.traits.skill),
    lane.shape);
  const slide = steerSlideStep(drv, car, path, nearIdx, idx, speed, lineOff, latT, crossMax);
  state.steerHold = { path, nearIdx, latT, lineOff, crossMax };
  return pedalStep(drv, car, path, nearIdx, idx, speed, dt, prof, latT, lineOff,
      { push, vMul, jCap, followCap, thrForce, aim }, slide);
}

/**
 * The HANDS between thinks - the steering recomputed from where the car is now, onto
 * the line and lateral target the last think chose (MEASURED 11-04: holding or gliding the
 * steering for 1/40-1/30 s lost 0.5-0.8 s a lap at Naffcar; with the steering fresh, nothing).
 * @param drv the driver context
 * @param car the car
 * @returns the steer, or null when the last think was not on the line (driving itself out)
 */
export function steerNow(drv: Drv, car: AiCar): number | null {
  const hold = drv.state.steerHold;
  if (!hold) return null;
  const { path, nearIdx, latT, lineOff, crossMax } = hold, size = path.n;
  const idx = (pos: number) => (path.closed ? ((pos % size) + size) % size
    : Math.max(0, Math.min(size - 1, pos)));
  return steerSlideStep(drv, car, path, nearIdx, idx, Math.hypot(car.vx, car.vy), lineOff,
    latT, crossMax).steer;
}
