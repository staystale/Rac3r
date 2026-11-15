// _parkedpolice.mjs - THE WAITING (PARKED) POLICE CARS AS YOU PASS THEM (TODO 3a2 item 14), headless
// as tools/scratch/_police.mjs: the endless road with traffic, you carried along the left lane, the
// traffic and every driver's heat stepped as the game does (game/police.ts). Two runs a road:
//   SPEED    at 130 km/h (over 70 mph), your heat and your chasers cleared before each waiting car:
//            how many you pass, how many give you a star as you pass (and for what), how close.
//   STARRED  at 95 km/h, held at 1 star (no chaser owed): the waiting cars met (within 200 m) -
//            how many woke and joined the chase after you (s after you drew level, m you were past
//            it), how many woke for another driver with heat, how many you passed stayed put.
// [KM=8] [SEEDS=4242,7] [ROADS=motorway,dual] [SCENERIES=countryside,canyon] [HWPARKED=1]
//   node tools/scratch/_parkedpolice.mjs
process.env.POLICE = '1';
const { makeCar, reset, PHYSICS_STEP_SECONDS: DT } = await import('../../src/vehicle.ts');
const L = await import('../../src/lab.ts');
const hw = await import('../../src/highway.ts');
const { createTraffic } = await import('../../src/traffic.ts');
const { createHeat, stepHeats } = await import('../../src/ai/policeHeat.ts');
const { carContacts } = await import('../../src/contact.ts');
const { hit } = await import('../../src/damage.ts');
const KM = +(process.env.KM || 8);
const SEEDS = (process.env.SEEDS || '4242,7').split(',').map(Number);
const ROADS = (process.env.ROADS || 'motorway,dual').split(',');
const SCENERIES = (process.env.SCENERIES || 'countryside,canyon').split(',');
// m: within this of you a waiting car is "being passed" (its closest is read); the sight the wake
// is measured from
const PASS_M = 60, SIGHT_M = 200;
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
  // (the game's other dice - the cones, the AI - seeded too: a run repeats)
  Math.random = mulberry(seed + 1);
  level.seed = seed;
  level.roadType = null;
  hw.setHighwayPreset(level, road, scenery);
  hw.resetHighway(level);
  const traffic = createTraffic({ rnd: mulberry(seed) });
  traffic.reset(level, 0.6);
  const you = makeCar('hatch-rwd');
  reset(you, level.spawn.x, level.spawn.y, level.spawn.heading);
  const world = { traffic, you, time: 0, carry: 0, orders: traffic.police(), heat: createHeat() };
  world.orders.heats.set(you, world.heat);
  return world;
}

/** You carried along the left lane at world.carry m/s. */
function carryYou(world) {
  const { you } = world, here = level._hw.q;
  if (!here) return;
  const pose = hw.roadPose(level, here.s + world.carry * DT, level._hw.geo.centres[0]);
  Object.assign(you, { x: pose.x, y: pose.y, heading: pose.h, yawRate: 0,
    vx: Math.cos(pose.h) * world.carry, vy: Math.sin(pose.h) * world.carry });
}

/** One physics step of the world, as the game's (you carried). */
function stepWorld(world) {
  const { you, traffic } = world;
  carryYou(world);
  hw.stepHighway(level, you);
  const cam = hw.speedCamera(level, you);
  // (no screen test given: the traffic's own - the road from 90 m behind you to 270 m ahead)
  traffic.step(DT, { player: you, others: [] });
  const all = [you, ...traffic.cars], startVel = all.map((car) => [car.vx, car.vy]);
  carContacts(all);
  all.forEach((car, i) => hit(car, startVel[i][0], startVel[i][1]));
  const drivers = [{ car: you, frame: level._hw.q, isYou: true, camera: !!cam, kind: 'you',
    touched: false }, ...traffic.list.filter((slot) => !slot.parked && !slot.police).map((slot) =>
    ({ car: slot.car, frame: slot, isYou: false, camera: false, kind: 'traffic', owner: slot,
      touched: false }))];
  stepHeats(world.orders, drivers, { dt: DT, level, slots: traffic.list, cars: traffic.cars });
  world.time += DT;
}

const waiting = (world) => world.traffic.list.filter((slot) => !slot.parked
  && slot.police?.mode === 'wait' && (slot.dir ?? 1) > 0);
