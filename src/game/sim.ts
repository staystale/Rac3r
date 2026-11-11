// sim.ts — The per-step world: car physics, highway, audio and contact stepping.
import { STOCK_RIM } from '../render/wheelface.ts';
import { TYRE_LOOK } from '../carpaint.ts';
import { realScale } from '../carreal.ts';
import { hwLevel, hwFlow } from './state.ts';
import { step, reset, assertFinite, PHYSICS_STEP_SECONDS } from '../vehicle.ts';
import { stepHighway, highwayGuard, highwayRespawn, speedCamera } from '../highway.ts';
import { blocked } from '../highway/cuts.ts';
import { carContacts } from '../contact.ts';
import { hit, hitRoll, repair, applyBurst, stepDamage } from '../damage.ts';
import { rolling, tripCheck, stepRoll } from '../roll.ts';
import { LEVEL } from "../world/state.ts";
import { headlightsWanted } from "../world/daylight.ts";
import { WEATHER } from "../world/weather.ts";
import { stepWetTrails } from "../wettrail.ts";
import { applyGround } from "../world/wear.ts";
import { clampWorld } from "../world/crossings.ts";
import { crossingOf, onGround } from "../world/crossinggeo.ts";
import { stampCrossingMarks } from "../marks.ts";
import { takeThrownPlanks } from "../world/marshalbox.ts";
import { throwParts, stepParts } from "../world/debris.ts";
import { trackSpotOf } from "../world/trackunder.ts";
import { resetCar, startHeld, stepOrder, formationWant } from './order.ts';
import { doReset, onScreen } from './session.ts';
import { shared, game } from './state.ts';
import { stepAIInjury } from './ai.ts';
import { wakeStep } from '../physics/wake.ts';
import { roofFlapStep } from '../physics/roofflaps.ts';
import type { Car, CarInput } from '../vehicle.ts';
import { advanceWorldClock } from '../world/worldclock.ts';
import type { TrafficVehicle } from '../ai/types.ts';
import { FIX } from '../core/fixes.ts';
import { noteTouches, notePoliceCamera, stepPoliceGame } from './police.ts';

export function recoverCar(why: unknown) {
  if (shared.nanReports++ < 5)
    console.error('[car sim] car state went bad — recovered with a reset. Cause:', why,
      { ...game.car.t });
  game.car.x = shared.lastGood.x;
  game.car.y = shared.lastGood.y;
  game.car.heading = shared.lastGood.heading;
  doReset();
}

/**
 * The FPS meter: accumulates the clamped frame time and, every 0.4 s, publishes the average fps
 * and the worst recent window on `game`.
 * @param wallDt the clamped wall-clock frame time, in seconds
 */
export function updateFpsMeter(wallDt: number) {
  shared.fpsAcc += wallDt;
  shared.fpsN++;
  if (shared.fpsAcc > 0.4) {
    game.fps = shared.fpsN / shared.fpsAcc;
    shared.fpsAcc = 0;
    shared.fpsN = 0;
    // the WORST 0.4 s window of the last ~10 s (user: an FPS counter "in the corner
    // always" to spot issues while testing; a dip lasts a moment, so the corner keeps it on screen
    // for 10 s). hud.ts drawFps.
    if (game.fpsClear) {
      shared.fpsHist.length = 0;
      game.fpsClear = false;
    } else shared.fpsHist.push(game.fps);
    if (shared.fpsHist.length > 25) shared.fpsHist.shift();
    game.fpsLow = shared.fpsHist.length ? Math.min(...shared.fpsHist) : game.fps;
  }
}

/**
 * ?autopilot=1: the AI drives the player car; also caps the speed (?autopilot=<kmh>) and puts a
 * stuck car back on the track.
 * @param wallDt the clamped wall-clock frame time, in seconds
 * @returns the autopilot's input
 */
export function autopilotInput(wallDt: number) {
  const others = [...game.ai.map((rival) => rival.car), ...game.traffic.cars];
  const inp = { ...shared.autoDrv!.drive(game.car, wallDt, { cars: others, lap: 1, laps: 99 }),
    reverse: 0, shiftUp: false, shiftDown: false };
  // ?autopilot=<kmh>: cap the speed (phone judder: highway vs speed)
  if (shared.settings.autopilotKmh > 0) {
    const over = Math.hypot(game.car.vx, game.car.vy) - shared.settings.autopilotKmh / 3.6;
    if (over > 0) inp.throttle = 0;
    if (over > 10 / 3.6) inp.brake = 0.3;
  }
  shared.autoStill = Math.hypot(game.car.vx, game.car.vy) < 2 ? shared.autoStill + wallDt : 0;
  if (shared.autoStill > 3) {
    shared.autoStill = 0;
    if (LEVEL.endless) doReset();
    else {
      const spot = trackSpotOf(LEVEL.subtrack!, game.car.x, game.car.y, game.car)!;
      reset(game.car, spot.x, spot.y, spot.heading);
    }
    shared.autoDrv!.relocate();
  }
  return inp;
}

