// cones.js — knockable cones, tyre stacks, and individual tyres with realistic simulated dynamics.
// Cones topple and slide. Tyre stacks absorb momentum, and shatter into individual tyres
// that roll upright on their tread, tumble/flip, wobble, and slide flat on the floor.

import "./world/load.js";   // the world is set up before this file runs (as importing lab.js did)
import { CONES, LEVEL } from "./world/state.ts";
import { FLOOR, FX0, FX1, FY0, FY1 } from "./world/bounds.js";
import { BARRIER_HALF } from "./world/barriers.js";
const WALL_E = 0.3, WALL_SCRAPE = 0.8, OVER_V = 9, OVER_CHANCE = 0.3;
function hitWalls(k) {
  const r = k.r || 0.3;
  if (k.over) return;
  const sp = Math.hypot(k.vx, k.vy);
  const bounce = (nx, ny, push) => {
    if (sp > OVER_V && !k.overTried) { k.overTried = true; if (Math.random() < OVER_CHANCE) { k.over = true; return; } }
    k.x += nx * push; k.y += ny * push;
    const vn = k.vx * nx + k.vy * ny;
    if (vn < 0) { const tx = -ny, ty = nx, vt = k.vx * tx + k.vy * ty; k.vx = nx * -vn * WALL_E + tx * vt * WALL_SCRAPE; k.vy = ny * -vn * WALL_E + ty * vt * WALL_SCRAPE; k.spin = (k.spin || 0) * 0.5; }
  };
  for (const b of LEVEL.barriers || []) {
    const half = BARRIER_HALF[b.kind]; if (!half || !b._segs) continue;
    for (const g of b._segs) {
      if (k.x < g.minX - r || k.x > g.maxX + r || k.y < g.minY - r || k.y > g.maxY + r) continue;
      let t = ((k.x - g.ax) * g.dx + (k.y - g.ay) * g.dy) / g.l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = g.ax + g.dx * t, qy = g.ay + g.dy * t, dx = k.x - qx, dy = k.y - qy, d = Math.hypot(dx, dy);
      if (d >= half + r) continue;
      if (d < 1e-6) { bounce(-g.dy / Math.sqrt(g.l2), g.dx / Math.sqrt(g.l2), half + r); } else bounce(dx / d, dy / d, half + r - d);
      if (k.over) return;
    }
  }
  for (const s of LEVEL.solids || []) {
    const dx = k.x - s.x, dy = k.y - s.y; if (dx * dx + dy * dy > (s.r + r) ** 2) continue;
    const c = Math.cos(s.rot), sn = Math.sin(s.rot), u = dx * c + dy * sn, v = -dx * sn + dy * c;
    const cu = Math.max(-s.w / 2, Math.min(s.w / 2, u)), cv = Math.max(-s.h / 2, Math.min(s.h / 2, v)), eu = u - cu, ev = v - cv, d = Math.hypot(eu, ev);
    if (d >= r) continue;
    let nu, nv, push;
    if (d > 1e-6) { nu = eu / d; nv = ev / d; push = r - d; } else { const pu = s.w / 2 - Math.abs(u), pv = s.h / 2 - Math.abs(v); if (pu < pv) { nu = Math.sign(u) || 1; nv = 0; push = pu + r; } else { nu = 0; nv = Math.sign(v) || 1; push = pv + r; } }
    bounce(nu * c - nv * sn, nu * sn + nv * c, push);
    if (k.over) return;
  }
}

const CONE_R = 0.20;         // metres base radius
const DRAG = 2.9;            // exponential velocity decay per second
const SPIN_DRAG = 4.0;       // spin decays a bit faster than translation
const RESTITUTION = 0.45;    // bounciness along the contact normal
const REST_V = 0.05;         // m/s to snap to zero
const TOPPLE_V = 0.8;        // m/s hit needed to knock a cone flat
const MAX_CONE_V = 32;       // clamp fling speed

