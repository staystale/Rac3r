// cones.js — knockable cones, tyre stacks, and individual tyres with realistic simulated dynamics.
// Cones topple and slide. Tyre stacks absorb momentum, and shatter into individual tyres
// that roll upright on their tread, tumble/flip, wobble, and slide flat on the floor.
// The simulation lives in src/cones/ (coneConsts, coneWalls, coneCar, coneTape, coneGrid,
// coneStep); this file builds the one context they share and returns the cones object.

import { CONES } from "./world/state.ts";
import { fileAtRest, rebuildRestGrid } from "./cones/coneGrid.js";
import { stepCones } from "./cones/coneStep.js";
import { CONE_R, DEBRIS, TOPPLES } from "./cones/coneConsts.js";

export { DEBRIS };

/**
 * The mass of a level object by kind.
 * @param {any} levelObj the level object
 * @returns {number} kg
 */
function massOf(levelObj) {
  return DEBRIS[levelObj.kind] ? DEBRIS[levelObj.kind].mass : levelObj.kind === 'sheep' ? 12
      : levelObj.kind === 'cow' ? 250 : levelObj.kind === 'tapepost' ? 4 : levelObj.kind
      === 'banger' ? 1400 : levelObj.kind === 'caravan' ? 1800 : levelObj.kind === 'podium'
      ? 900 : levelObj.kind === 'bale' ? 250 : levelObj.kind === 'tyrestack' ? 38
      : levelObj.kind === 'tyre' ? 12 : levelObj.kind === 'chevron' ? 45 : levelObj.kind
      === 'flag' ? 12 : 2;
}

/**
 * The radius of a level object by kind.
 * @param {any} levelObj the level object
 * @returns {number} metres
 */
function radiusOf(levelObj) {
  return DEBRIS[levelObj.kind] ? DEBRIS[levelObj.kind].r : levelObj.kind === 'sheep' ? 0.55
      : levelObj.kind === 'cow' ? 1.0 : levelObj.kind === 'tapepost' ? 0.15 : levelObj.kind
      === 'banger' ? 2.1 : levelObj.kind === 'caravan' ? 2.4 : levelObj.kind === 'podium'
      ? 1.7 : levelObj.kind === 'bale' ? 0.8 : levelObj.kind === 'tyrestack' ? 0.48
      : levelObj.kind === 'tyre' ? 0.42 : levelObj.kind === 'chevron' ? 1.1 : levelObj.kind
      === 'flag' ? 0.35 : CONE_R * 1.35;
}

/**
 * A level object -> a live loose object (shared by reset and spawn).
 * @param {any} levelObj the level object
 * @returns {any} the live object
 */
function live(levelObj) {
  return {
    kind: levelObj.kind || 'cone',
    mode: levelObj.kind === 'tyrestack' ? 'stack' : levelObj.kind === 'tyre' ? 'flat'
        : TOPPLES.has(levelObj.kind) ? 'cone' : levelObj.kind || 'cone',
    x: levelObj.x, y: levelObj.y, hx: levelObj.x, hy: levelObj.y,
    vx: 0, vy: 0, ang: levelObj.rot || 0, spin: 0, down: 0, moved: false,
    mass: massOf(levelObj),
    r: radiusOf(levelObj),
    // field: a highway field's animals go when the field is cleared
    col: levelObj.col, tape: levelObj.tape, idx: levelObj.idx, field: levelObj.field,
    paint: levelObj.paint,
    num: levelObj.num,
    hitCount: 0,
    rollDist: 0,
    flipPhase: 0,
    flipSpeed: 0,
    wobblePhase: 0,
    wobbleAmp: 0,
    _s: levelObj._s,
  };
}

/**
 * The tape SECTIONS: consecutive posts of the same tape.
 * @param {any[]} list the live objects
 * @returns {any[]} the sections
 */
function tapeSections(list) {
  const sections = [];
  const byTape = new Map();
  for (const obj of list) if (obj.kind === 'tapepost') {
    if (!byTape.has(obj.tape)) byTape.set(obj.tape, []);
    byTape.get(obj.tape).push(obj);
  }
  for (const posts of byTape.values()) {
    posts.sort((postA, postB) => postA.idx - postB.idx);
    for (let i = 0; i + 1 < posts.length; i++) if (posts[i + 1].idx === posts[i].idx
        + 1) sections.push({ a: posts[i], b: posts[i + 1], rest: Math.hypot(posts[i + 1].x
        - posts[i].x, posts[i + 1].y - posts[i].y), broken: false });
  }
  return sections;
}

