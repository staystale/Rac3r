// highway fields: SCENERY v2, the farm fields, hedges and villages laid along the road.
// Split out of highway.js.
import { SURFACES } from "../world/surfaces.ts";
import { STEP } from "./presets.js";
import { keepOut } from "./cuts.js";
// ---- SCENERY v2 (user: "i thought we were going to vary sceneary along side the road
// more like farms or long grass hedges and small towns"; "yeah scenery too please"). In the FARM
// stretches: a PATCHWORK of FIELDS each side - rotated zones (lab.js zoneAt / render.ts drawZones,
// so what you see is what you drive on): WHEAT and RAPESEED (drive as long grass, drawn as crops:
// zone.art), MEADOW (long grass), PASTURE (grass, sheep / cows), PLOUGHED (dirt, furrows), now and
// then a FARMYARD (gravel, barns, bales). Each is ringed by a LONG GRASS border (HEDGE_W m, a zone
// you drive through - user: "hedges around fields ... should be long grass"; the first
// cut was a solid 'hedge' barrier, which beached spun racers: pacesuite 2/9 -> 3/9 BAD), a tree or
// two in it. Now and then a VILLAGE: a lane following the road ~40 m out, houses both sides, a
// church. Each field / village is a keep rect in st.keep with a `field` id: anything placed LATER
// that needs the ground (a bridge approach, a river, a slip) drops it whole (dropField); later
// scenery avoids it (blocked). The left side starts past the secret side road's band. Random
// choices: st.frnd (own stream). Cost per field: one zone + 2 polylines.
const FIELD_T = [
  ["wheat", 0.24],
  ["plough", 0.18],
  ["rapeseed", 0.12],
  ["meadow", 0.2],
  ["pasture", 0.18],
  ["yard", 0.08],
];
// [physics surface, look]. Looks REUSE the grass / long grass / mud textures, recoloured (user:
// "jsut reuse mud and grass or long grass textures for field, and maybe colour them"; render.ts
// SURFACE_ART wheat / rapeseed / pastureG / plough). Ploughed = MUD: look = grip.
const FIELD_SURF = {
  wheat: ["grassLong", "wheat"],
  rapeseed: ["grassLong", "rapeseed"],
  meadow: ["grassLong", null],
  plough: ["mud", "plough"],
  pasture: ["grass", "pastureG"],
  yard: ["gravel", null],
};
const HEDGE_W = 2.5;
const ROOFS = ['#8a3a2e', '#9a4a36', '#6e6a5e', '#5b626b', '#7a5a48', '#8a3a2e'];
// SAT overlap of two keep rects { x, y, ax, ay (unit axis), hu, hv }
function overlap(rectA, rectB) {
  const dx = rectB.x - rectA.x, dy = rectB.y - rectA.y;
  for (const [axisU, axisV] of [
    [rectA.ax, rectA.ay],
    [-rectA.ay, rectA.ax],
    [rectB.ax, rectB.ay],
    [-rectB.ay, rectB.ax],
  ]) {
    const radA =
      rectA.hu * Math.abs(rectA.ax * axisU + rectA.ay * axisV) +
      rectA.hv * Math.abs(-rectA.ay * axisU + rectA.ax * axisV);
    const radB =
      rectB.hu * Math.abs(rectB.ax * axisU + rectB.ay * axisV) +
      rectB.hv * Math.abs(-rectB.ay * axisU + rectB.ax * axisV);
    if (Math.abs(dx * axisU + dy * axisV) > radA + radB) return false;
  }
  return true;
}
// a later feature k (a keep rect) that needs the ground: drop every field / village it overlaps,
// whole
export function clearFields(level, rect) {
  const ids = new Set(
    level._hw.keep
      .filter((other) => other.field != null && overlap(other, rect))
      .map((other) => other.field)
  );
  if (!ids.size) return;
  const survives = (item) => item.field == null || !ids.has(item.field);
  // (+ its animals, S-C: loose objects not yet handed to the game; the live ones go via goneFields
  // -> main.js game.cones.cull)
  for (const list of [
    level.zones,
    level.barriers,
    level.props,
    level.lanes,
    level._hw.keep,
    level.cones,
    level._hw.looseNew || [],
  ]) {
    const kept = list.filter(survives);
    if (kept.length !== list.length) {
      list.length = 0;
      list.push(...kept);
    }
  }
  level.solidsDirty = true;
  const gone = (level._hw.goneFields ||= new Set());
  for (const fieldId of ids) gone.add(fieldId);
}
const pickW = (rand, table) => {
  let roll = rand() * table.reduce((sum, entry) => sum + entry[1], 0);
  for (const [kind, weight] of table) if ((roll -= weight) <= 0) return kind;
  return table[0][0];
};
// is rect k clear of the road (r m past its edge, the side road too) and of every keep rect?
function roomFor(state, rect, clear, margin) {
  if (state.keep.some((other) => overlap(other, rect))) return false;
  const nx = -rect.ay, ny = rect.ax;
  for (const [fracU, fracV] of [
    [0, 0],
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
    [0, -1],
    [0, 1],
    [-0.5, -1],
    [0.5, -1],
  ])
    if (
      !clear(
        rect.x + rect.ax * fracU * rect.hu + nx * fracV * rect.hv,
        rect.y + rect.ay * fracU * rect.hu + ny * fracV * rect.hv,
        margin
      )
    )
      return false;
  return true;
}
function village(level, i, pointAt, clear) {
  const state = level._hw,
    road = state.pts,
    halfWidth = state.geo.hw,
    rand = state.frnd,
    dist = road[i].s;
  const side = rand() < 0.5 ? -1 : 1,
    span = 110 + rand() * 70,
    count = Math.ceil(span / STEP),
    mid = side < 0 ? halfWidth + 46 : halfWidth + 38;
  if (i + count >= road.length) return;
  state.villageNext = dist + 3000 + rand() * 4000;
  const centreIdx = i + (count >> 1),
    centre = pointAt(centreIdx, side * mid),
    fieldId = ++state.fieldId;
  const rect = {
    x: centre.x,
    y: centre.y,
    ax: Math.cos(centre.rot),
    ay: Math.sin(centre.rot),
    hu: span / 2 + 6,
    hv: 15,
    field: fieldId,
  };
  if (!roomFor(state, rect, clear, 6)) return;
  keepOut(level, rect, dist);
  const pts = [];
  for (let j = i; j <= i + count; j += 2) {
    const pos = pointAt(j, side * mid);
    pts.push([pos.x, pos.y]);
  }
  level.lanes.push({ pts, width: 5, surface: SURFACES.tarmac, field: fieldId, _s: dist });
  const churchIdx = centreIdx + (rand() < 0.5 ? -6 : 6);
  for (let j = i + 2; j < i + count - 1; j += 3) for (const houseSide of [-1, 1]) {
    // the churchyard
    if (houseSide === side && Math.abs(j - churchIdx) < 5) continue;
    if (rand() > 0.75) continue;
    const pos = pointAt(j, side * mid + houseSide * 7.5);
    level.props.push({
      kind: "block",
      x: pos.x,
      y: pos.y,
      w: 6.5 + rand() * 2.5,
      h: 5.5 + rand() * 1.5,
      rot: pos.rot,
      roof: ROOFS[(rand() * ROOFS.length) | 0],
      house: true,
      field: fieldId,
      _s: dist,
    });
  }
  {
    const pos = pointAt(churchIdx, side * (mid + 9));
    level.props.push({
      kind: "block",
      x: pos.x,
      y: pos.y,
      w: 15,
      h: 6.5,
      rot: pos.rot,
      roof: "#6e6a5e",
      church: true,
      field: fieldId,
      _s: dist,
    });
  }
}
/**
 * A point on a field plot, `along` its length and `across` its depth (the sign follows the
 * side the plot is on, so positive is away from the road).
 * @param {object} plot the field plot (centre, axis, normal, side)
 * @param {number} along metres along the field's long axis
 * @param {number} across metres across it, away from the road
 * @returns {number[]} [x, y]
 */
