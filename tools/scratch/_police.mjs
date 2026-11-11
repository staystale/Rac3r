// _police.mjs - POLICE ON THE HIGHWAYS (?police=1: ai/trafficPolice.ts, ai/policeHeat.ts), headless:
// the endless road with traffic, you driven by the autopilot (held to a speed) or carried along a
// lane, the traffic, the contacts and the heat stepped as the game does (game/police.ts).
//   survey    every road type, both sceneries: KM km at 95 km/h (legal) - police cars met (within
//             150 m) waiting / cruising each way, km a police car; stars earned (none expected)
//   scenarios (motorway): a speed camera at 140 km/h; speeding past a police car (130 / 175 km/h);
//             an unsignalled lane change beside one and a signalled one; flashing the lights by
//             one; chasers per star (1-3, 30 s each); BUSTED when you stop with 2 stars; an escape
//             (you at 260 km/h); a chaser wrecked.
// [PART=survey|scenarios|all] [KM=6] [SEEDS=4242,7] node tools/scratch/_police.mjs
process.env.POLICE = '1';
const { makeCar, reset, step, PHYSICS_STEP_SECONDS: DT } = await import('../../src/vehicle.ts');
const L = await import('../../src/lab.ts');
const hw = await import('../../src/highway.ts');
const { createAIDriver } = await import('../../src/ai/circuit.ts');
const { aiTraits } = await import('../../src/ai/traits.ts');
const { clampWorld } = await import('../../src/world/crossings.ts');
const { createTraffic } = await import('../../src/traffic.ts');
const { createHeat, stepHeat, boxGap } = await import('../../src/ai/policeHeat.ts');
const { makePolice } = await import('../../src/ai/trafficPolice.ts');
const { carContacts } = await import('../../src/contact.ts');
const { hit, damageInit } = await import('../../src/damage.ts');
const { FIX } = await import('../../src/core/fixes.ts');
if (!FIX.police) throw new Error('POLICE=1 did not switch police on');
const PART = process.env.PART || 'all', KM = +(process.env.KM || 6);
const SEEDS = (process.env.SEEDS || '4242,7').split(',').map(Number);
hw.addHighwayLevel();
L.setLevel('highway');
const level = L.LEVEL;

/** A fresh road and traffic, you at the spawn. */
function newWorld(road, scenery, seed, density = 0.6) {
  level.seed = seed;
  level.roadType = null;
  hw.setHighwayPreset(level, road, scenery);
  hw.resetHighway(level);
  const traffic = createTraffic({ rnd: mulberry(seed) });
  traffic.reset(level, density);
  const you = makeCar('hatch-rwd');
  reset(you, level.spawn.x, level.spawn.y, level.spawn.heading);
  // (you: the racing driver at the wheel, as the game's ?autopilot=1 - game/order.ts armStart)
  const world = { traffic, you, heat: null, sub: level.subtrack,
    driver: createAIDriver(level, aiTraits(4, 0, 1)),
    time: 0, want: 95 / 3.6, carry: 0, input: null, lane: null, results: [] };
  world.orders = traffic.police();
  world.heat = (world.orders.heat ||= createHeat());
  return world;
}

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

