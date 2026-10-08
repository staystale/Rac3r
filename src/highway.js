// highway.js — HIGHWAY TO HULL: the ENDLESS motorway. User, 2026-10-05: "how about an infinite highway level with procedural turns and
// terrain". v2 THE TREADMILL (user, 2026-10-05: "act like a treadmill ... always line up nicely to the previous section ... spawn ahead
// and vanish behind, always off screen ... the pace is the player's car so it can never drive off the screen ... going backwards should
// reset you ... top to bottom on mobile / PC"; camera stays FIXED and upright, "more extreme on the angle but it should vary obviously").
// v1 (wandered in any compass direction, curvature stepped 0 -> 1/R) is in _archive/pre-treadmill/.
//
// HOW: the road is generated AHEAD of you and dropped BEHIND, in a WINDOW (AHEAD 1100 / BEHIND 450 m — both far past the edge of the
// view, which is at most ~170 m tall). Every time the window moves the road's subtrack is rebuilt from the window's points, its loop
// closed by ONE ghost segment (lab.js ghostSegment: never drawn, never road). Distances in the rebuilt subtrack are relative to the
// window start: stepHighway returns how far that start moved, and main.js shifts what it remembers (the reset point) by it.
// UP THE SCREEN: the heading never strays more than cfg.maxDeg from straight UP (-y), so the road always climbs the screen and cannot
// cross itself. SMOOTH JOINS: every element starts and ends at ZERO curvature and ramps linearly in between (a clothoid), so heading AND
// curvature are continuous across every join — straight -> sweeper -> S-bend -> straight, no kinks, no sudden steering.
// LANES are config (HW_PRESETS): a UK motorway, a wide interstate, a skinny dual carriageway — the same generator for later flavour levels.
import { createSubtrack, ghostSegment, SURFACES, LEVELS, prepBumps, prepBarriersOf, onTrack, clearNaturalCache, solidsFromProps, zoneSurfaceAt, pruneWear } from './lab.js';

// lanes / laneW / shoulder (left, hard shoulder; a solid line inside it when >= 2 m) / edge (right margin) in m; maxDeg off straight up;
// sweep / bend = radius ranges (m); pStraight / pBend = chance an element is a straight / a tight bend (else a sweeper)
export const HW_PRESETS = {
  motorway:   { lanes: 3, laneW: 3.65, shoulder: 3.3, edge: 0.7, maxDeg: 60, sweep: [350, 900], bend: [180, 300], pStraight: 0.34, pBend: 0.2 },
  interstate: { lanes: 4, laneW: 3.7, shoulder: 3.0, edge: 1.2, maxDeg: 45, sweep: [600, 1400], bend: [350, 500], pStraight: 0.45, pBend: 0.1 },
  dual:       { lanes: 2, laneW: 3.4, shoulder: 0.6, edge: 0.6, maxDeg: 60, sweep: [250, 600], bend: [120, 200], pStraight: 0.3, pBend: 0.25 },
  // WALLED IN (user, 2026-10-05: "some levels that use this mechanic should be more walled in"): `walls` = a continuous barrier kind
  // both sides, `wallGap` m off the road edge; no trees / barns inside the walls
  walled:     { lanes: 3, laneW: 3.65, shoulder: 1.0, edge: 1.0, maxDeg: 50, sweep: [400, 900], bend: [220, 320], pStraight: 0.3, pBend: 0.2, walls: 'wall', wallGap: 1.2 },
};
export const HW_NAMES = { motorway: 'MOTORWAY', interstate: 'INTERSTATE', dual: 'DUAL C/WAY', walled: 'WALLED' };
// SPAWN_S 40 -> 300 (MEASURED 2026-10-05, treadmillcheck: the road's raw START was only 40 m behind the car at spawn, inside a zoomed-out
// view); K_RATE = the fastest curvature change, 1/m per m (a clothoid; 5e-5 = a 0 -> R 200 ramp over 100 m)
const STEP = 4, AHEAD = 1100, BEHIND = 450, SPAWN_S = 300, UP = -Math.PI / 2, K_RATE = 5e-5;
// THE GUARD (user: "go backwards should reset you"): rolling BACK down the road faster than BACK_V for BACK_T s, or BACK_M m behind the
// furthest you have got, or OFF_M m past the road edge (out of the scenery band, where the treadmill has no road on screen) -> put back
// in the LEFT lane at the furthest point, with a HUD notice saying why (never unexplained, CLAUDE.md §1)
// GOING WIDE (user, 2026-10-05: "can going wide be WIDER / have a TIMER so you have a chance to return"): was a hard reset 35 m past
// the edge. Now OFF_SOFT m past the edge starts an OFF_T s countdown on the HUD (back within it = cancelled); only OFF_HARD m out
// resets at once (the road would be leaving the view).
// LONGER + HELD NEAR THE ROAD (user, 2026-10-06: "the off road timer should be longer / turn off if youre close to the road (about to get
// back)"): OFF_T 6 -> 10 s; it does not run while you are within OFF_NEAR m of the edge or heading back to it faster than BACK_IN m/s.
const BACK_V = 3, BACK_T = 1.2, BACK_M = 30, OFF_SOFT = 8, OFF_T = 10, OFF_HARD = 70, OFF_NEAR = 16, BACK_IN = 1.5;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const rng = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
// SILLY SIGNS (the distance to Hull goes UP — you never get there)
const SIGNS = ['SERVICES 2 MI (CLOSED)', 'SPEED CAMERA (BROKEN)', 'NO CHIPS FOR 300 MI', 'CONES NEXT 40 MI', 'WELCOME TO NOWHERE', 'HULL: TWINNED WITH HULL',
  'ARE WE NEARLY THERE?', 'BEWARE OF THE SHEEP', 'ROADWORKS ENDED 1987', 'SLOW DOWN (OR DON\'T)', 'SKID PAN 5 MI', 'LAST TOILET: BEHIND YOU'];

