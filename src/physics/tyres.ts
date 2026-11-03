// Tyre forces: an axle's grip (load sensitivity, the aero fixes), the relaxation lag, ploughing and
// brush, and a tyre's grip on a surface. The force law itself and the wheels it turns:
// physics/wheelspin.ts (the driving root fix).

import { CORNER_OF_WHEEL } from '../world/wheels.ts';
import type { Spec, Tyre } from '../cars.ts';
import { TUNE, tyreGrip } from '../vehicle.ts';
import type { Car } from '../vehicle.ts';
import { wornGrip } from './tyrewear.ts';

// Suspension rate and damping are PER CAR, in cars.js (susF / susZ) — see the note there.
export const LOAD_MAX = 2.6;

// PLOUGHING (loose surfaces). See step 7b.
// sideways bulldozing vs forwards. Going in sideways digs in far harder.
const PLOUGH_LAT = 2.2;

const PLOUGH_VREF = 14;        // m/s at which ploughing reaches full strength

// fraction of full force still there at walking pace, so you get STUCK
const PLOUGH_CRAWL = 0.55;

// BRUSH (bushes: surface.brush, 1/s): drag proportional to speed above BRUSH_VREF m/s, fading
// to nothing at a crawl (a car pushes through a bush at walking pace; at speed it ploughs through
// stems). Proportional to speed, so each metre of bush costs ~brush m/s at any speed.
const BRUSH_VREF = 8;

const RELAX_LEN = 0.55;        // m of rolling before a tyre develops its lateral force

export const ALPHA_PEAK_MIN = 0.10;   // rad (~5.7 deg); never peak earlier than this

/** Per-step values shared by the tyre and stability blocks of step. */
export interface AxleTick {
  mass: number; gravity: number; muBase: number; longK: number; peakK: number;
  latFade: number; dt: number;
}

/** One axle's force and state: what the wheel law (wheelspin.ts) returns and step reads. */
export interface AxleForce {
  Fx: number; Fy: number;       // N, in the wheel's frame (the front's turned by the steering)
  FyMax: number;                // N: the lateral peak (its sliding share past the peak)
  sliding: boolean;             // past TUNE.slideAt x the peak (marks, squeal, the overlay)
  sat: number;                  // 0..1 of the peak
  spinning: boolean;            // a driven wheel running well ahead of the road
  slipSpeed: number;            // m/s the contact patch slips (marks, squeal, heat)
}

/** Load-sensitive friction and effective cornering stiffness of one axle. */
export function axleGrip(
  car: Car, carSpec: Spec, axleLoad: number, FzNom: number, cornering: number,
  muBase: number, longK: number, gripT: number,
) {
  // TYRE LOAD SENSITIVITY — real, standard tyre behaviour, and its absence was the root of the
  // high-speed spin. Grip is NOT proportional to load: a tyre's coefficient of friction FALLS as
  // it is loaded, so doubling the load gives roughly 1.7x the grip, not 2x.
  //
  // Why it fixes the spin: a decelerating sliding car has a destabilising yaw moment of
  // mu*transfer*L (derived, and measured as a permanent +341 N.m that rotated the car forever).
  // That term exists ONLY because the loaded front axle was generating proportionally MORE force
  // than the unloaded rear. With load sensitivity the front gains less and the rear loses less,
  // and the moment largely cancels. This is also the reason lateral load transfer changes a real
  // car's balance at all — the single most important tyre property for handling, and it was
  // missing.
  //
  // AERO FIX: Downforce adds massive Fz. If we apply standard load sensitivity to downforce,
  // mu plummets and the wings do nothing. We must separate mechanical load (which penalizes mu)
  // from aero load (which just adds grip). We approximate this by limiting the load ratio.
  const loadRatio = FzNom > 1 ? axleLoad / FzNom : 1;
  // Cap the load ratio penalty so massive downforce doesn't destroy the friction coefficient.
  // We only want to penalize mechanical weight transfer (which rarely exceeds 1.8x static load).
  const cappedLoadRatio = Math.min(loadRatio, 1.8);
  const muL = muBase * (1 - TUNE.loadSens * (cappedLoadRatio - 1));
  // gripT: tyre temperature, hard surfaces only
  const muEff = Math.max(muBase * 0.35, muL) * gripT;
  const FmaxRoll = muEff * axleLoad * car.mods.gripLong * longK;
  const FmaxSlide = muEff * carSpec.slideGrip * (carSpec.tyre && carSpec.tyre.slide || 1)
      * axleLoad * car.mods.gripLong * longK;
  
  // SECOND AERO FIX: Cornering stiffness (Ca) must scale with vertical load.
  // The peak slip angle is (Fmax / Ca). If Fmax triples due to downforce but Ca stays fixed,
  // the peak slip angle moves from 7 degrees to 21 degrees. You would never reach the peak grip
  // unless you were drifting an F1 car. Scaling Ca with load keeps the peak angle realistic.
  const caEff = cornering * loadRatio;
  return { muEff, FmaxRoll, FmaxSlide, caEff };
}

