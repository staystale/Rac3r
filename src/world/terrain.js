// terrain.js - the BUMPS, JUMPS AND KERBS and TERRAIN SHAPES sections. Moved verbatim out of lab.js.
import { KERB_RIDGE, KERB_RIDGE_L } from "./bounds.js";
import { LEVEL } from "./state.js";
import { querySubtrack } from "./tyrewall.js";
import { rutAt, layersAt } from "./wear.js";

// ---------------------------------------------------------------------------------------------
// BUMPS, JUMPS AND KERBS (user, 2026-09-28: "and some bumps / jumps / curbs").
//
// All four kinds are nothing but a HEIGHT added to the ground. That is the whole implementation: the
// suspension written for the boundary kerb already turns a height into light wheels, heavy landings and
// real airtime, so a jump needed no new physics at all — only a new shape to drive over.
//
// Every profile is SMOOTH where you drive onto it. A step in the height is an infinite ground velocity,
// and the springs answer an infinite velocity with an infinite load. The one deliberate exception is a
// ramp's LIP, where the ground genuinely does fall away — and that case is safe because the load clamps
// at zero and the body goes ballistic, which is exactly what leaving a ramp is.
const bumpKind = {
  // a round whoop. Drive over it at any angle; the further off-centre, the less you get.
  hump: (b, u, v) => {
    const d = Math.hypot(u, v) / b.r;
    if (d >= 1) return 0;
    const c = Math.cos((Math.PI / 2) * d);
    return b.h * c * c;
  },
  // a launch ramp: rises the whole way and then stops. u runs 0 at the foot to 1 at the lip.
  ramp: (b, u, v) => {
    const t = (u + b.len / 2) / b.len;
    if (t < 0 || t > 1) return 0;
    return b.h * t * t * across(v, b.wid);      // t^2: gentle at the foot, steepest at the lip
  },
  // a flat-top table jump: up, along, down. Landable, and the safer of the two jumps.
  table: (b, u, v) => {
    const t = (u + b.len / 2) / b.len;
    if (t < 0 || t > 1) return 0;
    const r = t < 0.3 ? t / 0.3 : t > 0.7 ? (1 - t) / 0.3 : 1;
    const s = Math.sin((Math.PI / 2) * r);
    return b.h * s * s * across(v, b.wid);
  },
  // a rumble kerb strip: a low hump across its width, ridged along its length. Same shape as the
  // boundary kerb, so it shakes the car for the same reason and by the same code.
  kerb: (b, u, v) => {
    const t = Math.abs(v) / (b.wid / 2);
    if (t >= 1 || Math.abs(u) > b.len / 2) return 0;
    const s = Math.cos((Math.PI / 2) * t);
    return (b.h * s * s) + KERB_RIDGE * s * Math.sin((u / KERB_RIDGE_L) * Math.PI * 2);
  },
};
// ---- TERRAIN SHAPES (step 3, 2026-10-03). The user's "vector dips": bumps push the car OUT and dips pull it IN, in any
// direction — that is gravity on the slope, applied in applyGround from slopeAt(). Each shape is smooth everywhere.
Object.assign(bumpKind, {
  // a round hollow: the hump turned upside down. d = depth (m), r = radius.
  dip: (b, u, v) => -bumpKind.hump({ r: b.r, h: b.d }, u, v),
  // WASHBOARD: short ripples across a strip. Felt through the suspension (chatter, grip loss) but deliberately left out
  // of the slope force (NO_SLOPE): a 1 m ripple pushing the car back and forth every step would be a judder.
  washboard: (b, u, v) => {
    if (Math.abs(u) > b.len / 2) return 0;
    const t = 1 - Math.abs(u) / (b.len / 2);
    const ends = Math.min(1, t * 6);                        // fade in over the first sixth so entry is not a step
    return b.amp * ends * across(v, b.wid) * (0.5 + 0.5 * Math.sin((u / b.wave) * Math.PI * 2));
  },
  // BANKED BOWL, DUG INTO the ground: floor h below ground out to r0, then a wall rising to ground level at R. MEASURED BUG (user: "I think the bowl on the lab is broken"): the first version was
  // RAISED, 2.5 m up a 6 m outer slope, so driving in at 50 km/h was a ramp — 2.17 s of airtime over the whole bowl.
  bowl: (b, u, v) => {
    const d = Math.hypot(u, v);
    if (d <= b.r0) return -b.h;
    // S-curve wall (sin^2): flat into the floor AND flat into the rim, steepest part-way up. MEASURED: the t^2 wall was
    // steepest AT the rim (0.42), and driving out at 50 km/h launched 0.96 s over the lip; now the lip has zero slope.
    if (d <= b.R) { const t = (d - b.r0) / (b.R - b.r0); const sn2 = Math.sin((Math.PI / 2) * t); return -b.h * (1 - sn2 * sn2); }
    return 0;
  },
});
const NO_SLOPE = new Set(['kerb', 'washboard']);   // felt by the suspension only, never a push

