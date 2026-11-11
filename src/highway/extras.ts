// highway extras: the off-slip signs, slip roads, bridges and the other cheeky extras.
// Split out of highway.ts.
import { SURFACES } from "../world/surfaces.ts";
import { STEP } from "./presets.ts";
import { straightAt, ease } from "./road.ts";
import { blocked, keepOut, addCut, sideStep, approaches, river, SLIP_EVERY, BRIDGE_EVERY, SLIP_LEN,
  SLIP_DEG, SLIP_W, PIER, SLIP_LONG, SIDE_RUN } from "./cuts.ts";
import type { Prop, Point, Lane } from '../world/types.ts';
import type { HwPoint, HwPose, HwState, HwLevel, Stamp, Bridge } from './hwtypes.ts';
import { laybysOn } from './laybys.ts';
import { layServices, newServices, servicesDue as yardDue, servicesOut } from './stations.ts';
import { SIDE_OUT } from './cuts.ts';
import { stretchAt } from './desertplan.ts';
import { gorgeAt } from './gorge.ts';
import { FIX } from '../core/fixes.ts';
import { JUNCTION_SHARE, LEAD_POINTS, layJunction } from './junctions.ts';

// a SERVICES (highway/stations.ts): m between them, the least and the most; the
// first one's road distance; m the side road runs beside the motorway past it
// a drivable road bridge's ramps up from its approach roads, m (the venues'
// longest: a 2.5 m rise over the crossing stays gentle - world/crossings.ts RISE_SHARE)
const RAMP_M = 14;
// Deaf Valley: open ground (no rock wall, no gorge) this far back and ahead of an
// extra, m - the signs before it, a long slip's bend, the services' side road and yard after it;
// and the step the check walks, m
const OPEN_BACK_M = 100, OPEN_AHEAD_M = 560, OPEN_STEP_M = 20;
// a bridge's: its approaches run off square to the road, so open ground only round it, m
// (MEASURED, tools/scratch/_hwextras.mjs: with the exits' window the first came at 4.6-9.3 km, on
// one seed none in 10 km)
const BRIDGE_OPEN_M = 60;
// (?roadparity=1) road points either side of a bridge where Deaf Valley's rock walls open for its
// approaches (4 m apart: a 7 m road and its verges)
const BRIDGE_GAP_POINTS = 4;
// and the least bend radius under one, m: the desert's roads wind more (the countryside's 900);
// over the 96 m checked a 500 m bend moves 2.3 m, inside the span's 6 m to spare
const DESERT_BRIDGE_RADIUS_M = 500;
// the least bend radius over a junction's 260 m, m: its slips follow the road's own
// points and its rings sit at the bridge, so a gentle bend is fine (the road's ends 18 m toward the
// rings' side at most; MEASURED, _junctions.mjs: at 900 the countryside had 0-1 in 12 km, at 600
// none on the dual and the twisty road)
const JUNCTION_RADIUS_M = 400;
const SERVICES_EVERY = [4000, 5000], SERVICES_FIRST_M = 1200, SERVICES_RUN_M = 220;
// m: the tightest bend a services goes on (the side road and its yard follow the road's bends; a
// slip's 900 m - MEASURED, _svcprobe: on the motorway's first seed none was straight enough from
// 1.2 km to 4.7 km)
const SERVICES_MIN_R_M = 500;

/**
 * Whether the road is gentle enough for a services round point i: no bend tighter than
 * SERVICES_MIN_R_M back to i - back and on to i + fwd.
 * @param road the road points
 * @param i road point index
 * @param back points behind
 * @param fwd points ahead
 * @returns gentle enough
 */
const gentleAt = (road: HwPoint[], i: number, back: number, fwd: number) => {
  for (let j = Math.max(0, i - back); j < Math.min(road.length, i + fwd); j++)
    if (Math.abs(road[j].curv || 0) > 1 / SERVICES_MIN_R_M) return false;
  return true;
};
/**
 * The signs before an off-slip, the SAME for every type: 180 / 120 / 60 m posts + the exit board.
 * @param level the highway level
 * @param i road point index of the slip
 * @param pointAt road point at (index, offset)
 * @param mark stamps a prop with its road distance
 * @param label the place name on the board
 * @returns {void}
 */
