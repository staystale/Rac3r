// physics/steepground.ts - GROUND TOO STEEP TO DRIVE, AND FALLS (Deaf Valley's gorges,
// highway/gorge.ts; owner 11-09: "so you can crash fall in it ... use terrain to make it genuinely
// sloped"). The suspension (physics/loads.ts) only moves a car up and down: driven at a gorge's far
// side it lifted the car up the face as fast as it drove at it and flung it 14 m into the air, and
// a 15 m fall did nothing (tools/scratch/_gorgefall.mjs). So, with the world's other clamps
// (world/crossings.ts clampWorld - the velocity they take is an impact: damage.ts hit):
//   THE FACE     ground rising FACE_RISE m within FACE_AHEAD m in front of a car low on it
//                (steeper than ~56 deg - only a gorge's sides: a bowl's wall, an oval's back
//                slope, a ramp's lip are all under 0.75) is a wall: the speed into it goes, a
//                little bounce.
//   THE LANDING  a body meeting the ground faster than LAND_HURT m/s (loads.ts notes it: a ~6 m
//                fall, past any jump's landing) crashes: the ground takes LAND_GRAB of the speed
//                past that off its way (owner 11-09: "the bottom of the gorge shouldn't
//                automatically make you roll": the damage, and a crooked landing's own roll
//                chance).
import { heightAt } from '../world/terrain.ts';
import { noteHit } from './punctures.ts';

const FACE_AHEAD = 0.8, FACE_RISE = 1.2, FACE_BOUNCE = 0.15, SLOPE_STEP = 0.3;
const LAND_HURT = 13, LAND_GRAB = 0.8;
// s in the air before a landing counts (loads.ts)
export const LANDING_AIR = 0.25;

/** A car as the steep ground reads and stops it. */
interface SteepCar {
  x: number; y: number; vx: number; vy: number; zF: number;
  spec: { lf: number };
  _landV?: number; _hitKind?: string | null;
}

/**
 * Notes how fast an axle's body met the ground this step (physics/loads.ts), the hardest kept.
 * @param car the car
 * @param closing the body's speed toward the ground, m/s (negative: down onto it)
 */
export function noteLanding(car: object, closing: number): void {
  const steep = car as SteepCar;
  if (closing < -LAND_HURT) steep._landV = Math.min(steep._landV ?? 0, closing);
}

/**
 * THE FACE: ground rising like a wall just in front of a car low on it stops the car's speed into
 * it (the uphill way there), with a little bounce.
 * @param car the car
 */
export function steepClamp(car: SteepCar): void {
  const speed = Math.hypot(car.vx, car.vy);
  if (speed < 1) return;
  const wayX = car.vx / speed, wayY = car.vy / speed, reach = car.spec.lf + FACE_AHEAD,
    aheadX = car.x + wayX * reach, aheadY = car.y + wayY * reach;
  // against the ground under its front now (a car just put down - a spawn, a reset - has no body
  // height yet: a stage start on a hillside read as a wall) or its body if it is above that
  const front = heightAt(car.x + wayX * car.spec.lf, car.y + wayY * car.spec.lf);
  if (heightAt(aheadX, aheadY) - Math.max(car.zF, front) < FACE_RISE) return;
  const gradX = (heightAt(aheadX + SLOPE_STEP, aheadY) - heightAt(aheadX - SLOPE_STEP, aheadY))
      / (2 * SLOPE_STEP),
    gradY = (heightAt(aheadX, aheadY + SLOPE_STEP) - heightAt(aheadX, aheadY - SLOPE_STEP))
      / (2 * SLOPE_STEP),
    grad = Math.hypot(gradX, gradY);
  if (grad < 1e-6) return;
  const upX = gradX / grad, upY = gradY / grad, into = car.vx * upX + car.vy * upY;
  if (into <= 0) return;
  car.vx -= upX * into * (1 + FACE_BOUNCE);
  car.vy -= upY * into * (1 + FACE_BOUNCE);
  noteHit(car, 'rock');
}

/**
 * THE LANDING: a body that met the ground too fast (noteLanding) loses speed to it (the damage).
 * @param car the car
 */
export function landingClamp(car: SteepCar): void {
  const hard = -(car._landV ?? 0) - LAND_HURT;
  car._landV = 0;
  if (hard <= 0) return;
  const speed = Math.hypot(car.vx, car.vy);
  if (speed > 0.1) {
    const lose = Math.min(speed, hard * LAND_GRAB);
    car.vx -= (car.vx / speed) * lose;
    car.vy -= (car.vy / speed) * lose;
  }
  noteHit(car, 'rock');
}