/**
 * The menu demo: the demo car drives itself; if it stops or strays it is put back on the track.
 * @param wallDt the clamped wall-clock frame time, in seconds
 * @returns the demo driver's input
 */
export function demoInput(wallDt: number) {
  const demo = shared.demo!;   // (called only with a demo driver)
  const inp = { ...demo.drive(game.car, wallDt,
    { cars: game.ai.map((entry) => entry.car), lap: 1, laps: 99 }), reverse: 0, shiftUp: false,
      shiftDown: false };
  shared.demoStill = Math.hypot(game.car.vx, game.car.vy) < 2 ? shared.demoStill + wallDt : 0;
  // TOO INJURED (owner 11-01): the camera car resets for damage as its rivals do -
  // the same pause, then back on the road and mended (game/ai.ts stepAIInjury)
  const entry = shared.demoHurt && shared.demoHurt.drv === shared.demo ? shared.demoHurt
    : (shared.demoHurt = { car: game.car, drv: demo, hurtWait: null, hurtT: 0 });
  entry.car = game.car;
  stepAIInjury(entry, wallDt);
  // the pause plays the crash out on light brakes, as the rivals' (game/ai.ts aiWant)
  if (entry.hurtWait != null) {
    Object.assign(inp, { steer: 0, throttle: 0, brake: 0.4, handbrake: 0 });
    shared.demoStill = 0;
  }
  if (shared.demoStill > 3 || ('lastDist' in demo.state && demo.state.lastDist > 30)) {
    shared.demoStill = 0;
    const spot = trackSpotOf(LEVEL.subtrack!, game.car.x, game.car.y, game.car)!;
    reset(game.car, spot.x, spot.y, spot.heading);
    demo.relocate();
  }
  return inp;
}

/** The stick's reach follows the player car's speed (core/steerfeel.ts THROW). */
function feedStickSpeed() {
  if (game.car) shared.input.speed = Math.hypot(game.car.vx, game.car.vy);
}

/**
 * Reads this frame's player input: the touch / keyboard sample, overridden by the start-grid
 * hold, the ?autopilot driver or the menu demo driver (each also unsticks its car).
 * @param wallDt the clamped wall-clock frame time, in seconds
 * @returns the input the sim steps with
 */
export function readFrameInput(wallDt: number): CarInput {
  feedStickSpeed();
  let inp: CarInput = shared.input.update(wallDt);
  // MENU: the demo car drives itself (src/ai/autodrive.ts — the same driver as the lap bench and
  // the AI seed). If it ever stops (stuck off the road), put it back on the track.
  const formed = shared.mode !== 'menu' && startHeld() && game.start.rolling
    && formationWant(game.car, shared.gridSlot || 0, game.start);
  if (formed) inp = { ...inp, ...formed, reverse: 0, shiftUp: false, shiftDown: false };
  else if (shared.mode !== 'menu' && startHeld()) {
    // held on the grid (a rolling start's formation drives the car, above)
    inp = { ...inp, throttle: 0, brake: 1, handbrake: 0, reverse: 0 };
  }
  // ?autopilot=1: the AI drives the player car; the phone judder test (drops) needs no fingers
  if (shared.settings.autopilot && shared.mode !== 'menu' && !startHeld() && shared.autoDrv)
    inp = autopilotInput(wallDt);
  if (shared.mode === 'menu' && shared.demo) inp = demoInput(wallDt);
  return inp;
}

/**
 * Indicators, the field's lights and the rolled-over notice, once per frame.
 * @param inp this frame's player input
 * @param wallDt the clamped wall-clock frame time, in seconds
 */
