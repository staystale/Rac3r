// world/levels/yasmarina-venue.ts - YASS MARINA, a NEW venue (world/venue.ts; owner 11-10: the
// world championship circuits, the name approved): the Yas Marina Circuit (Abu Dhabi) from
// OpenStreetMap (venues/yasmarina.ts) at 1/2 of real length with the 13 m road.
import { YASMARINA_VENUE } from "./venues/yasmarina.ts";
import { venueLap, venueLevel } from "../venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level, Point } from "../types.ts";

// THE BARRIERS (OSM maps the debris fences on the walls as fences - with the world circuits' mixed
// fences, chain link all round - and few of the walls): the aerial photographs (ESRI World
// Imagery) show the concrete walls and Armco both sides all round, at the verge's edge or behind
// the asphalt run-off - laid as a line 10 real m off the centreline each side, followed as rails
// (as Monzarella's and Snoozuka's; OSM's walls followed too)
const YM_RAILS: Point[][] = [
  // the right of the lap
  [
    [109, 368], [109, 360], [106, 350], [101, 340], [96, 334], [88, 328], [77, 324], [60, 321],
    [45, 320], [26, 320], [9, 322], [-153, 345], [-172, 344], [-182, 342], [-199, 336],
    [-202, 334], [-206, 330], [-251, 253], [-276, 210], [-279, 202], [-283, 184], [-283, 165],
    [-281, 158], [-279, 155], [-276, 153], [238, 79], [250, 75], [261, 66], [270, 53], [273, 45],
    [274, 33], [272, 18], [231, -157], [226, -171], [223, -177], [217, -186], [209, -193],
    [200, -199], [191, -204], [120, -227], [102, -234], [89, -242], [76, -252], [59, -269],
    [40, -295], [38, -302], [34, -323], [33, -344], [37, -367], [52, -422], [60, -452],
    [63, -470], [67, -508], [68, -527], [67, -551], [48, -721], [35, -820], [33, -832],
    [29, -843], [24, -852], [20, -857], [9, -865], [4, -869], [-5, -871], [-15, -872],
    [-21, -872], [-32, -868], [-36, -866], [-44, -859], [-50, -852], [-56, -838], [-71, -795],
    [-89, -724], [-102, -681], [-139, -568], [-280, -155], [-302, -84], [-328, 11], [-410, 256],
    [-411, 265], [-409, 273], [-407, 277], [-400, 282], [-393, 285], [-388, 285], [-343, 277],
    [-341, 277], [-339, 279], [-340, 277], [-322, 343], [-302, 414], [-296, 427], [-274, 462],
    [-257, 485], [-233, 510], [-216, 526], [-188, 550], [-117, 604], [-23, 678], [41, 727],
    [100, 766], [124, 779], [159, 796], [316, 866], [330, 870], [344, 872], [359, 871],
    [369, 868], [378, 864], [386, 859], [399, 848], [403, 842], [413, 825], [418, 808],
    [420, 793], [420, 783], [419, 772], [417, 760], [410, 744], [402, 731], [392, 720],
    [371, 704], [362, 700], [351, 697], [339, 695], [165, 682], [137, 679], [126, 676], [30, 615],
    [24, 609], [17, 598], [13, 589], [-10, 487], [-9, 486], [-11, 488], [74, 476], [86, 472],
    [92, 468], [98, 463], [104, 454], [108, 446], [111, 434], [111, 397], [109, 369],
  ],
  // the left of the lap
  [
    [89, 369], [89, 363], [88, 357], [82, 347], [72, 344], [62, 341], [44, 340], [27, 340],
    [11, 341], [-143, 364], [-152, 365], [-175, 364], [-188, 361], [-207, 354], [-215, 350],
    [-222, 342], [-268, 263], [-294, 219], [-299, 207], [-303, 186], [-304, 168], [-303, 161],
    [-300, 151], [-297, 145], [-291, 139], [-281, 134], [-271, 132], [234, 60], [240, 58],
    [246, 53], [252, 44], [254, 40], [254, 33], [253, 23], [211, -152], [206, -167], [196, -178],
    [183, -185], [104, -211], [93, -216], [78, -226], [63, -237], [44, -256], [23, -286],
    [19, -297], [14, -320], [13, -332], [13, -346], [17, -372], [33, -427], [40, -456],
    [43, -473], [47, -509], [47, -545], [46, -563], [16, -816], [11, -835], [8, -840], [-1, -849],
    [-9, -851], [-17, -852], [-25, -849], [-33, -842], [-38, -831], [-52, -790], [-69, -719],
    [-83, -675], [-121, -562], [-261, -148], [-283, -78], [-309, 17], [-392, 264], [-390, 265],
    [-340, 257], [-331, 260], [-327, 262], [-323, 266], [-320, 273], [-303, 338], [-283, 407],
    [-278, 417], [-258, 451], [-241, 472], [-219, 495], [-202, 511], [-175, 534], [-105, 588],
    [-11, 662], [54, 711], [110, 748], [133, 761], [167, 778], [324, 848], [335, 851], [344, 852],
    [356, 851], [362, 849], [375, 843], [384, 835], [387, 831], [394, 818], [397, 811],
    [400, 792], [400, 784], [397, 765], [395, 758], [390, 749], [381, 737], [374, 731],
    [361, 722], [355, 719], [345, 716], [336, 714], [163, 702], [133, 698], [119, 695],
    [113, 692], [19, 631], [9, 622], [-1, 607], [-6, 594], [-29, 492], [-30, 485], [-28, 478],
    [-27, 476], [-23, 471], [-16, 468], [70, 456], [78, 454], [83, 450], [89, 439], [91, 433],
    [91, 397], [89, 370],
  ],
];

