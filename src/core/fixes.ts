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
// hwpick, desertroom, spa, offaim passed 11-09; nordschlep, worldcat, hwfinish,
// roundit, monza, spaforest, holdoncoming, lemans, suzuka, fences, desertjunk, knobhillvenue,
// dieatona, thrustonvenue, roofflaps, yasmarina, rocklook, badwood, hudon, resethazard, sticksize,
// bushflat passed 11-10; trafficeven, speeders, breakdowns, vergereset, desertmore, bathurst,
// medianlamps, hwstations, desertroads, drivebridges passed 11-11; roadparity, bridgecars,
// railbridges, roadtunnels, wobbly, stadeprance, police, trainlights, moveover, roadrage,
// stationstops, carcache, carcull, coverlight passed 11-12; nighthw, exitpuns, hjfirs, rollhold,
// stuckreset, croughedrx, tiledensity, aipace (its live pause-menu dials removed), aislide passed
// 11-15; gpustat (now always with ?report=1), hwtrips, pembreezy, and the new cars porch,
// seven, transfit, trophy, civvic, defunder, focust and launchramp passed 11-16; then focustlook,
// cleo (as the Clio III Cup), cleoroad, transfitlwb, transfitswb, saxo, strange, saxovtr,
// fuelcarry and rollguard passed 11-16; then ts010 (with its PROTOTYPE class), tesla,
// routemonster and m4gt3 passed 11-16; then corolla, reversefix, f1menu, r13, ibiza and a4avant
// passed 11-16; lowrange, dmgmore, transitcustom, e36peak and schoolbus passed 11-17; dmgmore2,
// marktrack, scanyah (the tractor) and tipping passed 11-17; resetclean, lamps, fpshud, marksage
// blighty, flagfix, trailer, boxhold and gridlen passed 11-21; rollgreen and hwfan passed 11-21;
// hazard, softback, brakepedal, gapdest and revstuck passed 11-22, aitune, gapcommit and
// contactcost dropped; passearly and passwide passed 11-22.)
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
  // Pembreezy RX's racing line kept further from the edge on its gravel (Level.looseLineMargin,
  // ai/line.ts looseLimits): the AI ran wide off its S-bends' exits into the bales
  pbzline: atLoad('pbzline'),
  // the AI's held drift on loose ground not held while the car is over its speed plan: it brakes
  // first (ai/driverPedals.ts pedals; the drift held its throttle and no brake before)
  driftbrake: atLoad('driftbrake'),
  // a chasing police car sounds a siren, the light bar's twin (game/sirens.ts, audiosiren.ts)
  siren: atLoad('siren'),
  // THE HILL CLIMB'S GRADE, step 1 (owner 11-22: a real 7 % climb): the endless road rising
  // HILL_GRADE along its length (highway/hillgrade.ts) - the engine piece, measured alone
  hillgrade: atLoad('hillgrade'),
  // THE TRAILER TIPS AND ROLLS (owner 11-22: realistic, ~0.45 g): its own two-wheel state, over
  // past its balance - the pin snaps, it rolls and slides on its own (physics/trailroll.ts)
  trailroll: atLoad('trailroll'),
  // REVERSE OUT WITH ROOM (owner 11-22: "they don't reverse quick enough ... and they also don't
  // reverse enough to steer clear"; "reverse quicker rather than resetting"): held by a STOPPED
  // car in my way, stuck after 1.5 s (not 4), and still with a car within 1 m of my nose, a reverse
  // after 1.5 s (not 2.5); the reverse goes on until there is a car length and
  // the lock's room to it (at most 3 s, or a car close behind), the nose swung away from it
  // (ai/driveOut.ts, ai/revRoom.ts)
  revroom: atLoad('revroom'),
  // A STAGE CAR ALREADY HOME (owner 11-22, fix (a)): a car that started so far ahead of you that
  // its predicted run is over before your green is not on the road - it is home, its predicted
  // time its result, like a real rally (game/grid.ts spawnAI; it was placed past the finish, or
  // round the racing line back at the start line with its old start time)
  stagedone: atLoad('stagedone'),
};