// A stack hit hard enough comes apart: it becomes one ROLLING tyre and throws out two more — one
// cartwheeling left, one skidding flat right. Used by the car hitting a stack AND (2026-10-03) by any
// other object hitting one, so a tyre flung into the wall bursts the stack it lands on.
function burstStack(k, out) {
  k.kind = 'tyre';
  k.mode = 'roll';
  k.mass = 12;
  k.r = 0.42;
  k.down = 0;
  const baseAng = Math.atan2(k.vy, k.vx);
  const spHit = Math.hypot(k.vx, k.vy);
  const angL = baseAng + 0.55, angR = baseAng - 0.55;
  // _s: the road distance it belongs to (streamed levels drop it with that stretch of road)
  const common = { kind: 'tyre', hx: k.hx, hy: k.hy, moved: true, mass: 12, r: 0.42, hitCount: 1, wobblePhase: 0, wobbleAmp: 0, rollDist: 0, _s: k._s };
  out.push({ ...common, mode: 'flip', x: k.x + Math.cos(angL) * 0.45, y: k.y + Math.sin(angL) * 0.45,
    vx: Math.cos(angL) * spHit * 0.90, vy: Math.sin(angL) * spHit * 0.90, ang: angL,
    spin: (Math.random() - 0.5) * 6, down: 0.5, flipPhase: 0, flipSpeed: 14 + Math.random() * 8 });
  out.push({ ...common, mode: 'flat', x: k.x + Math.cos(angR) * 0.45, y: k.y + Math.sin(angR) * 0.45,
    vx: Math.cos(angR) * spHit * 0.85, vy: Math.sin(angR) * spHit * 0.85, ang: angR,
    spin: (Math.random() - 0.5) * 12, down: 1.0, flipPhase: 0, flipSpeed: 0 });
}

// OBJECT-OBJECT COLLISIONS (user, 2026-10-03: "tyres should hit other tyres and cones or objects etc and
// pass impact onto them if necessary"). Every object is a circle of radius r and mass m. Only objects that
// are MOVING are tested — a wall of 600 stacks at rest costs nothing — each against the whole list with a
// cheap box reject (see collideObjects for why not a spatial hash). Response is a standard impulse along the contact normal
// with restitution, split by inverse mass, plus positional correction so objects never sit inside each other.
// Consequences match the car path: a stack hit hard bursts, a cone hit hard topples, everything hit counts
// as knocked (moved) for the tally, and hard hits throw dust.
const OBJ_REST = { cone: 0.45, tyre: 0.35, tyrestack: 0.25, bale: 0.08, sheep: 0.2, cow: 0.1 };
// BALE: 250 kg (a real round bale is 250-350), r 0.8. A hit above BALE_BURST_V bursts it: a flat patch of STRAW (no longer solid), a
// big straw-dust cloud, and the car loses BALE_DRAG of its speed on top of the momentum it gave the bale.
const BALE_BURST_V = 5, BALE_DRAG = 0.22;   // restitution by kind; heavy props 0.15
const STACK_BURST_V = 3.8;           // m/s relative speed that bursts a stack (same threshold as the car)

