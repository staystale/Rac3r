// tools/osmvenue.mjs - turns an OpenStreetMap download of a real circuit into a venue data module
// (world/levels/venues/*.ts): every race road piece, the pit lane, service roads, gravel traps,
// rails (guard rails, concrete barriers), grandstands, buildings, paddocks and woods, in REAL metres
// in the game's frame (x right, y down), turned so the track sits the way the level always has.
// The level scales it (world/venue.ts). Map data (c) OpenStreetMap contributors, ODbL.
//
//   node tools/osmvenue.mjs <venue config .json>
//
// The config: { "osm": the Overpass JSON (out geom), "out": the .ts to write, "exportName",
//   "origin": [lat, lon], "turnDeg": degrees the map is turned (clockwise on screen),
//   "clip": [x0, y0, x1, y1] real m in the turned frame, "names": { "<way id>": "piece name" },
//   "layouts": { "<id>": { "through": [piece names], "avoid": [piece names] } },
//   "extra": [{ "source": "...", "tags": { OSM tags }, "pts": [[lat, lon], ...] }] - features the map
//   does not carry, traced from another source (the circuit's map, aerial photographs), read as
//   ways (a closed one repeats its first point) }
// A name in "names" also names a building, stand, car park or pit lane of that way id; "kinds":
// { "<way id>": "hangar" } sets a building's kind where the map says only building=yes; "dirt":
// [way ids] makes a motor raceway a dirt track (Daytona's flat track), not a race road piece; a race
// piece with a loose surface (OSM unpaved, gravel ...) is written with surface 'dirt'; "race": [way
// ids] makes a raceway the map gives no sport a race piece; "skip": [way ids] leaves a raceway out
// (a driving-experience track or a motocross course beside the venue) - or any other way (Yas
// Marina's U-shaped grandstand, traced again in "extra"); "rails": [way ids] reads
// those barrier lines as rails (a mapper who drew the circuit's barriers as walls or fences: Croft,
// Spa); "posts": [way ids] leaves out marshal posts mapped as buildings by name only (Spa's P1 ..
// P19: the venue places its own); "trim": { "<way id>": [first, last] } keeps only those nodes of a
// way; "traps": [way ids] reads those areas as gravel traps (Monza's are mapped natural=sand);
// "leaveOut": [kinds of feature] writes those lists empty (a simple first build: the Nordschleife's
// lap and barriers, no buildings or roads); "roadRace": [way ids] races those public road ways (a
// primary, a tertiary) as race pieces - a circuit over closed public roads (Le Mans' Hunaudieres
// and Mulsanne legs; the other venues name none, so their pieces are as before). A
// stand longer than STAND_SLICE_M is written as its slices (a curved one round a tri-oval).
// A layout is the shortest loop through its "through" pieces that avoids its "avoid" pieces; it is
// written as the ordered list of pieces it runs over, so a layout is changed by editing that list.
// "parks": true also writes the parks, gardens, lawns and woods as outlines (a paved town's grass:
// Moanaco), and "treeNodes": true the mapped single trees (natural=tree nodes) as one-point rows,
// nearest the race roads first (a town's street trees); the other venues write neither.
import fs from 'node:fs';
import path from 'node:path';

const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const base = path.dirname(process.argv[2]);
const osm = JSON.parse(fs.readFileSync(path.resolve(base, config.osm), 'utf8'));
const [LAT0, LON0] = config.origin;
const METRES_LAT = 111320, METRES_LON = 111320 * Math.cos(LAT0 * Math.PI / 180);
const TURN = config.turnDeg * Math.PI / 180, COS_T = Math.cos(TURN), SIN_T = Math.sin(TURN);
const [CLIP_X0, CLIP_Y0, CLIP_X1, CLIP_Y1] = config.clip;

/** lat / lon -> real metres in the turned game frame */
function toGame(node) {
  const east = (node.lon - LON0) * METRES_LON, south = -(node.lat - LAT0) * METRES_LAT;
  return [east * COS_T - south * SIN_T, east * SIN_T + south * COS_T];
}
const round1 = (value) => Math.round(value * 10) / 10;
const inClip = ([x, y]) => x >= CLIP_X0 && x <= CLIP_X1 && y >= CLIP_Y0 && y <= CLIP_Y1;

// real m: the longest a stand is written as one box (longer, it is written as its slices)
const STAND_SLICE_M = 100, STAND_SLICE_KEEP = 0.7;

