import { setFloor, setRect } from "./bounds.ts";
import { LEVEL, setActiveLevel } from "./state.ts";
import { SURFACES, SURFACE_TRAP } from "./surfaces.ts";
import { alongTrack, prepBarriers } from "./barriers.ts";
import { autoKerbs } from "./subtrack.ts";
import { laneAt } from "./zones.ts";
import { resetNatLevel } from "./terrain.ts";
import {
  PATCH_CELL, patchKey, PATCH_GRID, PATCH_ORDER, resetPATCH_GRID, HEAT_OFFROAD,
} from "./wear.ts";
import { onTrack, querySubtrack } from "./tyrewall.ts";
import { buildBlend, seededRng, buildInclusions } from "./blend.ts";
import { LEVELS } from "./levels/index.ts";
import { staticCovers } from "./puddles.ts";
import type { Barrier, Cone, Lane, Level, Patch, Point, Prop, Subtrack } from "./types.ts";
/**
 * Build (or reuse) the level's blend patches and surface inclusions.
 * Sets LEVEL._blend, LEVEL._coversBase, LEVEL._incl and LEVEL.covers.
 */
function buildLevelPatchSets(): void {
  // ENDLESS levels get NO blend (MEASURED BUG, tools/_dirtroad.mjs: the highway's
  // blend was built ONCE, against whatever road window existed at the first setLevel, then
  // cached through every restart / road type / reseed - 8209 long grass / dirt squares, many on
  // the CURRENT carriageway, which then wore to dirt: "dirt in the road on highway levels". Its
  // zone-edge pass also ignores a zone's rotation, and the fields are all rotated.) The highway
  // draws its own verges; inclusions are skipped there for the same reason.
  if (LEVEL.endless) LEVEL._blend = [];
  if (!LEVEL._blend)
    LEVEL._blend = buildBlend(LEVEL, LEVEL.randomise ? Math.random : seededRng(LEVEL.id));
  // inclusions: built once per level (per layout on a re-randomising level), patches + covers
  if (LEVEL._coversBase === undefined) LEVEL._coversBase = LEVEL.covers || [];
  if (LEVEL.randomise || !LEVEL._incl) {
    LEVEL.covers = LEVEL._coversBase;
    LEVEL._incl = buildInclusions(
      LEVEL,
      LEVEL.randomise ? Math.random : seededRng(LEVEL.id + ':incl'),
    );
  }
  // with the weather (?weather=1) the level's own puddles go: the cover field lays its water
  LEVEL._staticCovers = staticCovers(LEVEL, [...LEVEL._coversBase, ...LEVEL._incl.covers]);
  LEVEL.covers = LEVEL._staticCovers;
}
/**
 * Does a generated patch stay clear of every lane (centre and eight points round its reach)?
 * @param patch the patch
 * @returns true when no lane touches it
 */
function isPatchOffLane(patch: Patch): boolean {
  const reach = Math.max(patch.w, patch.h) / 2 + 1;
  for (const offset of [
    [0, 0], [reach, 0], [-reach, 0], [0, reach], [0, -reach],
    [reach, reach], [-reach, -reach], [reach, -reach], [-reach, reach],
  ]) if (laneAt(patch.x + offset[0], patch.y + offset[1])) return false;
  return true;
}
/**
 * Index every patch of LEVEL.allPatches in the patch grid (PATCH_GRID is reset first).
 */
function indexPatchGrid(): void {
  resetPATCH_GRID();
  LEVEL.allPatches!.forEach((patch, order) => PATCH_ORDER.set(patch, order));
  for (const patch of LEVEL.allPatches!) {
    const radius = Math.max(patch.w, patch.h) / 2;
    for (let cellX = Math.floor((patch.x - radius) / PATCH_CELL);
      cellX <= Math.floor((patch.x + radius) / PATCH_CELL); cellX++)
      for (let cellY = Math.floor((patch.y - radius) / PATCH_CELL);
        cellY <= Math.floor((patch.y + radius) / PATCH_CELL); cellY++) {
        const key = patchKey(cellX, cellY), cell = PATCH_GRID.get(key);
        if (cell) cell.push(patch);
        else PATCH_GRID.set(key, [patch]);
      }
  }
}
/**
 * Builds the current level for driving (or, light, for a menu thumbnail).
 * @param light a THUMBNAIL build: a level whose patches are not built yet skips them. MEASURED
 *   (menu TEST MODE tap, CPU x4): painting the thumbnails spent 2.0 of 3.1 s building every level's
 *   blend squares and inclusions - 0.4-3 m patches, under a pixel on a 320 px thumbnail. The next
 *   full setLevel builds them.
 */
