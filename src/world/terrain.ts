// terrain.js - the BUMPS, JUMPS AND KERBS and TERRAIN SHAPES sections. Moved verbatim out of
// lab.js.
import { KERB_RIDGE, KERB_RIDGE_L } from "./bounds.ts";
import { LEVEL } from "./state.ts";
import { querySubtrack } from "./tyrewall.ts";
import { rutAt, layersAt } from "./wear.ts";
import type { Bump, Camber, Level, NatCell, Slope, Subtrack, SubtrackHit } from "./types.ts";

// What a bump profile reads. Every kind always has the fields it uses (the "!" below),
// but Bump keeps them optional.
type Shape = Pick<Bump, "r" | "h" | "d" | "len" | "wid" | "amp" | "wave" | "r0" | "R">;
type NatFamily = "small" | "medium" | "rolling" | "whoops";

// ---------------------------------------------------------------------------------------------
// BUMPS, JUMPS AND KERBS (user, 2026-09-28: "and some bumps / jumps / curbs").
//
// All four kinds are nothing but a HEIGHT added to the ground. That is the whole implementation:
// the suspension written for the boundary kerb already turns a height into light wheels, heavy
// landings and real airtime, so a jump needed no new physics at all — only a new shape to drive
// over.
//
// Every profile is SMOOTH where you drive onto it. A step in the height is an infinite ground
// velocity, and the springs answer an infinite velocity with an infinite load. The one deliberate
// exception is a ramp's LIP, where the ground genuinely does fall away — and that case is safe
// because the load clamps at zero and the body goes ballistic, which is exactly what leaving a ramp
// is.
const bumpKind: Record<string, (b: Shape, u: number, v: number) => number> = {
  // a round whoop. Drive over it at any angle; the further off-centre, the less you get.
  hump: (bump: Shape, along: number, lateral: number): number => {
    const dist = Math.hypot(along, lateral) / bump.r!;
    if (dist >= 1) return 0;
    const cosine = Math.cos((Math.PI / 2) * dist);
    return bump.h! * cosine * cosine;
  },
  // a launch ramp: rises the whole way and then stops. u runs 0 at the foot to 1 at the lip.
  ramp: (bump: Shape, along: number, lateral: number): number => {
    const frac = (along + bump.len! / 2) / bump.len!;
    if (frac < 0 || frac > 1) return 0;
    // t^2: gentle at the foot, steepest at the lip
    return bump.h! * frac * frac * across(lateral, bump.wid!);
  },
  // a flat-top table jump: up, along, down. Landable, and the safer of the two jumps.
  table: (bump: Shape, along: number, lateral: number): number => {
    const frac = (along + bump.len! / 2) / bump.len!;
    if (frac < 0 || frac > 1) return 0;
    const ratio = frac < 0.3 ? frac / 0.3 : frac > 0.7 ? (1 - frac) / 0.3 : 1;
    const sine = Math.sin((Math.PI / 2) * ratio);
    return bump.h! * sine * sine * across(lateral, bump.wid!);
  },
  // a rumble kerb strip: a low hump across its width, ridged along its length. Same shape as the
  // boundary kerb, so it shakes the car for the same reason and by the same code.
  kerb: (bump: Shape, along: number, lateral: number): number => {
    const frac = Math.abs(lateral) / (bump.wid! / 2);
    if (frac >= 1 || Math.abs(along) > bump.len! / 2) return 0;
    const cosine = Math.cos((Math.PI / 2) * frac);
    return (bump.h! * cosine * cosine)
      + KERB_RIDGE * cosine * Math.sin((along / KERB_RIDGE_L) * Math.PI * 2);
  },
};
// ---- TERRAIN SHAPES (step 3, 2026-10-03). The user's "vector dips": bumps push the car OUT and
// dips pull it IN, in any direction — that is gravity on the slope, applied in applyGround from
// slopeAt(). Each shape is smooth everywhere.
Object.assign(bumpKind, {
  // a round hollow: the hump turned upside down. d = depth (m), r = radius.
  dip: (bump: Shape, along: number, lateral: number): number =>
    -bumpKind.hump({ r: bump.r, h: bump.d }, along, lateral),
  // WASHBOARD: short ripples across a strip. Felt through the suspension (chatter, grip loss) but
  // deliberately left out of the slope force (NO_SLOPE): a 1 m ripple pushing the car back and
  // forth every step would be a judder.
  washboard: (bump: Shape, along: number, lateral: number): number => {
    if (Math.abs(along) > bump.len! / 2) return 0;
    const frac = 1 - Math.abs(along) / (bump.len! / 2);
    // fade in over the first sixth so entry is not a step
    const ends = Math.min(1, frac * 6);
    return bump.amp! * ends * across(lateral, bump.wid!)
      * (0.5 + 0.5 * Math.sin((along / bump.wave!) * Math.PI * 2));
  },
  // BANKED BOWL, DUG INTO the ground: floor h below ground out to r0, then a wall rising to ground
  // level at R. MEASURED BUG (user: "I think the bowl on the lab is broken"): the first version was
  // RAISED, 2.5 m up a 6 m outer slope, so driving in at 50 km/h was a ramp — 2.17 s of airtime
  // over the whole bowl.
  bowl: (bump: Shape, along: number, lateral: number): number => {
    const dist = Math.hypot(along, lateral);
    if (dist <= bump.r0!) return -bump.h!;
    // S-curve wall (sin^2): flat into the floor AND flat into the rim, steepest part-way up.
    // MEASURED: the t^2 wall was steepest AT the rim (0.42), and driving out at 50 km/h launched
    // 0.96 s over the lip; now the lip has zero slope.
    if (dist <= bump.R!) {
      const frac = (dist - bump.r0!) / (bump.R! - bump.r0!);
      const sn2 = Math.sin((Math.PI / 2) * frac);
      return -bump.h! * (1 - sn2 * sn2);
    }
    return 0;
  },
});
const NO_SLOPE = new Set(['kerb', 'washboard']);   // felt by the suspension only, never a push

