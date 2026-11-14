// loop.ts — The animation frame: fixed-step sim loop, interpolation and drawing.
import { hwLevel } from './state.ts';
import { PHYSICS_STEP_SECONDS } from '../vehicle.ts';
import { takeMeterEvents } from '../ui/meter.ts';
import { hwFrames } from '../highwayrace.ts';
import { LEVEL } from "../world/state.ts";
import { WEATHER, stepWeather } from "../world/weather.ts";
import { stepClock } from "../world/clock.ts";
import { stepPuddles } from "../world/puddles.ts";
import { stepOil } from "../world/oil.ts";
import { stepCoverField } from "../world/coverfield.ts";
import { stepStage, stepJoker, stepRace } from './rules.ts';
import { stepStart } from './order.ts';
import { stepAI } from './ai.ts';
import { updateRecoveryTracking } from './session.ts';
import { stepResults } from './menuflow.ts';
import { holdRace, loadingNow } from './loading.ts';
import { takeMenuTaps } from '../menu/widgets.ts';
import { readNextSprite } from '../render/spritepixels.ts';
import { newBodyFrame } from '../render/rollbody.ts';
import {
  updateFpsMeter, readFrameInput, stepCarSignals, openGuideOnLanding, stepCarPhysics,
  stepEndlessHighway, updateAudio, dropBreadcrumb, stepRaceFlow, stepTrafficContacts,
  stepLooseCones, stepTyreMarks,
} from './sim.ts';
import { shared, game } from './state.ts';
import type { CarInput } from '../vehicle.ts';
// (cast: the renderer's and the HUD's car shapes are narrower than the traffic's and the
// highway flow's - one car type is TODO.md work)
import type { RenderGame } from '../render/types.ts';
import type { HudGame } from '../hud/hudtypes.ts';

// 5 -> 12 (high-speed judder). MEASURED: frames over ~42 ms hit the 5-step cap and
// THREW AWAY sim time, so the car fell behind real time and hitched (drawn car vs a smooth path:
// worst 1.4 m at 200 km/h). wallDt is already capped at 0.1 s (12 steps), so this cannot become the
// "background tab lurch" the cap was guarding against.
export const MAX_STEPS = 12;                // per frame; drop the rest

/**
 * Moves the player car to its interpolated draw pose, between its last two physics poses.
 * @returns the real pose to put back after drawing, or null if none was moved
 */
export function interpolateCar() {
  const car = game.car, prevPose = car._p;
  let keepPose = null;
  if (shared.started && prevPose && !shared.guide.active
    && Math.hypot(car.x - prevPose.x, car.y - prevPose.y) < 5) {
    const alpha = Math.max(0, Math.min(1, shared.acc / PHYSICS_STEP_SECONDS));
    keepPose = { x: car.x, y: car.y, h: car.heading };
    let dHeading = car.heading - prevPose.h;
    dHeading = Math.atan2(Math.sin(dHeading), Math.cos(dHeading));
    car.x = prevPose.x + (car.x - prevPose.x) * alpha;
    car.y = prevPose.y + (car.y - prevPose.y) * alpha;
    car.heading = prevPose.h + dHeading * alpha;
  }
  return keepPose;
}

/**
 * Moves the AI and traffic cars to their interpolated draw poses (same alpha as the player).
 * @returns [car, x, y, heading] entries to put back after drawing
 */
export function interpolateAiCars() {
  const aiKeep: [{ x: number; y: number; heading: number }, number, number, number][] = [];
  if (shared.started
    && !shared.guide.active) for (const aiCar of [...game.ai.map((entry) => entry.car),
      ...game.traffic.cars]) {
    const prev = aiCar._p;
    if (!prev || Math.hypot(aiCar.x - prev.x, aiCar.y - prev.y) > 5) continue;
    const alpha = Math.max(0, Math.min(1, shared.acc / PHYSICS_STEP_SECONDS));
    aiKeep.push([aiCar, aiCar.x, aiCar.y, aiCar.heading]);
    let dHeading = aiCar.heading - prev.h;
    dHeading = Math.atan2(Math.sin(dHeading), Math.cos(dHeading));
    aiCar.x = prev.x + (aiCar.x - prev.x) * alpha;
    aiCar.y = prev.y + (aiCar.y - prev.y) * alpha;
    aiCar.heading = prev.h + dHeading * alpha;
  }
  return aiKeep;
}

/**
 * One fixed physics step of the whole world, in the original order.
 * @param inp this frame's input
 * @returns false when the step must end the frame's stepping (the car was recovered)
 */
