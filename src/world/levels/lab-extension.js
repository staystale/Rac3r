import { SURFACES } from "../surfaces.ts";

// =============================================================================================
// S-B THE LAB EXTENSION (user, 2026-10-06, VERBATIM: "add some of every object laid out nicely ready to test crash into ect into he lab
// level, maybe extend the bottom of the map ? with some strips of all the different tarmacs and stuff, the objects can be at the end of
// the lanes make it fun and useful"; Q3 "go 1k why not fill the other area with an off road test area with some test hills grass and dirt
// with active terrain"; Q4 "ideally one for each but maybe mix some if needed"). The floor goes from 520 x 520 to 520 x 1000 m: the old
// square is untouched (tools/_labcheck.mjs proves every old metre is the same) and the new 480 m runs SOUTH of it, in the lab floor.
//   y 290..526  CRASH LANES: one per surface (17), 11 m wide, 460 m long, driven WEST -> EAST; at the east end of each, one object kind
//               (two kinds where 21 kinds meet 17 lanes) laid out to drive into. Boxed: no blend, no inclusions, so each stays pure.
//   y 548..732  OFF-ROAD AREA: grass with long grass, a mud bog, sand, gravel, a dirt loop round it and a dirt straight with jumps, plus
//               hills and hollows. Grass / dirt / mud / sand carry the natural terrain (NAT_SURF) and all of it wears (the wear map).
export const LAB_BOUNDS = { x0: -260, x1: 260, y0: -260, y1: 740 };
const LANE_Y0 = 296, LANE_PITCH = 14, LANE_H = 11, LANE_X0 = -245, LANE_X1 = 215, OBJ_X = 168;
// [surface, object kinds at the end] - hard -> loose -> cold. Mixed pairs: exhaust + bumper, chevron + flag, cow + crate, sheep + bin (S-C: the animals FIRST, so you can hit one clean).
export const LAB_LANES = [
  ['lab', ['cone']], ['racetarmac', ['tyrestack']], ['tarmac', ['banger']], ['concrete', ['caravan']], ['broken', ['podium']],
  ['wet', ['tyre']], ['dirt', ['bale']], ['gravel', ['pallet']], ['sand', ['sandbag']], ['grassShort', ['box']], ['grass', ['cow', 'crate']],
  ['grassLong', ['sheep', 'bin']], ['mud', ['barrel']], ['thickMud', ['exhaust', 'bumper']], ['packedSnow', ['chevron', 'flag']],
  ['snow', ['tarp']], ['ice', ['tapepost']],
].map(([id, kinds], i) => ({ id, kinds, y: LANE_Y0 + i * LANE_PITCH }));
export const LAB_LANE_ZONES = LAB_LANES.map((l) => ({ x: (LANE_X0 + LANE_X1) / 2, y: l.y, w: LANE_X1 - LANE_X0, h: LANE_H, surface: SURFACES[l.id], boxed: true, ext: true, lane: l.id }));
const LANE_COLS = ['#c8302c', '#2b56b5', '#d6a21e', '#2f5d3a', '#3a3f47', '#2f6fb0'];
// what sits at the end of a lane: a wall / grid / row per kind, centred on the lane line, starting at OBJ_X
function laneObjects(kinds, y, li) {
  const out = [], col = (n) => LANE_COLS[(li + n) % LANE_COLS.length];
  for (const [ki, kind] of kinds.entries()) {
    const x0 = OBJ_X + ki * 14;        // the second kind of a mixed lane sits 14 m further on
    if (kind === 'cone') { for (let c = 0; c < 4; c++) for (let r = 0; r < 5; r++) out.push({ kind: 'cone', x: x0 + c * 4, y: y - 4 + r * 2 }); }
    else if (kind === 'tyrestack') { for (let c = 0; c < 2; c++) for (let r = 0; r < 9; r++) out.push({ kind: 'tyrestack', x: x0 + c * 1.0, y: y - 4 + r * 1.0 }); }
    else if (kind === 'tyre') { for (let c = 0; c < 3; c++) for (let r = 0; r < 4; r++) out.push({ kind: 'tyre', x: x0 + c * 3, y: y - 4.5 + r * 3 }); }
    else if (kind === 'bale') { for (let r = 0; r < 6; r++) out.push({ kind: 'bale', x: x0, y: y - 4.2 + r * 1.7 }); out.push({ kind: 'bale', x: x0 + 8, y: y - 1 }, { kind: 'bale', x: x0 + 8, y: y + 1 }); }
    else if (kind === 'banger') { out.push({ kind: 'banger', x: x0 + 2, y, rot: Math.PI / 2, paint: '#8b2a26', num: '42' }, { kind: 'banger', x: x0 + 12, y: y - 2.5, rot: 0.3, paint: '#2a4d7a', num: '17' }, { kind: 'banger', x: x0 + 12, y: y + 2.8, rot: -0.3, paint: '#8b7a2b', num: '88' }); }
    else if (kind === 'caravan') { out.push({ kind: 'caravan', x: x0 + 3, y, rot: Math.PI / 2 }, { kind: 'caravan', x: x0 + 16, y: y + 1, rot: 0.2 }); }
    else if (kind === 'podium') out.push({ kind: 'podium', x: x0 + 3, y, rot: 0 });
    else if (kind === 'sheep') { for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) out.push({ kind: 'sheep', x: x0 + c * 2.6, y: y - 2.8 + r * 2.8, rot: (c + r) * 0.9 }); }
    else if (kind === 'cow') { for (let r = 0; r < 3; r++) out.push({ kind: 'cow', x: x0 + (r % 2) * 3.5, y: y - 3.4 + r * 3.4, rot: r * 0.5 }); }
    else if (kind === 'chevron') { for (let r = 0; r < 4; r++) out.push({ kind: 'chevron', x: x0, y: y - 3.9 + r * 2.6, rot: Math.PI / 2, col: '#c8302c' }); }
    else if (kind === 'flag') { for (let r = 0; r < 3; r++) out.push({ kind: 'flag', x: x0, y: y - 3.5 + r * 3.5, col: col(r) }); }
    else if (kind === 'tapepost') { for (const [t, dx] of [[0, 0], [1, 8]]) for (let r = 0; r < 5; r++) out.push({ kind: 'tapepost', x: x0 + dx, y: y - 5 + r * 2.5, tape: 'lab-ice-' + t, idx: r }); }
    else { const n = kinds.length > 1 ? 2 : 3; for (let c = 0; c < n; c++) for (let r = 0; r < 3; r++) out.push({ kind, x: x0 + c * 4, y: y - 3.5 + r * 3.5, rot: (c * 3 + r) * 0.7, col: col(c * 3 + r) }); }
  }
  return out;
}
export const LAB_CRASH_OBJECTS = LAB_LANES.flatMap((l, i) => laneObjects(l.kinds, l.y, i));
// the OFF-ROAD AREA (first listed wins: the small features before the grass they sit in)
const OR_Y = 640;
export const LAB_OFFROAD_ZONES = [
  { x: -20, y: OR_Y, w: 16, h: 12, surface: SURFACES.thickMud },                 // the bog's deep middle
  { x: -20, y: OR_Y, w: 40, h: 30, surface: SURFACES.mud },                      // MUD BOG
  { x: 0, y: 600, w: 200, h: 8, surface: SURFACES.dirt },                        // DIRT STRAIGHT with the jumps
  { x: 0, y: 558, w: 488, h: 8, surface: SURFACES.dirt },                        // DIRT LOOP round the area: north,
  { x: 0, y: 722, w: 488, h: 8, surface: SURFACES.dirt },                        //   south,
  { x: -240, y: OR_Y, w: 8, h: 172, surface: SURFACES.dirt },                    //   west,
  { x: 240, y: OR_Y, w: 8, h: 172, surface: SURFACES.dirt },                     //   east
  { x: -168, y: OR_Y, w: 136, h: 140, surface: SURFACES.grassLong },             // LONG GRASS meadow (west)
  { x: 196, y: 598, w: 64, h: 52, surface: SURFACES.sand },                      // SAND (east; dunes from NAT_SURF whoops)
  { x: 196, y: 682, w: 64, h: 52, surface: SURFACES.gravel },                    // GRAVEL
  { x: 0, y: OR_Y, w: 496, h: 184, surface: SURFACES.grass },                    // the rest: GRASS (rolling natural terrain)
].map((z) => ({ ...z, ext: true }));
export const LAB_OFFROAD_BUMPS = [
  { kind: 'ramp', x: -40, y: 600, rot: 0, len: 14, wid: 8, h: 1.2 },             // the straight: a launch ramp ...
  { kind: 'table', x: 40, y: 600, rot: 0, len: 24, wid: 9, h: 1.0 },             // ... then a table top
  { kind: 'hump', x: -60, y: 688, r: 28, h: 3.5 },                               // HILLS
  { kind: 'hump', x: 60, y: 690, r: 22, h: 2.2 },
  { kind: 'hump', x: 130, y: 676, r: 30, h: 5.0 },                               // the big one
  { kind: 'hump', x: 112, y: 612, r: 14, h: 1.6 },
  ...[0, 1, 2, 3, 4].map((i) => ({ kind: 'hump', x: -110 + i * 11, y: 710, r: 4, h: 0.45 })),   // whoops in the grass by the loop
  { kind: 'dip', x: -170, y: 640, r: 14, d: 1.2 },                               // a hollow in the long grass
  { kind: 'dip', x: 70, y: 632, r: 9, d: 0.7 },
  { kind: 'washboard', x: -150, y: 558, rot: 0, len: 60, wid: 7, amp: 0.05, wave: 0.9 },   // corrugations on the loop
];
export const LAB_EXT_PAINT = [
  { kind: 'box', x: (LANE_X0 + LANE_X1) / 2, y: (LAB_LANES[0].y + LAB_LANES[LAB_LANES.length - 1].y) / 2, w: LANE_X1 - LANE_X0 + 8, h: LAB_LANES.length * LANE_PITCH + 6, tone: 0.8 },
  { kind: 'box', x: 0, y: OR_Y, w: 500, h: 188, tone: 0.8 },
];
export const LAB_EXT_BOARDS = [
  { x: -15, y: 282, label: 'CRASH TEST LANES  -  drive EAST, objects at the end' },
  ...LAB_LANES.map((l) => ({ x: LANE_X0 + 18, y: l.y, label: l.kinds.map((k) => (k === 'tapepost' ? 'TAPE' : k.toUpperCase())).join(' + ') + '  >' })),
  { x: 0, y: 541, label: 'OFF-ROAD TEST AREA  -  hills, grass, dirt, mud, sand, gravel' },
];
