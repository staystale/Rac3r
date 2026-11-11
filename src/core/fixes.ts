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
// dieatona, thrustonvenue, roofflaps, yasmarina, rocklook passed 11-10.)
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
  // ?hwstations=1: petrol stations on the other endless roads (owner 11-10: "petrol stations on
  // other highway levels (also reset spots)", services with their own slip road "yeah", the names
  // "perfect"): a ROADSIDE STATION in a lay-by now and then on the dual carriageway and the single
  // lane (SHALL, SMELL, ESS-NO, GULP, TAXACO), a reset spot as a lay-by is; a SERVICES (WELCOME
  // BRAKE, ROADTHIEF, EXTORTION) on the motorway, the interstate and the walled road - a side road
  // past a station and the services hall (highway/stations.ts, laybys.ts, extras.ts)
  hwstations: atLoad('hwstations'),
  // ?medianlamps=1: on a road with a central reservation (dual, motorway, interstate, walled) the
  // street lights stand in it - a TWIN-ARM column every 68 m, an arm over each carriageway -
  // instead of on the verges (owner 11-10: "lamps on the central reservation", "Instead then");
  // each side's light as before (a pool every 68 m), half the posts (highway/roadlamps.ts)
  medianlamps: atLoad('medianlamps'),
  // ?desertmore=1: Deaf Valley's junk from the same LITTER slider as every endless road, as much
  // of it (the shared litter, desert kinds: highway/litter.ts), its own heaps, shacks and skulls
  // scaled by the slider too and nearer the road; and the cactus in PATCHES, with more single ones
  // spread out further, every cactus by the slider too (owner 11-10: "I'm not seeing much road
  // side junk on Death Valley levels ... cactus should be in patches too and more single ones
  // spread out", "Junk levels should be controlled by the slider in test menu and should be
  // consistent across levels", "Obviously split by asthetic still", "The slider should affect the
  // amount of junk cactus / cow skulls and barrels and stuff"; highway/canyon.ts, litter.ts)
  desertmore: atLoad('desertmore'),
  // ?vergereset=1: a reset on a road with no hard shoulder goes to a lay-by just behind, else the
  // verge where you are (half on where there is no room), never onto the lane; and Deaf
  // Valley's lay-bys come oftener, every 160-260 m (owner 11-10: resets "seem to sometimes set on a
  // road", "isn't many lay-bys ... hard to make progress", "More reset spaces ... half on half off
  // is fine"; highway/vergeback.ts, highway/laybys.ts)
  vergereset: atLoad('vergereset'),
  // ?trafficeven=1: your way's traffic put back nearer ahead, as near as out of sight lets (owner
  // 11-10: "not enough cars on my side of the road and too many on the oncoming side"; ai/
  // trafficSpawn.ts spot); and the faster drivers put back behind you kept while they catch you
  // up, put back at their speed ("can cars on my side come up behind me still"; ai/trafficStep.ts)
  trafficeven: atLoad('trafficeven'),
  // ?speeders=1: now and then one of your way's cars a SPEEDER - the racing driver at its wheel at
  // 150-180 km/h, weaving through and cutting in, from behind or ahead (owner 11-10: "can we make a
  // small % of the traffic speed and get in the way", "They can jsut adopt the racing ai"; ai/
  // trafficSpeeder.ts)
  speeders: atLoad('speeders'),
  // ?breakdowns=1: now and then one of your way's cars has an issue - it indicates, slows and pulls
  // onto the hard shoulder (the verge, where there is room, on a road without one) and stops, its
  // hazards on; some already stopped there ahead (owner 11-10: "And pull into hard shoulders if
  // they have an issue"; ai/trafficBreak.ts)
  breakdowns: atLoad('breakdowns'),
  // ?bushflat=1: no hill shading on the bushes - they sit on top of the shaded ground, working the
  // same (owner 11-10: "Don't apply terrain to bushes it's making them look weird they can sit on
  // top / still working the same jsut a visual change"; render/glshade.ts, world/wear.ts bushAt)
  bushflat: atLoad('bushflat'),
  // ?sticksize=1: the steering stick's SIZE in STEERING CONTROLS, today's 38 px the least, up to
  // twice it (owner 11-10: "start size of the steering stick area should be a thing so user can
  // increase that - current size should be minimum"; core/steerfeel.ts size)
  sticksize: atLoad('sticksize'),
  // ?resethazard=1: a reset puts the car's hazard lights on for 3 s, the player's and an AI car's
  // (owner 11-10: "resets ... should put hazards on for 3 seconds"; game/resethazard.ts)
  resethazard: atLoad('resethazard'),
  // ?badwood=1: Goodwoody renamed BAD WOOD (owner 11-10: "Rename goodwoody to bad wood"; the level
  // id stays goodwoody: saved choices keep; world/levels/goodwoody-venue.ts)
  badwood: atLoad('badwood'),
  // ?hudon=1: every HUD piece on by itself where the difficulty allows it (owner 11-10: "Hud should
  // be on automatically if it can be on for that difficulty level"): the minimap, progress bar and
  // track temperature on in every mode (REAL still locks the minimap and the gauge off), the tyre /
  // damage diagram on; the device's earlier choices start afresh once (new keys), then are kept
  // (hud/minimap.ts, hud.ts, hud/layout.ts)
  hudon: atLoad('hudon'),
  // ?bathurst=1: Bathworst, the Mount Panorama Circuit (Bathurst, New South Wales) at 1/2 of
  // real length - the public road up the mountain and down again, its walls hard by the road,
  // the pits on the start straight; a world championship circuit (owner 11-10;
  // world/levels/bathurst-venue.ts)
  bathurst: atLoad('bathurst'),
};
