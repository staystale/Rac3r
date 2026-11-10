// world/levels/suzuka-venue.ts - SNOOZUKA, a NEW venue (world/venue.ts; owner 11-09: the world
// championship circuits; the name confirmed by the owner 11-10): the Suzuka Circuit (Japan) from
// OpenStreetMap (venues/suzuka.ts) at 1/2 of real length with the 13 m road - the figure of eight:
// the main straight, the First and Second Turns, the S Curves, the Gyaku (reverse bank) curve, the
// Dunlop curve, the two Degners, UNDER THE CROSSOVER to the hairpin, Spoon, the back straight OVER
// the crossover into 130R, the chicane and onto the main straight. Checked against Wikipedia (the
// GP circuit 5.807 km; the OSM loop reads 5813 m) and aerial photographs (ESRI World Imagery: the
// crossover, the barriers, the grid). The pit lane, OSM's gravel traps (mapped as sand), its
// grandstands, buildings and woods, the access tunnels under the track. THE CROSSOVER (owner 11-10:
// "keep the figure-of-eight as a drivable bridge"): the Degner-to-hairpin leg dips into a cut and
// under the back straight - the race road's own underpass (world/venuecross.ts, trackunder.ts):
// a car under it is on another level, and a lookup for a car on the ground never takes the road
// below for its own. SRTM heights (30 m; EU-DEM covers only Europe) fitted as 20 hills (rms 1.6
// real m on the lap): 16 m by the First Turn up to 61 m at Spoon. North up.
import { SUZUKA_VENUE } from "./venues/suzuka.ts";
import { venueLap, venueLevel } from "../venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level, Point } from "../types.ts";

