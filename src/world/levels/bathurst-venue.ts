// world/levels/bathurst-venue.ts - BATHWORST, a NEW venue (world/venue.ts; owner 11-10: the world
// championship circuits, the name approved): the Mount Panorama Circuit (Bathurst, New South Wales)
// from OpenStreetMap (venues/bathurst.ts) at 1/2 of real length with the 13 m road - a public road
// round the mountain, raced (tools/venues/bathurst.json "roadRace", as Le Manky's): Pit Straight,
// Hell Corner, UP Mountain Straight, Griffins Bend, The Cutting, Reid Park, Sulman Park,
// McPhillamy Park, Skyline, DOWN through The Esses, The Dipper and Forrest's Elbow, Conrod
// Straight, The Chase and Murray's Corner. Checked against Wikipedia (6.213 km; the OSM loop reads
// 6204 m) and aerial photographs (ESRI World Imagery). North up.
import { BATHURST_VENUE } from "./venues/bathurst.ts";
import { venueLap, venueLevel } from "../venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level, Point } from "../types.ts";

// THE WALLS HARD BY THE ROAD (OSM maps the concrete walls both sides nearly all round, but over
// the mountain they stand at the road's edge - at 1/2 scale and on the game's wider road they fall
// on the road, and the edge would not see them): where a mapped wall or fence stands within 10
// real m of the centreline, a line 10 real m off that side instead (20 runs, 72 % of the sides;
// tools/venues/bathurst.json: the walls themselves followed too), so the edge's barrier stands
// there (runoffM past the edge)
const BT_RAILS: Point[][] = [
  // the left of the lap, 572-618 real m round
  [
    [144, -1000], [137, -956],
  ],
  // the left of the lap, 680-1298 real m round
  [
    [127, -895], [21, -289],
  ],
  // the left of the lap, 1308-2886 real m round
  [
    [20, -279], [-26, -14], [-30, -2], [-33, 4], [-38, 11], [-44, 17], [-53, 24], [-63, 29],
    [-79, 33], [-93, 33], [-117, 27], [-133, 21], [-316, -80], [-350, -98], [-371, -106],
    [-384, -109], [-396, -109], [-409, -108], [-429, -104], [-468, -91], [-477, -86], [-485, -79],
    [-489, -74], [-493, -65], [-494, -55], [-494, -48], [-492, -36], [-485, -25], [-441, 25],
    [-430, 40], [-423, 54], [-419, 70], [-417, 81], [-418, 98], [-423, 132], [-432, 183],
    [-438, 204], [-442, 215], [-448, 224], [-454, 230], [-461, 236], [-471, 242], [-520, 265],
    [-531, 273], [-544, 283], [-585, 324], [-610, 351], [-628, 372], [-634, 381], [-645, 402],
    [-663, 453], [-670, 474], [-672, 487], [-673, 508],
  ],
  // the left of the lap, 2910-3172 real m round
  [
    [-670, 533], [-663, 556], [-654, 574], [-644, 591], [-559, 726], [-552, 735], [-536, 751],
  ],
  // the left of the lap, 3396-4156 real m round
  [
    [-320, 789], [-225, 791], [-210, 792], [-196, 796], [-160, 818], [-145, 823], [-134, 826],
    [-120, 826], [-85, 821], [-79, 822], [-71, 825], [-63, 831], [-52, 842], [-48, 850],
    [-42, 864], [-40, 869], [-35, 874], [-28, 878], [-20, 881], [-14, 882], [15, 882], [24, 885],
    [36, 895], [86, 941], [103, 956], [119, 965], [154, 979], [170, 988], [179, 997], [190, 1013],
    [198, 1028], [213, 1061], [219, 1072], [223, 1077], [231, 1085], [238, 1088], [247, 1091],
    [256, 1092],
  ],
  // the left of the lap, 4166-4412 real m round
  [
    [270, 1090], [280, 1084], [290, 1073], [317, 1034], [354, 974], [381, 925], [390, 903],
    [395, 886],
  ],
  // the left of the lap, 4426-4710 real m round
  [
    [398, 871], [442, 594],
  ],
  // the left of the lap, 5154-5218 real m round
  [
    [508, 153], [518, 92],
  ],
  // the left of the lap, 5230-5522 real m round
  [
    [520, 78], [558, -175], [560, -187], [565, -202],
  ],
  // the left of the lap, 5982-6378 real m round
  [
    [621, -599], [656, -830], [678, -966], [680, -982],
  ],
  // the right of the lap, 58-460 real m round
  [
    [585, -1009], [197, -1074],
  ],
  // the right of the lap, 1016-1494 real m round
  [
    [89, -560], [8, -95],
  ],
  // the right of the lap, 1504-1610 real m round
  [
    [6, -83], [-7, -9], [-11, 5], [-16, 15], [-20, 21],
  ],
  // the right of the lap, 1678-1796 real m round
  [
    [-81, 53], [-94, 53], [-102, 51], [-122, 46], [-134, 43], [-142, 39], [-190, 13],
  ],
  // the right of the lap, 1806-3054 real m round
  [
    [-199, 8], [-326, -63], [-359, -80], [-377, -87], [-385, -89], [-395, -89], [-407, -88],
    [-424, -85], [-460, -73], [-466, -69], [-471, -64], [-474, -59], [-474, -53], [-474, -46],
    [-471, -40], [-418, 22], [-408, 38], [-402, 54], [-399, 66], [-398, 81], [-398, 100],
    [-403, 135], [-413, 187], [-416, 203], [-422, 220], [-433, 236], [-440, 244], [-450, 252],
    [-462, 260], [-510, 283], [-519, 289], [-537, 304], [-571, 338], [-593, 362], [-612, 384],
    [-622, 401], [-638, 441], [-650, 479], [-652, 490], [-653, 505], [-652, 520], [-650, 529],
    [-644, 548], [-636, 564], [-586, 644],
  ],
  // the right of the lap, 3172-3546 real m round
  [
    [-522, 737], [-509, 746], [-490, 757], [-481, 761], [-470, 764], [-455, 766], [-419, 768],
    [-223, 771], [-207, 773], [-199, 775], [-189, 778], [-175, 785],
  ],
  // the right of the lap, 3640-4306 real m round
  [
    [-99, 802], [-85, 801], [-78, 801], [-67, 804], [-60, 808], [-50, 816], [-36, 830],
    [-29, 842], [-25, 855], [-22, 858], [-12, 862], [19, 862], [26, 864], [34, 868], [50, 880],
    [99, 927], [114, 939], [128, 946], [168, 963], [182, 972], [188, 977], [198, 989],
    [216, 1019], [236, 1061], [241, 1067], [246, 1070], [251, 1072], [257, 1072], [265, 1070],
    [271, 1065], [300, 1024], [334, 969],
  ],
  // the right of the lap, 4344-4634 real m round
  [
    [353, 935], [368, 907], [374, 889], [386, 818], [411, 664],
  ],
  // the right of the lap, 4672-5516 real m round
  [
    [418, 625], [534, -150], [538, -179], [544, -203],
  ],
  // the right of the lap, 5948-6128 real m round
  [
    [597, -569], [623, -742],
  ],
];