function prepareLevel(light = false): void {
  prepBarriers(LEVEL);
  if (LEVEL.randomise) { LEVEL.randomise(); LEVEL._blend = null; }
  if (light && !LEVEL._blend) {
    LEVEL.allPatches = [...(LEVEL.patches || [])];
    indexPatchGrid();
    return;
  }
  buildLevelPatchSets();
  // KEEP LANES CLEAN (user: Thruston "pits look messy"): blend + inclusion squares
  // picked on the grass next to a lane overlapped onto it and chewed its edge ragged. Drop any
  // generated patch that reaches a lane (authored LEVEL.patches stay).
  const gen = LEVEL.lanes
    ? [...LEVEL._blend!, ...LEVEL._incl!.patches].filter(isPatchOffLane)
    : [...LEVEL._blend!, ...LEVEL._incl!.patches];
  LEVEL.allPatches = [...(LEVEL.patches || []), ...gen];
  indexPatchGrid();
}

// RALLY TAPE (requirement: rally tape should be contactable and easy to snap — give it POSTS and
// tape SECTIONS — a chance to STICK to cars; used more liberally and CLOSE to the track edge on
// rally / rallycross stages): a tape is a run of light POSTS (loose objects, kind
// 'tapepost', every TAPE_STEP m; cones.js strings the sections between them and snaps them). On
// every stage / joker level: the old red spectator lines become tape, and BOTH sides of every
// corner get a run close to the edge (inside at half width + 2.5 m, outside beyond the dressing
// at half width + 5.5 m). Pit / painted lines stay lines.
// m: tape posts keep this far beyond a road lane's edge
const TAPE_STEP = 4, LANE_CLEAR = 2.5;
let tapeId = 0;
/**
 * Is a point within a road lane (half width + LANE_CLEAR)?
 * @param roads the road lanes (not gravel traps)
 * @param x world x
 * @param y world y
 * @returns true when on a road lane
 */
function isOnRoadLane(roads: Lane[], x: number, y: number): boolean {
  return roads.some((lane) => {
    for (let i = 0; i + 1 < lane.pts.length; i++) {
      const [segX0, segY0] = lane.pts[i], [segX1, segY1] = lane.pts[i + 1],
        vx = segX1 - segX0, vy = segY1 - segY0, lenSq = vx * vx + vy * vy || 1;
      const along = Math.max(0, Math.min(1, ((x - segX0) * vx + (y - segY0) * vy) / lenSq));
      if (Math.hypot(x - segX0 - along * vx, y - segY0 - along * vy)
        < lane.width / 2 + LANE_CLEAR) return true;
    }
    return false;
  });
}
/**
 * Collect the tape runs: the old red spectator lines (removed from the barriers) and a run on
 * both sides of every corner.
 * @param level the level (barriers are filtered)
 * @param subtrack the level's subtrack
 * @returns the polylines of the runs
 */
