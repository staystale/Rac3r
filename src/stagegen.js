// stagegen.js — PROCEDURAL POINT-TO-POINT RALLY STAGES. User, 2026-10-04: "our rally stages are circular often — they should mostly be a
// LINE, not a track"; "make it procedural maybe so it feels infinite"; "levels are most important"; "make new things if needed, keep it
// pretty". A seeded generator: the same { seed, theme, len, style } always builds the same stage; NEW STAGE = a new seed.
//
// HOW: a self-avoiding road grown element by element (straights, fast sweepers, medium corners, squares, hairpins, chicanes) inside the
// world box (lab.js FLOOR — step 2 of the plan gives levels a bigger world), with backtracking when it paints itself into a corner. The
// road is RUN-UP -> START -> stage -> FINISH -> STOP ZONE; the engine's loop is closed by ONE ghost segment (lab.js ghostSegment) from the
// stop-zone end to the run-up, so the start line stays at distance 0 and timing / grid / AI / resets all work unchanged.
// Then the dressing, by theme: trees / rocks / crowds / chevrons / bales / tape / flags / marshals / boards / gantries / ice / water.
import { lcg } from "./core/random.ts";
import { finishLevel } from "./world/load.js";   // the world is set up before this file runs (as importing lab.js did)
import { createSubtrack, ghostSegment, autoKerbs } from "./world/subtrack.js";
import { onTrack, querySubtrack } from "./world/tyrewall.js";
import { alongTrack, solidsFromProps } from "./world/barriers.js";
import { SURFACES } from "./world/surfaces.js";
import { BASE_FLOOR as FLOOR } from "./world/bounds.js";
import { LEVELS } from "./world/levels/index.js";
import { trackKit } from "./world/levels/kit.js";
import { prepBumps } from "./world/terrain.js";

export const THEMES = {
  forest: { name: 'FOREST GRAVEL', road: 'gravel', width: 9, base: 'grassLong', sep: 36, w: { straight: 1, fast: 1, medium: 1.1, square: 1, hairpin: 0.7 } },
  alpine: { name: 'ALPINE TARMAC', road: 'tarmac', width: 8, base: 'grass', sep: 30, w: { straight: 0.8, fast: 0.7, medium: 1.1, square: 1, hairpin: 2.2 } },
  snow: { name: 'SNOW + ICE', road: 'packedSnow', width: 9, base: 'snow', sep: 36, w: { straight: 1, fast: 1.2, medium: 1, square: 0.8, hairpin: 0.6 } },
  desert: { name: 'DESERT DIRT', road: 'dirt', width: 10, base: 'sand', sep: 38, w: { straight: 1.4, fast: 1.5, medium: 0.9, square: 0.6, hairpin: 0.4 } },
};
export const LENGTHS = { short: 1300, medium: 2000, long: 2400 };   // long 2700 -> 2400: the 520 m world (stagegencheck: 2.0-2.7 km)
const STYLES = { flowing: { straight: 1.2, fast: 1.6, medium: 0.9, square: 0.25, hairpin: 0.15 }, mixed: { straight: 1, fast: 1, medium: 1, square: 1, hairpin: 1 },
  tight: { straight: 0.7, fast: 0.4, medium: 1.1, square: 1.6, hairpin: 1.8 } };
// SILLY NAMES (user, 2026-10-04: "remember all names should be silly") — parody place names per theme
const NAMES = {
  forest: [['Llanfair', 'Pen-y-', 'Aber', 'Glen ', 'Cwm', 'Bryn', 'Coed-y-'], ['sheepdip', 'cowpatt', 'muddyfoot', 'slippy-bottom', 'bogwobble', 'skidwyn', 'splatt']],
  alpine: [['Col de ', 'Mont ', 'Pic du ', 'Val de '], ['Fromage', 'Croissant', 'Brakefade', 'Le Skid', 'Wee-Wee', 'Sacré Bleugh', 'Baguette']],
  snow: [['Ikea', 'Brrr', 'Frosty', 'Snö', 'Nippy'], ['flatpack', 'meatballen', 'kanelbulle', 'skidsson', 'fjordfiesta', 'nosedrip', 'bumfrost']],
  desert: [['Dune ', 'Wadi ', 'Sahara ', 'Oasis '], ['Sandpants', 'Sunburn', 'Dusty Bin', 'Hot Bottom', 'Humpback', 'Sandwich', 'Grit Happens']],
};
const rng = (seed) => lcg((seed >>> 0) || 1);

