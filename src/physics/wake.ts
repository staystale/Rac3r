// physics/wake.ts - THE WAKE (towplus, passed 11-02; owner: "you can do 1-4 behind a single
// switch": the slipstream ideas). Replaced contact.ts slipstream (AI stage 3) and keeps its tow:
// a car in another's wake loses up to DRAFT_MAX of its drag, most right behind.
//   1 DIRTY AIR  the follower's wings lose up to DIRTY_MAX of their downforce in the wake, so a
//                single-seater (big downforce) loses front and rear grip close behind; a road car
//                (almost none) barely notices. car.wakeDown, read by loads.ts.
//   2 THE PUSH   a car with another's nose within PUSH_GAP of its tail loses up to PUSH_MAX of
//                its own drag (the follower fills the low pressure behind it, as in a draft line).
//   3 THE SHAPE  the wake runs longer the faster the car making it goes (WAKE_LEN at WAKE_V,
//                x0.6 .. x1.6) and with a wider car; it is as wide as that car.
//   4 THE CUE    faint air streaks along any racer in a tow (render/particles.ts).
//   5 THE SIDE DRAFT (owner 11-08, ?sidedraft=1: "side drafting, Naffcar first"): two cars door to
//                door at speed - the one with the other's nose alongside its rear quarter loses
//                the clean air over its tail (up to SIDE_DRAG more drag, most with the nose at its
//                rear quarter), the one alongside gets a little pull (up to SIDE_TOW less) - so a
//                car can slow the one it is passing. Gone by SIDE_GAP m between their doors, from
//                DRAFT_V up to full at SIDE_V, as much as the car's flanks and tail catch the air
//                (SIDE_AIR: a stock car's flat flanks and spoiler most, a single-seater least).
// THE FADE (owner: "shouldn't the effectiveness of slipstreaming reduce the further away you
// are" / "make it more realistic please shorter tows"): it fell in a straight line to the wake's
// end (25 m behind at 200 km/h still cut 21 %); a real tow is strong within a car length or two
// and falls away fast, so it decays exponentially over WAKE_DECAY of the wake's length: at
// 200 km/h 8 m behind cuts ~28 %, 15 m ~15 %, 25 m ~6 %; at 100 km/h 8 m ~21 %, 15 m ~8 %.
// Every racer, the player too (sim.js: with AI on the track).
import { FIX } from '../core/fixes.ts';

const DRAFT_V = 12, DRAFT_MAX = 0.45, NOSE_GAP = 3;
const WAKE_LEN = 28, WAKE_V = 30, WAKE_WID_REF = 1.8;
const WAKE_DECAY = 0.25;
const DIRTY_MAX = 0.4;
const PUSH_GAP = 6, PUSH_MAX = 0.08;
const SIDE_DRAG = 0.2, SIDE_TOW = 0.06, SIDE_GAP = 1.2, SIDE_V = 30;
const SIDE_AIR: Record<string, number> = {
  naffcar: 1, 'muscle-rwd': 0.85, 'banger-f2': 0.8, 'saloon-rwd': 0.7, 'estate-4x4': 0.7,
  'wrz-awd': 0.65, 'rally-4x4': 0.65, 'rx-super': 0.65, 'drift-s13': 0.6, 'hatch-fwd': 0.55,
  'hatch-rwd': 0.55, 'kit-2l': 0.5, 'mini-fwd': 0.5, 'mikra-r1': 0.5, 'lambo-awd': 0.45,
  tractor: 0.3, 'grass-special': 0.2, 'track-rwd': 0.15, 'f2-rwd': 0.15,
};

interface WakeCar {
  x: number; y: number; vx: number; vy: number; heading: number;
  spec: { wid: number; len?: number; id?: string };
  dragMul?: number; wakeDown?: number;
}

/**
 * Where one car sits in another's wake.
 * @param car the car behind (maybe)
 * @param other the car in front (maybe)
 * @returns closeness along the wake (1 at the tail, decaying) and across it (0: not in it),
 *   and the gap ahead, m
 */