// taper to nothing at the edges, so clipping the side of a ramp gives you a wheel on and a wheel off
function across(v, wid) {
  const t = Math.abs(v) / (wid / 2);
  if (t >= 1) return 0;
  const c = Math.cos((Math.PI / 2) * t);
  return c * c;
}

// Height of every bump at a point. Bumps ADD, so two crossing kerbs make a crest rather than fighting.
// smooth = the height the SLOPE FORCE reads: no kerb ridges, no washboard ripples, no curved kerbs.
const BUMP_CELL = 16, NO_BUMPS = [];
export function bumpAt(x, y, smooth = false) {
  const list = LEVEL.bumps;
  // ONE subtrack query per lookup, shared by the banking, the camber and the curved kerbs. MEASURED (2026-10-03, user: "still
  // seeing lag at high speeds"): three separate scans made a Test Track ground tile cost ~12 ms to shade on a PC.
  const st = LEVEL.subtrack;
  const q = st && (LEVEL.bankAngle || LEVEL.camber || (!smooth && st.curvedKerbs)) ? querySubtrack(st, x, y) : null;
  let h = bankHeightAt(x, y, q) + camberHeightAt(x, y, q) - rutAt(x, y) + naturalHeightAt(x, y);
  // BUMP GRID (2026-10-04): Thruston's earth banks took the list to 212 bumps and every height lookup scanned them all —
  // MEASURED ground tile 22 -> 28.7 ms, slow frames 71 -> 103 of 570 at CPU x4. Now only the bumps whose reach touches this cell.
  if (LEVEL._bumpGridOf !== list) {
    LEVEL._bumpGridOf = list; const grid = LEVEL._bumpGrid = new Map();
    for (const b of list) { const r = Math.sqrt(b.reach2);
      for (let cx = Math.floor((b.x - r) / BUMP_CELL); cx <= Math.floor((b.x + r) / BUMP_CELL); cx++)
        for (let cy = Math.floor((b.y - r) / BUMP_CELL); cy <= Math.floor((b.y + r) / BUMP_CELL); cy++) { const k = cx * 100003 + cy; const c = grid.get(k); if (c) c.push(b); else grid.set(k, [b]); } }
  }
  const cell = LEVEL._bumpGrid.get(Math.floor(x / BUMP_CELL) * 100003 + Math.floor(y / BUMP_CELL)) || NO_BUMPS;
  for (let i = 0; i < cell.length; i++) {
    const b = cell[i];
    if (smooth && NO_SLOPE.has(b.kind)) continue;
    const dx = x - b.x, dy = y - b.y;
    // cheap reject first: this runs twice per axle per physics step
    if (dx * dx + dy * dy > b.reach2) continue;
    const u = dx * b.cos + dy * b.sin;          // along the bump
    const v = -dx * b.sin + dy * b.cos;         // across it
    h += bumpKind[b.kind](b, u, v);
  }

  // Curved rumble kerbs along corner apexes and exits
  if (!smooth && LEVEL.subtrack && LEVEL.subtrack.curvedKerbs && q) {
    const halfW = LEVEL.subtrack.width / 2;
    for (let i = 0; i < LEVEL.subtrack.curvedKerbs.length; i++) {
      const k = LEVEL.subtrack.curvedKerbs[i];
      if (k.side === q.side && q.trackDist >= k.startDist && q.trackDist <= k.endDist) {
        const kw = k.width || 2.4;
        if (q.dist >= halfW && q.dist <= halfW + kw) {
          const t = (q.dist - halfW) / kw;
          const s = Math.sin(Math.PI * t);
          h += (k.h || 0.11) * s * s + KERB_RIDGE * s * Math.sin((q.trackDist / KERB_RIDGE_L) * Math.PI * 2);
        }
      }
    }
  }

  return h;
}