function fieldCorner(plot, along, across) {
  const { centre, axisX, axisY, nx, ny, side } = plot;
  return [
    centre.x + axisX * along + nx * across * side,
    centre.y + axisY * along + ny * across * side,
  ];
}
/**
 * A random point well inside a field plot (draws two random numbers: along, then across).
 * @param {object} plot the field plot
 * @param { => number} rand the field random stream
 * @param {number} margin metres kept clear of the edges
 * @returns {number[]} [x, y]
 */
function fieldInside(plot, rand, margin) {
  const { fieldLen, depth } = plot;
  return fieldCorner(
    plot,
    (rand() - 0.5) * (fieldLen - 2 * margin),
    (rand() - 0.5) * (depth - 2 * margin)
  );
}
/**
 * Add a field's surface zone and, after it, the bigger long-grass hedge zone round it.
 * @param {object} level the highway level
 * @param {object} plot the field plot
 * @returns {void}
 */
function addFieldZones(level, plot) {
  const { centre, fieldLen, depth, heading, fieldId, type, dist } = plot;
  const [phys, art] = FIELD_SURF[type];
  // the field FIRST (zones: the first listed wins, and is painted last), then its long-grass
  // border: one zone HEDGE_W bigger all round
  level.zones.push({
    x: centre.x,
    y: centre.y,
    w: fieldLen,
    h: depth,
    rot: heading,
    surface: SURFACES[phys],
    art,
    field: fieldId,
    _s: dist,
  });
  level.zones.push({
    x: centre.x,
    y: centre.y,
    w: fieldLen + 2 * HEDGE_W,
    h: depth + 2 * HEDGE_W,
    rot: heading,
    surface: SURFACES.grassLong,
    art: "hedgerow",
    hedge: true,
    field: fieldId,
    _s: dist,
  });
}
/**
 * Add the hedgerow trees on a field's far edge (1 to 3, random).
 * @param {object} level the highway level
 * @param {object} plot the field plot
 * @param { => number} rand the field random stream
 * @returns {void}
 */