export function stepWorld(inp: CarInput) {
  // The lab says what the ground under the car is doing; the car's own suspension answers.
  // Before step, so the load is right for the forces computed this step rather than one step
  // stale. remember the pose BEFORE this step, for the render interpolation below
  game.car._p = { x: game.car.x, y: game.car.y, h: game.car.heading };
  if (!stepCarPhysics(inp)) return false;
  shared.lastGood.x = game.car.x;
  shared.lastGood.y = game.car.y;
  shared.lastGood.heading = game.car.heading;
  updateRecoveryTracking(game.car, PHYSICS_STEP_SECONDS);
  stepJoker(game, game.car);
  stepStage(game, PHYSICS_STEP_SECONDS);
  // THE ENDLESS HIGHWAY: build ahead / drop behind; when the window moves, everything
  // remembered as a road distance moves with it
  if (LEVEL.endless && !stepEndlessHighway()) return false;
  stepRace(game, game.car, PHYSICS_STEP_SECONDS);
  dropBreadcrumb();
  stepStart(PHYSICS_STEP_SECONDS);
  // the HIGHWAY: every car's road frame (s, offset, speed along) once per step, for the racers,
  // the order and the countdowns
  if (LEVEL.endless && (game.ai.length || shared.settings.autopilot)) hwFrames(hwLevel(),
    [game.car, ...game.ai.map((entry) => entry.car), ...game.traffic.cars]);
  stepAI(PHYSICS_STEP_SECONDS);
  stepRaceFlow();
  // the weather (weather.ts): a change of sky is news on the HUD
  const news = stepWeather(PHYSICS_STEP_SECONDS);
  if (news) game.notice = { text: news.text, good: news.good, at: performance.now() };
  // the game clock: runs in an event, the sky follows it
  stepClock(PHYSICS_STEP_SECONDS, shared.mode === 'session', WEATHER.rain);
  stepPuddles(PHYSICS_STEP_SECONDS);
  stepCoverField(PHYSICS_STEP_SECONDS);
  // oil next to water runs into it (world/oil.ts)
  stepOil(PHYSICS_STEP_SECONDS);
  const tcars = game.traffic.cars;
  stepTrafficContacts(tcars);
  stepLooseCones(tcars);
  stepTyreMarks(tcars);
  return true;
}

/** One animation frame's timings (ms; wallDt in s). */
export interface Frame { now: number; wallDt: number; frameMs: number; meterSim: number }

/**
 * The fixed-step sim loop: drains the accumulator in physics steps, up to MAX_STEPS.
 * @param inp this frame's input
 * @param wallDt the clamped wall-clock frame time in seconds
 * @returns ms the sim took this frame, when the meter is on, else 0
 */
export function runSimSteps(inp: CarInput, wallDt: number) {
  let meterSim = 0;
  // the loading screen and its fly-in hold the race: no step, no race time, the AI still; the
  // walkthroughs wait for the fly-in to land (game/loading.ts)
  const held = holdRace();
  if (!held) openGuideOnLanding();
  const stopped = shared.guide.active || shared.paused || held;
  if (stopped) shared.acc = 0;
  if (shared.started && !stopped) {
    shared.acc += wallDt;
    let steps = 0;
    const simT0 = performance.now();   // tools: game.simMs / game.drawMs (smoothed ms per frame)
    while (shared.acc >= PHYSICS_STEP_SECONDS && steps < MAX_STEPS) {
      if (!stepWorld(inp)) {
        shared.acc = 0;
        break;
      }
      shared.acc -= PHYSICS_STEP_SECONDS;
      steps++;
    }
    game.simMs = (game.simMs || 0) * 0.9 + (performance.now() - simT0) * 0.1;
    if (shared.meter) meterSim = performance.now() - simT0;
    if (steps >= MAX_STEPS) shared.acc = 0;      // fell behind: drop it, never catch up in a lurch
    game.stepsLastFrame = steps;
    game.car.brakeLight = inp.brake;
    // the handbrake, for its rear brakes' heat (render/brakeglow.ts)
    game.car.handbrakeOn = inp.handbrake ? 1 : 0;
  }
  return meterSim;
}

/**
 * Draws the meter's per-frame sample and overlay (in a session), and reports the frame
 * (?report=1, the menu's frames too: the owner's "main menu is still sluggish" is measured there).
 * @param frame this frame's timings
 */
export function drawMeter(frame: Frame & { drawT0: number }) {
  const tilesNow = shared.renderer.groundRenders, draw = performance.now() - frame.drawT0;
  const inMenu = shared.mode === 'menu';
  const events = takeMeterEvents();   // highway slides / overview repaints this frame
  if (!inMenu) {
    shared.meter!.add({ dt: frame.frameMs, sim: frame.meterSim, draw, steps: game.stepsLastFrame,
      tiles: tilesNow - shared.meterTiles, touches: shared.meterTouches,
      moving: Math.hypot(game.car.vx, game.car.vy) > 5.6,   // over 20 km/h
      slide: events.slide, overview: events.overview, dist: LEVEL._hw ? game.hwDist ?? 0 : 0 });
  }
  if (shared.reporter) reportFrame(frame, draw, tilesNow - shared.meterTiles, events.slide);
  shared.meterTouches = 0;
  shared.meterTiles = tilesNow;
  if (shared.settings.meterOverlay && !inMenu) {
    shared.meter!.draw(shared.renderer.ctx, shared.renderer.W, shared.renderer.H);
  }
}

