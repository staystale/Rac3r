// world/hanging.ts - ?dmgmore2: PARTS LEFT HANGING, DRAGGING (the owner's damage item 4). A hit
// that would throw the EXHAUST may leave it hanging from its mount instead - by a chance that falls
// with the hit's size (about half of them overall) - its tail on the road: it drags a random
// 100-400 m (sparks off its end on hard ground, render/particles.ts), then drops and lies as the
// thrown exhaust always has. A torn BUMPER that leaves a piece hanging (world/torn.ts, as
// render/torncut.ts draws it) drags too - paint chips off its end, no sparks - and falls off by
// itself after a random 100-400 m, sooner the worse its end is damaged. A hit on that end knocks
// either off at once. The distance is the car's own travel (sim time); RESET mends it all.
import { FIX } from '../core/fixes.ts';
import { partHangs } from './torn.ts';
import { groundAt } from './wear.ts';

// m a hanging part drags before it drops: from HANG_M_MIN, up to HANG_M_SPAN more (owner: "a
// random distance in a range (100-400 m)")
const HANG_M_MIN = 100, HANG_M_SPAN = 300;
// the chance an exhaust is left hanging, by the hit's size (damage.ts: the damage it added,
// 0.5-1+ for a hit that throws parts): HANG_FROM less the size, held to HANG_MIN..HANG_MAX - the
// lighter the hit, the likelier it hangs (owner: "a chance that depends on the damage (about half
// overall)")
const HANG_FROM = 1.55, HANG_MIN = 0.2, HANG_MAX = 0.8;
// a roll's impact as a hit's size (the middle of a part-throwing hit's: half hang)
export const ROLL_HANG_SIZE = 0.75;
// a hanging bumper's drag cut by its end's damage: x (1 - BUMPER_DAMAGE_K x damage)
const BUMPER_DAMAGE_K = 0.5;
// m/s from which a hanging part on the road throws sparks or chips (as a dragging rim's)
export const HANG_DRAG_FROM = 2;
// m behind the tail a hanging exhaust's end touches the road
export const EXHAUST_TRAIL_M = 0.35;

/** A car as the hanging parts read it. */
export interface HangCar {
  x: number; y: number; vx: number; vy: number; heading: number;
  spec?: { len?: number; kind?: string };
  dmg?: number[];
  partLost?: string;
  partSpawn?: { corner: number; kind: string }[];
  exhaustHang?: number;      // m the hanging exhaust drags before it drops (0: none hanging)
  _exhaustNew?: boolean;     // left hanging this step (the same hit's other corner leaves it)
  exhaustDrag?: boolean;     // it is sparking on hard ground this step
  bumperHang?: number[];     // per damage corner, m its bumper's hanging piece drags (0: none)
  bumperDrag?: boolean[];    // per damage corner, that piece is shedding chips this step
  _hangSeen?: string;        // the lost parts last read for new hanging bumpers
}

/**
 * An open car (a single-seater, the buggy): its parts are thrown as before, none left hanging
 * (owner: "open cars stay as they are").
 * @param car the car
 * @returns open
 */
const isOpenCar = (car: Pick<HangCar, 'spec'>) => car.spec?.kind === 'track'
  || car.spec?.kind === 'grass';

/**
 * ?dmgmore2: whether an exhaust a hit would throw is left hanging instead (then it is gone from
 * the sprite, 'exhaust:2', and drags its random distance).
 * @param car the car
 * @param size the hit's size (the damage it added; a roll's ROLL_HANG_SIZE)
 * @param rnd the random source
 * @returns it hangs (the caller throws nothing)
 */
export function exhaustHangs(
  car: Pick<HangCar, 'spec' | 'partLost' | 'exhaustHang' | '_exhaustNew'>,
  size: number, rnd: () => number): boolean {
  if (!FIX.dmgmore2 || isOpenCar(car)) return false;
  const chance = Math.max(HANG_MIN, Math.min(HANG_MAX, HANG_FROM - size));
  if (rnd() >= chance) return false;
  car.exhaustHang = HANG_M_MIN + rnd() * HANG_M_SPAN;
  car._exhaustNew = true;
  car.partLost = (car.partLost ? car.partLost + ',' : '') + 'exhaust:2';
  return true;
}