function inWake(car: WakeCar, other: WakeCar): { along: number; across: number; gap: number } {
  const none = { along: 0, across: 0, gap: Infinity };
  const speed = Math.hypot(other.vx, other.vy);
  if (other === car || speed < DRAFT_V) return none;
  const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
  const relX = other.x - car.x, relY = other.y - car.y, gap = relX * cosH + relY * sinH;
  const align = Math.cos(other.heading) * cosH + Math.sin(other.heading) * sinH;
  const wid = other.spec.wid || WAKE_WID_REF;
  const len = WAKE_LEN * Math.min(1.6, Math.max(0.6, speed / WAKE_V))
    * Math.sqrt(wid / WAKE_WID_REF);
  const lateral = Math.abs(-relX * sinH + relY * cosH);
  if (gap < NOSE_GAP || gap > len || align < 0.9 || lateral > wid) return none;
  return { along: Math.exp(-(gap - NOSE_GAP) / (WAKE_DECAY * len)), across: 1 - lateral / wid,
    gap };
}

/**
 * How much a car's flanks and tail catch the air beside it (SIDE_AIR; a car not listed: a hatch's).
 * @param car the car
 * @returns 0..1
 */
const sideAir = (car: WakeCar) => SIDE_AIR[String(car.spec.id || '').split('#')[0]] ?? 0.55;

/**
 * How far another car's nose sits alongside a car's rear quarter (the side draft): most at the
 * rear quarter, none past its tail or its middle, fading with the gap between their doors.
 * @param car the car whose tail loses its air
 * @param other the car alongside
 * @returns 0..1 (0: not alongside)
 */
function alongside(car: WakeCar, other: WakeCar): number {
  const speed = Math.hypot(car.vx, car.vy), cosH = Math.cos(car.heading),
    sinH = Math.sin(car.heading);
  if (other === car || speed < DRAFT_V
    || Math.cos(other.heading) * cosH + Math.sin(other.heading) * sinH < 0.9) return 0;
  const relX = other.x - car.x, relY = other.y - car.y, half = (car.spec.len || 4.5) / 2,
    // its nose along the car: -1 at the car's tail, 1 at its nose
    nose = (relX * cosH + relY * sinH + (other.spec.len || 4.5) / 2) / half,
    doors = Math.abs(-relX * sinH + relY * cosH) - (car.spec.wid + other.spec.wid) / 2;
  if (doors > SIDE_GAP || doors < -0.5 || nose < -1.2 || nose > 0.3) return 0;
  const place = nose < -0.5 ? (nose + 1.2) / 0.7 : (0.3 - nose) / 0.8;
  return place * (1 - Math.max(0, doors) / SIDE_GAP)
    * Math.min(1, (speed - DRAFT_V) / (SIDE_V - DRAFT_V));
}

/**
 * The side draft on every racer: more drag on a car with a nose alongside its rear quarter, a
 * little pull for the car alongside it.
 * @param cars the racers
 */
function sideDraft(cars: WakeCar[]): void {
  const more = cars.map(() => 0), pull = cars.map(() => 0);
  cars.forEach((car, i) => cars.forEach((other, j) => {
    const side = alongside(car, other);
    if (!side) return;
    more[i] = Math.max(more[i], SIDE_DRAG * side * sideAir(car));
    pull[j] = Math.max(pull[j], SIDE_TOW * side * sideAir(other));
  }));
  cars.forEach((car, i) => { car.dragMul = (car.dragMul ?? 1) * (1 + more[i]) * (1 - pull[i]); });
}

/**
 * One step of every racer's wake: the tow, the dirty air and the push.
 * @param cars the racers
 */
export function wakeStep(cars: WakeCar[]): void {
  const push = cars.map(() => 0);
  cars.forEach((car) => {
    let cut = 0, dirty = 0;
    cars.forEach((other, j) => {
      const wake = inWake(car, other);
      if (!wake.along) return;
      cut = Math.max(cut, DRAFT_MAX * wake.along * (0.5 + 0.5 * wake.across));
      dirty = Math.max(dirty, DIRTY_MAX * wake.along * wake.across);
      if (wake.gap < NOSE_GAP + PUSH_GAP) {
        push[j] = Math.max(push[j], PUSH_MAX * (1 - (wake.gap - NOSE_GAP) / PUSH_GAP)
          * wake.across);
      }
    });
    car.dragMul = 1 - cut;
    car.wakeDown = 1 - dirty;
  });
  cars.forEach((car, i) => { car.dragMul = (car.dragMul ?? 1) * (1 - push[i]); });
  if (FIX.sidedraft) sideDraft(cars);
}