function addSlipSigns(level: HwLevel, i: number, pointAt: (i: number, off: number) => HwPose,
  mark: Stamp, label: string) {
  const halfWidth = level._hw.geo.hw;
  // the signs before it, the SAME for every type (you cannot tell which one comes back): 180 /
  // 120 / 60 m posts + the exit board
  for (const [delta, bars] of [
    [-180, 3],
    [-120, 2],
    [-60, 1],
  ]) {
    const j = i + Math.round(delta / STEP);
    if (j < 0) continue;
    const pos = pointAt(j, -(halfWidth + 3));
    level.props.push(mark({ kind: "slipcount", x: pos.x, y: pos.y, rot: pos.rot, bars }));
  }
  {
    const j = i - Math.round(90 / STEP);
    if (j >= 0) {
      const pos = pointAt(j, -(halfWidth + 6));
      level.props.push(
        mark({
          kind: "board",
          x: pos.x,
          y: pos.y,
          rot: pos.rot,
          label: "EXIT \u2192 " + label,
          blue: true,
        })
      );
    }
  }
}
/**
 * The centreline of an off-slip: along the road, drifting out at SLIP_DEG (eased in over 60 m);
 * a long one then bends on away after 80 m.
 * @param start the slip's first point {x, y, rot}
 * @param len slip length in metres
 * @param away degrees off the motorway at the end
 * @returns the line, a point every 10 m
 */
function slipCentreline(start: HwPose, len: number, away: number): Point[] {
  let x = start.x,
    y = start.y,
    heading = start.rot;
  const line: Point[] = [[x, y]];
  for (let along = 10; along <= len; along += 10) {
    heading =
      start.rot -
      ((SLIP_DEG * Math.min(1, along / 60) +
        (away - SLIP_DEG) * ease((along - 80) / Math.max(1, len - 80))) *
        Math.PI) /
        180;
    x += Math.cos(heading) * 10;
    y += Math.sin(heading) * 10;
    line.push([x, y]);
  }
  return line;
}
/** A slip road once built: its centre line, lane, prop, gate placer, length and road distance. */
interface BuiltSlip {
  line: Point[]; lane: Lane; prop: Prop; putGate: () => void; len: number; dist: number;
}

/**
 * The gate at the end of a slip, in a field (it moves back if the slip is cut short by the road
 * coming back).
 * @param level the highway level
 * @param line the slip's centreline
 * @param mark stamps a prop with its road distance
 * @returns putGate: places the gate at the current end of the line
 */
function addSlipGate(level: HwLevel, line: Point[], mark: Stamp) {
  const gate = mark({ kind: 'gate', x: 0, y: 0, rot: 0 });
  const putGate = () => {
    const count = line.length,
      [endX, endY] = line[count - 1],
      [prevX, prevY] = line[Math.max(0, count - 2)],
      endHeading = Math.atan2(endY - prevY, endX - prevX);
    Object.assign(gate, {
      x: endX + Math.cos(endHeading) * 3,
      y: endY + Math.sin(endHeading) * 3,
      rot: endHeading + Math.PI / 2,
    });
  };
  putGate();
  level.props.push(gate);
  return putGate;
}
/**
 * A long slip that the road swings back across is cut short there.
 * @param level the highway level
 * @param slip the built slip: its line, lane, prop, gate placer, length and road distance
 * @returns {void}
 */
function addSlipCut(level: HwLevel, slip: BuiltSlip) {
  const { line, lane, prop, putGate, len, dist } = slip;
  addCut(level, {
    pts: line,
    s: dist,
    w: SLIP_W,
    skip: [dist - 40, dist + len + 40],
    after: () => {
      lane.pts.length = line.length;
      lane._segs = undefined;
      prop._bb = undefined;
      putGate();
      level.solidsDirty = true;
    },
  });
}
/**
 * An off-slip: signs, then a side road (type "side") or a slip lane with its gate, keep-out
 * area and, for a long one, the cut where the road swings back across it.
 * @param level the highway level
 * @param i road point index
 * @param dist road distance at i
 * @param pointAt road point at (index, offset)
 * @param mark stamps a prop with its road distance
 * @returns {void}
 */
