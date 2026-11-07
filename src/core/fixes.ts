// core/fixes.ts - FIXES UNDER TEST: each behind its own ?switch for the owner's phone test. On the
// owner's OK a fix becomes the default, its flag here and the old path are deleted (one system).
// (The 11-01 round - wheelgone, heavywet, menureset, menucar, ainumbers, markage, treenight,
// hwsnow - the driving root fix (wheelspin), evenlap, flatsize and the realism round - the K13
// dials, pedalramp, lockfade, spinmarks, smokefade, dustlinger, musclegears - and smokeover,
// heatease, flatgrip, towplus passed 11-02;
// aicool, smokeearly, airfx, smokelinger, aidust, realcars, jokerhint, puffpool, pitsolid,
// muscletyres, namefix, bhbridges,
// menustyle, testgarage, ai10, k12, resetin, belly, agtyre, ai20, aifast, aisafe passed 11-03;
// drycover, rimsoft, bushmark, leafpop, aireact, skillband,
// bhquiet, aiweave, jokerflow, aisliders, hudlean, aibands, puffroom, aigrip,
// aidodge, ailines, ailook, dodgefar, markjump passed 11-04.)
import { envValue } from './debug.ts';

/**
 * A switch read as this module loads: the circuits are traced as their level modules load,
 * before main.ts copies the settings in. The page's ?name=1, or NAME=1 for the node tools.
 * @param name the switch
 * @returns true when on
 */
export function atLoad(name: string): boolean {
  const where = (globalThis as { location?: { search?: string } }).location;
  return new URLSearchParams((where && where.search) || '').get(name) === '1'
    || envValue(name.toUpperCase()) === '1';
}

/**
 * A numeric switch read as this module loads (a test dial): the page's ?name=0.5, or NAME=0.5
 * for the node tools; clamped to 0..1, 0 when absent.
 * @param name the switch
 * @returns the dial, 0..1
 */
export function dialAtLoad(name: string): number {
  const where = (globalThis as { location?: { search?: string } }).location;
  const raw = new URLSearchParams((where && where.search) || '').get(name)
    ?? envValue(name.toUpperCase());
  const value = Number(raw);
  return raw == null || !Number.isFinite(value) ? 0 : Math.min(1, Math.max(0, value));
}

/** The switches under test, all off on the plain link. */
export const FIX = {
  // ?hwlanes=1: a line may have LANES - on the highway every lane is as good as the middle, so a
  // driver keeps the lane it is in (nothing pulls it to the middle: the start's blend onto the line
  // and the gap picker's cost for leaving it count from the nearest lane) (ai/roadLine.ts lanes;
  // owner 11-07: "it's causing all the ai to swarm to the centre upon start and it's a mess")
  hwlanes: atLoad('hwlanes'),
  // ?bigparts=1: worse crashes throw the car's own exhaust, bonnet, boot lid / spoiler, a mirror,
  // rarely its engine; a wheel off takes its wishbone / strut - each as heavy, as big and as sharp
  // (punctures) as the thing is (carbits.ts, world/debris.ts bigParts; owner 11-07)
  bigparts: atLoad('bigparts'),
  // ?partsoff=1: a small chance a smaller knock knocks a part off, and a lost part GONE from the
  // car (only its bare structure left) - world/debris.ts SMALL_P, render/carparts.ts (owner 11-07)
  partsoff: atLoad('partsoff'),
  // ?f1aero=1: the F1 / F2's real downforce, brakes and wheel weight (carreal.ts F1_AERO)
  f1aero: atLoad('f1aero'),
};