/** One physics step of the world, as the game's. */
function stepWorld(world) {
  const { you, traffic } = world;
  if (world.carry > 0) carryYou(world);
  else {
    const speed = Math.hypot(you.vx, you.vy);
    const input = world.input ? world.input(world) : { ...world.driver.drive(you, DT,
      { cars: traffic.cars, vMax: Math.max(1, world.want), lap: 1, laps: 99 }) };
    if (!world.input) {
      if (speed > world.want) input.throttle = 0;
      if (speed > world.want + 2) input.brake = Math.max(input.brake, 0.4);
      if (world.want < 0.5) Object.assign(input, { throttle: 0, brake: 1 });
    }
    const v0x = you.vx, v0y = you.vy;
    clampWorld(you, DT);
    hit(you, v0x, v0y);
    L.applyGround(you, DT);
    step(you, input, DT);
  }
  hw.stepHighway(level, you);
  const cam = hw.speedCamera(level, you);
  traffic.step(DT, { player: you });
  const all = [you, ...traffic.cars], startVel = all.map((car) => [car.vx, car.vy]);
  carContacts(all);
  const touched = you._hitKind === 'car' && Math.hypot(you.vx - startVel[0][0],
    you.vy - startVel[0][1]) > 1.5;
  all.forEach((car, i) => hit(car, startVel[i][0], startVel[i][1]));
  const result = stepHeat(world.heat, { dt: DT, player: you, level, slots: traffic.list,
    cars: traffic.cars, orders: world.orders, camera: !!cam, touched });
  world.time += DT;
  if (cam) world.results.push(`camera at ${(cam.kmh)} km/h, t ${world.time.toFixed(1)} s`);
  if (result === 'busted') {
    world.busted = world.time;
    traffic.clearPolice();
    world.heat.stars = 0;
  }
  if (result === 'escaped') world.escaped = world.time;
  return result;
}

/** You carried along your lane at world.carry m/s (faster than any car could be driven here). */
function carryYou(world) {
  const { you } = world, here = level._hw.q;
  if (!here) return;
  const off = world.carryOff ?? level._hw.geo.centres[0];
  const pose = hw.roadPose(level, here.s + world.carry * DT, off);
  you.x = pose.x;
  you.y = pose.y;
  you.heading = pose.h;
  you.vx = Math.cos(pose.h) * world.carry;
  you.vy = Math.sin(pose.h) * world.carry;
  you.yawRate = 0;
}

const policeSlots = (world) => world.traffic.list.filter((slot) => !slot.parked && slot.police);
const chasers = (world) => policeSlots(world).filter((slot) => slot.police.mode === 'chase');
const near = (world, car, metres) => Math.hypot(car.x - world.you.x, car.y - world.you.y) < metres;
const run = (world, seconds, each) => {
  for (let time = 0; time < seconds; time += DT) {
    const result = stepWorld(world);
    if (each && each(world, result) === false) return;
  }
};

/** The survey: police met on each road. */
function survey() {
  console.log(`SURVEY: ${KM} km at 95 km/h (legal), traffic 0.6`);
  for (const scenery of ['countryside', 'canyon'])
    for (const road of ['motorway', 'interstate', 'dual', 'walled', 'twisty'])
      for (const seed of SEEDS) {
        const world = newWorld(road, scenery, seed);
        const met = new Map(), starsAt = [];
        let lastStars = 0;
        while ((level._hw.driven || 0) < KM * 1000 && world.time < KM * 120) {
          stepWorld(world);
          for (const slot of policeSlots(world))
            if (!met.has(slot.car) && near(world, slot.car, 150))
              met.set(slot.car, `${slot.police.mode}${(slot.dir ?? 1) < 0 ? '-oncoming' : ''}`
                + `${slot.police.mode === 'wait' ? '@' + waitWhere(slot) : ''}`);
          if (world.heat.stars !== lastStars) {
            starsAt.push(`${world.heat.stars}* at ${world.time.toFixed(0)} s (`
              + `${world.heat.stars < lastStars ? 'lost them'
                : world.heat.offences.slice(-1)[0]})`);
            lastStars = world.heat.stars;
          }
        }
        const kinds = {};
        for (const kind of met.values()) kinds[kind] = (kinds[kind] || 0) + 1;
        const km = (level._hw.driven || 0) / 1000;
        console.log(`  ${scenery.padEnd(11)} ${road.padEnd(10)} ${String(seed).padEnd(5)}`
          + ` ${km.toFixed(1)} km: ${met.size} police met (${JSON.stringify(kinds)}),`
          + ` ${met.size ? (km / met.size).toFixed(2) : '-'} km each; dealt ${world.orders.dealt}`
          + `, placed ahead ${world.orders.placed}, put waiting ${world.orders.waiting};`
          + ` heat: ${starsAt.join(', ') || 'none'}`);
      }
}