/**
 * Section 7b of step: gravel-trap ploughing, a retarding force per axle along that axle's own
 * contact velocity. All zero on surfaces that do not plough.
 */
export function ploughingForces(car: Car, carSpec: Spec, mass: number, vLong: number, vLat: number,
    loadKF: number, loadKR: number) {
  // PLOUGHING - what makes a gravel trap a gravel trap (requirement: the gravel trap should
  // actually work like a gravel trap, slow you down, grab your wheels).
  //
  // Lower grip alone does NOT model gravel. Gravel stops you because the wheels SINK and bulldoze a
  // wedge of stones ahead of themselves, which is a retarding force that has nothing to do with
  // friction at all: it does not care about vertical load the way mu*Fz does, it does not care
  // whether you are braking, and you cannot steer out of it. The tyre friction (mu 0.55) is
  // separate and says you also cannot brake or accelerate well — both are true at once, which is
  // why a gravel trap works.
  //
  // Applied PER AXLE along that axle's own contact velocity, which gives the "grabs ya wheels" part
  // for free: a yawed car has different velocity directions at each end, so the two forces are not
  // parallel and their moment about the CG hauls the car straight. And because the lateral
  // component is amplified, going in sideways digs in far harder than going in straight — which is
  // the real behaviour, and the reason a spun car stops dead in the gravel.
  //
  // It reaches here only as car.surface.plough, so vehicle.js still does not know what gravel is.
  // a mud tread ploughs less (cars.ts ploughK; K12, passed 11-03)
  const plough = (car.surface.plough || 0)
    * (carSpec.tyre && carSpec.tyre.ploughK ? carSpec.tyre.ploughK : 1);
  let FpxF = 0, FpyF = 0, FpxR = 0, FpyR = 0;
  if (plough > 0) {
    // Still strong at a crawl (PLOUGH_CRAWL of full), so you get STUCK rather than gently coasting
    // out.
    const spAll = Math.hypot(vLong, vLat);
    const scale = PLOUGH_CRAWL + (1 - PLOUGH_CRAWL) * Math.min(1, spAll / PLOUGH_VREF);
    // share = static load share, lk = this end's suspension load: airborne over gravel ploughs
    // nothing.
    const ploughForce = (velLong: number, velLat: number, share: number, load: number) => {
      const sp2 = Math.hypot(velLong, velLat);
      if (sp2 < 0.05) return [0, 0];
      const Fmag = mass * share * plough * scale * Math.min(1, load);
      return [(-velLong / sp2) * Fmag, (-velLat / sp2) * Fmag * PLOUGH_LAT];
    };
    [FpxF, FpyF] = ploughForce(vLong, vLat + carSpec.lf * car.yawRate, carSpec.lr / carSpec.L,
        loadKF);
    [FpxR, FpyR] = ploughForce(vLong, vLat - carSpec.lr * car.yawRate, carSpec.lf / carSpec.L,
        loadKR);
  }
  const brush = car.surface.brush || 0;
  if (brush > 0) {
    const brushF = brushForce(mass * (carSpec.lr / carSpec.L) * brush, vLong,
      vLat + carSpec.lf * car.yawRate);
    const brushR = brushForce(mass * (carSpec.lf / carSpec.L) * brush, vLong,
      vLat - carSpec.lr * car.yawRate);
    FpxF += brushF[0]; FpyF += brushF[1]; FpxR += brushR[0]; FpyR += brushR[1];
  }
  return { FpxF, FpyF, FpxR, FpyR };
}

/**
 * The brush drag on one end of the car (bushes): against that end's velocity, proportional to
 * speed above BRUSH_VREF and fading as speed squared below it. The body meets the stems, so it
 * does not depend on the tyre load.
 * @param massBrush the end's mass share x the surface's brush (kg/s)
 * @param velLong the end's forward velocity, m/s
 * @param velLat the end's sideways velocity, m/s
 * @returns [forward, sideways] force, N
 */
