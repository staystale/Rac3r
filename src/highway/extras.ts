// highway extras: the off-slip signs, slip roads, bridges and the other cheeky extras.
// Split out of highway.ts.
import { SURFACES } from "../world/surfaces.ts";
import { STEP } from "./presets.ts";
import { straightAt, ease } from "./road.ts";
import { blocked, keepOut, addCut, sideStep, approaches, river, SLIP_EVERY, BRIDGE_EVERY, SLIP_LEN,
  SLIP_DEG, SLIP_W, PIER, SLIP_LONG, SIDE_RUN } from "./cuts.ts";
import type { Prop, Point, Lane } from '../world/types.ts';
import type { HwPoint, HwPose, HwState, HwLevel, Stamp, Bridge } from './hwtypes.ts';
import { FIX } from '../core/fixes.ts';
import { laybysOn } from './laybys.ts';
import { layServices, newServices, servicesDue as yardDue, servicesOut } from './stations.ts';
import { SIDE_OUT } from './cuts.ts';

// (?hwstations=1) a SERVICES (highway/stations.ts): m between them, the least and the most; the
// first one's road distance; m the side road runs beside the motorway past it
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
  const roll = rand(), type = roll < 0.25 ? 'side' : roll < 0.75 ? 'long' : 'short';
  // keep a bridge (and its approaches) clear of the slip; after a side road the next bridge waits
  // for its end (sideStep)
  if (dist > state.nextBridge! - 450) state.nextBridge = dist + 450;
  const label = SLIP_NAMES[(Math.floor(dist / 1000) + state.seed) % SLIP_NAMES.length];
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
  // a gap in the left wall (walled preset) where it leaves
  if (walled)
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
  off: number) => HwPose, mark: Stamp) {
  const state = level._hw,
    halfWidth = state.geo.hw,
    rand = state.xrnd,
    walled = !!level._cfg.walls;
  state.nextBridge = dist + BRIDGE_EVERY[0] + rand() * (BRIDGE_EVERY[1] - BRIDGE_EVERY[0]);
  // no slip under a bridge's approach
  if (dist > state.nextSlip! - 400) state.nextSlip = dist + 400;
  const roll = rand(),
    kind = roll < 0.38 ? "road" : roll < 0.62 ? "rail" : roll < 0.82 ? "foot" : "river";
  // walled: the wall stands wallGap off the edge - the span and the parapets clear it
  const wallOff = walled ? level._cfg.wallGap! : 0,
    centre = pointAt(i, 0),
    skew = (rand() - 0.5) * 0.5,
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
  }) as Bridge;
  // CHEEKY EXTRAS, rare (each ~1 in 6 of its bridge type)
  const extra = rand() < 1 / 6;
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
  // what MOVES across it (render.ts drawBridge, wall clock, no physics): road traffic both ways,
  // walkers, a train now and then
  bridge.phase = rand() * 1000;
  if (kind === 'rail') bridge.trainEvery = 14 + rand() * 16;
  level.props.push(bridge);
  if (kind === 'river') {
    // the motorway's own parapets over it (lab walls); on the walled preset its wall is already
    // there
    if (!walled) addRiverParapets(level, i, dist, pointAt);
    river(level, bridge, dist);
  } else approaches(level, bridge, dist);
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
  return (
    dist >= state.nextSlip! &&
    !state.side &&
    i > 20 &&
    i < road.length - 50 &&
    straightAt(road, i, 15, 38)
  );
}
/**
 * (?hwstations=1) Whether a SERVICES is due here: a road with a hard shoulder or walls (not Deaf
 * Valley), its distance reached, 60 m of gentle road before and 150 m after, no side road running.
 * @param level the highway level
 * @param i road point index
 * @param dist road distance at i
 * @returns true when it should be built
 */
function servicesDue(level: HwLevel, i: number, dist: number) {
  const state = level._hw, road = state.pts;
  if (!FIX.hwstations || level._cfg.theme === 'canyon' || (laybysOn(level) && !level._cfg.walls))
    return false;
  state.nextServices ??= SERVICES_FIRST_M;
  return dist >= state.nextServices && !state.side && i > 20 && i < road.length - 50
    && gentleAt(road, i, 15, 38);
}

/**
 * (?hwstations=1) A SERVICES: the slip's signs with its name, then the side road (highway/cuts.ts
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
 * Whether a bridge is due here: not while the side road runs beside the motorway.
 * @param state the highway state
 * @param road the road points
 * @param i road point index
 * @param dist road distance at i
 * @returns true when the bridge should be built
 */
function bridgeDue(state: HwState, road: HwPoint[], i: number, dist: number) {
  return (
    dist >= state.nextBridge! && !state.side && i < road.length - 20 && straightAt(road, i, 12)
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
  // (?hwstations=1) a SERVICES: the side road, signed with its name, past its yard
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