function addFieldTrees(level, plot, rand) {
  const { fieldLen, depth, fieldId, dist } = plot;
  const far = depth / 2 + HEDGE_W / 2;
  for (let treeIdx = 0, treeCount = 1 + ((rand() * 2.4) | 0); treeIdx < treeCount; treeIdx++) {
    const [x, y] = fieldCorner(plot, (rand() - 0.5) * (fieldLen - 10), far);
    level.props.push({
      kind: "tree",
      x,
      y,
      s: 4.5 + rand() * 2.5,
      seed: (fieldId * 7 + treeIdx) | 0,
      field: fieldId,
      _s: dist,
    });
  }
}
/**
 * Wheat field: now and then a scatter of bales.
 * @param {object} level the highway level
 * @param {object} plot the field plot
 * @param { => number} rand the field random stream
 * @returns {void}
 */
function addFieldBales(level, plot, rand) {
  const { fieldId, type, dist } = plot;
  if (type === "wheat" && rand() < 0.45)
    for (let num = 3 + ((rand() * 4) | 0); num > 0; num--) {
      const [x, y] = fieldInside(plot, rand, 5);
      level.props.push({ kind: "bale", x, y, field: fieldId, _s: dist });
    }
}
/**
 * Pasture: a flock of sheep or a herd of cows (loose objects, not props).
 * @param {object} plot the field plot
 * @param { => number} rand the field random stream
 * @param {object[]} loose where the loose objects go
 * @returns {void}
 */
function addFieldStock(plot, rand, loose) {
  const { fieldId, type, dist } = plot;
  if (type === "pasture") {
    const species = rand() < 0.6 ? "sheep" : "cow";
    for (let num = (species === "sheep" ? 5 : 3) + ((rand() * 5) | 0); num > 0; num--) {
      const [x, y] = fieldInside(plot, rand, 4);
      loose.push({ kind: species, x, y, rot: rand() * 6.28, field: fieldId, _s: dist });
    }
  }
}
/**
 * Farm yard: two sheds and a few bales.
 * @param {object} level the highway level
 * @param {object} plot the field plot
 * @param { => number} rand the field random stream
 * @returns {void}
 */
