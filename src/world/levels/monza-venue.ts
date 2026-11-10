// world/levels/monza-venue.ts - MONZARELLA, a NEW venue (world/venue.ts; owner 11-09: the world
// championship circuits): the Autodromo Nazionale Monza (Italy) from OpenStreetMap
// (venues/monza.ts) at 1/2 of real length with the 13 m road: the Rettifilo, the Variante del
// Rettifilo, the Curva Grande, the Variante della Roggia, the two Lesmos, the Serraglio under the
// old banking, the Variante Ascari, the back straight and the Parabolica (Curva Alboreto) onto the
// pit straight, in the park. Checked against Wikipedia and Formula 1's track guide (the GP
// circuit 5.793 km, 11 turns; the OSM loop reads 5801 m), aerial photographs (ESRI World
// Imagery: the start line, the barriers) and OSM's pit lane, gravel traps (mapped as sand),
// grandstands, tunnels and footbridges. The old banked oval (the Sopraelevata) is left out: it
// shares the pit straight, and its north banking crosses over the circuit on a bridge as wide as
// a race road - a crossing the venues do not build. Nor the Pirelli test track's ruins or the
// motorcycle chicane. EU-DEM heights (25 m) fitted as two hills (rms 1.8 real m on the lap):
// the park rises gently north, from the Parabolica (181 m) to the Lesmos (199). North up, the
// lap clockwise.
import { MONZA_VENUE } from "./venues/monza.ts";
import { venueLap, venueLevel } from "../venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level, Point } from "../types.ts";

// THE BARRIERS (OSM maps only the pit straight's guard rails): the aerial photographs (ESRI World
// Imagery) show Armco or a wall both sides of the track all round the park, at the edge of each
// verge or behind the run-off - laid as a line 10 real m off the centreline each side, followed as
// rails (the edge's Armco at its rim; behind the gravel where there is gravel; a catch fence
// instead by the grandstands)
const MZ_RAILS: Point[][] = [
  // the right of the lap (inside)
    [[-608, 492], [-576, 183], [-568, 115], [-519, -432], [-520, -430], [-518, -431],
      [-500, -426], [-490, -428], [-483, -432], [-479, -437], [-475, -449], [-476, -459],
      [-478, -470], [-501, -563], [-505, -598], [-506, -622], [-494, -763], [-486, -805],
      [-479, -824], [-468, -849], [-456, -871], [-443, -892], [-431, -906], [-405, -933],
      [-392, -944], [-361, -967], [-325, -987], [-296, -1001], [-271, -1009], [-228, -1020],
      [-203, -1025], [-166, -1029], [73, -1048], [207, -1055], [214, -1058], [222, -1065],
      [226, -1074], [232, -1094], [235, -1099], [304, -1114], [520, -1185], [529, -1187],
      [541, -1188], [555, -1186], [565, -1183], [579, -1175], [590, -1164], [594, -1158],
      [597, -1152], [602, -1139], [604, -1121], [625, -889], [623, -879], [614, -871],
      [315, -703], [282, -682], [259, -665], [238, -649], [-212, -254], [-225, -241],
      [-230, -230], [-231, -221], [-227, -179], [-227, -164], [-228, -151], [-232, -136],
      [-241, -119], [-251, -106], [-265, -94], [-282, -80], [-290, -71], [-295, -59],
      [-299, -41], [-323, 156], [-400, 897], [-402, 912], [-405, 921], [-412, 932], [-420, 943],
      [-430, 950], [-444, 957], [-458, 962], [-469, 963], [-486, 961], [-516, 951], [-528, 944],
      [-543, 933], [-560, 917], [-577, 894], [-590, 869], [-599, 844], [-605, 823], [-611, 775],
      [-614, 595], [-613, 553], [-608, 492]],
  // the left of the lap (outside)
    [[-627, 490], [-596, 181], [-588, 113], [-539, -433], [-535, -444], [-525, -450],
      [-514, -451], [-499, -446], [-497, -447], [-495, -450], [-498, -466], [-517, -538],
      [-521, -559], [-525, -597], [-526, -623], [-514, -766], [-509, -794], [-505, -810],
      [-498, -831], [-486, -857], [-473, -881], [-459, -904], [-433, -934], [-405, -960],
      [-388, -973], [-357, -993], [-334, -1005], [-303, -1019], [-275, -1029], [-232, -1040],
      [-206, -1045], [-168, -1049], [72, -1068], [204, -1075], [207, -1078], [216, -1108],
      [220, -1113], [228, -1118], [299, -1133], [515, -1204], [528, -1207], [542, -1208],
      [559, -1206], [570, -1202], [591, -1191], [606, -1176], [615, -1161], [619, -1152],
      [622, -1137], [624, -1123], [645, -889], [640, -871], [634, -861], [626, -854],
      [325, -686], [271, -649], [251, -633], [-201, -238], [-210, -228], [-211, -220],
      [-207, -180], [-207, -163], [-209, -148], [-214, -129], [-224, -109], [-237, -92],
      [-252, -78], [-269, -66], [-273, -60], [-276, -53], [-279, -38], [-303, 158], [-381, 909],
      [-383, 918], [-387, 930], [-396, 944], [-405, 956], [-419, 967], [-427, 971], [-441, 977],
      [-455, 981], [-468, 983], [-485, 982], [-513, 974], [-525, 969], [-539, 960], [-564, 941],
      [-586, 916], [-602, 891], [-608, 877], [-618, 850], [-624, 827], [-628, 802], [-631, 776],
      [-634, 595], [-633, 552], [-627, 490]],
];