// THE BARRIERS (OSM maps some walls and fences): the aerial photographs show Armco, a wall or a
// catch fence both sides of the track all round, at the edge of each verge or behind the run-off -
// laid as a line 10 real m off the centreline each side, followed as rails (as Monzarella's: the
// edge's Armco at its rim, behind the gravel where there is gravel, a catch fence by the stands)
const SZ_RAILS: Point[][] = [
  // the right of the lap
  [
    [417, -242], [442, -229], [461, -215], [491, -188], [511, -165], [760, 136], [954, 374],
    [961, 387], [965, 396], [968, 408], [969, 416], [968, 430], [967, 438], [960, 463],
    [951, 490], [942, 504], [936, 509], [929, 514], [920, 517], [912, 518], [904, 518],
    [895, 517], [887, 514], [880, 510], [866, 498], [852, 474], [787, 374], [774, 356],
    [766, 347], [756, 339], [741, 331], [734, 328], [721, 325], [683, 323], [674, 323],
    [666, 321], [658, 318], [650, 313], [643, 308], [637, 302], [627, 288], [624, 279],
    [607, 216], [603, 205], [599, 195], [592, 183], [584, 174], [575, 166], [565, 159],
    [554, 154], [541, 149], [531, 147], [519, 146], [468, 144], [457, 141], [447, 136],
    [436, 130], [428, 123], [419, 113], [412, 104], [408, 94], [405, 83], [404, 72], [405, 61],
    [408, 49], [430, -8], [434, -21], [436, -36], [436, -48], [434, -61], [430, -74], [425, -86],
    [417, -98], [408, -108], [398, -117], [381, -126], [347, -143], [320, -153], [301, -158],
    [276, -161], [252, -161], [225, -159], [209, -157], [192, -151], [159, -136], [143, -128],
    [127, -118], [114, -108], [81, -76], [-16, 40], [-19, 42], [-147, 53], [-155, 53], [-160, 50],
    [-164, 46], [-166, 43], [-219, -227], [-220, -241], [-220, -253], [-218, -264], [-212, -282],
    [-179, -356], [-176, -367], [-178, -379], [-182, -388], [-189, -395], [-198, -400],
    [-208, -401], [-217, -400], [-226, -396], [-233, -389], [-239, -382], [-266, -337],
    [-307, -271], [-327, -247], [-348, -227], [-355, -221], [-378, -207], [-400, -201],
    [-427, -198], [-463, -195], [-476, -195], [-516, -200], [-550, -208], [-611, -230],
    [-632, -239], [-652, -251], [-670, -263], [-689, -279], [-700, -291], [-718, -311],
    [-726, -323], [-737, -341], [-747, -360], [-804, -492], [-812, -504], [-825, -516],
    [-831, -520], [-846, -527], [-854, -529], [-871, -531], [-893, -530], [-907, -529],
    [-940, -521], [-952, -517], [-968, -508], [-977, -501], [-987, -486], [-991, -477],
    [-994, -465], [-995, -451], [-994, -440], [-991, -427], [-987, -416], [-979, -402],
    [-973, -395], [-955, -374], [-923, -346], [-891, -321], [-851, -293], [-807, -264],
    [-768, -240], [-730, -220], [-692, -202], [-633, -177], [-176, -14], [-158, -9], [-143, -8],
    [-129, -9], [-114, -12], [-66, -28], [-40, -40], [-8, -60], [15, -75], [34, -91], [155, -204],
    [177, -222], [195, -234], [200, -235], [203, -234], [226, -214], [232, -210], [240, -208],
    [248, -207], [256, -209], [263, -212], [289, -235], [302, -243], [313, -249], [324, -253],
    [339, -256], [364, -256], [392, -251], [419, -242],
  ],
  // the left of the lap
  [
    [427, -260], [452, -246], [474, -231], [505, -202], [526, -179], [775, 123], [971, 363],
    [981, 384], [988, 405], [989, 421], [986, 443], [979, 469], [969, 498], [957, 518],
    [947, 526], [937, 531], [926, 536], [915, 538], [900, 538], [890, 536], [879, 533],
    [868, 527], [859, 520], [850, 510], [771, 385], [759, 368], [752, 361], [745, 355],
    [737, 350], [728, 347], [719, 345], [682, 343], [671, 342], [660, 340], [647, 335],
    [639, 330], [630, 323], [622, 315], [616, 308], [609, 296], [602, 275], [587, 221],
    [581, 203], [576, 195], [570, 188], [562, 182], [555, 176], [546, 172], [538, 169],
    [528, 167], [465, 164], [450, 160], [437, 154], [426, 147], [414, 137], [403, 125],
    [395, 114], [391, 105], [389, 100], [385, 86], [384, 71], [386, 56], [390, 43], [411, -14],
    [414, -25], [416, -36], [416, -46], [415, -57], [412, -67], [407, -76], [401, -85],
    [394, -93], [386, -100], [371, -109], [339, -124], [315, -134], [297, -138], [275, -141],
    [253, -141], [228, -140], [214, -137], [200, -132], [167, -118], [153, -111], [138, -102],
    [127, -93], [96, -63], [3, 50], [-5, 57], [-13, 61], [-17, 61], [-146, 73], [-159, 73],
    [-166, 70], [-173, 66], [-178, 61], [-182, 55], [-185, 48], [-238, -221], [-240, -241],
    [-240, -255], [-238, -269], [-231, -289], [-196, -369], [-197, -374], [-201, -379],
    [-204, -381], [-211, -381], [-215, -379], [-218, -376], [-291, -259], [-312, -233],
    [-335, -211], [-344, -205], [-370, -189], [-396, -181], [-425, -178], [-463, -175],
    [-482, -176], [-520, -180], [-556, -189], [-584, -199], [-619, -211], [-637, -220],
    [-663, -234], [-682, -247], [-703, -265], [-715, -277], [-734, -299], [-743, -312],
    [-755, -331], [-765, -352], [-822, -482], [-828, -491], [-841, -503], [-852, -508],
    [-858, -509], [-872, -511], [-891, -511], [-918, -507], [-934, -502], [-953, -494],
    [-961, -489], [-964, -484], [-972, -470], [-974, -461], [-974, -443], [-972, -433],
    [-968, -425], [-962, -413], [-958, -407], [-941, -388], [-909, -361], [-879, -337],
    [-840, -309], [-797, -281], [-758, -258], [-721, -238], [-683, -220], [-626, -195],
    [-170, -33], [-154, -29], [-143, -28], [-132, -29], [-120, -31], [-89, -41], [-74, -47],
    [-49, -58], [-19, -76], [2, -91], [20, -106], [142, -219], [165, -238], [188, -252],
    [198, -255], [204, -255], [210, -254], [214, -251], [238, -230], [241, -228], [247, -227],
    [252, -229], [276, -250], [292, -261], [305, -267], [319, -273], [338, -276], [365, -275],
    [397, -270], [426, -260],
  ],
];