// ---------------------------------------------------------------- the ROAD (centreline points, 3 m apart)
const STEP = 3;
function growRoad(R, th, style, target) {
  const LIM = FLOOR - 34, SEP = th.sep, NEAR = 130;   // m: other road at least SEP away, except within NEAR m of road distance (hairpin legs)
  const CELL = 20, occ = new Map(), P = [];           // P: { x, y, s } (s = road distance; the run-up is negative)
  const key = (x, y) => Math.floor(x / CELL) * 100003 + Math.floor(y / CELL);
  const put = (q) => { P.push(q); const k = key(q.x, q.y); let l = occ.get(k); if (!l) occ.set(k, l = []); l.push(q); };
  const drop = (n) => { for (let i = 0; i < n; i++) { const q = P.pop(), l = occ.get(key(q.x, q.y)); l.splice(l.indexOf(q), 1); } };
  const fits = (x, y, s) => {
    if (Math.abs(x) > LIM || Math.abs(y) > LIM) return false;
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), r = Math.ceil(SEP / CELL);
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (const q of occ.get((cx + i) * 100003 + (cy + j)) || [])
      if (s - q.s > NEAR && (q.x - x) ** 2 + (q.y - y) ** 2 < SEP * SEP) return false;
    return true;
  };
  // START: near a random edge, facing into the box; the RUN-UP (45 m) behind it
  const side = (R() * 4) | 0, a = (R() - 0.5) * 1.2 * LIM;
  const [x0, y0, h0] = [[a, -LIM + 30, Math.PI / 2], [a, LIM - 30, -Math.PI / 2], [-LIM + 30, a, 0], [LIM - 30, a, Math.PI]][side];
  let hdg = h0 + (R() - 0.5) * 0.6;
  for (let s = -45; s < 0; s += STEP) put({ x: x0 + Math.cos(hdg) * s, y: y0 + Math.sin(hdg) * s, s });
  let x = x0, y = y0, s = 0; put({ x, y, s });
  const W = { ...STYLES[style] }; for (const k in W) W[k] *= th.w[k];
  const kinds = Object.keys(W), wSum = kinds.reduce((t, k) => t + W[k], 0);
  const pickKind = () => { let r = R() * wSum; for (const k of kinds) { r -= W[k]; if (r <= 0) return k; } return 'straight'; };
  const elem = (kind) => {
    const dir = R() < 0.5 ? 1 : -1, deg = Math.PI / 180;
    if (kind === 'straight') return [{ len: (th === THEMES.desert ? 50 : 25) + R() * (th === THEMES.desert ? 140 : 90), rad: 0 }];
    if (kind === 'fast') return [{ len: 0, rad: 70 + R() * 70, ang: dir * (15 + R() * 30) * deg }];
    if (kind === 'medium') return R() < 0.25 ? [{ rad: 28 + R() * 20, ang: dir * (35 + R() * 30) * deg }, { len: 10 + R() * 15, rad: 0 }, { rad: 28 + R() * 20, ang: -dir * (35 + R() * 30) * deg }]   // a chicane / S
      : [{ rad: 28 + R() * 32, ang: dir * (30 + R() * 60) * deg }];
    if (kind === 'square') return [{ len: 12 + R() * 15, rad: 0 }, { rad: 14 + R() * 6, ang: dir * (80 + R() * 18) * deg }];
    return [{ len: 15 + R() * 15, rad: 0 }, { rad: 11 + R() * 3, ang: dir * (140 + R() * 35) * deg }, { len: 20, rad: 0 }];   // hairpin
  };
  // a candidate element's points (not committed), or null if any of them breaks the rules
  const build = (parts) => {
    const out = []; let cx = x, cy = y, ch = hdg, cs = s;
    for (const pt of parts) {
      const L = pt.rad ? Math.abs(pt.ang) * pt.rad : pt.len, k = Math.max(1, Math.round(L / STEP)), dl = L / k, dh = pt.rad ? pt.ang / k : 0;
      for (let i = 0; i < k; i++) { ch += dh / 2; cx += Math.cos(ch) * dl; cy += Math.sin(ch) * dl; ch += dh / 2; cs += dl;
        if (!fits(cx, cy, cs)) return null; out.push({ x: cx, y: cy, s: cs }); }
    }
    return { out, x: cx, y: cy, hdg: ch, s: cs };
  };
  // SPACE-SEEKING (v2 — MEASURED v1: a greedy random walk painted itself into a corner, 30-100 % of long stages came out short, one at
  // 0.33 km): of up to K valid candidates take the one whose END has the most free space round it and ahead of it (not facing a wall
  // or old road within 60 m), plus a little randomness so stages still differ
  const crowd = (px, py, sNow) => { let c = 0; const cx = Math.floor(px / CELL), cy = Math.floor(py / CELL);
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) for (const q of occ.get((cx + i) * 100003 + (cy + j)) || []) if (sNow - q.s > NEAR && (q.x - px) ** 2 + (q.y - py) ** 2 < 3600) c++; return c; };
  const score = (c) => { const ax = c.x + Math.cos(c.hdg) * 55, ay = c.y + Math.sin(c.hdg) * 55, edge = LIM - Math.max(Math.abs(c.x), Math.abs(c.y)), aEdge = LIM - Math.max(Math.abs(ax), Math.abs(ay));
    return crowd(c.x, c.y, c.s) + 2 * crowd(ax, ay, c.s + 55) + Math.max(0, 60 - edge) * 0.4 + (aEdge < 0 ? 40 : 0) + R() * 6; };
  const stack = []; let tries = 0, back = 0;
  while (s < target && tries < 2500) {
    tries++;
    let best = null, bs = Infinity;
    for (let k = 0; k < 6; k++) { const c = build(elem(pickKind())); if (!c) continue; const sc = score(c); if (sc < bs) { bs = sc; best = c; } }
    if (best) { stack.push({ n: best.out.length, x, y, hdg, s }); for (const q of best.out) put(q); x = best.x; y = best.y; hdg = best.hdg; s = best.s; back = 0; continue; }
    // stuck: BACKTRACK the last element (and more if it keeps failing) and try again from there
    if (++back > 3 && stack.length) { const e = stack.pop(); drop(e.n); x = e.x; y = e.y; hdg = e.hdg; s = e.s; back = 0; }
  }
  // the STOP ZONE: up to 60 m on, straight if it fits, else a gentle bend each way; if none fits, the stage ends one element EARLIER
  // (MEASURED: a run with no room for a stop zone returned nothing at all)
  let stop = 0, finishS = s;
  for (let guard = 0; guard < 40 && !stop; guard++) {
    finishS = s;
    for (const bend of [0, 0.004, -0.004, 0.009, -0.009, 0.015, -0.015]) {
      let cx = x, cy = y, ch = hdg, cs = s, n = 0;
      for (let i = 0; i < 20; i++) { ch += bend * STEP; cx += Math.cos(ch) * STEP; cy += Math.sin(ch) * STEP; cs += STEP; if (!fits(cx, cy, cs)) break; put({ x: cx, y: cy, s: cs }); n++; }
      if (n >= 10) { stop = n; break; } drop(n);
    }
    if (!stop) { if (!stack.length) break; const e = stack.pop(); drop(e.n); x = e.x; y = e.y; hdg = e.hdg; s = e.s; }
  }
  return { P, finishS, stopN: stop, ok: finishS >= target * 0.6 && stop >= 10 };
}