// the venue's name (a parody of Yas Marina, approved by the owner 11-10), in one place
export const YASS_MARINA = 'Yass Marina';

export const YASMARINA_SPEC: VenueSpec = {
  id: 'yasmarina',
  data: YASMARINA_VENUE,
  share: 0.5,
  realRoadM: 15,
  calibrate: { layout: 'gp', realLapM: 5281 },
  start: [-20, 112],
  startOnLine: true,
  pitLane: ['Pit Lane', 'Pit Exit'],
  pitHeld: { 'Pit Lane': 'end', 'Pit Exit': 'start' },
  // THE PIT EXIT (ESRI World Imagery; OSM maps it as a tunnel under the first corner): the pit lane
  // runs on round the corner's outside, dips into a cut and under the track, comes up on its
  // inside and runs on to rejoin - a drivable crossing (world/crossings.ts; venuecross.ts
  // pitTunnelPortals) between the two hand-laid pit roads, game m
  pitTunnel: { a: [149.9, 7.9], b: [100.7, -16.3] },
  finish: {
    roads: [
      { width: 9, pts: [
      [103.1, 53], [107.1, 52.7], [111.2, 52.4], [115.3, 52], [119.4, 51.4], [123.5, 50.6],
      [127.5, 49.7], [131.5, 48.6], [135.3, 47.3], [138.9, 45.9], [142.3, 44.1], [145.4, 42.2],
      [148.3, 39.9], [150.8, 37.5], [153, 34.7], [154.7, 31.6], [156, 28.2], [156.9, 24.5],
      [157.8, 20.8], [158.9, 17], [158.9, 13.7], [157.1, 11.5], [146.7, 6.4],
      ] },
      { width: 9, pts: [
      [103.8, -14.7], [93.5, -19.8], [90.6, -21.7], [88.8, -23.9], [87.9, -26.5], [87.8, -29.3],
      [88.3, -32.3], [89.3, -35.6], [90.6, -39], [92.1, -42.5], [93.6, -46.2], [94.9, -50],
      [96, -53.8], [96.7, -57.6], [96.7, -61.4], [96, -65.2],
      ] },
    ],
  },
  minR: 10,
  // real m (scaled with the map): SRTM 30 m fitted as 3 hills (rms 1.7 m on the lap): the island is
  // flat, a few metres from the marina's water to the stands
  hills: [
    { kind: 'hump', x: -600, y: 50, r: 4000, h: 6.7 },
    { kind: 'hump', x: -100, y: 650, r: 200, h: 4.6 },
    { kind: 'dip', x: 300, y: -250, r: 200, d: 7.3 },
  ],
  banks: [],
  // the boards on the barriers at the first corner, the hairpin, the marina and the last sector
  // (the register's brands; the venue's own name)
  boards: [
    { at: [291, 45], label: 'PIRRELLY' },
    { at: [-13, -885], label: 'FIRESTONED' },
    { at: [305, 673], label: 'GOOD YEAH' },
    { at: [-215, 278], label: 'YASS MARINA' },
  ],
  // Yas Marina opened in 2009
  seed: 2009,
  followRails: true,
  railsSeen: YM_RAILS,
  mixFences: true,
};

// the one layout - built on first use (world/load.ts buildLevel)
export const YASMARINA_LEVELS: Level[] = [
  { id: 'yasmarina', name: YASS_MARINA, venue: YASS_MARINA,
    _lap: () => venueLap(YASMARINA_SPEC, 'gp'),
    _build: () => venueLevel(YASMARINA_SPEC, 'gp', 'yasmarina', YASS_MARINA) } as Level,
];