function buildSlip(level: HwLevel, i: number, dist: number, pointAt: (i: number,
  off: number) => HwPose, mark: Stamp) {
  const state = level._hw,
    road = state.pts,
    halfWidth = state.geo.hw,
    rand = state.xrnd,
    walled = !!level._cfg.walls;
  state.nextSlip = dist + SLIP_EVERY[0] + rand() * (SLIP_EVERY[1] - SLIP_EVERY[0]);
  // (Deaf Valley: no side road - it would run on past the open ground)
  const roll = rand(), type = roll < 0.25 && !state.desert ? 'side' : roll < 0.75 ? 'long'
    : 'short';
  // keep a bridge (and its approaches) clear of the slip; after a side road the next bridge waits
  // for its end (sideStep)
  if (dist > state.nextBridge! - 450) state.nextBridge = dist + 450;
  const names = state.desert ? DESERT_SLIP_NAMES : SLIP_NAMES,
    label = names[(Math.floor(dist / 1000) + state.seed) % names.length];
  addSlipSigns(level, i, pointAt, mark, label);
  if (type === "side") {
    state.side = {
      s0: dist,
      run: SIDE_RUN[0] + rand() * (SIDE_RUN[1] - SIDE_RUN[0]),
      pts: [],
      mpts: [],
      sPiece: dist,
    };
    sideStep(level, i, pointAt);
    return;
  }
  // a gap in the left wall (walled preset; ?roadparity=1 a Deaf Valley rock wall) where it leaves
  if (walled || (FIX.roadparity && state.desert))
    for (let j = Math.max(0, i - 4); j < Math.min(road.length, i + 28); j++) road[j].gapL = 1;
  const len = type === 'long' ? SLIP_LONG[0] + rand() * (SLIP_LONG[1] - SLIP_LONG[0]) : SLIP_LEN;
  // degrees off the motorway at the end: a long one bends away, off screen
  const away = type === "long" ? 18 + rand() * 22 : SLIP_DEG;
  const start = pointAt(i, -halfWidth), rot = start.rot - SLIP_DEG * Math.PI / 180;
  const line = slipCentreline(start, len, away);
  const [x, y] = line[line.length - 1];
  const prop = mark({
    kind: "slip",
    x: start.x,
    y: start.y,
    rot,
    line,
    w: SLIP_W,
    len,
    label,
    type,
  });
  level.props.push(prop);
  // the tarmac: a lane ribbon (lab.ts laneAt + render.ts drawLanes, as the pit lanes), starting
  // 12 m back and 2.6 m INSIDE the edge so its round end lies under the motorway ribbon
  // (PHOTOGRAPHED: starting outside the edge left a stub in the verge)
  const lanePt = pointAt(Math.max(0, i - 3), -halfWidth + 2.6),
    lane: Lane = {
      pts: [[lanePt.x, lanePt.y], ...line.slice(1)],
      width: SLIP_W,
      surface: SURFACES.tarmac,
      _s: dist,
    };
  level.lanes.push(lane);
  const putGate = addSlipGate(level, line, mark);
  keepOut(
    level,
    {
      x: (start.x + x) / 2,
      y: (start.y + y) / 2,
      ax: Math.cos(Math.atan2(y - start.y, x - start.x)),
      ay: Math.sin(Math.atan2(y - start.y, x - start.x)),
      hu: Math.hypot(x - start.x, y - start.y) / 2 + 6,
      hv: len > 200 ? 30 : 8,
    },
    dist
  );
  if (type === "long") addSlipCut(level, { line, lane, prop, putGate, len, dist });
}
/**
 * Add the motorway's own parapets either side of a river bridge (lab walls).
 * @param level the highway level
 * @param i road point index at the bridge
 * @param dist road distance at i
 * @param pointAt road point at (index, offset)
 * @returns {void}
 */