// ---------------------------------------------------------------- the LEVEL
export function genStage({ seed = 1001, theme = 'forest', len = 'medium', style = 'mixed', attempt = null } = {}) {
  const th = THEMES[theme] || THEMES.forest;
  // up to 8 attempts; keep the LONGEST valid one (stop early at 95 % of the target)
  let road = null; const target = LENGTHS[len] || 2000;
  let used = 0;
  for (let k = attempt ?? 0; k < (attempt != null ? attempt + 1 : 8); k++) { const r2 = growRoad(rng(seed + k * 7777), th, style, target); if (r2.stopN >= 10 && (!road || r2.finishS > road.finishS)) { road = r2; used = k; } if (road && road.finishS >= target * 0.95) break; }
  const R = rng(seed ^ 0x5bd1e995);
  // points in ENGINE order: START .. stage .. FINISH .. stop zone | ghost | run-up (ends 3 m before the start line, the closing segment)
  const runUp = road.P.filter((q) => q.s < 0), main = road.P.filter((q) => q.s >= 0);
  const pts = [...main, ...runUp].map((q) => [q.x, q.y]), gi = main.length - 1;
  const width = th.width, hw = width / 2, roadS = SURFACES[th.road];
  // SECTORS: the theme's road, with patches for character (alpine: broken tarmac; desert: sand; forest: a dirt run)
  const sectors = [];
  const patchS = { alpine: SURFACES.broken, desert: SURFACES.sand, forest: SURFACES.dirt, snow: SURFACES.ice }[theme];
  for (let k = 0; k < 3; k++) { const d0 = 150 + R() * (road.finishS - 300); sectors.push({ startDist: d0, endDist: d0 + 30 + R() * 50, surface: patchS }); }
  sectors.push({ startDist: 0, endDist: 1e9, surface: roadS });
  const sub = ghostSegment(createSubtrack(pts, width, sectors, [], true), gi);
  sub.noLines = theme !== 'alpine';   // painted edge lines only on the tarmac theme
  const FIN = sub.pts[Math.max(0, main.findIndex((q) => q.s >= road.finishS - 1e-6))].dist;
  const kit = trackKit(sub, seed % 2147483646 + 1, []);
  const turnOf = (c) => { const a = kit.rot(c.startDist), b = kit.rot(c.endDist); let t = b - a; return Math.atan2(Math.sin(t), Math.cos(t)); };
  const corners = autoKerbs(sub, { maxR: 70, exitR: 0, minTurn: 18, mergeGap: 10 }).filter((c) => c.startDist > 25 && c.endDist < FIN - 10);
  // ---- terrain: big hills, crests + JUMPS on the longer straights
  const bumps = [];
  for (let k = 0; k < 4; k++) bumps.push({ kind: 'hump', x: (R() - 0.5) * 1.6 * FLOOR, y: (R() - 0.5) * 1.6 * FLOOR, r: 70 + R() * 80, h: theme === 'alpine' ? 8 + R() * 8 : 4 + R() * 6 });
  const straights = []; { let last = 0; for (const c of corners) { if (c.startDist - last > 55) straights.push([last, c.startDist]); last = c.endDist; } if (FIN - last > 55) straights.push([last, FIN]); }
  const marks = [];
  for (const [a, b] of straights) {
    if (theme === 'alpine' || R() > 0.45) continue;
    const d = (a + b) / 2, jump = R() < 0.4, p = kit.at(d, 0);
    bumps.push({ kind: 'hump', x: p.x, y: p.y, r: jump ? 8 : 16 + R() * 6, h: jump ? 1.3 : 1.3 + R() * 0.5 }); marks.push([d, jump ? 'JUMP' : 'CREST']);
  }
  // ---- covers: forest water splash, ice in the shade of alpine hairpins, ice patches on snow stages
  const covers = [];
  const coverAt = (d, cover, w, h) => { const p = kit.at(d, 0); covers.push({ x: p.x, y: p.y, w, h, cover, shape: 'ellipse', rot: kit.rot(d) }); };
  if (theme === 'forest' && straights.length) { const [a, b] = straights[(R() * straights.length) | 0]; coverAt((a + b) / 2 + 20, 'wet', 16, 13); }
  if (theme === 'alpine') for (const c of corners.filter((c) => Math.abs(turnOf(c)) > 2).slice(0, 3)) coverAt((c.startDist + c.endDist) / 2, 'ice', 9, 7);
  if (theme === 'snow') for (let k = 0; k < 4; k++) coverAt(120 + R() * (FIN - 200), 'ice', 14, 8);
  // ---- DRESSING (the Killder treatment): every corner chevrons + bales outside, cones on the apex, flags; hairpins / squares get tyre
  // walls, tape (-> rally tape posts, lab.js) and a CROWD; tarmac fast corners get ARMCO
  const props = [], cones = [], barriers = [];
  const FLAGC = ['#c8302c', '#e2c13a', '#2b56b5', '#2f7d4f', '#f2f2f2', '#e07a1f'];
  for (const c of corners) {
    const t = turnOf(c), dir = t > 0 ? 1 : -1, out = -dir, mid = (c.startDist + c.endDist) / 2, sharp = Math.abs(t) > 1.3;
    const chev = { kind: 'chevron', rot: dir > 0 ? Math.PI / 2 : -Math.PI / 2 };
    props.push(kit.prop(c.startDist - 12, out * (hw + 5), chev), kit.prop(mid, out * (hw + 6), chev));
    if (theme !== 'alpine') for (let d = c.startDist - 8; d <= Math.min(c.endDist + 12, FIN - 6); d += 2.2) { const p = kit.at(d, out * (hw + 2.9)); cones.push({ x: p.x, y: p.y, kind: 'bale', rot: kit.rot(d) }); }
    else if (!sharp) barriers.push({ kind: 'armco', pts: alongTrack(sub, c.startDist - 15, c.endDist + 15, out * (hw + 2.2), 2) });
    for (const k of [-4, 0, 4]) { const p = kit.at(mid + k, -out * (hw + 0.8)); cones.push({ x: p.x, y: p.y, kind: 'cone' }); }
    for (let k = 0; k < 3; k++) props.push(kit.prop(mid - 9 + k * 9, out * (hw + 8), { kind: 'flag', col: FLAGC[(k + (mid | 0)) % FLAGC.length] }));
    if (sharp) {
      for (let k = -10; k <= 10; k += 0.95) for (const w of Math.abs(t) > 2.4 ? [0, 1] : [0]) { const p = kit.at(mid + k, out * (hw + 4 + w * 0.95)); if (kit.clear(p.x, p.y, 0.5)) cones.push({ x: p.x, y: p.y, kind: 'tyrestack' }); }
      barriers.push({ kind: 'line', col: '#e23b2e', pts: alongTrack(sub, mid - 28, mid + 28, -out * (hw + 10), 3) });
      const cp = kit.at(mid, -out * (hw + 15)); props.push({ kind: 'crowd', x: cp.x, y: cp.y, rot: kit.rot(mid), w: 16, h: 4, n: 22, seed: (mid | 0) + 3 });
      if (R() < 0.5) props.push(kit.prop(mid, -out * (hw + 22), { kind: 'block', w: 5, h: 5, roof: '#eef0f2' }));
    }
  }
  for (const [d, label] of marks) { props.push(kit.prop(d - 30, 12, { kind: 'board', label })); const cp = kit.at(d, -(hw + 13)); props.push({ kind: 'crowd', x: cp.x, y: cp.y, rot: kit.rot(d), w: 14, h: 4, n: 16, seed: (d | 0) + 1 }); }
  // START / FINISH: gantries, chequered lines, flag rows, boards; the STOP board; a wall of tyres at the end of the stop zone + the run-up
  props.push(kit.prop(2, 0, { kind: 'gantry', wid: width + 8, rot: Math.PI / 2 }), kit.prop(FIN, 0, { kind: 'gantry', wid: width + 8, rot: Math.PI / 2 }),
    kit.prop(FIN + 3, -(hw + 4), { kind: 'board', label: 'FINISH' }), kit.prop(FIN + 30, -(hw + 4), { kind: 'board', label: 'STOP' }));
  for (let k = 0; k < 6; k++) props.push(kit.prop(4 + k * 5, -(hw + 3), { kind: 'flag', col: ['#c8302c', '#f2f2f2'][k % 2] }), kit.prop(4 + k * 5, hw + 3, { kind: 'flag', col: ['#2b56b5', '#f2f2f2'][k % 2] }),
    kit.prop(FIN - 25 + k * 5, -(hw + 3), { kind: 'flag', col: ['#2b56b5', '#f2f2f2'][k % 2] }));
  const endD = sub.pts[gi].dist, runD = sub.pts[gi + 1].dist;
  for (const [d, back] of [[endD - 1, -1], [runD + 1, 1]]) for (const w of [0, 1]) for (let o = -hw - 1; o <= hw + 1; o += 0.95) { const p = kit.at(d + back * w * 0.95, o); cones.push({ x: p.x, y: p.y, kind: 'tyrestack' }); }
  const sponsors = ['KUM TYRES', 'DUNFLOP', 'SPUM', 'SLIPPY PISTONS', 'PIRRELLY', 'MUDDY BANK', 'RAC3R'];
  for (let d = 200, k = 0; d < FIN - 60; d += 260, k++) props.push(kit.prop(d, (k % 2 ? 1 : -1) * (hw + 8), { kind: 'board', label: sponsors[(k + seed) % sponsors.length] }));
  for (let d = 130; d < FIN - 40; d += 230) props.push(kit.prop(d, ((d / 230) | 0) % 2 ? hw + 7 : -(hw + 7), { kind: 'marshal' }));
  // the SERVICE PARK beside the run-up: marquees + team trucks (where they fit)
  for (const [d, off, o] of [[runD + 12, -(hw + 16), { kind: 'block', w: 12, h: 6, roof: '#eef0f2' }], [runD + 28, -(hw + 16), { kind: 'block', w: 12, h: 6, roof: '#eef0f2' }],
    [runD + 18, hw + 14, { kind: 'truck', col: '#2f7d4f' }], [runD + 34, hw + 14, { kind: 'truck', col: '#c8302c' }]]) { const pr = kit.prop(d, off, o); if (kit.clear(pr.x, pr.y, 4)) props.push(pr); }
  // ---- NATURE by theme
  const tree = (x, y, s, o = {}) => ({ kind: 'tree', x, y, s, seed: ((x * 7 + y * 13) | 0) * 2 + 1, ...o });
  const rock = (x, y, s, o = {}) => ({ kind: 'rock', x, y, s, seed: ((x * 5 + y * 11) | 0) + 3, ...o });
  const wallEvery = { forest: 7, snow: 9, alpine: 16, desert: 0 }[theme];
  if (wallEvery) for (let d = 18; d < FIN + 50; d += wallEvery) for (const sd2 of [-1, 1]) {
    if (R() < 0.3) continue; const p = kit.at(d + R() * 3, sd2 * (hw + 9 + R() * 7));
    if (kit.clear(p.x, p.y, 7)) props.push(tree(p.x, p.y, 4.5 + R() * 2.5, { snow: theme === 'snow' || (theme === 'alpine' && R() < 0.3) }));
  }
  const fill = { forest: [520, 0], snow: [320, 30], alpine: [140, 110], desert: [110, 170] }[theme];
  for (let k = 0; k < fill[0]; k++) { const x = (R() - 0.5) * 2 * (FLOOR - 10), y = (R() - 0.5) * 2 * (FLOOR - 10); if (kit.clear(x, y, 9)) props.push(tree(x, y, theme === 'desert' ? 2 + R() * 1.6 : 4 + R() * 2.6, { snow: theme === 'snow', pal: theme === 'desert' ? 'dry' : undefined })); }
  for (let k = 0; k < fill[1]; k++) { const x = (R() - 0.5) * 2 * (FLOOR - 10), y = (R() - 0.5) * 2 * (FLOOR - 10); if (kit.clear(x, y, 6)) props.push(rock(x, y, 2 + R() * 3.5, { pal: theme === 'desert' ? 'red' : undefined, snow: theme === 'snow' })); }
  if (theme === 'alpine') for (let d = 30; d < FIN; d += 9) { if (R() < 0.45) continue; const p = kit.at(d, (R() < 0.5 ? -1 : 1) * (hw + 4 + R() * 4)); if (kit.clear(p.x, p.y, 2.5)) props.push(rock(p.x, p.y, 2 + R() * 2.5)); }
  const nm = NAMES[theme] || NAMES.forest, pre = nm[0][(R() * nm[0].length) | 0], suf = nm[1][(R() * nm[1].length) | 0], name = pre + (pre.endsWith(' ') ? suf[0].toUpperCase() + suf.slice(1) : suf);
  const okProps = props.filter((p) => ['gantry', 'truck', 'chevron', 'flag', 'board', 'crowd', 'marshal'].includes(p.kind) || (p.kind === 'block' && p.w > 10) ? true : kit.clear(p.x, p.y, p.kind === 'tree' ? 7 : 2));
  const paint = [{ kind: 'chequered', x: sub.pts[0].x, y: sub.pts[0].y, len: 1.6, wid: width, rot: sub.pts[0].heading }, (() => { const p = onTrack(sub, FIN, 0, {}); return { kind: 'chequered', x: p.x, y: p.y, len: 1.6, wid: width, rot: p.rot }; })()];
  const lv = {
    id: `gen-${theme}-${len}-${style}-${seed}`, name, gen: { seed, theme, len, style, attempt: used, km: +(FIN / 1000).toFixed(2) },
    base: SURFACES[th.base], subtrack: sub, camber: { maxDeg: 0, refR: 60, crown: 0.03, edge: 5, sections: [] },
    zones: [], bumps: prepBumps(bumps), covers, paint, boards: [], seams: false, cones, props: okProps, barriers, solids: solidsFromProps(okProps), lanes: [],
    stage: { finish: FIN },
    spawn: (() => { const p = onTrack(sub, sub.totalDist - 6, 0, {}); return { x: p.x, y: p.y, heading: p.rot }; })(),
  };
  return lv;
}
// put a generated stage into LEVELS (one slot: the generator's), with the post-passes every level gets; returns the level
export function installStage(lv) {
  finishLevel(lv);
  const i = LEVELS.findIndex((l) => l.gen && !l.fixed);
  if (i < 0) LEVELS.push(lv); else LEVELS[i] = lv;
  return lv;
}
export const GEN_DEFAULT = { seed: 1001, theme: 'forest', len: 'medium', style: 'mixed' };
installStage(genStage(GEN_DEFAULT));
// THE SET STAGES (user, 2026-10-04: "rally stages should be SET, but other events might need a procedural track"): the generator as a
// design tool — seeds picked by tools/stageseeds.mjs (2 km, first attempt so each rebuilds in ~5-35 ms at boot, corners / hairpins /
// crests scored, then looked at), registered as ordinary levels after Killder, the same road every time so it can be learned.
export const SET_STAGES = [
  { seed: 38, theme: 'forest', style: 'tight', name: 'Llanfairsheepdip' }, { seed: 26, theme: 'forest', style: 'mixed', name: 'Pen-y-cowpatt' },
  { seed: 18, theme: 'alpine', style: 'mixed', name: 'Col de Fromage' }, { seed: 37, theme: 'alpine', style: 'tight', name: 'Mont Brakefade' },
  { seed: 33, theme: 'snow', style: 'tight', name: 'Ikeaflatpack' }, { seed: 12, theme: 'snow', style: 'mixed', name: 'Brrrmeatballen' },
  { seed: 21, theme: 'desert', style: 'tight', name: 'Sahara Sandpants' }, { seed: 31, theme: 'desert', style: 'mixed', name: 'Wadi Dusty Bin' },
];
{
  let at = LEVELS.findIndex((l) => l.id === 'killder') + 1 || LEVELS.length;
  for (const o of SET_STAGES) {
    const lv = genStage({ ...o, len: 'medium', attempt: 0 }); if (o.name) lv.name = o.name;
    lv.id = 'stage-' + lv.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, '-').replace(/-$/, ''); lv.fixed = true;
    LEVELS.splice(at++, 0, finishLevel(lv));
  }
}
