import { setFloor, setRect } from "./bounds.ts";
import { LEVEL, setActiveLevel } from "./state.ts";
import { SURFACES, SURFACE_TRAP } from "./surfaces.ts";
import { alongTrack, prepBarriers } from "./barriers.ts";
import { autoKerbs } from "./subtrack.ts";
import { laneAt } from "./zones.ts";
import { resetNatLevel } from "./terrain.ts";
import { PATCH_CELL, patchKey, PATCH_GRID, resetPATCH_GRID, HEAT_OFFROAD } from "./wear.js";
import { onTrack, querySubtrack } from "./tyrewall.ts";
import { buildBlend, seededRng, buildInclusions } from "./blend.js";
import { LEVELS } from "./levels/index.js";
function prepareLevel() {
  prepBarriers(LEVEL);
  if (LEVEL.randomise) { LEVEL.randomise(); LEVEL._blend = null; }
  // ENDLESS levels get NO blend (MEASURED BUG, 2026-10-06, tools/_dirtroad.mjs: the highway's blend was built ONCE, against whatever road
  // window existed at the first setLevel, then cached through every restart / road type / reseed - 8209 long grass / dirt squares, many
  // on the CURRENT carriageway, which then wore to dirt: "dirt in the road on highway levels". Its zone-edge pass also ignores a zone's
  // rotation, and the fields are all rotated.) The highway draws its own verges; inclusions are skipped there for the same reason.
  if (LEVEL.endless) LEVEL._blend = [];
  if (!LEVEL._blend) LEVEL._blend = buildBlend(LEVEL, LEVEL.randomise ? Math.random : seededRng(LEVEL.id));
  // inclusions: built once per level (per layout on a re-randomising level), patches + covers
  if (LEVEL._coversBase === undefined) LEVEL._coversBase = LEVEL.covers || [];
  if (LEVEL.randomise || !LEVEL._incl) { LEVEL.covers = LEVEL._coversBase; LEVEL._incl = buildInclusions(LEVEL, LEVEL.randomise ? Math.random : seededRng(LEVEL.id + ':incl')); }
  LEVEL.covers = [...LEVEL._coversBase, ...LEVEL._incl.covers];
  // KEEP LANES CLEAN (2026-10-04, user: Thruston "pits look messy"): blend + inclusion squares picked on the grass next to a lane
  // overlapped onto it and chewed its edge ragged. Drop any generated patch that reaches a lane (authored LEVEL.patches stay).
  const offLane = (c) => { const r = Math.max(c.w, c.h) / 2 + 1; for (const d of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) if (laneAt(c.x + d[0], c.y + d[1])) return false; return true; };
  const gen = LEVEL.lanes ? [...LEVEL._blend, ...LEVEL._incl.patches].filter(offLane) : [...LEVEL._blend, ...LEVEL._incl.patches];
  LEVEL.allPatches = [...(LEVEL.patches || []), ...gen];
  resetPATCH_GRID();
  for (const c of LEVEL.allPatches) {
    const r = Math.max(c.w, c.h) / 2;
    for (let cx = Math.floor((c.x - r) / PATCH_CELL); cx <= Math.floor((c.x + r) / PATCH_CELL); cx++)
      for (let cy = Math.floor((c.y - r) / PATCH_CELL); cy <= Math.floor((c.y + r) / PATCH_CELL); cy++) {
        const k = patchKey(cx, cy), cell = PATCH_GRID.get(k);
        if (cell) cell.push(c); else PATCH_GRID.set(k, [c]);
      }
  }
}

