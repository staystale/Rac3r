// traffic.js — HIGHWAY TRAFFIC (user, 2026-10-05: "dumb, slightly SLOW TRAFFIC, RECYCLED when overtaken and off screen (vehicle
// randomised and moved to the front, or replaced — whichever is most efficient)"; "CRASHABLE cars WITH DAMAGE; NOT racing, just driving;
// GENTLY AVOIDING; LANE CHANGING"; "traffic in EVERY MODE and a SLIDER in test mode for DENSITY").
//
// Every traffic car is a REAL car (vehicle.js step, the same clamps, damage, rollover and contacts as you and the AI), driven by a dumb
// LANE DRIVER: pure pursuit on its lane line (+ a small sideways lean away from you when you are alongside), a cruise speed of
// 90-110 km/h (the left lane slowest), FOLLOWING whatever is ahead in its path (traffic, you, the AI) at ~1 s, and braking hard when the
// time to a collision gets short. LANE CHANGES: indicate first, then drift across — to overtake a slower car (right, else rarely left),
// back to the left when it is clear (keep left), and now and then for no reason. A car TOO DAMAGED stops with its hazards on.
// RECYCLING: a car OUT OF VIEW (main.js passes the renderer's real screen test) and well behind you is REPLACED by a fresh random car
// (model + colour) ahead, off the top; one far ahead (you stopped) comes back from behind. A new car is always placed OFF SCREEN and
// never near another car in that lane. Positions are absolute road distances, so the window moving needs nothing.
// Measured: tools/trafficcheck.mjs.
import { makeCar, step, reset } from './vehicle.js';
import { ROSTER } from './cars.js';
import { applyGround, fenceClamp, obstacleClamp } from "./world/wear.ts";
import { barrierClamp, solidClamp } from "./world/barriers.ts";
import { hit, tooInjured } from './damage.js';
import { rolling, tripCheck, stepRoll } from './roll.js';
import { roadFrame, roadPose, roadSpan } from './highway.js';

// what is on the road (weights) — road cars only; vans / lorries come with the traffic vehicles (TODO 4)
const VEH = [['hatch-fwd', 3], ['saloon-rwd', 3], ['estate-4x4', 2.5], ['mini-fwd', 1.5], ['hatch-rwd', 1], ['muscle-rwd', 0.4], ['lambo-awd', 0.12]];
// real-road colours: mostly silver / white / black / grey (each its own sprite, cached by id + paint)
const PAINTS = [['#b9bdc4', '#6f747c', 4], ['#e6e8ea', '#9aa0a8', 3], ['#22252b', '#0e1013', 3], ['#5b626d', '#353a42', 3], ['#1f3a6e', '#10223f', 1.5],
  ['#9c2a2a', '#5a1515', 1.5], ['#2f5d3a', '#1a3622', 0.8], ['#7a6340', '#453720', 0.6], ['#3c6fa8', '#22426a', 1], ['#c7b98f', '#7d7255', 0.6]];
export const PER_LANE = 6;          // cars per lane at 100 % density (motorway: 18)
const MAX_CARS = 24;
const LAT_V = 0.9;                  // m/s sideways while changing lane (3.65 m in ~4 s)
const IND_T = 1.3;                  // s of indicating before moving across
const CROSS_T = 6;                  // s a lane change takes, indicating included, + a margin
const PHYS_NEAR = 45;               // m along the road from you / an AI inside which traffic is a real physics car (LOD; 0.75 s at a 220 km/h closing speed)
const HEADWAY = 1.1, GAP0 = 5;      // following: GAP0 + HEADWAY x v metres, bumper to bumper
const RECYCLE_BEHIND = 70, RECYCLE_AHEAD = 520, HARD_BEHIND = 320;   // m along the road from you (+ out of view)
const SPAWN_AHEAD = [300, 470], SPAWN_BEHIND = [150, 240];