function addRiverParapets(level: HwLevel, i: number, dist: number, pointAt: (i: number,
  off: number) => HwPose) {
  const road = level._hw.pts, halfWidth = level._hw.geo.hw;
  for (const side of [-1, 1]) {
    const pts: Point[] = [];
    for (let step = -6; step <= 6; step++) {
      const j = Math.max(0, Math.min(road.length - 1, i + step)),
        pos = pointAt(j, side * (halfWidth + 1.2));
      pts.push([pos.x, pos.y]);
    }
    level.barriers.push({ kind: "wall", pts, _s: dist });
  }
}
/**
 * What a bridge carries, from its roll: a road, a railway, a footpath or (the motorway over) a
 * river; Deaf Valley no footbridges or rivers - road bridges instead (owner 11-11).
 * @param roll 0..1
 * @param desert on Deaf Valley
 * @returns 'road', 'rail', 'foot' or 'river'
 */
function bridgeKind(roll: number, desert: boolean): string {
  if (roll < 0.38 || (desert && roll >= 0.62)) return 'road';
  return roll < 0.62 ? 'rail' : roll < 0.82 ? 'foot' : 'river';
}

/**
 * A bridge: over (road / rail / foot) or the motorway over a river, with its cheeky extras and
 * what moves across it, then the approaches (or the river and its parapets).
 * @param level the highway level
 * @param i road point index
 * @param dist road distance at i
 * @param pointAt road point at (index, offset)
 * @param mark stamps a prop with its road distance
 * @returns {void}
 */
function buildBridge(level: HwLevel, i: number, dist: number, pointAt: (i: number,
  off: number) => HwPose, mark: Stamp, isJunction = false) {
  const state = level._hw,
    halfWidth = state.geo.hw,
    rand = state.xrnd,
    walled = !!level._cfg.walls;
  state.nextBridge = dist + BRIDGE_EVERY[0] + rand() * (BRIDGE_EVERY[1] - BRIDGE_EVERY[0]);
  // no slip under a bridge's approach
  if (dist > state.nextSlip! - 400) state.nextSlip = dist + 400;
  const kind = isJunction ? (rand(), 'road') : bridgeKind(rand(), !!state.desert);
  // walled: the wall stands wallGap off the edge - the span and the parapets clear it
  const wallOff = walled ? level._cfg.wallGap! : 0,
    centre = pointAt(i, 0),
    skew = (rand() - 0.5) * 0.5 * (isJunction ? 0 : 1),
    span = 2 * halfWidth + 2 * PIER + 6 + 2 * wallOff;
  const bridge = mark({
    kind: kind === "river" ? "river" : "bridge",
    carries: kind,
    x: centre.x,
    y: centre.y,
    rot: centre.rot + Math.PI / 2 + skew,
    wid: span,
    seed: dist | 0,
    skew,
    roadHw: halfWidth + 1.2 + wallOff,
    // (Deaf Valley: sun-bleached road bridges, timber rail trestles - render/props/bridges.ts)
    ...(state.desert ? { look: 'desert' } : {}),
    ...roadBridgeLook(kind, !!state.desert, isJunction),
  }) as Bridge;
  // CHEEKY EXTRAS, rare (each ~1 in 6 of its bridge type)
  const extra = rand() < 1 / 6;
  addBridgeExtras(bridge, kind, extra, rand);
  // what MOVES across it (render.ts drawBridge, wall clock, no physics): road traffic both ways,
  // walkers, a train now and then
  bridge.phase = rand() * 1000;
  if (kind === 'rail') bridge.trainEvery = 14 + rand() * 16;
  // (?roadtunnels=1: now and then the road goes under instead - its portals, not a bridge)
  if (FIX.roadtunnels && kind === 'road' && !isJunction && rand() < TUNNEL_SHARE) {
    buildUnderpass(level, bridge, dist);
    openRockAt(state, i);
    return bridge;
  }
  level.props.push(bridge);
  openRockAt(state, i);
  if (kind === 'river') {
    // the motorway's own parapets over it (lab walls); on the walled preset its wall is already
    // there
    if (!walled) addRiverParapets(level, i, dist, pointAt);
    river(level, bridge, dist);
  } else approaches(level, bridge, dist);
  return bridge;
}