function brushForce(massBrush: number, velLong: number, velLat: number): [number, number] {
  const speed = Math.hypot(velLong, velLat);
  if (speed < 0.05) return [0, 0];
  const Fmag = massBrush * speed * Math.min(1, speed / BRUSH_VREF);
  return [(-velLong / speed) * Fmag, (-velLat / speed) * Fmag];
}

/**
 * Tyre relaxation section of step: lags each axle's lateral force behind its slip angle by a
 * rolling distance and writes the lagged Fy back onto both axle outcomes.
 */
export function relaxAxleForces(car: Car, dt: number, vLong: number, vLat: number,
    frontAxle: AxleForce, rearAxle: AxleForce) {
  // TYRE RELAXATION LENGTH — real, standard, and its absence was the turn-in bug.
  //
  // A tyre does not develop its lateral force the instant a slip angle appears: the carcass has to
  // deflect, which takes a ROLLING DISTANCE (the relaxation length, ~0.5 m) rather than a time. So
  // the lag is RELAX_LEN / v — sharp at speed, soft when slow, exactly as in a real car.
  //
  // MEASURED BUG, (requirement: braking when turning... it slides weird): without it the
  // FRONT reached full grip instantly at turn-in while the rear was still at zero — dumped FyF
  // 10178 N against FyR -89 N, a net yaw moment of +12658 N.m that spun the car up to 0.66 rad/s
  // before the rear contributed anything at all. Four of five cars then rotated past 90 deg. Brake
  // force made no difference to it (identical at 1.35 g and 0.90 g), which is what ruled the brakes
  // out.
  const relaxTau = RELAX_LEN / Math.max(3, Math.hypot(vLong, vLat));
  const relaxK = 1 - Math.exp(-dt / relaxTau);
  car.FyFlag += (frontAxle.Fy - car.FyFlag) * relaxK;
  car.FyRlag += (rearAxle.Fy - car.FyRlag) * relaxK;
  frontAxle.Fy = car.FyFlag;
  rearAxle.Fy = car.FyRlag;
}

/**
 * The grip an axle's two tyres give from their temperature (hard ground only) and, with tyre
 * wear, how worn they are (any ground; worse when wet).
 * @param car the car
 * @param carSpec its spec
 * @param first the axle's first tyre index (0 front, 2 rear)
 * @returns the grip factor
 */
export function axleTyreGrip(car: Car, carSpec: Spec, first: number): number {
  const temps = car.tyreT, worn = car.tyreWear;
  const heat = car.surface.hard ? axleHeatGrip(car, carSpec, temps, first) : 1;
  return heat * (worn ? wornGrip(worn[first], worn[first + 1], car.surface.wetK || 0) : 1);
}

/**
 * An axle's grip by its tyres' temperatures: the mean of its two, or the one left when a wheel is
 * lost (a lost wheel's tyre reads 0, tyreheat.ts; the loss itself is damage.ts's grip cut).
 * @param car the car
 * @param carSpec the car spec
 * @param temps the four tyre temperatures, C
 * @param first the axle's first tyre index (0 front, 2 rear)
 * @returns the grip multiplier
 */
function axleHeatGrip(car: Car, carSpec: Spec, temps: number[], first: number): number {
  const off = car.wheelOff;
  const goneA = !!off && off[CORNER_OF_WHEEL[first]];
  const goneB = !!off && off[CORNER_OF_WHEEL[first + 1]];
  if (goneA !== goneB) return tyreGrip(temps[goneA ? first + 1 : first], carSpec);
  return (tyreGrip(temps[first], carSpec) + tyreGrip(temps[first + 1], carSpec)) / 2;
}

/**
 * A tyre's grip factor on a surface: its own number for the ground (a puddle or damp ground reads
 * the ground under the water); on WET HARD ground it moves toward the tyre's WET number by how wet
 * (rain tyres bite, slicks slide), while wet loose ground keeps the tyre's own number for it.
 * @param tyre the fitted tyre
 * @param surface the surface under the car
 * @returns the grip factor (1 = Pre-Spun)
 */
export function tyreGripOn(tyre: Tyre,
    surface: { id: string; under?: string; wetK?: number; gripWetK?: number; hard?: boolean },
): number {
  const own = tyre.bySurf![surface.under || surface.id] ?? 1;
  // damp ground asks only a share of the wet grip, a puddle all of it (world/wet.ts)
  const wetK = surface.gripWetK ?? surface.wetK ?? 0;
  return wetK > 0 && surface.hard ? own + ((tyre.grip.wet ?? 1) - own) * wetK : own;
}