// the venue's name (a parody of Monza, from the owner's brief 11-09), in one place
export const MONZA = 'Monzarella';

export const MONZA_SPEC: VenueSpec = {
  id: 'monza',
  data: MONZA_VENUE,
  share: 0.5,
  // m: the real road (about 14 m on the aerial photographs)
  realRoadM: 14,
  calibrate: { layout: 'gp', realLapM: 5793 },
  // the start line on the pit straight, at the head of the grid (aerial photographs; OSM maps no
  // start-finish node)
  start: [-585, 183],
  startOnLine: true,
  pitLane: 'Pit Lane',
  // m (game): the chicanes are tighter than the venue's least radius
  minR: 10,
  // the hand finish (game m): three grandstand slices by the pit straight moved 4 m back (the catch
  // fence in front of them broke into runs with 4-8 m gaps between them, and between two stands
  // whose spectators did not quite meet); the stub where the road west of the pit straight stopped
  // short of the grandstands left out, the road cut at its last junction; the two roads to the
  // tunnel under the pit straight by the Parabolica (not built) joined where they met
  finish: {
    move: [{ at: [-291.3, -106.3], by: [-4, 0] }, { at: [-299.7, -10.2], by: [-4, -6] },
      { at: [-255.1, -103], by: [4, 0] }],
    drop: [[-346, -103]],
    cut: [{ at: [-351.4, -73.2], keep: [-352, -60] }],
    roads: [{ pts: [[-341.4, 379.4], [-336, 382], [-332.9, 388.8]] }],
  },
  // real m (scaled with the map): EU-DEM 25 m fitted (rms 1.8 m on the lap, 2.5 m within 250 m)
  hills: [
    { kind: 'hump', x: 180, y: -780, r: 2303, h: 23.6 },
    { kind: 'hump', x: -920, y: 940, r: 1287, h: 7 },
  ],
  // no viewing banks: a bank brings a catch fence (the grandstands bring their own)
  banks: [],
  // the boards on the barriers at the Curva Grande, the Lesmos, Ascari and the Parabolica (the
  // register's brands; the venue's own name at the Parabolica)
  boards: [
    { at: [-640, -820], label: 'PIRRELLY' },
    { at: [660, -1000], label: 'GOOD YEAH' },
    { at: [-180, -200], label: 'DUNFLOP' },
    { at: [-560, 1010], label: 'MONZARELLA' },
  ],
  // Monza opened in 1922
  seed: 1922,
  followRails: true,
  mixFences: true,
  railsSeen: MZ_RAILS,
};

// the one layout - built on first use (world/load.ts buildLevel)
export const MONZA_LEVELS: Level[] = [
  { id: 'monza', name: MONZA, venue: MONZA,
    _lap: () => venueLap(MONZA_SPEC, 'gp'),
    _build: () => venueLevel(MONZA_SPEC, 'gp', 'monza', MONZA) } as Level,
];