/**
 * (?roadparity=1) Opens Deaf Valley's rock walls both sides where a bridge's approaches cross
 * (canyon.ts isWallOpen).
 * @param state the highway state
 * @param i the bridge's road point
 */
function openRockAt(state: HwState, i: number) {
  if (!FIX.roadparity || !state.desert) return;
  const last = Math.min(state.pts.length - 1, i + BRIDGE_GAP_POINTS);
  for (let j = Math.max(0, i - BRIDGE_GAP_POINTS); j <= last; j++) {
    state.pts[j].gapL = 1;
    state.pts[j].gapR = 1;
  }
}

/**
 * A bridge's cheeky extras by what it carries: a road's cars and its cow, a footbridge's cone and
 * walkers, a river's boat and its width.
 * @param bridge the bridge
 * @param kind what it carries
 * @param extra whether its rare extra is there
 * @param rand the extras' random stream
 */
function addBridgeExtras(bridge: Bridge, kind: string, extra: boolean, rand: () => number) {
  if (kind === "road") {
    bridge.cars = 1 + ((rand() * 2) | 0);
    bridge.cow = extra;
  }
  if (kind === "foot") {
    bridge.cone = extra;
    bridge.people = 1 + ((rand() * 3) | 0);
  }
  if (kind === "river") {
    bridge.boat = extra;
    bridge.ww = 10 + rand() * 8;
  }
}

/**
 * (?roadtunnels=1) A road under the motorway in place of a bridge: a portal each side just past
 * the motorway's edge (its wall's on the walled road), facing the other, the road dipping under
 * between them (the venues' tunnel: world/crossings.ts tunnelCrossing, paired by `pair` in
 * highway/bridgeways.ts); its approach roads on from the portals' open ends, as a bridge's.
 * @param level the highway level
 * @param bridge the bridge it stands for (its centre, its road's line rot, its span wid)
 * @param dist road distance, m
 */
function buildUnderpass(level: HwLevel, bridge: Bridge, dist: number) {
  const state = level._hw, wallOff = level._cfg.walls ? level._cfg.wallGap! : 0;
  const mouth = state.geo.hw + wallOff + PORTAL_CLEAR_M, centreOut = mouth + PORTAL_M / 2;
  // (square to the motorway - a bridge's skew left its portals at an angle to the road above -
  // and its road on the portals' middle line, not a drivable deck's footway-offset one)
  const rot = bridge.rot - bridge.skew, axisX = Math.cos(rot), axisY = Math.sin(rot);
  const pair = (state.underpasses = (state.underpasses || 0) + 1);
  for (const side of [-1, 1])
    level.props.push({ kind: 'tunnel', x: bridge.x + axisX * side * centreOut,
      y: bridge.y + axisY * side * centreOut, rot: rot + (side > 0 ? Math.PI : 0),
      w: PORTAL_M, h: TUNNEL_ROAD_M, pair, _s: bridge._s } as Prop);
  // (the approaches from the open ends: approaches() starts them at half + 3 m out)
  approaches(level, { ...bridge, rot, skew: 0, look: undefined, rampL: undefined,
    wid: 2 * (mouth + PORTAL_M - 3) } as Bridge, dist);
}
// (?roadtunnels=1) the share of road bridges that are tunnels instead; a portal's length and the
// tunnel road's width (the venues' measures, world/venuecross.ts); m its mouth stands past the
// motorway's edge
const TUNNEL_SHARE = 1 / 3, PORTAL_M = 9, TUNNEL_ROAD_M = 8.2, PORTAL_CLEAR_M = 3;

/**
 * A road bridge's drivable look: the venues' drivable bridge (world/crossings.ts), its ramps up
 * from its approaches; Deaf Valley's in sand concrete; a junction's with its rings.
 * @param kind what the bridge carries
 * @param isDesert on Deaf Valley
 * @param isJunction a junction's bridge
 * @returns the fields to add to the bridge prop
 */