/**
 * A stand's boxes: one, or a long (curved) one's slices along its length, each its own box.
 * @param {[number, number][]} pts the outline
 * @returns {object[]} the boxes
 */
function standBoxes(pts) {
  const whole = boxAround(pts);
  if (whole.w <= STAND_SLICE_M * 1.5) return [whole];
  const cosA = Math.cos(whole.rot), sinA = Math.sin(whole.rot), dense = [];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay);
    for (let t = 0; t < len; t += 2) dense.push([ax + (bx - ax) * t / len, ay + (by - ay) * t / len]);
  }
  const along = ([x, y]) => (x - whole.x) * cosA + (y - whole.y) * sinA;
  const count = Math.ceil(whole.w / STAND_SLICE_M), size = whole.w / count;
  const boxes = [];
  for (let k = 0; k < count; k++) {
    const from = -whole.w / 2 + k * size, to = from + size;
    const part = dense.filter((point) => along(point) >= from - 0.5 && along(point) <= to + 0.5);
    if (part.length < 3) continue;
    // the slice's long side along the stand's (a near-square slice's box can turn 90 degrees)
    const box = boxAround(part), turn = Math.abs(Math.atan2(Math.sin(box.rot - whole.rot),
      Math.cos(box.rot - whole.rot)));
    // (each a little shorter than its slice: a curved stand's slices overlapped at the joints)
    boxes.push(turn > Math.PI / 4 && turn < 3 * Math.PI / 4
      ? { ...box, w: round1(box.h * STAND_SLICE_KEEP), h: box.w,
        rot: Math.round(Math.atan2(Math.sin(box.rot + Math.PI / 2), Math.cos(box.rot + Math.PI / 2))
          * 1000) / 1000 } : { ...box, w: round1(box.w * STAND_SLICE_KEEP) });
  }
  return boxes;
}

/** Douglas-Peucker simplification to a tolerance in metres */
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const [ax, ay] = points[0], [bx, by] = points.at(-1);
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-9;
  let worst = 0, worstAt = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const off = len > 1e-6
      ? Math.abs((points[i][0] - ax) * dy - (points[i][1] - ay) * dx) / len
      : Math.hypot(points[i][0] - ax, points[i][1] - ay);
    if (off > worst) { worst = off; worstAt = i; }
  }
  if (worst <= tolerance) return [points[0], points.at(-1)];
  return [...simplify(points.slice(0, worstAt + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(worstAt), tolerance)];
}
const cleanLine = (points, tolerance) => simplify(points, tolerance).map(([x, y]) => [round1(x), round1(y)]);
const lineLength = (points) => points.slice(1)
  .reduce((sum, point, i) => sum + Math.hypot(point[0] - points[i][0], point[1] - points[i][1]), 0);

