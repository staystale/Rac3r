// stagegen.js — PROCEDURAL POINT-TO-POINT RALLY STAGES. User: "our rally stages are
// circular often — they should mostly be a LINE, not a track"; "make it procedural maybe so it
// feels infinite"; "levels are most important"; "make new things if needed, keep it pretty". A
// seeded generator: the same { seed, theme, len, style } always builds the same stage; NEW STAGE =
// a new seed.
//
// HOW: a self-avoiding road grown element by element (straights, fast sweepers, medium corners,
// squares, hairpins, chicanes) inside the world box (lab.js FLOOR — step 2 of the plan gives levels
// a bigger world), with backtracking when it paints itself into a corner. The road is RUN-UP ->
// START -> stage -> FINISH -> STOP ZONE; the engine's loop is closed by ONE ghost segment (lab.js
// ghostSegment) from the stop-zone end to the run-up, so the start line stays at distance 0 and
// timing / grid / AI / resets all work unchanged. Then the dressing, by theme: trees / rocks /
// crowds / chevrons / bales / tape / flags / marshals / boards / gantries / ice / water.
import { lcg } from "./core/random.ts";
import { finishLevel } from "./world/load.ts";
import { createSubtrack, ghostSegment, autoKerbs } from "./world/subtrack.ts";
import { onTrack } from "./world/tyrewall.ts";
import { alongTrack, solidsFromProps } from "./world/barriers.ts";
import { SURFACES } from "./world/surfaces.ts";
import { BASE_FLOOR as FLOOR } from "./world/bounds.ts";
import { LEVELS } from "./world/levels/index.ts";
import { trackKit } from "./world/levels/kit.ts";
import { prepBumps } from "./world/terrain.ts";
import { isWeatherOnly } from "./world/weather.ts";
import {
  buildStageCovers, snowPatchOf, snowRoadOf, stageTurnOf,
} from "./world/stageweather.ts";

export const THEMES = {
  forest: {
    name: 'FOREST GRAVEL', road: 'gravel', width: 9, base: 'grassLong', sep: 36, w: {
      straight: 1, fast: 1, medium: 1.1, square: 1, hairpin: 0.7
    }
  },
  alpine: {
    name: 'ALPINE TARMAC', road: 'tarmac', width: 8, base: 'grass', sep: 30, w: {
      straight: 0.8, fast: 0.7, medium: 1.1, square: 1, hairpin: 2.2
    }
  },
  snow: {
    name: 'SNOW + ICE', road: 'packedSnow', width: 9, base: 'snow', sep: 36, w: {
      straight: 1, fast: 1.2, medium: 1, square: 0.8, hairpin: 0.6
    }
  },
  desert: {
    name: 'DESERT DIRT', road: 'dirt', width: 10, base: 'sand', sep: 38, w: {
      straight: 1.4, fast: 1.5, medium: 0.9, square: 0.6, hairpin: 0.4
    }
  },
};
// long 2700 -> 2400: the 520 m world (stagegencheck: 2.0-2.7 km)
export const LENGTHS = { short: 1300, medium: 2000, long: 2400 };
const STYLES = { flowing: { straight: 1.2, fast: 1.6, medium: 0.9, square: 0.25, hairpin: 0.15 },
    mixed: { straight: 1, fast: 1, medium: 1, square: 1, hairpin: 1 },
  tight: { straight: 0.7, fast: 0.4, medium: 1.1, square: 1.6, hairpin: 1.8 } };
// SILLY NAMES (requirement: remember all names should be silly) — parody place names per theme
const NAMES = {
  forest: [['Llanfair', 'Pen-y-', 'Aber', 'Glen ', 'Cwm', 'Bryn', 'Coed-y-'],
      ['sheepdip', 'cowpatt', 'muddyfoot', 'slippy-bottom', 'bogwobble', 'skidwyn', 'splatt']],
  alpine: [['Col de ', 'Mont ', 'Pic du ', 'Val de '],
      ['Fromage', 'Croissant', 'Brakefade', 'Le Skid', 'Wee-Wee', 'Sacré Bleugh', 'Baguette']],
  snow: [['Ikea', 'Brrr', 'Frosty', 'Snö', 'Nippy'],
      ['flatpack', 'meatballen', 'kanelbulle', 'skidsson', 'fjordfiesta', 'nosedrip', 'bumfrost']],
  desert: [['Dune ', 'Wadi ', 'Sahara ', 'Oasis '],
      ['Sandpants', 'Sunburn', 'Dusty Bin', 'Hot Bottom', 'Humpback', 'Sandwich', 'Grit Happens']],
};
const rng = (seed) => lcg((seed >>> 0) || 1);

// ---------------------------------------------------------------- the ROAD (centreline points, 3 m
// apart)
const STEP = 3;
// occupancy grid cell (m); road distance within which other road does not count (hairpin legs)
const CELL = 20, NEAR = 130;
/**
 * Occupancy grid key of a position.
 * @param {number} x metres
 * @param {number} y metres
 * @return {number} the cell key
 */
function roadKey(x, y) { return Math.floor(x / CELL) * 100003 + Math.floor(y / CELL); }
/**
 * Adds a road point to the road and to its occupancy grid.
 * @param {object} grow road state (see growRoad)
 * @param {{x: number, y: number, s: number}} point the point
 */