/**
 * ?dmgmore2: a hit on an end knocks off what hangs there (it drops on the next step) - not what
 * the same hit has just left hanging (its other corner).
 * @param car the car
 * @param front the front end
 */
export function knockHanging(car: Pick<HangCar, 'exhaustHang' | 'bumperHang' | '_exhaustNew'>,
  front: boolean): void {
  if (!FIX.dmgmore2) return;
  if (!front && car.exhaustHang && !car._exhaustNew) car.exhaustHang = Number.MIN_VALUE;
  const hang = car.bumperHang;
  if (hang) for (let corner = 0; corner < 4; corner++)
    if ((corner < 2) === front && hang[corner] > 0) hang[corner] = Number.MIN_VALUE;
}

/**
 * The bumpers lost since the last look that leave a piece hanging start to drag.
 * @param car the car
 * @param rnd the random source
 */
function newHangingBumpers(car: HangCar, rnd: () => number): void {
  const lost = car.partLost || '';
  if (lost === car._hangSeen || isOpenCar(car)) return;
  car._hangSeen = lost;
  const hang = car.bumperHang || (car.bumperHang = [0, 0, 0, 0]);
  for (const entry of lost.split(',')) {
    const [kind, cornerText] = entry.split(':'), corner = Number(cornerText);
    if (kind !== 'bumper' || !partHangs(kind, corner) || hang[corner] > 0
      || lost.includes('drop:bumper:' + corner)) continue;
    hang[corner] = (HANG_M_MIN + rnd() * HANG_M_SPAN)
      * (1 - BUMPER_DAMAGE_K * Math.min(1, car.dmg?.[corner] ?? 0));
  }
}

/**
 * ?dmgmore2, each physics step: the hanging parts drag the car's travel off their distance; the
 * exhaust sparks on hard ground, a bumper's piece sheds chips; each drops when its distance runs
 * out - the exhaust thrown (as before), a bumper's piece gone from the car ('drop:bumper:<c>').
 * @param car the car
 * @param dt the step, s
 * @param rnd the random source
 */
export function stepHanging(car: HangCar, dt: number, rnd: () => number): void {
  newHangingBumpers(car, rnd);
  car._exhaustNew = false;
  const speed = Math.hypot(car.vx, car.vy), moved = speed * dt;
  car.exhaustDrag = false;
  if (car.exhaustHang) {
    car.exhaustHang -= moved;
    if (car.exhaustHang <= 0) {
      car.exhaustHang = 0;
      (car.partSpawn || (car.partSpawn = [])).push({ corner: 2, kind: 'exhaust' });
    } else if (speed >= HANG_DRAG_FROM) {
      const back = (car.spec?.len ?? 4) / 2 + EXHAUST_TRAIL_M;
      car.exhaustDrag = groundAt(car.x - Math.cos(car.heading) * back,
        car.y - Math.sin(car.heading) * back).surface.hard === true;
    }
  }
  const hang = car.bumperHang;
  if (!hang) return;
  const drag = car.bumperDrag || (car.bumperDrag = [false, false, false, false]);
  for (let corner = 0; corner < 4; corner++) {
    drag[corner] = false;
    if (!(hang[corner] > 0)) continue;
    hang[corner] -= moved;
    if (hang[corner] <= 0) {
      hang[corner] = 0;
      car.partLost = (car.partLost ? car.partLost + ',' : '') + 'drop:bumper:' + corner;
    } else drag[corner] = speed >= HANG_DRAG_FROM;
  }
}

/**
 * Mends the hanging parts (damage.ts damageInit: a reset).
 * @param car the car
 */
export function mendHanging(car: HangCar): void {
  car.exhaustHang = 0;
  car.exhaustDrag = false;
  car.bumperHang = [0, 0, 0, 0];
  car.bumperDrag = [false, false, false, false];
  car._hangSeen = '';
}