/** the smallest turned rectangle round a polygon (rotating calipers on the hull) */
function boxAround(points) {
  const hull = convexHull(points);
  let best = null;
  for (let i = 0; i < hull.length; i++) {
    const [ax, ay] = hull[i], [bx, by] = hull[(i + 1) % hull.length];
    const angle = Math.atan2(by - ay, bx - ax), cosA = Math.cos(angle), sinA = Math.sin(angle);
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const [x, y] of hull) {
      const along = x * cosA + y * sinA, across = -x * sinA + y * cosA;
      minU = Math.min(minU, along); maxU = Math.max(maxU, along);
      minV = Math.min(minV, across); maxV = Math.max(maxV, across);
    }
    const area = (maxU - minU) * (maxV - minV);
    if (!best || area < best.area) {
      const midU = (minU + maxU) / 2, midV = (minV + maxV) / 2;
      best = { area, x: midU * cosA - midV * sinA, y: midU * sinA + midV * cosA,
        w: maxU - minU, h: maxV - minV, rot: angle };
    }
  }
  // the long side along w
  if (best.h > best.w) best = { ...best, w: best.h, h: best.w, rot: best.rot + Math.PI / 2 };
  const rot = Math.atan2(Math.sin(best.rot), Math.cos(best.rot));
  return { x: round1(best.x), y: round1(best.y), w: round1(best.w), h: round1(best.h),
    rot: Math.round(rot * 1000) / 1000 };
}
function convexHull(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop();
    lower.push(point);
  }
  for (const point of sorted.reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop();
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

const keyOf = (node) => `${node.lat.toFixed(7)},${node.lon.toFixed(7)}`;

/**
 * A multipolygon's outer rings as closed ways carrying the relation's tags (a paddock or a wood
 * mapped as a relation): its outer members joined end to end.
 * @param relation the relation (out geom)
 * @returns the closed ways
 */
function relationRings(relation) {
  const parts = (relation.members || []).filter((member) => member.role === 'outer' && member.geometry)
    .map((member) => member.geometry.slice());
  const rings = [];
  while (parts.length) {
    const ring = parts.shift();
    for (let joined = true; joined && keyOf(ring[0]) !== keyOf(ring.at(-1));) {
      joined = false;
      for (const [i, part] of parts.entries()) {
        if (keyOf(part[0]) === keyOf(ring.at(-1))) ring.push(...part.slice(1));
        else if (keyOf(part.at(-1)) === keyOf(ring.at(-1))) ring.push(...part.reverse().slice(1));
        else continue;
        parts.splice(i, 1);
        joined = true;
        break;
      }
    }
    if (keyOf(ring[0]) === keyOf(ring.at(-1)))
      rings.push({ type: 'way', id: relation.id, tags: relation.tags, geometry: ring });
  }
  return rings;
}
const ways = [
  ...osm.elements.filter((element) => element.type === 'way' && element.geometry),
  ...(config.extra || []).map((feature, i) => ({ type: 'way', id: `extra ${i}`, tags: feature.tags,
    geometry: feature.pts.map(([lat, lon]) => ({ lat, lon })) })),
  ...osm.elements.filter((element) => element.type === 'relation'
    && element.tags?.type === 'multipolygon').flatMap(relationRings),
];
// "trim": { "<way id>": [first, last] } keeps only those nodes of a way (Spa's pit exit loops round
// inside La Source, a hairpin too tight at the game's scale for a lane inside it)
for (const [id, [first, last]] of Object.entries(config.trim || {})) {
  const way = ways.find((entry) => String(entry.id) === id);
  if (!way) throw new Error(`trim: no way ${id}`);
  way.geometry = way.geometry.slice(first, last + 1);
}

// ---- race road pieces: every motor raceway split where pieces meet ----
// a race piece with a loose surface is raced on dirt (a rallycross lap's gravel section)
const LOOSE = /unpaved|gravel|dirt|ground|compacted/;
const dirtIds = new Set((config.dirt || []).map(String));
// "race": [way ids] - raceways the map gives no sport that are race road (a link traced from Bing)
const raceIds = new Set((config.race || []).map(String));
// "skip": [way ids] - raceways that are not the venue's (driving-experience tracks, motocross), or
// any other way left out (traced again in "extra", or a fan zone named as a grandstand)
const skipIds = new Set((config.skip || []).map(String));
// "rails": [way ids] - the circuit's barriers mapped as barrier=wall or fence, read as rails
const railIds = new Set((config.rails || []).map(String));
// "posts": [way ids] - marshal posts mapped as buildings by name only (no emergency tag)
const postIds = new Set((config.posts || []).map(String));
// "traps": [way ids] - the circuit's gravel traps mapped as another surface (natural=sand)
const trapIds = new Set((config.traps || []).map(String));
// "roadRace": [way ids] - public road ways raced as race road (closed for the race: Le Mans)
const roadRaceIds = new Set((config.roadRace || []).map(String));
const isMotor = (way) => !skipIds.has(String(way.id))
  && (/motor/.test(way.tags.sport || '') || raceIds.has(String(way.id)));
const raceWays = ways.filter((way) => (way.tags?.highway === 'raceway'
  && isMotor(way) && !/Pit Lane/i.test(way.tags.name || '')
  && !dirtIds.has(String(way.id))) || roadRaceIds.has(String(way.id)));
const uses = new Map();
for (const way of raceWays) for (const node of way.geometry) uses.set(keyOf(node), (uses.get(keyOf(node)) || 0) + 1);
const pieces = [];
for (const way of raceWays) {
  const baseName = config.names?.[way.id] || way.tags.name || `way ${way.id}`;
  let run = [way.geometry[0]], part = 0;
  for (let i = 1; i < way.geometry.length; i++) {
    run.push(way.geometry[i]);
    if (i === way.geometry.length - 1 || uses.get(keyOf(way.geometry[i])) > 1) {
      pieces.push({ name: part ? `${baseName} ${part + 1}` : baseName, osm: way.id,
        from: keyOf(run[0]), to: keyOf(run.at(-1)), raw: run.map(toGame),
        loose: LOOSE.test(way.tags.surface || ''), road: roadRaceIds.has(String(way.id)) });
      run = [way.geometry[i]];
      part++;
    }
  }
}
for (const piece of pieces) piece.len = lineLength(piece.raw);
const nodePieces = new Map();
for (const [i, piece] of pieces.entries())
  for (const key of [piece.from, piece.to]) {
    if (!nodePieces.has(key)) nodePieces.set(key, []);
    nodePieces.get(key).push(i);
  }

/** the shortest run of pieces from one node to another, skipping a set of pieces */
function shortestRun(fromKey, toKey, skip) {
  const dist = new Map([[fromKey, 0]]), prev = new Map(), done = new Set();
  for (;;) {
    let here = null;
    for (const [key, value] of dist) if (!done.has(key) && (here === null || value < dist.get(here))) here = key;
    if (here === null) return null;
    if (here === toKey) break;
    done.add(here);
    for (const index of nodePieces.get(here) || []) {
      if (skip.has(index)) continue;
      const piece = pieces[index], next = piece.from === here ? piece.to : piece.from;
      const value = dist.get(here) + piece.len;
      if (value < (dist.get(next) ?? Infinity)) { dist.set(next, value); prev.set(next, index); }
    }
  }
  const run = [];
  for (let key = toKey; key !== fromKey;) {
    const index = prev.get(key), piece = pieces[index];
    const forward = piece.to === key;
    run.unshift({ index, forward });
    key = forward ? piece.from : piece.to;
  }
  return run;
}

/** a layout: the shortest loop through the first "through" piece avoiding the "avoid" pieces */
function buildLayout(spec) {
  const named = (name) => pieces.map((piece, i) => (piece.name === name ? i : -1)).filter((i) => i >= 0);
  const first = named(spec.through[0])[0];
  if (first === undefined) throw new Error(`no piece called ${spec.through[0]}`);
  const skip = new Set([first, ...(spec.avoid || []).flatMap(named)]);
  const back = shortestRun(pieces[first].to, pieces[first].from, skip);
  if (!back) throw new Error(`no loop through ${spec.through[0]}`);
  const run = [{ index: first, forward: true }, ...back];
  const missing = spec.through.filter((name) => !run.some((step) => pieces[step.index].name === name));
  if (missing.length) throw new Error(`layout misses ${missing.join(', ')}`);
  // run the way the race goes (spec.reverse: the shortest-loop direction is the wrong way round)
  const ordered = spec.reverse
    ? run.slice().reverse().map((step) => ({ ...step, forward: !step.forward })) : run;
  return ordered.map((step) => [pieces[step.index].name, step.forward ? 1 : -1]);
}

// ---- everything else, by kind ----
const SERVICE_WIDTH = { service: 5, residential: 6, unclassified: 6, tertiary: 7, track: 3.5 };
// paths that matter only where they cross the track on a bridge
const FOOT_WAYS = new Set(['footway', 'path', 'steps', 'pedestrian']);
const out = { pieces: [], layouts: {}, pitLanes: [], roads: [], footbridges: [], dirt: [],
  karting: [], tunnels: [], traps: [], tyres: [], stands: [], buildings: [], paddocks: [],
  woods: [], homes: [], rails: [], aero: [], rows: [], water: [],
  ...(config.parks ? { parks: [] } : {}) };
for (const piece of pieces)
  out.pieces.push({ name: piece.name, ...(piece.loose ? { surface: 'dirt' } : {}),
    pts: cleanLine(piece.raw, 0.25) });
for (const [id, spec] of Object.entries(config.layouts || {})) out.layouts[id] = buildLayout(spec);

const closed = (way) => way.geometry.length > 3 && keyOf(way.geometry[0]) === keyOf(way.geometry.at(-1));
// the venue's reach: only what lies within config.reachM real m of a race road is kept (the
// village next door, far fields and roads are not the venue's). A raceway's nodes are close (every
// 4th is enough); a raced public road's are hundreds of m apart on a straight (Le Mans): every 20 m
const REACH_STEP_M = 20;
const alongEvery = (line, stepM) => line.flatMap(([ax, ay], i) => {
  if (i === line.length - 1) return [[ax, ay]];
  const [bx, by] = line[i + 1];
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / stepM));
  return Array.from({ length: steps },
    (_, k) => [ax + (bx - ax) * k / steps, ay + (by - ay) * k / steps]);
});
const racePts = pieces.flatMap((piece) => (piece.road ? alongEvery(piece.raw, REACH_STEP_M)
  : piece.raw.filter((point, i) => i % 4 === 0)));