const gapTo = (world, slot) => Math.hypot(slot.car.x - world.you.x, slot.car.y - world.you.y);

/** SPEED: past waiting cars at 130 km/h, the heat cleared before each. */
function runSpeed(road, scenery, seed) {
  const world = newWorld(road, scenery, seed);
  world.carry = 130 / 3.6;
  const seen = new Map();
  let passed = 0, starred = 0;
  const why = {}, closest = [];
  while ((level._hw.driven || 0) < KM * 1000 && world.time < KM * 60) {
    // (no waiting car near yet: your slate clean)
    if (!waiting(world).some((slot) => gapTo(world, slot) < PASS_M)
      && ![...seen.keys()].some((slot) => !slot.parked && gapTo(world, slot) < PASS_M)) {
      world.heat.stars = 0;
      world.heat.offences.length = 0;
      world.traffic.clearPolice(world.you);
    }
    stepWorld(world);
    // (a waiting car followed on once it is met, woken or not)
    for (const slot of world.traffic.list) {
      if (slot.parked || !slot.police || (!seen.has(slot) && slot.police.mode !== 'wait')
        || (slot.dir ?? 1) < 0) continue;
      const gap = gapTo(world, slot);
      if (gap > PASS_M) continue;
      const entry = seen.get(slot) || { min: 99, star: null };
      entry.min = Math.min(entry.min, gap);
      if (!entry.star && world.heat.stars) entry.star = world.heat.offences[0] || '?';
      seen.set(slot, entry);
    }
  }
  for (const entry of seen.values()) {
    passed++;
    closest.push(entry.min);
    if (entry.star) {
      starred++;
      why[entry.star] = (why[entry.star] || 0) + 1;
    }
  }
  closest.sort((first, second) => first - second);
  const median = closest.length ? closest[closest.length >> 1].toFixed(1) : '-';
  return `SPEED 130: passed ${passed} waiting, a star from ${starred} ${JSON.stringify(why)},`
    + ` closest median ${median} m (max ${closest.length ? closest.at(-1).toFixed(1) : '-'})`;
}

/** STARRED: past waiting cars at 95 km/h held at 1 star, none owed. */
function runStarred(road, scenery, seed) {
  const world = newWorld(road, scenery, seed);
  world.carry = 95 / 3.6;
  const seen = new Map();
  while ((level._hw.driven || 0) < KM * 1000 && world.time < KM * 60) {
    world.heat.stars = world.heat.sent = 1;
    world.heat.escapeT = 0;
    world.orders.owed = 0;
    stepWorld(world);
    const youS = level._hw.q.s;
    for (const slot of world.traffic.list) {
      if (slot.parked || !slot.police || (slot.dir ?? 1) < 0) continue;
      let entry = seen.get(slot);
      if (!entry && slot.police.mode === 'wait' && gapTo(world, slot) < SIGHT_M)
        seen.set(slot, entry = { passT: null, woke: null, s: slot.s });
      if (!entry) continue;
      if (entry.passT == null && entry.woke == null && youS >= slot.s - 4) entry.passT = world.time;
      if (entry.woke == null && slot.police.mode === 'chase')
        entry.woke = { forYou: slot.police.target === world.you, after: entry.passT == null ? null
          : world.time - entry.passT, past: youS - slot.s };
    }
  }
  const all = [...seen.values()], mine = all.filter((entry) => entry.woke?.forYou);
  const other = all.filter((entry) => entry.woke && !entry.woke.forYou);
  const passedAsleep = all.filter((entry) => !entry.woke && entry.passT != null).length;
  const after = mine.map((entry) => (entry.woke.after == null ? 'before'
    : entry.woke.after.toFixed(1))).join(' ');
  const past = mine.map((entry) => entry.woke.past.toFixed(0)).join(' ');
  return `STARRED 95: met ${all.length} waiting, woke for you ${mine.length} (s after you passed:`
    + ` ${after || '-'}; you m past it: ${past || '-'}), woke for another ${other.length},`
    + ` passed and stayed put ${passedAsleep}`;
}

for (const scenery of SCENERIES) for (const road of ROADS) for (const seed of SEEDS)
  console.log(`${road}/${scenery} seed ${seed}: ${runSpeed(road, scenery, seed)} | `
    + runStarred(road, scenery, seed));