export function stepCarSignals(inp: CarInput, wallDt: number) {
  // INDICATORS cancel like a real stalk: after the wheel has been turned that way and come back, or
  // after 8 s (wall clock)
  {
    const player = game.car;
    if (player.indicator) {
      player.indT = (player.indT || 0) + wallDt;
      const steer = inp.steer || 0;
      if (Math.sign(steer) === player.indicator
        && Math.abs(steer) > 0.35) player.indTurned = true; else if (player.indTurned
        && Math.abs(steer) < 0.08) player.indicator = 0;
      if (player.indT > 8) player.indicator = 0;
    }
  }
  updateFieldHeadlights();
  if (game.car.roll && game.car.roll.phase !== 'rolling' && game.car.roll.phase !== 'none'
    && shared.mode === 'session')
    game.notice = { text: game.car.roll.phase === 'roof' ? 'ON YOUR ROOF — RESET'
      : 'ON YOUR SIDE — RESET', at: performance.now() };
}

/**
 * The field's headlights: by the light level (the player's LIGHTS button is their own).
 */
function updateFieldHeadlights() {
  const fieldLights = headlightsWanted();
  for (const entry of game.ai) entry.car.lightsOn = fieldLights;
  for (const car of game.traffic.cars) car.lightsOn = fieldLights;
  // the car the menu's demo drives runs its lights as the field does (no one to press LIGHTS)
  if (shared.mode === 'menu') game.car.lightsOn = fieldLights;
  // RAIN LIGHTS: every racer's rear rain light is on while it rains (road traffic has none)
  const raining = WEATHER.rain > 0;
  game.car.rainLight = raining;
  for (const entry of game.ai) entry.car.rainLight = raining;
}

/**
 * The guide waits for the fly-in to land on the car, then opens and PAUSES the sim until it
 * closes; the rules card queues behind it.
 */
export function openGuideOnLanding() {
  if (shared.guidePending && !shared.renderer.flying) {
    shared.guidePending = false;
    shared.guide.open();
  }
  else if (shared.rulesPending && !shared.guidePending && !shared.guide.active
    && !shared.renderer.flying) {
    const kind = shared.rulesPending;
    shared.rulesPending = null;
    shared.guide.openRules(kind);
  }
}

/**
 * One fixed physics step of the player car: the clamps, damage, ground and rollover, then the
 * car model. A non-finite result puts the car back on the track instead of ending the game.
 * @param inp this frame's player input
 * @returns false if the car had to be recovered (the caller drops the step backlog)
 */
export function stepCarPhysics(inp: CarInput) {
  try {
    // DAMAGE (damage.ts): the velocity change the clamps impose IS the impact
    const pv0x = game.car.vx, pv0y = game.car.vy;
    // the fence, buildings, barriers, trees ... or a bridge's or tunnel's walls
    // (?railbridges=1: the world's movers - a rail bridge's train - on the sim clock)
    advanceWorldClock(PHYSICS_STEP_SECONDS);
    clampWorld(game.car, PHYSICS_STEP_SECONDS);
    hit(game.car, pv0x, pv0y);
    applyGround(game.car, PHYSICS_STEP_SECONDS);
    // ROLLOVER (roll.ts): a rolling / overturned car has no tyres to drive on — the body
    // tumbles or slides; RESET rights it
    if (rolling(game.car)) stepRoll(game.car, PHYSICS_STEP_SECONDS,
      (kind, side, weight) => hitRoll(game.car, kind, side, weight));
    else {
      step(game.car, inp, PHYSICS_STEP_SECONDS);
      tripCheck(game.car, PHYSICS_STEP_SECONDS);
    }
    // a tyre burst (heat, wear, debris): a puncture, and news on the HUD
    // a tyre burst (heat, wear, debris): no written notice - the wheel and the tyre diagram
    // show it (owner: no banners)
    applyBurst(game.car);
    // the stingers, the tyres' air and metal on the ground
    stepDamage(game.car, PHYSICS_STEP_SECONDS);
    assertFinite(game.car);
  } catch (err) {
    recoverCar((err as Error).message);
    return false;
  }
  return true;
}

/**
 * The roadside litter and chevrons stream with the road: new ones in ahead, the ones behind out.
 */
