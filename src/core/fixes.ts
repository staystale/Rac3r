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
// seven, transfit, trophy, civvic, defunder, focust and launchramp passed 11-16.)
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
  // the highway traffic going for fuel that misses its station (not in the nearside lane in
  // reach, or the pumps taken) stays in the nearside lane for the next one (ai/trafficTrips.ts)
  fuelcarry: atLoad('fuelcarry'),
  // a chasing police car sounds a siren, the light bar's twin (game/sirens.ts, audiosiren.ts)
  siren: atLoad('siren'),
  // UNDER THE SKIN: what a lost panel shows - the engine and radiator in the bay, a corner's
  // suspension and drive shaft in a wing's well, the crash bar and radiator behind a bumper - by
  // each car's own layout (render/underskin.ts, carbits.ts mount / radiator)
  underskin: atLoad('underskin'),
  // the Focust read as a five-door HATCH from above: the roof almost to the back, a short steep
  // rear screen under its spoiler, no boot deck (render/newcarlooks2.ts FOCUST_CABIN)
  focustlook: atLoad('focustlook'),
  // the Renolt Cleo Cup (TOURING / Cup)
  cleo: atLoad('cleo'),
  // the Renolt Cleo RS 200 (the road Clio 200 Cup, ROAD / Hatch)
  cleoroad: atLoad('cleoroad'),
  // the Fjord Transfit LWB (a Transit L3 H3 RWD), drivable and in the traffic; with it the L2 is
  // named the Fjord Transfit MWB
  transfitlwb: atLoad('transfitlwb'),
  // the Fjord Transfit SWB (a Transit Mk7 T280 SWB, 2006-13), drivable and in the traffic; with it
  // the L2 is the Fjord Transfit MWB too
  transfitswb: atLoad('transfitswb'),
  // the Toyoter TS010 (a Toyota TS010 Group C car) and its PROTOTYPE class
  ts010: atLoad('ts010'),
};
