// world/levels/nordschlep-venue.ts - NERDBURGRING, a NEW venue (world/venue.ts; owner 11-09: the
// world championship circuits - a SIMPLE first build of the long tracks, to try the frame rate
// and the feel on the phone): the Nurburgring Nordschleife (Germany) from OpenStreetMap
// (venues/nordschlep.ts) at 1/2 of real length with the 13 m road, its layout the NORDSCHLEP:
// from T13 through the Hatzenbach, Flugplatz, Schwedenkreuz, Aremberg, the Fuchsrohre,
// Adenauer Forst, Kallenhard, Wehrseifen, Breidscheid, Bergwerk, Kesselchen, the Karussell,
// Hohe Acht, Brunnchen, Pflanzgarten, Schwalbenschwanz and Galgenkopf, down the Dottinger Hohe
// and round Tiergarten and Hohenrain. Checked against Wikipedia (20.832 km; the OSM loop reads
// 20772 m) and aerial photographs (ESRI World Imagery). SIMPLE: the lap, its barriers (OSM's
// guard rails and the walls and fences beside the track, followed as rails), its gravel, the
// woods at the venues' usual tree count and a grid at T13 - no pit lane, no roads, buildings,
// stands or car parks (tools/venues/nordschlep.json leaveOut), no GP circuit (a later layout of
// the same venue). EU-DEM heights (25 m) fitted as 70 hills (rms 2.6 real m on the lap): 340 m at
// Breidscheid in the Adenau valley up to 629 m by the Hohe Acht. North up, the lap clockwise.
import { NORDSCHLEP_VENUE } from "./venues/nordschlep.ts";
import { venueLap, venueLevel } from "../venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level } from "../types.ts";

// the venue's and its layout's names (the owner's brief 11-09), in one place
export const NERDBURGRING = 'Nerdburgring';
export const NORDSCHLEP = 'Nordschlep';

