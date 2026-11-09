// world/levels/sillystone-venue.ts - SILLYSTONE, a NEW venue (?sillystone=1, world/venue.ts):
// Silverstone (Northamptonshire) from OpenStreetMap (venues/sillystone.ts) at 1/2 of real length
// with the 13 m road, two layouts one venue sharing its scenery: the GP (the Arena layout since
// 2011, its pits in the Wing on the Hamilton Straight) and the National (Woodcote, Copse, Maggotts,
// Brooklands and Luffield, its own pits on the old pit straight). Checked against Wikipedia (GP
// 5.891 km, National 2.639 km; the OSM loops read 5887 / 2638 m), OSM's start / finish node,
// both its pit lanes, the stands, the Wing, the footbridges and tunnels, and aerial photographs.
// The International is not built: its links through the Arena are mapped only as estimates. North
// up, the GP clockwise. Flat: the old airfield.
import { SILLYSTONE_VENUE } from "./venues/sillystone.ts";
import { venueLap, venueLevel } from "../venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level } from "../types.ts";

// the venue's name (a working name until the owner picks), in one place
export const SILLYSTONE = 'Sillystone';

export const SILLYSTONE_SPEC: VenueSpec = {
  id: 'sillystone',
  data: SILLYSTONE_VENUE,
  share: 0.5,
  // m: the real road (OSM: 15 m on Wellington Straight and Brooklands)
  realRoadM: 15,
  calibrate: { layout: 'gp', realLapM: 5891 },
  // the GP's start / finish on the Hamilton Straight by the Wing (OSM's start / finish node); the
  // National's on the old pit straight by its pits
  start: [-352.5, 240.8],
  starts: { national: [120, -812] },
  // (both straights are a few points on the map: the line where the spot's foot is on it)
  startOnLine: true,
  // the Wing's pit lane (the GP's) and the National pits' - both stand for every layout
  pitLane: ['International pit lane', 'National pit lane'],
  // the Wing's pit entry runs inside Club, well inside the bend: laid as mapped there
  pitCuts: true,
  // m (game): Luffield, the Loop and Vale are tighter than the venue's least radius
  minR: 11,
  // the hand finish (game m): the long service road down the west car parks ran through the
  // paddock buildings (their boxes at our scale) - left out, its top laid back by hand to join the
  // two roads that met it there; a farm track cut short by the map's reach (the road it left
  // carried into the car park beside it) and an access road doubling the one beside it left out
  finish: { drop: [[-280, -450], [19, -563], [136.6, 42.2], [-2, -466], [128, 72]],
    roads: [{ pts: [[-398, -529], [-394, -545], [-384, -562], [-369, -577], [-352, -588],
      [-338, -593], [-330, -590], [-326, -582]] }, { pts: [[-283, -259], [-282, -265]] },
    { pts: [[-4, -463], [8, -457]] }] },
  hills: [],
  // no viewing banks: a bank brings a catch fence, and no source shows one
  banks: [],
  // the edge as the real circuit's: Armco where OSM maps its rails
  followRails: true,
  // the boards on the barriers by the Wing, Copse, Stowe and Club (the register's brands)
  boards: [
    { at: [-420, 330], label: 'SILLYSTONE' },
    { at: [380, -800], label: 'PIRRELLY' },
    { at: [-60, 860], label: 'DUNFLOP' },
    { at: [-470, 520], label: 'GOOD YEAH' },
  ],
  // Silverstone's first race meeting, 1948
  seed: 1948,
};

// the two layouts of the one venue, sharing its scenery - each built on first use (world/load.ts
// buildLevel)
const layoutLevel = (layout: string, levelId: string, name: string): Level =>
  ({ id: levelId, name, venue: SILLYSTONE,
    _lap: () => venueLap(SILLYSTONE_SPEC, layout),
    _build: () => venueLevel(SILLYSTONE_SPEC, layout, levelId, name) } as Level);
export const SS_LEVELS: Level[] = [
  layoutLevel('gp', 'sillystone', `${SILLYSTONE} GP`),
  layoutLevel('national', 'sillystone-national', `${SILLYSTONE} National`),
];