function putRoadPoint(grow, point) {
  grow.points.push(point);
  const cellKey = roadKey(point.x, point.y);
  let bucket = grow.occ.get(cellKey);
  if (!bucket) grow.occ.set(cellKey, bucket = []);
  bucket.push(point);
}
/**
 * Removes the last COUNT road points from the road and its occupancy grid.
 * @param {object} grow road state (see growRoad)
 * @param {number} count how many points to drop
 */
function dropRoadPoints(grow, count) {
  for (let i = 0; i < count; i++) {
    const point = grow.points.pop(), bucket = grow.occ.get(roadKey(point.x, point.y));
    bucket.splice(bucket.indexOf(point), 1);
  }
}
/**
 * Tells whether a road point at this spot keeps inside the box and clear of other road.
 * @param {object} grow road state (see growRoad)
 * @param {number} x metres
 * @param {number} y metres
 * @param {number} dist road distance of the point
 * @return {boolean} true when it fits
 */
function roadFits(grow, x, y, dist) {
  const { LIM, SEP, occ } = grow;
  if (Math.abs(x) > LIM || Math.abs(y) > LIM) return false;
  const cellX = Math.floor(x / CELL), cellY = Math.floor(y / CELL), cells = Math.ceil(SEP / CELL);
  for (let i = -cells; i <= cells; i++) for (let j = -cells; j <= cells; j++)
    for (const point of occ.get((cellX + i) * 100003 + (cellY + j)) || [])
      if (dist - point.s > NEAR && (point.x - x) ** 2 + (point.y - y) ** 2 < SEP * SEP)
        return false;
  return true;
}
/**
 * START: near a random edge, facing into the box; the RUN-UP (45 m) behind it. Sets the road
 * state's x, y, hdg and dist.
 * @param {object} grow road state (see growRoad)
 * @param {function: number} rand random source
 */
function startRoad(grow, rand) {
  const LIM = grow.LIM;
  const side = (rand() * 4) | 0, edgePos = (rand() - 0.5) * 1.2 * LIM;
  const [startX, startY, startHdg] = [[edgePos, -LIM + 30, Math.PI / 2],
      [edgePos, LIM - 30, -Math.PI / 2], [-LIM + 30, edgePos, 0],
          [LIM - 30, edgePos, Math.PI]][side];
  grow.hdg = startHdg + (rand() - 0.5) * 0.6;
  for (let runDist = -45; runDist < 0; runDist += STEP) putRoadPoint(grow, {
    x: startX + Math.cos(grow.hdg) * runDist, y: startY + Math.sin(grow.hdg) * runDist,
    s: runDist });
  grow.x = startX; grow.y = startY; grow.dist = 0;
  putRoadPoint(grow, { x: grow.x, y: grow.y, s: grow.dist });
}
/**
 * Makes the weighted random picker of road element kinds.
 * @param {function: number} rand random source
 * @param {object} themeSpec the theme
 * @param {string} style the style name
 * @return {function: string} picks a kind
 */
function makeKindPicker(rand, themeSpec, style) {
  const weights = { ...STYLES[style] };
  for (const kindName in weights) weights[kindName] *= themeSpec.w[kindName];
  const kinds = Object.keys(weights),
      wSum = kinds.reduce((total, kindName) => total + weights[kindName], 0);
  return () => {
    let roll = rand() * wSum;
    for (const kindName of kinds) {
      roll -= weights[kindName];
      if (roll <= 0) return kindName;
    } return 'straight';
  };
}
/**
 * Makes the parts (straights and arcs) of one random road element of a kind.
 * @param {function: number} rand random source
 * @param {object} themeSpec the theme
 * @param {string} kind straight / fast / medium / square / hairpin
 * @return {object[]} the parts: { len, rad, ang }
 */
function makeRoadElement(rand, themeSpec, kind) {
  const dir = rand() < 0.5 ? 1 : -1, deg = Math.PI / 180;
  if (kind === 'straight') return [{ len: (themeSpec === THEMES.desert ? 50 : 25)
      + rand() * (themeSpec === THEMES.desert ? 140 : 90), rad: 0 }];
  if (kind === 'fast') return [{ len: 0, rad: 70 + rand() * 70,
      ang: dir * (15 + rand() * 30) * deg }];
  // a chicane / S
  if (kind === 'medium') return rand() < 0.25
      ? [{ rad: 28 + rand() * 20, ang: dir * (35 + rand() * 30) * deg },
          { len: 10 + rand() * 15, rad: 0 },
              { rad: 28 + rand() * 20, ang: -dir * (35 + rand() * 30) * deg }]
    : [{ rad: 28 + rand() * 32, ang: dir * (30 + rand() * 60) * deg }];
  if (kind === 'square') return [{ len: 12 + rand() * 15, rad: 0 },
      { rad: 14 + rand() * 6, ang: dir * (80 + rand() * 18) * deg }];
  // hairpin
  return [{ len: 15 + rand() * 15, rad: 0 },
      { rad: 11 + rand() * 3, ang: dir * (140 + rand() * 35) * deg }, { len: 20, rad: 0 }];
}
/**
 * A candidate element's points (not committed), or null if any of them breaks the rules.
 * @param {object} grow road state (see growRoad)
 * @param {object[]} parts the element's parts
 * @return {?{out: object[], x: number, y: number, hdg: number, s: number}} the candidate
 */
