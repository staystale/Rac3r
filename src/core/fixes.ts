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
// medianlamps, hwstations, desertroads, drivebridges passed 11-11.)
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
  // ?roadparity=1: every endless road built alike, only its look apart (owner 11-11: "Walled
  // levels should work the similar as possible to other highway levels", Deaf Valley "both types
  // should work the same just have a asthetic difference"): the road dressed DRESS_LAG behind its
  // newest point, so a junction is laid ahead before the walls, rock and lamps there; junctions
  // on the walled road (its wall open at the slips); Deaf Valley's exits, services, bridges and
  // junctions by the countryside's rules, the rock walls opened where they pass - only a gorge
  // keeps them off (highway.ts, extras.ts, junctions.ts, canyon.ts)
  roadparity: atLoad('roadparity'),
  // ?bridgecars=1: real traffic cars over the endless road's road bridges (owner 11-11: "Real
  // traffic cars"): each bridge's road a loop - up its left lane, over the deck, round a turning
  // place and back - driven by the autopilot through the traffic's physics; asleep far from you
  // (ai/trafficBridge.ts)
  bridgecars: atLoad('bridgecars'),
  // ?railbridges=1: the endless road's rail bridges drivable along their track - their narrow deck
  // between its walls, on ballast - and their train meets the cars on it (owner 11-11: "Rail
  // bridges drivable", "the train can hit you"): the train placed by the world's sim clock
  // (world/trains.ts, worldclock.ts, crossings.ts, highway/bridgeways.ts)
  railbridges: atLoad('railbridges'),
  // ?roadtunnels=1: now and then a road under the endless road in a tunnel instead of over it on a
  // bridge (owner 11-11: "Road tunnels too"): a portal each side, the road dipping under the
  // motorway between them - the venues' drivable tunnel (world/crossings.ts), its approach roads
  // as a bridge's (highway/extras.ts buildUnderpass, bridgeways.ts)
  roadtunnels: atLoad('roadtunnels'),
  // ?wobbly=1: Wobbly Stadium, the Race of Champions' track at Wembley (2007-08) - two lanes
  // interwoven round the bowl, one crossover bridge, so a car racing it covers both (TODO.md
  // RALLYCROSS > NEW TRACKS; world/levels/wobbly-venue.ts)
  wobbly: atLoad('wobbly'),
  // ?stadeprance=1: Stade de Prance, the Race of Champions' track in the Stade de France
  // (2004-06) - as Wobbly Stadium's, two lanes interwoven round an oval bowl, one crossover
  // bridge (world/levels/stadeprance-venue.ts)
  stadeprance: atLoad('stadeprance'),
  // ?police=1: police on the endless roads (TODO.md ROUND 4, agreed 11-11): police cars in the
  // traffic, cruising either way or waiting at the roadside (a forecourt, a lay-by, the hard
  // shoulder); a heat of 1-3 stars from a speed camera, speeding near one, a crash, flashing your
  // lights or an unsignalled lane change in sight of one, a pile-up; as many chase you (the racing
  // AI, you its target, ramming harder at each star); out of sight 10 s and they give up, boxed in
  // and stopped 3 s and you are BUSTED (ai/trafficPolice.ts, ai/policeHeat.ts, game/police.ts)
  police: atLoad('police'),
};