function roadBridgeLook(kind: string, isDesert: boolean, isJunction: boolean) {
  // (?railbridges=1: a rail bridge drivable along its track, its ramps up from its ballast)
  if (kind === 'rail' && FIX.railbridges) return { rampL: [RAMP_M, RAMP_M] };
  if (kind !== 'road') return {};
  return { look: 'venue', rampL: [RAMP_M, RAMP_M], ...(isDesert ? { pal: 'desert' } : {}),
    ...(isJunction ? { rings: true } : {}) };
}

/**
 * A junction in place of the bridge due at road point i, when one is owed (one
 * rolled at a bridge where none fits is owed to the next that fits: about one bridge in four,
 * MEASURED _junctions.mjs - else the winding roads had none in 12 km) and fits.
 * @param level the highway level
 * @param i road point index
 * @param pointAt road point at (index, offset)
 * @param mark stamps a prop with its road distance
 * @returns true when one was built
 */
function tryJunction(level: HwLevel, i: number, pointAt: (i: number, off: number) => HwPose,
  mark: Stamp) {
  const state = level._hw;
  if (!state.junctionOwed && state.xrnd() < JUNCTION_SHARE) state.junctionOwed = true;
  if (!state.junctionOwed || !junctionFits(level, i)) return false;
  state.junctionOwed = false;
  buildJunction(level, i, pointAt, mark);
  return true;
}

/**
 * Whether a junction fits back over the road just dressed, its on-slip joining at
 * road point i: the road gentle from before the off-slip to here, no wall (the walled road's is
 * built), no roadside station in the way, open ground in Deaf Valley.
 * @param level the highway level
 * @param i the road point the junction falls due at
 * @returns true when one can be built
 */
function junctionFits(level: HwLevel, i: number) {
  const state = level._hw, road = state.pts, span = 2 * LEAD_POINTS, from = junctionFrom(i);
  // (laid back over the road just dressed, the walled road's wall is built there; laid ahead -
  // ?roadparity=1 - the road ahead must be there)
  if (from < 4 || from + span + 4 >= road.length || state.side) return false;
  if (level._cfg.walls && !FIX.roadparity) return false;
  if (!straightAt(road, from + span, span + 4, 12, JUNCTION_RADIUS_M)) return false;
  const fromS = road[from].s, toS = road[from + span].s;
  if (level.props.some((prop) => STATION_KINDS.has(prop.kind) && prop._s != null
    && prop._s > fromS - 60 && prop._s < toS + 60)) return false;
  return isOpenGround(state, fromS, OPEN_BACK_M, span * STEP + BRIDGE_OPEN_M)
    && isOpenGround(state, road[from + LEAD_POINTS].s, BRIDGE_OPEN_M, BRIDGE_OPEN_M, [1]);
}
/**
 * The road point a junction falling due at i leaves at: back over the road just dressed, or
 * (?roadparity=1, the road ahead there) i itself.
 * @param i the road point the junction falls due at
 * @returns its off-slip's road point
 */
const junctionFrom = (i: number): number => (FIX.roadparity ? i : i - 2 * LEAD_POINTS);
// what stands in a lay-by or a services' yard (a junction keeps off them)
const STATION_KINDS = new Set(['gasstation', 'canopy', 'services', 'servicehall', 'station']);

/**
 * A junction, its on-slip joining at road point i: the exit's signs before the
 * off-slip 2 x LEAD_POINTS back, the bridge LEAD_POINTS back (a road bridge, square to the road),
 * its slips and roundabouts (highway/junctions.ts); the next slip and bridge kept clear of it.
 * @param level the highway level
 * @param i the road point the on-slip joins at
 * @param pointAt road point at (index, offset)
 * @param mark stamps a prop with its road distance
 */