function buildRoadCandidate(grow, parts) {
  const out = []; let curX = grow.x, curY = grow.y, curHdg = grow.hdg, curDist = grow.dist;
  for (const part of parts) {
    const partLen = part.rad ? Math.abs(part.ang) * part.rad : part.len,
        steps = Math.max(1, Math.round(partLen / STEP)), stepLen = partLen / steps,
            stepTurn = part.rad ? part.ang / steps : 0;
    for (let i = 0; i < steps; i++) { curHdg += stepTurn / 2; curX += Math
        .cos(curHdg) * stepLen; curY += Math
            .sin(curHdg) * stepLen; curHdg += stepTurn / 2; curDist += stepLen;
      if (!roadFits(grow, curX, curY, curDist)) return null;
      out.push({ x: curX, y: curY, s: curDist }); }
  }
  return { out, x: curX, y: curY, hdg: curHdg, s: curDist };
}
/**
 * Counts old road within 60 m of a position.
 * @param {object} grow road state (see growRoad)
 * @param {number} posX metres
 * @param {number} posY metres
 * @param {number} sNow road distance of the position
 * @return {number} the count
 */
function roadCrowd(grow, posX, posY, sNow) {
  let count = 0; const cellX = Math.floor(posX / CELL),
      cellY = Math.floor(posY / CELL);
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) for (const point of grow.occ
      .get((cellX + i) * 100003 + (cellY + j)) || []) if (sNow - point.s > NEAR
          && (point.x - posX) ** 2 + (point.y - posY) ** 2 < 3600) count++;
  return count;
}
/**
 * SPACE-SEEKING (v2 — MEASURED v1: a greedy random walk painted itself into a corner, 30-100 % of
 * long stages came out short, one at 0.33 km): of up to K valid candidates take the one whose END
 * has the most free space round it and ahead of it (not facing a wall or old road within 60 m),
 * plus a little randomness so stages still differ. This scores one candidate (lower is better).
 * @param {object} grow road state (see growRoad)
 * @param {function: number} rand random source
 * @param {{x: number, y: number, hdg: number, s: number}} cand the candidate
 * @return {number} the score
 */
function scoreRoadCandidate(grow, rand, cand) {
  const LIM = grow.LIM;
  const aheadX = cand.x + Math.cos(cand.hdg) * 55,
      aheadY = cand.y + Math.sin(cand.hdg) * 55,
          edge = LIM - Math.max(Math.abs(cand.x), Math.abs(cand.y)),
              aEdge = LIM - Math.max(Math.abs(aheadX), Math.abs(aheadY));
  return roadCrowd(grow, cand.x, cand.y, cand.s) + 2 * roadCrowd(grow, aheadX, aheadY, cand.s + 55)
      + Math.max(0, 60 - edge) * 0.4 + (aEdge < 0 ? 40 : 0) + rand() * 6;
}
/**
 * Takes back the last committed element, restoring the road state to before it.
 * @param {object} grow road state (see growRoad)
 * @param {object[]} stack the committed elements
 */
function popRoadElement(grow, stack) {
  const last = stack.pop();
  dropRoadPoints(grow, last.n);
  grow.x = last.x;
  grow.y = last.y;
  grow.hdg = last.hdg;
  grow.dist = last.s;
}
/**
 * Grows the road element by element up to the target length, backtracking when stuck.
 * @param {object} grow road state (see growRoad)
 * @param {function: number} rand random source
 * @param {function: string} pickKind picks an element kind
 * @param {object} themeSpec the theme
 * @param {number} target stage length (m)
 * @param {object[]} stack committed elements, filled in
 */
function growRoadElements(grow, rand, pickKind, themeSpec, target, stack) {
  let tries = 0, back = 0;
  while (grow.dist < target && tries < 2500) {
    tries++;
    let best = null, bestScore = Infinity;
    for (let trial = 0; trial < 6; trial++) {
      const cand = buildRoadCandidate(grow, makeRoadElement(rand, themeSpec, pickKind()));
      if (!cand) continue;
      const candScore = scoreRoadCandidate(grow, rand, cand);
      if (candScore < bestScore) { bestScore = candScore; best = cand; }
    }
    if (best) {
      stack.push({ n: best.out.length, x: grow.x, y: grow.y, hdg: grow.hdg, s: grow.dist });
      for (const point of best.out) putRoadPoint(grow, point);
      grow.x = best.x;
      grow.y = best.y;
      grow.hdg = best.hdg;
      grow.dist = best.s;
      back = 0;
      continue;
    }
    // stuck: BACKTRACK the last element (and more if it keeps failing) and try again from there
    if (++back > 3 && stack.length) {
      popRoadElement(grow, stack);
      back = 0;
    }
  }
}
/**
 * The STOP ZONE: up to 60 m on, straight if it fits, else a gentle bend each way; if none fits,
 * the stage ends one element EARLIER (MEASURED: a run with no room for a stop zone returned
 * nothing at all).
 * @param {object} grow road state (see growRoad)
 * @param {object[]} stack committed elements
 * @return {{stop: number, finishS: number}} stop zone point count and the finish distance
 */