export function createTraffic({ rnd = Math.random } = {}) {
  let list = [], lv = null, want = 0, placed = 0, recycled = 0, visHits = 0;
  const cars = [];                  // the LIVE cars (drawn + collided); a parked slot (waiting for a free off-screen spot) is not in it
  const pick = (tab) => { let r = rnd() * tab.reduce((a, t) => a + t[t.length - 1], 0); for (const t of tab) { r -= t[t.length - 1]; if (r <= 0) return t; } return tab[0]; };
  const geo = () => lv._hw.geo;
  // cruise speed by lane: the left lane slowest (UK: keep left unless overtaking)
  const cruise = (lane, n) => (90 + (n > 1 ? lane / (n - 1) : 0.5) * 12 + rnd() * 8) / 3.6;
  // a car placed already moving gets the gear (and revs) that speed needs
  function gearFor(car, v) {
    const s = car.spec, rpmAt = (k) => (v / s.wheelR) * s.gears[k - 1] * s.finalDrive * 60 / (2 * Math.PI);
    let g = 1; for (let k = 1; k <= s.gears.length; k++) if (rpmAt(k) > s.downshiftRpm * 1.15) g = k;
    car.gear = g; car.rpm = Math.max(s.idleRpm, Math.min(s.redline, rpmAt(g)));
  }
  function fresh(t, s, lane, v) {
    const ids = VEH.filter(([id]) => ROSTER.some((r) => r.id === id)), [id] = pick(ids), pi = PAINTS.indexOf(pick(PAINTS)), [paint, trim] = PAINTS[pi];
    const car = makeCar(id); car.spec = { ...car.spec, id: id + '#t' + pi, paint, trim };
    car.traffic = true; car.absOn = !!(car.spec.aids && car.spec.aids.abs); car.tcsOn = !!(car.spec.aids && car.spec.aids.tcs);
    const off = geo().centres[lane], p = roadPose(lv, s, off);
    reset(car, p.x, p.y, p.h); car.vx = Math.cos(p.h) * v; car.vy = Math.sin(p.h) * v; gearFor(car, v);
    Object.assign(t, { car, lane, laneT: lane, laneOff: off, bias: 0, vWant: cruise(lane, geo().centres.length), s, off, vAl: v,
      ind: 0, indT: 0, think: rnd() * 0.3, keepLeftT: 0, wreck: false, deadT: 0, parked: false, kOff: null, kin: false, phys: true });
    return t;
  }
  function rebuildCars() { cars.length = 0; for (const t of list) if (!t.parked) cars.push(t.car); }
  // room for a car in `lane` at road distance s? (nobody within `ahead` m in front / `behind` m behind, in that lane)
  function roomAt(ents, s, lane, ahead = 30, behind = 30) {
    const c = geo().centres[lane];
    for (const e of ents) if (Math.abs(e.off - c) < 2.6 && e.s - s < ahead && s - e.s < behind) return false;
    return true;
  }
  // a free OFF-SCREEN spot ahead of / behind pS; null if there is none this step (try again next step)
  function spot(ents, pS, from, vis) {
    const { s0, s1 } = roadSpan(lv), [a, b] = from === 'ahead' ? SPAWN_AHEAD : SPAWN_BEHIND, n = geo().centres.length;
    for (let k = 0; k < 8; k++) {
      const s = pS + (from === 'ahead' ? 1 : -1) * (a + rnd() * (b - a)), lane = (rnd() * n) | 0;
      if (s < s0 + 60 || s > s1 - 60 || !roomAt(ents, s, lane)) continue;
      const p = roadPose(lv, s, geo().centres[lane]); if (vis(p.x, p.y, s)) continue;
      return { s, lane };
    }
    return null;
  }

  // RESTART / a new density: cars spread over the road round the spawn (none behind you in YOUR lane, none within 40 m in front of you)
  function resetTraffic(level, density) {
    lv = level; list = []; placed = 0; recycled = 0; visHits = 0;
    if (!lv || !lv.endless || !lv._hw || !(density > 0)) { want = 0; rebuildCars(); return; }
    const C = geo().centres, nL = C.length; want = Math.min(MAX_CARS, Math.round(density * PER_LANE * nL));
    const sp = roadFrame(lv, lv.spawn.x, lv.spawn.y, null), ents = [{ s: sp.s, off: sp.off }];
    for (let i = 0, tries = 0; i < want && tries < want * 25; tries++) {
      const s = sp.s - 100 + rnd() * 520, lane = (rnd() * nL) | 0, mine = Math.abs(C[lane] - sp.off) < 1.5;
      if ((mine && s < sp.s + 40) || Math.abs(s - sp.s) < 14 || !roomAt(ents, s, lane, 26, 26)) continue;
      const t = fresh({}, s, lane, cruise(lane, nL)); list.push(t); ents.push({ s, off: t.off }); i++;
    }
    while (list.length < want) list.push({ parked: true });   // no room at the start: they join from off screen
    rebuildCars();
  }

  // one physics step. player = your car; others = the AI cars; vis(x, y, s) = on screen right now (main.js: the renderer's view)
  function stepTraffic(dt, { player, others = [], visible }) {
    if (!list.length || !lv || !lv._hw || !lv._hw.q) return;
    const pq = lv._hw.q, pS = pq.s, G = geo(), C = G.centres, nL = C.length;
    const vis = visible || ((x, y, s) => s - pS > -90 && s - pS < 270);
    const lo = -G.hw + lv._cfg.shoulder + 1.0, hi = G.hw - 1.0;
    // everyone in road coordinates: s along, off sideways (+ = right), v along the road
    const ents = [];
    for (const t of list) { if (t.parked) continue; const f = roadFrame(lv, t.car.x, t.car.y, t.s); if (!f) continue;
      t.s = f.s; t.off = f.off; t.vAl = t.car.vx * f.dx + t.car.vy * f.dy; ents.push({ car: t.car, s: t.s, off: t.off, v: t.vAl, t }); }
    ents.push({ car: player, s: pS, off: pq.off, v: player.vx * pq.dx + player.vy * pq.dy, you: true });
    for (const o of others) { const f = roadFrame(lv, o.x, o.y, o._hwS); if (!f) continue; o._hwS = f.s; ents.push({ car: o, s: f.s, off: f.off, v: o.vx * f.dx + o.vy * f.dy, you: true }); }

    // ---- RECYCLE (out of view only) + place the parked slots
    const { s0, s1 } = roadSpan(lv); let changed = false;
    const drop = (t) => { const i = ents.findIndex((e) => e.t === t); if (i >= 0) ents.splice(i, 1); };
    const join = (t, sp) => { fresh(t, sp.s, sp.lane, cruise(sp.lane, nL)); ents.push({ car: t.car, s: t.s, off: t.off, v: t.vAl, t }); changed = true; };
    for (const t of list) {
      if (t.parked) { const sp = spot(ents, pS, 'ahead', vis); if (sp) { join(t, sp); placed++; } continue; }
      const ds = t.s - pS, seen = vis(t.car.x, t.car.y, t.s);
      const away = !seen && (ds < -RECYCLE_BEHIND || ds > RECYCLE_AHEAD || t.deadT > 6);
      const forced = ds < -HARD_BEHIND || t.s < s0 + 30 || t.s > s1 - 30;   // about to fall off the road window: must go, seen or not
      if (!away && !forced) continue;
      if (forced && seen) visHits++;
      drop(t);
      const sp = spot(ents, pS, ds > 0 ? 'behind' : 'ahead', vis);
      if (sp) { join(t, sp); recycled++; } else { t.parked = true; changed = true; }
    }
    if (changed) { rebuildCars(); changed = false; }

    // physics or kinematic (LOD, driveOne): within PHYS_NEAR of a real car, wrecked or tumbling = physics. Being IN VIEW does not need
    // it — a kinematic car on its lane line looks the same; only something that can TOUCH it needs real physics.
    const reals = ents.filter((e) => e.you);
    for (const t of list) { if (t.parked) continue;
      t.phys = t.wreck || rolling(t.car) || t.car.dmg && t.car.dmg.some((d) => d > 0.02) || reals.some((e) => Math.abs(e.s - t.s) < PHYS_NEAR && Math.abs(e.off - t.off) < 14); }
    for (const t of list) if (!t.parked) driveOne(t, dt, ents, C, nL, lo, hi);
    for (const t of list) if (!t.parked && !Number.isFinite(t.car.x + t.car.y + t.car.vx + t.car.vy)) { t.parked = true; changed = true; }   // one broken car never stops the game
    if (changed) rebuildCars();
  }

  function driveOne(t, dt, ents, C, nL, lo, hi) {
    const c = t.car; c._p = { x: c.x, y: c.y, h: c.heading };
    const v = Math.hypot(c.vx, c.vy);
    // the car AHEAD in my path (my lane line, or where I am now while crossing)
    let lead = null, gap = Infinity;
    for (const e of ents) { if (e.car === c) continue; const ds = e.s - t.s; if (ds <= 0 || ds > 110) continue;
      if (Math.min(Math.abs(e.off - t.laneOff), Math.abs(e.off - t.off)) > 2.3) continue;
      const g = ds - (c.spec.len + e.car.spec.len) / 2; if (g < gap) { gap = g; lead = e; } }
    // ---- LANE DECISIONS, a few times a second
    if ((t.think -= dt) <= 0 && !t.wreck) {
      t.think = 0.25 + rnd() * 0.15; t.keepLeftT += 0.3;
      // CLEAR for the WHOLE manoeuvre (MEASURED 2026-10-05, trafficcheck: a ~26 m look back let a car 25 km/h faster arrive alongside
      // during the ~5 s it takes to indicate + cross -> traffic-on-traffic crashes): room ahead for a slower car, and a car behind must
      // not be able to close the gap within CROSS_T
      const clear = (L) => { if (L < 0 || L >= nL) return false;
        // a lane someone is MOVING INTO is taken too (MEASURED: two cars from lanes 0 and 2 both took the empty middle lane at once)
        for (const e of ents) { if (e.car === c || (Math.abs(e.off - C[L]) > 2.4 && !(e.t && e.t.laneT === L))) continue; const ds = e.s - t.s, rel = t.vAl - e.v;
          if (ds < 14 + Math.max(0, rel) * 3 && ds > -(12 + Math.max(0, -rel) * CROSS_T)) return false; }
        return true; };
      const slowIn = (L) => { for (const e of ents) { if (e.car === c || Math.abs(e.off - C[L]) > 2.0) continue; const ds = e.s - t.s; if (ds > 0 && ds < 70 && e.v < t.vWant - 2) return true; } return false; };
      if (t.laneT === t.lane) {
        const blocked = lead && lead.v < t.vWant - 3 && gap < 45;
        let go = null;
        if (blocked) go = clear(t.lane + 1) ? t.lane + 1 : rnd() < 0.3 && clear(t.lane - 1) && !slowIn(t.lane - 1) ? t.lane - 1 : null;
        else if (t.lane > 0 && t.keepLeftT > 8 && clear(t.lane - 1) && !slowIn(t.lane - 1)) go = t.lane - 1;   // keep left
        else if (nL > 1 && rnd() < 0.004) { const L = t.lane + (rnd() < 0.5 ? 1 : -1); if (clear(L)) go = L; }   // now and then, for no reason
        if (go != null) { t.laneT = go; t.ind = Math.sign(go - t.lane); t.indT = IND_T; }
      } else if (t.indT > 0 && !clear(t.laneT)) { t.laneT = t.lane; t.ind = 0; }   // changed its mind before moving
    }
    // ---- ACROSS: indicate, then drift over at LAT_V. car._trOff = the lane centre it is going to (null = keeping its lane): read by the
    // highway racers (highwayrace.js) so they plan with where a car WILL be - an indicating car is a car about to be in that lane
    c._trOff = t.laneT !== t.lane ? C[t.laneT] : null;
    if (t.laneT !== t.lane) {
      // ABORT while crossing: anything alongside (or closing fast from behind) on the side I am moving to -> back to where I came from
      if (t.indT <= 0) for (const e of ents) { if (e.car === c) continue; const ds = e.s - t.s, lat = e.off - t.laneOff;
        if (Math.sign(lat) !== Math.sign(C[t.laneT] - t.laneOff) || Math.abs(lat) > 2.7) continue;
        if (ds < c.spec.len + 3 && ds > -(c.spec.len + 3 + Math.max(0, e.v - t.vAl) * 1.5)) { const back = t.lane; t.lane = t.laneT; t.laneT = back; t.ind = Math.sign(C[back] - t.laneOff); break; } }
      if (t.indT > 0) t.indT -= dt;
      else { const goal = C[t.laneT], d = goal - t.laneOff, st = LAT_V * dt; t.laneOff = Math.abs(d) <= st ? goal : t.laneOff + Math.sign(d) * st;
        if (t.laneOff === goal) { t.lane = t.laneT; t.ind = 0; t.keepLeftT = 0; t.vWant = cruise(t.lane, nL); } }
    }
    // ---- GENTLY AVOID you / the AI alongside: lean away inside the lane, up to 0.8 m
    let bias = 0;
    for (const e of ents) { if (!e.you) continue; const ds = e.s - t.s, lat = e.off - t.off; if (Math.abs(ds) < 7 && Math.abs(lat) < 3.0) bias -= Math.sign(lat || 1) * Math.min(0.8, (3.0 - Math.abs(lat)) * 0.5); }
    bias = Math.max(-0.8, Math.min(0.8, bias)); t.bias += Math.max(-1.2 * dt, Math.min(1.2 * dt, bias - t.bias));
    // ---- SPEED: cruise, or follow the car ahead; hard braking when a collision is close
    let vT = t.vWant, brakeX = 0;
    if (lead) { const wantGap = GAP0 + HEADWAY * Math.max(0, t.vAl); vT = Math.min(vT, Math.max(0, lead.v + (gap - wantGap) * 0.4)); if (gap < 2.5) vT = 0;
      const close = t.vAl - lead.v; if (close > 0.5) { const ttc = gap / close; if (ttc < 2.5) brakeX = Math.min(1, (2.5 - ttc) / 1.8); } }
    // ---- LOD (MEASURED 2026-10-05, tools/_tfprof: applyGround alone is ~17 us per car-step, 18 cars = 0.57 ms a step = a phone frame's
    // budget gone): a car OUT OF VIEW and > PHYS_NEAR m from every real car (you, the AI) is KINEMATIC — the same decisions, then carried
    // along its lane line at its speed (2 m/s^2 up, 7 down, 9 in an emergency). It becomes a real car again before you can see it or touch it.
    if (!t.phys) {
      t.vAl += Math.max((brakeX > 0 ? -9 : -7) * dt, Math.min(2 * dt, vT - t.vAl)); if (t.vAl < 0) t.vAl = 0;
      // the lateral drift (lane change) yaws the nose into it, as a driven car's would; the lean toward you is not used (no one is near)
      // (MEASURED: a recycled car inherited the old car's kOff -> one step of a huge sideways speed -> contacts + off the road; now
      // fresh() clears it and the drift rate is capped at the lane-change speed)
      const offK = Math.max(lo, Math.min(hi, t.laneOff)), latV = t.kOff == null ? 0 : Math.max(-LAT_V, Math.min(LAT_V, (offK - t.kOff) / dt)); t.kOff = offK;
      const p = roadPose(lv, t.s + t.vAl * dt, offK), h = p.h + Math.atan2(latV, Math.max(3, t.vAl));
      // yaw rate + steering held at what the BEND needs (MEASURED: woken with both 0 in a bend, a car ran 0.3 m off the edge for 1.2 s)
      const p2 = roadPose(lv, t.s + t.vAl * dt + 4, offK); let dh = p2.h - p.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); const kRoad = dh / 4;
      c.x = p.x; c.y = p.y; c.heading = h; c.vx = Math.cos(p.h) * t.vAl - Math.sin(p.h) * latV; c.vy = Math.sin(p.h) * t.vAl + Math.cos(p.h) * latV;
      c.yawRate = t.vAl * kRoad; c.delta = Math.atan(kRoad * c.spec.L);
      c.indicator = t.laneT !== t.lane ? t.ind : 0; c.brakeLight = brakeX; t.deadT = 0; t.kin = true;
      return;
    }
    if (t.kin) { t.kin = false; t.kOff = null; gearFor(c, t.vAl); }   // waking up: the gear for the speed it is doing
    let input;
    if (t.wreck || tooInjured(c)) { t.wreck = true; input = { steer: 0, throttle: 0, brake: 0.7, handbrake: 0, reverse: 0 }; }
    else {
      // PURE PURSUIT on the lane line (+ the lean), kept inside the carriageway
      const offT = Math.max(lo, Math.min(hi, t.laneOff + t.bias)), ld = Math.max(10, Math.min(32, 8 + 0.5 * v)), tp = roadPose(lv, t.s + ld, offT);
      const ch = Math.cos(c.heading), sh = Math.sin(c.heading), ex = tp.x - c.x, ey = tp.y - c.y, xl = ex * ch + ey * sh, yl = -ex * sh + ey * ch;
      const k = 2 * yl / Math.max(1, xl * xl + yl * yl), LOCK = c.spec.steerMax || 0.56;
      const steer = Math.max(-1, Math.min(1, (Math.atan(k * c.spec.L) - 0.02 * (c.yawRate - v * k)) / LOCK));
      const e = vT - t.vAl, brake = Math.max(brakeX, e < -0.8 ? Math.min(1, -e * 0.12) : 0);
      input = { steer, throttle: brake > 0 || e <= 0 ? 0 : Math.min(0.75, e * 0.25), brake, handbrake: 0, reverse: 0 };
    }
    c.indicator = t.laneT !== t.lane ? t.ind : 0; c.hazard = t.wreck; c.brakeLight = input.brake;
    t.deadT = v < 1 ? t.deadT + dt : 0;
    // ---- the same physics as every car: clamps (+ the damage they do), ground, then the tyres or the tumble
    const v0x = c.vx, v0y = c.vy;
    fenceClamp(c); obstacleClamp(c); barrierClamp(c); solidClamp(c);
    hit(c, v0x, v0y);
    applyGround(c, dt);
    if (rolling(c)) { stepRoll(c, dt, () => {}); t.wreck = true; }
    else { step(c, input, dt); tripCheck(c, dt); }
  }
  // make room: every traffic car within r m of (x, y) leaves (the player was just put back there)
  function clearAround(x, y, r) {
    let n = 0; for (const t of list) if (!t.parked && Math.hypot(t.car.x - x, t.car.y - y) < r) { t.parked = true; n++; }
    if (n) rebuildCars(); return n;
  }
  // make room for a RACE GRID: every traffic car with road distance in [sA, sB] leaves (it rejoins off screen ahead)
  function clearSpan(sA, sB) {
    let n = 0; for (const t of list) if (!t.parked && t.s >= sA && t.s <= sB) { t.parked = true; n++; }
    if (n) rebuildCars(); return n;
  }
  return { cars, reset: resetTraffic, step: stepTraffic, clearAround, clearSpan,
    get list() { return list; }, get want() { return want; }, stats: () => ({ live: cars.length, want, placed, recycled, visHits }) };
}
