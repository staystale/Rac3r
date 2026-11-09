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
// aidodge, ailines, ailook, dodgefar, markjump passed 11-04; credits, bigbrands, crossings,
// fencedrag, tyresleep, burstcap, stackvary, linewall, tallfence, rollway, castlecumvenue,
// rollover, rollbody, snotterton, sidedraft passed 11-08; oultonpork, sillystone, runoff, laplen,
// oncoming, oultonrails, cadwallop, malarkey, medians, twoway, clearance, passcare, gantry,
// anglesleazy, goodwoody, croughed, jerseyover, shoulder, laybys, farlaybys, barrierends,
// hwpick, desertroom, spa passed 11-09.)
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
  // ?worldcat=1: TEST MODE lists the world championship circuits (Spa-Frankenchumps, Monzarella)
  // under WORLD CIRCUITS, not CIRCUITS (owner 11-09: "categorise stuff"; world/levels/category.ts)
  worldcat: atLoad('worldcat'),
  // ?spaforest=1: Spa-Frankenchumps in the Ardennes forest, 8000 trees (owner 11-09: yes to a
  // per-venue tree count; world/levels/spa-venue.ts, VenueSpec.trees)
  spaforest: atLoad('spaforest'),
  // ?offaim=1: an AI off its racing line holds its place across the ROAD - its heading the road's,
  // not the line's - so it no longer drifts with the line where the line swings across the road
  // (owner 11-09 on Spa: "lots of crashes with big grids", "I think it's the hair pin first
  // corner"; ai/driverSteps.ts steerAim)
  offaim: atLoad('offaim'),
  // ?holdoncoming=1: no oncoming traffic on a single carriageway (Deaf Valley) until the race has
  // started - the other way's cars join from out of sight ahead after the green (owner 11-09:
  // "no on coming traffic on Death Valley or any small single carriage way until after the race
  // has started"; ai/trafficReset.ts, trafficStep.ts)
  holdoncoming: atLoad('holdoncoming'),
  // ?dieatona=1: Dieatona (the Daytona parody) as a new venue at 1/2 of real length, the oval and
  // the road course (world/levels/dieatona-venue.ts; owner 11-08)
  dieatona: atLoad('dieatona'),
  // a stock car's roof flaps pop up when it travels backwards fast (physics/roofflaps.ts)
  roofflaps: atLoad('roofflaps'),
  // ?thrustonvenue=1: Thruston as the real venue (Thruxton) at 1/2 of real length
  // (world/levels/thruston-venue.ts; owner 11-08)
  thrustonvenue: atLoad('thrustonvenue'),
  // ?knobhillvenue=1: Knobhill as the real venue (Knockhill) at 1/2 of real length, the
  // rallycross (the Knobhill level) and the circuit (world/levels/knobhill-venue.ts; owner 11-09)
  knobhillvenue: atLoad('knobhillvenue'),
};