function placeStopZone(grow, stack) {
  let stop = 0, finishS = grow.dist;
  for (let guard = 0; guard < 40 && !stop; guard++) {
    finishS = grow.dist;
    for (const bend of [0, 0.004, -0.004, 0.009, -0.009, 0.015, -0.015]) {
      let curX = grow.x, curY = grow.y, curHdg = grow.hdg, curDist = grow.dist, placed = 0;
      for (let i = 0; i < 20; i++) {
        curHdg += bend * STEP;
        curX += Math.cos(curHdg) * STEP;
        curY += Math.sin(curHdg) * STEP;
        curDist += STEP;
        if (!roadFits(grow, curX, curY, curDist)) break;
        putRoadPoint(grow, { x: curX, y: curY, s: curDist });
        placed++;
      }
      if (placed >= 10) { stop = placed; break; } dropRoadPoints(grow, placed);
    }
    if (!stop) {
      if (!stack.length) break;
      popRoadElement(grow, stack);
    }
  }
  return { stop, finishS };
}
/**
 * Grows one road. The road state grow is { LIM, SEP, occ, points, x, y, hdg, dist }: the box limit,
 * the other-road separation, the occupancy grid, the points { x, y, s } (s = road distance; the
 * run-up is negative) and the head of the road.
 * @param {function: number} rand random source
 * @param {object} themeSpec the theme
 * @param {string} style the style name
 * @param {number} target stage length (m)
 * @return {{P: object[], finishS: number, stopN: number, ok: boolean}} the road
 */
function growRoad(rand, themeSpec, style, target) {
  // m: other road at least SEP away, except within NEAR m of road distance (hairpin legs)
  const grow = { LIM: FLOOR - 34, SEP: themeSpec.sep, occ: new Map(), points: [],
    x: 0, y: 0, hdg: 0, dist: 0 };
  startRoad(grow, rand);
  const pickKind = makeKindPicker(rand, themeSpec, style);
  const stack = [];
  growRoadElements(grow, rand, pickKind, themeSpec, target, stack);
  const { stop, finishS } = placeStopZone(grow, stack);
  return { P: grow.points, finishS, stopN: stop, ok: finishS >= target * 0.6 && stop >= 10 };
}

// ---------------------------------------------------------------- the LEVEL
/**
 * Builds up to 8 roads and keeps the LONGEST valid one (stops early at 95 % of the target).
 * @param {number} seed the seed
 * @param {object} themeSpec the theme
 * @param {string} style the style name
 * @param {number} target stage length (m)
 * @param {?number} attempt a single attempt number to build, or null for the search
 * @return {{road: object, used: number}} the road and the attempt that made it
 */
function chooseStageRoad(seed, themeSpec, style, target, attempt) {
  let road = null;
  let used = 0;
  for (let attemptIdx = attempt ?? 0; attemptIdx < (attempt != null ? attempt + 1
      : 8); attemptIdx++) {
    const result = growRoad(rng(seed + attemptIdx * 7777), themeSpec, style, target);
    if (result.stopN >= 10 && (!road || result.finishS > road.finishS)) {
      road = result;
      used = attemptIdx;
    } if (road && road.finishS >= target * 0.95) break;
  }
  return { road, used };
}
/**
 * SECTORS: the theme's road, with patches for character (alpine: broken tarmac; desert: sand;
 * forest: a dirt run).
 * @param {function: number} rand random source
 * @param {string} theme the theme name
 * @param {number} finishS finish road distance
 * @param {object} roadS the road surface
 * @param {string|null} snowRoad a weather-only snow stage's road (its patches), else null
 * @return {object[]} the sectors
 */
function buildStageSectors(rand, theme, finishS, roadS, snowRoad) {
  const sectors = [];
  const patchS = snowRoad ? SURFACES[snowPatchOf(snowRoad)] : {
    alpine: SURFACES.broken, desert: SURFACES.sand, forest: SURFACES.dirt, snow: SURFACES.ice
  }[theme];
  for (let patch = 0; patch < 3; patch++) {
    const patchStart = 150 + rand() * (finishS - 300);
    sectors.push({ startDist: patchStart, endDist: patchStart + 30 + rand() * 50,
        surface: patchS });
  }
  sectors.push({ startDist: 0, endDist: 1e9, surface: roadS });
  return sectors;
}
/**
 * TERRAIN: big hills, crests + JUMPS on the longer straights.
 * @param {function: number} rand random source
 * @param {string} theme the theme name
 * @param {object} kit the track kit
 * @param {object[]} corners the corners
 * @param {number} FIN finish distance
 * @return {{bumps: object[], straights: number[][], marks: Array}} bumps, the straights between
 *   corners and the JUMP / CREST board marks
 */