function buildJunction(level: HwLevel, i: number, pointAt: (i: number, off: number) => HwPose,
  mark: Stamp) {
  const state = level._hw, road = state.pts, fromIdx = junctionFrom(i);
  const bridgeIdx = fromIdx + LEAD_POINTS, names = state.desert ? DESERT_SLIP_NAMES : SLIP_NAMES;
  addSlipSigns(level, fromIdx, pointAt, mark, names[(Math.floor(road[fromIdx].s / 1000)
    + state.seed) % names.length]);
  const bridge = buildBridge(level, bridgeIdx, road[bridgeIdx].s, pointAt, mark, true);
  layJunction(level, fromIdx, bridge, bridgeIdx, pointAt);
  state.nextSlip = Math.max(state.nextSlip!, road[bridgeIdx + LEAD_POINTS].s + 700);
}
/**
 * Whether an off-slip is due here: 60 m of straight before and 150 m after, side road not running.
 * @param state the highway state
 * @param road the road points
 * @param i road point index
 * @param dist road distance at i
 * @returns true when the slip should be built
 */
function slipDue(state: HwState, road: HwPoint[], i: number, dist: number) {
  return isOpenGround(state, dist) && (
    dist >= state.nextSlip! &&
    !state.side &&
    i > 20 &&
    i < road.length - 50 &&
    straightAt(road, i, 15, 38)
  );
}
/**
 * Whether a SERVICES is due here: a road with a hard shoulder or walls, its distance reached, 60 m
 * of gentle road before and 150 m after, open ground (Deaf Valley), no side road running.
 * @param level the highway level
 * @param i road point index
 * @param dist road distance at i
 * @returns true when it should be built
 */
function servicesDue(level: HwLevel, i: number, dist: number) {
  const state = level._hw, road = state.pts;
  if ((laybysOn(level) && !level._cfg.walls) || !isOpenGround(state, dist)) return false;
  state.nextServices ??= SERVICES_FIRST_M;
  return dist >= state.nextServices && !state.side && i > 20 && i < road.length - 50
    && gentleAt(road, i, 15, 38);
}

/**
 * A SERVICES: the slip's signs with its name, then the side road (highway/cuts.ts
 * sideStep) running SERVICES_RUN_M beside the motorway, its yard laid part way along it
 * (highway/stations.ts layServices); the next slip and bridge kept clear of it.
 * @param level the highway level
 * @param i road point index
 * @param dist road distance at i
 * @param pointAt road point at (index, offset)
 * @param mark stamps a prop with its road distance
 */
function buildServices(level: HwLevel, i: number, dist: number, pointAt: (i: number,
  off: number) => HwPose, mark: Stamp) {
  const state = level._hw, rand = state.xrnd;
  state.nextServices = dist + SERVICES_EVERY[0] + rand() * (SERVICES_EVERY[1] - SERVICES_EVERY[0]);
  state.nextSlip = Math.max(state.nextSlip!, dist + 700);
  if (dist > state.nextBridge! - 450) state.nextBridge = dist + 450;
  const services = newServices(state.servicesN || 0, dist, state.seed);
  state.servicesN = (state.servicesN || 0) + 1;
  addSlipSigns(level, i, pointAt, mark, services.name);
  state.side = { s0: dist, run: SERVICES_RUN_M, pts: [], mpts: [], sPiece: dist,
    extra: (j, along, off, poseAt) => {
      if (yardDue(services, along, SIDE_OUT)) layServices(level, j, off, poseAt, services);
      return servicesOut(along, SIDE_OUT);
    } };
  sideStep(level, i, pointAt);
}

/**
 * Whether the ground round an extra is open: always off Deaf Valley; there only
 * desert or dunes from `back` m before to `ahead` m after - no rock wall, no gorge.
 * @param state the highway state
 * @param dist road distance, m
 * @param back m before it that must be open (an exit's signs)
 * @param ahead m after it (a long slip's bend, the services' side road and yard)
 * @param sides the road's sides it reaches (-1 the left: a slip; both: a bridge's approaches)
 * @returns true when an extra can be built here
 */