// the venue's name (a parody of Bathurst: the owner's register, approved 11-10), in one place
export const BATHWORST = 'Bathworst';

export const BATHURST_SPEC: VenueSpec = {
  id: 'bathurst',
  data: BATHURST_VENUE,
  share: 0.5,
  // m: the real road (8-10 m over the mountain, 15-20 m on the straights)
  realRoadM: 12,
  calibrate: { layout: 'gp', realLapM: 6213 },
  // the start line by the pit straight's footbridge (aerial photographs: the checkered line, the
  // grid back toward Murray's Corner; OSM maps no start-finish node)
  start: [520, -1032],
  startOnLine: true,
  pitLane: 'Pit Lane',
  // the pit exit cuts inside Hell Corner to Mountain Straight: laid as mapped there, its wall along
  // the pit straight only
  pitCuts: true,
  // m (game): Hell Corner, The Chase and Murray's Corner are tighter than the venue's least radius
  minR: 10,
  // real m (scaled with the map: the same slopes): SRTM 30 m (EU-DEM covers only Europe) fitted
  // as 40 hills of 300 m and more (rms 1.4 m on the lap, worst 5.1 m): 698 m on Pit Straight up to
  // 875 m over McPhillamy Park and Skyline, the Esses' drop 20 % at its steepest; no 200 m hill
  // (they made Skyline's crest twice SRTM's sharpness: tools/scratch/_crestmap.mjs)
  hills: [
    { kind: 'hump', x: -650, y: 700, r: 1800, h: 176.1 },
    { kind: 'hump', x: 250, y: -700, r: 800, h: 28.1 },
    { kind: 'hump', x: -650, y: 0, r: 500, h: 39.6 },
    { kind: 'hump', x: 350, y: 1200, r: 500, h: 30 },
    { kind: 'dip', x: 50, y: 300, r: 500, d: 32.4 },
    { kind: 'dip', x: 450, y: 600, r: 300, d: 13.3 },
    { kind: 'dip', x: -350, y: 500, r: 300, d: 32.4 },
    { kind: 'hump', x: -850, y: 800, r: 500, h: 6 },
    { kind: 'dip', x: 650, y: -1100, r: 500, d: 10.3 },
    { kind: 'hump', x: 950, y: -100, r: 800, h: 13.6 },
    { kind: 'dip', x: -50, y: 1200, r: 300, d: 25.7 },
    { kind: 'hump', x: -350, y: -600, r: 500, h: 25.6 },
    { kind: 'dip', x: 150, y: -200, r: 300, d: 10.9 },
    { kind: 'hump', x: -150, y: 1100, r: 500, h: 14.2 },
    { kind: 'dip', x: 50, y: 600, r: 300, d: 2.5 },
    { kind: 'hump', x: 750, y: 1200, r: 500, h: 31.6 },
    { kind: 'dip', x: 450, y: 400, r: 300, d: 6.7 },
    { kind: 'hump', x: -50, y: -1100, r: 300, h: 15.1 },
    { kind: 'dip', x: -150, y: 500, r: 300, d: 22.1 },
    { kind: 'hump', x: -850, y: 300, r: 300, h: 19.3 },
    { kind: 'hump', x: -350, y: -300, r: 300, h: 14 },
    { kind: 'hump', x: 50, y: -400, r: 300, h: 6.2 },
    { kind: 'hump', x: -550, y: 300, r: 300, h: 9.1 },
    { kind: 'dip', x: 150, y: 1300, r: 300, d: 15.5 },
    { kind: 'dip', x: -150, y: 1100, r: 300, d: 16.7 },
    { kind: 'hump', x: -450, y: 1000, r: 300, h: 15.6 },
    { kind: 'dip', x: -950, y: 700, r: 300, d: 21.7 },
    { kind: 'hump', x: -250, y: 900, r: 300, h: 17.2 },
    { kind: 'dip', x: 350, y: -800, r: 300, d: 8.1 },
    { kind: 'hump', x: -250, y: -100, r: 300, h: 4.3 },
    { kind: 'dip', x: -850, y: 900, r: 300, d: 21.6 },
    { kind: 'hump', x: 650, y: 200, r: 300, h: 6 },
    { kind: 'dip', x: -750, y: -100, r: 300, d: 10.2 },
    { kind: 'hump', x: 650, y: 800, r: 300, h: 7.9 },
    { kind: 'hump', x: -150, y: -800, r: 300, h: 10 },
    { kind: 'hump', x: 750, y: -700, r: 300, h: 4.1 },
    { kind: 'dip', x: 150, y: 600, r: 300, d: 16.4 },
    { kind: 'hump', x: 150, y: 900, r: 300, h: 7.7 },
    { kind: 'dip', x: -350, y: 600, r: 300, d: 11.2 },
    { kind: 'hump', x: 550, y: -1200, r: 300, h: 7.6 },
  ],
  banks: [],
  // the boards on the walls at Hell Corner, Griffins Bend, Skyline, The Chase and Murray's Corner
  // (the register's brands; the venue's own name over Skyline)
  boards: [
    { at: [170, -1100], label: 'DUNFLOP' },
    { at: [-30, -35], label: 'PIRRELLY' },
    { at: [-380, 745], label: 'BATHWORST' },
    { at: [575, -200], label: 'GOOD YEAH' },
    { at: [690, -1010], label: 'FIRESTONED' },
  ],
  // Mount Panorama's first race meeting, 1938
  seed: 1938,
  followRails: true,
  // m past the road's edge the walls stand (aerial photographs: hard by the road over the mountain)
  runoffM: 3,
  mixFences: true,
  railsSeen: BT_RAILS,
};

// the one layout - built on first use (world/load.ts buildLevel)
export const BATHURST_LEVELS: Level[] = [
  { id: 'bathurst', name: BATHWORST, venue: BATHWORST,
    _lap: () => venueLap(BATHURST_SPEC, 'gp'),
    _build: () => venueLevel(BATHURST_SPEC, 'gp', 'bathurst', BATHWORST) } as Level,
];