export function streamHighwayLitter() {
  // the roadside LITTER + CHEVRONS (loose objects) stream with the road: new ones ahead in,
  // the ones behind out (a tyre knocked off its stretch goes with it — it never belonged to
  // the road it rolled onto)
  const hwData = hwLevel()._hw;
  const looseNew = hwData.looseNew!;   // (the highway keeps the list)
  if (looseNew.length) {
    game.cones.spawn(looseNew);
    looseNew.length = 0;
  }
  if (hwData.looseCut != null) {
    const cutAt = hwData.looseCut;
    game.cones.cull((cone) => cone._s == null || cone._s >= cutAt);
    hwData.looseCut = null;
  }
  if (hwData.goneFields && hwData.goneFields.size) {
    const gone = hwData.goneFields;
    game.cones.cull((cone) => cone.field == null || !gone.has(cone.field));
    gone.clear();
  }
  // (a junction laid back over road already streamed in takes its litter)
  if (hwData.clearedGround && hwData.clearedGround.length) {
    const ground = hwData.clearedGround;
    game.cones.cull((cone) => !blocked(ground, cone.x, cone.y, CLEARED_M));
    ground.length = 0;
  }
}
// m a loose object keeps off a junction's ground (its body)
const CLEARED_M = 1.5;

/**
 * The highway speed camera: a catch is a HUD card plus a fine on the session; the fastest and
 * the count are kept.
 */
export function caughtBySpeedCamera() {
  // SPEED CAMERA (highway.ts speedCamera): caught = a HUD card (hud.ts drawCamera) + the fine
  // on the session; fastest + count kept
  const cam = speedCamera(hwLevel(), game.car);
  if (cam) {
    game.camCaught = { ...cam, at: performance.now() };
    game.camFines = (game.camFines || 0) + cam.fine;
    game.camCount = (game.camCount || 0) + 1;
    // in memory only: saveRecords writes it at a safe moment
    shared.camRecord.count = (shared.camRecord.count || 0) + 1;
    shared.camRecord.fines = (shared.camRecord.fines || 0) + cam.fine;
    if (!(shared.camRecord.fastest >= cam.kmh)) shared.camRecord.fastest = cam.kmh;
    shared.camDirty = true;
    game.camBest = shared.camRecord.fastest;
    // (?police=1: a camera catching you is heat - game/police.ts)
    if (FIX.police) notePoliceCamera();
  }
}

/**
 * THE ENDLESS HIGHWAY, one step: slide the road window, the treadmill guard, the litter stream,
 * the speed camera and the distance records.
 * @returns false if the guard put the car back (the caller drops the step backlog)
 */
export function stepEndlessHighway() {
  const shift = stepHighway(hwLevel(), game.car);
  if (shift) {
    if (shared.lastOnTrack) shared.lastOnTrack.dist -= shift;
    if (game.trackD != null) game.trackD -= shift;
  }
  // THE TREADMILL GUARD (requirement: go backwards should reset you): wrong way / dropped back /
  // off the motorway -> put back in the left lane at the furthest point
  // reached, rolling at 60 % of the speed you had (or 15 m/s), with the reason shown
  const why = highwayGuard(hwLevel(), game.car, PHYSICS_STEP_SECONDS);
  // the going-wide countdown
  const warn = hwLevel()._hw.warn;
  if (warn) game.notice = { text: warn, at: performance.now() };
  streamHighwayLitter();
  if (why) {
    const speed = Math.max(15, 0.6 * Math.hypot(game.car.vx, game.car.vy)),
      spot = highwayRespawn(hwLevel());
    repair(game.car);
    resetCar(game.car, spot.x, spot.y, spot.h);
    game.car.vx = Math.cos(spot.h) * speed;
    game.car.vy = Math.sin(spot.h) * speed;
    // never put back into (or right behind) a traffic car
    game.traffic.clearAround(spot.x, spot.y, 30);
    shared.lastOnTrack = null;
    shared.breadcrumbs.length = 0;
    if (shared.renderer && shared.renderer.snap) shared.renderer.snap(game.car);
    game.notice = { text: why, at: performance.now() };
    return false;
  }
  caughtBySpeedCamera();
  game.hwDist = hwLevel()._hw.driven || 0;
  if (game.hwDist > (game.hwBest || 0)) {
    game.hwBest = game.hwDist;
  }
  return true;
}

/**
 * Engine and tyre sound, fenced off so a throw can never stop the frame.
 */
export function updateAudio() {
  // AFTER the sim, and fenced off. MEASURED: audio used to run first, and with a NaN car
  // its setTargetAtTime throws — which aborted every frame BEFORE the sim could run the recovery
  // above, so the car stayed broken forever. Sound is cosmetic; it must never be able to stop the
  // game.
  try {
    shared.audio.update(game.car);
  } catch (err) {
    if (shared.nanReports++ < 5) console.error('[car sim] audio.update threw:',
      (err as Error).message);
  }
}

/**
 * Keeps a breadcrumb of the car's position and travel direction every 0.5 s of sim time.
 */