// taper to nothing at the edges, so clipping the side of a ramp gives you a wheel on and a wheel
// off
function across(lateral: number, wid: number): number {
  const frac = Math.abs(lateral) / (wid / 2);
  if (frac >= 1) return 0;
  const cosine = Math.cos((Math.PI / 2) * frac);
  return cosine * cosine;
}

// Height of every bump at a point. Bumps ADD, so two crossing kerbs make a crest rather than
// fighting. smooth = the height the SLOPE FORCE reads: no kerb ridges, no washboard ripples, no
// curved kerbs.
const BUMP_CELL = 16, NO_BUMPS: Bump[] = [];
export function bumpAt(x: number, y: number, smooth = false): number {
  const list = LEVEL.bumps;
  // ONE subtrack query per lookup, shared by the banking, the camber and the curved kerbs. MEASURED
  // (2026-10-03, user: "still seeing lag at high speeds"): three separate scans made a Test Track
  // ground tile cost ~12 ms to shade on a PC.
  const track = LEVEL.subtrack;
  const hit = track && (LEVEL.bankAngle || LEVEL.camber || (!smooth && track.curvedKerbs))
    ? querySubtrack(track, x, y) : null;
  let height = bankHeightAt(x, y, hit) + camberHeightAt(x, y, hit) - rutAt(x, y)
    + naturalHeightAt(x, y);
  // BUMP GRID (2026-10-04): Thruston's earth banks took the list to 212 bumps and every height
  // lookup scanned them all — MEASURED ground tile 22 -> 28.7 ms, slow frames 71 -> 103 of 570 at
  // CPU x4. Now only the bumps whose reach touches this cell.
  if (LEVEL._bumpGridOf !== list) {
    LEVEL._bumpGridOf = list;
    const grid = LEVEL._bumpGrid = new Map<number, Bump[]>();
    for (const bump of list) {
      const reach = Math.sqrt(bump.reach2!);
      for (let cellX = Math.floor((bump.x - reach) / BUMP_CELL);
        cellX <= Math.floor((bump.x + reach) / BUMP_CELL); cellX++)
        for (let cellY = Math.floor((bump.y - reach) / BUMP_CELL);
          cellY <= Math.floor((bump.y + reach) / BUMP_CELL); cellY++) {
          const key = cellX * 100003 + cellY;
          const bucket = grid.get(key);
          if (bucket) bucket.push(bump);
          else grid.set(key, [bump]);
        }
    }
  }
  // _bumpGrid was just set above if it was stale
  const cell = LEVEL._bumpGrid!.get(Math.floor(x / BUMP_CELL) * 100003
    + Math.floor(y / BUMP_CELL)) || NO_BUMPS;
  for (let i = 0; i < cell.length; i++) {
    const bump = cell[i];
    if (smooth && NO_SLOPE.has(bump.kind)) continue;
    const dx = x - bump.x, dy = y - bump.y;
    // cheap reject first: this runs twice per axle per physics step
    if (dx * dx + dy * dy > bump.reach2!) continue;
    const along = dx * bump.cos! + dy * bump.sin!;          // along the bump
    const lateral = -dx * bump.sin! + dy * bump.cos!;         // across it
    height += bumpKind[bump.kind](bump, along, lateral);
  }

  // Curved rumble kerbs along corner apexes and exits
  if (!smooth && LEVEL.subtrack && LEVEL.subtrack.curvedKerbs && hit) {
    const halfW = LEVEL.subtrack.width / 2;
    for (let i = 0; i < LEVEL.subtrack.curvedKerbs.length; i++) {
      const kerb = LEVEL.subtrack.curvedKerbs[i];
      if (kerb.side === hit.side && hit.trackDist >= kerb.startDist
        && hit.trackDist <= kerb.endDist) {
        const kerbWidth = kerb.width || 2.4;
        if (hit.dist >= halfW && hit.dist <= halfW + kerbWidth) {
          const frac = (hit.dist - halfW) / kerbWidth;
          const sine = Math.sin(Math.PI * frac);
          height += (kerb.h || 0.11) * sine * sine
            + KERB_RIDGE * sine * Math.sin((hit.trackDist / KERB_RIDGE_L) * Math.PI * 2);
        }
      }
    }
  }

  return height;
}