// the venue's name (a parody of Suzuka: the owner's brief 11-09, confirmed 11-10), in one place
export const SNOOZUKA = 'Snoozuka';

export const SUZUKA_SPEC: VenueSpec = {
  id: 'suzuka',
  data: SUZUKA_VENUE,
  share: 0.5,
  // m: the real road (12-16 m on the aerial photographs)
  realRoadM: 14,
  calibrate: { layout: 'gp', realLapM: 5807 },
  // the start line at the head of the grid (aerial photographs: the cars on the grid down the
  // main straight; OSM maps no start-finish node)
  start: [730, 100],
  startOnLine: true,
  pitLane: 'Pit Lane',
  // m (game): the hairpin, the chicane and the Degners are tighter than the venue's least radius
  minR: 10,
  // the hand finish (game m): the grandstand outside the hairpin moved 4 m back off its kerb
  finish: { move: [{ at: [-113, -210], by: [-2, -4] }] },
  // real m (scaled with the map): SRTM 30 m fitted (rms 1.6 m on the lap, 1.9 m within 250 m)
  hills: [
    { kind: 'hump', x: -320, y: -700, r: 1800, h: 37.3 },
    { kind: 'hump', x: -1200, y: -620, r: 500, h: 30.8 },
    { kind: 'dip', x: -240, y: -140, r: 200, d: 7.6 },
    { kind: 'hump', x: 320, y: -300, r: 300, h: 9.3 },
    { kind: 'hump', x: 480, y: 180, r: 300, h: 6.9 },
    { kind: 'hump', x: -640, y: -460, r: 300, h: 17 },
    { kind: 'hump', x: -400, y: -220, r: 200, h: 8.4 },
    { kind: 'dip', x: 880, y: 420, r: 200, d: 3.7 },
    { kind: 'hump', x: 960, y: -140, r: 500, h: 9.7 },
    { kind: 'hump', x: 0, y: -300, r: 300, h: 9.4 },
    { kind: 'hump', x: 320, y: -60, r: 200, h: 5.6 },
    { kind: 'hump', x: -80, y: -60, r: 200, h: 4.9 },
    { kind: 'dip', x: 0, y: 420, r: 500, d: 10.5 },
    { kind: 'hump', x: 160, y: -700, r: 500, h: 15.3 },
    { kind: 'dip', x: 1200, y: 340, r: 300, d: 8.2 },
    { kind: 'hump', x: -1120, y: -300, r: 200, h: 12.8 },
    { kind: 'hump', x: -800, y: -700, r: 300, h: 7.4 },
    { kind: 'hump', x: 560, y: 420, r: 200, h: 7 },
    { kind: 'hump', x: 560, y: -380, r: 200, h: 8.3 },
    { kind: 'dip', x: 1200, y: 660, r: 300, d: 8.6 },
  ],
  // no viewing banks: a bank brings a catch fence (the grandstands bring their own)
  banks: [],
  // the boards on the barriers at the Dunlop curve, the hairpin, Spoon and the chicane (the
  // register's brands; the venue's own name at the chicane)
  boards: [
    { at: [445, -85], label: 'DUNFLOP' },
    { at: [-205, -415], label: 'PIRRELLY' },
    { at: [-960, -540], label: 'GOOD YEAH' },
    { at: [215, -275], label: 'SNOOZUKA' },
  ],
  // Suzuka opened in 1962
  seed: 1962,
  followRails: true,
  railsSeen: SZ_RAILS,
  // the figure of eight: the Degner-to-hairpin leg runs under the back straight's crossover
  crossover: { under: 'Degner underpass' },
};

// the one layout - built on first use (world/load.ts buildLevel)
export const SUZUKA_LEVELS: Level[] = [
  { id: 'suzuka', name: SNOOZUKA, venue: SNOOZUKA,
    _lap: () => venueLap(SUZUKA_SPEC, 'gp'),
    _build: () => venueLevel(SUZUKA_SPEC, 'gp', 'suzuka', SNOOZUKA) } as Level,
];
