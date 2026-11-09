// world/levels/spa-venue.ts - SPA-FRANKENCHUMPS, a NEW venue (world/venue.ts; owner 11-09: the
// world championship circuits): the Circuit de Spa-Francorchamps (Belgium) from OpenStreetMap
// (venues/spa.ts) at 1/2 of real length with the 13 m road: La Source, the old pit straight down
// to Eau Rouge, Raidillon, the Kemmel straight up to Les Combes, Malmedy, Rivage, Speaker's
// Corner, Pouhon, Fagnes, Campus, Paul Frere, Blanchimont and the Bus Stop onto the start
// straight, in the forest. Checked against Wikipedia and Formula 1's corner guide (the GP circuit
// 7.004 km since 2007, 19 turns; the OSM loop reads 7002 m), aerial photographs (ESRI World
// Imagery: the start gantry, the barriers, the traps) and OSM's pit lane, tunnels, grandstands,
// paddocks and barriers - the circuit's barriers mapped as walls and fences (read as rails:
// tools/venues/spa.json "rails") and its guard rails at Eau Rouge and Raidillon. The motorcycle
// chicane beside Speaker's Corner (inside its run-off: at 1/2 scale it would lie on the raced
// road), the support races' pit lane beside the old pit straight and Raidillon, and the kart
// track's own barriers are left out. EU-DEM heights (25 m) fitted as 14 hills (rms 1.7 real m on
// the lap): La Source 432 m, Eau Rouge 392, up Raidillon and the Kemmel to Les Combes and Malmedy
// (470), down past Pouhon to Paul Frere (365), up Blanchimont to the Bus Stop (415). North up,
// the lap clockwise.
import { SPA_VENUE } from "./venues/spa.ts";
import { venueLap, venueLevel } from "../venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level } from "../types.ts";

// the venue's name (a parody of Spa-Francorchamps, from the owner's brief 11-09), in one place
export const SPA = 'Spa-Frankenchumps';

export const SPA_SPEC: VenueSpec = {
  id: 'spa',
  data: SPA_VENUE,
  share: 0.5,
  // m: the real road (about 15 m on the aerial photographs)
  realRoadM: 15,
  calibrate: { layout: 'gp', realLapM: 7004 },
  // the start / finish line on the start straight, under the start gantry (aerial photographs;
  // OSM maps no start-finish node on the GP circuit)
  start: [-255, -808],
  startOnLine: true,
  pitLane: 'Pit Lane',
  // m (game): La Source and the Bus Stop are tighter than the venue's least radius
  minR: 10,
  // the hand finish (game m): the Tunnel de Blanchimont under Paul Frere comes out to the
  // roundabout on the Route de l'Eau Rouge and on north along the road outside the circuit (a
  // public road: the venue keeps its service roads only) to the building there; the road outside
  // Rivage ends at its turning loop (its last stretch ran along the loop's side); the road to the
  // tunnel between Malmedy and Rivage and the road behind the old pits left out (their tunnels are
  // not built: the forest road inside the Kemmel is not kept, the Route du Fagnou runs under the
  // grandstands at 1/2 scale); the car park's spur that stopped 6 m short of the Paul Frere
  // tunnel's road left out
  finish: {
    drop: [[296.2, 460.5], [-9.1, -316.2], [-298.9, 379.7]],
    cut: [{ at: [108.3, 534.5], keep: [98.3, 490.3] }],
    roads: [
      { pts: [[-343, 427], [-352, 425], [-361, 419], [-367, 409], [-369, 397], [-367, 385],
        [-362, 373], [-357.5, 365], [-353.6, 360.2]] },
    ],
  },
  // real m (scaled with the map): EU-DEM 25 m fitted (rms 1.7 m on the lap, 2.2 m within 250 m)
  hills: [
    { kind: 'hump', x: 880, y: 480, r: 1730, h: 132 },
    { kind: 'hump', x: -940, y: -840, r: 1300, h: 121 },
    { kind: 'dip', x: 200, y: 440, r: 865, d: 56.9 },
    { kind: 'hump', x: -400, y: 60, r: 545, h: 64.1 },
    { kind: 'hump', x: 300, y: 1060, r: 659, h: 32.2 },
    { kind: 'hump', x: 100, y: -1140, r: 495, h: 69.4 },
    { kind: 'hump', x: -860, y: 440, r: 450, h: 61.8 },
    { kind: 'hump', x: 720, y: -480, r: 650, h: 53.8 },
    { kind: 'dip', x: 100, y: -140, r: 363, d: 15.6 },
    { kind: 'hump', x: -200, y: 1240, r: 545, h: 42 },
    { kind: 'hump', x: -580, y: -400, r: 650, h: 45.5 },
    { kind: 'dip', x: 400, y: 740, r: 220, d: 15.4 },
    { kind: 'hump', x: 540, y: 300, r: 322, h: 9.9 },
    { kind: 'hump', x: 160, y: -760, r: 270, h: 13.1 },
  ],
  // no viewing banks: a bank brings a catch fence (the grandstands bring their own)
  banks: [],
  // the boards on the barriers by Eau Rouge, the Kemmel straight, Blanchimont and the Bus Stop (the
  // register's brands; the venue's own name at Eau Rouge)
  boards: [
    { at: [60, -700], label: 'FRANKENCHUMPS' },
    { at: [600, 430], label: 'PIRRELLY' },
    { at: [-250, 250], label: 'GOOD YEAH' },
    { at: [-90, -380], label: 'DUNFLOP' },
  ],
  // the first car race on the circuit, 1922
  seed: 1922,
  followRails: true,
};

// the one layout - built on first use (world/load.ts buildLevel)
export const SPA_LEVELS: Level[] = [
  { id: 'spa', name: SPA, venue: SPA,
    _lap: () => venueLap(SPA_SPEC, 'gp'),
    _build: () => venueLevel(SPA_SPEC, 'gp', 'spa', SPA) } as Level,
];