// RALLY TAPE (user, 2026-10-04: "rally tape should be contactable and easy to snap — give it POSTS and tape SECTIONS — a chance to STICK to
// cars; used more liberally and CLOSE to the track edge on rally / rallycross stages"): a tape is a run of light POSTS (loose objects,
// kind 'tapepost', every TAPE_STEP m; cones.js strings the sections between them and snaps them). On every stage / joker level: the old
// red spectator lines become tape, and BOTH sides of every corner get a run close to the edge (inside at half width + 2.5 m, outside
// beyond the dressing at half width + 5.5 m). Pit / painted lines stay lines.
const TAPE_STEP = 4, LANE_CLEAR = 2.5;   // m: tape posts keep this far beyond a road lane's edge
let tapeId = 0;
function tapePass(lv) {
  if (!lv.subtrack || !(lv.stage || lv.joker)) return;
  const runs = [], hw = lv.subtrack.width / 2;
  for (const b of lv.barriers || []) if (b.kind === 'line' && b.col === '#e23b2e') runs.push(b.pts);
  lv.barriers = (lv.barriers || []).filter((b) => !(b.kind === 'line' && b.col === '#e23b2e'));
  for (const c of autoKerbs(lv.subtrack, { maxR: 70, exitR: 0, minTurn: 18, mergeGap: 10 })) {
    if (lv.stage && c.startDist > lv.stage.finish) continue;
    const a = onTrack(lv.subtrack, c.startDist, 0, {}).rot, bb = onTrack(lv.subtrack, c.endDist, 0, {}).rot;
    let t = bb - a; t = Math.atan2(Math.sin(t), Math.cos(t)); const out = t > 0 ? -1 : 1;
    runs.push(alongTrack(lv.subtrack, c.startDist - 15, c.endDist + 15, out * (hw + 5.5), TAPE_STEP), alongTrack(lv.subtrack, c.startDist - 10, c.endDist + 10, -out * (hw + 2.5), TAPE_STEP));
  }
  // ...but NEVER across a ROAD LANE (user, 2026-10-04: "tape covering joker track section entries on Knobhill"): a post within half a lane
  // width + LANE_CLEAR of the joker / RX start / pit / service lane is left out, and the run's idx gap leaves that section open (cones.js
  // strings consecutive idx only). Gravel traps (lanes with an 'out' side) are run-off, not road: tape may cross them.
  const roads = (lv.lanes || []).filter((n) => n.out == null);
  const onRoad = (x, y) => roads.some((n) => { for (let k = 0; k + 1 < n.pts.length; k++) {
    const [ax, ay] = n.pts[k], [bx, by] = n.pts[k + 1], vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / L2)); if (Math.hypot(x - ax - t * vx, y - ay - t * vy) < n.width / 2 + LANE_CLEAR) return true; } return false; });
  const posts = [];
  for (const pts of runs) {
    const id = tapeId++;
    pts.forEach(([x, y], i) => { if (querySubtrack(lv.subtrack, x, y).dist > hw + 1.5 && !onRoad(x, y)) posts.push({ x, y, kind: 'tapepost', tape: id, idx: i }); });
  }
  lv.cones = [...(lv.cones || []), ...posts];
}
// CHEVRONS + FLAGS are KNOCKABLE (user, 2026-10-04: "heavy but impactable"): every level's chevron boards and flag poles move from the
// static props (drawn into the scenery, solid until today) into its loose objects (cones.js: mass, topple, slide, lie flat)
function knockPass(lv) {
  const mv = (lv.props || []).filter((p) => p.kind === 'chevron' || p.kind === 'flag'); if (!mv.length) return;
  lv.props = lv.props.filter((p) => !(p.kind === 'chevron' || p.kind === 'flag'));
  lv.cones = [...(lv.cones || []), ...mv.map((p) => ({ x: p.x, y: p.y, kind: p.kind, rot: p.rot || 0, col: p.col }))];
}
// the post-passes every level gets (tape, knockable signs) — exported for generated levels (stagegen.js)
export function finishLevel(lv) { tapePass(lv); knockPass(lv); return lv; }
// the floor rectangle of the current level (S-B): LEVEL.bounds, else the square +-FLOOR
function applyBounds() {
  setRect(LEVEL.bounds);
}
export function setLevel(id) {
  const next = LEVELS.find((l) => l.id === id);
  if (!next) return LEVEL;
  setActiveLevel(next);
  setFloor(LEVEL.floor || 260);   // WORLD SIZE per level (2026-10-05)
  applyBounds();
  prepareLevel();
  resetNatLevel();              // natural-ground amplitudes are per layout (the Grass Track re-randomises every load)
  return LEVEL;
}

setActiveLevel(LEVELS[0]);
for (const lv of LEVELS) finishLevel(lv);

// TYRE HEAT SHARE per surface (vehicle.js TYRE_HEAT): hard ground 1, loose ground HEAT_OFFROAD. Here, at the end,
// because the run-off trap surfaces are built after SURFACES. Puddles copy their base's value (surfaceOf).
for (const s of [...Object.values(SURFACES), ...SURFACE_TRAP]) if (s.heatK === undefined) s.heatK = s.hard ? 1 : HEAT_OFFROAD;

// The first level is active from module load without a setLevel() call, so prepare it here — at the END of the
// module, after every const it reads exists (calling it earlier threw "Cannot access tri before initialization").
applyBounds();
prepareLevel();