function buildStageTerrain(rand, theme, kit, corners, FIN) {
  const bumps = [];
  for (let hill = 0; hill < 4; hill++) bumps
      .push({ kind: 'hump', x: (rand() - 0.5) * 1.6 * FLOOR, y: (rand() - 0.5) * 1.6 * FLOOR,
          r: 70 + rand() * 80, h: theme === 'alpine' ? 8 + rand() * 8 : 4 + rand() * 6 });
  const straights = [];
  {
    let last = 0;
    for (const corner of corners) {
      if (corner.startDist - last > 55) straights.push([last, corner.startDist]);
      last = corner.endDist;
    } if (FIN - last > 55) straights.push([last, FIN]);
  }
  const marks = [];
  for (const [segStart, segEnd] of straights) {
    if (theme === 'alpine' || rand() > 0.45) continue;
    const midDist = (segStart + segEnd) / 2, jump = rand() < 0.4, pos = kit.at(midDist, 0);
    bumps.push({ kind: 'hump', x: pos.x, y: pos.y, r: jump ? 8 : 16 + rand() * 6,
        h: jump ? 1.3 : 1.3 + rand() * 0.5 });
    marks.push([midDist, jump ? 'JUMP' : 'CREST']);
  }
  return { bumps, straights, marks };
}
// ---- DRESSING (the Killder treatment). The dressing state dress is { rand, kit, sub, theme, seed,
// width, halfWidth, FIN, endD, runD, props, cones, barriers }: the shared random source, kit and
// track, the stage numbers (endD / runD = the road distances either side of the ghost segment)
// and the lists being filled.
const FLAGC = ['#c8302c', '#e2c13a', '#2b56b5', '#2f7d4f', '#f2f2f2', '#e07a1f'];
/**
 * Dresses one corner's outside: bales (not alpine) or armco (alpine, not sharp).
 * @param {object} dress dressing state
 * @param {object} corner the corner
 * @param {number} out side sign of the outside
 * @param {boolean} sharp whether the corner is a hairpin / square
 */
function dressCornerOutside(dress, corner, out, sharp) {
  const { kit, sub, theme, halfWidth, FIN, cones, barriers } = dress;
  if (theme !== 'alpine') {
    for (let dist = corner.startDist - 8; dist <= Math
        .min(corner.endDist + 12, FIN - 6); dist += 2.2) {
      const pos = kit.at(dist, out * (halfWidth + 2.9));
      cones.push({ x: pos.x, y: pos.y, kind: 'bale', rot: kit.rot(dist) });
    }
  } else if (!sharp) barriers
      .push({ kind: 'armco',
          pts: alongTrack(sub, corner.startDist - 15, corner.endDist + 15,
              out * (halfWidth + 2.2), 2) });
}
/**
 * Dresses a hairpin / square: tyre walls, tape line, a CROWD and sometimes a building.
 * @param {object} dress dressing state
 * @param {number} turn the signed turn
 * @param {number} mid corner mid distance
 * @param {number} out side sign of the outside
 */
function dressSharpCorner(dress, turn, mid, out) {
  const { rand, kit, sub, halfWidth, props, cones, barriers } = dress;
  for (let shift = -10; shift <= 10; shift += 0.95) for (const row of Math.abs(turn) > 2.4
      ? [0, 1] : [0]) {
    const pos = kit.at(mid + shift, out * (halfWidth + 4 + row * 0.95));
    if (kit.clear(pos.x, pos.y, 0.5)) cones.push({ x: pos.x, y: pos.y, kind: 'tyrestack' });
  }
  barriers.push({ kind: 'line', col: '#e23b2e',
      pts: alongTrack(sub, mid - 28, mid + 28, -out * (halfWidth + 10), 3) });
  const crowdPos = kit.at(mid, -out * (halfWidth + 15));
  props.push({ kind: 'crowd', x: crowdPos.x, y: crowdPos.y, rot: kit.rot(mid), w: 16, h: 4,
      n: 22, seed: (mid | 0) + 3 });
  if (rand() < 0.5) props
      .push(kit.prop(mid, -out * (halfWidth + 22),
          { kind: 'block', w: 5, h: 5, roof: '#eef0f2' }));
}
/**
 * Dresses every corner: chevrons + bales outside, cones on the apex, flags; hairpins / squares
 * get tyre walls, tape (-> rally tape posts, lab.js) and a CROWD; tarmac fast corners get ARMCO.
 * @param {object} dress dressing state
 * @param {object[]} corners the corners
 */
function dressStageCorners(dress, corners) {
  const { kit, halfWidth, props, cones } = dress;
  for (const corner of corners) {
    const turn = stageTurnOf(kit, corner), dir = turn > 0 ? 1 : -1, out = -dir,
        mid = (corner.startDist + corner.endDist) / 2, sharp = Math.abs(turn) > 1.3;
    const chev = { kind: 'chevron', rot: dir > 0 ? Math.PI / 2 : -Math.PI / 2 };
    props.push(kit.prop(corner.startDist - 12, out * (halfWidth + 5), chev),
        kit.prop(mid, out * (halfWidth + 6), chev));
    dressCornerOutside(dress, corner, out, sharp);
    for (const shift of [-4, 0, 4]) {
      const pos = kit.at(mid + shift, -out * (halfWidth + 0.8));
      cones.push({ x: pos.x, y: pos.y, kind: 'cone' });
    }
    for (let flagIdx = 0; flagIdx < 3; flagIdx++) props
        .push(kit.prop(mid - 9 + flagIdx * 9, out * (halfWidth + 8),
            { kind: 'flag', col: FLAGC[(flagIdx + (mid | 0)) % FLAGC.length] }));
    if (sharp) dressSharpCorner(dress, turn, mid, out);
  }
}
/**
 * Dresses the JUMP / CREST marks: a board before and a crowd at each.
 * @param {object} dress dressing state
 * @param {Array} marks [distance, label] pairs
 */
