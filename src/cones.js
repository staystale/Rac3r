// cones.js — knockable cones, tyre stacks, and individual tyres with realistic simulated dynamics.
// Cones topple and slide. Tyre stacks absorb momentum, and shatter into individual tyres
// that roll upright on their tread, tumble/flip, wobble, and slide flat on the floor.

import { CONES, LEVEL } from "./world/state.ts";
import { FX0, FX1, FY0, FY1 } from "./world/bounds.ts";
import { BARRIER_HALF } from "./world/barriers.ts";
const WALL_E = 0.3, WALL_SCRAPE = 0.8, OVER_V = 9, OVER_CHANCE = 0.3;
function hitWalls(cone) {
  const radius = cone.r || 0.3;
  if (cone.over) return;
  const speed = Math.hypot(cone.vx, cone.vy);
  const bounce = (nx, ny, push) => {
    if (speed > OVER_V && !cone.overTried) {
      cone.overTried = true;
      if (Math.random() < OVER_CHANCE) { cone.over = true; return; }
    }
    cone.x += nx * push; cone.y += ny * push;
    const normalSpeed = cone.vx * nx + cone.vy * ny;
    if (normalSpeed < 0) {
      const tangentX = -ny, tangentY = nx, tangentSpeed = cone.vx * tangentX + cone.vy * tangentY;
      cone.vx = nx * -normalSpeed * WALL_E + tangentX * tangentSpeed * WALL_SCRAPE;
      cone.vy = ny * -normalSpeed * WALL_E + tangentY * tangentSpeed * WALL_SCRAPE;
      cone.spin = (cone.spin || 0) * 0.5;
    }
  };
  for (const barrier of LEVEL.barriers || []) {
    const half = BARRIER_HALF[barrier.kind]; if (!half || !barrier._segs) continue;
    for (const segment of barrier._segs) {
      if (cone.x < segment.minX - radius || cone.x > segment.maxX + radius || cone.y
          < segment.minY - radius || cone.y > segment.maxY + radius) continue;
      let along = ((cone.x - segment.ax) * segment.dx + (cone.y - segment.ay) * segment.dy)
          / segment.l2;
      along = along < 0 ? 0 : along > 1 ? 1 : along;
      const nearX = segment.ax + segment.dx * along, nearY = segment.ay + segment.dy * along,
          dx = cone.x - nearX, dy = cone.y - nearY, dist = Math.hypot(dx, dy);
      if (dist >= half + radius) continue;
      if (dist < 1e-6) {
        bounce(-segment.dy / Math.sqrt(segment.l2), segment.dx / Math.sqrt(segment.l2), half
            + radius);
      } else bounce(dx / dist, dy / dist, half + radius - dist);
      if (cone.over) return;
    }
  }
  for (const solid of LEVEL.solids || []) {
    const dx = cone.x - solid.x, dy = cone.y - solid.y;
    if (dx * dx + dy * dy > (solid.r + radius) ** 2) continue;
    const cosRot = Math.cos(solid.rot), sinRot = Math.sin(solid.rot), localU = dx * cosRot + dy
        * sinRot, localV = -dx * sinRot + dy * cosRot;
    const clampU = Math.max(-solid.w / 2, Math.min(solid.w / 2, localU)),
        clampV = Math.max(-solid.h / 2, Math.min(solid.h / 2, localV)), edgeU = localU - clampU,
        edgeV = localV - clampV, dist = Math.hypot(edgeU, edgeV);
    if (dist >= radius) continue;
    let normalU, normalV, push;
    if (dist > 1e-6) {
      normalU = edgeU / dist;
      normalV = edgeV / dist;
      push = radius - dist;
    } else { const penU = solid.w / 2 - Math.abs(localU), penV = solid.h / 2
        - Math.abs(localV); if (penU < penV) { normalU = Math.sign(localU)
        || 1; normalV = 0; push = penU + radius; } else { normalU = 0; normalV = Math.sign(localV)
        || 1; push = penV + radius; } }
    bounce(normalU * cosRot - normalV * sinRot, normalU * sinRot + normalV * cosRot, push);
    if (cone.over) return;
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
// cartwheeling left, one skidding flat right. Used by the car hitting a stack AND (2026-10-03) by
// any other object hitting one, so a tyre flung into the wall bursts the stack it lands on.
function burstStack(stack, out) {
  stack.kind = 'tyre';
  stack.mode = 'roll';
  stack.mass = 12;
  stack.r = 0.42;
  stack.down = 0;
  const baseAng = Math.atan2(stack.vy, stack.vx);
  const spHit = Math.hypot(stack.vx, stack.vy);
  const angL = baseAng + 0.55, angR = baseAng - 0.55;
  // _s: the road distance it belongs to (streamed levels drop it with that stretch of road)
  const common = {
    kind: 'tyre', hx: stack.hx, hy: stack.hy, moved: true, mass: 12, r: 0.42, hitCount: 1,
        wobblePhase: 0, wobbleAmp: 0, rollDist: 0, _s: stack._s
  };
  out.push({ ...common, mode: 'flip', x: stack.x + Math.cos(angL) * 0.45, y: stack.y
      + Math.sin(angL) * 0.45,
    vx: Math.cos(angL) * spHit * 0.90, vy: Math.sin(angL) * spHit * 0.90, ang: angL,
    spin: (Math.random() - 0.5) * 6, down: 0.5, flipPhase: 0, flipSpeed: 14 + Math.random() * 8 });
  out.push({ ...common, mode: 'flat', x: stack.x + Math.cos(angR) * 0.45, y: stack.y
      + Math.sin(angR) * 0.45,
    vx: Math.cos(angR) * spHit * 0.85, vy: Math.sin(angR) * spHit * 0.85, ang: angR,
    spin: (Math.random() - 0.5) * 12, down: 1.0, flipPhase: 0, flipSpeed: 0 });
}

// OBJECT-OBJECT COLLISIONS (user, 2026-10-03: "tyres should hit other tyres and cones or objects
// etc and pass impact onto them if necessary"). Every object is a circle of radius r and mass m.
// Only objects that are MOVING are tested — a wall of 600 stacks at rest costs nothing — each
// against the whole list with a cheap box reject (see collideObjects for why not a spatial hash).
// Response is a standard impulse along the contact normal with restitution, split by inverse mass,
// plus positional correction so objects never sit inside each other. Consequences match the car
// path: a stack hit hard bursts, a cone hit hard topples, everything hit counts as knocked (moved)
// for the tally, and hard hits throw dust.
const OBJ_REST = { cone: 0.45, tyre: 0.35, tyrestack: 0.25, bale: 0.08, sheep: 0.2, cow: 0.1 };
// BALE: 250 kg (a real round bale is 250-350), r 0.8. A hit above BALE_BURST_V bursts it: a flat
// patch of STRAW (no longer solid), a big straw-dust cloud, and the car loses BALE_DRAG of its
// speed on top of the momentum it gave the bale.
const BALE_BURST_V = 5, BALE_DRAG = 0.22;   // restitution by kind; heavy props 0.15
// m/s relative speed that bursts a stack (same threshold as the car)
const STACK_BURST_V = 3.8;

// what TOPPLES when hit (cones; and since 2026-10-04 rally CHEVRON boards, 45 kg on their posts,
// and FLAG poles, 12 kg — user: "heavy but impactable", they had been solid walls, then
// pass-through)
const TOPPLES = new Set(['cone', 'chevron', 'flag', 'tapepost']);
// ROADSIDE DEBRIS (user, 2026-10-05: "pallets, boxes, crates, wheelie bins, sandbags, barrels,
// exhaust / bumper, tarps; some should BREAK or become DRIVE-OVERABLE after a hit or two, as logic
// says per object"): mass kg, r m, hits to break (0 = never: it slides), and what it breaks INTO (a
// flat, drive-over patch, like the burst bale's straw). Placed by highway.js LITTER (the density
// slider).
export const DEBRIS = {
  pallet:   { mass: 20, r: 0.6, breaks: 1, into: 'splinters' },   // snaps first hit
  box:      { mass: 4,  r: 0.4, breaks: 1, into: 'cardboard' },   // flattened
  crate:    { mass: 30, r: 0.55, breaks: 2, into: 'splinters' },
  bin:      { mass: 15, r: 0.4, breaks: 0 },                       // a wheelie bin just tumbles
  sandbag:  { mass: 25, r: 0.45, breaks: 2, into: 'sand' },        // splits on the second
  barrel:   { mass: 18, r: 0.42, breaks: 0 },                       // rolls away
  exhaust:  { mass: 6,  r: 0.5, breaks: 0 },                        // a lost exhaust: skitters
  bumper:   { mass: 8,  r: 0.8, breaks: 0 },
  // always flat: you drive over it (it drags off with you)
  tarp:     { mass: 3,  r: 0.9, breaks: 0, flat: true },
};
const BROKEN = new Set(['splinters', 'cardboard', 'sand', 'fluff']);
// ANIMALS (S-C; user 2026-10-06: "Can we make Cows and sheep impactable ? Sheep can be like a tyres
// impact weight but burst into white particles / [cows] should stay solid and be heavier more like
// hay bails impact weight"; Q5: "no gore ... sheep should explode into white fluff over like 30mph
// ... cows tip over 40mph"). A SHEEP is 12 kg (a tyre): hit above SHEEP_POP_V it bursts into FLUFF
// (a drive-over patch + a white cloud, render.ts). A COW is 250 kg (a bale) and stays solid: hit
// above COW_TIP_V it TIPS onto its side (still solid).
const SHEEP_POP_V = 13.4, COW_TIP_V = 17.9;   // m/s = 30 / 40 mph
// RALLY TAPE: a SECTION between two consecutive posts of one tape snaps when a car crosses it (>
// TAPE_SNAP_V) or its posts are pulled apart (> 1.8 x its rest length); a snapped section sticks to
// that car with TAPE_STICK chance (render.ts trails it as a streamer)
const TAPE_SNAP_V = 1.5, TAPE_STICK = 0.45;
// ...and it GOES (user, 2026-10-04: "tape should vanish into a cloud of particles after multiple
// hits"): the snap is hit 1; the next distinct hit (a car through the gap again, >= TAPE_REHIT s
// later, or its posts torn further apart) is hit TAPE_GONE: the stubs vanish and a PUFF is queued
// for render.ts (red / white flecks)
const TAPE_GONE = 2, TAPE_REHIT = 0.5;
// objectHits: false is for harness baselines only
export function createCones({ objectHits = true } = {}) {
  let list = [], clock = 0, sections = [], puffs = [];
  const hits = [];           // {x, y, speed, kind} drained by render.ts each frame for dust

  // a level object -> a live loose object (shared by reset and spawn)
  const live = (levelObj) => ({
      kind: levelObj.kind || 'cone',
      mode: levelObj.kind === 'tyrestack' ? 'stack' : levelObj.kind === 'tyre' ? 'flat'
          : TOPPLES.has(levelObj.kind) ? 'cone' : levelObj.kind || 'cone',
      x: levelObj.x, y: levelObj.y, hx: levelObj.x, hy: levelObj.y,
      vx: 0, vy: 0, ang: levelObj.rot || 0, spin: 0, down: 0, moved: false,
      mass: DEBRIS[levelObj.kind] ? DEBRIS[levelObj.kind].mass : levelObj.kind === 'sheep' ? 12
          : levelObj.kind === 'cow' ? 250 : levelObj.kind === 'tapepost' ? 4 : levelObj.kind
          === 'banger' ? 1400 : levelObj.kind === 'caravan' ? 1800 : levelObj.kind === 'podium'
          ? 900 : levelObj.kind === 'bale' ? 250 : levelObj.kind === 'tyrestack' ? 38
          : levelObj.kind === 'tyre' ? 12 : levelObj.kind === 'chevron' ? 45 : levelObj.kind
          === 'flag' ? 12 : 2,
      r: DEBRIS[levelObj.kind] ? DEBRIS[levelObj.kind].r : levelObj.kind === 'sheep' ? 0.55
          : levelObj.kind === 'cow' ? 1.0 : levelObj.kind === 'tapepost' ? 0.15 : levelObj.kind
          === 'banger' ? 2.1 : levelObj.kind === 'caravan' ? 2.4 : levelObj.kind === 'podium'
          ? 1.7 : levelObj.kind === 'bale' ? 0.8 : levelObj.kind === 'tyrestack' ? 0.48
          : levelObj.kind === 'tyre' ? 0.42 : levelObj.kind === 'chevron' ? 1.1 : levelObj.kind
          === 'flag' ? 0.35 : CONE_R * 1.35,
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
    });
  function reset() {
    list = CONES.map(live);
    hits.length = 0;
    list.forEach((obj, i) => { obj._n = i; }); nextN = list.length;
    // the tape SECTIONS: consecutive posts of the same tape
    sections = []; puffs = [];
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
    rebuildRestGrid();
  }

  // ONE CAR vs ONE OBJECT (2026-10-04, multi-car: AI cars hit the same cones / tyres / bales).
  // Lifted out of step()'s loop unchanged except continue -> return, so a single car behaves
  // exactly as before (tools/objcheck, tyrewallcheck, balecheck).
  function hitByCar(obj, car, newTyres) {
    const spec = car.spec, halfLen = spec.len / 2, halfWid = spec.wid / 2,
        cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
    // ---- collide with car body
    const relX = obj.x - car.x, relY = obj.y - car.y;
    if (relX * relX + relY * relY > 16) return;
    // a burst bale / broken debris is a flat patch: you drive through it
    if (obj.kind === 'straw' || BROKEN.has(obj.kind)) return;
    // dragged along a bit
    if (obj.kind === 'tarp') {
      const gap = Math.hypot(relX, relY);
      if (gap < 1.6 && Math.hypot(car.vx, car.vy) > 3) {
        obj.vx += (car.vx - obj.vx) * 0.08;
        obj.vy += (car.vy - obj.vy) * 0.08;
        obj.spin += (Math.random() - 0.5) * 2;
        obj.moved = true;
      } return;
    }
    // a chevron / flag flattened by 2 impacts: driven over
    if (obj.flat) return;
    const localX = relX * cosH + relY * sinH;
    const localY = -relX * sinH + relY * cosH;
    const nearX = Math.max(-halfLen, Math.min(halfLen, localX));
    const nearY = Math.max(-halfWid, Math.min(halfWid, localY));
    let dx = localX - nearX, dy = localY - nearY;
    let dist = Math.hypot(dx, dy);
    const reach = obj.r;
    if (dist > reach) return;

    let nx = 0, ny = 0;
    if (dist < 1e-4) {
      const dRight = halfWid - localY, dLeft = localY - (-halfWid);
      const dFront = halfLen - localX, dBack = localX - (-halfLen);
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
    const wnx = nx * cosH - ny * sinH, wny = nx * sinH + ny * cosH;

    const push = reach - dist + 0.01;
    obj.x += wnx * push; obj.y += wny * push;

    const pvx = car.vx - car.yawRate * (nearX * sinH + nearY * cosH);
    const pvy = car.vy + car.yawRate * (nearX * cosH - nearY * sinH);
    const rel = (pvx - obj.vx) * wnx + (pvy - obj.vy) * wny;
    if (rel <= 0) return;

    // Momentum resistance on car
    const rest = obj.kind === 'tyrestack' ? 0.25 : obj.kind === 'tyre' ? 0.35 : obj.kind
        === 'sheep' ? 0.2 : obj.kind === 'cow' ? 0.1 : RESTITUTION;
    if (obj.mass > 5) {
      const impulse = Math.min(obj.kind === 'bale' || obj.kind === 'cow' ? 8 : 2.5, (rel
          * obj.mass) / spec.mass);
      car.vx -= wnx * impulse;
      car.vy -= wny * impulse;
      car.yawRate -= (nearX * wny - nearY * wnx) * (impulse / (spec.len * 0.5));
    }

    obj.vx = pvx + wnx * rel * (1 + rest);
    obj.vy = pvy + wny * rel * (1 + rest);

    let speed = Math.hypot(obj.vx, obj.vy);
    if (speed > MAX_CONE_V) {
      obj.vx *= MAX_CONE_V / speed; obj.vy *= MAX_CONE_V / speed; speed = MAX_CONE_V;
    }
    obj.spin += (Math.random() - 0.5) * 6 + car.yawRate * 2;
    obj.moved = true;
    obj.hitCount = (obj.hitCount || 0) + 1;
    // CHEVRONS + FLAGS (user, 2026-10-04: "flat and driven over after 2 impacts"): DISTINCT
    // impacts (contacts > 0.3 s apart; a contact
    // spans several steps); the second leaves it flat on the ground, out of the collisions
    if ((obj.kind === 'chevron' || obj.kind === 'flag')) {
      if (clock - (obj._lastHit ?? -9) > 0.3) obj.impacts = (obj.impacts || 0) + 1;
      obj._lastHit = clock;
      if (obj.impacts >= 2) { obj.flat = true; obj.down = 1; obj.vx *= 0.3; obj.vy *= 0.3; }
    }

    // DEBRIS that breaks: DISTINCT impacts (> 0.3 s apart, as the chevrons); at `breaks` it
    // becomes its flat patch, out of the collisions
    {
      const debris = DEBRIS[obj.kind];
      if (debris && debris.breaks) {
        // 0.6 s: one pass through it pushes it along for ~0.4 s (measured) = ONE impact
        if (clock - (obj._lastHit ?? -9) > 0.6) obj.impacts = (obj.impacts || 0) + 1;
        obj._lastHit = clock;
        if (obj.impacts >= debris.breaks && rel > 2) {
          obj.kind = debris.into; obj.mode = 'flat'; obj.mass = 40;
          obj.vx *= 0.4; obj.vy *= 0.4; obj.down = 1;
          for (let dust = 0; dust < 4 && hits.length < 24; dust++)
            hits.push({
              x: obj.x + (Math.random() - 0.5) * 1.6, y: obj.y + (Math.random() - 0.5) * 1.6,
              speed: 14, kind: debris.into === 'sand' ? 'bale' : 'tyre'
            });
        }
      }
    }
    // ANIMALS (S-C): a sheep hit hard POPS into fluff; a cow hit hard TIPS (and stays a 250 kg
    // solid)
    if (obj.kind === 'sheep' && rel > SHEEP_POP_V) {
      obj.kind = 'fluff';
      obj.mode = 'flat';
      obj.mass = 40;
      obj.vx *= 0.3;
      obj.vy *= 0.3;
      obj.down = 1;
      for (let dust = 0; dust < 5 && hits.length < 24; dust++) hits.push({ x: obj.x
          + (Math.random() - 0.5) * 1.6, y: obj.y + (Math.random() - 0.5) * 1.6, speed: 16,
          kind: 'fluff' });
    }
    if (obj.kind === 'cow' && rel > COW_TIP_V && !obj.tipped) {
      obj.tipped = true;
      obj.spin += (Math.random() - 0.5) * 3;
    }
    // ---- Tyre stack shattering into 3 dynamic tyres (shared with object-object hits: burstStack)
    if (obj.kind === 'bale' && rel > BALE_BURST_V) {
      // BURST: straw everywhere, the car bogged in it
      obj.kind = 'straw';
      obj.mode = 'flat';
      obj.mass = 60;
      obj.vx *= 0.35;
      obj.vy *= 0.35;
      obj.down = 1;
      car.vx *= 1 - BALE_DRAG; car.vy *= 1 - BALE_DRAG;
      for (let dust = 0; dust < 5 && hits.length < 24; dust++) hits.push({ x: obj.x
          + (Math.random() - 0.5) * 2.4, y: obj.y + (Math.random() - 0.5) * 2.4, speed: 18,
          kind: 'bale' });
    } else if (obj.kind === 'tyrestack' && (rel > 3.8 || obj.hitCount >= 2)) {
      burstStack(obj, newTyres);
    } else if (obj.kind === 'tyre') {
      // Hitting an individual tyre can launch it into a roll or flip
      if (speed > 4.0 && Math.random() < 0.45) {
        obj.mode = 'roll';
        obj.down = 0;
      } else if (speed > 4.0 && Math.random() < 0.50) {
        obj.mode = 'flip';
        obj.flipPhase = 0;
        obj.flipSpeed = 12 + Math.random() * 8;
      } else {
        obj.mode = 'flat';
        obj.down = 1.0;
      }
    }

    if (speed > TOPPLE_V && obj.down === 0 && TOPPLES.has(obj.kind)) {
      obj.down = 0.001;
      obj.ang = Math.atan2(obj.vy, obj.vx);
    }
    if (hits.length < 24) hits.push({ x: obj.x, y: obj.y, speed, kind: obj.kind });
  }

  // step(car | [cars], dt): objects integrate ONCE per step, then are tested against every car
  // does the segment (ax,ay)-(bx,by) cross the car's box? (Liang-Barsky in the car's frame)
  function crossesCar(car, fromX, fromY, toX, toY) {
    const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading), halfLen = car.spec.len / 2,
        halfWid = car.spec.wid / 2;
    const lx0 = (fromX - car.x) * cosH + (fromY - car.y) * sinH, ly0 = -(fromX - car.x) * sinH
        + (fromY - car.y) * cosH, lx1 = (toX - car.x) * cosH + (toY - car.y) * sinH, ly1 = -(toX
        - car.x) * sinH + (toY - car.y) * cosH;
    let enter = 0, leave = 1; const dx = lx1 - lx0, dy = ly1 - ly0;
    for (const [delta, bound] of [[-dx, lx0 + halfLen], [dx, halfLen - lx0], [-dy, ly0 + halfWid],
        [dy, halfWid - ly0]]) {
      if (delta === 0) { if (bound < 0) return false; continue; }
      const ratio = bound / delta;
      if (delta < 0) {
        if (ratio > leave) return false;
        if (ratio > enter) enter = ratio;
      } else { if (ratio < enter) return false; if (ratio < leave) leave = ratio; }
    }
    return true;
  }
  function stepTape(cars) {
    const gone = (sct, car) => {
      sct.hits = (sct.hits || 1) + 1; sct.at = clock;
      if (sct.hits < TAPE_GONE) return;
      sct.gone = true;
      for (const post of [sct.a, sct.b]) puffs.push({ x: post.x, y: post.y, vx: car ? car.vx * 0.3
          : 0, vy: car ? car.vy * 0.3 : 0 });
    };
    for (const sct of sections) {
      if (sct.gone) continue;
      if (sct.broken) {
        if (clock - (sct.at || 0) < TAPE_REHIT) continue;
        const { a, b } = sct, midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
        if (Math.hypot(b.x - a.x, b.y - a.y) > sct.rest * 3) { gone(sct, null); continue; }
        for (const car of cars) {
          if ((car.x - midX) ** 2 + (car.y - midY) ** 2 > 36) continue;
          if (Math.hypot(car.vx, car.vy) < TAPE_SNAP_V || !crossesCar(car, a.x, a.y, b.x,
              b.y)) continue;
          gone(sct, car); break;
        }
        continue;
      }
      const { a, b } = sct;
      if (Math.hypot(b.x - a.x, b.y - a.y) > sct.rest * 1.8) { sct.broken = true; continue; }
      const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
      for (const car of cars) {
        if ((car.x - midX) ** 2 + (car.y - midY) ** 2 > 36) continue;
        if (Math.hypot(car.vx, car.vy) < TAPE_SNAP_V || !crossesCar(car, a.x, a.y, b.x,
            b.y)) continue;
        sct.broken = true; sct.at = clock; sct.hits = 1;
        if (Math.random() < TAPE_STICK) (car.streamers
            || (car.streamers = [])).push({ born: clock, len: 2.5 + Math.random() * 3,
            phase: Math.random() * 6 });
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

    for (const obj of list) {
      const speed = Math.hypot(obj.vx, obj.vy);

      // ---- integrate movement based on object simulation mode
      if (obj.vx || obj.vy) {
        obj.x += obj.vx * dt; obj.y += obj.vy * dt;

        if (obj.mode === 'roll') {
          // Low rolling resistance while rolling upright on tread edge
          const decay = Math.exp(-1.4 * dt);
          obj.vx *= decay; obj.vy *= decay;
          obj.rollDist += speed * dt;
          obj.ang = Math.atan2(obj.vy, obj.vx);
          // When speed slows down below 3.2 m/s, the rolling tyre begins to wobble
          if (speed < 3.2) {
            obj.mode = 'wobble';
            obj.wobblePhase = 0;
            obj.wobbleAmp = 0.2;
          }
        } else if (obj.mode === 'flip') {
          // Cartwheeling / flipping end over end
          const decay = Math.exp(-2.2 * dt);
          obj.vx *= decay; obj.vy *= decay;
          obj.flipPhase += obj.flipSpeed * dt;
          obj.flipSpeed *= Math.exp(-1.6 * dt);
          if (Math.abs(obj.flipSpeed) < 1.8 || speed < 1.2) {
            obj.mode = 'flat';
            obj.down = 1.0;
          }
        } else if (obj.mode === 'wobble') {
          // Precessing Euler disc wobble before settling flat
          const decay = Math.exp(-2.6 * dt);
          obj.vx *= decay; obj.vy *= decay;
          obj.wobbleAmp = Math.min(1.0, obj.wobbleAmp + dt * 1.6);
          obj.wobblePhase += dt * (16 + obj.wobbleAmp * 18);
          if (speed < 0.35 || obj.wobbleAmp >= 0.95) {
            obj.mode = 'flat';
            obj.down = 1.0;
            if (hits.length < 24) hits.push({ x: obj.x, y: obj.y, speed: 2, kind: 'tyre' });
          }
        } else {
          // Flat sliding (tyre, cone, banger, caravan)
          const dragVal = (obj.kind === 'banger' || obj.kind === 'caravan' || obj.kind
              === 'podium' || obj.kind === 'bale' || obj.kind === 'straw' || obj.kind === 'cow')
              ? 6.5
            : obj.kind === 'tyrestack' || obj.kind === 'sheep' ? 4.5 : obj.kind === 'tyre' ? 3.8
                : obj.kind === 'barrel' ? 1.6 : obj.kind === 'tarp' ? 5 : BROKEN.has(obj.kind) ? 7
                : DRAG;
          const decay = Math.exp(-dragVal * dt);
          obj.vx *= decay; obj.vy *= decay;
        }

        if (speed < REST_V) { obj.vx = 0; obj.vy = 0; obj.over = false; obj.overTried = false; }
        else hitWalls(obj);
      }

      if (obj.spin) {
        obj.ang += obj.spin * dt;
        obj.spin *= Math.exp(-SPIN_DRAG * dt);
        if (Math.abs(obj.spin) < 0.05) obj.spin = 0;
      }

      if (obj.down > 0 && obj.down < 1) obj.down = Math.min(1, obj.down + dt * 6);
      // the floor rectangle (S-B: the lab is 520 x 1000)
      obj.x = Math.max(FX0, Math.min(FX1, obj.x));
      obj.y = Math.max(FY0, Math.min(FY1, obj.y));

      // MOVING (or not yet re-filed) objects test every car here; RESTING ones are found per car
      // from the grid below (MEASURED, 5 AI on
      // Thruston: testing all ~1100 objects against all 6 cars was 18 % of the frame)
      if (obj.vx || obj.vy || obj._ck !== cellKey(obj.x, obj.y)) for (let carIndex = 0; carIndex
          < cars.length; carIndex++) hitByCar(obj, cars[carIndex], newTyres);
    }

    for (let carIndex = 0; carIndex < cars.length; carIndex++) {
      const car = cars[carIndex], gridX = Math.floor(car.x / OBJ_CELL), gridY = Math.floor(car.y
          / OBJ_CELL), cand = [];
      for (let cellX = gridX - 2; cellX <= gridX + 2; cellX++) for (let cellY = gridY - 2; cellY
          <= gridY + 2; cellY++) {
        const cell = restGrid.get(cellX * 65536 + cellY); if (!cell) continue;
        for (let slot = 0; slot < cell.length; slot++) {
          const other = cell[slot];
          if (!other.vx && !other.vy && other._ck === cellKey(other.x, other.y)) cand.push(other);
        }
      }
      // IN LIST ORDER (MEASURED: grid-cell order changed which stack the car met first — each hit
      // slows the car — and a Stock Car wall
      // crash knocked on 9-11 objects instead of 15, tools/objcheck). _n = a fixed creation index.
      cand.sort((left, right) => left._n - right._n);
      for (const other of cand) hitByCar(other, car, newTyres);
    }
    if (newTyres.length > 0) {
      for (const tyre of newTyres) tyre._n = nextN++;
      list.push(...newTyres);
    }
    if (objectHits) collideObjects();
  }

  // A PERSISTENT GRID of the objects AT REST, built once per level (reset) — they do not move, so
  // it stays valid. Each step only the MOVING objects are tested: against the resting objects in
  // their 3x3 cells, and against each other directly (there are only ever a handful). An object
  // that comes to rest is filed into the cell it stopped in. MEASURED 2026-10-03
  // (tools/objcheck.mjs, car into the Stock Car wall):
  //   grid rebuilt every step ..... 446 us/step mean with debris flying
  //   movers vs whole list ........ 437-626 us (noisy; the list is 633 long)
  //   this ........................ see objcheck — the figure is written into ENGINE.md
  let nextN = 0;
  const OBJ_CELL = 2.5;              // m; larger than any moving object's diameter
  const restGrid = new Map();        // cell key -> objects at rest in it
  const cellKey = (x, y) => Math.floor(x / OBJ_CELL) * 65536 + Math.floor(y / OBJ_CELL);
  function fileAtRest(obj) {
    const key = cellKey(obj.x, obj.y);
    if (obj._ck === key) return;
    if (obj._ck !== undefined) {
      const old = restGrid.get(obj._ck);
      if (old) { const i = old.indexOf(obj); if (i >= 0) old.splice(i, 1); }
    }
    obj._ck = key;
    const cell = restGrid.get(key);
    if (cell) cell.push(obj); else restGrid.set(key, [obj]);
  }
  function rebuildRestGrid() {
    restGrid.clear();
    for (const obj of list) { obj._ck = undefined; fileAtRest(obj); }
  }
  const movers = [];
  let prevMovers = [];
  const burst = [];                  // reused every step
  // ONE pair test, defined once. MEASURED 2026-10-03 (objcheck, same-run baseline): building this
  // as a closure every step and looping over a fresh [a, b] array per contact cost ~140 us/step
  // over the no-collision path.
  function touch(obj, rel) {
    obj.moved = true;
    obj.hitCount = (obj.hitCount || 0) + 1;
    if (TOPPLES.has(obj.kind) && obj.down === 0 && rel > TOPPLE_V) {
      obj.down = 0.001;
      obj.ang = Math.atan2(obj.vy, obj.vx);
    }
  }
  function pair(objA, objB) {
    if (objA.kind === 'straw' || objB.kind === 'straw' || objA.flat || objB.flat
        || BROKEN.has(objA.kind) || BROKEN.has(objB.kind) || objA.kind === 'tarp' || objB.kind
        === 'tarp') return;
    const reach = objA.r + objB.r;
    const dx = objB.x - objA.x, dy = objB.y - objA.y;
    if (dx > reach || dx < -reach || dy > reach || dy < -reach) return;
    const dist = Math.hypot(dx, dy);
    if (dist >= reach || dist < 1e-6) return;
    const nx = dx / dist, ny = dy / dist;
    const invMassA = 1 / objA.mass, invMassB = 1 / objB.mass, invMassSum = invMassA + invMassB;
    // push apart, shared by inverse mass
    const pen = reach - dist;
    objA.x -= nx * pen * invMassA / invMassSum; objA.y -= ny * pen * invMassA / invMassSum;
    objB.x += nx * pen * invMassB / invMassSum; objB.y += ny * pen * invMassB / invMassSum;
    // closing speed along the normal
    const rel = (objA.vx - objB.vx) * nx + (objA.vy - objB.vy) * ny;
    if (rel <= 0) return;
    const restitution = Math.min(OBJ_REST[objA.kind] ?? 0.15, OBJ_REST[objB.kind] ?? 0.15);
    const j = ((1 + restitution) * rel) / invMassSum;
    objA.vx -= j * invMassA * nx; objA.vy -= j * invMassA * ny;
    objB.vx += j * invMassB * nx; objB.vy += j * invMassB * ny;
    // a glancing blow sets the struck object spinning
    objB.spin += ((objA.vx - objB.vx) * -ny + (objA.vy - objB.vy) * nx) * 0.8;
    touch(objA, rel); touch(objB, rel);
    if (objB.kind === 'tyrestack' && rel > STACK_BURST_V) burstStack(objB, burst);
    if (objA.kind === 'tyrestack' && rel > STACK_BURST_V) burstStack(objA, burst);
    if (rel > 2 && hits.length < 24) hits.push({ x: (objA.x + objB.x) / 2, y: (objA.y + objB.y)
        / 2, speed: rel, kind: objB.kind });
  }
  function collideObjects() {
    movers.length = 0;
    for (let i = 0; i < list.length; i++) {
      const obj = list[i];
      if (obj.vx || obj.vy) { obj._i = i; movers.push(obj); }
    }
    // anything that was moving last step and has now stopped is filed where it stopped
    for (let i = 0; i < prevMovers.length; i++) {
      const obj = prevMovers[i];
      if (!obj.vx && !obj.vy) fileAtRest(obj);
    }
    prevMovers.length = 0; for (let i = 0; i < movers.length; i++) prevMovers.push(movers[i]);
    if (!movers.length) return;
    burst.length = 0;
    for (let moverIdx = 0; moverIdx < movers.length; moverIdx++) {
      const mover = movers[moverIdx];
      // movers against each other, each pair once
      for (let next = moverIdx + 1; next < movers.length; next++) pair(mover, movers[next]);
      // movers against whatever is resting in the 3x3 cells around them (skip ones that have
      // since moved)
      const gridX = Math.floor(mover.x / OBJ_CELL), gridY = Math.floor(mover.y / OBJ_CELL);
      for (let cellX = gridX - 1; cellX <= gridX + 1; cellX++) for (let cellY = gridY - 1; cellY
          <= gridY + 1; cellY++) {
        const cell = restGrid.get(cellX * 65536 + cellY);
        if (!cell) continue;
        for (let slot = 0; slot < cell.length; slot++) {
          const other = cell[slot];
          if (other !== mover && !other.vx && !other.vy) pair(mover, other);
        }
      }
    }
    if (burst.length) { for (const tyre of burst) tyre._n = nextN++; list.push(...burst); }
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
    // CONES ONLY (user, 2026-10-04: "the cone counter should only count cones, not tyres too") —
    // tyre walls, bales etc. are not the course
    get knocked() {
      return list.reduce((count, obj) => count + (obj.kind === 'cone' && (obj.down > 0.5
          || obj.moved) ? 1 : 0), 0);
    },
    get total() { return list.reduce((count, obj) => count + (obj.kind === 'cone' ? 1 : 0), 0); },
    step, reset,
    // a loose object made during play (DAMAGE: a torn-off wheel) — a rolling tyre with everything
    // the list's tyres carry
    add(extra) { list.push({ kind: 'tyre', mode: 'roll', mass: 12, r: 0.42, hx: extra.x,
        hy: extra.y, moved: true, hitCount: 1, down: 0, ang: 0, spin: 0,
      flipPhase: 0, flipSpeed: 0, wobblePhase: 0, wobbleAmp: 0, rollDist: 0, ...extra,
          _n: nextN++ }); },
    rebuildGrid: rebuildRestGrid,   // for harnesses that add objects by hand (tools/objcheck.mjs)
    // STREAMED objects (the endless highway, 2026-10-05: "littered with tyres and cones, chevrons
    // for the corners"): spawn() adds level objects as the road grows ahead; cull(keep) drops every
    // object keep() rejects (the road behind) and refiles the rest grid
    spawn(objs) {
      for (const levelObj of objs) {
        const obj = live(levelObj);
        obj._n = nextN++;
        list.push(obj);
        fileAtRest(obj);
      }
    },
    cull(keep) {
      const before = list.length;
      list = list.filter(keep);
      if (list.length !== before) rebuildRestGrid();
      return before - list.length;
    },
  };
}