/**
 * Rebuild the list, tape sections and rest grid for the level.
 * @param {any} ctx the cones context
 */
function resetCones(ctx) {
  ctx.list = CONES.map(live);
  ctx.hits.length = 0;
  ctx.list.forEach((obj, i) => { obj._n = i; }); ctx.nextN = ctx.list.length;
  // the tape SECTIONS: consecutive posts of the same tape
  ctx.sections = tapeSections(ctx.list); ctx.puffs = [];
  rebuildRestGrid(ctx);
}

// A PERSISTENT GRID of the objects AT REST (cones/coneGrid.js), built once per level (reset) —
// they do not move, so it stays valid. Each step only the MOVING objects are tested: against the
// resting objects in their 3x3 cells, and against each other directly (there are only ever a
// handful). An object that comes to rest is filed into the cell it stopped in. MEASURED
// 2026-10-03 (tools/objcheck.mjs, car into the Stock Car wall):
//   grid rebuilt every step ..... 446 us/step mean with debris flying
//   movers vs whole list ........ 437-626 us (noisy; the list is 633 long)
//   this ........................ see objcheck — the figure is written into ENGINE.md

// objectHits: false is for harness baselines only
export function createCones({ objectHits = true } = {}) {
  const ctx = {
    list: [], clock: 0, sections: [], puffs: [], nextN: 0, objectHits,
    hits: [],           // {x, y, speed, kind} drained by render.ts each frame for dust
    restGrid: new Map(),        // cell key -> objects at rest in it
    movers: [], prevMovers: [],
    burst: [],                  // reused every step
  };
  const { hits } = ctx;
  const reset = () => resetCones(ctx);
  const step = (carOrCars, dt) => stepCones(ctx, carOrCars, dt);

  reset();
  return {
    get list() { return ctx.list; },
    get tapes() { return ctx.sections; },
    get tapePuffs() { return ctx.puffs; },
    get clock() { return ctx.clock; },
    get hits() { return hits; },
    drainHits() {
      const copy = hits.slice();
      hits.length = 0;
      return copy;
    },
    // CONES ONLY (user, 2026-10-04: "the cone counter should only count cones, not tyres too") —
    // tyre walls, bales etc. are not the course
    get knocked() {
      return ctx.list.reduce((count, obj) => count + (obj.kind === 'cone' && (obj.down > 0.5
          || obj.moved) ? 1 : 0), 0);
    },
    get total() {
      return ctx.list.reduce((count, obj) => count + (obj.kind === 'cone' ? 1 : 0), 0);
    },
    step, reset,
    // a loose object made during play (DAMAGE: a torn-off wheel) — a rolling tyre with everything
    // the list's tyres carry
    add(extra) { ctx.list.push({ kind: 'tyre', mode: 'roll', mass: 12, r: 0.42, hx: extra.x,
        hy: extra.y, moved: true, hitCount: 1, down: 0, ang: 0, spin: 0,
      flipPhase: 0, flipSpeed: 0, wobblePhase: 0, wobbleAmp: 0, rollDist: 0, ...extra,
        _n: ctx.nextN++ }); },
    rebuildGrid: () => rebuildRestGrid(ctx),   // for harnesses that add objects by hand
    // STREAMED objects (the endless highway, 2026-10-05: "littered with tyres and cones, chevrons
    // for the corners"): spawn() adds level objects as the road grows ahead; cull(keep) drops every
    // object keep() rejects (the road behind) and refiles the rest grid
    spawn(objs) {
      for (const levelObj of objs) {
        const obj = live(levelObj);
        obj._n = ctx.nextN++;
        ctx.list.push(obj);
        fileAtRest(ctx, obj);
      }
    },
    cull(keep) {
      const before = ctx.list.length;
      ctx.list = ctx.list.filter(keep);
      if (ctx.list.length !== before) rebuildRestGrid(ctx);
      return before - ctx.list.length;
    },
  };
}