function dressStageMarks(dress, marks) {
  const { kit, halfWidth, props } = dress;
  for (const [dist, label] of marks) {
    props.push(kit.prop(dist - 30, 12, { kind: 'board', label }));
    const crowdPos = kit.at(dist, -(halfWidth + 13));
    props.push({ kind: 'crowd', x: crowdPos.x, y: crowdPos.y, rot: kit.rot(dist), w: 14, h: 4,
        n: 16, seed: (dist | 0) + 1 });
  }
}
/**
 * START / FINISH: gantries, flag rows, boards; the STOP board; a wall of tyres at the end of the
 * stop zone + the run-up.
 * @param {object} dress dressing state
 */
function dressStageStartFinish(dress) {
  const { kit, width, halfWidth, FIN, endD, runD, props, cones } = dress;
  props.push(kit.prop(2, 0, { kind: 'gantry', wid: width + 8, rot: Math.PI / 2 }),
      kit.prop(FIN, 0, { kind: 'gantry', wid: width + 8, rot: Math.PI / 2 }),
    kit.prop(FIN + 3, -(halfWidth + 4), { kind: 'board', label: 'FINISH' }),
        kit.prop(FIN + 30, -(halfWidth + 4), { kind: 'board', label: 'STOP' }));
  for (let flagIdx = 0; flagIdx < 6; flagIdx++) props
      .push(kit.prop(4 + flagIdx * 5, -(halfWidth + 3),
          { kind: 'flag', col: ['#c8302c', '#f2f2f2'][flagIdx % 2] }),
              kit.prop(4 + flagIdx * 5, halfWidth + 3,
                  { kind: 'flag', col: ['#2b56b5', '#f2f2f2'][flagIdx % 2] }),
    kit.prop(FIN - 25 + flagIdx * 5, -(halfWidth + 3),
        { kind: 'flag', col: ['#2b56b5', '#f2f2f2'][flagIdx % 2] }));
  for (const [dist, back] of [[endD - 1, -1], [runD + 1, 1]]) for (const row of [0,
      1]) for (let lateral = -halfWidth - 1; lateral <= halfWidth + 1; lateral += 0.95) {
    const pos = kit.at(dist + back * row * 0.95, lateral);
    cones.push({ x: pos.x, y: pos.y, kind: 'tyrestack' });
  }
}
/**
 * Sponsor boards and marshals along the stage.
 * @param {object} dress dressing state
 */
function dressStageSigns(dress) {
  const { kit, seed, halfWidth, FIN, props } = dress;
  const sponsors = ['KUM TYRES', 'DUNFLOP', 'SPUM', 'SLIPPY PISTONS', 'PIRRELLY', 'MUDDY BANK',
      'RAC3R'];
  for (let dist = 200, sponsorIdx = 0; dist < FIN - 60; dist += 260, sponsorIdx++) props
      .push(kit.prop(dist, (sponsorIdx % 2 ? 1 : -1) * (halfWidth + 8),
          { kind: 'board', label: sponsors[(sponsorIdx + seed) % sponsors.length] }));
  for (let dist = 130; dist < FIN - 40; dist += 230) props
      .push(kit.prop(dist, ((dist / 230) | 0) % 2 ? halfWidth + 7 : -(halfWidth + 7),
          { kind: 'marshal' }));
}
/**
 * The SERVICE PARK beside the run-up: marquees + team trucks (where they fit).
 * @param {object} dress dressing state
 */
function dressStageServicePark(dress) {
  const { kit, halfWidth, runD, props } = dress;
  for (const [dist, off,
      propSpec] of [[runD + 12, -(halfWidth + 16), { kind: 'block', w: 12, h: 6, roof: '#eef0f2' }],
          [runD + 28, -(halfWidth + 16), { kind: 'block', w: 12, h: 6, roof: '#eef0f2' }],
    [runD + 18, halfWidth + 14, { kind: 'truck', col: '#2f7d4f' }],
        [runD + 34, halfWidth + 14, { kind: 'truck', col: '#c8302c' }]]) { const prop = kit
            .prop(dist, off, propSpec); if (kit.clear(prop.x, prop.y, 4)) props.push(prop); }
}
/**
 * Makes a tree prop.
 * @param {number} x metres
 * @param {number} y metres
 * @param {number} size tree size
 * @param {object} extra extra fields
 * @return {object} the prop
 */
function makeStageTree(x, y, size, extra = {}) {
  return { kind: 'tree', x, y, s: size, seed: ((x * 7 + y * 13) | 0) * 2 + 1, ...extra };
}
/**
 * Makes a rock prop.
 * @param {number} x metres
 * @param {number} y metres
 * @param {number} size rock size
 * @param {object} extra extra fields
 * @return {object} the prop
 */
function makeStageRock(x, y, size, extra = {}) {
  return { kind: 'rock', x, y, s: size, seed: ((x * 5 + y * 11) | 0) + 3, ...extra };
}
/**
 * Fill trees and rocks over the whole floor, counts by theme.
 * @param {object} dress dressing state
 */
