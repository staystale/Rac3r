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
// contactcost dropped; passearly, passwide, trailroll, revroom and stagedone passed 11-22.)
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
  // A STAGE'S TYRE TRACKS (owner 11-22): the cars already through the start leave their wheels'
  // marks along the racing line, each its own wander, up to where each is placed
  // (game/stagetracks.ts)
  stagetracks: atLoad('stagetracks'),
  // NO EARLY STARTS ANYWHERE (owner 11-22: "fine if players can too" - one rule for every car):
  // START_EARLY 0 on every start, you and the AI (game/order.ts; a rally stage's is 0 already),
  // and no AI jumps the green of a rolling start (game/greenrelease.ts: its reaction kept)
  nojump: atLoad('nojump'),
  // A STAGE CAR PLACED AT ITS DRIVEN PACE (owner 11-22): a car started before you is placed where
  // its driven pace (the prediction / STAGE_DRIVEN_RATIO) has it, home only when that is past the
  // finish (game/grid.ts placeStageCar) - it had the prediction's pace for the part not driven
  stageplace: atLoad('stageplace'),
  // THE NEXT CAR AT THE LINE (owner 11-22): a stage's queued cars creep up a place as each one
  // goes, the next onto your start spot, and leave from a standstill on their own green; every
  // car on a stage (you too) timed from its own green (game/ai.ts, raceflow.ts, game/rules.ts)
  stageline: atLoad('stageline'),
  // THE START GANTRY'S LIGHTS (owner 11-22: the countdown and the green on every start gantry, a
  // prop not a banner): reds one a second, the green, dark otherwise; a stage's counts each car
  // down at the line (world/startlights.ts)
  gantrylights: atLoad('gantrylights'),
  // GHOST CARS (owner 11-22): in TEST MODE, on every track but the highways, the quickest lap or
  // stage run - this session's or the saved best per track, direction and car - played back as a
  // see-through car that is only drawn; a GHOST switch on the setup (on solo, off VS AI); the
  // fastest laps listed in SETTINGS > ACCOLADES (game/ghostcar.ts, ghostrun.ts, menu/accolades.ts)
  ghost: atLoad('ghost'),
  // SPIKES PEAK, THE HILL CLIMB, round 2 (owner 11-22: its own track type, the real course at half
  // scale): the road and its climb, in TEST MODE's track lists (world/levels/spikes.ts)
  spikespeak: atLoad('spikespeak'),
  // NO CATCH-UP SPIKE (perf 1, owner 11-22): a slow frame's sim no longer catches up in one burst -
  // the steps a frame runs stop once SIM_BUDGET_MS of them is spent (2 always); the time left over
  // carries to the next frames (game/loop.ts runSimSteps)
  spikecap: atLoad('spikecap'),
};
