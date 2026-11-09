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
// anglesleazy, goodwoody, croughed passed 11-09.)
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
  // ?jerseyover=1: a Jersey barrier rolls most cars that hit it fast - every one at 100 mph - and
  // throws most of those over the top into the other carriageway (owner 11-09: "There should be a
  // high chance to roll over jersey barrier - hitting it over 100mph should flip you and have a
  // high chance to allow you over it into on coming traffic"; world/jersey.ts)
  jerseyover: atLoad('jerseyover'),
  // ?holdoncoming=1: no oncoming traffic on a single carriageway (Deaf Valley) until the race has
  // started - the other way's cars join from out of sight ahead after the green (owner 11-09:
  // "no on coming traffic on Death Valley or any small single carriage way until after the race
  // has started"; ai/trafficReset.ts, trafficStep.ts)
  holdoncoming: atLoad('holdoncoming'),
  // ?shoulder=1: every reset on the endless roads - the R key, the going-wide guard, an AI put
  // back - on our hard shoulder, facing up the road (owner 11-09: "Resetting should start up in
  // the hard shoulder only"; highway/road.ts shoulderOff)
  shoulder: atLoad('shoulder'),
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
