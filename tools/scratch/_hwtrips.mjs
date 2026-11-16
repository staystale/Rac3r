// _hwtrips.mjs - THE TRAFFIC'S TRIPS (TODO 3a2 item 15), headless as tools/scratch/_parkedpolice.mjs:
// the endless road with traffic, you carried along a lane at SPEED km/h, the traffic and the
// heats stepped as the game does. Counts, per road:
//   SLIPS  our way's cars passing each slip road (short / long / a junction's off-slip) and those
//          that took it (leaving), police apart; the rolls won, missed (dropped) and carried on
//          to the next slip
//   FUEL   our way's cars passing each roadside station and those that pulled in, police apart
//   JOINS  cars put on an on-ramp, merged, held at the give-way (and for how long), lost before
//          merging; the seconds from the ramp to in the lane
//   SAFETY car-to-car contact steps (any cars; and those with a car on a trip in them - a police
//          chase, a different one each way, swings the first), traffic step cost (us a step, node)
// The screen: VIEW_M m round you (a phone zoomed out on the highway sees ~80-100 m).
// [KM=8] [SEEDS=4242,7] [ROADS=motorway,dual] [SCENERIES=countryside,canyon] [SPEED=100] [LANE=1]
// [VIEW_M=90]   node tools/scratch/_hwtrips.mjs
process.env.POLICE = '1';
const { makeCar, reset, PHYSICS_STEP_SECONDS: DT } = await import('../../src/vehicle.ts');
const L = await import('../../src/lab.ts');
const hw = await import('../../src/highway.ts');
const { createTraffic } = await import('../../src/traffic.ts');
const { createHeat, stepHeats } = await import('../../src/ai/policeHeat.ts');
const { carContacts } = await import('../../src/contact.ts');
const { hit } = await import('../../src/damage.ts');
const { waysOf } = await import('../../src/ai/trafficTrips.ts');
const { stationsOf } = await import('../../src/ai/trafficFuel.ts');
const KM = +(process.env.KM || 8);
const SEEDS = (process.env.SEEDS || '4242,7').split(',').map(Number);
const ROADS = (process.env.ROADS || 'motorway,dual').split(',');
const SCENERIES = (process.env.SCENERIES || 'countryside,canyon').split(',');
const SPEED = +(process.env.SPEED || 100), LANE = +(process.env.LANE ?? 1);
const VIEW_M = +(process.env.VIEW_M || 90);
hw.addHighwayLevel();
L.setLevel('highway');
const level = L.LEVEL;

