// world/levels/lemans-venue.ts - LE MANKY, a NEW venue (world/venue.ts; owner 11-09: the world
// championship circuits - a SIMPLE first build of the long tracks, to try the frame rate and the
// feel on the phone): the Circuit de la Sarthe (Le Mans, France) from OpenStreetMap
// (venues/lemans.ts) at 1/2 of real length with the 13 m road - the 24-hour lap: the start
// straight, the Dunlop curve and chicane, under the Dunlop bridge, the Esses, Tertre Rouge, down
// the Hunaudieres (the "Mulsanity" straight, owner's name) through its two chicanes to Mulsanne
// corner, Indianapolis, Arnage, the Porsche curves, Maison Blanche and the Ford chicanes. Most of
// the lap is closed public road (the D338, D140 and D139: tools/venues/lemans.json roadRace).
// Checked against Wikipedia (13.626 km; the OSM lap reads 13627 m) and aerial photographs (ESRI
// World Imagery). SIMPLE: the lap, its barriers (the walls and fences OSM maps beside the track,
// followed as rails), the woods at the venues' usual tree count and a grid on the start straight
// - no pit lane, no roads, buildings, stands or car parks (tools/venues/lemans.json leaveOut), no
// Bugatti circuit. EU-DEM heights (25 m) fitted as 25 hills (rms 0.8 real m on the lap): 44 m at
// the Virage du Karting up to 83 m at the Dunlop bridge. North up, the lap clockwise.
import { LEMANS_VENUE } from "./venues/lemans.ts";
import { venueLap, venueLevel } from "../venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level } from "../types.ts";

// the venue's name (the owner's brief 11-09), in one place
export const LE_MANKY = 'Le Manky';

export const LEMANS_SPEC: VenueSpec = {
  id: 'lemanky',
  data: LEMANS_VENUE,
  share: 0.5,
  // m: the real road (13 m on the start straight, the public roads a little narrower)
  realRoadM: 12,
  calibrate: { layout: 'lemans', realLapM: 13626 },
  // the start / finish line half way along the pit lane, on the start straight
  start: [-1350, -1480],
  startOnLine: true,
  // m (game): Mulsanne corner, Arnage and the chicanes are tighter than the venue's least radius
  minR: 10,
  // real m (scaled with the map): EU-DEM 25 m fitted (rms 0.8 m on the lap, 1.0 m within 400 m)
  hills: [
    { kind: 'hump', x: -1300, y: -2950, r: 2700, h: 39.2 },
    { kind: 'hump', x: 950, y: 2150, r: 4000, h: 18.1 },
    { kind: 'hump', x: 800, y: -1450, r: 1200, h: 9.9 },
    { kind: 'hump', x: 650, y: 2600, r: 1200, h: 12.7 },
    { kind: 'hump', x: -1000, y: -2200, r: 300, h: 7.4 },
    { kind: 'hump', x: -1300, y: 350, r: 300, h: 11.4 },
    { kind: 'dip', x: -250, y: -2200, r: 500, d: 12.1 },
    { kind: 'hump', x: 800, y: -100, r: 800, h: 5.4 },
    { kind: 'hump', x: 1550, y: 2150, r: 800, h: 5.5 },
    { kind: 'dip', x: -1600, y: -1450, r: 800, d: 3.6 },
    { kind: 'dip', x: 800, y: 950, r: 500, d: 10.1 },
    { kind: 'dip', x: -700, y: 1850, r: 200, d: 3.3 },
    { kind: 'dip', x: -100, y: -2650, r: 200, d: 4.5 },
    { kind: 'dip', x: -550, y: -2350, r: 200, d: 6.5 },
    { kind: 'hump', x: -1300, y: -550, r: 500, h: 2 },
    { kind: 'hump', x: -400, y: 2300, r: 500, h: 7.9 },
    { kind: 'hump', x: -250, y: -2950, r: 300, h: 11.8 },
    { kind: 'hump', x: 800, y: -2050, r: 800, h: 9.8 },
    { kind: 'dip', x: -1600, y: -2050, r: 500, d: 4.8 },
    { kind: 'dip', x: 950, y: 2600, r: 300, d: 3.8 },
    { kind: 'hump', x: 350, y: 2000, r: 300, h: 11.3 },
    { kind: 'hump', x: -1000, y: -2500, r: 300, h: 5.9 },
    { kind: 'hump', x: 200, y: -2950, r: 500, h: 9.8 },
    { kind: 'hump', x: -700, y: -2950, r: 500, h: 7.7 },
    { kind: 'dip', x: 50, y: -2500, r: 300, d: 4.2 },
  ],
  banks: [],
  boards: [],
  // the first 24-hour race at Le Mans, 1923
  seed: 1923,
  followRails: true,
  mixFences: true,
};

// the one layout - built on first use (world/load.ts buildLevel)
export const LEMANS_LEVELS: Level[] = [
  { id: 'lemans', name: LE_MANKY, venue: LE_MANKY,
    _lap: () => venueLap(LEMANS_SPEC, 'lemans'),
    _build: () => venueLevel(LEMANS_SPEC, 'lemans', 'lemans', LE_MANKY) } as Level,
];