function collectTapeRuns(level: Level, subtrack: Subtrack): Point[][] {
  const runs: Point[][] = [], halfWidth = subtrack.width / 2;
  for (const barrier of level.barriers || [])
    if (barrier.kind === 'line' && barrier.col === '#e23b2e') runs.push(barrier.pts);
  level.barriers = (level.barriers || []).filter(
    (barrier: Barrier) => !(barrier.kind === 'line' && barrier.col === '#e23b2e'));
  for (const corner of autoKerbs(subtrack,
    { maxR: 70, exitR: 0, minTurn: 18, mergeGap: 10 })) {
    if (level.stage && corner.startDist > level.stage.finish) continue;
    const rotIn = onTrack(subtrack, corner.startDist, 0, {}).rot,
      rotOut = onTrack(subtrack, corner.endDist, 0, {}).rot;
    let turn = rotOut - rotIn;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    const out = turn > 0 ? -1 : 1;
    runs.push(
      alongTrack(subtrack, corner.startDist - 15, corner.endDist + 15,
        out * (halfWidth + 5.5), TAPE_STEP),
      alongTrack(subtrack, corner.startDist - 10, corner.endDist + 10,
        -out * (halfWidth + 2.5), TAPE_STEP),
    );
  }
  return runs;
}
function tapePass(level: Level): void {
  if (!level.subtrack || !(level.stage || level.joker)) return;
  const halfWidth = level.subtrack.width / 2;
  const runs = collectTapeRuns(level, level.subtrack);
  // ...but NEVER across a ROAD LANE (requirement: tape covering joker track section entries on
  // Knobhill): a post within half a lane width + LANE_CLEAR of the joker / RX start / pit / service
  // lane is left out, and the run's idx gap leaves that section open (cones.js
  // strings consecutive idx only). Gravel traps (lanes with an 'out' side) are run-off, not
  // road: tape may cross them.
  const roads = (level.lanes || []).filter((lane: Lane) => lane.out == null);
  const posts: Cone[] = [];
  for (const pts of runs) {
    const runId = tapeId++;
    pts.forEach(([x, y]: Point, i: number) => {
      if (querySubtrack(level.subtrack!, x, y).dist > halfWidth + 1.5 && !isOnRoadLane(roads, x, y))
        posts.push({ x, y, kind: 'tapepost', tape: runId, idx: i });
    });
  }
  level.cones = [...(level.cones || []), ...posts];
}
// CHEVRONS + FLAGS are KNOCKABLE (requirement: heavy but impactable): every level's chevron boards
// and flag poles move from the static props (drawn into the scenery, solid until
// today) into its loose objects (cones.js: mass, topple, slide, lie flat)
function knockPass(level: Level): void {
  const movable = (level.props || []).filter(
    (prop: Prop) => prop.kind === 'chevron' || prop.kind === 'flag');
  if (!movable.length) return;
  level.props = level.props!.filter(
    (prop: Prop) => !(prop.kind === 'chevron' || prop.kind === 'flag'));
  level.cones = [
    ...(level.cones || []),
    ...movable.map((prop: Prop) => (
      { x: prop.x, y: prop.y, kind: prop.kind, rot: prop.rot || 0, col: prop.col })),
  ];
}
// the post-passes every level gets (tape, knockable signs) — exported for generated levels
// (stagegen.js)
export function finishLevel(level: Level): Level {
  tapePass(level);
  knockPass(level);
  return level;
}
// the floor rectangle of the current level (S-B): LEVEL.bounds, else the square +-FLOOR
function applyBounds(): void {
  setRect(LEVEL.bounds);
}
/**
 * Builds a level that waits for its first use, in place (the rally stages: stagegen.js
 * addStageLevels): its _build makes the whole level. Anything else is returned as it is.
 * @param level the level
 * @returns the level, built
 */
export function buildLevel(level: Level): Level {
  const build = level._build;
  if (!build) return level;
  delete level._build;
  Object.assign(level, build());
  return finishLevel(level);
}
/**
 * Makes a level the current one.
 * @param levelId the level
 * @param opts light: a menu-thumbnail build (prepareLevel)
 * @returns the current level
 */
export function setLevel(levelId: string, opts: { light?: boolean } = {}): Level {
  const next = LEVELS.find((level) => level.id === levelId);
  if (!next) return LEVEL;
  buildLevel(next);
  setActiveLevel(next);
  // WORLD SIZE per level
  setFloor(LEVEL.floor || 260);
  applyBounds();
  prepareLevel(opts.light);
  // natural-ground amplitudes are per layout (the Grass Track re-randomises every load)
  resetNatLevel();
  return LEVEL;
}

let worldReady = false;
// builds the world: called once (main.js, lab.js), not as a side effect of importing
export function initWorld(): void {
  if (worldReady) return;
  worldReady = true;
  setActiveLevel(LEVELS[0]);
  for (const level of LEVELS) finishLevel(level);

  // TYRE HEAT SHARE per surface (vehicle.js TYRE_HEAT): hard ground 1, loose ground HEAT_OFFROAD.
  // Here, at the end, because the run-off trap surfaces are built after SURFACES. Puddles copy
  // their base's value (surfaceOf).
  for (const surface of [...Object.values(SURFACES), ...SURFACE_TRAP])
    if (surface.heatK === undefined) surface.heatK = surface.hard ? 1 : HEAT_OFFROAD;

  // The first level is active from module load without a setLevel call, so prepare it here — at
  // the END of the module, after every const it reads exists (calling it earlier threw "Cannot
  // access tri before initialization").
  applyBounds();
  prepareLevel();
}