function addFieldYard(level, plot, rand) {
  const { fieldLen, depth, heading, fieldId, type, dist } = plot;
  if (type === 'yard') {
    for (let num = 0; num < 2; num++) {
      const [x, y] = fieldCorner(plot, (num ? 1 : -1) * fieldLen * 0.22, depth * 0.12);
      level.props.push({
        kind: "block",
        x,
        y,
        w: Math.min(16, fieldLen * 0.3),
        h: Math.min(10, depth * 0.3),
        rot: heading,
        roof: ["#8a3a2e", "#2c2f33", "#6e6a5e"][(rand() * 3) | 0],
        field: fieldId,
        _s: dist,
      });
    }
    for (let num = 2 + ((rand() * 4) | 0); num > 0; num--) {
      const [x, y] = fieldCorner(plot, (rand() - 0.5) * fieldLen * 0.5, -depth * 0.28);
      level.props.push({ kind: "bale", x, y, field: fieldId, _s: dist });
    }
  }
}
/**
 * Lay one strip of fields beside the road: one or two rows, each a field with its zones, trees
 * and contents. A row that has no room (roomFor) is skipped.
 * @param {object} level the highway level
 * @param {object} strip {side, i, dist, fieldLen, count}: side, road index / distance, size
 * @param {Function} pointAt road point at (index, offset)
 * @param {object} clear the areas already built on
 * @param {object[]} loose where loose objects (livestock) go
 * @returns {void}
 */
function layFieldRows(level, strip, pointAt, clear, loose) {
  const state = level._hw, halfWidth = state.geo.hw, rand = state.frnd;
  const { side, i, dist, fieldLen, count } = strip;
  const centreIdx = i + (count >> 1),
    heading = pointAt(centreIdx, 0).rot,
    axisX = Math.cos(heading),
    axisY = Math.sin(heading),
    nx = -axisY,
    ny = axisX;
  let offset = (side < 0 ? halfWidth + 25 : halfWidth + 11) + rand() * 6;
  for (let row = 0, rows = rand() < 0.55 ? 2 : 1; row < rows; row++) {
    const depth = 38 + rand() * 45,
      centre = pointAt(centreIdx, side * (offset + depth / 2)),
      fieldId = ++state.fieldId,
      type = pickW(rand, FIELD_T);
    offset += depth + 5 + rand() * 6;
    const rect = {
      x: centre.x,
      y: centre.y,
      ax: axisX,
      ay: axisY,
      hu: fieldLen / 2 + HEDGE_W,
      hv: depth / 2 + HEDGE_W,
      field: fieldId,
    };
    if (!roomFor(state, rect, clear, 4)) continue;
    keepOut(level, rect, dist);
    const plot = {
      side, dist, fieldLen, depth, centre, heading, axisX, axisY, nx, ny, fieldId, type,
    };
    addFieldZones(level, plot);
    addFieldTrees(level, plot, rand);
    addFieldBales(level, plot, rand);
    addFieldStock(plot, rand, loose);
    addFieldYard(level, plot, rand);
  }
}
/**
 * Scenery v2 fields beside the road on a farm biome: starts the village schedule, builds a
 * village when due, and lays a strip of fields on each side when the last one has ended.
 * @param {object} level the highway level
 * @param {number} i road point index
 * @param {Function} pointAt road point at (index, offset)
 * @param {object} clear the areas already built on
 * @param {string} biome the biome here
 * @param {object[]} loose where loose objects (livestock) go
 * @returns {void}
 */
export function fields(level, i, pointAt, clear, biome, loose) {
  const state = level._hw,
    road = state.pts,
    rand = state.frnd,
    dist = road[i].s;
  if (!state.fieldNext) {
    state.fieldNext = { "-1": 0, 1: 0 };
    state.villageNext = 1200 + rand() * 2000;
  }
  if (biome !== "farm" || level._cfg.walls) {
    state.fieldNext[-1] = Math.max(state.fieldNext[-1], dist);
    state.fieldNext[1] = Math.max(state.fieldNext[1], dist);
    return;
  }
  if (dist >= state.villageNext) village(level, i, pointAt, clear);
  for (const side of [-1, 1]) {
    if (dist < state.fieldNext[side]) continue;
    const fieldLen = 70 + rand() * 70, count = Math.ceil(fieldLen / STEP);
    if (i + count + 2 >= road.length) continue;
    state.fieldNext[side] = dist + fieldLen + 5 + rand() * 8;
    layFieldRows(level, { side, i, dist, fieldLen, count }, pointAt, clear, loose);
  }
}