// BANKING AS REAL HEIGHT (step 3, 2026-10-03; replaces the sideways bank FORCE in applyGround). On a level with bankAngle,
// the track rises across its width in the turns: 0 at the inside edge, tan(bank) x width at the outside, then a back
// slope down to the ground beyond the outer edge (no cliff). Turns = |x| beyond BANK_X0, blended in over BANK_BLEND m so
// the straights stay flat with no step. Gravity on that slope (slopeAt) is what pulls a slow car down the banking now.
// BLEND 60 m (was 30 at first cut): a 7 m outer edge rising over 30 m is a 23% ramp at 200 km/h — a launch. BACK 16 m:
// at 8 m the back slope was 52 deg.
const BANK_X0 = 100, BANK_BLEND = 60, BANK_BACK = 16;
// bump steer strength (see applyGround). Exported object so tools can sweep it.
// k 1 (user: "dips and whoops should GENTLY affect steering"). MEASURED hands-off through a whole Lab lane, 1.5 m off its
// line at 50 km/h: whoops turn the car 0.6 -> 3.5 deg away, dips 0.3 -> 3.3 deg into them; k 2 / 3 gave 4.8 / 5.7 deg.
export const BUMP_STEER = { k: 1 };
export function bankHeightAt(x, y, qIn) {
  const st = LEVEL.subtrack;
  if (!LEVEL.bankAngle || !st) return 0;
  const w = Math.min(1, Math.max(0, (Math.abs(x) - BANK_X0) / BANK_BLEND));
  if (w <= 0) return 0;
  const q = qIn || querySubtrack(st, x, y);
  if (!Number.isFinite(q.dist) || q.seg == null) return 0;
  const hw = st.width / 2;
  // which side is the infield: the oval is convex, so the side facing the origin. q.side 'left' = +normal side.
  const seg = st.segs[q.seg];
  const nx = -seg.dy, ny = seg.dx;
  const leftIsInside = (nx * -x + ny * -y) >= 0;
  const outward = (q.side === 'left') === leftIsInside ? -q.dist : q.dist;   // + toward the OUTSIDE of the turn
  const top = Math.tan(LEVEL.bankAngle) * st.width;
  let h;
  if (outward <= -hw) h = 0;
  else if (outward <= hw) h = Math.tan(LEVEL.bankAngle) * (outward + hw);
  else if (outward <= hw + BANK_BACK) { const t = (outward - hw) / BANK_BACK; const cc = Math.cos((Math.PI / 2) * t); h = top * cc * cc; }
  else h = 0;
  return h * (w * w * (3 - 2 * w));
}
// TRACK CAMBER (user, 2026-10-03: "can the Test Track get cambering across the race surface"; and earlier: camber "positive,
// negative, whether it's useful to drive on, which can also match real tracks"). LEVEL.camber = { maxDeg, refR, crown, edge,
// sections: [{ from, to, deg }] } (from / to in metres of track distance; deg signed: + helps you round the corner, - falls
// away = OFF-CAMBER). Default per segment: corners get + camber scaled by tightness (maxDeg at refR or tighter), straights
// a CROWN (centre high, both edges lower — how real circuits drain), and the surface eases back to the ground over `edge` m
// beyond the ribbon. Smoothed along the track so no section boundary is a step.
function camberTable(st, cfg) {
  const n = st.pts.length, deg = new Float32Array(n), turn = new Int8Array(n);
  for (let i = 0; i < n; i++) {
    const a0 = st.pts[(i - 3 + n) % n], a1 = st.pts[(i + 3) % n];
    let dh = a1.heading - a0.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    const len = Math.max(1, ((a1.dist - a0.dist) + st.totalDist) % st.totalDist);
    const R = len / Math.max(1e-4, Math.abs(dh));
    turn[i] = dh > 0 ? 1 : -1;
    deg[i] = Math.min(cfg.maxDeg, cfg.maxDeg * cfg.refR / R);
    for (const sec of cfg.sections || []) if (st.pts[i].dist >= sec.from && st.pts[i].dist < sec.to) deg[i] = sec.deg;
  }
  // smooth along the track (moving average over +-6 points) so a section boundary is never a step
  const sm = new Float32Array(n);
  for (let i = 0; i < n; i++) { let t = 0; for (let k = -6; k <= 6; k++) t += deg[(i + k + n) % n] * turn[(i + k + n) % n]; sm[i] = t / 13; }
  return sm;   // signed: + = camber toward the inside of a RIGHT turn (+normal side low)
}
function camberHeightAt(x, y, qIn) {
  const st = LEVEL.subtrack, cfg = LEVEL.camber;
  if (!cfg || !st) return 0;
  if (!st._camber || st._camberCfg !== cfg) { st._camber = camberTable(st, cfg); st._camberCfg = cfg; }
  const q = qIn || querySubtrack(st, x, y);
  if (!Number.isFinite(q.dist) || q.seg == null) return 0;
  const hw = st.width / 2, edge = cfg.edge || 6;
  if (q.dist > hw + edge) return 0;
  const i = q.seg, j = (i + 1) % st.pts.length, seg = st.segs[i];
  const tt = Math.max(0, Math.min(1, (q.trackDist - st.pts[i].dist) / (seg.len || 1)));
  const sDeg = st._camber[i] * (1 - tt) + st._camber[j] * tt;              // signed camber here
  const o = q.side === 'left' ? q.dist : -q.dist;                            // offset along +normal
  // + camber lowers the +normal side (inside of a right turn): h = -tan(cam) x offset, zero on the centreline
  const oc = Math.max(-hw, Math.min(hw, o));
  const crownW = Math.max(0, 1 - Math.abs(sDeg) / Math.max(0.1, cfg.maxDeg));   // crown fades out as the corner bites
  let h = -Math.tan((sDeg * Math.PI) / 180) * oc + (cfg.crown || 0) * crownW * (hw - Math.abs(oc));
  // shift so the LOWEST edge sits at ground level (the surface is built UP from the ground, never dug into it)
  const lowEdge = Math.min(-Math.tan((sDeg * Math.PI) / 180) * hw, Math.tan((sDeg * Math.PI) / 180) * hw);
  h -= lowEdge;
  // beyond the ribbon, ease back down to the ground
  if (q.dist > hw) { const tE = (q.dist - hw) / edge, c = Math.cos((Math.PI / 2) * tE); h *= c * c; }
  return h;
}
// NATURAL GROUND (user, 2026-10-03): "loose surfaces should naturally have some random light vector dips and whoops — gravel %
// more likely to have SMALL dips and bumps, mud MEDIUM AGGRESSIVE dips and bumps, grass AVERAGE and ROLLING HILLS vibe, sand
// WHOOPS or bumps and dips". Four smooth noise families, each with a fixed size; every BASE surface sets how much of each
// it has (metres of amplitude). Hard surfaces (tarmac, kerbs, the lab floor) have none. The amplitudes live on a NAT_CELL
// grid, averaged over the cell and interpolated between cells, so where gravel meets tarmac the bumps FADE over a few
// metres instead of stepping (a step is an infinite slope). Seeded per level, so a track is the same every visit.
const NAT_CELL = 3;
const NAT_FAMILY = {            // wavelength (m) of each family
  small: 2.5,                   // gravel chatter
  medium: 4.5,                  // mud: medium, aggressive (sharpened)
  rolling: 26,                  // grass: rolling hills (+ a half-size octave)
  whoops: 6,                    // sand: whoops / dunes (squared, so mostly crests)
};
const NAT_SURF = {              // base id -> { family: amplitude m }
  gravel: { small: 0.045 }, rally: { small: 0.05 },
  dirt: { small: 0.03, rolling: 0.10 },
  mud: { medium: 0.10 }, thickMud: { medium: 0.15 },
  grass: { rolling: 0.25, small: 0.01 }, grassShort: { rolling: 0.22, small: 0.01 }, grassLong: { rolling: 0.30, small: 0.015 },
  sand: { whoops: 0.15, small: 0.02 },
  snow: { small: 0.02 },
};
function hash2(i, j, seed) { let h = (i * 374761393 + j * 668265263 + seed * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y, seed) {   // smooth value noise, -1..1
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(i, j, seed), b = hash2(i + 1, j, seed), c = hash2(i, j + 1, seed), d = hash2(i + 1, j + 1, seed);
  return ((a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v) * 2 - 1;
}
let natCache = new Map(), natLevel = null, natSeed = 0;
// NUMBER keys (perf, 2026-10-03): string keys made every height lookup ~5x slower (0.04 -> 0.7 us).
function natCell(i, j) {
  const key = (i + 32768) * 65536 + (j + 32768);
  let c = natCache.get(key);
  if (c) return c;
  c = { small: 0, medium: 0, rolling: 0, whoops: 0 };
  // ONE sample at the cell centre (perf): 9 per cell cost ~1200 surface lookups per new ground tile (tiles 22 -> ~30 ms at
  // CPU x4). The bilinear blend between cell centres is what keeps the edges smooth; the averaging added little.
  const L = layersAt((i + 0.5) * NAT_CELL, (j + 0.5) * NAT_CELL);
  const p = NAT_SURF[L.base];
  if (p) for (const f in p) c[f] += p[f];
  c.zero = !(c.small || c.medium || c.rolling || c.whoops);
  natCache.set(key, c);
  return c;
}
function naturalHeightAt(x, y) {
  if (natLevel !== LEVEL) { natCache = new Map(); natLevel = LEVEL; natSeed = 0; for (const ch of LEVEL.id) natSeed = (natSeed * 31 + ch.charCodeAt(0)) | 0; }
  // amplitudes at this point: bilinear between the four surrounding cell CENTRES
  const fx = x / NAT_CELL - 0.5, fy = y / NAT_CELL - 0.5, i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j;
  const c00 = natCell(i, j), c10 = natCell(i + 1, j), c01 = natCell(i, j + 1), c11 = natCell(i + 1, j + 1);
  if (c00.zero && c10.zero && c01.zero && c11.zero) return 0;          // hard ground all round: flat, no noise
  const amp = (f) => (c00[f] * (1 - tx) + c10[f] * tx) * (1 - ty) + (c01[f] * (1 - tx) + c11[f] * tx) * ty;
  let h = 0;
  const aS = amp('small'), aM = amp('medium'), aR = amp('rolling'), aW = amp('whoops');
  if (aS) h += aS * vnoise(x / NAT_FAMILY.small, y / NAT_FAMILY.small, natSeed + 1);
  if (aM) { const n = vnoise(x / NAT_FAMILY.medium, y / NAT_FAMILY.medium, natSeed + 2); h += aM * n * (0.6 + 0.8 * n * n); }   // sharpened
  if (aR) h += aR * (0.75 * vnoise(x / NAT_FAMILY.rolling, y / NAT_FAMILY.rolling, natSeed + 3) + 0.25 * vnoise(x / (NAT_FAMILY.rolling / 2), y / (NAT_FAMILY.rolling / 2), natSeed + 4));
  if (aW) { const n = vnoise(x / NAT_FAMILY.whoops, y / NAT_FAMILY.whoops, natSeed + 5); h += aW * (n * n * 2 - 0.5); }      // crests
  return h;
}
export function clearNaturalCache() { natCache = new Map(); }

// Gradient of the SMOOTH height (central difference). The slope force is -m g grad(h): bumps push OUT, dips pull IN.
export function slopeAt(x, y) {
  const e = 0.3;
  const gx = (bumpAt(x + e, y, true) - bumpAt(x - e, y, true)) / (2 * e);
  const gy = (bumpAt(x, y + e, true) - bumpAt(x, y - e, true)) / (2 * e);
  return { gx, gy };
}
export function heightAt(x, y) { return bumpAt(x, y, true); }
// What the GROUND LOOKS like (render.js hill-shading): the FULL height — washboard ripples and kerb humps included, so
// you can see them — but never the per-surface roughness noise, which would speckle every tile.
export function visualHeightAt(x, y) { return bumpAt(x, y); }
export function visualSlopeAt(x, y) {
  const e = 0.2;
  return { gx: (bumpAt(x + e, y) - bumpAt(x - e, y)) / (2 * e), gy: (bumpAt(x, y + e) - bumpAt(x, y - e)) / (2 * e) };
}

// Fill in the derived fields a bump needs at runtime, so groundAt never does trigonometry per step.
export function prepBumps(list) {
  for (const b of list) {
    const rot = b.rot || 0;
    b.cos = Math.cos(rot); b.sin = Math.sin(rot);
    const reach = b.kind === 'hump' || b.kind === 'dip' ? b.r : b.kind === 'bowl' ? b.R + 1 : Math.max(b.len, b.wid) / 2 + 1;
    b.reach2 = reach * reach;
  }
  return list;
}

export function resetNatLevel() { natLevel = null; }