// what TOPPLES when hit (cones; and since 2026-10-04 rally CHEVRON boards, 45 kg on their posts, and FLAG poles, 12 kg — user: "heavy but
// impactable", they had been solid walls, then pass-through)
const TOPPLES = new Set(['cone', 'chevron', 'flag', 'tapepost']);
// ROADSIDE DEBRIS (user, 2026-10-05: "pallets, boxes, crates, wheelie bins, sandbags, barrels, exhaust / bumper, tarps; some should
// BREAK or become DRIVE-OVERABLE after a hit or two, as logic says per object"): mass kg, r m, hits to break (0 = never: it slides),
// and what it breaks INTO (a flat, drive-over patch, like the burst bale's straw). Placed by highway.js LITTER (the density slider).
export const DEBRIS = {
  pallet:   { mass: 20, r: 0.6, breaks: 1, into: 'splinters' },   // snaps first hit
  box:      { mass: 4,  r: 0.4, breaks: 1, into: 'cardboard' },   // flattened
  crate:    { mass: 30, r: 0.55, breaks: 2, into: 'splinters' },
  bin:      { mass: 15, r: 0.4, breaks: 0 },                       // a wheelie bin just tumbles
  sandbag:  { mass: 25, r: 0.45, breaks: 2, into: 'sand' },        // splits on the second
  barrel:   { mass: 18, r: 0.42, breaks: 0 },                       // rolls away
  exhaust:  { mass: 6,  r: 0.5, breaks: 0 },                        // a lost exhaust: skitters
  bumper:   { mass: 8,  r: 0.8, breaks: 0 },
  tarp:     { mass: 3,  r: 0.9, breaks: 0, flat: true },            // always flat: you drive over it (it drags off with you)
};
const BROKEN = new Set(['splinters', 'cardboard', 'sand', 'fluff']);
// ANIMALS (S-C; user 2026-10-06: "Can we make Cows and sheep impactable ? Sheep can be like a tyres impact weight but burst into white
// particles / [cows] should stay solid and be heavier more like hay bails impact weight"; Q5: "no gore ... sheep should explode into white
// fluff over like 30mph ... cows tip over 40mph"). A SHEEP is 12 kg (a tyre): hit above SHEEP_POP_V it bursts into FLUFF (a drive-over
// patch + a white cloud, render.js). A COW is 250 kg (a bale) and stays solid: hit above COW_TIP_V it TIPS onto its side (still solid).
const SHEEP_POP_V = 13.4, COW_TIP_V = 17.9;   // m/s = 30 / 40 mph
// RALLY TAPE: a SECTION between two consecutive posts of one tape snaps when a car crosses it (> TAPE_SNAP_V) or its posts are pulled
// apart (> 1.8 x its rest length); a snapped section sticks to that car with TAPE_STICK chance (render.js trails it as a streamer)
const TAPE_SNAP_V = 1.5, TAPE_STICK = 0.45;
// ...and it GOES (user, 2026-10-04: "tape should vanish into a cloud of particles after multiple hits"): the snap is hit 1; the next
// distinct hit (a car through the gap again, >= TAPE_REHIT s later, or its posts torn further apart) is hit TAPE_GONE: the stubs vanish
// and a PUFF is queued for render.js (red / white flecks)
const TAPE_GONE = 2, TAPE_REHIT = 0.5;
export function createCones({ objectHits = true } = {}) {   // objectHits: false is for harness baselines only
  let list = [], clock = 0, sections = [], puffs = [];
  const hits = [];           // {x, y, speed, kind} drained by render.js each frame for dust

  // a level object -> a live loose object (shared by reset and spawn)
  const live = (c) => ({
      kind: c.kind || 'cone',
      mode: c.kind === 'tyrestack' ? 'stack' : c.kind === 'tyre' ? 'flat' : TOPPLES.has(c.kind) ? 'cone' : c.kind || 'cone',
      x: c.x, y: c.y, hx: c.x, hy: c.y,
      vx: 0, vy: 0, ang: c.rot || 0, spin: 0, down: 0, moved: false,
      mass: DEBRIS[c.kind] ? DEBRIS[c.kind].mass : c.kind === 'sheep' ? 12 : c.kind === 'cow' ? 250 : c.kind === 'tapepost' ? 4 : c.kind === 'banger' ? 1400 : c.kind === 'caravan' ? 1800 : c.kind === 'podium' ? 900 : c.kind === 'bale' ? 250 : c.kind === 'tyrestack' ? 38 : c.kind === 'tyre' ? 12 : c.kind === 'chevron' ? 45 : c.kind === 'flag' ? 12 : 2,
      r: DEBRIS[c.kind] ? DEBRIS[c.kind].r : c.kind === 'sheep' ? 0.55 : c.kind === 'cow' ? 1.0 : c.kind === 'tapepost' ? 0.15 : c.kind === 'banger' ? 2.1 : c.kind === 'caravan' ? 2.4 : c.kind === 'podium' ? 1.7 : c.kind === 'bale' ? 0.8 : c.kind === 'tyrestack' ? 0.48 : c.kind === 'tyre' ? 0.42 : c.kind === 'chevron' ? 1.1 : c.kind === 'flag' ? 0.35 : CONE_R * 1.35,
      col: c.col, tape: c.tape, idx: c.idx, field: c.field,   // field: a highway field's animals go when the field is cleared
      paint: c.paint,
      num: c.num,
      hitCount: 0,
      rollDist: 0,
      flipPhase: 0,
      flipSpeed: 0,
      wobblePhase: 0,
      wobbleAmp: 0,
      _s: c._s,
    });
  function reset() {
    list = CONES.map(live);
    hits.length = 0;
    list.forEach((k, i) => { k._n = i; }); nextN = list.length;
    // the tape SECTIONS: consecutive posts of the same tape
    sections = []; puffs = [];
    const byTape = new Map(); for (const k of list) if (k.kind === 'tapepost') { if (!byTape.has(k.tape)) byTape.set(k.tape, []); byTape.get(k.tape).push(k); }
    for (const ps of byTape.values()) { ps.sort((a, b) => a.idx - b.idx); for (let i = 0; i + 1 < ps.length; i++) if (ps[i + 1].idx === ps[i].idx + 1) sections.push({ a: ps[i], b: ps[i + 1], rest: Math.hypot(ps[i + 1].x - ps[i].x, ps[i + 1].y - ps[i].y), broken: false }); }
    rebuildRestGrid();
  }

  // ONE CAR vs ONE OBJECT (2026-10-04, multi-car: AI cars hit the same cones / tyres / bales). Lifted out of step()'s loop unchanged
  // except continue -> return, so a single car behaves exactly as before (tools/objcheck, tyrewallcheck, balecheck).
  function hitByCar(k, car, newTyres) {
    const s = car.spec, hl = s.len / 2, hw = s.wid / 2, c = Math.cos(car.heading), sn = Math.sin(car.heading);
    // ---- collide with car body
    const rx = k.x - car.x, ry = k.y - car.y;
    if (rx * rx + ry * ry > 16) return;
    if (k.kind === 'straw' || BROKEN.has(k.kind)) return;   // a burst bale / broken debris is a flat patch: you drive through it
    if (k.kind === 'tarp') { const d = Math.hypot(rx, ry); if (d < 1.6 && Math.hypot(car.vx, car.vy) > 3) { k.vx += (car.vx - k.vx) * 0.08; k.vy += (car.vy - k.vy) * 0.08; k.spin += (Math.random() - 0.5) * 2; k.moved = true; } return; }   // dragged along a bit
    if (k.flat) return;                      // a chevron / flag flattened by 2 impacts: driven over
    const lx = rx * c + ry * sn;
    const ly = -rx * sn + ry * c;
    const cx = Math.max(-hl, Math.min(hl, lx));
    const cy = Math.max(-hw, Math.min(hw, ly));
    let dx = lx - cx, dy = ly - cy;
    let dist = Math.hypot(dx, dy);
    const R = k.r;
    if (dist > R) return;

    let nx = 0, ny = 0;
    if (dist < 1e-4) {
      const dRight = hw - ly, dLeft = ly - (-hw);
      const dFront = hl - lx, dBack = lx - (-hl);
      const minD = Math.min(dRight, dLeft, dFront, dBack);
      if (minD === dFront) { nx = 1; ny = 0; }
      else if (minD === dBack) { nx = -1; ny = 0; }
      else if (minD === dRight) { nx = 0; ny = 1; }
      else { nx = 0; ny = -1; }
      dist = 0;
    } else {
      nx = dx / dist;
      ny = dy / dist;
    }
    const wnx = nx * c - ny * sn, wny = nx * sn + ny * c;

    const push = R - dist + 0.01;
    k.x += wnx * push; k.y += wny * push;

    const pvx = car.vx - car.yawRate * (cx * sn + cy * c);
    const pvy = car.vy + car.yawRate * (cx * c - cy * sn);
    const rel = (pvx - k.vx) * wnx + (pvy - k.vy) * wny;
    if (rel <= 0) return;

    // Momentum resistance on car
    const rest = k.kind === 'tyrestack' ? 0.25 : k.kind === 'tyre' ? 0.35 : k.kind === 'sheep' ? 0.2 : k.kind === 'cow' ? 0.1 : RESTITUTION;
    if (k.mass > 5) {
      const impulse = Math.min(k.kind === 'bale' || k.kind === 'cow' ? 8 : 2.5, (rel * k.mass) / s.mass);
      car.vx -= wnx * impulse;
      car.vy -= wny * impulse;
      car.yawRate -= (cx * wny - cy * wnx) * (impulse / (s.len * 0.5));
    }

    k.vx = pvx + wnx * rel * (1 + rest);
    k.vy = pvy + wny * rel * (1 + rest);

    let speed = Math.hypot(k.vx, k.vy);
    if (speed > MAX_CONE_V) {
      k.vx *= MAX_CONE_V / speed; k.vy *= MAX_CONE_V / speed; speed = MAX_CONE_V;
    }
    k.spin += (Math.random() - 0.5) * 6 + car.yawRate * 2;
    k.moved = true;
    k.hitCount = (k.hitCount || 0) + 1;
    // CHEVRONS + FLAGS (user, 2026-10-04: "flat and driven over after 2 impacts"): DISTINCT impacts (contacts > 0.3 s apart; a contact
    // spans several steps); the second leaves it flat on the ground, out of the collisions
    if ((k.kind === 'chevron' || k.kind === 'flag')) { if (clock - (k._lastHit ?? -9) > 0.3) k.impacts = (k.impacts || 0) + 1; k._lastHit = clock;
      if (k.impacts >= 2) { k.flat = true; k.down = 1; k.vx *= 0.3; k.vy *= 0.3; } }

    // DEBRIS that breaks: DISTINCT impacts (> 0.3 s apart, as the chevrons); at `breaks` it becomes its flat patch, out of the collisions
    { const D = DEBRIS[k.kind]; if (D && D.breaks) { if (clock - (k._lastHit ?? -9) > 0.6) k.impacts = (k.impacts || 0) + 1; k._lastHit = clock;   // 0.6 s: one pass through it pushes it along for ~0.4 s (measured) = ONE impact
      if (k.impacts >= D.breaks && rel > 2) { k.kind = D.into; k.mode = 'flat'; k.mass = 40; k.vx *= 0.4; k.vy *= 0.4; k.down = 1;
        for (let q = 0; q < 4 && hits.length < 24; q++) hits.push({ x: k.x + (Math.random() - 0.5) * 1.6, y: k.y + (Math.random() - 0.5) * 1.6, speed: 14, kind: D.into === 'sand' ? 'bale' : 'tyre' }); } } }
    // ANIMALS (S-C): a sheep hit hard POPS into fluff; a cow hit hard TIPS (and stays a 250 kg solid)
    if (k.kind === 'sheep' && rel > SHEEP_POP_V) {
      k.kind = 'fluff'; k.mode = 'flat'; k.mass = 40; k.vx *= 0.3; k.vy *= 0.3; k.down = 1;
      for (let q = 0; q < 5 && hits.length < 24; q++) hits.push({ x: k.x + (Math.random() - 0.5) * 1.6, y: k.y + (Math.random() - 0.5) * 1.6, speed: 16, kind: 'fluff' });
    }
    if (k.kind === 'cow' && rel > COW_TIP_V && !k.tipped) { k.tipped = true; k.spin += (Math.random() - 0.5) * 3; }
    // ---- Tyre stack shattering into 3 dynamic tyres (shared with object-object hits: burstStack)
    if (k.kind === 'bale' && rel > BALE_BURST_V) {
      // BURST: straw everywhere, the car bogged in it
      k.kind = 'straw'; k.mode = 'flat'; k.mass = 60; k.vx *= 0.35; k.vy *= 0.35; k.down = 1;
      car.vx *= 1 - BALE_DRAG; car.vy *= 1 - BALE_DRAG;
      for (let q = 0; q < 5 && hits.length < 24; q++) hits.push({ x: k.x + (Math.random() - 0.5) * 2.4, y: k.y + (Math.random() - 0.5) * 2.4, speed: 18, kind: 'bale' });
    } else if (k.kind === 'tyrestack' && (rel > 3.8 || k.hitCount >= 2)) {
      burstStack(k, newTyres);
    } else if (k.kind === 'tyre') {
      // Hitting an individual tyre can launch it into a roll or flip
      if (speed > 4.0 && Math.random() < 0.45) {
        k.mode = 'roll';
        k.down = 0;
      } else if (speed > 4.0 && Math.random() < 0.50) {
        k.mode = 'flip';
        k.flipPhase = 0;
        k.flipSpeed = 12 + Math.random() * 8;
      } else {
        k.mode = 'flat';
        k.down = 1.0;
      }
    }

    if (speed > TOPPLE_V && k.down === 0 && TOPPLES.has(k.kind)) {
      k.down = 0.001;
      k.ang = Math.atan2(k.vy, k.vx);
    }
    if (hits.length < 24) hits.push({ x: k.x, y: k.y, speed, kind: k.kind });
  }

  // step(car | [cars], dt): objects integrate ONCE per step, then are tested against every car
  // does the segment (ax,ay)-(bx,by) cross the car's box? (Liang-Barsky in the car's frame)
  function crossesCar(car, ax, ay, bx, by) {
    const c = Math.cos(car.heading), s = Math.sin(car.heading), hl = car.spec.len / 2, hw = car.spec.wid / 2;
    const lx0 = (ax - car.x) * c + (ay - car.y) * s, ly0 = -(ax - car.x) * s + (ay - car.y) * c, lx1 = (bx - car.x) * c + (by - car.y) * s, ly1 = -(bx - car.x) * s + (by - car.y) * c;
    let t0 = 0, t1 = 1; const dx = lx1 - lx0, dy = ly1 - ly0;
    for (const [p, q] of [[-dx, lx0 + hl], [dx, hl - lx0], [-dy, ly0 + hw], [dy, hw - ly0]]) {
      if (p === 0) { if (q < 0) return false; continue; }
      const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
    return true;
  }
  function stepTape(cars) {
    const gone = (sct, car) => {
      sct.hits = (sct.hits || 1) + 1; sct.at = clock;
      if (sct.hits < TAPE_GONE) return;
      sct.gone = true;
      for (const p of [sct.a, sct.b]) puffs.push({ x: p.x, y: p.y, vx: car ? car.vx * 0.3 : 0, vy: car ? car.vy * 0.3 : 0 });
    };
    for (const sct of sections) {
      if (sct.gone) continue;
      if (sct.broken) {
        if (clock - (sct.at || 0) < TAPE_REHIT) continue;
        const { a, b } = sct, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        if (Math.hypot(b.x - a.x, b.y - a.y) > sct.rest * 3) { gone(sct, null); continue; }
        for (const car of cars) {
          if ((car.x - mx) ** 2 + (car.y - my) ** 2 > 36) continue;
          if (Math.hypot(car.vx, car.vy) < TAPE_SNAP_V || !crossesCar(car, a.x, a.y, b.x, b.y)) continue;
          gone(sct, car); break;
        }
        continue;
      }
      const { a, b } = sct;
      if (Math.hypot(b.x - a.x, b.y - a.y) > sct.rest * 1.8) { sct.broken = true; continue; }
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      for (const car of cars) {
        if ((car.x - mx) ** 2 + (car.y - my) ** 2 > 36) continue;
        if (Math.hypot(car.vx, car.vy) < TAPE_SNAP_V || !crossesCar(car, a.x, a.y, b.x, b.y)) continue;
        sct.broken = true; sct.at = clock; sct.hits = 1;
        if (Math.random() < TAPE_STICK) (car.streamers || (car.streamers = [])).push({ born: clock, len: 2.5 + Math.random() * 3, phase: Math.random() * 6 });
        if (car.streamers && car.streamers.length > 3) car.streamers.shift();
        break;
      }
    }
  }
  function step(carOrCars, dt) {
    clock += dt;   // sim time: distinct-impact counting (chevrons / flags)
    if (sections.length) stepTape(Array.isArray(carOrCars) ? carOrCars : [carOrCars]);
    const cars = Array.isArray(carOrCars) ? carOrCars : [carOrCars];
    const newTyres = [];

    for (const k of list) {
      const sp = Math.hypot(k.vx, k.vy);

      // ---- integrate movement based on object simulation mode
      if (k.vx || k.vy) {
        k.x += k.vx * dt; k.y += k.vy * dt;

        if (k.mode === 'roll') {
          // Low rolling resistance while rolling upright on tread edge
          const d = Math.exp(-1.4 * dt);
          k.vx *= d; k.vy *= d;
          k.rollDist += sp * dt;
          k.ang = Math.atan2(k.vy, k.vx);
          // When speed slows down below 3.2 m/s, the rolling tyre begins to wobble
          if (sp < 3.2) {
            k.mode = 'wobble';
            k.wobblePhase = 0;
            k.wobbleAmp = 0.2;
          }
        } else if (k.mode === 'flip') {
          // Cartwheeling / flipping end over end
          const d = Math.exp(-2.2 * dt);
          k.vx *= d; k.vy *= d;
          k.flipPhase += k.flipSpeed * dt;
          k.flipSpeed *= Math.exp(-1.6 * dt);
          if (Math.abs(k.flipSpeed) < 1.8 || sp < 1.2) {
            k.mode = 'flat';
            k.down = 1.0;
          }
        } else if (k.mode === 'wobble') {
          // Precessing Euler disc wobble before settling flat
          const d = Math.exp(-2.6 * dt);
          k.vx *= d; k.vy *= d;
          k.wobbleAmp = Math.min(1.0, k.wobbleAmp + dt * 1.6);
          k.wobblePhase += dt * (16 + k.wobbleAmp * 18);
          if (sp < 0.35 || k.wobbleAmp >= 0.95) {
            k.mode = 'flat';
            k.down = 1.0;
            if (hits.length < 24) hits.push({ x: k.x, y: k.y, speed: 2, kind: 'tyre' });
          }
        } else {
          // Flat sliding (tyre, cone, banger, caravan)
          const dragVal = (k.kind === 'banger' || k.kind === 'caravan' || k.kind === 'podium' || k.kind === 'bale' || k.kind === 'straw' || k.kind === 'cow') ? 6.5
            : k.kind === 'tyrestack' || k.kind === 'sheep' ? 4.5 : k.kind === 'tyre' ? 3.8 : k.kind === 'barrel' ? 1.6 : k.kind === 'tarp' ? 5 : BROKEN.has(k.kind) ? 7 : DRAG;
          const d = Math.exp(-dragVal * dt);
          k.vx *= d; k.vy *= d;
        }

        if (sp < REST_V) { k.vx = 0; k.vy = 0; k.over = false; k.overTried = false; }
        else hitWalls(k);
      }

      if (k.spin) {
        k.ang += k.spin * dt;
        k.spin *= Math.exp(-SPIN_DRAG * dt);
        if (Math.abs(k.spin) < 0.05) k.spin = 0;
      }

      if (k.down > 0 && k.down < 1) k.down = Math.min(1, k.down + dt * 6);
      k.x = Math.max(FX0, Math.min(FX1, k.x));   // the floor rectangle (S-B: the lab is 520 x 1000)
      k.y = Math.max(FY0, Math.min(FY1, k.y));

      // MOVING (or not yet re-filed) objects test every car here; RESTING ones are found per car from the grid below (MEASURED, 5 AI on
      // Thruston: testing all ~1100 objects against all 6 cars was 18 % of the frame)
      if (k.vx || k.vy || k._ck !== cellKey(k.x, k.y)) for (let ci = 0; ci < cars.length; ci++) hitByCar(k, cars[ci], newTyres);
    }

    for (let ci = 0; ci < cars.length; ci++) {
      const car = cars[ci], gx = Math.floor(car.x / OBJ_CELL), gy = Math.floor(car.y / OBJ_CELL), cand = [];
      for (let ix = gx - 2; ix <= gx + 2; ix++) for (let iy = gy - 2; iy <= gy + 2; iy++) {
        const cell = restGrid.get(ix * 65536 + iy); if (!cell) continue;
        for (let q = 0; q < cell.length; q++) { const b = cell[q]; if (!b.vx && !b.vy && b._ck === cellKey(b.x, b.y)) cand.push(b); }
      }
      // IN LIST ORDER (MEASURED: grid-cell order changed which stack the car met first — each hit slows the car — and a Stock Car wall
      // crash knocked on 9-11 objects instead of 15, tools/objcheck). _n = a fixed creation index.
      cand.sort((p, q) => p._n - q._n); for (const b of cand) hitByCar(b, car, newTyres);
    }
    if (newTyres.length > 0) {
      for (const t of newTyres) t._n = nextN++;
      list.push(...newTyres);
    }
    if (objectHits) collideObjects(dt);
  }

  // A PERSISTENT GRID of the objects AT REST, built once per level (reset) — they do not move, so it stays
  // valid. Each step only the MOVING objects are tested: against the resting objects in their 3x3 cells,
  // and against each other directly (there are only ever a handful). An object that comes to rest is filed
  // into the cell it stopped in. MEASURED 2026-10-03 (tools/objcheck.mjs, car into the Stock Car wall):
  //   grid rebuilt every step ..... 446 us/step mean with debris flying
  //   movers vs whole list ........ 437-626 us (noisy; the list is 633 long)
  //   this ........................ see objcheck — the figure is written into ENGINE.md
  let nextN = 0;
  const OBJ_CELL = 2.5;              // m; larger than any moving object's diameter
  const restGrid = new Map();        // cell key -> objects at rest in it
  const cellKey = (x, y) => Math.floor(x / OBJ_CELL) * 65536 + Math.floor(y / OBJ_CELL);
  function fileAtRest(k) {
    const key = cellKey(k.x, k.y);
    if (k._ck === key) return;
    if (k._ck !== undefined) { const old = restGrid.get(k._ck); if (old) { const i = old.indexOf(k); if (i >= 0) old.splice(i, 1); } }
    k._ck = key;
    const cell = restGrid.get(key);
    if (cell) cell.push(k); else restGrid.set(key, [k]);
  }
  function rebuildRestGrid() { restGrid.clear(); for (const k of list) { k._ck = undefined; fileAtRest(k); } }
  const movers = [];
  let prevMovers = [];
  const burst = [];                  // reused every step
  // ONE pair test, defined once. MEASURED 2026-10-03 (objcheck, same-run baseline): building this as a closure
  // every step and looping over a fresh [a, b] array per contact cost ~140 us/step over the no-collision path.
  function touch(k, rel) {
    k.moved = true;
    k.hitCount = (k.hitCount || 0) + 1;
    if (TOPPLES.has(k.kind) && k.down === 0 && rel > TOPPLE_V) { k.down = 0.001; k.ang = Math.atan2(k.vy, k.vx); }
  }
  function pair(a, b) {
    if (a.kind === 'straw' || b.kind === 'straw' || a.flat || b.flat || BROKEN.has(a.kind) || BROKEN.has(b.kind) || a.kind === 'tarp' || b.kind === 'tarp') return;
    const R = a.r + b.r;
    const dx = b.x - a.x, dy = b.y - a.y;
    if (dx > R || dx < -R || dy > R || dy < -R) return;
    const d = Math.hypot(dx, dy);
    if (d >= R || d < 1e-6) return;
    const nx = dx / d, ny = dy / d;
    const ia = 1 / a.mass, ib = 1 / b.mass, is = ia + ib;
    // push apart, shared by inverse mass
    const pen = R - d;
    a.x -= nx * pen * ia / is; a.y -= ny * pen * ia / is;
    b.x += nx * pen * ib / is; b.y += ny * pen * ib / is;
    const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;   // closing speed along the normal
    if (rel <= 0) return;
    const e = Math.min(OBJ_REST[a.kind] ?? 0.15, OBJ_REST[b.kind] ?? 0.15);
    const j = ((1 + e) * rel) / is;
    a.vx -= j * ia * nx; a.vy -= j * ia * ny;
    b.vx += j * ib * nx; b.vy += j * ib * ny;
    // a glancing blow sets the struck object spinning
    b.spin += ((a.vx - b.vx) * -ny + (a.vy - b.vy) * nx) * 0.8;
    touch(a, rel); touch(b, rel);
    if (b.kind === 'tyrestack' && rel > STACK_BURST_V) burstStack(b, burst);
    if (a.kind === 'tyrestack' && rel > STACK_BURST_V) burstStack(a, burst);
    if (rel > 2 && hits.length < 24) hits.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, speed: rel, kind: b.kind });
  }
  function collideObjects(dt) {
    movers.length = 0;
    for (let i = 0; i < list.length; i++) { const k = list[i]; if (k.vx || k.vy) { k._i = i; movers.push(k); } }
    // anything that was moving last step and has now stopped is filed where it stopped
    for (let i = 0; i < prevMovers.length; i++) { const k = prevMovers[i]; if (!k.vx && !k.vy) fileAtRest(k); }
    prevMovers.length = 0; for (let i = 0; i < movers.length; i++) prevMovers.push(movers[i]);
    if (!movers.length) return;
    burst.length = 0;
    for (let m = 0; m < movers.length; m++) {
      const a = movers[m];
      // movers against each other, each pair once
      for (let n = m + 1; n < movers.length; n++) pair(a, movers[n]);
      // movers against whatever is resting in the 3x3 cells around them (skip ones that have since moved)
      const gx = Math.floor(a.x / OBJ_CELL), gy = Math.floor(a.y / OBJ_CELL);
      for (let ix = gx - 1; ix <= gx + 1; ix++) for (let iy = gy - 1; iy <= gy + 1; iy++) {
        const cell = restGrid.get(ix * 65536 + iy);
        if (!cell) continue;
        for (let q = 0; q < cell.length; q++) { const b = cell[q]; if (b !== a && !b.vx && !b.vy) pair(a, b); }
      }
    }
    if (burst.length) { for (const t of burst) t._n = nextN++; list.push(...burst); }
  }

  reset();         // after the grid helpers above exist
  return {
    get list() { return list; },
    get tapes() { return sections; },
    get tapePuffs() { return puffs; },
    get clock() { return clock; },
    get hits() { return hits; },
    drainHits() {
      const copy = hits.slice();
      hits.length = 0;
      return copy;
    },
    // CONES ONLY (user, 2026-10-04: "the cone counter should only count cones, not tyres too") — tyre walls, bales etc. are not the course
    get knocked() { return list.reduce((n, k) => n + (k.kind === 'cone' && (k.down > 0.5 || k.moved) ? 1 : 0), 0); },
    get total() { return list.reduce((n, k) => n + (k.kind === 'cone' ? 1 : 0), 0); },
    step, reset,
    // a loose object made during play (DAMAGE: a torn-off wheel) — a rolling tyre with everything the list's tyres carry
    add(o) { list.push({ kind: 'tyre', mode: 'roll', mass: 12, r: 0.42, hx: o.x, hy: o.y, moved: true, hitCount: 1, down: 0, ang: 0, spin: 0,
      flipPhase: 0, flipSpeed: 0, wobblePhase: 0, wobbleAmp: 0, rollDist: 0, ...o, _n: nextN++ }); },
    rebuildGrid: rebuildRestGrid,   // for harnesses that add objects by hand (tools/objcheck.mjs)
    // STREAMED objects (the endless highway, 2026-10-05: "littered with tyres and cones, chevrons for the corners"): spawn() adds level
    // objects as the road grows ahead; cull(keep) drops every object keep() rejects (the road behind) and refiles the rest grid
    spawn(objs) { for (const c of objs) { const k = live(c); k._n = nextN++; list.push(k); fileAtRest(k); } },
    cull(keep) { const n = list.length; list = list.filter(keep); if (list.length !== n) rebuildRestGrid(); return n - list.length; },
  };
}