/**
 * Adds the frame to the phone report: its timings, the zoom (css px per metre), this frame's GPU
 * uploads / mipmap builds, whether the menu was up and what its buttons did, and the texture
 * warm-up (main.ts) since the last frame.
 * @param frame this frame's timings
 * @param draw ms the draw took
 * @param tiles ground tiles painted this frame
 * @param slide highway slides this frame
 */
function reportFrame(frame: Frame, draw: number, tiles: number, slide: number) {
  const gpu = shared.renderer.gpuCounts || { uploads: 0, mipmaps: 0 };
  const taps = takeMenuTaps();
  shared.reporter!.add([frame.frameMs, frame.meterSim, draw, game.stepsLastFrame, tiles, slide,
    shared.renderer.PPM, gpu.uploads - (shared.meterUploads || 0),
    gpu.mipmaps - (shared.meterMipmaps || 0), shared.mode === 'menu' ? 1 : 0, taps.ignored,
    Math.round(taps.handlerMs), Math.round(shared.warmMs || 0)]);
  shared.warmMs = 0;
  shared.meterUploads = gpu.uploads;
  shared.meterMipmaps = gpu.mipmaps;
}

/**
 * Draws one frame (world, HUD, overlays) at the interpolated poses, then restores the real poses.
 * @param frame this frame
 * @returns the performance.now the draw started at, for the draw-time smoothing
 */
export function renderFrame(frame: Frame) {
  // RENDER INTERPOLATION (requirement: at high speeds the camera / car judder). MEASURED in a real
  // browser at 200 km/h: the 120 Hz sim gave 2 steps on most frames but 3 or 5 on others, so
  // the car jumped up to 10 px on screen (sd 1.5 px per frame) and the camera chased the jumps.
  // Draw the car BETWEEN its last two physics poses, weighted by the leftover accumulator —
  // standard fixed-step practice. The sim itself is untouched. A teleport (RESET / RESTART / car
  // change) clears _p so nothing smears across the map.
  const car = game.car, keepPose = interpolateCar();
  // what this frame drew (tools: judder measurement)
  game.drawn = { x: car.x, y: car.y, t: frame.now };
  // the AI cars are drawn between their last two poses too (same alpha)
  const aiKeep = interpolateAiCars();
  const drawT0 = performance.now();
  try {
    shared.renderer.frame(game as unknown as RenderGame, frame.wallDt, frame.now / 1000);
    if (shared.mode !== 'menu' && !shared.settings.skipLayers.has('hud')) {
      shared.hud.draw(shared.renderer.ctx, game as unknown as HudGame, shared.renderer.W,
        shared.renderer.H,
        frame.wallDt);
    }
    if (shared.churn) shared.churn.step(frame.wallDt, shared.renderer.ctx);   // ?churn= only
    if (shared.meter) drawMeter({ ...frame, drawT0 });
  } finally {
    if (keepPose) {
      car.x = keepPose.x;
      car.y = keepPose.y;
      car.heading = keepPose.h;
    }
    for (const [aiCar, x, y, heading] of aiKeep) {
      aiCar.x = x;
      aiCar.y = y;
      aiCar.heading = heading;
    }
  }
  return drawT0;
}

/**
 * One animation frame: input, the fixed-step sim, audio, then the draw.
 * @param now the requestAnimationFrame timestamp in ms
 */
export function loop(now: number) {
  // Rescheduled FIRST, so a throw anywhere below can never stop the game loop again.
  requestAnimationFrame(loop);
  const frameMs = now - shared.last;   // the meter's dt, before the clamp below
  // whole display refreshes, not the browser's rounded timestamps (game/pacing.ts)
  const gameMs = shared.pacer.step(now, shared.last);
  const wallDt = Math.min(0.1, gameMs / 1000);
  shared.last = now;
  updateFpsMeter(wallDt);

  const inp = readFrameInput(wallDt);
  game.in = inp;
  stepResults();
  stepCarSignals(inp, wallDt);

  // HUD taps are handled in `hudDown` at the moment of the touch, BEFORE the stick or the pedals
  // can claim the pointer — see input.ts. Nothing to do here; a tap that reaches this point hit the
  // world.
  shared.input.consumeTap();

  // ---- fixed-step sim
  const meterSim = runSimSteps(inp, wallDt);
  updateAudio();
  // nothing to draw behind the loading screen (the level is being built under it)
  if (loadingNow()) return;

  const drawT0 = renderFrame({ now, wallDt, frameMs, meterSim });
  game.drawMs = (game.drawMs || 0) * 0.9 + (performance.now() - drawT0) * 0.1;
  const view = shared.renderer;
  shared.guide.draw(view.ctx, game, shared.hud.layout(view.W, view.H), view.W, view.H, wallDt,
    view);
  // one car sprite built since read back now, not in the frames of the crash that dents it
  // (render/spritepixels.ts); counted with the texture warm-up in the phone report
  const readT0 = performance.now();
  if (readNextSprite()) shared.warmMs = (shared.warmMs || 0) + performance.now() - readT0;
  // one rolled car's body may be made in the next frame (render/rollbody.ts)
  newBodyFrame();
}
