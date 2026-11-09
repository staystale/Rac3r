// world/levels/slidden-hill-venue.ts - SLIDDEN HILL AS THE REAL VENUE (?sliddenhillvenue=1,
// world/venue.ts): Lydden Hill (Kent) from OpenStreetMap (venues/slidden-hill.ts) at 1/2 of real
// length with the 13 m road, two layouts of one venue sharing its scenery. North up: the start
// straight (Canterbury Straight) along the bottom, run west; the lap clockwise.
//   THE RALLYCROSS (the level the old Slidden Hill was, category rx) - the World RX layout: the
//     official map (Wikimedia "Lydden Hill - Rallycross", black tarmac, yellow gravel), World RX's
//     figures (1.335 km, the joker 1.420 km, 60 % tarmac / 40 % gravel; OSM 1353 / 1448 m) and the
//     aerial photographs. From the grid on the dead-end start straight (the Dummy Grid, Paddock
//     Bend's tail, Canterbury Straight) west to Pilgrims, where "drivers going straight on plunge
//     right and onto the first loose section" - the gravel loop inside Chessons Drift and the
//     gravel diagonal down to Dover Slope - then Devil's Elbow, up to North Bend "at the top of the
//     hill", down Hairy Hill, and the gravel run back from Paddock Bend onto the start straight.
//     The JOKER: "joker runners instead branched left through Pilgrims bend, keeping to the
//     Tarmac", round Chessons Drift and down Dover Slope (Speedhunters, World RX).
//   THE CIRCUIT: the tarmac road circuit, Pilgrims, Chessons Drift, Dover Slope, Devil's Elbow,
//     North Bend, Hairy Hill, Paddock Bend and Canterbury Straight (OSM 1460 m; "one mile").
// Not built: Nitro Rallycross's 2022 changes (Chessons banked as "Talladega", a tabletop jump on
// the gravel diagonal, the joker moved to the last corner) - OSM maps them only as a rough route.
import { SLIDDEN_HILL_VENUE } from "./venues/slidden-hill.ts";
import { venueLevel } from "../venue.ts";
import { rallycrossLevel } from "./rallycross-venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level } from "../types.ts";

export const SLIDDEN_HILL_SPEC: VenueSpec = {
  id: 'slidden-hill',
  data: SLIDDEN_HILL_VENUE,
  share: 0.5,
  // m: the real road (aerial photographs)
  realRoadM: 10,
  calibrate: { layout: 'rx', realLapM: 1335 },
  // the circuit's start / finish line at the foot of Hairy Hill, by the grid boxes (aerial
  // photographs); the rallycross lap's where the start straight meets it
  start: [146, 30],
  starts: { rx: [-66.2, 80.9] },
  // m (game): North Bend's real hairpin is tighter than the venue's least (its legs drawn together)
  minR: 10,
  // the map opened where the game's wider road ran stretches together (13 m roads at half scale
  // need 36 real m between centres for a barrier between): Devil's Elbow moved off the gravel run
  // back (26 real m apart), and North Bend's two legs apart at the foot of the V (31 m)
  warps: [{ at: [66, 111], dir: [0.27, -0.96], band: 30, shift: 20 },
    { at: [126, 40], dir: [0.98, 0.2], band: 30, shift: 8 }],
  // the rallycross grid on the start straight off the lap, its dead end at the Dummy Grid
  startLane: { layout: 'rx', pieces: ['Dummy Grid', 'Paddock Bend 3', 'Canterbury Straight'] },
  // the rallycross joker: the circuit's tarmac round Chessons Drift, which the lap cuts inside
  joker: { layout: 'rx', loop: 'circuit', near: [-200, -93] },
  // real m (scaled with the map): THE HILL - North Bend "a hairpin at the top of the hill", Hairy
  // Hill "a steep downhill" (the old level's hill: ~12 % at its steepest)
  hills: [{ kind: 'hump', x: 165, y: -110, r: 130, h: 10 }],
  banks: [],
  // the edge as the real circuit's: Armco where the aerial photographs show its barriers (OSM maps
  // none) - round the outside of Pilgrims, Chessons Drift and Dover Slope, of Devil's Elbow, of
  // North Bend (the pit wall down Hairy Hill), of Paddock Bend, and between the start straight and
  // the gravel run back (the old level's start wall); lines tools/scratch/_shrails.mjs offsets
  // from the OSM road (the edge stands Armco at its run-off wherever one lies beside it)
  followRails: true,
  // the tyre wall between Devil's Elbow and the gravel run back (the old level's; the aerial
  // photographs' barrier line between them)
  tyreWalls: [[[30, 92], [43, 103], [55, 108.6], [66.6, 111.5], [79, 110.5], [92, 106], [104, 98]]],
  railsSeen: [
    [[-155.3, 60.1], [-196.5, 53.4], [-225.2, 47.5], [-242.9, 38.8], [-257.2, 27.8],
      [-268.3, 11.5], [-274.2, -2.1], [-276.9, -17], [-276.1, -32.5], [-271.9, -47.6],
      [-262.2, -64.4], [-249.5, -81.1], [-235.5, -93.5], [-219.2, -102.6], [-203.2, -107.2],
      [-186.8, -109.1], [-166.3, -108.5], [-145.8, -105.4], [-122.9, -99.5], [-98.9, -90.4],
      [-78.1, -79], [-61.9, -67], [-45.8, -49.9], [-27.3, -27.8], [-4.5, 1.7], [-0.3, 7.7],
      [31.6, 55.7]],
    [[20.9, 87.2], [33.1, 97.8], [47.5, 107.3], [65.1, 111.9], [81.7, 108.6], [96.4, 100.3],
      [106.7, 87.5], [114.8, 71.3]],
    [[95.6, 32], [130.5, -134.2], [136.5, -147.8], [146.7, -156.2], [159.4, -159.9],
      [173.8, -158], [187.3, -151], [196.4, -141.4], [202.2, -130.1], [204.8, -116.6],
      [203.3, -101.4], [155.9, 46.6]],
    [[149, 70.4], [139.4, 96.2], [130.7, 113.3], [124.4, 123.3], [112, 137.7], [98.7, 147.4]],
    [[118.8, 127.7], [100.6, 135.5], [83.3, 139.4], [66, 138.9], [52.4, 136.1], [38.9, 131.8],
      [24.3, 123.5], [4.5, 109.9], [-15.6, 97.1], [-26.5, 91.6], [-38.3, 86.7]],
  ],
  // the boards on the barriers outside Chessons Drift and Devil's Elbow (the old level's brands)
  boards: [
    { at: [-200, -110], label: 'SLIDDEN HILL' },
    { at: [65, 112], label: 'KUM TYRES' },
  ],
  // Lydden opened in 1955
  seed: 1955,
};

// the two layouts of the one venue, each built on first use (world/load.ts buildLevel)
const circuitLevel = (): Level =>
  venueLevel(SLIDDEN_HILL_SPEC, 'circuit', 'slidden-hill-circuit', 'Slidden Hill Circuit');
export const SH_VENUE_LEVELS: Level[] = [
  ({ id: 'slidden-hill', name: 'Slidden Hill',
    _build: () => rallycrossLevel(SLIDDEN_HILL_SPEC, 'rx', 'slidden-hill', 'Slidden Hill') } as
    Level),
  ({ id: 'slidden-hill-circuit', name: 'Slidden Hill Circuit', _build: circuitLevel } as Level),
];