/** A seeded random source (the traffic's dice the same each run). */
function mulberry(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mix = Math.imul(state ^ (state >>> 15), 1 | state);
    mix = (mix + Math.imul(mix ^ (mix >>> 7), 61 | mix)) ^ mix;
    return ((mix ^ (mix >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh road and traffic, you at the spawn. */
function newWorld(road, scenery, seed) {
  Math.random = mulberry(seed + 1);
  level.seed = seed;
  level.roadType = null;
  hw.setHighwayPreset(level, road, scenery);
  hw.resetHighway(level);
  const traffic = createTraffic({ rnd: mulberry(seed) });
  traffic.reset(level, 0.6);
  const you = makeCar('hatch-rwd');
  reset(you, level.spawn.x, level.spawn.y, level.spawn.heading);
  const world = { traffic, you, time: 0, orders: traffic.police(), heat: createHeat(),
    contacts: 0, tripContacts: 0, stepMs: 0, steps: 0 };
  world.orders.heats.set(you, world.heat);
  return world;
}

/** You carried along your lane at SPEED. */
function carryYou(world) {
  const { you } = world, here = level._hw.q, speed = SPEED / 3.6;
  if (!here) return;
  const lanes = level._hw.geo.own, lane = lanes[Math.min(LANE, lanes.length - 1)];
  const pose = hw.roadPose(level, here.s + speed * DT, lane);
  Object.assign(you, { x: pose.x, y: pose.y, heading: pose.h, yawRate: 0,
    vx: Math.cos(pose.h) * speed, vy: Math.sin(pose.h) * speed });
}

/** One physics step of the world, as the game's (you carried). */
function stepWorld(world) {
  const { you, traffic } = world;
  carryYou(world);
  hw.stepHighway(level, you);
  const cam = hw.speedCamera(level, you);
  const started = performance.now();
  traffic.step(DT, { player: you, others: [], visible: (x, y) => Math.hypot(x - you.x,
    y - you.y) < VIEW_M });
  world.stepMs += performance.now() - started;
  world.steps++;
  const all = [you, ...traffic.cars], startVel = all.map((car) => [car.vx, car.vy]);
  const touches = carContacts(all);
  world.contacts += touches;
  world.tripContacts += tripTouches(world, all);
  if (touches && process.env.DEBUG) logTouch(world, all);
  all.forEach((car, i) => hit(car, startVel[i][0], startVel[i][1]));
  const drivers = [{ car: you, frame: level._hw.q, isYou: true, camera: !!cam, kind: 'you',
    touched: false }, ...traffic.list.filter((slot) => !slot.parked && !slot.police).map((slot) =>
    ({ car: slot.car, frame: slot, isYou: false, camera: false, kind: 'traffic', owner: slot,
      touched: false }))];
  stepHeats(world.orders, drivers, { dt: DT, level, slots: traffic.list, cars: traffic.cars });
  if (world.heat.stars > (world.lastStars || 0)) (world.starLog ||= []).push(`${world.time.toFixed(0)}s:${world.heat.offences.join("+")}`);
  world.lastStars = world.heat.stars;
  for (const slot of traffic.list) {
    const heat = world.orders.heats.get(slot.car), had = (world.had ||= new WeakMap()).get(slot.car) || 0;
    if (heat && heat.stars > had) (world.trafficStars ||= []).push(`${heat.offences.join("+")}${slot.trip ? "/" + slot.trip.kind + (slot.trip.path ? "-path" : "") : ""}${slot.broke ? "/broke" : ""}`);
    if (heat) world.had.set(slot.car, heat.stars);
  }
  world.time += DT;
}

/** The touching pairs (within 5 m) with a car on a trip in them. */
function tripTouches(world, all) {
  const list = world.traffic.list;
  const onTrip = new Set(list.filter((slot) => slot.trip).map((slot) => slot.car));
  const police = new Set(list.filter((slot) => slot.police).map((slot) => slot.car));
  const pumps = new Set(list.filter((slot) => slot.broke?.at != null).map((slot) => slot.car));
  // (each kind counted once a touch: a pair touching now that was not touching the step before)
  const kinds = (world.kinds ||= { you: 0, police: 0, pumps: 0, trip: 0, other: 0 });
  const ids = (world.ids ||= new WeakMap()), idOf = (car) => {
    if (!ids.has(car)) ids.set(car, world.nextId = (world.nextId || 0) + 1);
    return ids.get(car);
  };
  const before = world.touching || new Set(), now = new Set();
  world.touching = now;
  let count = 0;
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const first = all[i], second = all[j];
    if (Math.hypot(first.x - second.x, first.y - second.y) >= 5) continue;
    if (onTrip.has(first) || onTrip.has(second)) count++;
    const key = Math.min(idOf(first), idOf(second)) + ':' + Math.max(idOf(first), idOf(second));
    now.add(key);
    if (before.has(key)) continue;
    const has = (set) => set.has(first) || set.has(second);
    if (has(onTrip)) kinds.trip++;
    if (first === world.you || second === world.you) kinds.you++;
    else if (has(police)) kinds.police++;
    else if (has(pumps)) kinds.pumps++;
    else kinds.other++;
  }
  return count;
}

/** Who a car is, for the log. */
function whoIs(world, car) {
  if (car === world.you) return 'you';
  const slot = world.traffic.list.find((each) => each.car === car);
  if (!slot) return 'bridgecar';
  const trip = slot.trip;
  return `${trip?.kind || '-'}${trip?.path ? '/path' : ''}${trip?.merge ? '/merge' : ''}`
    + ` s${slot.s.toFixed(0)} off${slot.off.toFixed(1)} v${slot.vAl.toFixed(1)}`
    + ` ${slot.phys ? 'phys' : 'kin'}${slot.police ? ' pol' : ''}${slot.broke ? ' broke' : ''}`;
}

/** The cars touching, now and then (DEBUG=1). */
function logTouch(world, all) {
  world.touchLog = (world.touchLog || 0) + 1;
  if (world.touchLog % 120 !== 1) return;
  const near = [];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++)
    if (Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y) < 6)
      near.push(`[${whoIs(world, all[i])}] x [${whoIs(world, all[j])}]`);
  console.log(`  ${world.time.toFixed(1)} s touch: ${near.join(' ; ')}`);
}

/** A line of the event log (DEBUG=1). */
function note(world, what, data) {
  if (process.env.DEBUG) console.log(`  ${world.time.toFixed(1)} s ${what} ${JSON.stringify(data)}`);
}

/** A tally of passes and takes, split traffic / police. */
const tally = () => ({ pass: 0, took: 0, polPass: 0, polTook: 0 });

/** Counts one run. */
function run(road, scenery, seed) {
  const world = newWorld(road, scenery, seed), list = world.traffic.list;
  const slips = tally(), fuel = tally();
  const joins = { put: 0, merged: 0, held: 0, holdS: [], lost: 0, rampS: [] };
  const rolls = { slip: 0, slipWon: 0, slipMissed: 0, slipCarried: 0, fuel: 0, fuelWon: 0, fuelMissed: 0 };
  const memo = new Map();
  while ((level._hw.driven || 0) < KM * 1000 && world.time < KM * 90) {
    stepWorld(world);
    // (counted where every car is still on the road: before a car leaving starts across - 25 m
    // before the slip - and before one for fuel slows - 170 m before the pumps)
    const half = level._hw.geo.hw, exits = waysOf(level).exits.map((each) => each.s - 30);
    const stations = stationsOf({ level }).map((each) => each.s - 175);
    for (const slot of list) {
      let seen = memo.get(slot);
      if (!seen || seen.car !== slot.car) {
        if (seen && seen.trip?.kind === 'join' && !seen.merged) {
          joins.lost++;
          note(world, 'join lost', seen.last);
        }
        seen = { car: slot.car, s: slot.s, trip: null, broke: null, slipAt: slot.slipAt,
          stationAt: slot.stationAt, merged: false, holdT: 0, joinT: 0 };
        memo.set(slot, seen);
      }
      if (slot.parked || (slot.dir ?? 1) < 0 || slot.racer) {
        seen.s = slot.s;
        continue;
      }
      const isPolice = !!slot.police, trip = slot.trip ?? null;
      const onRoad = Math.abs(slot.off) < half;
      const crossed = (list2) => list2.filter((dist) => seen.s < dist && slot.s >= dist).length;
      if (onRoad && slot.s - seen.s < 20) {
        const passedSlips = crossed(exits), passedStations = crossed(stations);
        slips[isPolice ? 'polPass' : 'pass'] += passedSlips;
        fuel[isPolice ? 'polPass' : 'pass'] += passedStations;
      }
      // (a trip begun / ended)
      if (trip !== seen.trip) {
        if (trip?.kind === 'exit') rolls.slipWon++;
        if (trip?.kind === 'fuel') rolls.fuelWon++;
        if (trip?.kind === 'join') {
          joins.put++;
          seen.joinT = world.time;
        }
        if (seen.trip && !trip) {
          if (seen.trip.kind === 'exit' && !seen.trip.path) {
            rolls.slipMissed++;
            note(world, 'exit missed', { ...seen.last, lane: slot.lane, laneT: slot.laneT,
              recycled: seen.car !== slot.car });
          }
          if (seen.trip.kind === 'fuel' && !slot.broke) rolls.fuelMissed++;
          if (seen.trip.kind === 'join') {
            joins.merged++;
            seen.merged = true;
            joins.rampS.push(world.time - seen.joinT);
          }
        }
        seen.trip = trip;
        seen.tripAt = trip?.at;
        seen.tripPath = false;
      }
      // (a car that missed its slip going on for the next one)
      if (trip && trip === seen.trip && trip.kind === 'exit' && trip.at !== seen.tripAt) {
        rolls.slipCarried++;
        note(world, 'exit carried on', { from: seen.tripAt, to: trip.at, lane: slot.lane });
      }
      seen.tripAt = trip?.at;
      if (trip?.kind === 'exit' && trip.path && !seen.tripPath) {
        seen.tripPath = true;
        slips[isPolice ? 'polTook' : 'took']++;
      }
      if (trip?.kind === 'join' && trip.path && !trip.committed && slot.vAl < 0.5) {
        if (!seen.holdT) joins.held++;
        seen.holdT += DT;
      } else if (seen.holdT) {
        joins.holdS.push(seen.holdT);
        seen.holdT = 0;
      }
      if (slot.broke?.at != null && seen.broke == null) fuel[isPolice ? 'polTook' : 'took']++;
      seen.broke = slot.broke?.at ?? null;
      if (slot.slipAt !== seen.slipAt) rolls.slip++;
      if (slot.stationAt !== seen.stationAt) rolls.fuel++;
      seen.slipAt = slot.slipAt;
      seen.stationAt = slot.stationAt;
      seen.s = slot.s;
      if (trip) seen.last = { s: +slot.s.toFixed(0), off: +slot.off.toFixed(1),
        v: +slot.vAl.toFixed(1), along: trip.path ? +trip.path.along.toFixed(0) : null,
        total: trip.path ? +trip.path.total.toFixed(0) : null, at: +trip.at.toFixed(0),
        merge: !!trip.merge, committed: trip.committed, phys: slot.phys,
        youS: +level._hw.q.s.toFixed(0) };
      if (trip && trip !== seen.loggedTrip) {
        seen.loggedTrip = trip;
        note(world, 'trip ' + trip.kind, seen.last);
      }
    }
  }
  const median = (values) => (values.length ? [...values].sort((first, second) => first - second)[
    values.length >> 1].toFixed(1) : '-');
  const share = (part, whole) => (whole ? `${part}/${whole} (${(100 * part / whole).toFixed(1)}%)`
    : `${part}/0`);
  const km = (level._hw.driven || 0) / 1000;
  return [`${road}/${scenery} seed ${seed}: ${km.toFixed(1)} km, ${world.time.toFixed(0)} s`,
    `  SLIPS traffic took ${share(slips.took, slips.pass)}, police ${share(slips.polTook,
      slips.polPass)}; rolls ${rolls.slip} won ${rolls.slipWon} missed ${rolls.slipMissed} carried on ${rolls.slipCarried}`,
    `  FUEL  traffic in ${share(fuel.took, fuel.pass)}, police ${share(fuel.polTook,
      fuel.polPass)}; rolls ${rolls.fuel} won ${rolls.fuelWon} missed ${rolls.fuelMissed}`,
    `  JOINS put ${joins.put}, merged ${joins.merged} (ramp to lane median ${median(joins.rampS)}`
      + ` s), held ${joins.held} (median ${median(joins.holdS)} s), lost before merging`
      + ` ${joins.lost}`,
    `  SAFETY contact steps ${world.contacts} (${(world.contacts / Math.max(0.1, km)).toFixed(1)}`
      + `/km), with a car on a trip ${world.tripContacts} ${JSON.stringify(world.kinds || {})},`
      + ` stars ${(world.starLog || []).join(" ")}; traffic stars ${(world.trafficStars || []).join(" ")}, traffic step ${(world.stepMs / Math.max(1, world.steps) * 1000).toFixed(0)} us`]
    .join('\n');
}

console.log(`SPEED=${SPEED} LANE=${LANE} KM=${KM}`);
for (const scenery of SCENERIES) for (const road of ROADS) for (const seed of SEEDS)
  console.log(run(road, scenery, seed));