// BANKING AS REAL HEIGHT (step 3, 2026-10-03; replaces the sideways bank FORCE in applyGround). On
// a level with bankAngle, the track rises across its width in the turns: 0 at the inside edge,
// tan(bank) x width at the outside, then a back slope down to the ground beyond the outer edge (no
// cliff). Turns = |x| beyond BANK_X0, blended in over BANK_BLEND m so the straights stay flat with
// no step. Gravity on that slope (slopeAt) is what pulls a slow car down the banking now. BLEND 60
// m (was 30 at first cut): a 7 m outer edge rising over 30 m is a 23% ramp at 200 km/h — a launch.
// BACK 16 m: at 8 m the back slope was 52 deg.
const BANK_X0 = 100, BANK_BLEND = 60, BANK_BACK = 16;
// bump steer strength (see applyGround). Exported object so tools can sweep it. k 1 (user: "dips
// and whoops should GENTLY affect steering"). MEASURED hands-off through a whole Lab lane, 1.5 m
// off its line at 50 km/h: whoops turn the car 0.6 -> 3.5 deg away, dips 0.3 -> 3.3 deg into them;
// k 2 / 3 gave 4.8 / 5.7 deg.
export const BUMP_STEER = { k: 1 };
export function bankHeightAt(x: number, y: number, qIn?: SubtrackHit | null): number {
  const track = LEVEL.subtrack;
  if (!LEVEL.bankAngle || !track) return 0;
  const weight = Math.min(1, Math.max(0, (Math.abs(x) - BANK_X0) / BANK_BLEND));
  if (weight <= 0) return 0;
  const hit = qIn || querySubtrack(track, x, y);
  if (!Number.isFinite(hit.dist) || hit.seg == null) return 0;
  const halfWidth = track.width / 2;
  // which side is the infield: the oval is convex, so the side facing the origin. q.side 'left' =
  // +normal side.
  const seg = track.segs[hit.seg];
  const nx = -seg.dy, ny = seg.dx;
  const leftIsInside = (nx * -x + ny * -y) >= 0;
  // + toward the OUTSIDE of the turn
  const outward = (hit.side === 'left') === leftIsInside ? -hit.dist : hit.dist;
  const top = Math.tan(LEVEL.bankAngle) * track.width;
  let height;
  if (outward <= -halfWidth) height = 0;
  else if (outward <= halfWidth) height = Math.tan(LEVEL.bankAngle) * (outward + halfWidth);
  else if (outward <= halfWidth + BANK_BACK) {
    const frac = (outward - halfWidth) / BANK_BACK;
    const cosine = Math.cos((Math.PI / 2) * frac);
    height = top * cosine * cosine;
  }
  else height = 0;
  return height * (weight * weight * (3 - 2 * weight));
}
// TRACK CAMBER (user, 2026-10-03: "can the Test Track get cambering across the race surface"; and
// earlier: camber "positive, negative, whether it's useful to drive on, which can also match real
// tracks"). LEVEL.camber = { maxDeg, refR, crown, edge, sections: [{ from, to, deg }] } (from / to
// in metres of track distance; deg signed: + helps you round the corner, - falls away =
// OFF-CAMBER). Default per segment: corners get + camber scaled by tightness (maxDeg at refR or
// tighter), straights a CROWN (centre high, both edges lower — how real circuits drain), and the
// surface eases back to the ground over `edge` m beyond the ribbon. Smoothed along the track so no
// section boundary is a step.
function camberTable(track: Subtrack, cfg: Camber): Float32Array {
  const count = track.pts.length, deg = new Float32Array(count), turn = new Int8Array(count);
  for (let i = 0; i < count; i++) {
    const before = track.pts[(i - 3 + count) % count], after = track.pts[(i + 3) % count];
    let turnAngle = after.heading - before.heading;
    turnAngle = Math.atan2(Math.sin(turnAngle), Math.cos(turnAngle));
    const len = Math.max(1, ((after.dist - before.dist) + track.totalDist) % track.totalDist);
    const radius = len / Math.max(1e-4, Math.abs(turnAngle));
    turn[i] = turnAngle > 0 ? 1 : -1;
    deg[i] = Math.min(cfg.maxDeg, cfg.maxDeg * cfg.refR / radius);
    for (const sec of cfg.sections || [])
      if (track.pts[i].dist >= sec.from && track.pts[i].dist < sec.to) deg[i] = sec.deg;
  }
  // smooth along the track (moving average over +-6 points) so a section boundary is never a step
  const smoothed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let sum = 0;
    for (let offset = -6; offset <= 6; offset++)
      sum += deg[(i + offset + count) % count] * turn[(i + offset + count) % count];
    smoothed[i] = sum / 13;
  }
  return smoothed;   // signed: + = camber toward the inside of a RIGHT turn (+normal side low)
}
function camberHeightAt(x: number, y: number, qIn?: SubtrackHit | null): number {
  const track = LEVEL.subtrack, cfg = LEVEL.camber;
  if (!cfg || !track) return 0;
  if (!track._camber || track._camberCfg !== cfg) {
    track._camber = camberTable(track, cfg);
    track._camberCfg = cfg;
  }
  const hit = qIn || querySubtrack(track, x, y);
  if (!Number.isFinite(hit.dist) || hit.seg == null) return 0;
  const halfWidth = track.width / 2, edge = cfg.edge || 6;
  if (hit.dist > halfWidth + edge) return 0;
  const i = hit.seg, j = (i + 1) % track.pts.length, seg = track.segs[i];
  const frac = Math.max(0, Math.min(1, (hit.trackDist - track.pts[i].dist) / (seg.len || 1)));
  // signed camber here
  const sDeg = track._camber[i] * (1 - frac) + track._camber[j] * frac;
  // offset along +normal
  const offset = hit.side === 'left' ? hit.dist : -hit.dist;
  // + camber lowers the +normal side (inside of a right turn): h = -tan(cam) x offset, zero on the
  // centreline
  const clamped = Math.max(-halfWidth, Math.min(halfWidth, offset));
  // crown fades out as the corner bites
  const crownW = Math.max(0, 1 - Math.abs(sDeg) / Math.max(0.1, cfg.maxDeg));
  let height = -Math.tan((sDeg * Math.PI) / 180) * clamped
    + (cfg.crown || 0) * crownW * (halfWidth - Math.abs(clamped));
  // shift so the LOWEST edge sits at ground level (the surface is built UP from the ground, never
  // dug into it)
  const lowEdge = Math.min(-Math.tan((sDeg * Math.PI) / 180) * halfWidth,
    Math.tan((sDeg * Math.PI) / 180) * halfWidth);
  height -= lowEdge;
  // beyond the ribbon, ease back down to the ground
  if (hit.dist > halfWidth) {
    const edgeFrac = (hit.dist - halfWidth) / edge, cosine = Math.cos((Math.PI / 2) * edgeFrac);
    height *= cosine * cosine;
  }
  return height;
}
// NATURAL GROUND (user, 2026-10-03): "loose surfaces should naturally have some random light vector
// dips and whoops — gravel % more likely to have SMALL dips and bumps, mud MEDIUM AGGRESSIVE dips
// and bumps, grass AVERAGE and ROLLING HILLS vibe, sand WHOOPS or bumps and dips". Four smooth
// noise families, each with a fixed size; every BASE surface sets how much of each it has (metres
// of amplitude). Hard surfaces (tarmac, kerbs, the lab floor) have none. The amplitudes live on a
// NAT_CELL grid, averaged over the cell and interpolated between cells, so where gravel meets
// tarmac the bumps FADE over a few metres instead of stepping (a step is an infinite slope). Seeded
// per level, so a track is the same every visit.
const NAT_CELL = 3;
const NAT_FAMILY = {            // wavelength (m) of each family
  small: 2.5,                   // gravel chatter
  medium: 4.5,                  // mud: medium, aggressive (sharpened)
  rolling: 26,                  // grass: rolling hills (+ a half-size octave)
  whoops: 6,                    // sand: whoops / dunes (squared, so mostly crests)
};
// base id -> { family: amplitude m }
const NAT_SURF: Record<string, Record<string, number>> = {
  gravel: { small: 0.045 }, rally: { small: 0.05 },
  dirt: { small: 0.03, rolling: 0.10 },
  mud: { medium: 0.10 }, thickMud: { medium: 0.15 },
  grass: { rolling: 0.25, small: 0.01 }, grassShort: { rolling: 0.22, small: 0.01 },
  grassLong: { rolling: 0.30, small: 0.015 },
  sand: { whoops: 0.15, small: 0.02 },
  snow: { small: 0.02 },
};
function hash2(i: number, j: number, seed: number): number {
  let mixed = (i * 374761393 + j * 668265263 + seed * 2147483647) | 0;
  mixed = (mixed ^ (mixed >>> 13)) * 1274126177 | 0;
  return ((mixed ^ (mixed >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x: number, y: number, seed: number): number {   // smooth value noise, -1..1
  const i = Math.floor(x), j = Math.floor(y), fracX = x - i, fracY = y - j;
  const smoothX = fracX * fracX * (3 - 2 * fracX), smoothY = fracY * fracY * (3 - 2 * fracY);
  const v00 = hash2(i, j, seed), v10 = hash2(i + 1, j, seed),
    v01 = hash2(i, j + 1, seed), v11 = hash2(i + 1, j + 1, seed);
  return ((v00 * (1 - smoothX) + v10 * smoothX) * (1 - smoothY)
    + (v01 * (1 - smoothX) + v11 * smoothX) * smoothY) * 2 - 1;
}
let natCache = new Map<number, NatCell>(), natLevel: Level | null = null, natSeed = 0;
const NAT_CACHE_MAX = 60000;   // cap on cached cells: the endless highway would grow it forever
// NUMBER keys (perf, 2026-10-03): string keys made every height lookup ~5x slower (0.04 -> 0.7
// us).
function natCell(i: number, j: number): NatCell {
  const key = (i + 32768) * 65536 + (j + 32768);
  let cell = natCache.get(key);
  if (cell) return cell;
  // bounded (memory diet, task 104): cells are a pure function of
  // position and level, so a cleared cell is recomputed identically
  if (natCache.size >= NAT_CACHE_MAX) natCache.clear();
  cell = { small: 0, medium: 0, rolling: 0, whoops: 0 };
  // ONE sample at the cell centre (perf): 9 per cell cost ~1200 surface lookups per new ground tile
  // (tiles 22 -> ~30 ms at CPU x4). The bilinear blend between cell centres is what keeps the edges
  // smooth; the averaging added little.
  const layers = layersAt((i + 0.5) * NAT_CELL, (j + 0.5) * NAT_CELL);
  const surf = NAT_SURF[layers.base];
  // cast: for-in gives string, and the families are the only keys
  if (surf) for (const family in surf) cell[family as NatFamily] += surf[family];
  cell.zero = !(cell.small || cell.medium || cell.rolling || cell.whoops);
  natCache.set(key, cell);
  return cell;
}
function naturalHeightAt(x: number, y: number): number {
  if (natLevel !== LEVEL) {
    natCache = new Map(); natLevel = LEVEL; natSeed = 0;
    for (const char of LEVEL.id) natSeed = (natSeed * 31 + char.charCodeAt(0)) | 0;
  }
  // amplitudes at this point: bilinear between the four surrounding cell CENTRES
  const fracX = x / NAT_CELL - 0.5, fracY = y / NAT_CELL - 0.5,
    i = Math.floor(fracX), j = Math.floor(fracY), blendX = fracX - i, blendY = fracY - j;
  const c00 = natCell(i, j), c10 = natCell(i + 1, j),
    c01 = natCell(i, j + 1), c11 = natCell(i + 1, j + 1);
  // hard ground all round: flat, no noise
  if (c00.zero && c10.zero && c01.zero && c11.zero) return 0;
  // no allocation per call (memory diet, task 104: inline, no amp() closure)
  const ampSmall = (c00.small * (1 - blendX) + c10.small * blendX) * (1 - blendY)
    + (c01.small * (1 - blendX) + c11.small * blendX) * blendY;
  const ampMedium = (c00.medium * (1 - blendX) + c10.medium * blendX) * (1 - blendY)
    + (c01.medium * (1 - blendX) + c11.medium * blendX) * blendY;
  const ampRolling = (c00.rolling * (1 - blendX) + c10.rolling * blendX) * (1 - blendY)
    + (c01.rolling * (1 - blendX) + c11.rolling * blendX) * blendY;
  const ampWhoops = (c00.whoops * (1 - blendX) + c10.whoops * blendX) * (1 - blendY)
    + (c01.whoops * (1 - blendX) + c11.whoops * blendX) * blendY;
  let height = 0;
  if (ampSmall)
    height += ampSmall * vnoise(x / NAT_FAMILY.small, y / NAT_FAMILY.small, natSeed + 1);
  if (ampMedium) {   // sharpened
    const noise = vnoise(x / NAT_FAMILY.medium, y / NAT_FAMILY.medium, natSeed + 2);
    height += ampMedium * noise * (0.6 + 0.8 * noise * noise);
  }
  if (ampRolling)
    height += ampRolling * (
      0.75 * vnoise(x / NAT_FAMILY.rolling, y / NAT_FAMILY.rolling, natSeed + 3)
      + 0.25 * vnoise(x / (NAT_FAMILY.rolling / 2), y / (NAT_FAMILY.rolling / 2), natSeed + 4));
  if (ampWhoops) {   // crests
    const noise = vnoise(x / NAT_FAMILY.whoops, y / NAT_FAMILY.whoops, natSeed + 5);
    height += ampWhoops * (noise * noise * 2 - 0.5);
  }
  return height;
}
export function clearNaturalCache(): void { natCache = new Map(); }

// Gradient of the SMOOTH height (central difference). The slope force is -m g grad(h): bumps push
// OUT, dips pull IN.
export function slopeAt(x: number, y: number): Slope {
  const step = 0.3;
  const gradX = (bumpAt(x + step, y, true) - bumpAt(x - step, y, true)) / (2 * step);
  const gradY = (bumpAt(x, y + step, true) - bumpAt(x, y - step, true)) / (2 * step);
  return { gx: gradX, gy: gradY };
}
export function heightAt(x: number, y: number): number { return bumpAt(x, y, true); }
// What the GROUND LOOKS like (render.ts hill-shading): the FULL height — washboard ripples and kerb
// humps included, so you can see them — but never the per-surface roughness noise, which would
// speckle every tile.
export function visualHeightAt(x: number, y: number): number { return bumpAt(x, y); }
export function visualSlopeAt(x: number, y: number): Slope {
  const step = 0.2;
  return {
    gx: (bumpAt(x + step, y) - bumpAt(x - step, y)) / (2 * step),
    gy: (bumpAt(x, y + step) - bumpAt(x, y - step)) / (2 * step),
  };
}

// Fill in the derived fields a bump needs at runtime, so groundAt never does trigonometry per
// step.
export function prepBumps(list: Bump[]): Bump[] {
  for (const bump of list) {
    const rot = bump.rot || 0;
    bump.cos = Math.cos(rot); bump.sin = Math.sin(rot);
    const reach = bump.kind === 'hump' || bump.kind === 'dip' ? bump.r!
      : bump.kind === 'bowl' ? bump.R! + 1 : Math.max(bump.len!, bump.wid!) / 2 + 1;
    bump.reach2 = reach * reach;
  }
  return list;
}

export function resetNatLevel(): void { natLevel = null; }