const reachSq = (config.reachM || 1e9) ** 2;
const inReach = ([x, y]) => racePts.some(([px, py]) => (px - x) ** 2 + (py - y) ** 2 <= reachSq);
for (const way of ways) {
  const tags = way.tags || {}, pts = way.geometry.map(toGame);
  if (!pts.some(inClip) || !pts.some(inReach)) continue;
  if (roadRaceIds.has(String(way.id))) continue;   // a race piece
  if (tags.highway !== 'raceway' && skipIds.has(String(way.id))) continue;
  const line = (tolerance) => cleanLine(pts, tolerance);
  // (a park's outline beside whatever else the way is: a wood is its trees too)
  if (config.parks && closed(way) && (['park', 'garden'].includes(tags.leisure)
    || ['grass', 'forest'].includes(tags.landuse) || tags.natural === 'wood'))
    out.parks.push({ name: tags.name || '', pts: line(1) });
  if (tags.highway === 'raceway' && /Pit Lane/i.test(tags.name || ''))
    out.pitLanes.push({ name: config.names?.[way.id] || tags.name, pts: line(0.25) });
  else if (tags.highway === 'raceway' && /kart/.test(tags.sport || '')) out.karting.push({ pts: line(0.3) });
  else if (tags.highway === 'raceway' && dirtIds.has(String(way.id)))
    out.dirt.push({ name: tags.name || '', pts: line(0.5) });
  else if (tags.highway === 'raceway' && isMotor(way)) continue;   // a race piece
  else if (tags.highway === 'raceway' && skipIds.has(String(way.id))) continue;
  else if (tags.highway === 'raceway') out.dirt.push({ name: tags.name || '', pts: line(0.5) });
  // (a road through a building - tunnel=building_passage - is a road, not a tunnel under the track)
  else if ((SERVICE_WIDTH[tags.highway] || FOOT_WAYS.has(tags.highway)) && tags.tunnel
    && tags.tunnel !== 'building_passage')
    out.tunnels.push({ kind: tags.highway, pts: line(0.5) });
  // a car park's own aisles are its tarmac, not roads (the paddock zone is paved already)
  else if (tags.service === 'parking_aisle') continue;
  else if (SERVICE_WIDTH[tags.highway] && tags.area !== 'yes')
    out.roads.push({ kind: tags.highway, width: SERVICE_WIDTH[tags.highway], bridge: !!tags.bridge,
      pts: line(0.5) });
  else if (FOOT_WAYS.has(tags.highway) && tags.bridge) out.footbridges.push({ pts: line(0.5) });
  else if (tags.landuse === 'residential' && closed(way)) out.homes.push({ pts: line(2) });
  else if ((tags.natural === 'shingle' || trapIds.has(String(way.id))) && closed(way))
    out.traps.push({ pts: line(0.5) });
  else if (tags.barrier === 'tyres') out.tyres.push({ pts: line(0.3) });
  // the real circuit's rails: Armco and concrete barriers (a venue built with followRails uses them)
  else if (tags.barrier === 'guard_rail' || tags.barrier === 'jersey_barrier'
    || (!!tags.barrier && railIds.has(String(way.id))))
    out.rails.push({ kind: tags.barrier, pts: line(0.3) });
  // (a building mapped by its name as a grandstand is one)
  else if ((tags.building === 'grandstand' || tags.leisure === 'bleachers'
    || /grandstand/i.test(tags.name || '')) && closed(way))
    for (const box of standBoxes(pts))
      out.stands.push({ name: config.names?.[way.id] || tags.name || '', ...box });
  // a marshal post mapped as a building (its fire extinguisher): the venue places its own
  else if (tags.building && (tags.emergency || postIds.has(String(way.id)))) continue;
  else if (tags.building && closed(way))
    out.buildings.push({ name: config.names?.[way.id] || tags.name || '',
      kind: config.kinds?.[way.id] || tags.building, ...boxAround(pts) });
  // an apron named in "names" as a paddock is one (the race paddock on the airfield's apron)
  else if (tags.aeroway === 'apron' && /paddock/i.test(config.names?.[way.id] || '') && closed(way))
    out.paddocks.push({ name: config.names[way.id], surface: tags.surface || 'asphalt',
      ...boxAround(pts), pts: line(1) });
  // an aircraft stand: the line a parked aeroplane stands along
  else if (tags.aeroway === 'parking_position')
    out.aero.push({ kind: 'stand', surface: '', width: 0, area: false, pts: line(0.5) });
  // an airfield inside the circuit: its runways, taxiways and aprons (paved or grass)
  else if (['runway', 'taxiway', 'apron'].includes(tags.aeroway)
    && !/displaced/.test(tags.runway || ''))
    out.aero.push({ kind: tags.aeroway, surface: tags.surface || 'asphalt',
      width: +(tags.width || 0) || (tags.aeroway === 'runway' ? 30 : 10),
      area: tags.aeroway === 'apron' && closed(way), pts: line(1) });
  else if (tags.amenity === 'parking' && closed(way))
    out.paddocks.push({ name: tags.name || '', surface: tags.surface || '', ...boxAround(pts),
      pts: line(1) });
  else if ((tags.natural === 'wood' || tags.landuse === 'forest') && closed(way)) out.woods.push({ pts: line(2) });
  // lakes and ponds (scenery water)
  else if (tags.natural === 'water' && closed(way)) out.water.push({ name: tags.name || '', pts: line(1) });
  // hedgerows and tree rows: the trees along the field edges
  else if (tags.barrier === 'hedge' || tags.natural === 'tree_row') out.rows.push({ pts: line(2) });
}

