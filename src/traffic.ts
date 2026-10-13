// traffic.js — HIGHWAY TRAFFIC (user, 2026-10-05: "dumb, slightly SLOW TRAFFIC, RECYCLED when
// overtaken and off screen (vehicle randomised and moved to the front, or replaced — whichever
// is most efficient)"; "CRASHABLE cars WITH DAMAGE; NOT racing, just driving;
// GENTLY AVOIDING; LANE CHANGING"; "traffic in EVERY MODE and a SLIDER in test mode for DENSITY").
//
// Every traffic car is a REAL car (vehicle.ts step, the same clamps, damage, rollover and
// contacts as you and the AI), driven by a dumb LANE DRIVER: pure pursuit on its lane line
// (+ a small sideways lean away from you when you are alongside), a cruise speed of
// 90-110 km/h (the left lane slowest), FOLLOWING whatever is ahead in its path (traffic, you,
// the AI) at ~1 s, and braking hard when the time to a collision gets short. LANE CHANGES:
// indicate first, then drift across — to overtake a slower car (right, else rarely left),
// back to the left when it is clear (keep left), and now and then for no reason. A car TOO
// DAMAGED stops with its hazards on.
// RECYCLING: a car OUT OF VIEW (main.js passes the renderer's real screen test) and well behind
// you is REPLACED by a fresh random car (model + colour) ahead, off the top; one far ahead
// (you stopped) comes back from behind. A new car is always placed OFF SCREEN and never near
// another car in that lane. Positions are absolute road distances, so the window moving needs
// nothing.
// Measured: tools/trafficcheck.mjs.
import { makeCar, step, reset } from './vehicle.ts';
import { ROSTER } from './cars.ts';
import { applyGround, fenceClamp, obstacleClamp } from "./world/wear.ts";
import { barrierClamp, solidClamp } from "./world/barriers.ts";
import { hit, tooInjured } from './damage.js';
import { rolling, tripCheck, stepRoll } from './roll.js';
import { roadFrame, roadPose, roadSpan } from './highway.js';
import type { AiCar, HighwayLevel, TrafficCar, TrafficEnt, TrafficVehicle } from "./ai/types.ts";

// what is on the road (weights) — road cars only; vans / lorries come with the traffic
// vehicles (TODO 4)
const VEH: [string, number][] = [
  ['hatch-fwd', 3], ['saloon-rwd', 3], ['estate-4x4', 2.5], ['mini-fwd', 1.5],
  ['hatch-rwd', 1], ['muscle-rwd', 0.4], ['lambo-awd', 0.12],
];
// real-road colours: mostly silver / white / black / grey (each its own sprite, cached by
// id + paint)
const PAINTS: [string, string, number][] = [
  ['#b9bdc4', '#6f747c', 4], ['#e6e8ea', '#9aa0a8', 3], ['#22252b', '#0e1013', 3],
  ['#5b626d', '#353a42', 3], ['#1f3a6e', '#10223f', 1.5],
  ['#9c2a2a', '#5a1515', 1.5], ['#2f5d3a', '#1a3622', 0.8], ['#7a6340', '#453720', 0.6],
  ['#3c6fa8', '#22426a', 1], ['#c7b98f', '#7d7255', 0.6],
];
export const PER_LANE = 6;          // cars per lane at 100 % density (motorway: 18)
const MAX_CARS = 24;
const LAT_V = 0.9;                  // m/s sideways while changing lane (3.65 m in ~4 s)
const IND_T = 1.3;                  // s of indicating before moving across
const CROSS_T = 6;                  // s a lane change takes, indicating included, + a margin
// m along the road from you / an AI inside which traffic is a real physics car
// (LOD; 0.75 s at a 220 km/h closing speed)
const PHYS_NEAR = 45;
const HEADWAY = 1.1, GAP0 = 5;      // following: GAP0 + HEADWAY x v metres, bumper to bumper
// m along the road from you (+ out of view)
const RECYCLE_BEHIND = 70, RECYCLE_AHEAD = 520, HARD_BEHIND = 320;
const SPAWN_AHEAD = [300, 470], SPAWN_BEHIND = [150, 240];

