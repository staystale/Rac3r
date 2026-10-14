// ai/driverDrive.ts: one tick of the circuit driver: place, joker, mistakes, lane, traffic,
// racecraft, then steering and pedals. Takes the driver context.
import { profileOf } from "./line.ts";
import { driveOut } from "./weaver.ts";
import { jokerStep } from "./driverJoker.ts";
import { carsStep, obstacleAvoid } from "./driverTraffic.ts";
import { steerSlideStep, pedalStep } from "./driverPedals.ts";
import {
  advance, placeAtStart, mistakeStep, laneStep, battleStep, racecraftStep,
} from "./driverLane.ts";
import type { AiCar, DriveCtx } from "./types.ts";
import type { Drv, AiPath } from "./driverCtx.ts";

// m: the lateral target never puts the car's centre closer than this to the road edge
const WANDER_EDGE = 1.1;

/** Other cars and obstacles, then racecraft: the lateral target, speed scale and gap cap. */
function trafficStep(drv: Drv, car: AiCar, ctx: DriveCtx, path: AiPath, nearIdx: number,
    idx: (pos: number) => number, speed: number, dt: number, lineOff: number, startK: number,
    cur: { latT: number, vMul: number, prof: ReturnType<typeof profileOf> }) {
  const { traits, line, main, state } = drv;
  let { latT, vMul, prof } = cur;
  const others = ctx.cars || [];
  // ---- OTHER CARS (user: "avoid waiting for or crashing into other cars, deviating from its
  // chosen path"): a car ahead in the way -> pick the side with room and go round it (that IS the
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
  // ---- RACECRAFT (stage 3, 2026-10-04; user: "real overtakes, real defending, scrabbling for
  // victory"). Stage 2 only went round a car that was already in the way, so circuits were
  // processions (aifieldsuite, Realish: 35 held passes in 12 six-car 3-lap races, Brands and
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
  const rate = state.atk ? 3.5 : 2.5;
  state.dodge += Math.max(-rate * dt, Math.min(rate * dt, dodgeT - state.dodge)) * (
      conflict ? 1 : 0.5);
  state.follow = followCap < Infinity;
  latT += state.dodge;
  // past the usual edge only while going round a car (above)
  const edge = state.t < (state.wideUntil || 0) ? state.wide! : latLim;
  latT = Math.max(-edge, Math.min(edge, lineOff + latT)) - lineOff;
  return { latT, vMul, prof, followCap };
}

/** One drive tick: the controls for this car from the driver context, or a drive-out move. */
export function drive(drv: Drv, car: AiCar, dt = 1 / 120, ctx: DriveCtx = {}) {
  const { rnd, main, state, jLaps } = drv;
  state.t += dt;
  const spec = car.spec, speed = Math.hypot(car.vx, car.vy);
  if (state.i === null) placeAtStart(drv, car);
  advance(drv, car);
  // ---- DRIVE ITSELF OUT (user, 2026-10-07: "it should try to drive it self out, if it falls
  // super far behind / stays off track too long / stays still / drives too slow for too long, ect
  // it can reset"). Nearly still for DRIVE_OUT_T s after the green (nose in a wall, beached,
  // tangled with a car) -> REVERSE for ~1-1.5 s with the wheel turned to swing the nose back
  // toward the road, then drive on. The game's reset (main.js) is the LAST resort now: it waits
  // longer, so this gets two or three tries first. (! : st.i was set just above)
  {
    const out = driveOut(state, car, speed, dt, ctx, rnd, () => state.path.pts[state.i!].h);
    if (out) return out;
  }
  const lap = ctx.lap || Math.max(1, state.lap), laps = ctx.laps || jLaps;
  const path = state.path, size = path.n, idx = (pos: number) => (
      path.closed ? ((pos % size) + size) % size : Math.max(0, Math.min(size - 1, pos)));
  const nearIdx = state.i!; let prof = profileOf(path, spec, main);
  const others = ctx.cars || [];
  const push = battleStep(drv, car, others);
  // ---- JOKER: decide once per lap ~220 m before the branch; take it at the switch point
  const jCap = jokerStep(drv, car, ctx, path, nearIdx, lap, laps);

  // ---- MISTAKES (user: "genuine subtle driving errors that lead to crashes and / or slower lap
  // times"), drawn per corner ~45 m out
  const mistakes = mistakeStep(drv, path, nearIdx);
  let vMul = mistakes.vMul;
  const thrForce = mistakes.thrForce;

  // ---- the line, the wander and the start lane
  const lane = laneStep(drv, car, path, nearIdx, speed, mistakes.latT);
  let latT = lane.latT;
  const lineOff = lane.lineOff, startK = lane.startK;

  const traffic = trafficStep(drv, car, ctx, path, nearIdx, idx, speed, dt, lineOff, startK,
      { latT, vMul, prof });
  ({ latT, vMul, prof } = traffic);
  const followCap = traffic.followCap;
  // OFF THE LINE INTO A CORNER (an attack, a cover, a dodge, a wander): the profile is for the
  // racing line's radius; x m further INSIDE at the apex is a radius R - x, so the corner speed
  // drops by sqrt((R - x) / R). Without it attackers ran wide on the exit (aifieldsuite Realish
  // off-road 142 -> 299 car-s, MEASURED). (applied in the SPEED section: every bend ahead within
  // braking distance, not only the "corners" — Naffcar's banked turns are wider than CORNER_R,
  // and tow passes on their inside slid off: off-road 0 -> 14 car-s, MEASURED)
  const slide = steerSlideStep(drv, car, path, nearIdx, idx, speed, lineOff, latT);
  return pedalStep(drv, car, path, nearIdx, idx, speed, dt, prof, latT, lineOff,
      { push, vMul, jCap, followCap, thrForce }, slide);
}
