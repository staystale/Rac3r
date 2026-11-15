// ai/driverOncoming.ts - THE RACER AND ONCOMING TRAFFIC on the endless road (?hwdodge=1, TODO 3a2
// bug 10; the game sets DriveCtx.road there). MEASURED (tools/scratch/_hwdodge.mjs): on the twisty
// single carriageway the racers spent 22-33 % of their time in the other way's lane and hit
// oncoming traffic 3.3-9.7 times per 10 racer-km, 27 of 40 of those cars outside the window the
// driver read cars in 2.5-3 s before (round a bend: the window was a box on the racer's heading).
// - READ BY THE ROAD (driverTraffic.ts carsStep): each car's place along and across the road (its
//   road frame, _hwf, set for every car each step) instead of the heading box.
// - KEEP TO YOUR SIDE (here): on a two-way road, the nearest oncoming car ahead within KEEP_S of
//   closing keeps the racer's middle inside its own lanes - back over if it is out; on its side it
//   pulls out to overtake only with KEEP_S + PASS_S of closing clear. The driver judges that time:
//   off by up to MISJUDGE of it (one draw from its own random stream for each oncoming car), less
//   the more skilled (none at skill 1).
import { lateralOf } from "./rejoin.ts";
import type { AiCar, DriveCtx } from "./types.ts";
import type { AiPath, Drv } from "./driverCtx.ts";

// s of closing within which an oncoming car keeps the racer on its own side of the road
export const KEEP_S = 4;
// s more an oncoming car must be away for a racer on its own side to pull out (to pass): the
// pass's own time, so it is back on its side before KEEP_S
export const PASS_S = 4;
// m kept between the racer's side and the road's middle line
const KEEP_MARGIN_M = 0.3;
// the most a skill-0 driver's judged closing time is off, as a share of it
const MISJUDGE = 0.35;
// m/s back down the road a car must be going to count as oncoming
const ONCOMING_MS = 2;
// m inside its own side of the middle line a car still counts as on the other way's side
const OTHER_SIDE_M = 1;

/**
 * The nearest oncoming car ahead on the other way's side, and its closing time, s.
 * @param car my car
 * @param others the cars around
 * @param middleOff the road's middle line, m (road frame: + = right)
 * @returns the car and its time, or null
 */
function nearestOncoming(car: AiCar, others: AiCar[], middleOff: number) {
  const mine = car._hwf!;
  let best: AiCar | null = null, bestT = Infinity;
  for (const other of others) {
    const frame = other._hwf;
    if (!frame || frame.v > -ONCOMING_MS || frame.off < middleOff - OTHER_SIDE_M) continue;
    const ahead = frame.s - mine.s, closing = mine.v - frame.v;
    if (ahead <= 0 || closing <= 0) continue;
    const time = ahead / closing;
    if (time < bestT) {
      bestT = time;
      best = other;
    }
  }
  return best ? { car: best, time: bestT } : null;
}

/**
 * KEEP TO YOUR SIDE: the highest lateral place (m off the track's middle, the driver's line frame)
 * the racer's middle may take now - inside its own lanes while an oncoming car is judged within
 * KEEP_S - or Infinity.
 * @param drv the driver context
 * @param car my car
 * @param ctx the drive context (road: the two-way road's middle line)
 * @param path my path
 * @param nearIdx my point on it
 * @param lineOff the line's m off the track's middle here
 * @returns m, or Infinity
 */
export function ownSideCap(drv: Drv, car: AiCar, ctx: DriveCtx, path: AiPath, nearIdx: number,
  lineOff: number): number {
  const { state, traits, rnd } = drv;
  const road = ctx.road;
  if (!road || road.middleOff === null || !car._hwf) {
    state.oncomingCar = null;
    return Infinity;
  }
  const near = nearestOncoming(car, ctx.cars || [], road.middleOff);
  if (!near) {
    state.oncomingCar = null;
    return Infinity;
  }
  if (state.oncomingCar !== near.car) {
    state.oncomingCar = near.car;
    const skill = Math.max(0, Math.min(1, traits.skill));
    state.misjudge = (1 - skill) * MISJUDGE * (2 * rnd() - 1);
  }
  // its own side's edge (road frame); on it, it pulls out only with the pass's time clear too
  const sideOff = road.middleOff - car.spec.wid / 2 - KEEP_MARGIN_M;
  const window = car._hwf.off <= sideOff + KEEP_MARGIN_M ? KEEP_S + PASS_S : KEEP_S;
  if (near.time * (1 + (state.misjudge ?? 0)) > window) return Infinity;
  // the road frame's offset of the driver's line frame (both + to the right of the way)
  const shift = car._hwf.off - (lineOff + lateralOf(car, path, nearIdx));
  return sideOff - shift;
}