export function createTraffic({ rnd = Math.random } = {}) {
  let list: TrafficCar[] = [], level: HighwayLevel | null = null;
  let want = 0, placed = 0, recycled = 0, visHits = 0;
  // the LIVE cars (drawn + collided); a parked slot (waiting for a free off-screen spot)
  // is not in it
  const cars: TrafficVehicle[] = [];
  const pick = <T extends (string | number)[]>(tab: T[]): T => {
    let roll = rnd() * tab.reduce((sum, row) => sum + (row[row.length - 1] as number), 0);
    for (const row of tab) {
      roll -= row[row.length - 1] as number;
      if (roll <= 0) return row;
    }
    return tab[0];
  };
  const geo = () => level!._hw.geo;   // (! : only called once resetTraffic has set level)
  // cruise speed by lane: the left lane slowest (UK: keep left unless overtaking)
  const cruise = (lane: number, laneCount: number) => (
    90 + (laneCount > 1 ? lane / (laneCount - 1) : 0.5) * 12 + rnd() * 8
  ) / 3.6;
  // a car placed already moving gets the gear (and revs) that speed needs
  function gearFor(car: TrafficVehicle, speed: number) {
    const spec = car.spec, rpmAt = (gearNo: number) => (
      (speed / spec.wheelR) * spec.gears[gearNo - 1] * spec.finalDrive * 60 / (2 * Math.PI)
    );
    let best = 1;
    for (let gearNo = 1; gearNo <= spec.gears.length; gearNo++)
      if (rpmAt(gearNo) > spec.downshiftRpm * 1.15) best = gearNo;
    car.gear = best;
    car.rpm = Math.max(spec.idleRpm, Math.min(spec.redline, rpmAt(best)));
  }
  function fresh(slot: TrafficCar, dist: number, lane: number, speed: number) {
    const ids = VEH.filter(([candId]) => ROSTER.some((entry) => entry.id === candId)),
      [vehId] = pick(ids), paintIdx = PAINTS.indexOf(pick(PAINTS)),
      [paint, trim] = PAINTS[paintIdx];
    const car: TrafficVehicle = makeCar(vehId);
    car.spec = { ...car.spec, id: vehId + '#t' + paintIdx, paint, trim };
    car.traffic = true;
    car.absOn = !!(car.spec.aids && car.spec.aids.abs);
    car.tcsOn = !!(car.spec.aids && car.spec.aids.tcs);
    const off = geo().centres[lane], pose = roadPose(level, dist, off);
    reset(car, pose.x, pose.y, pose.h);
    car.vx = Math.cos(pose.h) * speed;
    car.vy = Math.sin(pose.h) * speed;
    gearFor(car, speed);
    Object.assign(slot, {
      car, lane, laneT: lane, laneOff: off, bias: 0,
      vWant: cruise(lane, geo().centres.length), s: dist, off, vAl: speed,
      ind: 0, indT: 0, think: rnd() * 0.3, keepLeftT: 0, wreck: false, deadT: 0,
      parked: false, kOff: null, kin: false, phys: true,
    });
    return slot;
  }
  function rebuildCars() {
    cars.length = 0;
    for (const slot of list) if (!slot.parked) cars.push(slot.car);
  }
  // room for a car in `lane` at road distance dist? (nobody within `ahead` m in front /
  // `behind` m behind, in that lane)
  function roomAt(
    ents: { s: number; off: number }[], dist: number, lane: number, ahead = 30, behind = 30,
  ) {
    const centre = geo().centres[lane];
    for (const ent of ents)
      if (Math.abs(ent.off - centre) < 2.6 && ent.s - dist < ahead && dist - ent.s < behind)
        return false;
    return true;
  }
  // a free OFF-SCREEN spot ahead of / behind playerS; null if there is none this step
  // (try again next step)
  function spot(
    ents: { s: number; off: number }[], playerS: number, from: string,
    vis: (x: number, y: number, dist: number) => boolean,
  ) {
    const { s0: roadStart, s1: roadEnd } = roadSpan(level),
      [near, far] = from === 'ahead' ? SPAWN_AHEAD : SPAWN_BEHIND,
      laneCount = geo().centres.length;
    for (let attempt = 0; attempt < 8; attempt++) {
      const dist = playerS + (from === 'ahead' ? 1 : -1) * (near + rnd() * (far - near)),
        lane = (rnd() * laneCount) | 0;
      if (dist < roadStart + 60 || dist > roadEnd - 60 || !roomAt(ents, dist, lane)) continue;
      const pose = roadPose(level, dist, geo().centres[lane]);
      if (vis(pose.x, pose.y, dist)) continue;
      return { s: dist, lane };
    }
    return null;
  }

  // RESTART / a new density: cars spread over the road round the spawn (none behind you in
  // YOUR lane, none within 40 m in front of you)
  function resetTraffic(nextLevel: HighwayLevel | null, density: number) {
    level = nextLevel;
    list = [];
    placed = 0;
    recycled = 0;
    visHits = 0;
    if (!level || !level.endless || !level._hw || !(density > 0)) {
      want = 0;
      rebuildCars();
      return;
    }
    const centres = geo().centres, laneCount = centres.length;
    want = Math.min(MAX_CARS, Math.round(density * PER_LANE * laneCount));
    const spawn = roadFrame(level, level.spawn.x, level.spawn.y, null)!,
      ents = [{ s: spawn.s, off: spawn.off }];
    for (let i = 0, tries = 0; i < want && tries < want * 25; tries++) {
      const dist = spawn.s - 100 + rnd() * 520, lane = (rnd() * laneCount) | 0,
        mine = Math.abs(centres[lane] - spawn.off) < 1.5;
      if ((mine && dist < spawn.s + 40) || Math.abs(dist - spawn.s) < 14
        || !roomAt(ents, dist, lane, 26, 26)) continue;
      const slot = fresh({} as TrafficCar, dist, lane, cruise(lane, laneCount));
      list.push(slot);
      ents.push({ s: dist, off: slot.off });
      i++;
    }
    while (list.length < want) {
      // no room at the start: they join from off screen
      list.push({ parked: true } as TrafficCar);
    }
    rebuildCars();
  }

  // one physics step. player = your car; others = the AI cars; vis(x, y, s) = on screen right
  // now (main.js: the renderer's view)
  function stepTraffic(dt: number, { player, others = [], visible }: {
    player: AiCar; others?: AiCar[]; visible?: (x: number, y: number, dist: number) => boolean;
  }) {
    if (!list.length || !level || !level._hw || !level._hw.q) return;
    const playerQ = level._hw.q, playerS = playerQ.s, geom = geo(), centres = geom.centres,
      laneCount = centres.length;
    const vis = visible || ((x, y, dist) => dist - playerS > -90 && dist - playerS < 270);
    const minOff = -geom.hw + level._cfg.shoulder + 1.0, maxOff = geom.hw - 1.0;
    // everyone in road coordinates: s along, off sideways (+ = right), v along the road
    const ents: TrafficEnt[] = [];
    for (const slot of list) {
      if (slot.parked) continue;
      const frame = roadFrame(level, slot.car.x, slot.car.y, slot.s);
      if (!frame) continue;
      slot.s = frame.s;
      slot.off = frame.off;
      slot.vAl = slot.car.vx * frame.dx + slot.car.vy * frame.dy;
      ents.push({ car: slot.car, s: slot.s, off: slot.off, v: slot.vAl, t: slot });
    }
    ents.push({
      car: player, s: playerS, off: playerQ.off,
      v: player.vx * playerQ.dx + player.vy * playerQ.dy, you: true,
    });
    for (const other of others) {
      const frame = roadFrame(level, other.x, other.y, other._hwS);
      if (!frame) continue;
      other._hwS = frame.s;
      ents.push({
        car: other, s: frame.s, off: frame.off,
        v: other.vx * frame.dx + other.vy * frame.dy, you: true,
      });
    }

    // ---- RECYCLE (out of view only) + place the parked slots
    const { s0: roadStart, s1: roadEnd } = roadSpan(level);
    let changed = false;
    const drop = (slot: TrafficCar) => {
      const i = ents.findIndex((ent) => ent.t === slot);
      if (i >= 0) ents.splice(i, 1);
    };
    const join = (slot: TrafficCar, place: { s: number; lane: number }) => {
      fresh(slot, place.s, place.lane, cruise(place.lane, laneCount));
      ents.push({ car: slot.car, s: slot.s, off: slot.off, v: slot.vAl, t: slot });
      changed = true;
    };
    for (const slot of list) {
      if (slot.parked) {
        const place = spot(ents, playerS, 'ahead', vis);
        if (place) {
          join(slot, place);
          placed++;
        }
        continue;
      }
      const relS = slot.s - playerS, seen = vis(slot.car.x, slot.car.y, slot.s);
      const away = !seen && (relS < -RECYCLE_BEHIND || relS > RECYCLE_AHEAD || slot.deadT > 6);
      // about to fall off the road window: must go, seen or not
      const forced = relS < -HARD_BEHIND || slot.s < roadStart + 30 || slot.s > roadEnd - 30;
      if (!away && !forced) continue;
      if (forced && seen) visHits++;
      drop(slot);
      const place = spot(ents, playerS, relS > 0 ? 'behind' : 'ahead', vis);
      if (place) {
        join(slot, place);
        recycled++;
      } else {
        slot.parked = true;
        changed = true;
      }
    }
    if (changed) {
      rebuildCars();
      changed = false;
    }

    // physics or kinematic (LOD, driveOne): within PHYS_NEAR of a real car, wrecked or
    // tumbling = physics. Being IN VIEW does not need it — a kinematic car on its lane line
    // looks the same; only something that can TOUCH it needs real physics.
    const reals = ents.filter((ent) => ent.you);
    for (const slot of list) {
      if (slot.parked) continue;
      slot.phys = slot.wreck || rolling(slot.car)
        || slot.car.dmg && slot.car.dmg.some((part) => part > 0.02)
        || reals.some((ent) => (
          Math.abs(ent.s - slot.s) < PHYS_NEAR && Math.abs(ent.off - slot.off) < 14
        ));
    }
    for (const slot of list)
      if (!slot.parked) driveOne(slot, dt, ents, centres, laneCount, minOff, maxOff);
    // one broken car never stops the game
    for (const slot of list)
      if (!slot.parked && !Number.isFinite(slot.car.x + slot.car.y + slot.car.vx + slot.car.vy)) {
        slot.parked = true;
        changed = true;
      }
    if (changed) rebuildCars();
  }

  function driveOne(
    slot: TrafficCar, dt: number, ents: TrafficEnt[], centres: number[], laneCount: number,
    minOff: number, maxOff: number,
  ) {
    const car = slot.car;
    car._p = { x: car.x, y: car.y, h: car.heading };
    const speed = Math.hypot(car.vx, car.vy);
    // the car AHEAD in my path (my lane line, or where I am now while crossing)
    let lead: TrafficEnt | null = null, gap = Infinity;
    for (const ent of ents) {
      if (ent.car === car) continue;
      const ahead = ent.s - slot.s;
      if (ahead <= 0 || ahead > 110) continue;
      if (Math.min(Math.abs(ent.off - slot.laneOff), Math.abs(ent.off - slot.off)) > 2.3) continue;
      const bumperGap = ahead - (car.spec.len + ent.car.spec.len) / 2;
      if (bumperGap < gap) {
        gap = bumperGap;
        lead = ent;
      }
    }
    // ---- LANE DECISIONS, a few times a second
    if ((slot.think -= dt) <= 0 && !slot.wreck) {
      slot.think = 0.25 + rnd() * 0.15;
      slot.keepLeftT += 0.3;
      // CLEAR for the WHOLE manoeuvre (MEASURED 2026-10-05, trafficcheck: a ~26 m look back let
      // a car 25 km/h faster arrive alongside during the ~5 s it takes to indicate + cross ->
      // traffic-on-traffic crashes): room ahead for a slower car, and a car behind must
      // not be able to close the gap within CROSS_T
      const clear = (laneNo: number) => {
        if (laneNo < 0 || laneNo >= laneCount) return false;
        // a lane someone is MOVING INTO is taken too (MEASURED: two cars from lanes 0 and 2
        // both took the empty middle lane at once)
        for (const ent of ents) {
          if (ent.car === car
            || (Math.abs(ent.off - centres[laneNo]) > 2.4 && !(ent.t && ent.t.laneT === laneNo)))
            continue;
          const ahead = ent.s - slot.s, rel = slot.vAl - ent.v;
          if (ahead < 14 + Math.max(0, rel) * 3 && ahead > -(12 + Math.max(0, -rel) * CROSS_T))
            return false;
        }
        return true;
      };
      const slowIn = (laneNo: number) => {
        for (const ent of ents) {
          if (ent.car === car || Math.abs(ent.off - centres[laneNo]) > 2.0) continue;
          const ahead = ent.s - slot.s;
          if (ahead > 0 && ahead < 70 && ent.v < slot.vWant - 2) return true;
        }
        return false;
      };
      if (slot.laneT === slot.lane) {
        const blocked = lead && lead.v < slot.vWant - 3 && gap < 45;
        let goLane: number | null = null;
        if (blocked)
          goLane = clear(slot.lane + 1) ? slot.lane + 1
            : rnd() < 0.3 && clear(slot.lane - 1) && !slowIn(slot.lane - 1) ? slot.lane - 1 : null;
        else if (slot.lane > 0 && slot.keepLeftT > 8 && clear(slot.lane - 1)
          && !slowIn(slot.lane - 1)) goLane = slot.lane - 1;   // keep left
        else if (laneCount > 1 && rnd() < 0.004) {   // now and then, for no reason
          const laneNo = slot.lane + (rnd() < 0.5 ? 1 : -1);
          if (clear(laneNo)) goLane = laneNo;
        }
        if (goLane != null) {
          slot.laneT = goLane;
          slot.ind = Math.sign(goLane - slot.lane);
          slot.indT = IND_T;
        }
      } else if (slot.indT > 0 && !clear(slot.laneT)) {   // changed its mind before moving
        slot.laneT = slot.lane;
        slot.ind = 0;
      }
    }
    // ---- ACROSS: indicate, then drift over at LAT_V. car._trOff = the lane centre it is going
    // to (null = keeping its lane): read by the highway racers (highwayrace.js) so they plan
    // with where a car WILL be - an indicating car is a car about to be in that lane
    car._trOff = slot.laneT !== slot.lane ? centres[slot.laneT] : null;
    if (slot.laneT !== slot.lane) {
      // ABORT while crossing: anything alongside (or closing fast from behind) on the side I am
      // moving to -> back to where I came from
      if (slot.indT <= 0) for (const ent of ents) {
        if (ent.car === car) continue;
        const ahead = ent.s - slot.s, lat = ent.off - slot.laneOff;
        if (Math.sign(lat) !== Math.sign(centres[slot.laneT] - slot.laneOff)
          || Math.abs(lat) > 2.7) continue;
        if (ahead < car.spec.len + 3
          && ahead > -(car.spec.len + 3 + Math.max(0, ent.v - slot.vAl) * 1.5)) {
          const back = slot.lane;
          slot.lane = slot.laneT;
          slot.laneT = back;
          slot.ind = Math.sign(centres[back] - slot.laneOff);
          break;
        }
      }
      if (slot.indT > 0) slot.indT -= dt;
      else {
        const goal = centres[slot.laneT], diff = goal - slot.laneOff, latStep = LAT_V * dt;
        slot.laneOff = Math.abs(diff) <= latStep ? goal : slot.laneOff + Math.sign(diff) * latStep;
        if (slot.laneOff === goal) {
          slot.lane = slot.laneT;
          slot.ind = 0;
          slot.keepLeftT = 0;
          slot.vWant = cruise(slot.lane, laneCount);
        }
      }
    }
    // ---- GENTLY AVOID you / the AI alongside: lean away inside the lane, up to 0.8 m
    let bias = 0;
    for (const ent of ents) {
      if (!ent.you) continue;
      const ahead = ent.s - slot.s, lat = ent.off - slot.off;
      if (Math.abs(ahead) < 7 && Math.abs(lat) < 3.0)
        bias -= Math.sign(lat || 1) * Math.min(0.8, (3.0 - Math.abs(lat)) * 0.5);
    }
    bias = Math.max(-0.8, Math.min(0.8, bias));
    slot.bias += Math.max(-1.2 * dt, Math.min(1.2 * dt, bias - slot.bias));
    // ---- SPEED: cruise, or follow the car ahead; hard braking when a collision is close
    let vTarget = slot.vWant, brakeX = 0;
    if (lead) {
      const wantGap = GAP0 + HEADWAY * Math.max(0, slot.vAl);
      vTarget = Math.min(vTarget, Math.max(0, lead.v + (gap - wantGap) * 0.4));
      if (gap < 2.5) vTarget = 0;
      const close = slot.vAl - lead.v;
      if (close > 0.5) {
        const ttc = gap / close;
        if (ttc < 2.5) brakeX = Math.min(1, (2.5 - ttc) / 1.8);
      }
    }
    // ---- LOD (MEASURED 2026-10-05, tools/_tfprof: applyGround alone is ~17 us per car-step,
    // 18 cars = 0.57 ms a step = a phone frame's budget gone): a car OUT OF VIEW and > PHYS_NEAR
    // m from every real car (you, the AI) is KINEMATIC — the same decisions, then carried
    // along its lane line at its speed (2 m/s^2 up, 7 down, 9 in an emergency). It becomes a
    // real car again before you can see it or touch it.
    if (!slot.phys) {
      slot.vAl += Math.max((brakeX > 0 ? -9 : -7) * dt, Math.min(2 * dt, vTarget - slot.vAl));
      if (slot.vAl < 0) slot.vAl = 0;
      // the lateral drift (lane change) yaws the nose into it, as a driven car's would; the
      // lean toward you is not used (no one is near)
      // (MEASURED: a recycled car inherited the old car's kOff -> one step of a huge sideways
      // speed -> contacts + off the road; now fresh() clears it and the drift rate is capped
      // at the lane-change speed)
      const offK = Math.max(minOff, Math.min(maxOff, slot.laneOff)),
        latV = slot.kOff == null ? 0
          : Math.max(-LAT_V, Math.min(LAT_V, (offK - slot.kOff) / dt));
      slot.kOff = offK;
      const pose = roadPose(level, slot.s + slot.vAl * dt, offK),
        heading = pose.h + Math.atan2(latV, Math.max(3, slot.vAl));
      // yaw rate + steering held at what the BEND needs (MEASURED: woken with both 0 in a
      // bend, a car ran 0.3 m off the edge for 1.2 s)
      const poseAhead = roadPose(level, slot.s + slot.vAl * dt + 4, offK);
      let dHead = poseAhead.h - pose.h;
      dHead = Math.atan2(Math.sin(dHead), Math.cos(dHead));
      const kRoad = dHead / 4;
      car.x = pose.x;
      car.y = pose.y;
      car.heading = heading;
      car.vx = Math.cos(pose.h) * slot.vAl - Math.sin(pose.h) * latV;
      car.vy = Math.sin(pose.h) * slot.vAl + Math.cos(pose.h) * latV;
      car.yawRate = slot.vAl * kRoad;
      car.delta = Math.atan(kRoad * car.spec.L);
      car.indicator = slot.laneT !== slot.lane ? slot.ind : 0;
      car.brakeLight = brakeX;
      slot.deadT = 0;
      slot.kin = true;
      return;
    }
    if (slot.kin) {   // waking up: the gear for the speed it is doing
      slot.kin = false;
      slot.kOff = null;
      gearFor(car, slot.vAl);
    }
    let input;
    if (slot.wreck || tooInjured(car)) {
      slot.wreck = true;
      input = { steer: 0, throttle: 0, brake: 0.7, handbrake: 0, reverse: 0 };
    }
    else {
      // PURE PURSUIT on the lane line (+ the lean), kept inside the carriageway
      const offT = Math.max(minOff, Math.min(maxOff, slot.laneOff + slot.bias)),
        lookAhead = Math.max(10, Math.min(32, 8 + 0.5 * speed)),
        target = roadPose(level, slot.s + lookAhead, offT);
      const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading),
        toX = target.x - car.x, toY = target.y - car.y,
        xLocal = toX * cosH + toY * sinH, yLocal = -toX * sinH + toY * cosH;
      const curv = 2 * yLocal / Math.max(1, xLocal * xLocal + yLocal * yLocal),
        LOCK = car.spec.steerMax || 0.56;
      const steer = Math.max(-1, Math.min(1,
        (Math.atan(curv * car.spec.L) - 0.02 * (car.yawRate - speed * curv)) / LOCK));
      const err = vTarget - slot.vAl,
        brake = Math.max(brakeX, err < -0.8 ? Math.min(1, -err * 0.12) : 0);
      input = {
        steer, throttle: brake > 0 || err <= 0 ? 0 : Math.min(0.75, err * 0.25),
        brake, handbrake: 0, reverse: 0,
      };
    }
    car.indicator = slot.laneT !== slot.lane ? slot.ind : 0;
    car.hazard = slot.wreck;
    car.brakeLight = input.brake;
    slot.deadT = speed < 1 ? slot.deadT + dt : 0;
    // ---- the same physics as every car: clamps (+ the damage they do), ground, then the
    // tyres or the tumble
    const v0x = car.vx, v0y = car.vy;
    fenceClamp(car);
    obstacleClamp(car);
    barrierClamp(car);
    solidClamp(car);
    hit(car, v0x, v0y);
    applyGround(car, dt);
    if (rolling(car)) {
      stepRoll(car, dt, () => {});
      slot.wreck = true;
    }
    else {
      step(car, input, dt);
      tripCheck(car, dt);
    }
  }
  // make room: every traffic car within radius m of (x, y) leaves (the player was just put
  // back there)
  function clearAround(x: number, y: number, radius: number) {
    let count = 0;
    for (const slot of list)
      if (!slot.parked && Math.hypot(slot.car.x - x, slot.car.y - y) < radius) {
        slot.parked = true;
        count++;
      }
    if (count) rebuildCars();
    return count;
  }
  // make room for a RACE GRID: every traffic car with road distance in [fromS, toS] leaves
  // (it rejoins off screen ahead)
  function clearSpan(fromS: number, toS: number) {
    let count = 0;
    for (const slot of list)
      if (!slot.parked && slot.s >= fromS && slot.s <= toS) {
        slot.parked = true;
        count++;
      }
    if (count) rebuildCars();
    return count;
  }
  return {
    cars, reset: resetTraffic, step: stepTraffic, clearAround, clearSpan,
    get list() { return list; }, get want() { return want; },
    stats: () => ({ live: cars.length, want, placed, recycled, visHits }),
  };
}
export type Traffic = ReturnType<typeof createTraffic>;