function isOpenGround(state: HwState, dist: number, back = OPEN_BACK_M, ahead = OPEN_AHEAD_M,
  sides: number[] = [-1]) {
  if (!state.desert) return true;
  const last = dist + ahead;
  for (let along = Math.max(0, dist - back); along <= last; along += OPEN_STEP_M) {
    // (?roadparity=1: only a gorge on its side keeps it off - the rock walls open where it passes,
    // canyon.ts)
    if (FIX.roadparity) {
      if (sides.some((side) => gorgeAt(along, side, state.seed))) return false;
      continue;
    }
    const kind = stretchAt(along, state.seed).kind;
    if (kind !== 'desert' && kind !== 'dunes') return false;
  }
  return true;
}
/**
 * Whether a bridge is due here: not while the side road runs beside the motorway.
 * @param state the highway state
 * @param road the road points
 * @param i road point index
 * @param dist road distance at i
 * @returns true when the bridge should be built
 */
function bridgeDue(state: HwState, road: HwPoint[], i: number, dist: number) {
  return isOpenGround(state, dist, BRIDGE_OPEN_M, BRIDGE_OPEN_M, [-1, 1]) && (
    dist >= state.nextBridge! && !state.side && i < road.length - 20
    && straightAt(road, i, 12, 12, state.desert ? DESERT_BRIDGE_RADIUS_M : undefined)
  );
}
/**
 * Everything the road adds beside itself at one point, from its own random stream (state.xrnd,
 * not the road's: adding / changing an extra never re-rolls the road's shape): an off-slip, or
 * else a bridge, or else (rarely) a smiley solar farm.
 * @param level the highway level
 * @param i road point index
 * @param dist road distance at i
 * @param pointAt road point at (index, offset)
 * @param mark stamps a prop with its road distance
 * @returns {void}
 */
export function extras(level: HwLevel, i: number, dist: number, pointAt: (i: number,
  off: number) => HwPose, mark: Stamp) {
  // every random choice here draws from st.xrnd (not the road's st.rnd): adding / changing an extra
  // never re-rolls the road's shape
  const state = level._hw,
    road = state.pts,
    halfWidth = state.geo.hw,
    rand = state.xrnd,
    walled = !!level._cfg.walls;
  if (state.nextSlip == null) {
    state.nextSlip = 900 + rand() * 900;
    state.nextBridge = 500 + rand() * 500;
  }
  // a SERVICES: the side road, signed with its name, past its yard
  if (servicesDue(level, i, dist)) {
    buildServices(level, i, dist, pointAt, mark);
    return;
  }
  // OFF-SLIP: needs 60 m of straight before (signs) and 150 m after; never while the side road is
  // running
  if (slipDue(state, road, i, dist)) {
    buildSlip(level, i, dist, pointAt, mark);
    return;
  }
  // BRIDGES: over (road / rail / foot) or the motorway over a river. Not while the side road runs
  // beside the motorway.
  // (a few of the bridges a junction - laid back over the road just dressed, its
  // on-slip joining here: the road ahead is not built yet)
  if (bridgeDue(state, road, i, dist) && tryJunction(level, i, pointAt, mark)) return;
  if (bridgeDue(state, road, i, dist)) {
    buildBridge(level, i, dist, pointAt, mark);
    return;
  }
  // SMILEY SOLAR FARM: rare, well off the road (not on walled: nothing grows inside the walls)
  if (!walled && i % 200 === 0 && rand() < 0.15) {
    const side = rand() < 0.5 ? -1 : 1,
      pos = pointAt(i, side * (halfWidth + 45 + rand() * 30));
    if (!blocked(state.keep, pos.x, pos.y, 16))
      level.props.push(mark({ kind: "solarfarm", x: pos.x, y: pos.y, rot: pos.rot + Math.PI / 2 }));
  }
}
// Deaf Valley's exits: its real places as the game names them, and a joke or two
const DESERT_SLIP_NAMES = ['SADWATER', 'FURNACE CREAK', 'STOVEPIPE HELLS', 'ZABRISKIE POINTLESS',
  "DEVIL'S GOLF CORSE", 'LAST CHANCE (REALLY)', 'NOTHING FOR 200 MI', 'HULL (STILL NOT)'];
const SLIP_NAMES = [
  "GOOLE",
  "SCUNTHORPE",
  "NOWHERE",
  "BRIGG",
  "SERVICES (SHUT)",
  "HOWDEN",
  "A NICE FIELD",
  "SOMEWHERE",
  "HULL (NOT REALLY)",
  "THE NORTH",
];