function dressStageFill(dress) {
  const { rand, kit, theme, props } = dress;
  const fill = { forest: [520, 0], snow: [320, 30], alpine: [140, 110], desert: [110, 170] }[theme];
  for (let treeIdx = 0; treeIdx < fill[0]; treeIdx++) {
    const x = (rand() - 0.5) * 2 * (FLOOR - 10), y = (rand() - 0.5) * 2 * (FLOOR - 10);
    if (kit.clear(x, y, 9)) props
        .push(makeStageTree(x, y, theme === 'desert' ? 2 + rand() * 1.6 : 4 + rand() * 2.6,
            { snow: theme === 'snow', pal: theme === 'desert' ? 'dry' : undefined }));
  }
  for (let rockIdx = 0; rockIdx < fill[1]; rockIdx++) {
    const x = (rand() - 0.5) * 2 * (FLOOR - 10), y = (rand() - 0.5) * 2 * (FLOOR - 10);
    if (kit.clear(x, y, 6)) props
        .push(makeStageRock(x, y, 2 + rand() * 3.5,
            { pal: theme === 'desert' ? 'red' : undefined, snow: theme === 'snow' }));
  }
}
/**
 * NATURE by theme: roadside tree walls, fill trees and rocks, alpine roadside rocks.
 * @param {object} dress dressing state
 */
function dressStageNature(dress) {
  const { rand, kit, theme, halfWidth, FIN, props } = dress;
  const wallEvery = { forest: 7, snow: 9, alpine: 16, desert: 0 }[theme];
  if (wallEvery) for (let dist = 18; dist < FIN
      + 50; dist += wallEvery) for (const sd2 of [-1, 1]) {
    if (rand() < 0.3) continue;
    const pos = kit.at(dist + rand() * 3, sd2 * (halfWidth + 9 + rand() * 7));
    if (kit.clear(pos.x, pos.y, 7)) props
        .push(makeStageTree(pos.x, pos.y, 4.5 + rand() * 2.5,
            { snow: theme === 'snow' || (theme === 'alpine' && rand() < 0.3) }));
  }
  dressStageFill(dress);
  if (theme === 'alpine') for (let dist = 30; dist < FIN; dist += 9) {
    if (rand() < 0.45) continue;
    const pos = kit.at(dist, (rand() < 0.5 ? -1 : 1) * (halfWidth + 4 + rand() * 4));
    if (kit.clear(pos.x, pos.y, 2.5)) props.push(makeStageRock(pos.x, pos.y, 2 + rand() * 2.5));
  }
}
/**
 * Picks the silly stage name of a theme.
 * @param {function: number} rand random source
 * @param {string} theme the theme name
 * @return {string} the name
 */
function pickStageName(rand, theme) {
  const nameParts = NAMES[theme] || NAMES.forest,
      pre = nameParts[0][(rand() * nameParts[0].length) | 0],
          suf = nameParts[1][(rand() * nameParts[1].length) | 0];
  return pre + (pre.endsWith(' ') ? suf[0].toUpperCase() + suf.slice(1) : suf);
}
/**
 * Keeps the props that are on the allow list or clear of the road.
 * @param {object} kit the track kit
 * @param {object[]} props every prop
 * @return {object[]} the props that stay
 */
function filterStageProps(kit, props) {
  return props
      .filter((prop) => ['gantry', 'truck', 'chevron', 'flag', 'board', 'crowd', 'marshal']
          .includes(prop.kind) || (prop.kind === 'block' && prop.w > 10) ? true : kit
              .clear(prop.x, prop.y, prop.kind === 'tree' ? 7 : 2));
}
/**
 * The chequered start and finish lines.
 * @param {object} sub the track
 * @param {number} FIN finish distance
 * @param {number} width road width
 * @return {object[]} the paint
 */