export function dropBreadcrumb() {
  // BREADCRUMBS for RESET on levels with no circuit. MEASURED BUG, (guide audit):
  // doReset read this list but nothing ever wrote to it, so RESET on The Lab sent you to the
  // spawn. Every 0.5 s of sim time while moving and grounded, keep where you were and the way
  // you were TRAVELLING (not facing — mid-spin those differ); RESET uses the one ~2 s back, so
  // the spot you are put on is not the one you just crashed at.
  shared.lastBreadcrumbTime += PHYSICS_STEP_SECONDS;
  if (shared.lastBreadcrumbTime >= 0.5 && Math.hypot(game.car.vx, game.car.vy) > 3
    && !game.car.air) {
    shared.lastBreadcrumbTime = 0;
    shared.breadcrumbs.push({ x: game.car.x, y: game.car.y,
      heading: Math.atan2(game.car.vy, game.car.vx) });
    if (shared.breadcrumbs.length > 12) shared.breadcrumbs.shift();
  }
}

/**
 * The running order for one sim step: the highway order, or the circuit order.
 */
export function stepRunningOrder() {
  if (LEVEL.endless) {
    const hwRace = hwFlow();
    if (hwRace) game.position = hwRace.order!();
  }
  else if ((game.ai.length || game.flow || LEVEL.stage) && LEVEL.subtrack) stepOrder();
}

/**
 * Race flow for one sim step: the running order, then the flow state machine (finish, and the
 * highway end countdowns on the notice line).
 */
export function stepRaceFlow() {
  stepRunningOrder();
  if (game.flow && game.start.t >= (game.start.tGreen0 ?? game.start.tGreen)) {
    const was = game.flow.state;
    game.flow.step!(PHYSICS_STEP_SECONDS);   // (set as the flow is made)
    if (was !== 'done' && game.flow.state === 'done') game.flowDoneAt = performance.now();
    // the HIGHWAY's END COUNTDOWNS on the notice line (requirement: an AI reaching the edge of the
    // screen ahead starts a countdown)
    const flow = hwFlow();
    if (flow
      && flow.cdKind) game.notice = { text: (flow.cdKind === 'ahead' ? (flow.cdHold
        ? 'CLOSING IN  ' : 'CATCH THEM  ') : 'PULLING AWAY  ') + Math.max(1,
          Math.ceil(flow.cd!)), at: performance.now(), good: flow.cdKind === 'behind' };
  }
}

/**
 * TRAFFIC for one sim step, then the contact pass shared by you, the AI and the traffic.
 * @param tcars the traffic cars
 */
export function stepTrafficContacts(tcars: TrafficVehicle[]) {
  // TRAFFIC: driven after the AI (it reads where everyone is), then in the SAME contact pass as
  // you and the AI — full contact, damage
  if (tcars.length || game.traffic.want) game.traffic.step(PHYSICS_STEP_SECONDS,
    { player: game.car, others: game.ai.map((entry) => entry.car), visible: onScreen,
      held: startHeld() });
  // the wake (physics/wake.ts) on the racers on the ground; a car in the air, or alone, has none
  for (const racer of [game.car, ...game.ai.map((entry) => entry.car)])
    racer.dragMul = racer.wakeDown = 1;
  if (game.ai.length || tcars.length) {
    const racers = [game.car, ...game.ai.map((entry) => entry.car)], all = tcars.length
      ? [...racers, ...tcars] : racers, startVel = all.map((racer) => [racer.vx, racer.vy]);
    carContacts(all);
    // (?police=1: the drivers running into a car - their speed changed by it - a police car may
    // see)
    if (FIX.police) noteTouches(all, startVel);
    all.forEach((racer, i) => hit(racer, startVel[i][0], startVel[i][1]));
    if (game.ai.length) wakeStep(racers.filter(onGround));
  }
  if (FIX.police) stepPoliceGame();
  // a stock car's roof flaps (physics/roofflaps.ts)
  for (const racer of [game.car, ...game.ai.map((entry) => entry.car)])
    roofFlapStep(racer, PHYSICS_STEP_SECONDS);
}

/**
 * The loose cones and tyres for one sim step, and the loose tyres a torn-off wheel throws.
 * @param tcars the traffic cars
 */