// lateral offsets from the centreline: - = the driver's LEFT (the -normal side; lab.js normals point to the driver's right)
export function laneGeo(cfg) {
  const width = cfg.shoulder + cfg.lanes * cfg.laneW + cfg.edge, hw = width / 2, base = -hw + cfg.shoulder;
  return { width, hw,
    centres: Array.from({ length: cfg.lanes }, (_, i) => base + cfg.laneW * (i + 0.5)),
    dashes: Array.from({ length: cfg.lanes - 1 }, (_, k) => base + cfg.laneW * (k + 1)),
    solid: cfg.shoulder >= 2 ? [base] : [] };
}
function stateOf(lv) { return lv._hw; }
// the next road element: a STRAIGHT, a SWEEPER or a tighter BEND. A curve turns back toward straight-up once the heading has wandered
// past half the limit, and its total turn is capped so the heading never passes the limit; turning back it may swing right across to
// the other side (the "vary obviously" swings).
// LEAN TARGET (user, 2026-10-05, phone: "it always aims diagonally LEFT — it should go left AND right and vary"). MEASURED
// (tools/headingcheck): the old rule only turned back past HALF the limit, so the road could sit on one side for km — the live seed
// leaned LEFT (-16..-58 deg) from 0.5 to 4.5 km, seed 7 for 12.9 km. Now the road steers toward a TARGET LEAN that ALTERNATES sides
// (35-100 % of the limit) and is held for 0.5-1.6 km; near the target it runs straight or throws a small S-wiggle.
function nextElement(st, cfg) {
  // the road's SHAPE has its own stream (st.grnd, 2026-10-06): it used to share st.rnd with the dressing, so every scenery change
  // re-rolled the road (MEASURED: moving the slips / bridges to their own stream moved seed 4242's road at 6 km by 2 km sideways)
  const R = st.grnd, max = cfg.maxDeg * Math.PI / 180, off = wrap(st.hdg - UP);
  if (st.s >= st.tUntil) { st.tSide = -(st.tSide || (R() < 0.5 ? 1 : -1)); st.target = st.tSide * (0.35 + 0.65 * R()) * max * 0.95; st.tUntil = st.s + 500 + R() * 1100; }
  const gap = st.target - off, near = Math.abs(gap) < 4 * Math.PI / 180;
  if (near && R() < cfg.pStraight * 1.6) return { len: 120 + R() * 380, k: 0, ramp: 0, hold: 0 };
  const bend = R() < cfg.pBend, [r0, r1] = bend ? cfg.bend : cfg.sweep, rad = r0 + R() * (r1 - r0);
  // toward the target (the whole gap, or in two bites if it is big); near it, a wiggle to whichever side has room
  let dir, A;
  if (!near) { dir = Math.sign(gap); A = Math.abs(gap) > 50 * Math.PI / 180 && R() < 0.5 ? Math.abs(gap) * 0.55 : Math.abs(gap); }
  else { dir = R() < 0.5 ? 1 : -1; if (Math.abs(off + dir * 0.2) > max) dir = -dir; A = (6 + R() * 10) * Math.PI / 180; }
  A = Math.min(A, Math.max(0.02, max - dir * off));
  // total turn = k * (ramp + hold); length = 2 ramp + hold. The RAMP is long enough that curvature changes no faster than K_RATE per m
  // (MEASURED 2026-10-05, tools/treadmillcheck: a 30 m minimum ramp gave the dual carriageway's R 120-200 bends a 5.7e-4 jump per 4 m
  // step and the bench driver ran wide out of an S-bend); a turn too small for that ramp is made WIDER (lower k), never sharper.
  let k = 1 / rad, ramp = Math.max(k / K_RATE, Math.min(160, A * rad * 0.35));
  if (k * ramp > A) { ramp = Math.max(ramp * 0.5, Math.sqrt(A / K_RATE)); k = Math.min(k, A / ramp); }
  const hold = Math.max(0, A / k - ramp);
  return { len: 2 * ramp + hold, k: dir * k, ramp, hold };
}
const curvAt = (e, u) => (!e.k ? 0 : u < e.ramp ? e.k * u / e.ramp : u < e.ramp + e.hold ? e.k : e.k * Math.max(0, e.len - u) / e.ramp);
function growTo(lv, sTarget) {
  const st = stateOf(lv);
  while (st.s < sTarget) {
    if (!st.plan.length) st.plan.push(nextElement(st, lv._cfg));
    const e = st.plan[0], u = e.done || 0;
    // midpoint curvature over the step: exact for a linear ramp, so the heading lands exactly where the element says
    const dh = curvAt(e, u + STEP / 2) * STEP;
    st.hdg += dh / 2; st.x += Math.cos(st.hdg) * STEP; st.y += Math.sin(st.hdg) * STEP; st.hdg += dh / 2; st.s += STEP;
    e.done = u + STEP;
    st.pts.push({ x: st.x, y: st.y, s: st.s, curv: curvAt(e, e.done) });
    if (e.done >= e.len - 1e-6) st.plan.shift();
  }
}
// ---- SLIP ROADS, BRIDGES, CHEEKY EXTRAS. Each is ONE prop (render.js draws it, physics reads it): no new system.
// OFF-SLIP (kind 'slip'): leaves the LEFT edge (the hard shoulder side) at SLIP_DEG, a tapering lane 5 m wide, SLIP_LEN m long, ending
// in a field gate; its surface is tarmac (lab.js zoneAt reads lv.lanes - the existing pit-lane ribbons), a SLIP sign + a countdown
// board (3 / 2 / 1 bars) before it. Driving up it is off the motorway (the guard's OFF countdown applies, by design: it goes nowhere).
// BRIDGES (kind 'bridge'): drawn OVER everything (render.js OVERHEAD), deck across the road at an angle, with what it carries:
// 'road' (a lane + a car or two, parapets), 'rail' (sleepers + rails, no trains), 'foot' (narrow, people). UNDER the motorway:
// kind 'river' (water band across, the motorway on a viaduct: parapets both sides) - drawn under the road, never on it.
// Only their PIERS / abutments are solid, and those stand SLIP_CLEAR m outside the tarmac (+ off the verge strip the AI dodges on).
// EXTRAS (rare): a COW on a road bridge, a CONE on a footbridge, a small BOAT stuck under a river bridge, a SMILEY SOLAR FARM.
// v2 (user, 2026-10-06: "bridges / slip roads should extend off the screen ... slip roads should lead off screen not just stop, although
// some can... and some can follow along side the main motorway and has a chance to rejoin, as a secret chance path"; "all the types of
// highway should have bridges and slip roads you can take"; "make the cars n stuff move across if you can"):
// - every off-slip looks the same from the motorway (signs, exit board). 1 in 4 stops at a gate after SLIP_LEN; 1 in 2 runs LONG
//   (SLIP_LONG m, curving away) to a gate off screen; 1 in 4 is the SECRET SIDE ROAD (sideStep): alongside, SIDE_GAP m out, following
//   the motorway's bends, then merging back into the hard shoulder. The side road counts as ON the road (highwayGuard); on any other
//   slip the off-road countdown waits and only the far-out reset ends it ("EXIT TAKEN").
// - road / rail / foot bridges get APPROACHES (approaches()): a lane ribbon (tarmac / gravel ballast / dirt path) APP_LEN m out each side
//   along the deck axis; render.js drawBridge draws their markings and the MOVING cars / walkers / trains (wall clock, no physics).
// - a RIVER (river()) is a real 'wet' COVER (the same water as every puddle: grip, spray, drawn into the ground tiles) with dirt banks
//   (zones), cut out where the motorway crosses on its parapets (cover.cut: lab.js coverAt + render.js coverCells), APP_LEN m each side.
// - anything long that leaves the road (approach, river, long slip) is CUT SHORT where the road later swings back across it (cuts).
// - the WALLED preset gets them too: a gap in the left wall / armco where a slip leaves or the side road runs (P[j].gapL).
// All the new random choices draw from st.xrnd, so the road's own shape stream (st.rnd) is unchanged by them.
const SLIP_EVERY = [2000, 4000], BRIDGE_EVERY = [1100, 2400], SLIP_LEN = 150, SLIP_DEG = 9, SLIP_W = 5, PIER = 6;
const SIDE_W_HALF = 2.5, SLIP_LONG = [300, 420], SIDE_GAP = 14, SIDE_OUT = 140, SIDE_IN = 140, SIDE_RUN = [250, 750], APP_LEN = 150, APP_STEP = 8;
const straightAt = (P, i, n, m = n) => { for (let j = Math.max(0, i - n); j < Math.min(P.length, i + m); j++) if (Math.abs(P[j].curv || 0) > 1 / 900) return false; return true; };
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
// KEEP-OUT areas for scenery (trees, rocks, barns, solar farms): rects { x, y, ax, ay (unit axis), hu, hv }
function blocked(keep, x, y, r) {
  for (const k of keep) {
    const dx = x - k.x, dy = y - k.y, u = dx * k.ax + dy * k.ay, v = -dx * k.ay + dy * k.ax;
    if (Math.abs(u) < k.hu + r && Math.abs(v) < k.hv + r) return true;
  }
  return false;
}
const SCENERY = { tree: 3, rock: 3, block: 8, solarfarm: 16 };
function keepOut(lv, k, s) {
  // a feature that needs the GROUND (approach, river, slip) drops any field / village under it, whole (scenery, fieldsA below)
  if (k.field == null) clearFields(lv, k);
  k._s = s; lv._hw.keep.push(k);
  const kept = lv.props.filter((pr) => !SCENERY[pr.kind] || !blocked([k], pr.x, pr.y, SCENERY[pr.kind]));
  if (kept.length !== lv.props.length) { lv.props.length = 0; lv.props.push(...kept); }
}
// CUT SHORT. c = { pts (outward polyline, truncated in place), s, w, skip: [s0, s1] (road distances never tested: its own stretch),
// after() }. A road point within reach of a polyline point (k >= 1) cuts the polyline before that point.
const cutSkips = (c, s) => s >= c.skip[0] && s <= c.skip[1];
function cutBy(lv, c, x, y) {
  const thr = (lv._hw.geo.hw + c.w / 2 + 3) ** 2, P = c.pts;
  for (let k = 1; k < P.length; k++) if ((P[k][0] - x) ** 2 + (P[k][1] - y) ** 2 < thr) { P.length = k; c.after(); return; }
}
function addCut(lv, c) {
  const st = lv._hw; c._s = c.s; st.cuts.push(c);
  for (let j = 0; j < st.pts.length; j += 2) if (!cutSkips(c, st.pts[j].s)) cutBy(lv, c, st.pts[j].x, st.pts[j].y);
}
// THE SECRET SIDE ROAD, one road point at a time (built with the road, so it follows every bend): stores its centre's offset to the
// LEFT of the centreline as P[i].sideOff (the guard reads it). Pieces are flushed at the end of each dress() call (sideFlush).
function sideStep(lv, i, at) {
  const st = lv._hw, sd = st.side; if (!sd) return;
  const P = st.pts, d = P[i].s - sd.s0, hw = st.geo.hw, total = SIDE_OUT + sd.run + SIDE_IN;
  if (d > total) { sideFlush(lv, true); st.side = null; st.nextBridge = Math.max(st.nextBridge, P[i].s + 150); return; }
  const k = d < SIDE_OUT ? ease(d / SIDE_OUT) : d < SIDE_OUT + sd.run ? 1 : 1 - ease((d - SIDE_OUT - sd.run) / SIDE_IN);
  const off = hw - 2.6 + (SIDE_GAP + 2.6) * k;
  P[i].sideOff = off; P[i].gapL = 1;
  if (i % 3 === 0 || d + STEP > total) { const p = at(i, -off); sd.pts.push([p.x, p.y]); if (off > hw + 2.5) sd.mpts.push([p.x, p.y]); }
  // ~100 m pieces, so each is dropped behind with its own stretch of road (one long piece would vanish while its end was on screen)
  if (sd.pts.length >= 9) sideFlush(lv, false, P[i].s);
}
function sideFlush(lv, end, sNext) {
  const st = lv._hw, sd = st.side; if (!sd) return;
  if (sd.pts.length >= 2) lv.lanes.push({ pts: sd.pts, width: SLIP_W, surface: SURFACES.tarmac, _s: sd.sPiece });
  // its edge lines (render.js drawSlip), only where it has left the motorway's tarmac
  if (sd.mpts.length >= 2) lv.props.push({ kind: 'slip', line: sd.mpts, w: SLIP_W, nose: false, x: sd.mpts[0][0], y: sd.mpts[0][1], _s: sd.sPiece });
  // the next piece starts on this one's last point (no seam); sPiece = the road distance it is dropped behind with
  const last = sd.pts[sd.pts.length - 1], lastM = sd.mpts[sd.mpts.length - 1];
  sd.pts = end || !last ? [] : [last]; sd.mpts = end || !lastM ? [] : [lastM]; sd.sPiece = sNext ?? st.pts[st.pts.length - 1].s;
}
// a bridge's APPROACHES: straight on along the deck axis from the outer face of each abutment (cut short where the road comes back)
function approaches(lv, o, s) {
  const half = o.wid / 2, c = o.carries, ax = Math.cos(o.rot), ay = Math.sin(o.rot);
  const w = c === 'road' ? 7 : c === 'rail' ? 5.5 : 2.4, surface = c === 'road' ? SURFACES.tarmac : c === 'rail' ? SURFACES.gravel : SURFACES.dirt;
  o.appL = [APP_LEN, APP_LEN]; o.appW = w; o.reach = half + 3 + APP_LEN;
  keepOut(lv, { x: o.x, y: o.y, ax, ay, hu: half + 4 + APP_LEN, hv: w / 2 + 4 }, s);
  [-1, 1].forEach((sg, k) => {
    const pts = []; for (let u = 0; u <= APP_LEN + 1e-6; u += APP_STEP) { const d = sg * (half + 3 + u); pts.push([o.x + ax * d, o.y + ay * d]); }
    const lane = { pts, width: w, surface, _s: s }; lv.lanes.push(lane);
    addCut(lv, { pts, s, w, skip: [s - 80, s + 80], after: () => { lane._segs = null; o.appL[k] = Math.max(0, (pts.length - 1) * APP_STEP); } });
  });
}
// a RIVER under the motorway: per side, one water cover + two dirt bank strips, from just inside the parapet to APP_LEN m beyond it.
// The cover's `cut` removes the part under the motorway exactly (lab.js coverAt + render.js coverCells): in the river's frame the road
// edges are u = v tan(skew) +- e.
function river(lv, o, s) {
  const st = lv._hw, ww = o.ww, tn = Math.tan(o.skew), e = o.roadHw / Math.cos(o.skew), ax = Math.cos(o.rot), ay = Math.sin(o.rot);
  const e0 = Math.max(1, e - Math.abs(tn) * (ww / 2 + 1.2) - 0.5);
  o.reach = e + APP_LEN;
  keepOut(lv, { x: o.x, y: o.y, ax, ay, hu: e + APP_LEN + 2, hv: ww / 2 + 5 }, s);
  for (const sg of [-1, 1]) {
    const water = { cover: 'wet', shape: 'rect', rot: o.rot, h: ww, cut: { ox: o.x, oy: o.y, tn, e }, _s: s };
    const banks = [-1, 1].map((sv) => ({ surface: SURFACES.dirt, rot: o.rot, h: 1.2, _s: s, sv }));
    const put = (L) => {
      const uc = sg * (e0 + L / 2);
      Object.assign(water, { x: o.x + ax * uc, y: o.y + ay * uc, w: L }); delete water._cells;
      // the banks start at the parapet line (never on the motorway's tarmac)
      for (const b of banks) { const v = b.sv * (ww / 2 + 0.6), ub = sg * (e + Math.abs(tn) * (ww / 2 + 1.2) + (L - (e - e0)) / 2); Object.assign(b, { x: o.x + ax * ub - ay * v, y: o.y + ay * ub + ax * v, w: Math.max(0.5, L - (e - e0)) }); }
      st.coversDirty = true;
    };
    put(e - e0 + APP_LEN); st.covers.push(water); lv.zones.push(...banks);
    const pts = []; for (let u = 0; u <= APP_LEN + 1e-6; u += 10) { const d = sg * (e + u); pts.push([o.x + ax * d, o.y + ay * d]); }
    addCut(lv, { pts, s, w: ww, skip: [s - 80, s + 80], after: () => put(Math.max(0.5, e - e0 + 10 * (pts.length - 1) - 6)) });
  }
}
// the level's covers = the highway's own (rivers) + the level's generated inclusions; a NEW array so render.js re-merges them
function syncCovers(lv) {
  const st = lv._hw; st.coversDirty = false;
  lv._coversBase = st.covers; lv.covers = [...st.covers, ...((lv._incl && lv._incl.covers) || [])];
}
// ---- SCENERY v2 (user, 2026-10-06: "i thought we were going to vary sceneary along side the road more like farms or long grass hedges and
// small towns"; "yeah scenery too please"). In the FARM stretches: a PATCHWORK of FIELDS each side - rotated zones (lab.js zoneAt /
// render.js drawZones, so what you see is what you drive on): WHEAT and RAPESEED (drive as long grass, drawn as crops: zone.art), MEADOW
// (long grass), PASTURE (grass, sheep / cows), PLOUGHED (dirt, furrows), now and then a FARMYARD (gravel, barns, bales). Each is ringed by
// a LONG GRASS border (HEDGE_W m, a zone you drive through - user, 2026-10-06: "hedges around fields ... should be long grass"; the
// first cut was a solid 'hedge' barrier, which beached spun racers: pacesuite 2/9 -> 3/9 BAD), a tree or two in it. Now and then a VILLAGE: a lane following
// the road ~40 m out, houses both sides, a church. Each field / village is a keep rect in st.keep with a `field` id: anything placed
// LATER that needs the ground (a bridge approach, a river, a slip) drops it whole (dropField); later scenery avoids it (blocked).
// The left side starts past the secret side road's band. Random choices: st.frnd (own stream). Cost per field: one zone + 2 polylines.
const FIELD_T = [['wheat', 0.24], ['plough', 0.18], ['rapeseed', 0.12], ['meadow', 0.2], ['pasture', 0.18], ['yard', 0.08]];
// [physics surface, look]. Looks REUSE the grass / long grass / mud textures, recoloured (user: "jsut reuse mud and grass or long grass
// textures for field, and maybe colour them"; render.js SURFACE_ART wheat / rapeseed / pastureG / plough). Ploughed = MUD: look = grip.
const FIELD_SURF = { wheat: ['grassLong', 'wheat'], rapeseed: ['grassLong', 'rapeseed'], meadow: ['grassLong', null], plough: ['mud', 'plough'], pasture: ['grass', 'pastureG'], yard: ['gravel', null] };
const HEDGE_W = 2.5;
const ROOFS = ['#8a3a2e', '#9a4a36', '#6e6a5e', '#5b626b', '#7a5a48', '#8a3a2e'];
// SAT overlap of two keep rects { x, y, ax, ay (unit axis), hu, hv }
function overlap(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  for (const [ux, uy] of [[a.ax, a.ay], [-a.ay, a.ax], [b.ax, b.ay], [-b.ay, b.ax]]) {
    const ra = a.hu * Math.abs(a.ax * ux + a.ay * uy) + a.hv * Math.abs(-a.ay * ux + a.ax * uy);
    const rb = b.hu * Math.abs(b.ax * ux + b.ay * uy) + b.hv * Math.abs(-b.ay * ux + b.ax * uy);
    if (Math.abs(dx * ux + dy * uy) > ra + rb) return false;
  }
  return true;
}
// a later feature k (a keep rect) that needs the ground: drop every field / village it overlaps, whole
function clearFields(lv, k) {
  const ids = new Set(lv._hw.keep.filter((q) => q.field != null && overlap(q, k)).map((q) => q.field)); if (!ids.size) return;
  const f = (o) => o.field == null || !ids.has(o.field);
  // (+ its animals, S-C: loose objects not yet handed to the game; the live ones go via goneFields -> main.js game.cones.cull)
  for (const a of [lv.zones, lv.barriers, lv.props, lv.lanes, lv._hw.keep, lv.cones, lv._hw.looseNew || []]) { const kept = a.filter(f); if (kept.length !== a.length) { a.length = 0; a.push(...kept); } }
  lv.solidsDirty = true;
  const g = (lv._hw.goneFields ||= new Set()); for (const id of ids) g.add(id);
}
const pickW = (R, T) => { let q = R() * T.reduce((t, e) => t + e[1], 0); for (const [k, w] of T) if ((q -= w) <= 0) return k; return T[0][0]; };
// is rect k clear of the road (r m past its edge, the side road too) and of every keep rect?
function roomFor(st, k, clear, r) {
  if (st.keep.some((q) => overlap(q, k))) return false;
  const nx = -k.ay, ny = k.ax;
  for (const [u, v] of [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-0.5, -1], [0.5, -1]]) if (!clear(k.x + k.ax * u * k.hu + nx * v * k.hv, k.y + k.ay * u * k.hu + ny * v * k.hv, r)) return false;
  return true;
}
function village(lv, i, at, clear) {
  const st = lv._hw, P = st.pts, hw = st.geo.hw, R = st.frnd, s = P[i].s;
  const side = R() < 0.5 ? -1 : 1, L = 110 + R() * 70, n = Math.ceil(L / STEP), mid = side < 0 ? hw + 46 : hw + 38;
  if (i + n >= P.length) return;
  st.villageNext = s + 3000 + R() * 4000;
  const ci = i + (n >> 1), c = at(ci, side * mid), id = ++st.fieldId;
  const k = { x: c.x, y: c.y, ax: Math.cos(c.rot), ay: Math.sin(c.rot), hu: L / 2 + 6, hv: 15, field: id };
  if (!roomFor(st, k, clear, 6)) return;
  keepOut(lv, k, s);
  const pts = []; for (let j = i; j <= i + n; j += 2) { const p = at(j, side * mid); pts.push([p.x, p.y]); }
  lv.lanes.push({ pts, width: 5, surface: SURFACES.tarmac, field: id, _s: s });
  const cj = ci + (R() < 0.5 ? -6 : 6);
  for (let j = i + 2; j < i + n - 1; j += 3) for (const sv of [-1, 1]) {
    if (sv === side && Math.abs(j - cj) < 5) continue;   // the churchyard
    if (R() > 0.75) continue;
    const p = at(j, side * mid + sv * 7.5);
    lv.props.push({ kind: 'block', x: p.x, y: p.y, w: 6.5 + R() * 2.5, h: 5.5 + R() * 1.5, rot: p.rot, roof: ROOFS[(R() * ROOFS.length) | 0], house: true, field: id, _s: s });
  }
  { const p = at(cj, side * (mid + 9)); lv.props.push({ kind: 'block', x: p.x, y: p.y, w: 15, h: 6.5, rot: p.rot, roof: '#6e6a5e', church: true, field: id, _s: s }); }
}
function fields(lv, i, at, clear, biome, loose) {
  const st = lv._hw, P = st.pts, hw = st.geo.hw, R = st.frnd, s = P[i].s;
  if (!st.fieldNext) { st.fieldNext = { '-1': 0, 1: 0 }; st.villageNext = 1200 + R() * 2000; }
  if (biome !== 'farm' || lv._cfg.walls) { st.fieldNext[-1] = Math.max(st.fieldNext[-1], s); st.fieldNext[1] = Math.max(st.fieldNext[1], s); return; }
  if (s >= st.villageNext) village(lv, i, at, clear);
  for (const side of [-1, 1]) {
    if (s < st.fieldNext[side]) continue;
    const Lf = 70 + R() * 70, n = Math.ceil(Lf / STEP);
    if (i + n + 2 >= P.length) continue;
    st.fieldNext[side] = s + Lf + 5 + R() * 8;
    const ci = i + (n >> 1), h = at(ci, 0).rot, ax = Math.cos(h), ay = Math.sin(h), nx = -ay, ny = ax;
    let o = (side < 0 ? hw + 25 : hw + 11) + R() * 6;
    for (let row = 0, rows = R() < 0.55 ? 2 : 1; row < rows; row++) {
      const D = 38 + R() * 45, c = at(ci, side * (o + D / 2)), id = ++st.fieldId, type = pickW(R, FIELD_T);
      o += D + 5 + R() * 6;
      const k = { x: c.x, y: c.y, ax, ay, hu: Lf / 2 + HEDGE_W, hv: D / 2 + HEDGE_W, field: id };
      if (!roomFor(st, k, clear, 4)) continue;
      keepOut(lv, k, s);
      const [phys, art] = FIELD_SURF[type];
      // the field FIRST (zones: the first listed wins, and is painted last), then its long-grass border: one zone HEDGE_W bigger all round
      lv.zones.push({ x: c.x, y: c.y, w: Lf, h: D, rot: h, surface: SURFACES[phys], art, field: id, _s: s });
      lv.zones.push({ x: c.x, y: c.y, w: Lf + 2 * HEDGE_W, h: D + 2 * HEDGE_W, rot: h, surface: SURFACES.grassLong, art: 'hedgerow', hedge: true, field: id, _s: s });
      const C = (u, v) => [c.x + ax * u + nx * v * side, c.y + ay * u + ny * v * side];
      const far = D / 2 + HEDGE_W / 2;
      for (let t = 0, nt = 1 + ((R() * 2.4) | 0); t < nt; t++) { const [x, y] = C((R() - 0.5) * (Lf - 10), far); lv.props.push({ kind: 'tree', x, y, s: 4.5 + R() * 2.5, seed: (id * 7 + t) | 0, field: id, _s: s }); }
      const inside = (m) => C((R() - 0.5) * (Lf - 2 * m), (R() - 0.5) * (D - 2 * m));
      if (type === 'wheat' && R() < 0.45) for (let q = 3 + ((R() * 4) | 0); q > 0; q--) { const [x, y] = inside(5); lv.props.push({ kind: 'bale', x, y, field: id, _s: s }); }
      if (type === 'pasture') { const sp = R() < 0.6 ? 'sheep' : 'cow'; for (let q = (sp === 'sheep' ? 5 : 3) + ((R() * 5) | 0); q > 0; q--) { const [x, y] = inside(4); loose.push({ kind: sp, x, y, rot: R() * 6.28, field: id, _s: s }); } }
      if (type === 'yard') {
        for (let q = 0; q < 2; q++) { const [x, y] = C((q ? 1 : -1) * Lf * 0.22, D * 0.12); lv.props.push({ kind: 'block', x, y, w: Math.min(16, Lf * 0.3), h: Math.min(10, D * 0.3), rot: h, roof: ['#8a3a2e', '#2c2f33', '#6e6a5e'][(R() * 3) | 0], field: id, _s: s }); }
        for (let q = 2 + ((R() * 4) | 0); q > 0; q--) { const [x, y] = C((R() - 0.5) * Lf * 0.5, -D * 0.28); lv.props.push({ kind: 'bale', x, y, field: id, _s: s }); }
      }
    }
  }
}
function extras(lv, i, s, at, mk) {
  // every random choice here draws from st.xrnd (not the road's st.rnd): adding / changing an extra never re-rolls the road's shape
  const st = lv._hw, P = st.pts, hw = st.geo.hw, R = st.xrnd, walled = !!lv._cfg.walls;
  if (st.nextSlip == null) { st.nextSlip = 900 + R() * 900; st.nextBridge = 500 + R() * 500; }
  // OFF-SLIP: needs 60 m of straight before (signs) and 150 m after; never while the side road is running
  if (s >= st.nextSlip && !st.side && i > 20 && i < P.length - 50 && straightAt(P, i, 15, 38)) {
    st.nextSlip = s + SLIP_EVERY[0] + R() * (SLIP_EVERY[1] - SLIP_EVERY[0]);
    const q = R(), type = q < 0.25 ? 'side' : q < 0.75 ? 'long' : 'short';
    // keep a bridge (and its approaches) clear of the slip; after a side road the next bridge waits for its end (sideStep)
    if (s > st.nextBridge - 450) st.nextBridge = s + 450;
    const label = SLIP_NAMES[(Math.floor(s / 1000) + st.seed) % SLIP_NAMES.length];
    // the signs before it, the SAME for every type (you cannot tell which one comes back): 180 / 120 / 60 m posts + the exit board
    for (const [ds, bars] of [[-180, 3], [-120, 2], [-60, 1]]) { const j = i + Math.round(ds / STEP); if (j < 0) continue; const p = at(j, -(hw + 3)); lv.props.push(mk({ kind: 'slipcount', x: p.x, y: p.y, rot: p.rot, bars })); }
    { const j = i - Math.round(90 / STEP); if (j >= 0) { const p = at(j, -(hw + 6)); lv.props.push(mk({ kind: 'board', x: p.x, y: p.y, rot: p.rot, label: 'EXIT \u2192 ' + label, blue: true })); } }
    if (type === 'side') { st.side = { s0: s, run: SIDE_RUN[0] + R() * (SIDE_RUN[1] - SIDE_RUN[0]), pts: [], mpts: [], sPiece: s }; sideStep(lv, i, at); return; }
    // a gap in the left wall (walled preset) where it leaves
    if (walled) for (let j = Math.max(0, i - 4); j < Math.min(P.length, i + 28); j++) P[j].gapL = 1;
    const len = type === 'long' ? SLIP_LONG[0] + R() * (SLIP_LONG[1] - SLIP_LONG[0]) : SLIP_LEN;
    const away = type === 'long' ? 18 + R() * 22 : SLIP_DEG;   // degrees off the motorway at the end: a long one bends away, off screen
    const a = at(i, -hw), rot = a.rot - SLIP_DEG * Math.PI / 180;
    // the centreline: along the road, drifting out at SLIP_DEG (eased in over 60 m); a long one then bends on away after 80 m
    let x = a.x, y = a.y, h = a.rot; const line = [[x, y]];
    for (let d = 10; d <= len; d += 10) { h = a.rot - (SLIP_DEG * Math.min(1, d / 60) + (away - SLIP_DEG) * ease((d - 80) / Math.max(1, len - 80))) * Math.PI / 180; x += Math.cos(h) * 10; y += Math.sin(h) * 10; line.push([x, y]); }
    const o = mk({ kind: 'slip', x: a.x, y: a.y, rot, line, w: SLIP_W, len, label, type });
    lv.props.push(o);
    // the tarmac: a lane ribbon (lab.js laneAt + render.js drawLanes, as the pit lanes), starting 12 m back and 2.6 m INSIDE the edge so
    // its round end lies under the motorway ribbon (PHOTOGRAPHED 2026-10-06: starting outside the edge left a stub in the verge)
    const b0 = at(Math.max(0, i - 3), -hw + 2.6), lane = { pts: [[b0.x, b0.y], ...line.slice(1)], width: SLIP_W, surface: SURFACES.tarmac, _s: s };
    lv.lanes.push(lane);
    // the gate at the end, in a field (moves back if the slip is cut short by the road coming back)
    const gate = mk({ kind: 'gate', x: 0, y: 0, rot: 0 });
    const putGate = () => { const n = line.length, [ex, ey] = line[n - 1], [px, py] = line[Math.max(0, n - 2)], hh = Math.atan2(ey - py, ex - px); Object.assign(gate, { x: ex + Math.cos(hh) * 3, y: ey + Math.sin(hh) * 3, rot: hh + Math.PI / 2 }); };
    putGate(); lv.props.push(gate);
    keepOut(lv, { x: (a.x + x) / 2, y: (a.y + y) / 2, ax: Math.cos(Math.atan2(y - a.y, x - a.x)), ay: Math.sin(Math.atan2(y - a.y, x - a.x)), hu: Math.hypot(x - a.x, y - a.y) / 2 + 6, hv: len > 200 ? 30 : 8 }, s);
    // a long slip that the road swings back across is cut short there
    if (type === 'long') addCut(lv, { pts: line, s, w: SLIP_W, skip: [s - 40, s + len + 40], after: () => { lane.pts.length = line.length; lane._segs = null; o._bb = null; putGate(); lv.solidsDirty = true; } });
    return;
  }
  // BRIDGES: over (road / rail / foot) or the motorway over a river. Not while the side road runs beside the motorway.
  if (s >= st.nextBridge && !st.side && i < P.length - 20 && straightAt(P, i, 12)) {
    st.nextBridge = s + BRIDGE_EVERY[0] + R() * (BRIDGE_EVERY[1] - BRIDGE_EVERY[0]);
    if (s > st.nextSlip - 400) st.nextSlip = s + 400;   // no slip under a bridge's approach
    const r = R(), kind = r < 0.38 ? 'road' : r < 0.62 ? 'rail' : r < 0.82 ? 'foot' : 'river';
    // walled: the wall stands wallGap off the edge - the span and the parapets clear it
    const wg = walled ? lv._cfg.wallGap : 0, a = at(i, 0), skew = (R() - 0.5) * 0.5, span = 2 * hw + 2 * PIER + 6 + 2 * wg;
    const o = mk({ kind: kind === 'river' ? 'river' : 'bridge', carries: kind, x: a.x, y: a.y, rot: a.rot + Math.PI / 2 + skew, wid: span, seed: (s | 0), skew, roadHw: hw + 1.2 + wg });
    // CHEEKY EXTRAS, rare (each ~1 in 6 of its bridge type)
    const x6 = R() < 1 / 6;
    if (kind === 'road') { o.cars = 1 + ((R() * 2) | 0); o.cow = x6; }
    if (kind === 'foot') { o.cone = x6; o.people = 1 + ((R() * 3) | 0); }
    if (kind === 'river') { o.boat = x6; o.ww = 10 + R() * 8; }
    // what MOVES across it (render.js drawBridge, wall clock, no physics): road traffic both ways, walkers, a train now and then
    o.phase = R() * 1000;
    if (kind === 'rail') o.trainEvery = 14 + R() * 16;
    lv.props.push(o);
    if (kind === 'river') {
      // the motorway's own parapets over it (lab walls); on the walled preset its wall is already there
      if (!walled) for (const side of [-1, 1]) { const pts = []; for (let k = -6; k <= 6; k++) { const j = Math.max(0, Math.min(P.length - 1, i + k)), p = at(j, side * (hw + 1.2)); pts.push([p.x, p.y]); } lv.barriers.push({ kind: 'wall', pts, _s: s }); }
      river(lv, o, s);
    } else approaches(lv, o, s);
    return;
  }
  // SMILEY SOLAR FARM: rare, well off the road (not on walled: nothing grows inside the walls)
  if (!walled && i % 200 === 0 && R() < 0.15) { const side = R() < 0.5 ? -1 : 1, p = at(i, side * (hw + 45 + R() * 30)); if (!blocked(st.keep, p.x, p.y, 16)) lv.props.push(mk({ kind: 'solarfarm', x: p.x, y: p.y, rot: p.rot + Math.PI / 2 })); }
}
// the roadside debris mix (weights by repetition: pallets / boxes / tarps are what really ends up on a hard shoulder) + paint for bins, barrels, bumpers, tarps
const DEBRIS_PICK = ['pallet', 'pallet', 'box', 'box', 'crate', 'bin', 'sandbag', 'barrel', 'exhaust', 'bumper', 'tarp', 'tarp'];
const DEBRIS_COL = ['#2f5d3a', '#2b56b5', '#c8302c', '#3a3f47', '#d6a21e', '#2f6fb0'];
const SLIP_NAMES = ['GOOLE', 'SCUNTHORPE', 'NOWHERE', 'BRIGG', 'SERVICES (SHUT)', 'HOWDEN', 'A NICE FIELD', 'SOMEWHERE', 'HULL (NOT REALLY)', 'THE NORTH'];
// scenery for road points [i0, i1): placed in WORLD coordinates (stays put when the window moves); loose objects go into `loose`
function dress(lv, i0, i1, loose) {
  const st = stateOf(lv), R = st.rnd, hw = st.geo.hw, P = st.pts;
  const at = (i, off) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], h = Math.atan2(b.y - a.y, b.x - a.x); return { x: P[i].x - Math.sin(h) * off, y: P[i].y + Math.cos(h) * off, rot: h }; };
  // clear of the road AND of every approach / river / slip (st.keep) AND of the secret side road (its points carry sideOff)
  const clear = (x, y, r) => { for (let j = Math.max(0, i0 - 60); j < Math.min(P.length, i1 + 60); j += 2) { const d2 = (P[j].x - x) ** 2 + (P[j].y - y) ** 2; if (d2 < (hw + r) ** 2 || (P[j].sideOff && d2 < (P[j].sideOff + SLIP_W / 2 + r) ** 2)) return false; } return !blocked(st.keep, x, y, r); };
  // a long road can come back across what was laid beside an EARLIER stretch: every new point cuts the approaches / rivers / slips
  for (let j = i0; j < i1; j += 2) for (const c of st.cuts) if (!cutSkips(c, P[j].s)) cutBy(lv, c, P[j].x, P[j].y);
  // half the road is FARMLAND now (fields, hedges, villages: fields() above), was a third
  const biome = (s) => ['farm', 'forest', 'farm', 'rocky', 'farm', 'forest'][Math.floor(s / 2200) % 6];
  for (let i = i0; i < i1; i++) {
    const s = P[i].s, b = biome(s), mk = (o) => { o._s = s; return o; };
    sideStep(lv, i, at);   // the side road's offset here first, so the trees below keep off it
    if (!NOF) fields(lv, i, at, clear, b, loose);
    if (i % 3 === 0) for (const side of [-1, 1]) {
      const dens = b === 'forest' ? 0.75 : b === 'farm' ? 0.18 : 0.25;
      if (R() < dens) { const p = at(i, side * (hw + 10 + R() * (b === 'forest' ? 40 : 25))); if (clear(p.x, p.y, 8)) lv.props.push(mk({ kind: 'tree', x: p.x, y: p.y, s: 4 + R() * 3, seed: (s | 0) * 2 + 1 })); }
      if (b === 'rocky' && R() < 0.3) { const p = at(i, side * (hw + 6 + R() * 30)); if (clear(p.x, p.y, 5)) lv.props.push(mk({ kind: 'rock', x: p.x, y: p.y, s: 2 + R() * 4, seed: (s | 0) + 7 })); }
    }
    if (b === 'farm' && i % 40 === 0 && R() < 0.4) { const side = R() < 0.5 ? -1 : 1, p = at(i, side * (hw + 30 + R() * 25)); if (clear(p.x, p.y, 12)) lv.props.push(mk({ kind: 'block', x: p.x, y: p.y, w: 14, h: 8, rot: p.rot + R(), roof: ['#8a3a2e', '#6e6a5e', '#3f5a3a'][(R() * 3) | 0] })); }
    // SLIP ROADS + BRIDGES (user, 2026-10-05: "off-slip every 2-4 km (tapering lane, sign, ends in fields; drivable)"; "bridges over a road,
    // a river and a railway + a footbridge"; "rare cheeky extras"): planned on the road's own distance, placed only on near-straight
    // road (|curv| < 1/900 over the stretch), never on top of each other. extras(lv, i, s) below.
    // (every preset since 2026-10-06, user: "all the types of highway should have bridges and slip roads you can take")
    if (!NOX) extras(lv, i, s, at, mk);
    // GANTRY every ~3 km, a SIGN every ~700 m (the distance to Hull GOES UP)
    // (never with a leg / board on a slip, an approach or the side road: a gantry there moves on 40 m, a board swaps sides or is left out)
    const freeAt = (j, off, r) => { const p = at(j, off); return !(P[j].sideOff && off < 0) && !blocked(st.keep, p.x, p.y, r) ? p : null; };
    if (Math.floor(s / 3000) !== Math.floor((s - STEP) / 3000)) st.gantryDue = true;
    if (st.gantryDue && freeAt(i, -(hw + 3), 2) && freeAt(i, hw + 3, 2)) { st.gantryDue = false; const p = at(i, 0); lv.props.push(mk({ kind: 'gantry', x: p.x, y: p.y, rot: p.rot + Math.PI / 2, wid: st.geo.width + 6 })); }
    if (Math.floor(s / 700) !== Math.floor((s - STEP) / 700)) {
      const n = Math.floor(s / 700), sd = n % 2 ? 1 : -1, label = n % 3 === 0 ? `HULL ${412 + n * 3} MI` : SIGNS[(n * 7 + st.seed) % SIGNS.length];
      const p = freeAt(i, sd * (hw + 6), 10) || freeAt(i, -sd * (hw + 6), 10);
      if (p) lv.props.push(mk({ kind: 'board', x: p.x, y: p.y, rot: p.rot, label }));
    }
    // ROLLING HILLS: a broad hump beside the road every ~250 m (the road climbs its flank)
    if (i % 60 === 0 && R() < 0.6) { const p = at(i, (R() < 0.5 ? -1 : 1) * (30 + R() * 90)); lv.bumps.push(mk({ kind: 'hump', x: p.x, y: p.y, r: 110 + R() * 160, h: (b === 'rocky' ? 6 : 3) + R() * 8 })); }
  }
  sideFlush(lv, false);
  if (st.coversDirty) syncCovers(lv);
  // ARMCO on the OUTSIDE of the tighter bends: runs of points with |curv| > 1/400 (+curv = a right-hander -> outside = the -normal side)
  let run = null;
  for (let i = i0; i <= (lv._cfg.walls ? -1 : i1); i++) {
    const c = i < i1 ? P[i].curv : 0, on = Math.abs(c) > 1 / 400;
    if (on && !run) run = { a: i, side: -Math.sign(c) };
    // (left-side armco breaks where a slip leaves or the side road runs: P[j].gapL)
    if ((!on || i === i1) && run) { let pts = []; const flush = () => { if (pts.length > 2) lv.barriers.push({ kind: 'armco', pts, _s: P[run.a].s }); pts = []; };
      for (let j = Math.max(0, run.a - 8); j < Math.min(P.length, i + 8); j += 2) { if (run.side < 0 && P[j].gapL) { flush(); continue; } const p = at(j, run.side * (hw + 1.8)); pts.push([p.x, p.y]); }
      flush(); run = null; }
  }
  const cfg = lv._cfg;
  // LOOSE ROADSIDE (user, 2026-10-05: "as it's open sided, be LITTERED with TYRES and CONES and have appropriate CHEVRON signs for
  // the corners"): knockable cones.js objects into `loose` (the level's cones at a restart, else streamed in by main.js), open presets
  // only. CHEVRONS on the outside of every bend tighter than R 650, one per 48 m, 4.5 m off the edge (behind the armco where there
  // is one), arrows pointing the way it turns; LITTER on both verges (a lone tyre, a cone, now and then on the hard shoulder);
  // a stray TYRE STACK pile now and then; and a CONE TAPER closing the hard shoulder every ~1.6 km.
  if (!cfg.walls && loose) {
    const R = st.lrnd, lm = (o, s) => { o._s = s; loose.push(o); return o; };
    // LITTER DENSITY (user, 2026-10-05: "they should be RANDOM and also have a SLIDER for frequency / density"; default 1 = as tested and
    // seen): lv.litter x every litter chance (setup's LITTER slider, 0 = none .. 3 = a scrapyard); chevrons are signs, not litter
    const D = lv.litter ?? 1, pr = (p) => Math.min(0.95, p * D);
    for (let i = i0; i < i1; i++) {
      const s = P[i].s, c = P[i].curv;
      if (Math.abs(c) > 1 / 650 && i % 12 === 0) { const dir = Math.sign(c), p = at(i, -dir * (hw + 4.5)); lm({ kind: 'chevron', x: p.x, y: p.y, rot: p.rot + dir * Math.PI / 2 }, s); }
      if (i % 4 === 0) for (const side of [-1, 1]) if (R() < pr(0.32)) {   // ~0.8 per 10 m of verge (screenshot: 0.18 per 20 m read as bare)
        const onShoulder = side < 0 && cfg.shoulder >= 2 && R() < 0.15, off = onShoulder ? -hw + 0.4 + R() * (cfg.shoulder - 0.8) : side * (hw + 0.8 + R() * 6);
        // (2026-10-06, user: "I want to SEE some debris"): ~1 in 2 of the litter (and of the scatters) is ROADSIDE DEBRIS (cones.js DEBRIS kinds), the rest tyres + cones
        const p = at(i, off), q = R();
        lm(q < 0.45 ? { kind: DEBRIS_PICK[(R() * DEBRIS_PICK.length) | 0], x: p.x, y: p.y, rot: R() * 6.28, col: DEBRIS_COL[(R() * DEBRIS_COL.length) | 0] }
          : q < 0.7 ? { kind: 'tyre', x: p.x, y: p.y, rot: R() * 6.28 } : { kind: 'cone', x: p.x, y: p.y, rot: R() * 6.28 }, s);
      }
      // DEBRIS SCATTERS (2026-10-05 screenshots: lone 0.8 m tyres barely read at the treadmill zoom): ~1 per 130 m, 4-7 mixed tyres +
      // cones spread over 8 m of one verge, a few spilling up to the edge line
      if (i % 8 === 0 && R() < pr(0.25)) { const side = R() < 0.5 ? -1 : 1, n = 4 + ((R() * 4) | 0);
        for (let k = 0; k < n; k++) { const j = Math.min(P.length - 1, i + ((R() * 3) | 0)), p = at(j, side * (hw + 0.6 + R() * 7));
          { const q2 = R(); lm(q2 < 0.4 ? { kind: DEBRIS_PICK[(R() * DEBRIS_PICK.length) | 0], x: p.x, y: p.y, rot: R() * 6.28, col: DEBRIS_COL[(R() * DEBRIS_COL.length) | 0] } : q2 < 0.75 ? { kind: 'tyre', x: p.x, y: p.y, rot: R() * 6.28 } : { kind: 'cone', x: p.x, y: p.y, rot: R() * 6.28 }, P[j].s); } } }
      if (i % 50 === 0 && R() < pr(0.22)) { const side = R() < 0.5 ? -1 : 1, b = at(i, side * (hw + 3 + R() * 4)); const n = 3 + ((R() * 4) | 0);
        for (let k = 0; k < n; k++) lm({ kind: 'tyrestack', x: b.x + (R() - 0.5) * 2.4, y: b.y + (R() - 0.5) * 2.4 }, s); }
      if (D > 0 && cfg.shoulder >= 2 && Math.floor(s / 1600) !== Math.floor((s - STEP) / 1600) && s > 600)
        for (let k = 0; k < 8; k++) { const j = Math.min(P.length - 1, i + k * 2), p = at(j, -hw + 0.4 + (cfg.shoulder - 0.6) * (k / 7)); lm({ kind: 'cone', x: p.x, y: p.y, rot: 0 }, P[j].s); }
    }
  }
  // WALLS (cfg.walls): both sides, in ~120 m pieces (each dropped behind with the rest), overlapping by one point so there is no gap
  // ... with a GAP in the left wall where a slip leaves or the side road runs (P[j].gapL)
  if (cfg.walls) for (let a = Math.max(0, i0 - 1); a < i1; a += 30) for (const side of [-1, 1]) {
    let pts = []; const flush = () => { if (pts.length > 1) lv.barriers.push({ kind: cfg.walls, pts, _s: P[a].s }); pts = []; };
    // (beside the SECRET SIDE ROAD the left wall swings out with it, to its far edge - it starts and ends at the normal line)
    for (let j = a; j <= Math.min(P.length - 1, a + 30); j++) { const so = side < 0 && P[j].sideOff; if (!so && side < 0 && P[j].gapL) { flush(); continue; } const p = at(j, so ? -Math.max(hw + cfg.wallGap, so + SLIP_W / 2 + cfg.wallGap) : side * (hw + cfg.wallGap)); pts.push([p.x, p.y]); }
    flush();
  }
}
function rebuild(lv) {
  const st = stateOf(lv), P = st.pts;
  const sub = createSubtrack(P.map((q) => [q.x, q.y]), st.geo.width, [{ startDist: 0, endDist: 1e9, surface: SURFACES.tarmac }], [], true);
  ghostSegment(sub, P.length - 1);   // the closing segment, end -> start: never road
  sub.laneDash = st.geo.dashes; sub.laneSolid = st.geo.solid; sub.sBase = P[0].s;
  // a new ROAD TYPE on the same seed is a different road: layoutId tells render.js its cached ground tiles are out of date
  sub.layoutId = lv._layout || 0;
  lv.subtrack = sub;
  prepBumps(lv.bumps.filter((b) => b.reach2 == null)); lv._bumpGridOf = null;
  prepBarriersOf(lv);
  const so = solidsFromProps(lv.props); lv.solids.length = 0; lv.solids.push(...so);
}
// where the car is along the window: nearest road point (searched round last step's index first), absolute road distance s, signed
// offset (+ = driver's right) and the road direction there
function locate(st, x, y) {
  const P = st.pts, n = P.length; let bi = 0, bd = Infinity;
  const scan = (a, b) => { for (let i = Math.max(0, a); i < Math.min(n, b); i++) { const d = (P[i].x - x) ** 2 + (P[i].y - y) ** 2; if (d < bd) { bd = d; bi = i; } } };
  scan(st.ci - 30, st.ci + 31);
  if (bd > 400) { bd = Infinity; scan(0, n); }
  st.ci = bi;
  const a = P[Math.max(0, bi - 1)], b = P[Math.min(n - 1, bi + 1)], L = Math.hypot(b.x - a.x, b.y - a.y) || 1, dx = (b.x - a.x) / L, dy = (b.y - a.y) / L;
  const ex = x - P[bi].x, ey = y - P[bi].y;
  return { i: bi, s: P[bi].s + ex * dx + ey * dy, off: -ex * dy + ey * dx, dx, dy };
}
// ROAD FRAME for ANY car (traffic.js, later the highway AI): like locate() but with the caller's own hint (an absolute road distance s,
// so it survives the window moving) -> { s, off (+ = driver's right), dx, dy } or null before the road exists
export function roadFrame(lv, x, y, hintS) {
  const P = lv._hw.pts, n = P.length; if (n < 2) return null;
  let bi = 0, bd = Infinity;
  const scan = (a, b) => { for (let i = Math.max(0, a); i < Math.min(n, b); i++) { const d = (P[i].x - x) ** 2 + (P[i].y - y) ** 2; if (d < bd) { bd = d; bi = i; } } };
  if (hintS != null) { const h = Math.round((hintS - P[0].s) / STEP); scan(h - 14, h + 15); }
  if (bd > 400) { bd = Infinity; scan(0, n); }
  const a = P[Math.max(0, bi - 1)], b = P[Math.min(n - 1, bi + 1)], L = Math.hypot(b.x - a.x, b.y - a.y) || 1, dx = (b.x - a.x) / L, dy = (b.y - a.y) / L;
  const ex = x - P[bi].x, ey = y - P[bi].y;
  return { s: P[bi].s + ex * dx + ey * dy, off: -ex * dy + ey * dx, dx, dy };
}
// a POSE on the road at absolute distance s (clamped into the window) and lateral offset off -> { x, y, h }
export function roadPose(lv, s, off) {
  const P = lv._hw.pts, n = P.length, f = (s - P[0].s) / STEP, i = Math.max(0, Math.min(n - 2, Math.floor(f))), t = Math.max(0, Math.min(1, f - i));
  const a = P[i], b = P[i + 1], h = Math.atan2(b.y - a.y, b.x - a.x);
  return { x: a.x + (b.x - a.x) * t - Math.sin(h) * off, y: a.y + (b.y - a.y) * t + Math.cos(h) * off, h };
}
// the road that exists right now: [s0, s1] absolute
export function roadSpan(lv) { const P = lv._hw.pts; return { s0: P[0].s, s1: P[P.length - 1].s }; }
// first window (also RESTART: the same seed builds the same motorway, so cached ground tiles stay right)
export function resetHighway(lv) {
  const R = rng(lv.seed);
  lv._hw = { seed: lv.seed, rnd: R, grnd: rng((lv.seed ^ 0x7f4a7c15) >>> 0), geo: laneGeo(lv._cfg), pts: [], plan: [{ len: SPAWN_S + 150, k: 0, ramp: 0, hold: 0 }], x: 0, y: 0, hdg: UP, s: 0, dressed: 0, target: 0, tUntil: 0, tSide: 0, offT: 0, warn: null,
    ci: 0, best: SPAWN_S, driven: 0, backT: 0, q: null, camDir: { x: 0, y: -1 },
    // the LOOSE ROADSIDE draws from its OWN stream: sharing rnd made every litter tweak re-roll the road shape itself
    lrnd: rng((lv.seed ^ 0x5bd1e995) >>> 0),
    // slips / bridges / extras draw from their OWN stream too; keep = scenery keep-out areas, cuts = what a returning road cuts short,
    // covers = the rivers' water (lv.covers via syncCovers), side = the secret side road being built
    xrnd: rng((lv.seed ^ 0x2c1b3c6d) >>> 0), frnd: rng((lv.seed ^ 0x1b873593) >>> 0), fieldId: 0, fieldNext: null, keep: [], cuts: [], covers: [], side: null, coversDirty: true };
  lv.props.length = 0; lv.bumps.length = 0; lv.barriers.length = 0; lv.solids.length = 0; lv.lanes.length = 0; lv.zones.length = 0;
  const st = lv._hw; st.pts.push({ x: 0, y: 0, s: 0, curv: 0 });
  // the first window's loose objects ARE the level's cones (cones.js reset() reads lv.cones on every restart)
  lv.cones.length = 0;
  growTo(lv, AHEAD + 300); dress(lv, 0, st.pts.length, lv.cones); st.dressed = st.pts.length; syncCovers(lv); rebuild(lv);
  st.looseNew = []; st.looseCut = null;
  const p = onTrack(lv.subtrack, SPAWN_S, st.geo.centres[0], {});   // the LEFT lane (UK motorway)
  Object.assign(lv.spawn, { x: p.x, y: p.y, heading: p.rot });
  st.ci = Math.round(SPAWN_S / STEP);
  lv.solidsDirty = true;
}
// call every physics step with the car: tracks progress + the camera's road direction, extends ahead / drops behind when the car has
// moved on. Returns the distance the window start moved (subtract it from any remembered road distance), or 0.
export function stepHighway(lv, car) {
  const st = stateOf(lv), q = locate(st, car.x, car.y), P = st.pts;
  st.q = q;
  st.driven = Math.max(st.driven, q.s - SPAWN_S); st.best = Math.max(st.best, q.s);
  // the CAMERA's lead direction (render.js follow): the chord over the next ~60 m of road, so it leans INTO a bend before you reach it
  { const a = P[q.i], b = P[Math.min(P.length - 2, q.i + 15)], L = Math.hypot(b.x - a.x, b.y - a.y);
    if (L > 1) st.camDir = { x: (b.x - a.x) / L, y: (b.y - a.y) / L }; }
  if (P[P.length - 1].s - q.s > AHEAD) return 0;
  // extend 300 m, dress it, drop what is BEHIND, rebuild
  // loose objects for the new stretch wait in st.looseNew, and st.looseCut is the road distance behind which main.js drops them
  // (game.cones.spawn / cull — the live objects belong to the game, not the level)
  growTo(lv, st.s + 300); dress(lv, st.dressed, P.length, st.looseNew); st.dressed = P.length;
  let cut = 0; while (cut < P.length && P[cut].s < q.s - BEHIND) cut++;
  const ds = P[cut].s - P[0].s;
  P.splice(0, cut); st.dressed -= cut; st.ci = Math.max(0, st.ci - cut); q.i = st.ci;
  const s0 = P[0].s - 60;
  st.looseCut = s0;
  const keep = (o) => o._s == null || o._s >= s0;
  for (const k of ['props', 'bumps', 'barriers', 'lanes', 'zones']) { const a = lv[k], kept = a.filter(keep); a.length = 0; a.push(...kept); }
  for (const k of ['keep', 'cuts']) { const a = st[k], kept = a.filter(keep); a.length = 0; a.push(...kept); }
  { const n = st.covers.length; st.covers = st.covers.filter(keep); if (n !== st.covers.length) st.coversDirty = true; }
  if (st.coversDirty) syncCovers(lv);
  rebuild(lv); clearNaturalCache(); lv.solidsDirty = true;
  pruneWear(car.x, car.y, BEHIND + AHEAD);   // wear left behind, or under ground that has changed, goes (lab.js pruneWear)
  return ds;
}
// SPEED CAMERAS (user, 2026-10-05: "cameras on the gantries: flash + 'CAUGHT 187 km/h' in the HUD top right, stored for missions /
// achievements later"; HANDOVER: "flash ONLY over 70 mph; YOU GOT CAUGHT + your speed + a fine (-$) scaling with how far over; store
// fastest catch + count"). Every gantry is a camera. speedCamera(lv, car) after stepHighway: the first step the car's road distance
// passes a gantry -> null (under the limit) or { kmh, mph, fine }. A fine: $100 + $10 per mph over, x2 past 100 mph over (UK-ish).
export const CAM_MPH = 70;
export function speedCamera(lv, car) {
  const st = stateOf(lv), q = st.q; if (!q) return null;
  const prev = st.camS ?? q.s; st.camS = q.s; if (q.s <= prev) return null;
  for (const pr of lv.props) { if (pr.kind !== 'gantry' || pr._camHit) continue; const f = roadFrame(lv, pr.x, pr.y, q.s); if (!f || f.s <= prev || f.s > q.s) continue;
    pr._camHit = 1; const mph = Math.hypot(car.vx, car.vy) * 2.23694; if (mph <= CAM_MPH) return null;
    const over = mph - CAM_MPH; pr._flash = performance.now();
    return { kmh: Math.round(mph * 1.609344), mph: Math.round(mph), fine: Math.round((100 + 10 * over) * (over > 100 ? 2 : 1) / 10) * 10 }; }
  return null;
}
// after stepHighway: null, or WHY the car must be put back (main.js shows it and calls highwayRespawn). st.warn = the off-road
// countdown text while one is running (main.js shows it), else null.
export function highwayGuard(lv, car, dt) {
  const st = stateOf(lv), q = st.q; if (!q) return null;
  const vAlong = car.vx * q.dx + car.vy * q.dy;
  st.backT = vAlong < -BACK_V ? st.backT + dt : 0;
  if (st.backT > BACK_T || q.s < st.best - BACK_M) return 'WRONG WAY — RESET';
  // THE SECRET SIDE ROAD is road (its points carry sideOff, the offset of its centre to the left); any OTHER lane off the motorway (an
  // off-slip, a bridge approach) holds the countdown and only the far-out reset ends it, as "EXIT TAKEN" (user: "slip roads you can take")
  const pi = st.pts[q.i], side = pi && pi.sideOff && q.off < 0 && Math.abs(-q.off - pi.sideOff) < SIDE_W_HALF + 1;
  const out = side ? 0 : Math.abs(q.off) - st.geo.hw;
  const onLane = out > OFF_SOFT && zoneSurfaceAt(car.x, car.y).id === 'tarmac';
  const inRate = st.outPrev != null ? (st.outPrev - out) / dt : 0; st.outPrev = out; st.inV = (st.inV || 0) + (inRate - (st.inV || 0)) * Math.min(1, dt / 0.5);
  st.offT = out <= OFF_SOFT ? 0 : out < OFF_NEAR || st.inV > BACK_IN || onLane ? st.offT : st.offT + dt;
  if (onLane) st.tookExit = true; else if (out <= OFF_SOFT) st.tookExit = false;
  st.warn = out > OFF_SOFT && !onLane ? `BACK TO THE ROAD  ${Math.max(1, Math.ceil(OFF_T - st.offT))}` : null;
  if (out > OFF_HARD || st.offT > OFF_T) { const ex = st.tookExit; st.offT = 0; st.warn = null; st.tookExit = false; return ex ? 'EXIT TAKEN — BACK TO THE MOTORWAY' : 'OFF THE MOTORWAY — RESET'; }
  return null;
}
// the put-back pose: the LEFT lane, a few metres short of the furthest point reached, facing up the road
export function highwayRespawn(lv) {
  const st = stateOf(lv), d = Math.max(0, st.best - 6 - st.pts[0].s);
  const p = onTrack(lv.subtrack, d, st.geo.centres[0], {});
  st.backT = 0; st.ci = Math.min(st.pts.length - 1, Math.round(d / STEP)); st.q = null;
  return { x: p.x, y: p.y, h: p.rot };
}
// ROAD TYPE (user, 2026-10-05: "how do I test the lane presets — I don't see any buttons"): Test Mode setup offers lv.roadTypes; the
// launch calls this before the restart builds the road. ?hw=interstate etc. still works for tools.
export function setHighwayPreset(lv, preset) {
  if (!HW_PRESETS[preset] || lv.roadType === preset) return;
  lv.roadType = preset; lv._cfg = HW_PRESETS[preset]; lv._layout = (lv._layout || 0) + 1;
}
const QP = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('hw') : null;
// node tools only: HWNOX=1 builds the road with NO slips / bridges / extras (an A/B of their effect on the AI, same roads)
const NOX = typeof process !== 'undefined' && !!(process.env && process.env.HWNOX);
const NOF = typeof process !== 'undefined' && !!(process.env && process.env.HWNOF);   // node only: no FIELDS (scenery v2 A/B)
export function createHighway(seed = 4242, preset = 'motorway') {
  if (!HW_PRESETS[preset]) preset = 'motorway';
  const lv = { id: 'highway', name: 'Highway to Hull', endless: true, floor: 1000000, seed, _cfg: HW_PRESETS[preset], roadType: preset, roadTypes: HW_NAMES,
    base: SURFACES.grass, subtrack: null, camber: { maxDeg: 0, refR: 60, crown: 0.03, edge: 5, sections: [] },
    zones: [], bumps: [], covers: [], paint: [], boards: [], seams: false, cones: [], props: [], barriers: [], solids: [], lanes: [], spawn: { x: 0, y: 0, heading: 0 } };
  resetHighway(lv);
  return lv;
}
LEVELS.push(createHighway(4242, QP || 'motorway'));