/** Where a waiting police car waits: a forecourt (concrete), a lay-by or the shoulder / verge. */
function waitWhere(slot) {
  const half = level._hw.geo.hw;
  const out = -slot.off - half;
  return out > 6 ? 'forecourt' : out > 0 ? 'layby-or-verge' : 'shoulder';
}

/** A police car of our way cruising in our left lane `ahead` m ahead of you, at `kmh`. */
function placePolice(world, ahead, kmh, laneIdx = 0) {
  const slot = world.traffic.list.find((each) => !each.parked && (each.dir ?? 1) > 0
    && !each.police && !each.broke);
  const here = level._hw.q, lanes = level._hw.geo.own;
  const pose = hw.roadPose(level, here.s + ahead, lanes[laneIdx]);
  reset(slot.car, pose.x, pose.y, pose.h);
  Object.assign(slot, { s: here.s + ahead, off: lanes[laneIdx], lane: laneIdx, laneT: laneIdx,
    laneOff: lanes[laneIdx], kOff: null, vAl: kmh / 3.6, vWant: kmh / 3.6, racer: null,
    quick: true });
  slot.car.vx = Math.cos(pose.h) * kmh / 3.6;
  slot.car.vy = Math.sin(pose.h) * kmh / 3.6;
  makePolice(ctxOf(world), slot);
  slot.vWant = kmh / 3.6;
  slot.quick = true;
  return slot;
}
// the traffic's context as makePolice reads it (its dice and its police orders)
const ctxOf = (world) => ({ rnd: Math.random, police: world.orders, level });

/** Drive legally for a while from a fresh motorway, to get going. */
function warm(seed = 4242, road = 'motorway', kmh = 95) {
  const world = newWorld(road, 'countryside', seed);
  world.want = kmh / 3.6;
  run(world, 20);
  world.heat.offences.length = 0;
  return world;
}

/** Report one scenario's line. */
const say = (name, text) => console.log(`  ${name.padEnd(22)} ${text}`);

function scenarioCamera() {
  const world = warm();
  world.carry = 140 / 3.6;
  let caughtAt = null, seenAt = null, closeAt = null;
  run(world, 150, (each) => {
    // (no police car by you before the camera: the camera alone)
    if (caughtAt == null && !each.results.length) {
      each.traffic.clearPolice();
      each.heat.stars = 0;
      each.heat.offences.length = 0;
    }
    if (caughtAt == null && each.heat.stars > 0) {
      caughtAt = each.time;
      // (then on at 95 km/h, driven: the chaser comes)
      each.carry = 0;
    }
    if (caughtAt != null && seenAt == null && each.heat.sees) seenAt = each.time;
    if (caughtAt != null && closeAt == null && chasers(each).some((slot) => near(each, slot.car,
      30))) closeAt = each.time;
    return closeAt == null;
  });
  say('speed camera', caughtAt == null ? 'NO CAMERA PASSED in 150 s'
    : `${world.results[0]}: ${world.heat.stars} star(s) (${world.heat.offences.join(', ')}),`
    + ` police due to ${Math.round(world.orders.dueUntil - level._hw.q.s)} m ahead;`
    + ` a chaser sees you ${seenAt ? (seenAt - caughtAt).toFixed(1) + ' s' : 'never'} later,`
    + ` within 30 m ${closeAt ? (closeAt - caughtAt).toFixed(1) + ' s' : 'never'} later;`
    + ` sent ${world.orders.sent}, joined ${world.orders.joined}`);
}

