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
// blighty, flagfix, trailer, boxhold and gridlen passed 11-21.)
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
  // THE AI TUNE (owner 11-21, TODO 2 item 9): the speed plan brakes later and harder (ai/line.ts
  // K_BRAKE, tarmac and loose alike - the drivers correct), and the brake pedal holds through a
  // braking zone instead of dabbing on and off (ai/driverPedals.ts pedals)
  aitune: atLoad('aitune'),
  // F1 "SCORE THE DESTINATION" (owner 11-21, item 7): the gap picker scores a line more than one
  // swerve across by its own room ahead, not the part-way point it steers to this think
  // (ai/gapPick.ts lineScore) - MEASURED, the BOXED trace: a roomier line out of one think's
  // reach was 61 % of Thruston's boxed time, 16 % of the motorway's
  gapdest: atLoad('gapdest'),
  // F2 "COMMIT ONLY WHILE IT PAYS" (owner 11-21, item 7): while the line a driver chose is the one
  // holding it boxed, only a share of the gap picker's bonus for keeping that line - a sliding
  // scale per driver type (ai/tune.ts COMMIT_BOXED: the racers, the traffic's speeders); the
  // defaults keep today's behaviour until the owner picks the lean
  gapcommit: atLoad('gapcommit'),
  // THE ROLLING START'S GREEN (owner 11-21, item 10): each AI released at its own reaction after
  // the green (by skill and personality), a few jumping it (game/greenrelease.ts); the race
  // driver's start phase counted from its release, not the formation's first move
  // (ai/driverLane.ts)
  rollgreen: atLoad('rollgreen'),
  // THE HIGHWAY START, FANNED (owner 11-21: "they all drift to one side and weave back"): no dodge
  // plan kept while the start holds a car; in its start phase it holds its formation lane, going
  // round only a truly slower car, to its own column's side (ai/startFan.ts) - the endless road
  // only
  hwfan: atLoad('hwfan'),
  // RESET mends the tractor's trailer as it mends the tractor (game/session.ts doReset)
  trailheal: atLoad('trailheal'),
  // a lorry's, van's and bus's own side windows on its rolled side (render/carprofile.ts windows:
  // the Scanyah's cab showed none - its glass band was the screen's last 5 %)
  cabglass: atLoad('cabglass'),
  // the highway's lane dashes laid by the road's distance, not the canvas pattern's length: tiles
  // painted before and after the road window moved line up (render/lanedash.ts)
  dashphase: atLoad('dashphase'),
  // FLASHING 2: the lamps' flicker on the sim clock (physics/lampsim.ts); a flickering headlight -
  // yours or a racer's - flashes the traffic ahead, three flickers anger it as three flashes do,
  // and it chases whoever angered it; a dead headlight cannot flash (game/flashes.ts)
  lampflash: atLoad('lampflash'),
  // the GETAWAY STOCKHOLM scenery for the endless roads, step 1: its card, the city's stretches,
  // its lots of buildings behind noise walls, blue signs (highway/city.ts)
  stockholm: atLoad('stockholm'),
};