export function stepLooseCones(tcars: TrafficVehicle[]) {
  // cones are world state, so they advance on the SAME fixed step as the car (rule 5) (traffic
  // within 60 m of you knocks the litter too — a knocked tyre on the road is something they
  // then have to hit)
  {
    const near = tcars.length
      ? tcars.filter((racer) => Math.abs(racer.x - game.car.x) < 60
        && Math.abs(racer.y - game.car.y) < 60) : [];
    // (a car on a bridge or in a tunnel touches nothing on the ground: world/crossings.ts)
    const field = (game.ai.length || near.length
      ? [game.car, ...game.ai.map((entry) => entry.car), ...near] : [game.car]).filter(onGround),
        startVel = field.map((racer) => [racer.vx, racer.vy]);
    // planks a smashed marshal hut threw out join the loose objects (world/marshalbox.ts)
    const planks = takeThrownPlanks();
    if (planks.length) game.cones.spawn(planks);
    game.cones.step(field.length === 1 ? field[0] : field, PHYSICS_STEP_SECONDS);
    field.forEach((racer, i) => hit(racer, startVel[i][0], startVel[i][1]));
    // DAMAGE: a torn-off wheel becomes a loose tyre, thrown from its corner with the car's
    // speed and outward
    for (const racer of field) while (racer.wheelSpawn && racer.wheelSpawn.length) {
      const corner = racer.wheelSpawn.shift()!, cosH = Math.cos(racer.heading),
        sinH = Math.sin(racer.heading),
          alongOff = (corner < 2 ? racer.spec.lf : -racer.spec.lr),
            sideOff = (corner % 2 ? 1 : -1) * (racer.spec.trackWidth || 1.5) / 2;
      const out = (corner % 2 ? 1 : -1) * 4;
      game.cones.add({ x: racer.x + cosH * alongOff - sinH * sideOff,
        y: racer.y + sinH * alongOff + cosH * sideOff, vx: racer.vx * 0.85 - sinH * out,
          vy: racer.vy * 0.85 + cosH * out, ang: racer.heading,
            spin: (Math.random() - 0.5) * 8, ...looseRim(racer.spec, corner) });
    }
    // a knocked-off bumper / wing / panel joins them; the oldest past the cap fade
    throwParts(field, game.cones);
    stepParts(game.cones, PHYSICS_STEP_SECONDS);
  }
}

/**
 * a torn-off wheel shows its rim lying flat (render/wheelface.ts).
 * @param spec the car's spec
 * @param spec.rim its rim colour
 * @param spec.spokes its spoke pattern
 * @param spec.id its car
 * @param spec.len its length, m
 * @param corner the wheel (0, 1 front)
 * @returns the loose wheel's rim fields, or none
 */
function looseRim(spec: { id: string; len: number; rim?: string; spokes?: string },
  corner: number) {
  // (its real tyre and rim - carpaint.ts TYRE_LOOK)
  const base = String(spec.id).split('#')[0], real = TYRE_LOOK[base];
  // (to the car's own scale - carreal.ts realScale)
  const scale = realScale(base, spec.len);
  return { rimCol: spec.rim || STOCK_RIM, spokes: spec.spokes || '',
    ...(real ? { wheelD: real.dia * scale, rimD: real.rim * scale,
      tyreW: (corner < 2 ? real.wF : real.wR) * scale } : {}) };
}

/**
 * Stamps one car's wheels: on the ground's marks, or on the bridge's or tunnel's it is on.
 * @param car the car
 */
function stampTyres(car: Car) {
  const way = crossingOf(car), wheels = game.marks.wheelsOf(car);
  if (way) stampCrossingMarks(way, wheels);
  else game.marks.stamp(wheels);
}

/**
 * Tyre marks for one sim step: the AI, skidding traffic and the player stamp the road.
 * @param tcars the traffic cars
 */
export function stepTyreMarks(tcars: TrafficVehicle[]) {
  for (const entry of game.ai) if (!rolling(entry.car)) stampTyres(entry.car);
  // a skidding / crashing traffic car marks the road
  for (const racer of tcars) if (!rolling(racer) && racer.dmg
    && (Math.abs(racer.t.slipR) > 0.1 || racer.t.lockedF
      || racer.t.lockedR)) game.marks.stamp(game.marks.wheelsOf(racer));
  game.marks.follow(game.car.x, game.car.y);
  // marks are stamped on the SIM step: a mark is world bookkeeping, not an animation
  if (!rolling(game.car)) stampTyres(game.car);
  game.marks.fade(PHYSICS_STEP_SECONDS);
  stepWetTrails(PHYSICS_STEP_SECONDS);
}
