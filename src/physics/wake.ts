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
// THE FADE (owner: "shouldn't the effectiveness of slipstreaming reduce the further away you
// are" / "make it more realistic please shorter tows"): it fell in a straight line to the wake's
// end (25 m behind at 200 km/h still cut 21 %); a real tow is strong within a car length or two
// and falls away fast, so it decays exponentially over WAKE_DECAY of the wake's length: at
// 200 km/h 8 m behind cuts ~28 %, 15 m ~15 %, 25 m ~6 %; at 100 km/h 8 m ~21 %, 15 m ~8 %.
// Every racer, the player too (sim.js: with AI on the track).

const DRAFT_V = 12, DRAFT_MAX = 0.45, NOSE_GAP = 3;
const WAKE_LEN = 28, WAKE_V = 30, WAKE_WID_REF = 1.8;
const WAKE_DECAY = 0.25;
const DIRTY_MAX = 0.4;
const PUSH_GAP = 6, PUSH_MAX = 0.08;

interface WakeCar {
  x: number; y: number; vx: number; vy: number; heading: number;
  spec: { wid: number };
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
}