function scenarioSpeeding(kmh) {
  const world = warm();
  const slot = placePolice(world, 80, 95, 1);
  world.carry = kmh / 3.6;
  let passedAt = null, closest = 99, firstStars = 0;
  run(world, 20, (each) => {
    closest = Math.min(closest, Math.hypot(slot.car.x - each.you.x, slot.car.y - each.you.y));
    if (passedAt == null && each.heat.stars) {
      passedAt = each.time;
      firstStars = each.heat.stars;
    }
  });
  say(`speeding ${kmh} km/h`, `past a police car (closest ${closest.toFixed(1)} m):`
    + ` ${firstStars} star(s) from ${world.heat.offences[0] || 'nothing'}`
    + ` (then ${world.heat.stars}: ${world.heat.offences.join(', ')})`);
}

function scenarioLane(signal) {
  const world = warm(4242, 'motorway', 95);
  const lanes = level._hw.geo.centres;
  world.carry = 95 / 3.6;
  world.carryOff = lanes[0];
  run(world, 2);
  const slot = placePolice(world, 15, 95, 2);
  const startOff = level._hw.q.off;
  if (signal) world.you.indicator = 1;
  let maxOff = startOff;
  // across one lane in 3 s
  run(world, 6, (each) => {
    each.carryOff = Math.min(lanes[1], each.carryOff + (lanes[1] - lanes[0]) / 3 * DT);
    maxOff = Math.max(maxOff, level._hw.q.off);
  });
  say(`lane change ${signal ? 'signalled' : 'unsignalled'}`, `moved ${(maxOff - startOff)
    .toFixed(1)} m across beside a police car ${Math.hypot(slot.car.x - world.you.x,
    slot.car.y - world.you.y).toFixed(0)} m away: ${world.heat.stars} star(s)`
    + ` [${world.heat.offences.join(', ')}]`);
}

function scenarioFlash() {
  const world = warm();
  world.carry = 95 / 3.6;
  placePolice(world, 30, 95, 1);
  world.you.lightsOn = false;
  run(world, 1);
  world.you.lightsOn = true;
  run(world, 0.4);
  world.you.lightsOn = false;
  run(world, 1);
  const flashed = world.heat.stars;
  // control: on, then off 3 s later (not a flash)
  const control = warm();
  control.carry = 95 / 3.6;
  placePolice(control, 30, 95, 1);
  control.you.lightsOn = true;
  run(control, 3);
  control.you.lightsOn = false;
  run(control, 1);
  say('flashing the lights', `on and off in 0.4 s by a police car: ${flashed} star(s)`
    + ` [${world.heat.offences.join(', ')}]; on, then off 3 s later: ${control.heat.stars}`);
}

function scenarioStars() {
  for (const stars of [1, 2, 3]) {
    const world = warm(4242, 'motorway', 95);
    world.heat.stars = stars;
    let maxChasers = 0, closeAt = null;
    let maxStars = stars;
    run(world, 30, (each) => {
      // (held: no escape while counting)
      each.heat.escapeT = 0;
      maxStars = Math.max(maxStars, each.heat.stars);
      maxChasers = Math.max(maxChasers, chasers(each).length);
      if (closeAt == null && chasers(each).length >= stars && chasers(each).every((slot) =>
        near(each, slot.car, 40))) closeAt = each.time - 20;
    });
    const hits = world.you.dmgHits || 0;
    const gaps = chasers(world).map((slot) => Math.hypot(slot.car.x - world.you.x,
      slot.car.y - world.you.y).toFixed(0)).join('/');
    say(`chase at ${stars} star(s)`, `(stars after offences in it ${maxStars}: ${world.heat.offences.join(', ') || 'none'}) ${maxChasers} chasers (sent ${world.orders.sent}, joined`
      + ` ${world.orders.joined}); all within 40 m at ${closeAt ? closeAt.toFixed(1) + ' s'
      : 'never'}, at 30 s ${gaps} m away; your damaging hits ${hits}, damage ${hurt(world.you).toFixed(2)}`);
  }
}
const hurt = (car) => (car.dmg ? (car.dmg[0] + car.dmg[1] + car.dmg[2] + car.dmg[3]) / 4 : 0);