// the mapped single trees, nearest the race roads first
if (config.treeNodes) {
  const near = ([x, y]) => Math.min(...racePts.map(([px, py]) => Math.hypot(px - x, py - y)));
  const trees = osm.elements.filter((element) => element.type === 'node'
    && element.tags?.natural === 'tree').map((node) => toGame(node))
    .filter((point) => inClip(point) && inReach(point)).sort((first, second) => near(first) - near(second));
  for (const [x, y] of trees) out.rows.push({ pts: [[round1(x), round1(y)]] });
}

// a simple first build leaves whole kinds of feature out ("leaveOut": ["buildings", "roads", ...])
for (const key of config.leaveOut || []) {
  if (!Array.isArray(out[key]) || key === 'pieces') throw new Error(`leaveOut: no list ${key}`);
  out[key] = [];
}

// ---- write the module ----
// a space after every comma and colon between values, so long lines can be broken there
const json = (value) => JSON.stringify(value).replace(/,(?=["[{\d-])/g, ', ')
  .replace(/":(?=["[{\d-]|true|false)/g, '": ');
const lines = [
  `// ${path.basename(config.out)} - written by tools/osmvenue.mjs from OpenStreetMap; do not edit by`,
  '// hand except the layouts (each the ordered road pieces a layout runs over, 1 forward / -1',
  '// back). REAL metres in the game frame. Map data (c) OpenStreetMap contributors, ODbL.',
  "import type { VenueData } from '../../venue.ts';",
  '',
  `export const ${config.exportName}: VenueData = {`,
];
for (const [key, value] of Object.entries(out)) {
  if (key === 'layouts') {
    lines.push('  layouts: {');
    for (const [id, steps] of Object.entries(value)) lines.push(`    ${id}: ${json(steps)},`);
    lines.push('  },');
    continue;
  }
  lines.push(`  ${key}: [`);
  for (const item of value) lines.push(`    ${json(item)},`);
  lines.push('  ],');
}
lines.push('};', '');
// keep lines under the lint's 100: break long point lists after a comma
const wrapped = lines.flatMap((text) => {
  if (text.length <= 100) return [text];
  const parts = [];
  let rest = text;
  while (rest.length > 100) {
    const cut = rest.lastIndexOf(', ', 98);
    // nowhere to break (a long name): leave the line long rather than loop
    if (cut < 12) break;
    parts.push(rest.slice(0, cut + 1));
    rest = `      ${rest.slice(cut + 2)}`;
  }
  parts.push(rest);
  return parts;
});
fs.writeFileSync(config.out, wrapped.join('\n'));
const summary = Object.entries(out).map(([key, value]) => `${key} ${Array.isArray(value) ? value.length : Object.keys(value).length}`);
console.log('wrote', config.out, '-', summary.join(', '));
for (const [id, steps] of Object.entries(out.layouts)) {
  const len = steps.reduce((sum, [name]) => sum + pieces.find((piece) => piece.name === name).len, 0);
  console.log(`  layout ${id}: ${len.toFixed(0)} real m over ${steps.length} pieces`);
}