export const NORDSCHLEP_SPEC: VenueSpec = {
  id: 'nerdburgring',
  data: NORDSCHLEP_VENUE,
  share: 0.5,
  // m: the real road (8 to 9 m on OSM's widths)
  realRoadM: 9,
  calibrate: { layout: 'nordschleife', realLapM: 20832 },
  // the start / finish line on the straight at T13 (the Nordschleife lap's 20.832 km)
  start: [-830, 1758],
  startOnLine: true,
  // m (game): the Aremberg, Wehrseifen, Breidscheid and the Karussell are tighter than the
  // venue's least radius
  minR: 10,
  // the Karussell's two legs (the climb down from the Klostertal and the way out to the Hohe Acht)
  // meet in a V 28 real m apart, closer than two 13 m roads allow (36 real m between centres): the
  // way out, and all past a line along the V, moved 12 m off it (the Karussell itself lengthened)
  warps: [{ at: [1790, -2096], dir: [0.515, 0.857], band: 60, shift: 24 }],
  // real m (scaled with the map): EU-DEM 25 m fitted (rms 2.6 m on the lap, 4.3 m within 400 m)
  hills: [
    { kind: 'hump', x: -200, y: 0, r: 4000, h: 341.1 },
    { kind: 'hump', x: 3100, y: -2550, r: 2700, h: 281.9 },
    { kind: 'hump', x: -3200, y: 1500, r: 4000, h: 169.8 },
    { kind: 'dip', x: -650, y: -2100, r: 1200, d: 121.7 },
    { kind: 'dip', x: -50, y: 0, r: 1800, d: 117.1 },
    { kind: 'hump', x: 3250, y: 0, r: 1800, h: 175.1 },
    { kind: 'hump', x: -1850, y: -2250, r: 500, h: 57.5 },
    { kind: 'hump', x: 2200, y: -2850, r: 800, h: 86.8 },
    { kind: 'hump', x: -3200, y: -300, r: 800, h: 57.5 },
    { kind: 'hump', x: -950, y: 2100, r: 800, h: 78.2 },
    { kind: 'hump', x: 1600, y: -2100, r: 500, h: 33 },
    { kind: 'dip', x: 400, y: -2250, r: 500, d: 31.5 },
    { kind: 'dip', x: -1850, y: -750, r: 800, d: 79.6 },
    { kind: 'dip', x: -1850, y: 900, r: 800, d: 106.3 },
    { kind: 'hump', x: 1750, y: -150, r: 500, h: 40.8 },
    { kind: 'hump', x: 1150, y: -2850, r: 800, h: 96.5 },
    { kind: 'dip', x: 3100, y: -1950, r: 500, d: 24 },
    { kind: 'hump', x: -1700, y: -2550, r: 300, h: 19.8 },
    { kind: 'hump', x: -2900, y: -1800, r: 1200, h: 58.6 },
    { kind: 'dip', x: -2150, y: 150, r: 500, d: 73.1 },
    { kind: 'hump', x: -350, y: -2400, r: 500, h: 64.8 },
    { kind: 'hump', x: -50, y: -3300, r: 300, h: 64.2 },
    { kind: 'dip', x: -350, y: 1350, r: 300, d: 16.1 },
    { kind: 'dip', x: 1300, y: -900, r: 500, d: 54.6 },
    { kind: 'dip', x: 700, y: 0, r: 800, d: 49.7 },
    { kind: 'dip', x: -1550, y: -1350, r: 500, d: 74.7 },
    { kind: 'hump', x: 550, y: -2700, r: 500, h: 97.3 },
    { kind: 'dip', x: -50, y: -3000, r: 200, d: 9.9 },
    { kind: 'hump', x: 2200, y: -2250, r: 300, h: 18.3 },
    { kind: 'dip', x: 2500, y: -1950, r: 500, d: 36.4 },
    { kind: 'hump', x: 2650, y: -1500, r: 300, h: 21.1 },
    { kind: 'hump', x: 100, y: -2100, r: 300, h: 56 },
    { kind: 'hump', x: -500, y: -3300, r: 500, h: 65.5 },
    { kind: 'hump', x: -1250, y: -2100, r: 500, h: 47 },
    { kind: 'hump', x: 1600, y: -600, r: 300, h: 23.2 },
    { kind: 'dip', x: -1250, y: 1800, r: 200, d: 18.5 },
    { kind: 'hump', x: 2350, y: -900, r: 300, h: 30.7 },
    { kind: 'hump', x: 2050, y: -600, r: 300, h: 28.2 },
    { kind: 'hump', x: 1450, y: 0, r: 300, h: 36.1 },
    { kind: 'hump', x: -1850, y: -1800, r: 300, h: 15.1 },
    { kind: 'dip', x: -2450, y: 1200, r: 300, d: 18 },
    { kind: 'hump', x: -350, y: 1950, r: 500, h: 35.5 },
    { kind: 'hump', x: 1000, y: -1650, r: 500, h: 47.2 },
    { kind: 'hump', x: -1850, y: 2100, r: 500, h: 49 },
    { kind: 'hump', x: 1600, y: -2700, r: 500, h: 70.8 },
    { kind: 'hump', x: 1300, y: -450, r: 300, h: 13.2 },
    { kind: 'dip', x: -2450, y: -900, r: 300, d: 16.3 },
    { kind: 'hump', x: 1600, y: -1800, r: 300, h: 33.4 },
    { kind: 'dip', x: -2000, y: 600, r: 500, d: 57.1 },
    { kind: 'hump', x: 1150, y: -2400, r: 300, h: 58.6 },
    { kind: 'hump', x: -2900, y: 450, r: 500, h: 31.1 },
    { kind: 'hump', x: -2900, y: -900, r: 500, h: 29.9 },
    { kind: 'dip', x: 1750, y: -1200, r: 800, d: 49.4 },
    { kind: 'dip', x: 1000, y: -600, r: 500, d: 42.8 },
    { kind: 'dip', x: -1250, y: -3000, r: 500, d: 35 },
    { kind: 'dip', x: -1400, y: -1650, r: 300, d: 43 },
    { kind: 'dip', x: 2500, y: -1650, r: 300, d: 40.5 },
    { kind: 'hump', x: 3250, y: -1350, r: 500, h: 30.3 },
    { kind: 'hump', x: 2500, y: -1050, r: 200, h: 22.8 },
    { kind: 'hump', x: -2900, y: 1050, r: 500, h: 35.7 },
    { kind: 'dip', x: 100, y: -2400, r: 200, d: 13.4 },
    { kind: 'dip', x: -1100, y: 1200, r: 500, d: 31.5 },
    { kind: 'hump', x: 2350, y: -600, r: 200, h: 42.9 },
    { kind: 'hump', x: 2650, y: -1200, r: 300, h: 12.8 },
    { kind: 'hump', x: 1900, y: -450, r: 200, h: 13.8 },
    { kind: 'hump', x: -200, y: -3300, r: 300, h: 47 },
    { kind: 'hump', x: -200, y: -2100, r: 500, h: 49.3 },
    { kind: 'dip', x: 850, y: 900, r: 500, d: 22.5 },
    { kind: 'hump', x: -2450, y: 450, r: 300, h: 9.6 },
    { kind: 'hump', x: 2050, y: 150, r: 500, h: 31.2 },
  ],
  banks: [],
  boards: [],
  // the Nurburgring opened in 1927
  seed: 1927,
  followRails: true,
  mixFences: true,
};

// the one layout - built on first use (world/load.ts buildLevel)
export const NERD_LEVELS: Level[] = [
  { id: 'nordschlep', name: `${NERDBURGRING} ${NORDSCHLEP}`, venue: NERDBURGRING,
    _lap: () => venueLap(NORDSCHLEP_SPEC, 'nordschleife'),
    _build: () => venueLevel(NORDSCHLEP_SPEC, 'nordschleife', 'nordschlep',
      `${NERDBURGRING} ${NORDSCHLEP}`) } as Level,
];