function scenarioBust(kmh = 95, stars = 2) {
  const world = warm(4242, 'motorway', kmh);
  world.heat.stars = stars;
  run(world, 8, (each) => { each.heat.escapeT = 0; });
  world.want = 0;
  let stoppedAt = null, gap = 99;
  let tick = 0;
  run(world, 90, (each) => {
    each.heat.escapeT = 0;
    if (process.env.TRACE && !((tick++) % 120)) console.log(each.time.toFixed(0), (Math.hypot(
      each.you.vx, each.you.vy) * 3.6).toFixed(0), chasers(each).map((slot) => `${(slot.s
      - level._hw.q.s).toFixed(0)}m ${(Math.hypot(slot.car.vx, slot.car.vy) * 3.6).toFixed(0)}`
      + ` gap ${boxGap(slot.car, each.you).toFixed(1)}${slot.wreck ? ' W' : ''}`).join(' | '));
    if (stoppedAt == null && Math.hypot(each.you.vx, each.you.vy) < 2) stoppedAt = each.time;
    for (const slot of chasers(each)) gap = Math.min(gap, boxGap(slot.car, each.you));
    return each.busted == null;
  });
  say(`busted (${kmh} km/h, ${stars}*)`, world.busted ? `stopped at ${stoppedAt.toFixed(1)} s, BUSTED at`
    + ` ${world.busted.toFixed(1)} s (${(world.busted - stoppedAt).toFixed(1)} s after), the police`
    + ` cleared: ${policeSlots(world).length} police left, stars ${world.heat.stars}`
    : `NOT BUSTED in 90 s (closest box gap ${gap.toFixed(2)} m, chasers ${chasers(world).length})`);
}

function scenarioEscape() {
  const world = warm(4242, 'motorway', 95);
  world.heat.stars = 1;
  let firstSeen = null;
  run(world, 30, (each) => {
    if (each.heat.sees && firstSeen == null) firstSeen = each.time;
    each.heat.escapeT = 0;
    return !chasers(each).some((slot) => near(each, slot.car, 40));
  });
  // (along the hard shoulder: carried, you would go through the traffic)
  world.carryOff = -level._hw.geo.hw + level._cfg.shoulder / 2;
  world.carry = 260 / 3.6;
  const fromT = world.time;
  let lastSeen = null;
  run(world, 60, (each) => {
    if (each.heat.sees) lastSeen = each.time;
    return each.escaped == null;
  });
  say('escape', world.escaped ? `carried at 260 km/h up the hard shoulder from ${fromT.toFixed(0)} s: last seen`
    + ` ${(lastSeen - fromT).toFixed(1)} s later, LOST THEM ${(world.escaped - lastSeen).toFixed(1)}`
    + ` s after that; stars ${world.heat.stars}, chasers ${chasers(world).length}`
    : `NO ESCAPE in 60 s (chasers ${chasers(world).length}, stars ${world.heat.stars},`
    + ` offences ${world.heat.offences.join(', ')})`);
}

function scenarioWreck() {
  const world = warm(4242, 'motorway', 95);
  world.heat.stars = 1;
  run(world, 30, (each) => {
    each.heat.escapeT = 0;
    return !chasers(each).some((slot) => near(each, slot.car, 60));
  });
  const slot = chasers(world)[0];
  if (!slot) return say('wreck', 'no chaser came');
  if (!slot.car.dmg) damageInit(slot.car);
  slot.car.dmg = [0.9, 0.9, 0.9, 0.9];
  const from = world.time, before = world.orders.vanished;
  let goneAt = null;
  run(world, 6, (each) => {
    each.heat.escapeT = 0;
    if (goneAt == null && (slot.parked || !slot.police)) goneAt = each.time;
  });
  say('wreck', `a chaser wrecked: gone ${goneAt ? (goneAt - from).toFixed(2) + ' s' : 'NOT'} later`
    + ` (vanished ${world.orders.vanished - before}); chasers now ${chasers(world).length}`);
}