function buildStagePaint(sub, FIN, width) {
  return [{ kind: 'chequered', x: sub.pts[0].x, y: sub.pts[0].y, len: 1.6, wid: width,
      rot: sub.pts[0].heading },
          (() => { const pos = onTrack(sub, FIN, 0, {}); return { kind: 'chequered', x: pos.x,
              y: pos.y, len: 1.6, wid: width, rot: pos.rot }; })()];
}
export function genStage({ seed = 1001, theme = 'forest', len = 'medium', style = 'mixed',
    attempt = null } = {}) {
  const themeSpec = THEMES[theme] || THEMES.forest;
  const target = LENGTHS[len] || 2000;
  const { road, used } = chooseStageRoad(seed, themeSpec, style, target, attempt);
  const rand = rng(seed ^ 0x5bd1e995);
  // points in ENGINE order: START .. stage .. FINISH .. stop zone | ghost | run-up (ends 3 m before
  // the start line, the closing segment)
  const runUp = road.P.filter((point) => point.s < 0),
      main = road.P.filter((point) => point.s >= 0);
  const pts = [...main, ...runUp].map((point) => [point.x, point.y]), ghostIdx = main.length - 1;
  const snowRoad = theme === 'snow' && isWeatherOnly() ? snowRoadOf(seed) : null;
  const width = themeSpec.width, halfWidth = width / 2,
    roadS = SURFACES[snowRoad || themeSpec.road];
  const sectors = buildStageSectors(rand, theme, road.finishS, roadS, snowRoad);
  const sub = ghostSegment(createSubtrack(pts, width, sectors, [], true), ghostIdx);
  sub.noLines = theme !== 'alpine';   // painted edge lines only on the tarmac theme
  const FIN = sub.pts[Math.max(0, main.findIndex((point) => point.s >= road.finishS - 1e-6))].dist;
  const kit = trackKit(sub, seed % 2147483646 + 1, []);
  const corners = autoKerbs(sub, { maxR: 70, exitR: 0, minTurn: 18, mergeGap: 10 })
      .filter((corner) => corner.startDist > 25 && corner.endDist < FIN - 10);
  const { bumps, straights, marks } = buildStageTerrain(rand, theme, kit, corners, FIN);
  const covers = buildStageCovers(rand, theme, kit, corners, straights, FIN);
  const dress = { rand, kit, sub, theme, seed, width, halfWidth, FIN,
    endD: sub.pts[ghostIdx].dist, runD: sub.pts[ghostIdx + 1].dist,
    props: [], cones: [], barriers: [] };
  dressStageCorners(dress, corners);
  dressStageMarks(dress, marks);
  dressStageStartFinish(dress);
  dressStageSigns(dress);
  dressStageServicePark(dress);
  dressStageNature(dress);
  const { props, cones, barriers } = dress;
  const name = pickStageName(rand, theme);
  const okProps = filterStageProps(kit, props);
  const paint = buildStagePaint(sub, FIN, width);
  const level = {
    id: `gen-${theme}-${len}-${style}-${seed}`, name, gen: {
      seed, theme, len, style, attempt: used, km: +(FIN / 1000).toFixed(2)
    },
    base: SURFACES[snowRoad ? 'grass' : themeSpec.base], subtrack: sub, camber: {
      maxDeg: 0, refR: 60, crown: 0.03, edge: 5, sections: []
    },
    zones: [], bumps: prepBumps(bumps), covers, paint, boards: [], seams: false, cones,
        props: okProps, barriers, solids: solidsFromProps(okProps), lanes: [],
    stage: { finish: FIN }, ...(snowRoad ? { snowy: true } : {}),
    spawn: (() => { const pos = onTrack(sub, sub.totalDist - 6, 0, {}); return { x: pos.x, y: pos.y,
        heading: pos.rot }; })(),
  };
  return level;
}
// put a generated stage into LEVELS (one slot: the generator's), with the post-passes every level
// gets; returns the level
export function installStage(level) {
  finishLevel(level);
  const i = LEVELS.findIndex((entry) => entry.gen && !entry.fixed);
  if (i < 0) LEVELS.push(level); else LEVELS[i] = level;
  return level;
}
export const GEN_DEFAULT = { seed: 1001, theme: 'forest', len: 'medium', style: 'mixed' };
// THE SET STAGES (requirement: rally stages should be SET, but other events might need a procedural
// track): the generator as a design tool — seeds picked by tools/stageseeds.mjs (2 km, first
// attempt so each rebuilds in ~5-35 ms at boot, corners / hairpins / crests scored, then
// looked at), registered as ordinary levels after Killder, the same road every time so it can be
// learned.
export const SET_STAGES = [
  {
    seed: 38, theme: 'forest', style: 'tight', name: 'Llanfairsheepdip'
  }, { seed: 26, theme: 'forest', style: 'mixed', name: 'Pen-y-cowpatt' },
  {
    seed: 18, theme: 'alpine', style: 'mixed', name: 'Col de Fromage'
  }, { seed: 37, theme: 'alpine', style: 'tight', name: 'Mont Brakefade' },
  {
    seed: 33, theme: 'snow', style: 'tight', name: 'Ikeaflatpack'
  }, { seed: 12, theme: 'snow', style: 'mixed', name: 'Brrrmeatballen' },
  {
    seed: 21, theme: 'desert', style: 'tight', name: 'Sahara Sandpants'
  }, { seed: 31, theme: 'desert', style: 'mixed', name: 'Wadi Dusty Bin' },
];
let stagesAdded = false;
// adds the default generated stage, then the set stages, to LEVELS (called once, after the
// hand-made levels)
export function addStageLevels() {
  if (stagesAdded) return;
  stagesAdded = true;
  // the generator's slot: its stage too is generated on first use (its track card, setLevel)
  const { theme, len, style, seed } = GEN_DEFAULT;
  installStage({ id: `gen-${theme}-${len}-${style}-${seed}`, name: 'Stage generator',
    gen: { ...GEN_DEFAULT }, _build: () => genStage(GEN_DEFAULT) });
  {
    let insertAt = LEVELS.findIndex((entry) => entry.id === 'killder') + 1 || LEVELS.length;
    // ON FIRST USE (load.ts buildLevel; MEASURED, CPU x4: all nine at start-up cost 1.95 s of the
    // load). The menu needs only name + theme; setLevel and the setup screen build the same road.
    for (const setStage of SET_STAGES) {
      const stageId = 'stage-' + setStage.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/[^a-z]+/g, '-').replace(/-$/, '');
      LEVELS.splice(insertAt++, 0, {
        id: stageId, name: setStage.name, fixed: true,
        gen: { seed: setStage.seed, theme: setStage.theme, len: 'medium', style: setStage.style },
        _build: () => Object.assign(genStage({ ...setStage, len: 'medium', attempt: 0 }),
          { id: stageId, name: setStage.name, fixed: true }),
      });
    }
  }
}