if (PART === 'survey' || PART === 'all') survey();
if (PART === 'scenarios' || PART === 'all') {
  console.log('SCENARIOS (countryside motorway, seed 4242, traffic 0.6):');
  scenarioCamera();
  scenarioSpeeding(130);
  scenarioSpeeding(175);
  scenarioLane(false);
  scenarioLane(true);
  scenarioFlash();
  scenarioStars();
  scenarioBust();
  scenarioBust(130, 3);
  scenarioEscape();
  scenarioWreck();
}

/** TRACE: a chase at STARS stars, each second: every chaser's distance, speed, state. */
function trace() {
  const stars = +(process.env.STARS || 1);
  const world = warm(4242, 'motorway', 95);
  world.heat.stars = stars;
  let tick = 0;
  const known = new Set();
  run(world, +(process.env.SECONDS || 30), (each) => {
    each.heat.escapeT = 0;
    each.heat.stars = stars;
    for (const slot of chasers(each)) known.add(slot);
    const fine = each.time > +(process.env.FROM || 999) && each.time < +(process.env.TO || 0);
    if ((tick++) % (fine ? 15 : 120)) return;
    const rows = [...known].map((slot) => (slot.parked || !slot.police ? 'GONE'
      : `${Math.hypot(slot.car.x - each.you.x, slot.car.y - each.you.y).toFixed(0)}m`
      + ` ${(Math.hypot(slot.car.vx, slot.car.vy) * 3.6).toFixed(0)}/${(slot.vWant * 3.6)
        .toFixed(0)}kmh ${slot.police.mode}${slot.phys ? ' phys' : ' kin'}`
      + `${slot.wreck ? ' WRECK' : ''} ds ${(slot.s - level._hw.q.s).toFixed(0)}`
      + ` off ${slot.off.toFixed(1)} dmg ${hurt(slot.car).toFixed(2)} hit ${slot.car._hitKind || ''}`));
    console.log(`${each.time.toFixed(2)}s you off ${level._hw.q.off.toFixed(1)} dmg ${hurt(each.you).toFixed(2)} ${(Math.hypot(each.you.vx, each.you.vy) * 3.6)
      .toFixed(0)}kmh: ${rows.join(' | ')}  sent ${each.orders.sent} vanished`
      + ` ${each.orders.vanished}`);
  });
}
if (PART === 'trace') trace();
if (PART === 'escape') scenarioEscape();
if (PART === 'bust') scenarioBust(+(process.env.KMH || 130), +(process.env.STARS || 3));

/** WHOHIT: a chase at 1 star; each time a chaser is hurt, what is nearest it. */
function whoHit() {
  const world = warm(4242, 'motorway', 95);
  world.heat.stars = 1;
  const before = new Map();
  run(world, +(process.env.SECONDS || 40), (each) => {
    each.heat.escapeT = 0;
    each.heat.stars = 1;
    for (const slot of chasers(each)) {
      const now = hurt(slot.car), was = before.get(slot) ?? now;
      before.set(slot, now);
      if (now - was < 0.005) continue;
      const others = [each.you, ...each.traffic.cars].filter((car) => car !== slot.car)
        .map((car) => ({ car, gap: boxGap(car, slot.car) })).sort((a, b) => a.gap - b.gap);
      const ram = others[0];
      console.log(`${each.time.toFixed(2)}s chaser hurt +${(now - was).toFixed(3)} at`
        + ` ${(Math.hypot(slot.car.vx, slot.car.vy) * 3.6).toFixed(0)} km/h: nearest`
        + ` ${ram.car === each.you ? 'YOU' : ram.car.spec.id} gap ${ram.gap.toFixed(2)} m,`
        + ` its speed ${(Math.hypot(ram.car.vx, ram.car.vy) * 3.6).toFixed(0)}`);
    }
  });
}
if (PART === 'whohit') whoHit();
